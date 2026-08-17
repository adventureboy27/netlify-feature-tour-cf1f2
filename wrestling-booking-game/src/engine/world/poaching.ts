// Poaching, with the one rule that makes it fair: nobody loses a wrestler
// without getting a chance to answer first.
//
// A rival's interest arrives as an OPEN offer. It sits there. The player sees
// who, from where, how much, and how tempted the wrestler is — and has a week
// to do something about it. Only then does it resolve. Losing someone is
// always the consequence of a response you chose (including choosing not to
// respond), never of a die roll you never saw.
//
// The player can tamper too. It is deliberately a bad bet: a low chance of
// landing someone else's contracted talent, and a severe, lasting penalty
// when it goes wrong. It exists so the option is there, not so it is correct.

import type { Rng } from '../rng';
import { chance, clamp } from '../rng';
import type { Id, Wrestler, WorldSettings } from '../types';
import { temptation, type Suitor } from './tampering';

export type OfferStatus = 'open' | 'resolved';

/** A rival's approach, sitting on the table awaiting the player's answer. */
export interface PoachingOffer {
  id: Id;
  wrestlerId: Id;
  rivalPromotionId: Id;
  /** Under contract to you, or a deal running out. */
  kind: 'approach' | 'tampering';
  offerPremium: number;
  temptation: number;
  openedWeek: number;
  /** Resolves at the end of this week unless answered. */
  resolvesWeek: number;
  status: OfferStatus;
}

export type PoachingResponse =
  | { kind: 'matchMoney' }
  | { kind: 'promiseAPush' }
  | { kind: 'legalThreat' } // only meaningful against tampering with a live deal
  | { kind: 'doNothing' };

export interface ResponseOutcome {
  /** How much the response moved their temptation. Negative is good for you. */
  temptationDelta: number;
  /** Applied to the wrestler's weekly rate. */
  rateMultiplier: number;
  moraleDelta: number;
  momentumDelta: number;
  rosterMoraleDelta: number;
  /** Reputation cost of the response itself. */
  reputationDelta: number;
  description: string;
}

/**
 * What each answer does. Every one of them costs something — matching the
 * money raises your payroll and the locker room hears about it, promising a
 * push commits your top spot, and a legal threat makes an enemy of a
 * promotion you will deal with again.
 */
export function responseOutcome(response: PoachingResponse, settings: WorldSettings): ResponseOutcome {
  switch (response.kind) {
    case 'matchMoney':
      return {
        temptationDelta: -settings.poachResponseMoneyEffect,
        rateMultiplier: settings.poachResponseMoneyRaise,
        moraleDelta: 12,
        momentumDelta: 0,
        rosterMoraleDelta: -3,
        reputationDelta: 0,
        description: 'You matched the money. Payroll is up and everyone else will hear about it.',
      };
    case 'promiseAPush':
      return {
        temptationDelta: -settings.poachResponsePushEffect,
        rateMultiplier: 1,
        moraleDelta: 9,
        momentumDelta: 18,
        rosterMoraleDelta: -2,
        reputationDelta: 0,
        description: 'You promised them the spot. That is a commitment other people noticed.',
      };
    case 'legalThreat':
      return {
        temptationDelta: -settings.poachResponseLegalEffect,
        rateMultiplier: 1,
        moraleDelta: -6,
        momentumDelta: 0,
        rosterMoraleDelta: -1,
        reputationDelta: -4,
        description: 'You threatened to enforce the contract. It works, and nobody enjoyed it.',
      };
    case 'doNothing':
      return {
        temptationDelta: 0,
        rateMultiplier: 1,
        moraleDelta: -4,
        momentumDelta: 0,
        rosterMoraleDelta: 0,
        reputationDelta: 0,
        description: 'You let it ride.',
      };
  }
}

/** A legal threat only means anything against a live contract. */
export function responseIsAvailable(response: PoachingResponse, offer: PoachingOffer): boolean {
  if (response.kind === 'legalThreat') return offer.kind === 'tampering';
  return true;
}

/**
 * Settle an offer after the player has had their say. Returns true if the
 * wrestler leaves.
 */
export function resolveOffer(rng: Rng, offer: PoachingOffer, appliedResponse: PoachingResponse, settings: WorldSettings): boolean {
  const outcome = responseOutcome(appliedResponse, settings);
  const finalTemptation = clamp(offer.temptation + outcome.temptationDelta, 0, 1);
  return chance(rng, finalTemptation);
}

// ------------------------------------------------------ the player tampering

export interface PlayerTamperingAttempt {
  targetWrestlerId: Id;
  targetPromotionId: Id;
  /** What you are offering over their current rate. */
  offerPremium: number;
}

export interface TamperingRisk {
  /** Chance the wrestler actually comes, if you are not caught. */
  successChance: number;
  /** Chance you are found out. Independent of whether they come. */
  caughtChance: number;
}

/**
 * Going after somebody else's contracted talent.
 *
 * Deliberately a bad bet. The success chance is low even with a big offer,
 * and being caught is likely enough that repeated attempts will find you out.
 * The point is that the option exists and that using it is a real gamble —
 * not that it is a reliable way to build a roster.
 */
export function tamperingRisk(
  target: Wrestler,
  attempt: PlayerTamperingAttempt,
  settings: WorldSettings,
  /**
   * You, as a suitor — your promotion id and, if the target has a
   * `somebodyAtHome` partner, where that partner currently works. Optional
   * because the escalation/sanction call sites that reuse this risk do not
   * always have a relationship lookup handy, and the trait simply contributes
   * nothing when it is missing.
   */
  suitor?: Suitor,
): TamperingRisk {
  const weeksLeft = target.contract?.weeksRemaining ?? 0;
  const baseTemptation = temptation(target, attempt.offerPremium, weeksLeft, settings, suitor);

  // Even a wrestler who wants to come mostly cannot: they are under contract,
  // and walking out has its own consequences for them.
  const successChance = clamp(baseTemptation * settings.playerTamperingSuccessScale, 0, settings.playerTamperingSuccessCap);

  // The bigger the offer and the bigger the name, the more people talk.
  const notoriety = target.popularity / 100;
  const caughtChance = clamp(
    settings.playerTamperingCaughtBase + notoriety * settings.playerTamperingCaughtByFame,
    0,
    0.95,
  );

  return { successChance, caughtChance };
}

/**
 * What happens when you are caught, escalating with every previous offence.
 * The first time is a fine. The second stops you running shows. The third
 * takes your television.
 */
export type TamperingSanction = 'fine' | 'suspension' | 'expulsion';

export interface TamperingResult {
  signed: boolean;
  caught: boolean;
  sanction: TamperingSanction | null;
  /** Fine levied when caught. Scales with how often you have done this. */
  fine: number;
  reputationDelta: number;
  /** Weeks barred from signing anyone at all. */
  signingBanWeeks: number;
  /** Weeks you may not run a show at all. No revenue; wages still due. */
  suspensionWeeks: number;
  /** Company rating stripped — losing the TV slot. */
  companyRatingPenalty: number;
  description: string;
}

/** Which sanction a given offence number draws. */
export function sanctionFor(priorOffenses: number): TamperingSanction {
  if (priorOffenses === 0) return 'fine';
  if (priorOffenses === 1) return 'suspension';
  return 'expulsion';
}

export function attemptPlayerTampering(
  rng: Rng,
  target: Wrestler,
  attempt: PlayerTamperingAttempt,
  bankBalance: number,
  settings: WorldSettings,
  priorOffenses = 0,
  suitor?: Suitor,
): TamperingResult {
  const risk = tamperingRisk(target, attempt, settings, suitor);
  const signed = chance(rng, risk.successChance);
  const caught = chance(rng, risk.caughtChance);

  if (!caught) {
    return {
      signed,
      caught: false,
      sanction: null,
      fine: 0,
      reputationDelta: 0,
      signingBanWeeks: 0,
      suspensionWeeks: 0,
      companyRatingPenalty: 0,
      description: signed
        ? `${target.name} walked out on their deal and signed with you. Nobody can prove anything.`
        : `${target.name} turned you down and kept it to themselves.`,
    };
  }

  // Caught. Meant to hurt badly enough that tampering is a last resort rather
  // than a strategy, and to escalate: get away with it once and the second
  // time costs you the ability to run at all.
  const sanction = sanctionFor(priorOffenses);
  const escalation = 1 + priorOffenses * settings.playerTamperingEscalation;

  const fine = Math.round(
    Math.max(settings.playerTamperingMinFine, bankBalance * settings.playerTamperingFineFraction) * escalation,
  );

  const suspensionWeeks =
    sanction === 'suspension'
      ? settings.playerTamperingSuspensionWeeks
      : sanction === 'expulsion'
        ? settings.playerTamperingSuspensionWeeks * 2
        : 0;

  const companyRatingPenalty = sanction === 'expulsion' ? settings.playerTamperingExpulsionRatingLoss : 0;

  const consequence =
    sanction === 'fine'
      ? 'The fine is enormous and everyone in the business knows.'
      : sanction === 'suspension'
        ? `You are suspended for ${suspensionWeeks} weeks. No shows, no gate, and the wages still have to be paid.`
        : `The sanction is total: ${suspensionWeeks} weeks dark and your television slot is gone.`;

  return {
    signed,
    caught: true,
    sanction,
    fine,
    reputationDelta: -settings.playerTamperingReputationPenalty * escalation,
    signingBanWeeks: Math.round(settings.playerTamperingBanWeeks * escalation),
    suspensionWeeks,
    companyRatingPenalty,
    description: signed
      ? `You got ${target.name} — and you were caught doing it. ${consequence}`
      : `You were caught tampering with ${target.name} and did not even get them. ${consequence}`,
  };
}
