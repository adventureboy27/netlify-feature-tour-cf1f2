// The "everybody in at once" elimination match for the Faction Destroyer
// stipulation — see engine/world/factionDestroyer.ts for when this story
// triggers, and docs/BACKLOG.md for the full picture. Unlike an ordinary
// battle royal (engine/sim/battleRoyal.ts), elimination here happens per
// MEMBER, not per SIDE — a side can lose members and keep fighting, exactly
// like a traditional Survivor Series elimination match. simulateMatch.ts
// already decides which side wins via the real win-probability math
// (multiManWinProbabilities) before this module ever runs; all this module
// does is decide who goes out, in what order, and who put them there.

import type { Rng } from '../rng';
import { weightedPick, rngFromSeed, pick } from '../rng';
import type { Id, Wrestler } from '../types';

export interface FactionEliminationOrder {
  /** Eliminated wrestler ids, first out to last. Never includes a survivor. */
  order: Id[];
  /** Whoever's left once the losing side hits zero — always ⊆ winnerMembers, never empty. */
  survivorIds: Id[];
}

/**
 * One random `winnerMembers` entry is reserved before the draw even starts
 * and never enters the pool — so there is always at least one survivor no
 * matter how the rest of the draw lands. Everyone else (all of
 * `loserMembers`, plus every other `winnerMembers` entry) is drawn weighted
 * by the inverse of their own side's win probability — same weighting
 * `orderEliminations` already uses, just applied per member instead of per
 * side — until the loser's full membership has been drawn. That's
 * guaranteed to happen: the loser's members are a strict subset of a finite
 * pool drawn without replacement, so the draw can end no later than the
 * pool itself running out, worst case leaving only the one reserved
 * survivor.
 */
export function orderFactionEliminations(
  rng: Rng,
  loserMembers: readonly Wrestler[],
  winnerMembers: readonly Wrestler[],
  loserWinProb: number,
  winnerWinProb: number,
): FactionEliminationOrder {
  const survivor = pick(rng, winnerMembers);
  interface PoolEntry {
    id: Id;
    fromLoser: boolean;
    weight: number;
  }
  const pool: PoolEntry[] = [
    ...loserMembers.map((w): PoolEntry => ({ id: w.id, fromLoser: true, weight: 1 / Math.max(loserWinProb, 0.01) })),
    ...winnerMembers
      .filter((w) => w.id !== survivor.id)
      .map((w): PoolEntry => ({ id: w.id, fromLoser: false, weight: 1 / Math.max(winnerWinProb, 0.01) })),
  ];

  const order: Id[] = [];
  let loserRemaining = loserMembers.length;
  while (loserRemaining > 0 && pool.length > 0) {
    const entries = pool.map((entry) => [entry, entry.weight] as const);
    const picked = weightedPick(rng, entries);
    order.push(picked.id);
    pool.splice(pool.indexOf(picked), 1);
    if (picked.fromLoser) loserRemaining -= 1;
  }

  const eliminated = new Set(order);
  const survivorIds = [...loserMembers, ...winnerMembers].map((w) => w.id).filter((id) => !eliminated.has(id));
  return { order, survivorIds };
}

/**
 * Who put each eliminated wrestler over the top — one per entry in `order`,
 * drawn from whoever's still active at that point (everyone eliminated
 * later, plus every eventual survivor). Each pick is its own entity-seeded
 * stream, never the shared `rng` `orderFactionEliminations` used — adding a
 * decision here must never shift anything already decided upstream of it.
 * See the root CLAUDE.md's "adding an RNG draw shifts every seeded roll
 * after it" trap, and battleRoyal.ts's `pickEliminators`, whose shape this
 * mirrors (not reuses — the per-side signature doesn't compose here, since
 * every entry here is already a real wrestler id, not a side to resolve).
 */
export function pickFactionEliminators(order: readonly Id[], survivorIds: readonly Id[], week: number): Map<Id, Id> {
  const eliminators = new Map<Id, Id>();
  for (let i = 0; i < order.length; i++) {
    const eliminatedId = order[i]!;
    const stillActiveIds = [...order.slice(i + 1), ...survivorIds];
    if (stillActiveIds.length === 0) continue;
    const rng = rngFromSeed(`factionEliminator:${eliminatedId}:${week}`);
    eliminators.set(eliminatedId, pick(rng, stillActiveIds));
  }
  return eliminators;
}
