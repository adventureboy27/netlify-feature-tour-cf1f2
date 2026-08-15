// Taking a room for the season.
//
// Everything else in this game assumes a promotion tours: it rents a building,
// hauls a rig into it, runs, tears down, and does the whole thing again
// somewhere else next week. That is the expensive way to be in business, and
// until now it was the only way.
//
// A residency is the other pole. You sign for one room for half a year or a
// whole one, and in exchange for never leaving it:
//
//   - the rent drops, because a landlord with fifty-two guaranteed dates is a
//     landlord who will negotiate;
//   - the travel bill goes to nothing, because nobody is travelling;
//   - the haulage bill goes to nothing too — the rig lives in the building,
//     which means a resident promotion does not need a truck at all, and can
//     climb the production ladder without the lorry that normally gates it.
//
// And the price, which is the interesting half: **you wear the town out.**
// The same room, the same night, every week, and the same people have already
// seen it. Saturation builds while you are resident and recovers only when the
// run ends. A residency is a very good year and a bad decade.
//
// The shape this is aiming at: it should be the obvious move for a company
// with no money, a real temptation for a company with some, and a mistake for
// a company that could be filling arenas.

import { clamp } from '../rng';
import type { Id, Venue, WorldSettings } from '../types';

export interface Residency {
  venueId: Id;
  venueName: string;
  /** How long the deal runs, in weeks. */
  weeks: number;
  /** Counts down. At zero the run is over and the promotion is touring again. */
  weeksLeft: number;
  /** The rent agreed, held for the whole term whatever the list price does. */
  rentPerWeek: number;
  /** Shows run under this deal so far — what wears the town out. */
  showsRun: number;
  /** The week it was signed, for the wire. */
  signedWeek: number;
}

export interface ResidencyTerm {
  weeks: number;
  label: string;
  /** Share off the list rent. Longer deals are cheaper per night. */
  discount: number;
}

/**
 * The two lengths on offer.
 *
 * Half a year is a season; a full year is a commitment. The longer deal is
 * cheaper per night and worse in every other way, which is the trade a real
 * booker makes.
 */
export function residencyTerms(settings: WorldSettings): ResidencyTerm[] {
  return [
    { weeks: settings.residencyShortWeeks, label: 'Half a year', discount: settings.residencyShortDiscount },
    { weeks: settings.residencyLongWeeks, label: 'A full year', discount: settings.residencyLongDiscount },
  ];
}

/** What a term costs a week in this building. */
export function residencyRent(venue: Venue, term: ResidencyTerm): number {
  return Math.round(venue.rentalCost * (1 - clamp(term.discount, 0, 0.9)));
}

/** Signed up front: the landlord wants the first month before the first bell. */
export function residencyDeposit(venue: Venue, term: ResidencyTerm, settings: WorldSettings): number {
  return residencyRent(venue, term) * settings.residencyDepositWeeks;
}

/**
 * What a run of shows in one room does to the town's appetite for it.
 *
 * Grows with every show run under the deal and never quite reaches nothing —
 * a residency thins a crowd, it does not delete one. This is the entire cost
 * of the arrangement and it is the thing a player will underestimate.
 */
export function saturationDraw(residency: Residency | null, settings: WorldSettings): number {
  if (!residency) return 1;
  const worn = residency.showsRun * settings.residencySaturationPerShow;
  return clamp(1 - worn, settings.residencyWorstDraw, 1);
}

/** The same thing in words, for a page that never prints a percentage. */
export function saturationLine(residency: Residency | null, settings: WorldSettings): string {
  const draw = saturationDraw(residency, settings);
  if (draw >= 0.97) return 'The town has not tired of you yet.';
  if (draw >= 0.85) return 'The regulars are still coming.';
  if (draw >= 0.7) return 'The same faces every week, and fewer of them.';
  if (draw >= 0.5) return 'This town has seen your show.';
  return 'You have worn this town out.';
}

/**
 * Whether the roster is on the road at all.
 *
 * A resident promotion does not pay to move anybody, which is a larger saving
 * than the rent discount for anybody carrying a real roster — and it is what
 * makes a residency survivable for a company that cannot afford a truck.
 */
export function residencyTravelCost(residency: Residency | null, touringCost: number): number {
  return residency ? 0 : touringCost;
}

/** Same for the lorry. The gear lives in the building; there is no lorry. */
export function residencyHaulageCost(residency: Residency | null, touringCost: number): number {
  return residency ? 0 : touringCost;
}

/** What walking away early costs — the rest of the term, at a discount. */
export function breakLeaseCost(residency: Residency, settings: WorldSettings): number {
  return Math.round(residency.rentPerWeek * residency.weeksLeft * settings.residencyBreakShare);
}

/** A week has passed under the deal. Returns null when the term has run out. */
export function tickResidency(residency: Residency, ranAShow: boolean): Residency | null {
  const next: Residency = {
    ...residency,
    weeksLeft: residency.weeksLeft - 1,
    showsRun: residency.showsRun + (ranAShow ? 1 : 0),
  };
  return next.weeksLeft <= 0 ? null : next;
}

/** Signing. The deposit is the caller's problem; this only builds the deal. */
export function signResidency(
  venue: Venue,
  term: ResidencyTerm,
  week: number,
): Residency {
  return {
    venueId: venue.id,
    venueName: venue.name,
    weeks: term.weeks,
    weeksLeft: term.weeks,
    rentPerWeek: residencyRent(venue, term),
    showsRun: 0,
    signedWeek: week,
  };
}

/**
 * Which rooms a promotion may take for a season.
 *
 * Deliberately not the big ones. An arena does not hand a wrestling company
 * fifty-two Saturdays — it has a hockey team, a concert calendar and a
 * basketball tenant, and the dates simply do not exist. Residencies are a
 * small-room arrangement, which is exactly what makes them a startup's move
 * and a mature company's mistake.
 */
export function residencyAvailable(venue: Venue, settings: WorldSettings): boolean {
  return venue.capacity <= settings.residencyMaxCapacity && !venue.outdoor;
}

/** Why a room will not take a residency, in words. */
export function residencyBlockedNote(venue: Venue, settings: WorldSettings): string | null {
  if (venue.outdoor) return 'Nobody signs a year of Saturdays in a field.';
  if (venue.capacity > settings.residencyMaxCapacity) {
    return 'A building this size has a calendar of its own.';
  }
  return null;
}

/** How the deal reads on the page while it is running. */
export function residencyStatus(residency: Residency, settings: WorldSettings): string {
  const weeks = residency.weeksLeft;
  const left =
    weeks <= 1 ? 'The last week of it.' : weeks <= 8 ? `${weeks} weeks left on the deal.` : `${weeks} weeks still to run.`;
  return `${left} ${saturationLine(residency, settings)}`;
}
