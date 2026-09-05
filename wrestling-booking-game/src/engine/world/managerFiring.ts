// A client firing his manager, sometimes for real.
//
// clientWouldWalk (career/representation.ts) already ends the deal quietly —
// one wire line, the money stops, done. Most of the time that is the whole
// story. This is the second, independently-seeded roll (same shape as the
// weekly implosion escalation in store.ts) that decides whether this
// particular walkout turns into something the two of them carry with them:
// a real rivalry.
//
// Only a client walking out on his own man reads as personal — 'notWorthTheCut'
// and 'outgrewHim' are the client's call. A manager cutting a client loose
// for the book, or because the money's thin ('droppedForTheBook',
// 'notEarningEnough'), is business, not betrayal, so it never escalates.
//
// Seeded 'shoot', not 'worked': nobody booked this. Unlike a group turn —
// which plays out as a staged angle the promotion airs — this is two people
// who used to work together deciding they are through, off camera. See
// state/slices/groupTurns.ts for the worked+shoot double-seed this
// deliberately does not copy.

import type { Rng } from '../rng';
import { chance } from '../rng';
import type { WorldSettings } from '../types';
import type { SplitReason } from '../career/representation';

export function isClientInitiated(reason: SplitReason): boolean {
  return reason === 'notWorthTheCut' || reason === 'outgrewHim';
}

/** Whether this particular walkout turns into a real rivalry. */
export function wouldEscalate(rng: Rng, reason: SplitReason, settings: WorldSettings): boolean {
  if (!isClientInitiated(reason)) return false;
  return chance(rng, settings.managerFiringRivalryChance);
}

/** The sharper wire line for an escalated split, in place of splitNote. */
export function firingRivalryLine(reason: SplitReason, clientName: string, managerName: string): string {
  switch (reason) {
    case 'notWorthTheCut':
      return `${clientName} didn't just stop paying ${managerName} — ${clientName} said why, loudly, and ${managerName} isn't letting it go.`;
    case 'outgrewHim':
      return `${clientName} walked away from ${managerName} like the years spent building that name together never happened. ${managerName} remembers every one of them.`;
    default:
      return `${clientName} and ${managerName} are done, and it isn't quiet.`;
  }
}
