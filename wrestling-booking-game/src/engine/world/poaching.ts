// Rival bookers going after your talent (§19) — always legal, always
// somebody whose deal has already run out. A rival's interest arrives as an
// OPEN offer. It sits there. The player sees who, from where, how much, and
// how tempted the wrestler is — and has a week to do something about it.
// Only then does it resolve. Losing someone is always the consequence of a
// response you chose (including choosing not to respond), never of a die
// roll you never saw.

import type { Rng } from '../rng';
import { chance, clamp } from '../rng';
import type { Id, Wrestler, Promotion, WorldSettings, CareerStatus } from '../types';
import { isPoachingTarget } from '../career/status';
import { hasTrait, leverWeight, temptationWeight } from '../career/personality';

export type OfferStatus = 'open' | 'resolved';

const APPROACH_LINES = [
  "I had somebody from {rival} pull me aside after the show.",
  "{rival} reached out. I wasn't looking for it, but I took the call.",
  "Somebody from {rival} has been talking to me. I thought you should hear it from me first.",
];

/**
 * What the wrestler being courted says about it, in their own words. Picked
 * deterministically from the offer itself — presentation, not a roll, so the
 * same open offer always reads the same way.
 */
export function approachLine(offer: PoachingOffer, rivalName: string): string {
  const index = (offer.wrestlerId.length + offer.openedWeek) % APPROACH_LINES.length;
  return APPROACH_LINES[index]!.replaceAll('{rival}', rivalName);
}

/** A rival's approach, sitting on the table awaiting the player's answer. */
export interface PoachingOffer {
  id: Id;
  wrestlerId: Id;
  rivalPromotionId: Id;
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
  /** What it costs to say this, once — the wire item. */
  description: string;
  /** What you're hoping for. Same convention as a creative event's option. */
  gains: string;
  /** What it costs you. */
  costs: string;
}

/**
 * What each answer does. Every one of them costs something — matching the
 * money raises your payroll and the locker room hears about it, and
 * promising a push commits your top spot.
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
        gains: 'Makes them meaningfully less likely to go',
        costs: 'Payroll goes up, and the rest of the room hears about it',
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
        gains: 'Costs nothing up front, and it is a real commitment they notice',
        costs: 'You are on the hook for the push whether or not they stay',
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
        gains: 'Costs nothing today',
        costs: 'Does nothing to change their mind either',
      };
  }
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

// ------------------------------------------------------------- temptation

/**
 * How appealing a wrestler is to somebody else. Rivals want people who are
 * over, people who are young and about to be, and people who are unhappy —
 * in that order.
 */
function poachingAppeal(wrestler: Wrestler, status: CareerStatus): number {
  if (!isPoachingTarget(status)) return 0;

  const overness = wrestler.popularity / 100;
  // What the rival believes, not what is true — see career/hype.ts. Reading
  // `talent` here made every promotion omniscient about the one number the
  // player is never shown.
  const upside = (wrestler.hype / 100) * (wrestler.age < 30 ? 1 : 0.4);
  // Somebody miserable is worth approaching even if they are not a star.
  const unhappiness = 1 - wrestler.morale / 100;

  return clamp(overness * 0.55 + upside * 0.25 + unhappiness * 0.2, 0, 1);
}

/**
 * Who is doing the approaching, and what they can offer beyond money — the
 * two things `temptation()` cannot read off the wrestler alone.
 */
export interface Suitor {
  /** The promotion making the offer. */
  promotionId: Id;
  /** Where their `somebodyAtHome` partner currently works, if they have one. */
  partnerPromotionId?: Id | null;
}

/**
 * How temptable a wrestler is by a given offer. A wrestler who is paid well
 * and pushed well is hard to move.
 *
 * Personality changes what the same offer is worth to the same money and
 * morale. Before this, an In It For The Money draw and a Grateful For The
 * Work draw on identical deals were exactly as easy to poach, which is the
 * opposite of what those traits say about them.
 */
export function temptation(
  wrestler: Wrestler,
  offerPremium: number,
  weeksLeftOnDeal: number,
  settings: WorldSettings,
  suitor?: Suitor,
): number {
  const currentRate = wrestler.contract?.weeklyRate ?? 0;
  // The `money` lever is the same one In It For The Money weighs on its own
  // morale term (2.4x) — reused here so the same trait answers "does the
  // number move you" the same way in both places.
  const money = (currentRate > 0 ? clamp(offerPremium / currentRate, 0, 2) / 2 : 1) * leverWeight(wrestler, 'money', settings);

  const unhappy = 1 - wrestler.morale / 100;
  const stalled = 1 - wrestler.momentum / 100;

  // A deal that has not actually run out yet is still a real deterrent.
  const lockedIn = clamp(weeksLeftOnDeal / settings.contractLengthDefault, 0, 1);

  // Two structural pulls a number cannot express. No Time For The Office
  // dislikes the current management regardless of how well it books them —
  // that is what "nothing you book changes it" means. And Somebody At Home
  // is not a general restlessness, it is a pull toward one specific address:
  // it only fires when the suitor is where the partner already is.
  const dislikesUs = hasTrait(wrestler, 'noTimeForTheOffice') ? settings.traitOfficeDislikePull : 0;
  const drawnThere =
    hasTrait(wrestler, 'somebodyAtHome') &&
    suitor?.partnerPromotionId &&
    suitor.partnerPromotionId === suitor.promotionId
      ? settings.traitPartnerPull
      : 0;
  // And Wants The Spotlight is not tempted by a rival as such — they are
  // tempted by not being the man at home. A main eventer with this trait is
  // already where they want to be; a stalled one is exactly who a rival's
  // promise of a push is aimed at.
  const wantsUp =
    hasTrait(wrestler, 'wantsTheSpotlight') && wrestler.cardStatus !== 'mainEventer'
      ? settings.traitSpotlightPull
      : 0;

  const raw =
    money * settings.approachMoneyWeight +
    unhappy * settings.approachMoraleWeight +
    stalled * settings.approachMomentumWeight -
    lockedIn * settings.approachContractLengthResistance +
    dislikesUs +
    drawnThere +
    wantsUp;

  // Attitude cuts both ways: a professional honours the deal, a mercenary
  // was always going to take the call.
  const professionalism = (wrestler.attitude / 100) * settings.approachAttitudeResistance;

  // And a general loyalty multiplier for the traits that are not about any
  // one term — Grateful For The Work is simply hard to move, in every
  // direction, whatever the offer looks like.
  return clamp((raw - professionalism) * temptationWeight(wrestler), 0, 1);
}

export interface ApproachContext {
  roster: readonly Wrestler[];
  statusOf: (wrestler: Wrestler) => CareerStatus;
  rivals: readonly Promotion[];
  currentWeek: number;
  settings: WorldSettings;
  /**
   * Look up anybody in the business by id, so a Somebody At Home approach can
   * ask where the partner works. Optional — a caller that does not track
   * relationships simply gets no pull from this trait, same as before it
   * existed.
   */
  wrestlerById?: (id: Id) => Wrestler | undefined;
}

export interface Approach {
  wrestlerId: string;
  rivalPromotionId: string;
  /** How much more per week the rival is dangling. */
  offerPremium: number;
  /** 0-1 — how close the wrestler is to taking it. */
  temptation: number;
}

/**
 * Roll this week's approaches. Richer, better-regarded rivals come calling
 * more often — losing your top guy to the biggest promotion in the country
 * should feel different from losing him to a regional outfit.
 *
 * Only ever for somebody whose deal has already run out. Nobody goes after a
 * wrestler who is still under contract to you.
 */
export function rollApproaches(rng: Rng, ctx: ApproachContext): Approach[] {
  const attempts: Approach[] = [];
  const { settings } = ctx;

  for (const rival of ctx.rivals) {
    const aggression = (rival.rating / 100) * settings.poachingAggression;

    for (const wrestler of ctx.roster) {
      // A live deal is off limits — only a lapsed one is fair game.
      const weeksLeft = wrestler.contract?.weeksRemaining ?? 0;
      if (weeksLeft > 0) continue;

      const appeal = poachingAppeal(wrestler, ctx.statusOf(wrestler));
      if (appeal <= 0) continue;

      const probability = clamp(appeal * aggression * settings.approachBaseChance, 0, 0.6);
      if (!chance(rng, probability)) continue;

      const currentRate = wrestler.contract?.weeklyRate ?? settings.ticketPriceBase * 100;
      const premium = Math.round(
        currentRate * (settings.approachOfferPremiumMin + appeal * settings.approachOfferPremiumRange),
      );

      const partner = wrestler.attachedTo ? ctx.wrestlerById?.(wrestler.attachedTo) : undefined;
      const suitor: Suitor = { promotionId: rival.id, partnerPromotionId: partner?.promotionId ?? null };

      attempts.push({
        wrestlerId: wrestler.id,
        rivalPromotionId: rival.id,
        offerPremium: premium,
        temptation: temptation(wrestler, premium, weeksLeft, settings, suitor),
      });
    }
  }

  // One rival per wrestler per week — a bidding war is a separate system, and
  // three simultaneous offers reads as noise rather than as a crisis.
  const seen = new Set<string>();
  return attempts.filter((a) => (seen.has(a.wrestlerId) ? false : (seen.add(a.wrestlerId), true)));
}

/** Words, not a percentage — same rule as the odds (§13). */
export type TemptationLabel = 'Not interested' | 'Flattered' | 'Listening' | 'Seriously considering' | 'As good as gone';

export function temptationLabel(value: number): TemptationLabel {
  if (value < 0.15) return 'Not interested';
  if (value < 0.35) return 'Flattered';
  if (value < 0.55) return 'Listening';
  if (value < 0.78) return 'Seriously considering';
  return 'As good as gone';
}
