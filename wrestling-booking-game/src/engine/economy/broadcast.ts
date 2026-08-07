// Television and sponsorship money — §14.
//
// Both work the same way and so live together: somebody offers you a weekly
// cheque, the cheque comes with conditions, and if you miss the conditions for
// long enough the cheque stops. What makes it a system rather than an income
// line is that the conditions constrain booking, and the biggest cheques
// constrain it most.
//
// The cliff is deliberate. A network fee is several times the gate at every
// tier, so losing one is not a setback, it is a hole — and the four weeks of
// grace before it happens is the window the player has to notice and fix it.
//
// Nothing here mutates. Everything is read off the world and answered with a
// decision the store applies.

import type { Broadcaster } from '../../data/broadcasters';
import type { Sponsor } from '../../data/sponsors';
import { bestBroadcasterFor, broadcasterById } from '../../data/broadcasters';
import { SPONSORS, sponsorsConflict } from '../../data/sponsors';
import { clamp } from '../rng';
import type { WorldSettings } from '../types';

/** What the promotion looks like this week, as far as a paymaster cares. */
export interface BusinessSnapshot {
  companyRating: number;
  /** What the show actually drew in the slot this week. */
  tvRating: number;
  hardcoreSaturation: number;
  averageAttendance: number;
  /** The most popular wrestler on the roster, 0-100. */
  topStarPopularity: number;
  /** Shows run in the last four weeks. */
  showsThisMonth: number;
  /** Pay-per-views run in the last quarter. */
  ppvsThisQuarter: number;
}

/** A demand that is currently not being met, and why. */
export interface Breach {
  text: string;
  /** What they wanted, and what they are looking at. */
  wanted: number;
  actual: number;
}

export function broadcastBreaches(deal: Broadcaster, snapshot: BusinessSnapshot): Breach[] {
  const breaches: Breach[] = [];
  for (const demand of deal.demands) {
    switch (demand.kind) {
      case 'maintainRating':
        if (snapshot.companyRating < demand.value) {
          breaches.push({ text: demand.text, wanted: demand.value, actual: snapshot.companyRating });
        }
        break;
      case 'maintainTvRating':
        // Measured on what the slot actually did, not on standing. A
        // promotion can be well regarded and still not be watched.
        if (snapshot.tvRating < demand.value) {
          breaches.push({ text: demand.text, wanted: demand.value, actual: snapshot.tvRating });
        }
        break;
      case 'hardcoreCeiling':
        if (snapshot.hardcoreSaturation > demand.value) {
          breaches.push({ text: demand.text, wanted: demand.value, actual: snapshot.hardcoreSaturation });
        }
        break;
      case 'showsPerMonth':
        if (snapshot.showsThisMonth < demand.value) {
          breaches.push({ text: demand.text, wanted: demand.value, actual: snapshot.showsThisMonth });
        }
        break;
      case 'ppvPerQuarter':
        if (snapshot.ppvsThisQuarter < demand.value) {
          breaches.push({ text: demand.text, wanted: demand.value, actual: snapshot.ppvsThisQuarter });
        }
        break;
    }
  }
  return breaches;
}

export function sponsorBreaches(sponsor: Sponsor, snapshot: BusinessSnapshot): Breach[] {
  const breaches: Breach[] = [];
  for (const condition of sponsor.conditions) {
    switch (condition.kind) {
      case 'hardcoreCeiling':
        if (snapshot.hardcoreSaturation > condition.value) {
          breaches.push({ text: condition.text, wanted: condition.value, actual: snapshot.hardcoreSaturation });
        }
        break;
      case 'hardcoreFloor':
        if (snapshot.hardcoreSaturation < condition.value) {
          breaches.push({ text: condition.text, wanted: condition.value, actual: snapshot.hardcoreSaturation });
        }
        break;
      case 'minAttendance':
        if (snapshot.averageAttendance < condition.value) {
          breaches.push({ text: condition.text, wanted: condition.value, actual: snapshot.averageAttendance });
        }
        break;
      case 'marketableStar':
        if (snapshot.topStarPopularity < condition.value) {
          breaches.push({ text: condition.text, wanted: condition.value, actual: snapshot.topStarPopularity });
        }
        break;
    }
  }
  return breaches;
}

/**
 * Whether a network would offer, given a rating that has been *held* rather
 * than touched once. The sustained requirement is what stops a single hot
 * pay-per-view buying a national deal.
 */
export function broadcastOffer(
  companyRating: number,
  weeksAtRating: number,
  currentDealId: string | null,
  settings: WorldSettings,
): Broadcaster | null {
  if (weeksAtRating < settings.broadcastWeeksToQualify) return null;
  const best = bestBroadcasterFor(companyRating);
  if (!best) return null;
  // Never offer sideways or down. A promotion does not get talked into a
  // worse deal than the one it already has.
  const current = currentDealId ? broadcasterById(currentDealId) : undefined;
  if (current && best.tier <= current.tier) return null;
  return best;
}

/**
 * Which sponsors would come to the table, given who is already signed. A
 * sponsor that conflicts with one you have is not on offer — they read the
 * room before they call.
 */
export function availableSponsors(
  companyRating: number,
  signedIds: readonly string[],
  snapshot: BusinessSnapshot,
  settings: WorldSettings,
): Sponsor[] {
  // There is only so much banner. Without a cap the player simply takes every
  // brand that will have them, and "which sponsor is this company for" stops
  // being a question — which was the whole reason for giving them conflicting
  // conditions in the first place.
  if (signedIds.length >= settings.maxSponsors) return [];

  const signed = signedIds.map((id) => SPONSORS.find((s) => s.id === id)).filter((s): s is Sponsor => Boolean(s));
  return SPONSORS.filter((sponsor) => {
    if (signedIds.includes(sponsor.id)) return false;
    if (companyRating < sponsor.requiresRating) return false;
    if (signed.some((other) => sponsorsConflict(sponsor, other))) return false;
    // They will not sign to a condition you are already failing.
    return sponsorBreaches(sponsor, snapshot).length === 0;
  });
}

/**
 * What a week of deals is worth.
 *
 * A network pays for eyeballs. The rights fee is a floor — they signed a
 * contract — but the rest moves with the rating you actually delivered
 * against the one they signed you expecting. Beat it and they pay more; miss
 * it and they pay less.
 *
 * This exists because the TV rating used to be a scoreboard with nothing
 * behind it: computed every week, charted against the networks' other
 * programmes, and read by no money path in the game. The number the game
 * calls "what the whole business is judged by" now decides something.
 *
 * Sponsors stay flat. They are buying a banner in a building, not a slot.
 */
export function weeklyBroadcastIncome(
  deal: Broadcaster | null,
  sponsors: readonly Sponsor[],
  tvRating: number,
  settings: WorldSettings,
): number {
  const sponsorMoney = sponsors.reduce((sum, s) => sum + s.weeklyFee, 0);
  if (!deal) return sponsorMoney;

  const delivered = tvRating / Math.max(deal.expectedRating, 0.01);
  const swing = clamp(
    (delivered - 1) * settings.broadcastRatingSensitivity,
    -settings.broadcastRatingDownside,
    settings.broadcastRatingUpside,
  );

  return Math.round(deal.weeklyFee * (1 + swing)) + sponsorMoney;
}

/** What the network is paying against what they hoped, in words. */
export type BroadcastVerdict = 'Below the guarantee' | 'Short of expectations' | 'Meeting the deal' | 'Beating the deal';

export function broadcastVerdict(deal: Broadcaster | null, tvRating: number): BroadcastVerdict | null {
  if (!deal) return null;
  const delivered = tvRating / Math.max(deal.expectedRating, 0.01);
  if (delivered < 0.75) return 'Below the guarantee';
  if (delivered < 0.95) return 'Short of expectations';
  if (delivered < 1.1) return 'Meeting the deal';
  return 'Beating the deal';
}

/** How long a paymaster tolerates a breach before walking. */
export function shouldWalk(weeksInBreach: number, settings: WorldSettings): boolean {
  return weeksInBreach >= settings.broadcastWeeksOfGrace;
}
