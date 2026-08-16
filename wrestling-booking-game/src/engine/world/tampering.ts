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
import type { Wrestler, Promotion, WorldSettings, CareerStatus } from '../types';
import { isPoachingTarget } from '../career/status';

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
 * How temptable a wrestler is by a given offer. Loyalty is bought with money
 * *and* with booking — a wrestler who is paid well and pushed well is hard to
 * move, and one who is paid well and buried is not.
 */
export function temptation(
  wrestler: Wrestler,
  offerPremium: number,
  weeksLeftOnDeal: number,
  settings: WorldSettings,
): number {
  const currentRate = wrestler.contract?.weeklyRate ?? 0;
  const money = currentRate > 0 ? clamp(offerPremium / currentRate, 0, 2) / 2 : 1;

  const unhappy = 1 - wrestler.morale / 100;
  const stalled = 1 - wrestler.momentum / 100;

  // A long deal is a real deterrent; a short one barely registers.
  const lockedIn = clamp(weeksLeftOnDeal / settings.contractLengthDefault, 0, 1);

  const clauses = wrestler.contract?.clauses ?? [];
  const ironClad = clauses.includes('ironClad') ? settings.tamperingIronCladResistance : 0;
  const noCompete = clauses.includes('noCompete') ? settings.tamperingNoCompeteResistance : 0;

  const raw =
    money * settings.tamperingMoneyWeight +
    unhappy * settings.tamperingMoraleWeight +
    stalled * settings.tamperingMomentumWeight -
    lockedIn * settings.tamperingContractLengthResistance -
    ironClad -
    noCompete;

  // Attitude cuts both ways: a professional honours the deal, a mercenary
  // was always going to take the call.
  const professionalism = (wrestler.attitude / 100) * settings.tamperingAttitudeResistance;

  return clamp(raw - professionalism, 0, 1);
}

export interface TamperingContext {
  roster: readonly Wrestler[];
  statusOf: (wrestler: Wrestler) => CareerStatus;
  rivals: readonly Promotion[];
  currentWeek: number;
  settings: WorldSettings;
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

      attempts.push({
        wrestlerId: wrestler.id,
        rivalPromotionId: rival.id,
        kind: underContract ? 'tampering' : 'approach',
        offerPremium: premium,
        temptation: temptation(wrestler, premium, weeksLeft, settings),
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
