// A manager takes a piece.
//
// Managers became signable people two changes ago, and a manager who is at
// ringside because you booked him for the night is a hired hand, not somebody
// who *represents* anybody. This is the relationship: a signed deal between a
// manager and a wrestler, with a number on it.
//
// ---------------------------------------------------------------------------
// Whose pocket
//
// The cut comes out of the **client's** purse, not out of an extra line on the
// promotion's bill. That one decision is what makes the whole thing a triangle
// instead of a straight cost:
//
//   - the manager takes his percentage of what the wrestler earns
//   - the wrestler's take-home drops, so he wants more at renewal
//   - the manager's `negotiation` is what gets it for him
//
// Net: the promotion pays more, the wrestler nets roughly what he did before,
// and the manager eats the difference. Which is how it actually works, and it
// means a manager costs you money without ever appearing as a charge — you are
// not billed for the manager, you are billed for the manager being good.
//
// The base wage is deliberately low (`managerTalentFeeToWage` prices them off
// what they used to charge a night, and a night is not a lot). The percentage
// is the earner. So a manager wants more clients, exactly like a salesman.
//
// ---------------------------------------------------------------------------
// ...and why he cannot just sign everybody
//
// Without a brake, "collect every client" is strictly correct and the decision
// evaporates. The brake is attention: a man in ten corners is not really in
// any of them. Every ringside effect he has — covering for a bad talker,
// distracting the opponent, cheating — scales down as his book grows.
//
// So there is a real sweet spot, a greedy manager is measurably worse at the
// job than a focused one, and the player can see it happening without being
// told a number.

import { clamp } from '../rng';
import type { Id, Wrestler, WorldSettings } from '../types';
import type { Manager } from '../sim/ringside';

export interface Representation {
  managerId: Id;
  clientId: Id;
  /** Share of the client's weekly rate, 0-1. */
  cut: number;
  signedWeek: number;
}

// ---------------------------------------------------------------------------
// The deal

/**
 * What a manager asks for.
 *
 * Driven by negotiation, because asking for more *is* the skill. A shark takes
 * a third of a nobody and a pushover takes a tenth of a main eventer.
 */
export function askingCut(manager: Manager, settings: WorldSettings): number {
  const s = settings;
  const nerve = (manager.negotiation ?? 50) / 100;
  return clamp(s.repCutMin + nerve * (s.repCutMax - s.repCutMin), 0, 0.9);
}

/**
 * What the client's weekly rate becomes when somebody argues it for them.
 *
 * The upside of negotiation, and the half the promotion actually pays. A
 * wrestler with a good agent is more expensive than the same wrestler without
 * one — not because he got better, but because somebody asked.
 */
export function negotiatedRate(
  baseRate: number,
  manager: Manager | null,
  settings: WorldSettings,
): number {
  if (!manager) return baseRate;
  const nerve = (manager.negotiation ?? 50) / 100;
  return Math.round(baseRate * (1 + nerve * settings.repRateLiftMax));
}

/** What the manager takes home from one client, weekly. */
export function cutOf(rate: number, rep: Representation): number {
  return Math.round(rate * rep.cut);
}

/** What the wrestler is left with after his man is paid. */
export function clientNets(rate: number, rep: Representation | null): number {
  if (!rep) return rate;
  return Math.max(0, rate - cutOf(rate, rep));
}

// ---------------------------------------------------------------------------
// The book

/** Everybody a manager represents. */
export function bookOf(reps: readonly Representation[], managerId: Id): Representation[] {
  return reps.filter((r) => r.managerId === managerId);
}

/** Who represents this wrestler, if anybody. */
export function representativeOf(
  reps: readonly Representation[],
  clientId: Id,
): Representation | null {
  return reps.find((r) => r.clientId === clientId) ?? null;
}

/**
 * How much of himself a manager brings to any one corner.
 *
 * 1 for a man with a single client, falling as the book grows and never
 * reaching zero — a distracted manager is still a manager. This is the entire
 * counterweight to the percentage: without it, signing everybody is free.
 */
export function attention(clientCount: number, settings: WorldSettings): number {
  const s = settings;
  if (clientCount <= 1) return 1;
  return clamp(1 / (1 + (clientCount - 1) * s.repAttentionFalloff), s.repAttentionFloor, 1);
}

/** The same, for a manager in a world. */
export function attentionOf(
  reps: readonly Representation[],
  managerId: Id,
  settings: WorldSettings,
): number {
  return attention(bookOf(reps, managerId).length, settings);
}

/** Everything a manager earns in a week, across his whole book. */
export function weeklyTake(
  reps: readonly Representation[],
  managerId: Id,
  rateOf: (clientId: Id) => number,
): number {
  return bookOf(reps, managerId).reduce((sum, rep) => sum + cutOf(rateOf(rep.clientId), rep), 0);
}

/**
 * Is taking one more worth it?
 *
 * The question the player is really being asked, and the reason the answer is
 * not obviously yes: another client is another income stream *and* a cut to
 * everything he does for the ones he already has.
 */
export function wouldStretchTooThin(
  reps: readonly Representation[],
  managerId: Id,
  settings: WorldSettings,
): boolean {
  const now = bookOf(reps, managerId).length;
  return attention(now + 1, settings) < settings.repStretchedAt;
}

// ---------------------------------------------------------------------------
// Saying it

/** What the wrestler's profile shows: the money going out of his purse. */
export function clientCutLine(rep: Representation | null, managerName: string | undefined): string | null {
  if (!rep || !managerName) return null;
  return `${Math.round(rep.cut * 100)}% of his purse goes to ${managerName}`;
}

/** What the manager's profile shows: the book, which is why he is worth having. */
export function bookLine(
  reps: readonly Representation[],
  managerId: Id,
  rateOf: (clientId: Id) => number,
  settings: WorldSettings,
): string {
  const book = bookOf(reps, managerId);
  if (book.length === 0) return 'Represents nobody.';
  const take = weeklyTake(reps, managerId, rateOf);
  const spread = attention(book.length, settings);
  const focus =
    spread >= 0.9
      ? 'Gives them his full attention.'
      : spread >= settings.repStretchedAt
        ? 'Has enough on to be somewhere else half the time.'
        : 'Is spread far too thin to do any of them much good.';
  return `${book.length} ${book.length === 1 ? 'client' : 'clients'}, $${take.toLocaleString()} a week. ${focus}`;
}

/**
 * A manager on the make.
 *
 * A percentage man wants more names, and the ones with the nerve to ask are
 * the ones who go looking. Used by the world to have managers court
 * unrepresented wrestlers rather than waiting to be booked.
 */
export function wouldCourt(
  manager: Manager,
  client: Wrestler,
  reps: readonly Representation[],
  settings: WorldSettings,
): boolean {
  const s = settings;
  if (representativeOf(reps, client.id)) return false;
  if (client.role !== 'wrestler' || client.deceased) return false;
  if (wouldStretchTooThin(reps, manager.id, s)) return false;
  // Worth his time. A percentage of nothing is nothing, so a manager chases
  // people who are already earning or plainly about to.
  return client.popularity >= s.repWorthCourting;
}
