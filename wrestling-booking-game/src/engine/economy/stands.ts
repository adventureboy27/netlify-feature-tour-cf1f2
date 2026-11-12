// Working out what the tables actually took.
//
// Every stand is a fixed cost against a per-head return, so the only question
// that matters is how many people came — and the answer is different for every
// line. This module answers it two ways: what a stand *did* take on a night
// that has happened, and what crowd it *needs* before it is worth stocking,
// said in words for the page.
//
// Pure. Takes stands, a crowd and a promotion's circumstances; returns money.

import { clamp } from '../rng';
import type { Id, PromotionArchetype, Venue, WorldSettings } from '../types';
import { ALL_STANDS, MERCH_LINES, CONCESSIONS, standById, type Stand, type StandFit } from '../../data/stands';

/** Everything about the promotion a stand's fit can key off. */
export interface StandContext {
  /** Average merch pull of the gimmicks on the card, around 1. */
  gimmickMerchMultiplier: number;
  /** Company rating, 0-100. */
  prestige: number;
  identity: PromotionArchetype | null;
  venue: Venue;
  /** Rungs of the production ladder that actually came into the room. */
  rigInRoom: readonly Id[];
  settings: WorldSettings;
}

/**
 * How well a line suits this particular promotion.
 *
 * The reason the answer is not simply "stock the dearest thing you can
 * afford". A mask stall in front of a lucha card is a different business from
 * a mask stall in front of six brawlers.
 */
export function standFit(fit: StandFit, ctx: StandContext): number {
  const { settings } = ctx;

  switch (fit) {
    case 'none':
      return 1;
    case 'gimmick':
      // The gimmick multipliers sit around 1; this widens the spread so the
      // difference between a lucha card and a card of stooges is felt.
      return clamp(
        1 + (ctx.gimmickMerchMultiplier - 1) * settings.standGimmickWeight,
        settings.standWorstFit,
        settings.standBestFit,
      );
    case 'prestige':
      return clamp(
        settings.standWorstFit + (ctx.prestige / 100) * settings.standPrestigeSwing,
        settings.standWorstFit,
        settings.standBestFit,
      );
    case 'hardcore':
      return ctx.identity === 'hardcore' ? settings.standBestFit : settings.standWorstFit;
    case 'family':
      // Sports entertainment brings the children; the deathmatch crowd does not.
      if (ctx.identity === 'sportsEntertainment') return settings.standBestFit;
      return ctx.identity === 'hardcore' ? settings.standWorstFit : 1;
  }
}

/** Can this stand be run here at all? */
export function standAvailable(stand: Stand, ctx: StandContext): boolean {
  // The building's bar is the building's business. Where it keeps the takings
  // outright there is no stand of yours to run.
  if (stand.needsBarRights && ctx.venue.concessionsPerHead <= 0) return false;
  if (stand.outdoorOnly && !ctx.venue.outdoor) return false;
  if (stand.requiresRung && !ctx.rigInRoom.includes(stand.requiresRung)) return false;
  return true;
}

/** Why it cannot, in words, for the page. Null when it can. */
export function standBlockedNote(stand: Stand, ctx: StandContext): string | null {
  if (stand.needsBarRights && ctx.venue.concessionsPerHead <= 0) return 'The building keeps its own bar.';
  if (stand.outdoorOnly && !ctx.venue.outdoor) return 'Nowhere to park them indoors.';
  if (stand.requiresRung && !ctx.rigInRoom.includes(stand.requiresRung)) return 'Nobody is filming the show.';
  return null;
}

export interface StandTakings {
  standId: Id;
  name: string;
  cost: number;
  /** Gross, before the building takes its slice. */
  gross: number;
  net: number;
}

/** What one stand took in front of this crowd. */
export function standTakings(stand: Stand, attendance: number, ctx: StandContext): StandTakings {
  const gross = Math.round(Math.max(0, attendance) * stand.perHead * standFit(stand.fit, ctx));
  return {
    standId: stand.id,
    name: stand.name,
    cost: stand.costPerShow,
    gross,
    net: gross - stand.costPerShow,
  };
}

export interface NightAtTheTables {
  merchGross: number;
  concessionsGross: number;
  /** Stock and staffing, owed whether anybody turned up or not. */
  cost: number;
  lines: StandTakings[];
}

/**
 * The whole night's tables, split into the two blocks that are taxed
 * differently: the building takes a slice of merch and pays nothing towards
 * the stock, and concessions are only yours where the building lets them be.
 */
export function nightAtTheTables(
  running: readonly Id[],
  attendance: number,
  ctx: StandContext,
): NightAtTheTables {
  let merchGross = 0;
  let concessionsGross = 0;
  let cost = 0;
  const lines: StandTakings[] = [];

  for (const id of running) {
    const stand = standById(id);
    if (!stand || !standAvailable(stand, ctx)) continue;

    const took = standTakings(stand, attendance, ctx);
    lines.push(took);
    cost += took.cost;
    if (MERCH_LINES.some((s) => s.id === stand.id)) merchGross += took.gross;
    else concessionsGross += took.gross;
  }

  return { merchGross, concessionsGross, cost, lines };
}

// ---------------------------------------------------------------- before the night

/**
 * The crowd a stand needs before the stock pays for itself.
 *
 * This is the whole decision, so it is the one thing the page has to be able
 * to say. Reported as a number of people because an attendance is a count of
 * human beings, not a stat — the ban is on rating bars and percentages, and a
 * booker who cannot see a break-even is not making a decision, he is guessing.
 */
export function breakEvenCrowd(stand: Stand, ctx: StandContext): number {
  const perHead = stand.perHead * standFit(stand.fit, ctx);
  if (perHead <= 0) return Infinity;
  // The half accounts for the rounding in standTakings: takings are rounded to
  // whole money, so the true break-even is half a unit below the clean
  // division and a plain ceil reports one customer too many.
  return Math.max(1, Math.ceil((stand.costPerShow - 0.5) / perHead));
}

/**
 * How that break-even reads against the room you have actually booked.
 *
 * States the position; it does not advise. A booker who stocks replica belts
 * into a school gym gets exactly what he chose, and finds out on the night.
 */
export function standVerdict(stand: Stand, ctx: StandContext): string {
  const need = breakEvenCrowd(stand, ctx);
  if (!Number.isFinite(need)) return 'Sells nothing to this crowd.';

  const room = ctx.venue.capacity;
  if (need <= room * ctx.settings.standEasySell) return 'Pays for itself in front of almost anybody.';
  if (need <= room * ctx.settings.standFairSell) return 'Pays on a decent house.';
  if (need <= room) return 'Needs this room close to full.';
  return 'More stock than this building can hold people.';
}

/** Everything that could be run here tonight, merch first. */
export function standsOnOffer(ctx: StandContext): { stand: Stand; blocked: string | null }[] {
  return [...MERCH_LINES, ...CONCESSIONS].map((stand) => ({
    stand,
    blocked: standBlockedNote(stand, ctx),
  }));
}

/** Ids that are no longer runnable, so a changed venue does not keep charging. */
export function prunedStands(running: readonly Id[], ctx: StandContext): Id[] {
  return running.filter((id) => {
    const stand = standById(id);
    return Boolean(stand) && standAvailable(stand!, ctx);
  });
}

export { ALL_STANDS, MERCH_LINES, CONCESSIONS, standById };
export type { Stand, StandFit };
