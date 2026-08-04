// Career status — where a wrestler stands in their career, as opposed to
// where they stand on this week's card (that's CardStatus, §3).
//
// Almost all of it is *derived*, not assigned. A wrestler is a journeyman
// because they have been around nine years and never got over, not because
// somebody set a flag. That means status changes on its own as a save runs
// for decades, which is the whole point: you watch someone come in as a
// prospect, stall out as a gatekeeper, and retire without ever main-eventing.
//
// Two are conferred rather than derived, because they are decisions someone
// made: `retired` and `hallOfFamer`.

import type { Wrestler, CareerStatus, WorldSettings } from '../types';

export interface CareerContext {
  currentYear: number;
  /** Highest popularity anyone on the roster currently has — "main eventer" is relative. */
  rosterPeakPopularity: number;
  settings: WorldSettings;
}

export function yearsPro(wrestler: Wrestler, currentYear: number): number {
  return Math.max(0, currentYear - wrestler.debutYear);
}

/** Total weeks a wrestler has held any championship. */
export function weeksAsChampion(wrestler: Wrestler, currentWeek: number): number {
  return wrestler.titleReigns.reduce((sum, reign) => sum + ((reign.endWeek ?? currentWeek) - reign.startWeek), 0);
}

function winRate(wrestler: Wrestler): number {
  const { wins, losses, draws } = wrestler.record;
  const total = wins + losses + draws;
  return total === 0 ? 0.5 : wins / total;
}

/**
 * Derive a wrestler's career standing.
 *
 * Order matters: the checks run from most specific to most general, so a
 * 42-year-old former world champion at 30 popularity reads as a fallen star
 * rather than as a plain veteran.
 */
export function deriveCareerStatus(wrestler: Wrestler, ctx: CareerContext): CareerStatus {
  const { settings } = ctx;

  // Conferred, not derived.
  if (wrestler.careerStatus === 'hallOfFamer') return 'hallOfFamer';
  if (wrestler.careerStatus === 'retired') return 'retired';
  if (wrestler.careerStatus === 'trainee') return 'trainee';

  const years = yearsPro(wrestler, ctx.currentYear);
  const pop = wrestler.popularity;
  const peak = Math.max(wrestler.careerHighPopularity, pop);
  const isVeteranAge = years >= settings.veteranYearsPro || wrestler.age >= settings.veteranAge;

  // A legend is a career achievement, and it does not go away when the
  // popularity does — it is why an ageing star still draws a curiosity house.
  const isLegend =
    peak >= settings.legendPeakPopularity &&
    years >= settings.legendYearsPro &&
    weeksAsChampion(wrestler, wrestler.careerHighWeek || 0) >= 0; // title history is a bonus, not a gate
  if (isLegend) return 'legend';

  // Someone who was genuinely up there and is not any more. The most
  // interesting person on a roster to book.
  if (peak >= settings.mainEventPopularity && pop <= peak - settings.fallenStarDrop) return 'fallenStar';

  // A draw is absolute *and* relative: they have to be genuinely over and be
  // the biggest thing you have. A territory promotion whose best act is a 60
  // does not have a draw, it has a main eventer.
  if (pop >= ctx.rosterPeakPopularity - 3 && pop >= settings.mainEventPopularity) return 'draw';

  // Main eventer is absolute *or* relative — main-event calibre anywhere, or
  // near the top of this particular roster. Either qualifies, so a stacked
  // promotion still has main eventers below its draw, and a thin one still
  // has a top of its own card. The floor stops a roster of jobbers from
  // producing a "main eventer" nobody has heard of.
  const relativeBar = Math.max(ctx.rosterPeakPopularity - 8, settings.gatekeeperPopularity);
  if (pop >= Math.min(settings.mainEventPopularity, relativeBar)) return 'mainEventer';

  if (years < settings.rookieYearsPro) {
    // A rookie the office thinks is going somewhere. Talent is hidden from
    // the player (§3.8), so this label is the tell.
    return wrestler.talent >= settings.prospectTalent ? 'prospect' : 'rookie';
  }

  if (pop <= settings.enhancementPopularity && winRate(wrestler) < 0.35) return 'enhancement';

  if (isVeteranAge) {
    // A veteran who still goes and gets used to test the young talent.
    if (pop >= settings.gatekeeperPopularity) return 'gatekeeper';
    return 'veteran';
  }

  if (pop >= settings.upperCardPopularity) return 'upperCard';

  // Been around long enough that this is who they are now.
  if (years >= settings.journeymanYearsPro) return 'journeyman';

  return 'midcarder';
}

/** Human label for the UI. */
export const CAREER_STATUS_LABELS: Record<CareerStatus, string> = {
  trainee: 'Trainee',
  rookie: 'Rookie',
  prospect: 'Prospect',
  midcarder: 'Midcarder',
  journeyman: 'Journeyman',
  enhancement: 'Enhancement talent',
  gatekeeper: 'Gatekeeper',
  upperCard: 'Upper card',
  mainEventer: 'Main eventer',
  draw: 'Draw',
  veteran: 'Veteran',
  fallenStar: 'Fallen star',
  legend: 'Legend',
  retired: 'Retired',
  hallOfFamer: 'Hall of Famer',
};

/** One line explaining what the status means, for a tooltip. */
export const CAREER_STATUS_BLURBS: Record<CareerStatus, string> = {
  trainee: 'In the school. Has not debuted.',
  rookie: 'Green, cheap, and unproven.',
  prospect: 'Green, but the office thinks there is something there.',
  midcarder: 'Reliable, useful, not going to sell out a building.',
  journeyman: 'Years in, never got over. Knows the business cold.',
  enhancement: 'Booked to lose and make other people.',
  gatekeeper: 'Veteran who still goes. Tests the young talent.',
  upperCard: 'One of the acts you build a show around.',
  mainEventer: 'Tops your cards.',
  draw: 'Sells the tickets. Losing them would hurt.',
  veteran: 'Past their peak physically. Still worth having in the room.',
  fallenStar: 'Was a much bigger deal than they are now.',
  legend: 'Career achievement. Draws on the name alone.',
  retired: 'Done wrestling.',
  hallOfFamer: 'Enshrined.',
};

/** Statuses that make someone a target worth poaching (§19). */
export function isPoachingTarget(status: CareerStatus): boolean {
  return status === 'draw' || status === 'mainEventer' || status === 'upperCard' || status === 'prospect';
}

/** Statuses that can still be built into something. */
export function hasUpside(status: CareerStatus): boolean {
  return status === 'prospect' || status === 'rookie' || status === 'midcarder' || status === 'upperCard';
}
