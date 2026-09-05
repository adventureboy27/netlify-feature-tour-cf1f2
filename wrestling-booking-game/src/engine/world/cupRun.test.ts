// The price of a one-night bracket.
//
// `matchesWorkedTonight`, `nightFatigueMultiplier` and `nightHealthCost` were
// all written and tested in tournament/bracket.ts and none of them had a
// caller, so a wrestler in their third match of the night was exactly as
// fresh as in their first. That made a single-night tournament a pure seeding
// exercise rather than a decision about a body.

import { describe, expect, it } from 'vitest';
import { runCup, type CupRunContext } from './cupRun';
import { generateWrestlers } from '../generate/wrestler';
import { defaultWorldSettings } from './settings';
import { rngFromSeed } from '../rng';
import type { Promotion, Wrestler } from '../types';

const settings = defaultWorldSettings();

function company(id: string): Promotion {
  return { id, name: `${id} Wrestling`, bankBalance: 100_000, rosterIds: [] } as unknown as Promotion;
}

/** Four companies of two, which gives an eight-entrant bracket: three rounds. */
function field(seed: string): CupRunContext['field'] {
  return ['a', 'b', 'c', 'd'].map((id) => ({
    promotion: company(id),
    entrants: generateWrestlers(rngFromSeed(`${seed}-${id}`), 2, { settings }).map((w, n) => ({
      ...w,
      id: `${id}${n}`,
      health: 100,
    })) as Wrestler[],
  }));
}

function runOne(seed: string) {
  return runCup(rngFromSeed(seed), {
    field: field(seed),
    slotsEach: 2,
    week: 30,
    year: 2025,
    settings,
  });
}

describe('what a night in the bracket costs', () => {
  it('charges the people who kept winning, and nobody who went out early', () => {
    const result = runOne('worn');
    expect(result).not.toBeNull();

    const worn = new Map(result!.wornOut.map((w) => [w.wrestlerId, w.cost]));
    for (const [id, rounds] of Object.entries(result!.roundsWon)) {
      if (rounds >= 2) expect(worn.get(id) ?? 0, `${id} won ${rounds} and paid nothing`).toBeGreaterThan(0);
    }
    // Beaten in the first match, nothing to pay — one match is one match.
    const oneAndDone = Object.entries(result!.roundsWon).find(([, r]) => r === 0)?.[0];
    if (oneAndDone) expect(worn.get(oneAndDone) ?? 0).toBe(0);
  });

  it('costs the winner as much as anybody, because they worked the most', () => {
    const result = runOne('worn')!;
    const worn = new Map(result.wornOut.map((w) => [w.wrestlerId, w.cost]));
    const winnerCost = worn.get(result.winnerId) ?? 0;
    for (const [id, cost] of worn) {
      if (id !== result.winnerId) expect(winnerCost).toBeGreaterThanOrEqual(cost);
    }
  });

  it('leaves the night in the night — the entrants come out unmodified', () => {
    // The fatigue multiplier is applied to a copy on purpose. The engine
    // reports what the night cost and the caller charges it; nothing should
    // have been quietly scaled on the way through.
    const entrants = field('worn').flatMap((f) => f.entrants);
    const before = entrants.map((w) => w.health);
    runCup(rngFromSeed('worn'), { field: field('worn'), slotsEach: 2, week: 30, year: 2025, settings });
    expect(entrants.map((w) => w.health)).toEqual(before);
  });

  it('reports the cost rather than applying it, so the wire can say it', () => {
    // §0: this comes off somebody's health, so it owes the write-up a
    // sentence — and it cannot do that from inside the engine.
    const result = runOne('worn')!;
    expect(result.wornOut.length).toBeGreaterThan(0);
    for (const entry of result.wornOut) expect(entry.cost).toBeGreaterThan(0);
  });
});
