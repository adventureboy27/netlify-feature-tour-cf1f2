// The Crucible — the annual interpromotional tournament, and the Iron Crown
// that goes with it.
//
// The third of the year's three cross-promotional nights, and the odd one out.
// The joint shows in May and November are a deal between two companies: you
// negotiate, you split a gate, both rosters work a normal card. This is not
// that. This is an open tournament with a steep entry fee, every company that
// fancies its chances buys in, and the whole card is one bracket.
//
// Three things make it its own event rather than a third supershow:
//
//   1. **You pay to be there.** The fee is deliberately punishing — a bad year
//      and you cannot afford the ticket, which means the field is a statement
//      about who is doing well.
//   2. **The field decides the format.** Every entrant's fee goes in the pot
//      and the bracket is a fixed size, so the more companies buy in, the fewer
//      wrestlers each of them gets to bring. Two companies bring eight apiece;
//      eight companies bring two apiece and it is a war of attrition.
//   3. **One person wins it.** Not a company on aggregate — a wrestler, who
//      takes half the pot personally and carries the Iron Crown for a year.
//      Their company takes the other half.
//
// Titles do not travel here either, for the same §16 reason as the joint
// shows, and it is enforced the same way: the bracket is handed no belts.

import { clamp } from '../rng';
import type { Id, Promotion, Wrestler, WorldSettings } from '../types';
import type { Month } from './calendar';
import { bracketSize } from '../tournament/bracket';

/** August: far enough from May and November that the year has three peaks. */
export const CUP_MONTH: Month = 'August';

export const CUP_NAME = 'The Crucible';
export const CUP_TROPHY = 'the Iron Crown';

// ---------------------------------------------------------------- the field

/**
 * How many wrestlers each company may bring.
 *
 * The bracket is a fixed size, so this is division: the more companies buy in,
 * the fewer names each of them gets. That is the interesting part of the rule
 * — a two-company Crucible is two rosters going to war, an eight-company one
 * is everybody sending their very best and hoping.
 */
export function slotsPerPromotion(entrantCount: number, settings: WorldSettings): number {
  if (entrantCount <= 0) return 0;
  return Math.max(1, Math.floor(settings.cupBracketTarget / entrantCount));
}

/** The bracket the field actually produces, byes included. */
export function cupBracketSize(entrantCount: number, settings: WorldSettings): number {
  return bracketSize(entrantCount * slotsPerPromotion(entrantCount, settings));
}

/**
 * Would this company buy in?
 *
 * Money first and hard: the fee is steep and a company that cannot cover it
 * plus a cushion does not gamble the payroll on a tournament. After that it is
 * ambition — a company on the way up wants the shop window, one already on top
 * has less to gain and enters less often.
 */
export function willEnter(promotion: Promotion, settings: WorldSettings): boolean {
  const fee = settings.cupEntryFee;
  if (promotion.bankBalance < fee * settings.cupAffordabilityCushion) return false;
  return promotion.rating >= settings.cupMinimumStanding;
}

// ---------------------------------------------------------------- the money

export interface CupPurse {
  /** Every entry fee, plus what the night takes at the door. */
  pot: number;
  entryFees: number;
  gate: number;
  /** Half the pot, to the winner's company. */
  companyShare: number;
  /** The other half, to the wrestler who won it. */
  wrestlerShare: number;
}

/**
 * What the night is worth, and how it splits.
 *
 * Half and half, exactly as asked: the company that owns the winner takes one
 * half, the winner takes the other personally. It is the biggest single payday
 * any individual wrestler can have, which is the whole reason a main eventer
 * wants to be entered rather than rested.
 */
export function cupPurse(
  entrants: readonly Promotion[],
  settings: WorldSettings,
): CupPurse {
  const entryFees = entrants.length * settings.cupEntryFee;
  const draw = entrants.reduce((sum, p) => sum + p.rating, 0) * settings.cupGatePerRatingPoint;
  const gate = Math.round(draw);
  const pot = entryFees + gate;

  // Split down the middle. The odd pound goes to the company, which is the
  // less romantic half and therefore the right place for a rounding artefact.
  const wrestlerShare = Math.floor(pot / 2);
  return {
    pot,
    entryFees,
    gate,
    companyShare: pot - wrestlerShare,
    wrestlerShare,
  };
}

// ---------------------------------------------------------------- the crown

export interface CrownReign {
  wrestlerId: Id;
  wrestlerName: string;
  promotionId: Id;
  promotionName: string;
  /** The week it was won. It is held until the next Crucible. */
  wonWeek: number;
  year: number;
}

/**
 * What carrying the Iron Crown is worth while you have it.
 *
 * Deliberately a standing bonus rather than a stat boost: the crown does not
 * make anybody better at wrestling, it makes them somebody the crowd has
 * already decided is the best in the business. It expires when the next
 * Crucible crowns somebody else, which is what makes it worth defending.
 */
export function crownAura(settings: WorldSettings): number {
  return settings.cupCrownPopularityBonus;
}

export function crownLine(reign: CrownReign): string {
  return `${reign.wrestlerName} carries ${CUP_TROPHY}, won for ${reign.promotionName} at ${CUP_NAME} ${reign.year}.`;
}

// ---------------------------------------------------------------- the field

/**
 * Who a company sends.
 *
 * Its best available names, most popular first, capped at the slots the field
 * size allows. A company with fewer bodies than slots simply brings fewer —
 * there is no borrowing, and turning up short is its own kind of statement.
 */
export function cupEntrantsFrom(
  roster: readonly Wrestler[],
  slots: number,
  canWork: (w: Wrestler) => boolean,
): Wrestler[] {
  return [...roster]
    .filter((w) => w.role === 'wrestler' && !w.deceased && canWork(w))
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, slots);
}

/**
 * Is the field big enough to be worth running?
 *
 * Two companies is not a tournament, it is a supershow with brackets drawn on
 * it — and the game already has two of those in May and November. Three is the
 * point where the winner has beaten somebody they had no other reason to meet,
 * which is the whole appeal.
 */
export function fieldIsBigEnough(entrantCount: number, settings: WorldSettings): boolean {
  return entrantCount >= settings.cupMinimumField;
}

/**
 * How many times this person has won the thing.
 *
 * Read off the permanent history rather than a counter on the wrestler, so it
 * stays true across repackages, promotion moves and retirement — the record
 * belongs to the business, not to a roster row.
 */
export function crownsFor(history: readonly CrownReign[], wrestlerId: Id): CrownReign[] {
  return history.filter((r) => r.wrestlerId === wrestlerId);
}

/** "Iron Champion", or "Iron Champion x3". Big and bold on the profile. */
export function crownBadge(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? 'IRON CHAMPION' : `IRON CHAMPION \u00d7${count}`;
}

/**
 * The road to superstardom.
 *
 * Winning the Crucible is supposed to change a career, not nudge it. The crown
 * aura is standing the crowd hands over; this is the wrestler themselves coming
 * back different — sharper, fitter, better on the microphone, and carrying
 * themselves like somebody who has beaten the best in the business, because
 * they have.
 *
 * Applied once, permanently, at the moment they win. It stacks for a repeat
 * winner, which is the whole reason to want it twice.
 */
export interface CrownSurge {
  popularity: number;
  skill: number;
  charisma: number;
  stamina: number;
  attitude: number;
  momentum: number;
}

export function crownSurge(settings: WorldSettings): CrownSurge {
  return {
    popularity: settings.cupWinnerPopularitySurge,
    skill: settings.cupWinnerSkillSurge,
    charisma: settings.cupWinnerCharismaSurge,
    stamina: settings.cupWinnerStaminaSurge,
    attitude: settings.cupWinnerAttitudeSurge,
    momentum: settings.cupWinnerMomentumSurge,
  };
}

/** How the field reads in the paper before a match has happened. */
export function fieldLine(entrantCount: number, slots: number, settings?: WorldSettings): string {
  const floor = settings?.cupMinimumField ?? 3;
  if (entrantCount <= 0) return `Nobody could afford ${CUP_NAME} this year.`;
  if (entrantCount < floor) {
    return `Only ${entrantCount === 1 ? 'one company' : `${entrantCount} companies`} bought in. ${CUP_NAME} needs ${floor}, so it is off this year.`;
  }
  return `${entrantCount} companies bought in, ${slots} ${slots === 1 ? 'name' : 'names'} apiece.`;
}

/**
 * What the winner's standing does, and what a first-round exit costs.
 *
 * Winning the thing is the single biggest night an individual can have; going
 * out early in front of the whole business is a real, if smaller, embarrassment.
 */
export function cupStanding(
  roundsWon: number,
  totalRounds: number,
  settings: WorldSettings,
): number {
  if (totalRounds <= 0) return 0;
  const share = roundsWon / totalRounds;
  return clamp(
    (share - settings.cupNeutralRoundShare) * settings.cupStandingSwing,
    -settings.cupStandingSwing,
    settings.cupStandingSwing,
  );
}
