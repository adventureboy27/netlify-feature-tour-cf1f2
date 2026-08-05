// The fire sale.
//
// When a promotion closes, everything it had goes in one lot: the contracts,
// the championships and their lineage, the gear, and whatever was left in the
// bank. The surviving companies bid for the package, sealed, one round each.
//
// A package deal rather than a talent free-for-all, on purpose. Splitting a
// dead company's roster across six promotions is the boring outcome — nobody
// notices. One company swallowing the whole thing is a real event: overnight
// somebody has forty wrestlers, two world titles, and a payroll they may not
// be able to carry. That is a decision worth putting in front of the player,
// and a risk worth letting them take.
//
// The belts are the interesting part. A championship that comes over keeps
// its name and its entire lineage — Continental's world title is still the
// Continental World Heavyweight Title, defended in somebody else's ring, and
// the list of everybody who ever held it comes with it.

import type { Rng } from '../rng';
import { clamp, gaussian } from '../rng';
import type { Id, Promotion, Title, Wrestler, WorldSettings } from '../types';
import { identityOf, styleFit } from '../../data/promotionIdentity';

export interface AuctionLot {
  /** The company that closed. */
  fromPromotionId: Id;
  fromPromotionName: string;
  /** Everybody who was under contract there. */
  wrestlerIds: Id[];
  /** Every belt they owned, lineage intact. */
  titleIds: Id[];
  /** Cash left in the account. Negative balances are written off, not sold. */
  cash: number;
  /** What the lot is worth on paper, for the player to bid against. */
  appraisal: number;
}

export interface Bid {
  promotionId: Id;
  amount: number;
}

export interface AuctionResult {
  winnerId: Id | null;
  winningBid: number;
  bids: Bid[];
}

/**
 * What the package is worth. Talent is most of it — a championship with no
 * one to defend it is a leather strap — but a prestigious belt carries real
 * value because it is instant credibility.
 */
export function appraise(
  wrestlers: readonly Wrestler[],
  titles: readonly Title[],
  cash: number,
  settings: WorldSettings,
): number {
  const talent = wrestlers.reduce((sum, w) => sum + (w.popularity / 100) * settings.auctionValuePerStar, 0);
  const belts = titles.reduce((sum, t) => sum + (t.prestige / 100) * settings.auctionValuePerTitle, 0);
  return Math.round(talent + belts + Math.max(0, cash));
}

/**
 * What one promotion is willing to pay. Three things move it: what they can
 * afford, how much the talent suits their house style, and how badly they
 * need bodies. Nobody bids more than they have.
 */
export function aiBid(
  rng: Rng,
  bidder: Promotion,
  lot: AuctionLot,
  incoming: readonly Wrestler[],
  settings: WorldSettings,
): number {
  const identity = identityOf(bidder.identity);
  const fit =
    incoming.length === 0
      ? 0
      : incoming.reduce((sum, w) => sum + styleFit(identity, w.style), 0) / incoming.length;

  // How much they want it, before money enters into it.
  const roomOnTheRoster = clamp((settings.rivalRosterSizeMax - bidder.rosterIds.length) / settings.rivalRosterSizeMax, 0, 1);
  const appetite =
    settings.auctionBaseAppetite +
    fit * settings.auctionStyleFitAppetite +
    roomOnTheRoster * settings.auctionRosterRoomAppetite +
    (bidder.rating / 100) * settings.auctionAmbitionAppetite;

  const wanted = lot.appraisal * appetite * (1 + gaussian(rng, 0, settings.auctionBidVariance));
  // A company will not bet the business on it — there is a ceiling on how
  // much of the bank anyone will spend in one night.
  const ceiling = bidder.bankBalance * settings.auctionMaxBankFraction;

  return Math.max(0, Math.round(Math.min(wanted, ceiling)));
}

/**
 * Settle it. Highest bid takes the lot; a tie goes to the bigger company,
 * which is how it would actually go. A lot nobody bids the reserve on goes
 * unsold — the contracts lapse and everyone becomes a free agent.
 */
export function settleAuction(bids: readonly Bid[], lot: AuctionLot, settings: WorldSettings, standingOf: (id: Id) => number): AuctionResult {
  const reserve = lot.appraisal * settings.auctionReserveFraction;
  const valid = bids.filter((b) => b.amount >= reserve);

  const sorted = [...valid].sort((a, b) => b.amount - a.amount || standingOf(b.promotionId) - standingOf(a.promotionId));
  const winner = sorted[0];

  return {
    winnerId: winner?.promotionId ?? null,
    winningBid: winner?.amount ?? 0,
    bids: [...bids].sort((a, b) => b.amount - a.amount),
  };
}

/** The three things the player can do, and roughly what each costs. */
export type PlayerBidLevel = 'pass' | 'lowball' | 'fair' | 'aggressive';

export const BID_LEVEL_LABELS: Record<PlayerBidLevel, string> = {
  pass: 'Let it go',
  lowball: 'Lowball them',
  fair: 'Bid what it is worth',
  aggressive: 'Outbid everybody',
};

export function playerBidAmount(level: PlayerBidLevel, lot: AuctionLot, settings: WorldSettings): number {
  switch (level) {
    case 'pass':
      return 0;
    case 'lowball':
      return Math.round(lot.appraisal * settings.auctionLowballFraction);
    case 'fair':
      return Math.round(lot.appraisal * settings.auctionFairFraction);
    case 'aggressive':
      return Math.round(lot.appraisal * settings.auctionAggressiveFraction);
  }
}
