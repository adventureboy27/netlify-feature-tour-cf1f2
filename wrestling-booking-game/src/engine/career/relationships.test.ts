// Ties that form because two people kept being put in the same ring.
//
// The seeded ties were the only ones that had ever existed. Measured on a
// played save before this: 21 relationships, frozen for the whole run,
// covering 23 of 155 people — everybody who debuted after week one went their
// entire career without a friend or an enemy, and the seeded ties decayed
// toward lapsing. These tests hold the rule that fixed it.

import { describe, expect, it } from 'vitest';
import { defaultWorldSettings } from '../world/settings';
import { rngFromSeed } from '../rng';
import { generateWrestler } from '../generate/wrestler';
import type { Relationship, Wrestler } from '../types';
import { rollNewTie, findRelationship, relationshipsFor } from './relationships';

const settings = defaultWorldSettings();

function person(seed: string, over: Partial<Wrestler> = {}): Wrestler {
  return { ...generateWrestler(rngFromSeed(seed), new Set(), { currentYear: 2030 }), ...over };
}

/** The first seed in a run that actually produces a tie — formation is a roll. */
function firstTie(a: Wrestler, b: Wrestler, sameSide = false, tag = 'seek'): Relationship {
  for (let i = 0; i < 500; i++) {
    const tie = rollNewTie(rngFromSeed(`${tag}-${i}`), a, b, sameSide, 99, [], settings);
    if (tie) return tie;
  }
  throw new Error('no tie formed in 500 rolls');
}

/** Roll the pair many times over and report what came out. */
function outcomes(a: Wrestler, b: Wrestler, sameSide: boolean, tries = 400) {
  const seen: Record<string, number> = {};
  let formed = 0;
  for (let i = 0; i < tries; i++) {
    const tie = rollNewTie(rngFromSeed(`tie-${i}`), a, b, sameSide, 99, [], settings);
    if (!tie) continue;
    formed++;
    seen[tie.type] = (seen[tie.type] ?? 0) + 1;
  }
  return { formed, seen };
}

describe('a tie that forms in the ring', () => {
  it('needs more than one night together', () => {
    const a = person('a');
    const b = person('b');
    for (let met = 0; met < settings.tieFormMinMeetings; met++) {
      // Rolled hard: no seed should produce a tie below the threshold.
      for (let i = 0; i < 50; i++) {
        expect(rollNewTie(rngFromSeed(`early-${met}-${i}`), a, b, false, met, [], settings)).toBeNull();
      }
    }
    expect(outcomes(a, b, false).formed).toBeGreaterThan(0);
  });

  it('never doubles up on a pair who already have one', () => {
    const a = person('a');
    const b = person('b');
    const existing: Relationship[] = [{ aId: a.id, bId: b.id, type: 'friend', strength: 50, history: [] }];
    for (let i = 0; i < 100; i++) {
      expect(rollNewTie(rngFromSeed(`dupe-${i}`), a, b, false, 99, existing, settings)).toBeNull();
    }
  });

  it('leaves somebody whose circle is already full alone', () => {
    const a = person('a');
    const b = person('b');
    const crowd: Relationship[] = Array.from({ length: settings.circleMax }, (_, i) => ({
      aId: a.id,
      bId: `other-${i}`,
      type: 'friend' as const,
      strength: 50,
      history: [],
    }));
    expect(relationshipsFor(crowd, a.id)).toHaveLength(settings.circleMax);
    for (let i = 0; i < 100; i++) {
      expect(rollNewTie(rngFromSeed(`full-${i}`), a, b, false, 99, crowd, settings)).toBeNull();
    }
  });

  it('never makes partners into enemies', () => {
    const { formed, seen } = outcomes(person('p1'), person('p2', { age: 30 }), true);
    expect(formed).toBeGreaterThan(0);
    expect(seen.enemy ?? 0).toBe(0);
  });

  it('leaves opponents friendly more often than hostile', () => {
    // Treating every opponent pairing as an enemy produced 140 enemies to 20
    // friends over two played years, which is a riot rather than a locker
    // room. Opponents roll enmity at the same rate the seeded ties use.
    const { formed, seen } = outcomes(person('o1', { age: 30 }), person('o2', { age: 31 }), false);
    expect(formed).toBeGreaterThan(20);
    const friendly = (seen.friend ?? 0) + (seen.mentor ?? 0) + (seen.protege ?? 0);
    expect(seen.enemy ?? 0).toBeGreaterThan(0);
    expect(friendly).toBeGreaterThan(seen.enemy ?? 0);
  });

  it('calls a wide age gap what it is', () => {
    const { seen } = outcomes(person('old', { age: 46 }), person('young', { age: 24 }), true);
    expect((seen.mentor ?? 0) + (seen.protege ?? 0)).toBeGreaterThan(0);
    expect(seen.friend ?? 0).toBe(0);
  });

  it('starts weak enough that the ordinary drift decides what it becomes', () => {
    const tie = firstTie(person('a'), person('b'), false, 'strength');
    expect(tie.strength).toBeGreaterThanOrEqual(settings.tieFormStartMin);
    expect(tie.strength).toBeLessThanOrEqual(settings.tieFormStartMax);
    // Well short of the point where somebody refuses to work — a refusal is
    // years of shared cards away, not one good match.
    expect(tie.strength).toBeLessThan(settings.relationshipRefusalThreshold);
  });

  it('is findable from either end once it exists', () => {
    const a = person('a');
    const b = person('b');
    const tie = firstTie(a, b, false, 'find');
    expect(findRelationship([tie], a.id, b.id)).toBe(tie);
    expect(findRelationship([tie], b.id, a.id)).toBe(tie);
  });
});
