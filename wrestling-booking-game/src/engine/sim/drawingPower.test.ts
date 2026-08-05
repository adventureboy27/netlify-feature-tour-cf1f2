// The rule this file exists to hold: what you put on is what draws.
//
// A draw, a count-out or a stretcher job sends people home unhappy and they
// stay home. Two good wrestlers given room to work sell the building next
// week. Before this, the finish did not touch the match rating at all and
// demand had no memory of your shows — a month of time-limit draws drew
// exactly the same crowd as a month of classics.

import { describe, it, expect } from 'vitest';
import { computeMatchRating, type MatchRatingContext } from './matchRating';
import { rollFinish } from './finish';
import { computeDemand, updateRecentShowQuality, potentialAudience } from '../economy/showBudget';
import { defaultWorldSettings } from '../world/settings';
import { generateWrestler } from '../generate/wrestler';
import { stipulationById } from '../../data/stipulations';
import { mulberry32, rngFromSeed } from '../rng';
import type { FinishType, MatchRules, Wrestler } from '../types';

const settings = defaultWorldSettings();

function pair(quality: number): Wrestler[] {
  const rng = mulberry32(7);
  const make = () => ({
    ...generateWrestler(rng, new Set()),
    popularity: quality,
    skill: quality,
    agility: quality,
    stamina: quality,
    health: 100,
  });
  const a = { ...make(), alignment: 60 };
  const b = { ...make(), alignment: -60 };
  return [a, b];
}

function rate(participants: Wrestler[], finish: FinishType, over: Partial<MatchRatingContext> = {}): number {
  // simVariance 0 so these compare cleanly.
  return computeMatchRating(mulberry32(1), {
    participants,
    winProbability: 0.5,
    isPPV: false,
    stipulation: null,
    requirementsMet: true,
    matchLengthMinutes: 12,
    simVariance: 0,
    finish,
    titlePrestige: null,
    rivalryHeat: 0,
    shootHeatBonus: 0,
    hardcoreSaturation: 0,
    slotExpectedPopularity: null,
    instructionModifier: 0,
    territoryFit: 0,
    pairChemistryBonus: 0,
    overexposurePenalty: 0,
    ...over,
  }).rating;
}

describe('how a match ends changes what it was worth', () => {
  // Mid-quality on purpose: at 85+ the rating clamps at 100 and flattens
  // every comparison, so these would measure the ceiling, not the model.
  const greats = pair(62);

  it('rewards a decisive finish', () => {
    expect(rate(greats, 'cleanPin')).toBeGreaterThan(rate(greats, 'countOut'));
    expect(rate(greats, 'submission')).toBeGreaterThan(rate(greats, 'disqualification'));
  });

  it('punishes a draw', () => {
    expect(rate(greats, 'timeLimitDraw')).toBeLessThan(rate(greats, 'cleanPin'));
    expect(rate(greats, 'doubleKO')).toBeLessThan(rate(greats, 'cleanPin'));
  });

  it('punishes a count-out hardest of the ordinary finishes — nothing happened', () => {
    const ordinary: FinishType[] = [
      'cleanPin', 'submission', 'knockout', 'rollup',
      'interference', 'disqualification', 'countOut', 'timeLimitDraw', 'doubleKO',
    ];
    const worst = ordinary.reduce((lowest, f) => (rate(greats, f) < rate(greats, lowest) ? f : lowest));
    expect(worst).toBe('countOut');
  });

  it('punishes a stretcher job worst of all', () => {
    const all: FinishType[] = [
      'cleanPin', 'submission', 'knockout', 'rollup', 'refereeStoppage',
      'interference', 'disqualification', 'countOut', 'timeLimitDraw', 'doubleKO', 'injuryStoppage',
    ];
    const worst = all.reduce((lowest, f) => (rate(greats, f) < rate(greats, lowest) ? f : lowest));
    expect(worst).toBe('injuryStoppage');
  });

  it('wastes a great match harder than a bad one', () => {
    // The crowd resents a screwjob in proportion to how good the match had
    // been. Losing a classic to a count-out costs more than losing a dud.
    const greatsLoss = rate(pair(70), 'cleanPin') - rate(pair(70), 'countOut');
    const dudsLoss = rate(pair(15), 'cleanPin') - rate(pair(15), 'countOut');
    expect(greatsLoss).toBeGreaterThan(dudsLoss);
  });

  it('still rates two greats with a bad finish above two nobodies with a good one', () => {
    // The finish matters; it is not the only thing that matters.
    expect(rate(pair(75), 'countOut')).toBeGreaterThan(rate(pair(20), 'cleanPin'));
  });
});

describe('two great wrestlers given room to work', () => {
  it('rates far above a one-sided squash', () => {
    const greats = rate(pair(62), 'cleanPin');
    const squash = computeMatchRating(mulberry32(1), {
      participants: pair(62),
      winProbability: 0.92, // completely one-sided
      isPPV: false,
      stipulation: stipulationById('squash')!,
      requirementsMet: true,
      matchLengthMinutes: 4,
      simVariance: 0,
      finish: 'cleanPin',
      titlePrestige: null,
      rivalryHeat: 0,
      shootHeatBonus: 0,
      hardcoreSaturation: 0,
      slotExpectedPopularity: null,
      instructionModifier: 0,
      territoryFit: 0,
      pairChemistryBonus: 0,
      overexposurePenalty: 0,
    }).rating;
    // Roughly a full star between the same two people given room to work and
    // the same two in a designed squash: 11 points of balance plus the
    // squash's own -6.
    expect(greats - squash).toBeGreaterThan(15);
  });

  it('rates above the same two in a lopsided match', () => {
    const even = rate(pair(62), 'cleanPin', { winProbability: 0.5 });
    const lopsided = rate(pair(62), 'cleanPin', { winProbability: 0.92 });
    expect(even).toBeGreaterThan(lopsided);
  });
});

describe('injury stoppages are rare, and violence makes them less so', () => {
  const rules: MatchRules = {
    preset: 'singles', format: 'individuals', ruleStrictness: 'lenient', aim: 'firstFall',
    falls: 'pinsAndSubs', timeLimit: 15, stoppage: 'referee', countOuts: 'normal', reward: 'none',
  };

  function injuryRate(injuryMultiplier: number): number {
    const rng = rngFromSeed(`inj-${injuryMultiplier}`);
    let stoppages = 0;
    const rolls = 4000;
    for (let i = 0; i < rolls; i++) {
      if (rollFinish(rng, {
        rules, violenceLevel: 0, winnerIsTechnician: false, isUpset: false,
        isCloselyMatched: false, injuryMultiplier,
      }) === 'injuryStoppage') stoppages++;
    }
    return stoppages / rolls;
  }

  it('almost never happens in an ordinary match', () => {
    expect(injuryRate(1)).toBeLessThan(0.03);
  });

  it('becomes a real risk in a violent grudge match', () => {
    // A flaming tables match between two people who hate each other.
    expect(injuryRate(2.6 * 1.5)).toBeGreaterThan(injuryRate(1) * 3);
  });
});

describe('demand remembers what you put on', () => {
  it('is driven mostly by recent shows, not by standing or roster', () => {
    const goodShows = computeDemand(50, 90, 50, settings);
    const badShows = computeDemand(50, 10, 50, settings);
    expect(goodShows - badShows).toBeGreaterThan(30);
  });

  it('turns a run of great shows into a materially bigger crowd', () => {
    // The whole point: put on shows and people come back.
    const after = potentialAudience(computeDemand(55, 90, 50, settings), settings);
    const before = potentialAudience(computeDemand(55, 30, 50, settings), settings);
    expect(after).toBeGreaterThan(before * 5);
  });

  it('empties the building over a month of draws and count-outs', () => {
    let quality = 70;
    for (let week = 0; week < 8; week++) quality = updateRecentShowQuality(quality, 25, settings);
    expect(quality).toBeLessThan(30);
    expect(potentialAudience(computeDemand(55, quality, 50, settings), settings)).toBeLessThan(
      potentialAudience(computeDemand(55, 70, 50, settings), settings) / 2,
    );
  });

  it('recovers over a run of good nights', () => {
    let quality = 20;
    for (let week = 0; week < 8; week++) quality = updateRecentShowQuality(quality, 85, settings);
    expect(quality).toBeGreaterThan(70);
  });

  it('does not swing wildly on one night', () => {
    // A single great show should not sell out an arena next week, and one bad
    // one should not empty it.
    const after = updateRecentShowQuality(50, 100, settings);
    expect(after - 50).toBeLessThan(25);
  });

  it('stays inside 0-100 at the extremes', () => {
    expect(updateRecentShowQuality(0, 0, settings)).toBeGreaterThanOrEqual(0);
    expect(updateRecentShowQuality(100, 100, settings)).toBeLessThanOrEqual(100);
  });
});
