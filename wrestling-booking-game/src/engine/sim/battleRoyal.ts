// Battle royal elimination order — ordering dressing on a decision already
// made. simulateMatch.ts picks winnerSide off the real win-probability math
// exactly like it does for any other multi-man match; this module never
// touches that. All it does is decide, after the fact, what order everybody
// ELSE went out in, so the highlight reel can read like a battle royal
// instead of an instant fatal-4-way roll with extra bodies in it.
//
// Weaker sides tend to go over the top earlier — exactly how a real battle
// royal reads — because each elimination is drawn weighted by the inverse
// of that side's own win probability. The side already decided to win is
// never eliminated: it is excluded from the draw and appended last.

import type { Rng } from '../rng';
import { weightedPick, rngFromSeed, pick } from '../rng';
import type { Id, Wrestler } from '../types';

/**
 * Returns every side in the match, ordered first-eliminated to last (the
 * winner, always the final entry). `winnerSide` must be one of `sides` and
 * `winProbabilitiesBySide` must have an entry for every side in `sides`.
 */
export function orderEliminations(
  rng: Rng,
  sides: readonly number[],
  winnerSide: number,
  winProbabilitiesBySide: Readonly<Record<number, number>>,
): number[] {
  const remaining = sides.filter((s) => s !== winnerSide);
  const order: number[] = [];

  while (remaining.length > 0) {
    const entries = remaining.map((s) => [s, 1 / Math.max(winProbabilitiesBySide[s] ?? 0.03, 0.01)] as const);
    const eliminated = weightedPick(rng, entries);
    order.push(eliminated);
    remaining.splice(remaining.indexOf(eliminated), 1);
  }

  order.push(winnerSide);
  return order;
}

/**
 * Who put each eliminated side over the top. Reads `order` (`orderEliminations`'s
 * own output) without touching it — this is a separate decision, not a second
 * opinion on the first one.
 *
 * Each pick is drawn from its own entity-seeded stream
 * (`rngFromSeed(\`eliminator:${...}:${week}\`)`), never from the shared `rng`
 * `simulateMatch.ts` threads through the winner/finish/rating rolls — adding
 * a decision here must never shift anything that already exists downstream of
 * it. See the root CLAUDE.md's "adding an RNG draw shifts every seeded roll
 * after it" trap.
 */
export function pickEliminators(
  order: readonly number[],
  sideMembers: ReadonlyMap<number, readonly Wrestler[]>,
  week: number,
): Map<number, Id> {
  const eliminators = new Map<number, Id>();

  // Every entry but the last (the winner, who is never eliminated).
  for (let i = 0; i < order.length - 1; i++) {
    const eliminatedSide = order[i]!;
    const eliminatedRep = sideMembers.get(eliminatedSide)?.[0];
    if (!eliminatedRep) continue;

    // Whoever is still in the ring at this point — every side that goes out
    // later, plus the eventual winner. Never the side being eliminated.
    const stillActive = order.slice(i + 1).flatMap((s) => sideMembers.get(s) ?? []);
    if (stillActive.length === 0) continue;

    const rng = rngFromSeed(`eliminator:${eliminatedRep.id}:${week}`);
    eliminators.set(eliminatedSide, pick(rng, stillActive).id);
  }

  return eliminators;
}
