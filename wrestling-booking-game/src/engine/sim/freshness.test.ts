import { describe, expect, it } from 'vitest';
import {
  ageGimmick,
  freshnessLabel,
  goneStaleLine,
  isStale,
  overexposurePenalty,
  pairingsIn,
  recallBookings,
  staleGimmickPenalty,
} from './freshness';
import { HE, SHE } from '../career/pronouns';
import { defaultWorldSettings } from '../world/settings';
import { generateWrestlers } from '../generate/wrestler';
import { rngFromSeed } from '../rng';
import type { Segment, Show, Wrestler } from '../types';

const settings = defaultWorldSettings();

function match(slot: number, sideA: string[], sideB: string[]): Segment {
  return {
    slot,
    kind: 'match',
    participants: [
      ...sideA.map((wrestlerId) => ({ wrestlerId, side: 0, role: 'competitor' as const })),
      ...sideB.map((wrestlerId) => ({ wrestlerId, side: 1, role: 'competitor' as const })),
    ],
    rules: { pace: 'standard', minutes: 12 } as unknown as Segment['rules'],
    stipulation: null,
    titleIds: [],
    deckStacking: {} as unknown as Segment['deckStacking'],
    result: null,
  } as Segment;
}

function show(week: number, segments: Segment[]): Show {
  return { id: `s${week}`, week, segments } as Show;
}

describe('what the crowd was shown', () => {
  it('counts cross-side pairs and ignores partners', () => {
    // A and B are a team; they are not a match-up with each other.
    const keys = pairingsIn(match(0, ['a', 'b'], ['c', 'd']));
    expect(keys).toHaveLength(4);
    expect(keys.some((k) => k.includes('a') && k.includes('b'))).toBe(false);
    expect(keys.some((k) => k.includes('a') && k.includes('c'))).toBe(true);
  });

  it('reads a pairing the same way round either way', () => {
    expect(pairingsIn(match(0, ['a'], ['b']))).toEqual(pairingsIn(match(0, ['b'], ['a'])));
  });

  it('forgets past the lookback window', () => {
    const ancient = show(1, [match(0, ['a'], ['b'])]);
    const recent = show(40, [match(0, ['a'], ['b'])]);
    const memory = recallBookings([ancient, recent], 41, settings);
    expect(memory.pairings.get([...memory.pairings.keys()][0]!)).toBe(1);
  });

  it('counts a week once however many times somebody worked on it', () => {
    const busy = show(10, [match(0, ['a'], ['b']), match(1, ['a'], ['c'])]);
    const memory = recallBookings([busy], 11, settings);
    expect(memory.weeksSeen.get('a')).toBe(1);
  });
});

describe('running the same match over and over', () => {
  it('is free the first time and costs by the third', () => {
    const once = recallBookings([show(9, [match(0, ['a'], ['b'])])], 10, settings);
    expect(overexposurePenalty(match(0, ['a'], ['b']), once, settings)).toBe(0);

    const thrice = recallBookings(
      [1, 2, 3].map((w) => show(6 + w, [match(0, ['a'], ['b'])])),
      10,
      settings,
    );
    expect(overexposurePenalty(match(0, ['a'], ['b']), thrice, settings)).toBeGreaterThan(0);
  });

  it('gets worse the more it is repeated, up to a cap', () => {
    const history = (times: number) =>
      recallBookings(
        Array.from({ length: times }, (_, i) => show(9 - i, [match(0, ['a'], ['b'])])),
        10,
        settings,
      );
    const three = overexposurePenalty(match(0, ['a'], ['b']), history(3), settings);
    const six = overexposurePenalty(match(0, ['a'], ['b']), history(6), settings);
    expect(six).toBeGreaterThan(three);
    expect(six).toBeLessThanOrEqual(settings.overexposureRepeatCap + settings.overexposureAppearanceCap);
  });

  it('is driven by the stalest pair, not the average', () => {
    // A has fought B to death; C is new. Putting C in beside B does not
    // launder the match — the crowd has still seen A and B six times.
    const history = recallBookings(
      Array.from({ length: 6 }, (_, i) => show(9 - i, [match(0, ['a'], ['b'])])),
      10,
      settings,
    );
    const laundered = overexposurePenalty(match(0, ['a', 'c'], ['b', 'd']), history, settings);
    expect(laundered).toBeGreaterThan(0);
  });

  it('charges nothing for a match nobody has seen', () => {
    const history = recallBookings(
      Array.from({ length: 6 }, (_, i) => show(9 - i, [match(0, ['a'], ['b'])])),
      10,
      settings,
    );
    expect(overexposurePenalty(match(0, ['x'], ['y']), history, settings)).toBe(0);
  });
});

describe('being on every single week', () => {
  it('costs something even when the opponent keeps changing', () => {
    // The exact failure the feature exists for: rotate opponents but never
    // rest the star, and nothing used to notice.
    const weeks = Array.from({ length: 8 }, (_, i) => show(2 + i, [match(0, ['star'], [`opp${i}`])]));
    const memory = recallBookings(weeks, 10, settings);
    expect(overexposurePenalty(match(0, ['star'], ['fresh']), memory, settings)).toBeGreaterThan(0);
  });

  it('leaves somebody used sparingly alone', () => {
    const weeks = [show(3, [match(0, ['star'], ['a'])]), show(7, [match(0, ['star'], ['b'])])];
    const memory = recallBookings(weeks, 10, settings);
    expect(overexposurePenalty(match(0, ['star'], ['c']), memory, settings)).toBe(0);
  });
});

describe('a deep roster is worth its payroll', () => {
  // This is the whole reason the feature exists. The game asks the player to
  // carry thirty-odd people; before this, twelve was strictly cheaper —
  // identical ratings, less wage bill. The measurement is the feature.
  function seasonPenalty(rosterSize: number, weeks = 26): number {
    const names = Array.from({ length: rosterSize }, (_, i) => `w${i}`);
    const shows: Show[] = [];
    let total = 0;
    let next = 0;
    for (let week = 1; week <= weeks; week++) {
      // Six matches a night, drawing from the roster in rotation.
      const card: Segment[] = [];
      for (let slot = 0; slot < 6; slot++) {
        const a = names[next % rosterSize]!;
        const b = names[(next + 1) % rosterSize]!;
        next += 2;
        card.push(match(slot, [a], [b]));
      }
      const memory = recallBookings(shows, week, settings);
      for (const segment of card) total += overexposurePenalty(segment, memory, settings);
      shows.push(show(week, card));
    }
    return total / (weeks * 6);
  }

  it('punishes a twelve-man roster and spares a thirty-man one', () => {
    const small = seasonPenalty(12);
    const deep = seasonPenalty(32);
    expect(small, 'a small roster should be feeling the strain').toBeGreaterThan(2);
    expect(deep, 'a deep roster should mostly stay fresh').toBeLessThan(small / 2);
  });
});

describe('an act wearing out', () => {
  const someone = (over: Partial<Wrestler> = {}): Wrestler => {
    const [w] = generateWrestlers(rngFromSeed('fresh'), 1);
    return { ...w!, gimmickFreshness: 100, ...over };
  };

  it('wears out faster from working than from waiting', () => {
    const worked = someone();
    const rested = someone();
    ageGimmick(worked, true, settings);
    ageGimmick(rested, false, settings);
    expect(worked.gimmickFreshness).toBeLessThan(rested.gimmickFreshness);
    expect(rested.gimmickFreshness).toBeLessThan(100);
  });

  it('actually reaches the threshold the repackage event waits on', () => {
    // The bug: nothing decayed this, so it sat at 100 forever and the event
    // gated on `gimmickFreshness < 60` could never fire in any save.
    const w = someone();
    let weeks = 0;
    while (!isStale(w, settings) && weeks < 200) {
      ageGimmick(w, true, settings);
      weeks++;
    }
    expect(isStale(w, settings), 'never goes stale').toBe(true);
    // And it should take a while — a gimmick that stales in a month is noise.
    expect(weeks).toBeGreaterThan(15);
    expect(weeks).toBeLessThan(60);
  });

  it('never goes below zero', () => {
    const w = someone({ gimmickFreshness: 0.2 });
    ageGimmick(w, true, settings);
    expect(w.gimmickFreshness).toBe(0);
  });

  it('costs a match nothing until it is genuinely stale', () => {
    expect(staleGimmickPenalty([someone({ gimmickFreshness: 100 })], settings)).toBe(0);
    expect(staleGimmickPenalty([someone({ gimmickFreshness: 61 })], settings)).toBe(0);
    expect(staleGimmickPenalty([someone({ gimmickFreshness: 10 })], settings)).toBeGreaterThan(0);
  });

  it('is dragged down by the stalest person in the match', () => {
    const hot = someone({ gimmickFreshness: 100 });
    const worn = someone({ gimmickFreshness: 5 });
    expect(staleGimmickPenalty([hot, worn], settings)).toBeGreaterThan(0);
    expect(staleGimmickPenalty([hot, worn], settings)).toBe(staleGimmickPenalty([worn], settings));
  });

  it('is bounded by the settings, so it can never swamp a match', () => {
    expect(staleGimmickPenalty([someone({ gimmickFreshness: 0 })], settings)).toBeLessThanOrEqual(
      settings.staleGimmickPenaltyMax,
    );
  });
});

describe('telling the player an act has worn out', () => {
  const fresh = (gimmickFreshness: number) => ({ gimmickFreshness, name: 'Duke Rawlins' } as Wrestler);

  it('reads as words rather than a number, all the way down', () => {
    // §0: stats are bars and words. The whole point of this ladder is that
    // the penalty was live and the diagnosis was invisible.
    expect(freshnessLabel(fresh(100), settings)).toBe('Fresh');
    expect(freshnessLabel(fresh(settings.staleGimmickThreshold), settings)).toBe('Settled in');
    expect(freshnessLabel(fresh(settings.staleGimmickThreshold - 1), settings)).toBe('Wearing thin');
    expect(freshnessLabel(fresh(0), settings)).toBe('Nobody is buying it');
  });

  it('turns worn the same week the penalty starts biting', () => {
    // The label and the penalty must not disagree — a card that says "Settled
    // in" while the rating is being docked is worse than saying nothing.
    const justUnder = fresh(settings.staleGimmickThreshold - 0.1);
    expect(isStale(justUnder, settings)).toBe(true);
    expect(staleGimmickPenalty([justUnder], settings)).toBeGreaterThan(0);
    expect(freshnessLabel(justUnder, settings)).not.toBe('Settled in');

    const justOver = fresh(settings.staleGimmickThreshold);
    expect(isStale(justOver, settings)).toBe(false);
    expect(staleGimmickPenalty([justOver], settings)).toBe(0);
  });

  it('says what it costs and what to do about it', () => {
    const said = goneStaleLine('Duke Rawlins', HE);
    expect(said).toContain('Duke Rawlins');
    expect(said).toContain('every match');
    // And it is not written for men only.
    expect(goneStaleLine('Josie Voss', SHE)).not.toMatch(/\b(he|him|his)\b/i);
  });
});
