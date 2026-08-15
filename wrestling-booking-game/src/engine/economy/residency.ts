// Taking a room for the season.
//
// Everything else in this game assumes a promotion tours: it rents a building,
// hauls a rig into it, runs, tears down, and does the whole thing again
// somewhere else next week. That is the expensive way to be in business, and
// until now it was the only way.
//
// A residency is the other pole, and it is not the touring venue list at a
// discount — it is a different kind of life, in its own set of rooms. See
// data/residencies.ts for the buildings. What signing buys:
//
//   - flat, cheap, weekly rent with no percentage and no load-in;
//   - no travel bill, because nobody is travelling;
//   - no haulage bill, because the rig lives in the building — which means a
//     resident promotion does not need a lorry at all, and can climb the
//     production ladder without the truck that normally gates it.
//
// And what it costs, which is most of this file:
//
//   - **You never sell out.** The house is capped by how many people in that
//     town will ever come, which is smaller than the room.
//   - **You cannot charge much.** The town has a ceiling and pricing over it
//     empties the place rather than raising the gate.
//   - **Merch barely moves.** The same people every week already own the shirt.
//   - **The town tires of you** on top of all that, week after week.
//   - **Nobody gets over.** A year in one room is a year in which the roster
//     is unknown everywhere else and the business never learns your name.
//     This is the real cost and it is not denominated in money at all.
//
// A residency is a place to survive, not a place to grow.

import { clamp } from '../rng';
import type { Id, Venue, WorldSettings } from '../types';
import { RESIDENCY_HOMES, residencyHomeById, type ResidencyHome } from '../../data/residencies';

export interface Residency {
  homeId: Id;
  /** Denormalised so a save can always say where it is without a lookup. */
  homeName: string;
  town: string;
  /** How long the deal runs, in weeks. */
  weeks: number;
  /** Counts down. At zero the run is over and the promotion is touring again. */
  weeksLeft: number;
  /** The rent agreed, held for the whole term. */
  rentPerWeek: number;
  /** Shows run under this deal so far — what wears the town out. */
  showsRun: number;
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

/** What a term costs a week in this room. */
export function residencyRent(home: ResidencyHome, term: ResidencyTerm): number {
  return Math.round(home.rentPerWeek * (1 - clamp(term.discount, 0, 0.9)));
}

/** Signed up front: the landlord wants the first month before the first bell. */
export function residencyDeposit(home: ResidencyHome, term: ResidencyTerm, settings: WorldSettings): number {
  return residencyRent(home, term) * settings.residencyDepositWeeks;
}

// ---------------------------------------------------------------- the town

/**
 * What a run of shows in one room does to the town's appetite for it.
 *
 * Grows with every show run under the deal and never quite reaches nothing —
 * a residency thins a crowd, it does not delete one.
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
 * The most people who will be in the building tonight.
 *
 * Not the capacity — the town. This is the single most important number in the
 * arrangement and the one a booker coming off the road will not expect: the
 * room seats five hundred and three hundred people live there who would ever
 * come, so the room is never full, the camera always sees empty chairs, and
 * putting on a better show does not fix it.
 */
export function localCeiling(residency: Residency | null, settings: WorldSettings): number {
  if (!residency) return Infinity;
  const home = residencyHomeById(residency.homeId);
  if (!home) return Infinity;
  return Math.floor(home.localCrowd * saturationDraw(residency, settings));
}

/**
 * What this town will pay for a ticket.
 *
 * Returned as a ceiling on the *fair* price rather than a hard cap on what the
 * booker may charge. He is free to ask thirty dollars in a mill town; the town
 * is free to stay home, and the existing overpricing penalty does the rest.
 * Nothing warns him first (§0).
 */
export function localTopTicket(residency: Residency | null): number | null {
  if (!residency) return null;
  return residencyHomeById(residency.homeId)?.topTicket ?? null;
}

/** The same faces every week already own the shirt. */
export function residencyMerchMultiplier(residency: Residency | null): number {
  if (!residency) return 1;
  return residencyHomeById(residency.homeId)?.merchMultiplier ?? 1;
}

/**
 * How much of a night's work counts towards getting anybody over.
 *
 * The real price of the arrangement. Working the same three hundred people
 * every week for a year does not make a star — those three hundred already
 * love him and nobody else has heard of him. Applied to popularity movement
 * and to the company's own standing, so a resident promotion comes out of its
 * term with the money it needed and none of the progress.
 */
export function residencyExposure(residency: Residency | null, settings: WorldSettings): number {
  return residency ? settings.residencyExposure : 1;
}

/**
 * The ringside multipliers, scaled by how much anybody is watching.
 *
 * Folded into the same per-wrestler record the manager system already uses so
 * the aftermath needs no new plumbing: a mouthpiece is worth what he is worth,
 * and then the whole thing is worth less because it happened in front of the
 * same three hundred people it happened in front of last week.
 */
export function scaleExposure(
  base: Record<string, number> | undefined,
  ids: readonly Id[],
  exposure: number,
): Record<string, number> {
  const out: Record<string, number> = { ...(base ?? {}) };
  for (const id of ids) out[id] = (out[id] ?? 1) * exposure;
  return out;
}

/** Said plainly, for the page. Not a warning; a description of the deal. */
export function exposureLine(residency: Residency | null): string | null {
  if (!residency) return null;
  return `Nobody outside ${residency.town} is watching. The roster gets over here and nowhere else.`;
}

// ---------------------------------------------------------------- the road, unused

/**
 * Whether the roster is on the road at all.
 *
 * A resident promotion does not pay to move anybody, which is a larger saving
 * than the rent for anybody carrying a real roster — and it is what makes a
 * residency survivable for a company that cannot afford a truck.
 */
export function residencyTravelCost(residency: Residency | null, touringCost: number): number {
  return residency ? 0 : touringCost;
}

/** Same for the lorry. The gear lives in the building; there is no lorry. */
export function residencyHaulageCost(residency: Residency | null, touringCost: number): number {
  return residency ? 0 : touringCost;
}

/**
 * The office, which is much smaller when there is only one building.
 *
 * A touring company runs a booking operation: routing, advances, permits,
 * somebody on the phone to nine towns. A resident one has a room and a
 * calendar. This is the third saving and — measured — the one that decides
 * whether the arrangement is survivable at all, because overhead scales with
 * what a company is worth rather than with what it draws.
 */
export function residencyOverhead(
  residency: Residency | null,
  touringOverhead: number,
  settings: WorldSettings,
): number {
  return residency ? touringOverhead * settings.residencyOverheadShare : touringOverhead;
}

// ---------------------------------------------------------------- the term

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
export function signResidency(home: ResidencyHome, term: ResidencyTerm, week: number): Residency {
  return {
    homeId: home.id,
    homeName: home.name,
    town: home.town,
    weeks: term.weeks,
    weeksLeft: term.weeks,
    rentPerWeek: residencyRent(home, term),
    showsRun: 0,
    signedWeek: week,
  };
}

/**
 * Which rooms a promotion may take.
 *
 * All of them, always. There is no rating gate on a residency and there should
 * not be: a legion hall in Brackett will take anybody's money, and a company
 * big enough that this is a bad idea is not stopped from making it. The gate
 * is that it is a bad idea, not that the door is locked.
 */
export function homesOnOffer(): ResidencyHome[] {
  return [...RESIDENCY_HOMES].sort((a, b) => a.rentPerWeek - b.rentPerWeek);
}

/** How the deal reads on the page while it is running. */
export function residencyStatus(residency: Residency, settings: WorldSettings): string {
  const weeks = residency.weeksLeft;
  const left =
    weeks <= 1 ? 'The last week of it.' : weeks <= 8 ? `${weeks} weeks left on the deal.` : `${weeks} weeks still to run.`;
  return `${left} ${saturationLine(residency, settings)}`;
}

/** The house a room can realistically expect, for the offer page. */
export function expectedHouseLine(home: ResidencyHome): string {
  return `Seats ${home.capacity.toLocaleString()}, and about ${home.localCrowd.toLocaleString()} people in ${home.town} will ever come.`;
}

/**
 * The home, dressed as a Venue so the show pipeline does not need to know.
 *
 * Everything downstream of the box office — the rig that fits, the crew bill,
 * the atmosphere, what the room does to a rating — is written against a Venue,
 * and a residency home is a room like any other from that side of the fence.
 * The parts that make it a residency (the crowd ceiling, the ticket ceiling,
 * the merch, the exposure) are applied around this, not inside it.
 *
 * Deliberately no house cut and no merch cut: these deals are a flat weekly
 * rent and nothing else, which is half of why a broke company signs one.
 */
export function venueForHome(home: ResidencyHome, settings: WorldSettings): Venue {
  return {
    id: home.id,
    name: `${home.name}, ${home.town}`,
    kind: 'hall',
    capacity: home.capacity,
    rentalCost: home.rentPerWeek,
    prestige: settings.residencyPrestige,
    minCompanyRating: 0,
    blurb: home.blurb,
    houseCut: 0,
    concessionsPerHead: settings.residencyConcessionsPerHead,
    merchCut: 0,
    productionCapacity: home.productionCapacity,
    atmosphere: home.atmosphere,
    loadIn: 0,
    outdoor: false,
  };
}

export { RESIDENCY_HOMES, residencyHomeById };
export type { ResidencyHome };
