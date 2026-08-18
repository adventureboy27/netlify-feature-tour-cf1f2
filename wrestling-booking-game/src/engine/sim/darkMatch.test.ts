// Off-camera, but real — see the design note at the top of darkMatch.ts.

import { describe, expect, it } from 'vitest';
import { mulberry32, rngFromSeed } from '../rng';
import { generateWrestler } from '../generate/wrestler';
import { defaultWorldSettings } from '../world/settings';
import { resolveDarkMatch, type DarkMatchContext } from './darkMatch';
import { computeAftermath } from './aftermath';
import type { MatchRules, Wrestler } from '../types';

const settings = defaultWorldSettings();

function baseRules(overrides: Partial<MatchRules> = {}): MatchRules {
  return {
    preset: 'singles',
    format: 'individuals',
    ruleStrictness: 'lenient',
    aim: 'firstFall',
    falls: 'pinsAndSubs',
    timeLimit: 15,
    stoppage: 'referee',
    countOuts: 'normal',
    reward: 'none',
    pace: 'standard',
    ...overrides,
  };
}

function baseContext(overrides: Partial<DarkMatchContext> = {}): DarkMatchContext {
  return {
    rules: baseRules(),
    matchLengthMinutes: 12,
    settings,
    promotionArchetype: 'sportsEntertainment',
    ...overrides,
  };
}

function pair(seed: string): [Wrestler, Wrestler] {
  const rng = rngFromSeed(seed);
  const names = new Set<string>();
  return [generateWrestler(rng, names), generateWrestler(rng, names)];
}

describe('resolveDarkMatch', () => {
  it('picks a real winner and rates the match the same way a real one would', () => {
    const [a, b] = pair('dark-1');
    const wrestlerById = new Map([[a.id, a], [b.id, b]]);
    const outcome = resolveDarkMatch(
      mulberry32(1),
      [{ wrestlerId: a.id, side: 0 }, { wrestlerId: b.id, side: 1 }],
      wrestlerById,
      10,
      baseContext(),
    );

    expect(outcome.result.winnerWrestlerIds.length + (outcome.result.winnerSide === null ? 1 : 0)).toBeGreaterThan(0);
    expect(outcome.result.rating).toBeGreaterThanOrEqual(3);
    expect(outcome.result.rating).toBeLessThanOrEqual(100);
    expect(outcome.result.titleChanged).toBe(false);
  });

  it('develops the people in it — momentum and records move like an ordinary match', () => {
    const [a, b] = pair('dark-2');
    const wrestlerById = new Map([[a.id, a], [b.id, b]]);
    const outcome = resolveDarkMatch(
      mulberry32(2),
      [{ wrestlerId: a.id, side: 0 }, { wrestlerId: b.id, side: 1 }],
      wrestlerById,
      10,
      baseContext(),
    );

    expect(outcome.changes).toHaveLength(2);
    const outcomes = outcome.changes.map((c) => c.outcome);
    expect(outcomes.filter((o) => o === 'win' || o === 'draw').length).toBeGreaterThan(0);
    expect(outcomes.filter((o) => o === 'loss' || o === 'draw').length).toBeGreaterThan(0);
  });

  it('barely moves popularity next to what the same match would do on camera', () => {
    const [a, b] = pair('dark-3');
    const wrestlerById = new Map([[a.id, a], [b.id, b]]);
    const outcome = resolveDarkMatch(
      mulberry32(3),
      [{ wrestlerId: a.id, side: 0 }, { wrestlerId: b.id, side: 1 }],
      wrestlerById,
      10,
      baseContext(),
    );

    // The same result, run through the ordinary aftermath formula
    // unscaled — the honest baseline of "what a televised match would do".
    const onCamera = computeAftermath({
      participants: [a, b],
      winnerIds: outcome.result.winnerWrestlerIds,
      finish: outcome.result.finish,
      rating: outcome.result.rating,
      stipulation: null,
      isMainEvent: false,
      settings,
    });

    for (let i = 0; i < outcome.changes.length; i++) {
      const dark = outcome.changes[i]!.popularity;
      const lit = onCamera[i]!.popularity;
      if (lit === 0) {
        expect(dark).toBe(0);
      } else {
        expect(Math.abs(dark)).toBeLessThan(Math.abs(lit));
        expect(dark / lit).toBeCloseTo(settings.darkMatchPopularityShare, 5);
      }
    }
  });

  it('carries a real feud — rivalry heat is read the same as a televised match would read it', () => {
    const [a, b] = pair('dark-4');
    const wrestlerById = new Map([[a.id, a], [b.id, b]]);
    const rivalry = {
      id: 'r1',
      participantIds: [a.id, b.id],
      origin: 'worked' as const,
      heat: 90,
      shootHeat: 0,
      startWeek: 1,
      lastAdvancedWeek: 1,
      matchesContested: 0,
      blowoffBooked: false,
      resolvedWeek: null,
    };
    const withHeat = resolveDarkMatch(
      mulberry32(4),
      [{ wrestlerId: a.id, side: 0 }, { wrestlerId: b.id, side: 1 }],
      wrestlerById,
      10,
      baseContext({ rivalry }),
    );
    const withoutHeat = resolveDarkMatch(
      mulberry32(4),
      [{ wrestlerId: a.id, side: 0 }, { wrestlerId: b.id, side: 1 }],
      wrestlerById,
      10,
      baseContext({ rivalry: null }),
    );
    expect(withHeat.result.rating).toBeGreaterThan(withoutHeat.result.rating);
  });

  it('can still hurt somebody — a real casualty roll, not a safe exhibition', () => {
    const [a, b] = pair('dark-5');
    const fragile = { ...a, toughness: 1 };
    const wrestlerById = new Map([[fragile.id, fragile], [b.id, b]]);
    const hot = { ...settings, casualtyChanceCompetitor: 1, casualtyChanceCap: 1 };
    const outcome = resolveDarkMatch(
      mulberry32(5),
      [{ wrestlerId: fragile.id, side: 0 }, { wrestlerId: b.id, side: 1 }],
      wrestlerById,
      10,
      baseContext({ settings: hot }),
    );
    expect(outcome.casualties.length).toBeGreaterThan(0);
    expect(outcome.result.injuries.length).toBeGreaterThan(0);
    expect(outcome.result.injuries[0]!.text.length).toBeGreaterThan(0);
    expect(outcome.result.injuries[0]!.outFor.length).toBeGreaterThan(0);
  });
});
