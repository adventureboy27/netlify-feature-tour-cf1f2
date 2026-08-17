// Rival bookers going after your talent — §19 poaching, plus the dirtier
// half of it: tampering with people who are still under contract to you.
//
// Two different threats, and the difference matters:
//
//   an approach   they talk to someone whose deal is running out. Legal,
//                 normal, and mostly a problem you created by letting a
//                 contract get short.
//
//   tampering     they talk to someone who is *not* free, and try to make
//                 leaving worth the penalty. This is the one that costs you
//                 a wrestler you thought was locked up, and the one the
//                 ironClad and noCompete clauses exist to stop.
//
// Everything here is a probability the player can influence but never
// eliminate: pay them, push them, keep them happy, and rivals still come.

import type { Rng } from '../rng';
import { chance, clamp } from '../rng';
import type { Id, Wrestler, Promotion, WorldSettings, CareerStatus } from '../types';
import { isPoachingTarget } from '../career/status';
import { hasTrait, leverWeight, temptationWeight } from '../career/personality';

export type TamperingKind = 'approach' | 'tampering';

export interface TamperingAttempt {
  wrestlerId: string;
  rivalPromotionId: string;
  kind: TamperingKind;
  /** How much more per week the rival is dangling. */
  offerPremium: number;
  /** 0-1 — how close the wrestler is to taking it. */
  temptation: number;
}

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
 * How temptable a wrestler is by a given offer. Loyalty is bought with money
 * *and* with booking — a wrestler who is paid well and pushed well is hard to
 * move, and one who is paid well and buried is not.
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

  // A long deal is a real deterrent; a short one barely registers.
  const lockedIn = clamp(weeksLeftOnDeal / settings.contractLengthDefault, 0, 1);

  const clauses = wrestler.contract?.clauses ?? [];
  const ironClad = clauses.includes('ironClad') ? settings.tamperingIronCladResistance : 0;
  const noCompete = clauses.includes('noCompete') ? settings.tamperingNoCompeteResistance : 0;

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
    money * settings.tamperingMoneyWeight +
    unhappy * settings.tamperingMoraleWeight +
    stalled * settings.tamperingMomentumWeight -
    lockedIn * settings.tamperingContractLengthResistance -
    ironClad -
    noCompete +
    dislikesUs +
    drawnThere +
    wantsUp;

  // Attitude cuts both ways: a professional honours the deal, a mercenary
  // was always going to take the call.
  const professionalism = (wrestler.attitude / 100) * settings.tamperingAttitudeResistance;

  // And a general loyalty multiplier for the traits that are not about any
  // one term — Grateful For The Work is simply hard to move, in every
  // direction, whatever the offer looks like.
  return clamp((raw - professionalism) * temptationWeight(wrestler), 0, 1);
}

export interface TamperingContext {
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

/**
 * Roll this week's approaches. Richer, better-regarded rivals come calling
 * more often — losing your top guy to the biggest promotion in the country
 * should feel different from losing him to a regional outfit.
 */
export function rollTamperingAttempts(rng: Rng, ctx: TamperingContext): TamperingAttempt[] {
  const attempts: TamperingAttempt[] = [];
  const { settings } = ctx;

  for (const rival of ctx.rivals) {
    const aggression = (rival.rating / 100) * settings.poachingAggression;

    for (const wrestler of ctx.roster) {
      const appeal = poachingAppeal(wrestler, ctx.statusOf(wrestler));
      if (appeal <= 0) continue;

      const probability = clamp(appeal * aggression * settings.tamperingBaseChance, 0, 0.6);
      if (!chance(rng, probability)) continue;

      const weeksLeft = wrestler.contract?.weeksRemaining ?? 0;
      const underContract = weeksLeft > 0;

      // A rival only risks tampering when the prize is worth it.
      if (underContract && appeal < settings.tamperingAppealThreshold) continue;

      const currentRate = wrestler.contract?.weeklyRate ?? settings.ticketPriceBase * 100;
      const premium = Math.round(
        currentRate * (settings.tamperingOfferPremiumMin + appeal * settings.tamperingOfferPremiumRange),
      );

      const partner = wrestler.attachedTo ? ctx.wrestlerById?.(wrestler.attachedTo) : undefined;
      const suitor: Suitor = { promotionId: rival.id, partnerPromotionId: partner?.promotionId ?? null };

      attempts.push({
        wrestlerId: wrestler.id,
        rivalPromotionId: rival.id,
        kind: underContract ? 'tampering' : 'approach',
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
