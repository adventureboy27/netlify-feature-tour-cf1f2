import { describe, expect, it } from 'vitest';
import { mulberry32, rngFromSeed } from '../rng';
import { generateWrestler } from '../generate/wrestler';
import { defaultWorldSettings } from '../world/settings';
import { simulateMatch, type SimParticipant, type SimulateMatchContext } from './simulateMatch';
import { stipulationById, stipulationRequirementsMet } from '../../data/stipulations';
import { ruleAdjustedWeights, kayfabeScore } from './kayfabe';
import { countsAFall, countsNearFalls } from './officiating';
import type { MatchRules, Wrestler } from '../types';

const sumo = stipulationById('sumo')!;

function rules(): MatchRules {
  return { preset: 'singles', format: 'individuals', ruleStrictness: 'lenient', aim: 'firstFall', falls: 'pinsAndSubs', timeLimit: 15, stoppage: 'referee', countOuts: 'normal', reward: 'none', pace: 'standard' };
}
function ctx(): SimulateMatchContext {
  return { rules: rules(), stipulation: sumo, requirementsMet: true, isPPV: false, matchLengthMinutes: 10, settings: defaultWorldSettings(), week: 3 };
}
function pair(seed: number): Wrestler[] {
  const rng = mulberry32(seed);
  const names = new Set<string>();
  return [generateWrestler(rng, names), generateWrestler(rng, names)];
}

describe('sumo', () => {
  it('is won off the edge of the ring, two falls to one or none, and every fall is in the write-up with its score', () => {
    let ringOuts = 0;
    let wentThree = 0;
    for (let i = 0; i < 150; i++) {
      const roster = pair(100 + i);
      const byId = new Map(roster.map((w) => [w.id, w]));
      const participants: SimParticipant[] = roster.map((w, side) => ({ wrestlerId: w.id, side }));
      const r = simulateMatch(rngFromSeed(`sumo-${i}`), participants, byId, ctx());
      // No pins, holds, counts or draws in a ring-out match.
      expect(['ringOut', 'disqualification', 'injuryStoppage']).toContain(r.finish);
      const falls = r.beats.filter((b) => b.spot === 'pushedOff');
      for (const b of falls) {
        expect(b.actorId).toBeTruthy();
        expect(b.targetId).toBeTruthy();
        expect(b.score![0]).toBeLessThan(2);
      }
      if (r.finish !== 'ringOut') continue;
      ringOuts++;
      const winnerId = r.winnerWrestlerIds[0]!;
      const byWinner = falls.filter((b) => b.actorId === winnerId).length;
      const byLoser = falls.length - byWinner;
      // The finish is the winner's second fall.
      expect(byWinner).toBe(1);
      expect(byLoser).toBeLessThanOrEqual(1);
      const finish = r.beats.find((b) => b.kind === 'finish')!;
      expect(finish.score).toEqual([2, byLoser]);
      expect(finish.text).toContain(byLoser === 1 ? 'two falls to one' : 'two falls to none');
      if (byLoser === 1) wentThree++;
      // Every fall comes before the finish, in order, and the running score adds up.
      const order = r.beats.filter((b) => b.spot === 'pushedOff' || b.kind === 'finish');
      expect(order[order.length - 1]!.kind).toBe('finish');
      // Nothing that cannot happen without ropes, pins or holds.
      for (const b of r.beats) expect(b.text).not.toMatch(/\brope|turnbuckle|kicked out|tap(ped)? out|three count/i);
    }
    expect(ringOuts).toBeGreaterThan(100);
    // Some go the distance, most do not have to.
    expect(wentThree).toBeGreaterThan(5);
    expect(wentThree).toBeLessThan(ringOuts);
  });

  it('is the same match every time from the same seed', () => {
    const roster = pair(7);
    const byId = new Map(roster.map((w) => [w.id, w]));
    const participants: SimParticipant[] = roster.map((w, side) => ({ wrestlerId: w.id, side }));
    const a = simulateMatch(rngFromSeed('again'), participants, byId, ctx());
    const b = simulateMatch(rngFromSeed('again'), participants, byId, ctx());
    expect(a.beats).toEqual(b.beats);
  });

  it('is won by strength', () => {
    const [w] = pair(9);
    const strong = { ...w!, strength: 95, agility: 30 };
    const quick = { ...w!, strength: 30, agility: 95 };
    const weights = ruleAdjustedWeights({ ...rules(), aim: 'ringOut' }, false, false);
    expect(kayfabeScore(strong, weights)).toBeGreaterThan(kayfabeScore(quick, weights));
  });

  it('has no referee counts in it, and is one on one', () => {
    const r = { ...rules(), ...sumo.impliedRules };
    expect(countsAFall('cleanPin', sumo, r)).toBe(false);
    expect(countsNearFalls(sumo, r)).toBe(false);
    const four = [...pair(1), ...pair(2)];
    expect(stipulationRequirementsMet(sumo, { participants: four, rivalryHeat: 0, matchTimeLimitMinutes: 15, ownedGearUnits: 0 })).toBe(false);
    expect(stipulationRequirementsMet(sumo, { participants: pair(3), rivalryHeat: 0, matchTimeLimitMinutes: 15, ownedGearUnits: 0 })).toBe(true);
  });
});
