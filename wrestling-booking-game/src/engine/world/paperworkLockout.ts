// A hostile politician gets a licensing bill through, and roughly two-thirds
// of every promotion's roster — player and every rival alike — has its
// in-ring paperwork stuck in review. Working without it carries severe
// consequences, so in practice it is a ban. There is no rhyme or reason to
// who gets caught: a flat coin flip per wrestler, industry-wide, the same
// week for everyone, because a genuinely arbitrary bureaucracy reads truer
// than a regulator with a coherent theory of who to target.
//
// Unlike a vignette campaign (career/vignette.ts), which is staggered per
// wrestler, this freeze shares one clock for the whole business — everyone
// caught in it starts and ends on the same week, tracked once on
// World.paperworkLockout. A wrestler's own paperworkFrozen is a plain
// boolean rather than its own countdown.
//
// Pure: decides whether it fires and who it catches. The store applies it —
// setting the flag, pausing pay and contract clocks, and gating booking via
// engine/world/rivalBooking.ts's canWork, which every card (player and
// rival) already goes through.

import type { Rng } from '../rng';
import { chance } from '../rng';
import type { Id, Wrestler, WorldSettings } from '../types';

export function eligibleForPaperworkLockout(
  week: number,
  alreadyActive: boolean,
  settings: WorldSettings,
): boolean {
  if (alreadyActive) return false;
  return week >= settings.paperworkLockoutEarliestWeek;
}

/** One independent coin flip per candidate. No targeting — that's the point. */
export function rollPaperworkFreezes(
  rng: Rng,
  candidates: readonly Wrestler[],
  settings: WorldSettings,
): Id[] {
  const frozen: Id[] = [];
  for (const w of candidates) {
    if (chance(rng, settings.paperworkLockoutFreezeShare)) frozen.push(w.id);
  }
  return frozen;
}

export function paperworkLockoutStartLine(frozenCount: number, totalCount: number, weeks: number): string {
  return (
    `A politician who has never hidden the contempt for this business finally got a licensing bill through, ` +
    `and the commission is sitting on renewals across the board — ${frozenCount} of ${totalCount} licensed ` +
    `wrestlers in the entire business, this company and every rival alike, have their paperwork stuck in ` +
    `review with real consequences for working without it. Nobody can point to a pattern in who got caught. ` +
    `The commission says ${weeks} weeks. Nobody believes them, but that is the number on the letter.`
  );
}

export function paperworkLockoutEndLine(): string {
  return (
    `The paperwork cleared. Every wrestler whose license was stuck in review is free to work again, industry-wide — ` +
    `whatever this cost the business those weeks, it stops costing it starting tonight.`
  );
}
