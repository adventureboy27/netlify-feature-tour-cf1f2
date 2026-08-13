// Ringside personnel — managers and referees, §10.
//
// MANAGERS are the cheap way to fix an act that cannot talk. A manager adds a
// little to the match rating, adds more to how over their client gets, and
// draws a fee every time they appear. The catch is deliberate: a manager
// takes some of the heat with them. A wrestler who needs a mouthpiece looks
// like a wrestler who needs a mouthpiece, and gets over slightly slower on
// their own as a result. Great for a monster who cannot cut a promo, wasted
// on somebody who can.
//
// REFEREES are signed characters and live in sim/referees.ts — a contract, a
// wage, fatigue across a card, and a standing the sheet ranks. This file only
// deals with what an official does to the match in front of him. A good one
// keeps the finish clean; a poor one produces messes you did not book, and
// says out loud what he missed.
//
// A GUEST REFEREE is a wrestler in the referee's shirt. It is a booking
// decision with a real trade: star power at ringside lifts the match and the
// story, but a wrestler in that role is not neutral, cannot be relied on to
// count straight, and is not wrestling on your card that night.

import { clamp } from '../rng';
import type { Ledger } from '../career/ledger';
import type { Id, Referee, Wrestler, WorldSettings } from '../types';
import { effectiveCompetence } from './referees';

export type { Referee };

// ---------------------------------------------------------------- managers

export interface Manager {
  id: Id;
  name: string;
  /** Talking. Drives how much they add to their client's heat. */
  micWork: number; // 0-100
  /** Presence at ringside — how much they add to the match itself. */
  presence: number; // 0-100
  /** Willingness to cheat for their client. Feeds interference finishes. */
  deviousness: number; // 0-100
  /** Fee per appearance. Zero for one of your own — already on the payroll. */
  feePerShow: number;
  /**
   * Managers get old and die like anybody else. Optional only because one of
   * your own wrestlers doing the job carries their own age; `ageOfManager`
   * resolves it either way.
   */
  age?: number;
  blurb: string;
  /** Set when this is one of your wrestlers doing the job. */
  wrestlerId?: Id;
  /** What their people did, lifetime and per company. See career/ledger.ts. */
  ledger?: Ledger;
}

export interface ManagerEffect {
  /** Added to the match rating. */
  ratingBonus: number;
  /** Added to the client's popularity gain from the match. */
  clientPopularityMultiplier: number;
  /** Extra weight on an interference finish. */
  interferenceWeight: number;
  /** The cost that is not money: the client gets over slower on their own. */
  selfMadePenalty: number;
}

/**
 * What a manager is worth to a given wrestler.
 *
 * The benefit scales *inversely* with the client's own charisma — that is the
 * whole design. Putting a great talker with a manager is money wasted;
 * putting a silent monster with one can make them.
 */
export function managerEffect(manager: Manager, client: Wrestler, settings: WorldSettings): ManagerEffect {
  const needsHelp = 1 - client.charisma / 100;

  return {
    ratingBonus: (manager.presence / 100) * settings.managerRatingBonusMax,
    clientPopularityMultiplier:
      1 + (manager.micWork / 100) * needsHelp * settings.managerPopularityBoostMax,
    interferenceWeight: 1 + (manager.deviousness / 100) * settings.managerInterferenceWeight,
    // Leaning on a mouthpiece stunts what the wrestler builds themselves.
    selfMadePenalty: (manager.micWork / 100) * settings.managerSelfMadePenalty,
  };
}

/** Is this pairing actually worth the fee? Shown as words, never a number. */
export type ManagerFit = 'Wasted on them' | 'Marginal' | 'Good fit' | 'Exactly what they need';

export function managerFit(manager: Manager, client: Wrestler, settings: WorldSettings): ManagerFit {
  const effect = managerEffect(manager, client, settings);
  const gain = effect.clientPopularityMultiplier - 1;
  if (gain < 0.05) return 'Wasted on them';
  if (gain < 0.12) return 'Marginal';
  if (gain < 0.22) return 'Good fit';
  return 'Exactly what they need';
}

// --------------------------------------------------------------- referees

export interface RefereeEffect {
  ratingBonus: number;
  /** Multiplier on disqualification and count-out weights. */
  screwyFinishWeight: number;
  /** Multiplier on the interference weight. */
  interferenceWeight: number;
  /**
   * Multiplier on every finish that needs an official to make it official —
   * a pinfall, a submission, a stoppage. Below 1 means those get harder to
   * reach and the messy finishes take their place.
   */
  decisiveFinishWeight: number;
  /** Somebody has to stop a match that has gone wrong. */
  injuryMultiplier: number;
}

/**
 * A competent referee is invisible, which is the point — they add a little to
 * the match and keep the finish clean. An incompetent one produces messes you
 * did not book.
 *
 * Reads *effective* competence, not the raw stat, so the same official is
 * worth less in the sixth match of the night than in the first. That is the
 * whole reason to carry more than one.
 */
export function refereeEffect(referee: Referee, settings: WorldSettings): RefereeEffect {
  const competence = effectiveCompetence(referee, settings) / 100;
  return {
    ratingBonus: (competence - 0.5) * 2 * settings.refereeRatingSwing,
    screwyFinishWeight: 1 + (1 - competence) * settings.refereeScrewyFinishWeight,
    interferenceWeight: 1 + (referee.bendable / 100) * settings.refereeBendableWeight,
    // Even a poor official can still count to three.
    decisiveFinishWeight: 1,
    injuryMultiplier: 1,
  };
}

// There is no "nobody" case any more. A match without a professional gets a
// wrestler in the shirt instead — the store drafts one at bell time — so the
// consequence of not hiring an official is not chaos, it is a partial
// referee with an agenda. See refereeAgenda above.

/**
 * A wrestler working as guest referee.
 *
 * The point of putting one in the shirt is not that they are a worse referee.
 * They can count to three perfectly well. The point is that they are *not
 * neutral*: there are only two reasons to book one, which are to raise the
 * drama and to guarantee that something happens, and both of those come from
 * the fact that they will take a side.
 *
 * So a guest brings star power to the match and a thumb to the scale, gets
 * involved in the finish far more often than an official would, and can get
 * hurt doing it — they are a wrestler standing in the middle of a fight
 * without the protection of being the referee.
 */
export function guestRefereeEffect(guest: Wrestler, settings: WorldSettings): RefereeEffect {
  const starPower = guest.popularity / 100;
  return {
    ratingBonus: starPower * settings.guestRefereeRatingBonus,
    // Everybody watching knows this is going to end badly, and it usually does.
    screwyFinishWeight: 1 + settings.guestRefereeScrewyFinishWeight,
    interferenceWeight: 1 + starPower * settings.guestRefereeInterferenceWeight,
    // They can count. Whether they count *straight* is the whole question,
    // and that is what the bias below is for.
    decisiveFinishWeight: 1,
    injuryMultiplier: 1,
  };
}

/** Which way a guest referee leans, and how hard. */
export interface RefereeAgenda {
  /** The side they will help, or null if they genuinely have no dog in it. */
  favoursSide: number | null;
  /** Points of win probability shifted that side's way. */
  shift: number;
  /** Why, in the write-up's words. */
  reason: string;
}

export interface AgendaContext {
  guest: Wrestler;
  /** Everybody in the match, with the side they are on. */
  competitors: { wrestler: Wrestler; side: number }[];
  /** Wrestlers the guest has live heat with. */
  rivalIds: readonly Id[];
  /** Wrestlers the guest counts as friends, and as enemies. */
  friendIds: readonly Id[];
  enemyIds: readonly Id[];
  settings: WorldSettings;
}

/**
 * What the guest is actually out there to do.
 *
 * Never a coin flip. A guest referee leans for a reason the player could have
 * seen coming — a friend in the match, somebody they have heat with, or
 * failing all that, the simple fact that a heel in the shirt is not going to
 * help a babyface. That is what makes booking one a decision instead of a
 * dice roll.
 */
export function refereeAgenda(ctx: AgendaContext): RefereeAgenda {
  const s = ctx.settings;
  const sideOf = (id: Id) => ctx.competitors.find((c) => c.wrestler.id === id)?.side ?? null;

  // Somebody they want to see beaten comes first — a grudge is louder than a
  // friendship.
  for (const rivalId of ctx.rivalIds) {
    const side = sideOf(rivalId);
    if (side === null) continue;
    const against = ctx.competitors.find((c) => c.side !== side);
    if (!against) continue;
    const name = ctx.competitors.find((c) => c.wrestler.id === rivalId)!.wrestler.name;
    return {
      favoursSide: against.side,
      shift: s.guestRefereeGrudgeShift,
      reason: `has unfinished business with ${name}`,
    };
  }

  for (const enemyId of ctx.enemyIds) {
    const side = sideOf(enemyId);
    if (side === null) continue;
    const against = ctx.competitors.find((c) => c.side !== side);
    if (!against) continue;
    const name = ctx.competitors.find((c) => c.wrestler.id === enemyId)!.wrestler.name;
    return { favoursSide: against.side, shift: s.guestRefereeBiasShift, reason: `cannot stand ${name}` };
  }

  for (const friendId of ctx.friendIds) {
    const side = sideOf(friendId);
    if (side === null) continue;
    const name = ctx.competitors.find((c) => c.wrestler.id === friendId)!.wrestler.name;
    return { favoursSide: side, shift: s.guestRefereeBiasShift, reason: `is not going to count ${name} out` };
  }

  // No history at all, so character decides it. A heel in the shirt helps the
  // heel, and everybody in the building knows it.
  const wantsHeel = ctx.guest.alignment < 0;
  const target = ctx.competitors.find((c) => (wantsHeel ? c.wrestler.alignment < 0 : c.wrestler.alignment > 0));
  if (!target) return { favoursSide: null, shift: 0, reason: 'has nobody in this to care about' };
  return {
    favoursSide: target.side,
    shift: s.guestRefereeAlignmentShift,
    reason: wantsHeel ? 'was never going to call this straight' : 'is calling it the way they see it',
  };
}

/**
 * What standing in the middle of a match costs the guest.
 *
 * Not guaranteed — plenty of guest referees walk away fine — but they are in
 * there without a wrestler's licence to defend themselves, and it shows.
 */
export function guestRefereeHealthCost(guest: Wrestler, violenceLevel: number, settings: WorldSettings): number {
  const exposure = 1 + violenceLevel / settings.territoryHardcoreFullViolence;
  return settings.guestRefereeHealthCost * exposure * (1 - guest.toughness / 200);
}

/** A guest referee cannot also be wrestling in the match they are counting. */
export function guestRefereeIsLegal(guestId: Id, participantIds: readonly Id[]): boolean {
  return !participantIds.includes(guestId);
}

// ----------------------------------------------------------- combined view

export interface RingsideContext {
  managers: { manager: Manager; client: Wrestler }[];
  referee: Referee | null;
  guestReferee: Wrestler | null;
  /**
   * True when the guest was drafted at bell time rather than booked.
   *
   * A guest referee is worth something to a match *because it was announced*:
   * the crowd knows who is counting and why it matters. Nobody is excited that
   * a spare body was handed a shirt because the booker would not pay for an
   * official, so a draftee brings the bias without the drama.
   */
  guestWasDrafted?: boolean;
  settings: WorldSettings;
}

export interface RingsideTotals {
  ratingBonus: number;
  screwyFinishWeight: number;
  interferenceWeight: number;
  /** Below 1 when there is nobody to make a finish official. */
  decisiveFinishWeight: number;
  /** Above 1 when there is nobody to stop a match going wrong. */
  injuryMultiplier: number;
  /** Whether anybody is officiating at all. Some finishes need one. */
  hasOfficial: boolean;
  /** Manager fees for this match. Referees are billed per show, not per match. */
  cost: number;
}

/** Everything at ringside, rolled into what the sim needs. */
export function ringsideTotals(ctx: RingsideContext): RingsideTotals {
  let ratingBonus = 0;
  let screwyFinishWeight = 1;
  let interferenceWeight = 1;
  let cost = 0;

  for (const { manager, client } of ctx.managers) {
    const effect = managerEffect(manager, client, ctx.settings);
    ratingBonus += effect.ratingBonus;
    interferenceWeight *= effect.interferenceWeight;
    cost += manager.feePerShow;
  }

  // A guest referee replaces the assigned official rather than joining them.
  // By the time a match reaches the bell somebody is always counting: the
  // store drafts a wrestler when the player named nobody.
  const hasOfficial = Boolean(ctx.guestReferee || ctx.referee);
  const official = ctx.guestReferee
    ? guestRefereeEffect(ctx.guestReferee, ctx.settings)
    : ctx.referee
      ? refereeEffect(ctx.referee, ctx.settings)
      : { ratingBonus: 0, screwyFinishWeight: 1, interferenceWeight: 1, decisiveFinishWeight: 1, injuryMultiplier: 1 };

  ratingBonus += ctx.guestWasDrafted ? 0 : official.ratingBonus;
  screwyFinishWeight *= official.screwyFinishWeight;
  interferenceWeight *= official.interferenceWeight;
  // Deliberately NOT charged here. Officials are on the payroll now — a
  // weekly wage against a signed contract, paid whether they work or not, the
  // same as a wrestler. Managers above are still per appearance, which is the
  // real difference between the two jobs.

  return {
    ratingBonus: clamp(ratingBonus, -20, 20),
    screwyFinishWeight,
    interferenceWeight,
    decisiveFinishWeight: official.decisiveFinishWeight,
    injuryMultiplier: official.injuryMultiplier,
    hasOfficial,
    cost,
  };
}
