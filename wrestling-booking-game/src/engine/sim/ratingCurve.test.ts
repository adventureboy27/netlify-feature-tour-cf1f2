// Stars are earned, not handed out. data/ratingCurve.ts makes the top of the
// scale steeper; these check it does that and only that.

import { describe, expect, it } from 'vitest';
import { mulberry32, rngFromSeed } from '../rng';
import { generateWrestler } from '../generate/wrestler';
import { defaultWorldSettings } from '../world/settings';
import { simulateMatch } from './simulateMatch';
import type { MatchRules, Wrestler } from '../types';

const RULES: MatchRules = { preset: 'singles', format: 'individuals', ruleStrictness: 'lenient', aim: 'firstFall', falls: 'pinsAndSubs', timeLimit: 30, stoppage: 'referee', countOuts: 'normal', reward: 'none', pace: 'standard' };
const CURVE = 'A classic is hard to earn';

/** A pay-per-view main event between two wrestlers this good at everything. */
function mainEvents(level: number, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const rng = mulberry32(900 + i);
    const names = new Set<string>();
    const ws: Wrestler[] = [generateWrestler(rng, names), generateWrestler(rng, names)].map((w) => ({
      ...w, popularity: level, skill: level, agility: level, stamina: level, strength: level, charisma: level, health: 100, momentum: 70, ringIQ: level,
    }));
    const byId = new Map(ws.map((w) => [w.id, w]));
    return simulateMatch(rngFromSeed(`curve-${level}-${i}`), ws.map((w, side) => ({ wrestlerId: w.id, side })), byId, {
      rules: RULES, stipulation: null, requirementsMet: true, isPPV: true, matchLengthMinutes: 22, settings: defaultWorldSettings(), week: 30, isMainEvent: true, titlePrestige: 80,
    });
  });
}
/** A botch or a pyro burn costs the match points after it is rated: not this curve's business. */
const clean = (r: ReturnType<typeof simulateMatch>) => !r.beats.some((b) => b.kind === 'botch' || b.kind === 'pyroBurn');
const share = (stars: number[], atLeast: number) => stars.filter((s) => s >= atLeast).length / stars.length;

describe('stars are earned, not handed out', () => {
  it('two legends having the night of their lives can still go the full five — but only now and then', () => {
    const stars = mainEvents(95, 400).map((r) => r.stars);
    expect(share(stars, 5)).toBeGreaterThan(0);
    expect(share(stars, 5)).toBeLessThan(0.08);
    expect(share(stars, 4.5)).toBeLessThan(0.25);
    // ...and legends are still legends: four stars is a normal night for them.
    expect(share(stars, 4)).toBeGreaterThan(0.3);
  });

  it('good, solid hands almost never reach four and a half', () => {
    const stars = mainEvents(65, 400).map((r) => r.stars);
    expect(share(stars, 4.5)).toBeLessThan(0.02);
    expect(share(stars, 5)).toBe(0);
  });

  it('leaves an ordinary match exactly as it was', () => {
    for (const r of mainEvents(40, 60).filter(clean)) {
      if (r.ratingBreakdown.some((t) => t.label === CURVE)) continue;
      // Below the knee nothing is taken off, and the breakdown still adds up to the rating.
      const sum = r.ratingBreakdown.reduce((a, t) => a + t.value, 0);
      expect(r.rating).toBeCloseTo(Math.min(100, Math.max(3, sum)), 5);
    }
  });

  it('never ranks a better match below a worse one', () => {
    const points = [...mainEvents(95, 60), ...mainEvents(80, 60), ...mainEvents(65, 60)]
      .filter(clean)
      .map((r) => {
        const raw = r.ratingBreakdown.filter((t) => t.label !== CURVE).reduce((a, t) => a + t.value, 0);
        return { raw, rating: r.rating };
      })
      .sort((a, b) => a.raw - b.raw);
    for (let i = 1; i < points.length; i++) expect(points[i]!.rating).toBeGreaterThanOrEqual(points[i - 1]!.rating - 1e-9);
  });
});
