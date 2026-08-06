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
// REFEREES are characters, but light ones — a name, competence, and how
// bendable they are. That is enough for them to matter without becoming a
// second roster to manage. A good referee keeps a match clean; a poor one
// produces more screwy finishes whether you wanted them or not.
//
// A GUEST REFEREE is a wrestler in the referee's shirt. It is a booking
// decision with a real trade: star power at ringside lifts the match and the
// story, but a wrestler in that role is not neutral, cannot be relied on to
// count straight, and is not wrestling on your card that night.

import { clamp } from '../rng';
import type { Id, Wrestler, WorldSettings } from '../types';

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
  /** Fee per appearance. */
  feePerShow: number;
  blurb: string;
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

export interface Referee {
  id: Id;
  name: string;
  /** How reliably they call a clean, well-paced match. */
  competence: number; // 0-100
  /** How easily they are bought. High means a crooked finish is available. */
  bendable: number; // 0-100
  feePerShow: number;
  blurb: string;
}

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
 */
export function refereeEffect(referee: Referee, settings: WorldSettings): RefereeEffect {
  const competence = referee.competence / 100;
  return {
    ratingBonus: (competence - 0.5) * 2 * settings.refereeRatingSwing,
    screwyFinishWeight: 1 + (1 - competence) * settings.refereeScrewyFinishWeight,
    interferenceWeight: 1 + (referee.bendable / 100) * settings.refereeBendableWeight,
    // Even a poor official can still count to three.
    decisiveFinishWeight: 1,
    injuryMultiplier: 1,
  };
}

/**
 * Nobody in the shirt at all.
 *
 * This is the reason hiring one is a decision rather than a formality. With no
 * official there is nobody to count three, nobody to hear a submission, and
 * nobody to stop a match that has gone wrong — so decisive finishes get hard
 * to reach, the messy ones take over, people get hurt, and the crowd can see
 * they are watching something unprofessional.
 *
 * Deliberately worse on every axis than the worst referee in the pool. If
 * booking nobody were merely cheaper, booking nobody would be correct, and the
 * whole system would be decoration.
 */
export function noRefereeEffect(settings: WorldSettings): RefereeEffect {
  return {
    ratingBonus: -settings.noRefereeRatingPenalty,
    screwyFinishWeight: 1 + settings.noRefereeScrewyFinishWeight,
    interferenceWeight: 1 + settings.noRefereeInterferenceWeight,
    decisiveFinishWeight: settings.noRefereeDecisiveFinishWeight,
    injuryMultiplier: 1 + settings.noRefereeInjuryMultiplier,
  };
}

/**
 * A wrestler working as guest referee.
 *
 * Star power in the shirt lifts the match and gives the story somewhere to
 * go, but they are not a referee: the finish gets messier, and they are not
 * available to wrestle that night. The bigger the name, the bigger both
 * halves of that.
 */
export function guestRefereeEffect(guest: Wrestler, settings: WorldSettings): RefereeEffect {
  const starPower = guest.popularity / 100;
  return {
    ratingBonus: starPower * settings.guestRefereeRatingBonus,
    // Everybody watching knows this is going to end badly, and it usually does.
    screwyFinishWeight: 1 + settings.guestRefereeScrewyFinishWeight,
    interferenceWeight: 1 + starPower * settings.guestRefereeInterferenceWeight,
    // They can count. Whether they count straight is another matter, and that
    // is what the screwy weight above is for.
    decisiveFinishWeight: 1,
    injuryMultiplier: 1,
  };
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
  /** Total fees owed for everyone at ringside tonight. */
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
  // Nobody at all is its own case, and a costly one — see noRefereeEffect.
  const hasOfficial = Boolean(ctx.guestReferee || ctx.referee);
  const official = ctx.guestReferee
    ? guestRefereeEffect(ctx.guestReferee, ctx.settings)
    : ctx.referee
      ? refereeEffect(ctx.referee, ctx.settings)
      : noRefereeEffect(ctx.settings);

  ratingBonus += official.ratingBonus;
  screwyFinishWeight *= official.screwyFinishWeight;
  interferenceWeight *= official.interferenceWeight;
  if (!ctx.guestReferee && ctx.referee) cost += ctx.referee.feePerShow;

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
