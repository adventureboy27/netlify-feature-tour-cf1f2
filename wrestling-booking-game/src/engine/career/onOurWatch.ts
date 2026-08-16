// On our watch — what it costs a company to kill somebody.
//
// The business already knew how to bury a man: the wall, the tribute, the
// memorial show, the friends who go quiet. All of that fires whether he died
// at home in his sleep or in your main event on a neck the doctor had already
// put a number on.
//
// Those are not the same thing and the game should not treat them as though
// they were. A death at home is grief. A death you booked is grief plus a
// question the whole business is asking about you, and it does not stop being
// asked when the funeral is over.
//
// Three things follow, and they are deliberately of different kinds:
//
//   - The room. Everybody, not only his friends. Somebody they all worked
//     with went out there hurt because the office cleared him, and the office
//     is going to feel that in every negotiation for a year.
//   - The market — both tables. Free agents price you, and so does the man
//     already on the roster whose paper has just run out; if a stranger who
//     only read about it will not come, somebody who was in the building that
//     night is not a softer negotiation. The ones who look after themselves
//     stop taking the call entirely while it is fresh, and the rest want
//     paying for the risk.
//   - The man who was in the ring with him. Four weeks off, on full pay,
//     not negotiable. He did nothing wrong and he is no use to anybody for a
//     month. See `Leave` — it is not an injury and must not read as one.
//
// AND THEN IT STOPS. Two years and the business has filed it as an unfortunate
// thing that happened, not as a fact about the company: `stillHeldAgainstUs`
// returns a clean zero, `riskPremium` is 1, and nobody refuses. Nothing about
// a contract signed after that date is different from one signed before any of
// it happened.
//
// Deals signed while it was hot keep the rate they were signed at, which is
// what gives the fade its teeth — a booker can pay the premium now or carry
// the hole in his roster until the business forgets. What does not fade is the
// wall: the memorial page says he went out there hurt for as long as the save
// runs. The money forgets. The record does not.

import { clamp } from '../rng';
import type { Id, Wrestler, WorldSettings } from '../types';

/** A death this company caused. Kept because the business keeps it. */
export interface DeathOnOurWatch {
  wrestlerId: Id;
  name: string;
  week: number;
}

/**
 * How heavily the business is still holding it against you, 0-1.
 *
 * Most recent death dominates and older ones add on top rather than
 * replacing: a company with three of these in five years is not judged by the
 * freshest one alone.
 */
export function stillHeldAgainstUs(
  deaths: readonly DeathOnOurWatch[],
  currentWeek: number,
  settings: WorldSettings,
): number {
  let weight = 0;
  for (const death of deaths) {
    const age = currentWeek - death.week;
    if (age >= settings.watchMemoryWeeks) continue;
    weight += 1 - age / settings.watchMemoryWeeks;
  }
  return clamp(weight, 0, 1);
}

/**
 * The blanket morale hit across the whole roster.
 *
 * Separate from `bereavements`, which is about who he was close to. This one
 * lands on people who barely knew him, because what they are reacting to is
 * not the man, it is the office.
 */
export function roomMoraleCost(settings: WorldSettings): number {
  return -settings.watchRoomMoraleCost;
}

export function roomLine(name: string, promotionName: string): string {
  return `Nobody in that locker room is talking to the office. ${name} went out there because ${promotionName} said he could.`;
}

/**
 * What a free agent adds to his price to come and work for you.
 *
 * A multiplier on the asking rate, applied to this promotion's offer only —
 * he is not more expensive everywhere, he is more expensive *here*.
 */
export function riskPremium(weight: number, settings: WorldSettings): number {
  return 1 + clamp(weight, 0, 1) * settings.watchAskingPremiumMax;
}

/**
 * What he actually wants from *you*, as opposed to what he is advertising.
 *
 * One function so the number on the button and the number the bank pays are
 * the same number. A signing screen that quotes a price the store then
 * charges differently is a lie in the interface.
 */
export function ourPrice(baseRate: number, weight: number, settings: WorldSettings): number {
  return Math.round(baseRate * riskPremium(weight, settings));
}

/** Whose death is being held against you, for the sentence that says so. */
export function mostRecentDeath(deaths: readonly DeathOnOurWatch[]): DeathOnOurWatch | null {
  return deaths.reduce<DeathOnOurWatch | null>((worst, d) => (!worst || d.week > worst.week ? d : worst), null);
}

/**
 * And the ones who will not come at all.
 *
 * Not a roll. A man who looks after himself looks at what happened to the
 * last one and does not need to think about it — so this is derived from the
 * trait that already governs exactly that judgement, and the same man gives
 * the same answer every time the player looks at the page.
 */
export function wontWorkForUs(wrestler: Wrestler, weight: number, settings: WorldSettings): boolean {
  if (weight <= 0) return false;
  const care = clamp(wrestler.selfPreservation ?? settings.selfPreservationDefault, 0, 100) / 100;
  // The bar comes down as the business gets angrier: at full weight only the
  // careful stay away, and by the time it has faded nobody does.
  return care >= 1 - weight * (1 - settings.watchRefusalCare);
}

/** Why he will not sign, in his words. Never a silent dead button. */
export function refusalLine(name: string, deadName: string): string {
  return `${name} will not take the call. He has read what happened to ${deadName}.`;
}

/**
 * And the man who already works here, whose paper has just run out.
 *
 * The same judgement as the free agent's, made by somebody who was in the
 * building that night — so if a stranger will not come, the man who watched
 * it happen certainly will not stay.
 */
export function wontRenewLine(name: string, deadName: string): string {
  return `${name}'s deal is up and he is not signing another one. He was there the night ${deadName} died.`;
}

// ------------------------------------------------------------ paid leave

/**
 * Time off that is not an injury.
 *
 * There was no way to say "this person cannot work and there is nothing wrong
 * with him", so the only lever was to write a fake injury onto his record —
 * which would have put a thing that never happened into his medical history
 * and read on his card as a torn something. `Leave` exists so the roster can
 * say the true thing.
 */
export interface Leave {
  /** The sentence. Nothing about a person is a bare status. */
  reason: string;
  weeksRemaining: number;
  /** Whether the wage keeps running. Today it always does; the field is the promise. */
  paid: boolean;
}

/**
 * The man who was in there with him goes home for a month, on full money.
 *
 * Applied to everybody who was in that match, not only the winner. This is
 * the company's own rule rather than something the booker decides — the
 * player finds it on the results page as a thing that has happened, which is
 * the same way he finds out about the death.
 */
export function compassionateLeave(deadName: string, settings: WorldSettings): Leave {
  return {
    reason: `Sent home after ${deadName} died in the ring with him. Back in ${settings.watchLeaveWeeks} weeks, on full pay.`,
    weeksRemaining: settings.watchLeaveWeeks,
    paid: true,
  };
}

export function leaveLine(names: readonly string[], deadName: string, settings: WorldSettings): string {
  const who = names.length === 1 ? names[0]! : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]!}`;
  const they = names.length === 1 ? 'is' : 'are';
  return `${who} ${they} off for ${settings.watchLeaveWeeks} weeks on full pay. Nobody who was in the ring with ${deadName} is being asked to work.`;
}

/** Count a week off somebody's leave. Returns null when it is over. */
export function tickLeave(leave: Leave): Leave | null {
  const weeksRemaining = leave.weeksRemaining - 1;
  return weeksRemaining <= 0 ? null : { ...leave, weeksRemaining };
}

/** What the roster card says. */
export function leaveStatusLine(leave: Leave): string {
  const weeks = leave.weeksRemaining;
  return `Away — back in ${weeks} ${weeks === 1 ? 'week' : 'weeks'}.`;
}
