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

/**
 * What a book costs the man carrying it, in fatigue, every week.
 *
 * `attention` is the instantaneous half — a man in six corners is not really
 * in any of them. This is the half that accumulates: he is on the road for all
 * six of them, every week, and nobody does that indefinitely.
 *
 * The two compound in a way neither does alone. A manager with a fat book is
 * immediately worse at each job *and* getting worse at all of them over
 * months, until either he is rested or somebody is let go. Which is the honest
 * shape of the thing: a percentage man's problem is not that he cannot count,
 * it is that there are seven nights in a week.
 *
 * Super-linear, because the travel is what kills — two clients in two towns is
 * not twice one client, it is two towns and the driving between them.
 */
export function roadCost(clientCount: number, settings: WorldSettings): number {
  if (clientCount <= 0) return 0;
  return settings.repRoadCostPerClient * clientCount ** settings.repRoadCostCurve;
}

/**
 * How much of himself a worn-out manager has left, 0-1.
 *
 * Reads the same fatigue every wrestler carries — managers are people now, so
 * there is one exhaustion model in the game rather than a second one for men
 * in suits.
 */
export function condition(
  manager: Pick<Wrestler, 'fatigueDebt' | 'energy'>,
  settings: WorldSettings,
): number {
  const worn = clamp(manager.fatigueDebt / 100, 0, 1);
  const spent = clamp(1 - manager.energy / 100, 0, 1);
  return clamp(1 - (worn * 0.6 + spent * 0.4) * settings.repWearPenalty, settings.repWearFloor, 1);
}

/**
 * Everything the man actually brings to a corner tonight: how thin he is
 * spread, times how much of him is left.
 *
 * The one number the sim should ask for. Asking for attention alone was the
 * version where a manager could carry six clients forever as long as he
 * accepted being 36% of himself in each — and never got tired doing it.
 */
export function presenceAt(
  reps: readonly Representation[],
  managerId: Id,
  manager: Pick<Wrestler, 'fatigueDebt' | 'energy'> | null,
  settings: WorldSettings,
): number {
  const spread = attentionOf(reps, managerId, settings);
  return manager ? spread * condition(manager, settings) : spread;
}

/** How the sheet says he is holding up, in words rather than a number (§0). */
export function wearLabel(
  manager: Pick<Wrestler, 'fatigueDebt' | 'energy'>,
  settings: WorldSettings,
): string | null {
  const left = condition(manager, settings);
  if (left >= 0.85) return null;
  if (left >= 0.6) return 'Looking tired';
  return 'Running on fumes';
}

// ---------------------------------------------------------------------------
// Getting there
//
// Travel was a cost the *promotion* paid — per head, per show — and there was
// a `travelCovered` clause that charged the company extra for it. Which meant
// the clause bought a wrestler nothing: he was never paying for petrol in the
// first place, so having somebody else not pay it either was worth precisely
// zero to him.
//
// This is the other side of that. Everybody working pays their own way unless
// their deal says otherwise, out of the purse they just earned. It makes the
// clause a real perk with a real price, it makes a heavy schedule cost the
// *talent* money rather than only fatigue, and for a manager it scales with
// his book — the same reason a fat book tires him out is the reason it costs
// him.

/**
 * What getting to work cost somebody this week.
 *
 * `nights` is how many times they had to be somewhere: a card for a wrestler,
 * a client's corner for a manager. Nobody who sat at home pays anything.
 */
export function travelBill(nights: number, covered: boolean, settings: WorldSettings): number {
  if (covered || nights <= 0) return 0;
  return Math.round(settings.travelOwnCostPerNight * nights);
}

/**
 * What a night on the road is worth avoiding, for pricing the clause.
 *
 * A wrestler with a full schedule and no travel clause is giving back a real
 * slice of his purse, which is what makes "the company pays my travel" worth
 * arguing for — and worth an agent.
 */
export function travelBurden(
  weeklyRate: number,
  nights: number,
  settings: WorldSettings,
): number {
  if (weeklyRate <= 0) return 0;
  return travelBill(nights, false, settings) / weeklyRate;
}

// ---------------------------------------------------------------------------
// Ending it
//
// A deal nobody can get out of is not a deal, it is a trap. Both sides can
// walk, for opposite reasons, and neither goes through the promotion — this
// is between the wrestler and his man. The booker does not get a vote, which
// is right: you did not sign it.

export type SplitReason =
  /** The client is paying for a man who is never really there. */
  | 'notWorthTheCut'
  /** ...or has simply stopped needing one. */
  | 'outgrewHim'
  /** The manager is carrying more than he can, and this one earns least. */
  | 'droppedForTheBook'
  /** ...or the client stopped being worth a percentage of. */
  | 'notEarningEnough';

export interface Split {
  rep: Representation;
  by: 'client' | 'manager';
  reason: SplitReason;
  note: string;
}

/**
 * Would the wrestler sack him?
 *
 * The client is the one who can see the bill. He walks when he is paying a
 * real percentage for somebody who is barely present — which is exactly what
 * an over-committed manager looks like from underneath — or when he has got
 * over enough that he no longer needs anybody talking for him.
 */
export function clientWouldWalk(
  rep: Representation,
  client: Pick<Wrestler, 'charisma' | 'popularity'>,
  presence: number,
  settings: WorldSettings,
): SplitReason | null {
  const s = settings;
  // Paying well over the odds for a man who is never there.
  if (presence < s.repClientPatience && rep.cut >= s.repCutMin) return 'notWorthTheCut';
  // He can do it himself now. A mouthpiece is for somebody who needs one.
  if (client.charisma >= s.repOutgrowsAt) return 'outgrewHim';
  return null;
}

/**
 * ...and would the manager drop him?
 *
 * The manager can see his own diary. He lets somebody go when he is carrying
 * more than he can — and it is the client earning him least who goes, not the
 * newest, because this is a business.
 */
export function managerWouldDrop(
  reps: readonly Representation[],
  managerId: Id,
  self: Pick<Wrestler, 'fatigueDebt' | 'energy'> | null,
  rateOf: (clientId: Id) => number,
  settings: WorldSettings,
): { rep: Representation; reason: SplitReason } | null {
  const s = settings;
  const book = bookOf(reps, managerId);
  if (book.length === 0) return null;

  const worst = book.reduce((least, r) =>
    cutOf(rateOf(r.clientId), r) < cutOf(rateOf(least.clientId), least) ? r : least,
  );

  // Worn past the point of doing any of them good. Something has to give, and
  // it is whoever pays him least.
  if (self && condition(self, s) < s.repDropsWhenWornTo && book.length > 1) {
    return { rep: worst, reason: 'droppedForTheBook' };
  }
  // A percentage of nothing is nothing.
  if (cutOf(rateOf(worst.clientId), worst) < s.repMinWorthKeeping) {
    return { rep: worst, reason: 'notEarningEnough' };
  }
  return null;
}

export function splitNote(
  reason: SplitReason,
  clientName: string,
  managerName: string,
): string {
  switch (reason) {
    case 'notWorthTheCut':
      return `${clientName} has stopped paying ${managerName} to be somewhere else. That is over.`;
    case 'outgrewHim':
      return `${clientName} does his own talking now. ${managerName} is out of a client.`;
    case 'droppedForTheBook':
      return `${managerName} has let ${clientName} go. He has too many names and not enough nights.`;
    case 'notEarningEnough':
      return `${managerName} has stopped representing ${clientName}. A percentage of nothing is nothing.`;
  }
}

/** Remove a deal. Returns the list without it. */
export function endRepresentation(
  reps: readonly Representation[],
  clientId: Id,
): Representation[] {
  return reps.filter((r) => r.clientId !== clientId);
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
  /**
   * The man himself, when there is one to read. A manager already worn down
   * by the book he has does not go looking for more of it — without this the
   * courting loop walked every manager to a book he could not carry, which is
   * a self-regulating system regulating itself into the ground.
   */
  self?: Pick<Wrestler, 'fatigueDebt' | 'energy'> | null,
): boolean {
  const s = settings;
  if (representativeOf(reps, client.id)) return false;
  if (client.role !== 'wrestler' || client.deceased) return false;
  if (wouldStretchTooThin(reps, manager.id, s)) return false;
  if (self && condition(self, s) < s.repTooTiredToCourt) return false;
  // Worth his time. A percentage of nothing is nothing, so a manager chases
  // people who are already earning or plainly about to.
  return client.popularity >= s.repWorthCourting;
}
