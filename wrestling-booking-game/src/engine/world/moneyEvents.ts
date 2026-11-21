// Chance cards — small, one-off financial swings that aren't part of any
// bigger story. A rival merging or a network realigning is a headline that
// changes the shape of the business; this is the much smaller, much more
// frequent thing sitting next to it in the same weekly roll (see
// data/worldStories.ts's 'moneyEvent' entry): something happens, the bank
// balance moves a little, the wire says why, and the week moves on.
//
// Sized as a slice of whatever the promotion is currently sitting on rather
// than a flat number, so a windfall or a setback both still feel like
// something at any stage of a save — but hard-clamped on both ends
// (moneyEventMinAmount/moneyEventMaxAmount) so a single card can never solve
// a real problem or cause one by itself. A promotion sitting on a struggling
// bank balance still gets a proportionate card, not a trivial one — the
// reference floor (moneyEventReferenceFloor) keeps a near-zero or negative
// balance from producing an amount too small to notice, or dividing by
// nothing.
//
// Deliberately lighter-weight than the rest of the world-story pool: no
// `eligible` gate beyond a starting-week floor, no per-rival "already
// happened to them" tracking, and it never targets anybody — it happens to
// the player's own promotion, full stop. The weight given to it in
// data/worldStories.ts is kept low relative to the real stories so that on
// the rare week both are eligible and both roll true, a genuine story still
// tends to win the tie-break rather than getting buried under a chance card.

import type { Rng } from '../rng';
import { clamp, randFloat, weightedPick } from '../rng';
import type { WorldSettings } from '../types';

export function eligibleForMoneyEvent(week: number, settings: WorldSettings): boolean {
  return week >= settings.moneyEventEarliestWeek;
}

export interface MoneyEventDefinition {
  id: string;
  weight: number;
  /** Positive = windfall, negative = setback. */
  sign: 1 | -1;
  /** The wire line, with the settled dollar amount already in words. */
  line(amount: number): string;
}

export const MONEY_EVENTS: MoneyEventDefinition[] = [
  // ---------------------------------------------------------------- windfalls
  {
    id: 'reRunLicensing',
    weight: 3,
    sign: 1,
    line: (a) =>
      `A rival network licensed some old footage for a rerun package — a quiet $${a.toLocaleString()} check for tape that was just sitting in a vault.`,
  },
  {
    id: 'oldGearAuction',
    weight: 3,
    sign: 1,
    line: (a) =>
      `Cleared out a storage unit of retired production gear nobody remembered owning — $${a.toLocaleString()} at auction.`,
  },
  {
    id: 'tourismGrant',
    weight: 2,
    sign: 1,
    line: (a) => `The local tourism board kicked in a hosting grant for bringing a show through town — $${a.toLocaleString()}.`,
  },
  {
    id: 'venueDiscount',
    weight: 2,
    sign: 1,
    line: (a) => `The building's owner turned out to be a real fan of the promotion and comped part of the rent — $${a.toLocaleString()} back.`,
  },
  {
    id: 'merchBonus',
    weight: 3,
    sign: 1,
    line: (a) => `The merch vendor overbought and paid a bonus just to keep the exclusive — $${a.toLocaleString()}.`,
  },
  {
    id: 'insurancePayout',
    weight: 2,
    sign: 1,
    line: (a) => `An old injury claim finally cleared — the insurance payout landed, $${a.toLocaleString()}.`,
  },
  {
    id: 'charitySurplus',
    weight: 2,
    sign: 1,
    line: (a) => `A local business matched the gate on an old charity night, months after the fact — $${a.toLocaleString()} nobody was expecting.`,
  },
  {
    id: 'unclaimedRoyalty',
    weight: 2,
    sign: 1,
    line: (a) => `An old licensing royalty nobody ever chased down finally got paid out — $${a.toLocaleString()}.`,
  },
  {
    id: 'viralMoment',
    weight: 3,
    sign: 1,
    line: (a) => `An unplanned moment from a recent show went viral, and merch spiked for the week — $${a.toLocaleString()} extra through the online store.`,
  },
  {
    id: 'minorityInvestor',
    weight: 2,
    sign: 1,
    line: (a) => `A well-off mark bought in as a silent minority investor — $${a.toLocaleString()}, no strings attached.`,
  },
  // ---------------------------------------------------------------- setbacks
  {
    id: 'gearTheft',
    weight: 3,
    sign: -1,
    line: (a) => `Somebody broke into the truck overnight — gear gone, $${a.toLocaleString()} to replace it.`,
  },
  {
    id: 'taxAudit',
    weight: 2,
    sign: -1,
    line: (a) => `An audit came back owing back taxes — $${a.toLocaleString()}, paid in full and quietly.`,
  },
  {
    id: 'fanInjurySettlement',
    weight: 2,
    sign: -1,
    line: (a) => `A fan hurt in the crowd at a recent show settled out of court — $${a.toLocaleString()}, cheaper than the alternative.`,
  },
  {
    id: 'bouncedCheck',
    weight: 3,
    sign: -1,
    line: (a) => `A sponsor's check bounced, and chasing it down cost more than it was worth — $${a.toLocaleString()} written off.`,
  },
  {
    id: 'insuranceHike',
    weight: 2,
    sign: -1,
    line: (a) => `The insurance premium jumped after a rough stretch of injuries — $${a.toLocaleString()} more this year.`,
  },
  {
    id: 'buildingDamage',
    weight: 2,
    sign: -1,
    line: (a) => `A pipe burst in the building between shows — $${a.toLocaleString()} in emergency repairs before the next one.`,
  },
  {
    id: 'promoterSkip',
    weight: 2,
    sign: -1,
    line: (a) => `A local promoter running a house show skipped town before paying out the gate — $${a.toLocaleString()} gone.`,
  },
  {
    id: 'counterfeitMerch',
    weight: 2,
    sign: -1,
    line: (a) => `Counterfeit shirts were being sold outside the building all night — $${a.toLocaleString()} off the real merch numbers.`,
  },
  {
    id: 'sponsorEmbarrassment',
    weight: 2,
    sign: -1,
    line: (a) => `A sponsor got embarrassed by something that had nothing to do with the promotion, and pulled funding mid-deal anyway — $${a.toLocaleString()} lost.`,
  },
  {
    id: 'ticketingBreach',
    weight: 2,
    sign: -1,
    line: (a) => `The ticketing vendor got breached — refunds owed to a batch of fans, $${a.toLocaleString()}.`,
  },
  {
    id: 'workersCompClaim',
    weight: 2,
    sign: -1,
    line: (a) => `An old workers' comp claim finally came due — $${a.toLocaleString()}.`,
  },
];

export function pickMoneyEvent(rng: Rng): MoneyEventDefinition {
  return weightedPick(rng, MONEY_EVENTS.map((e) => [e, e.weight] as const));
}

/**
 * The settled dollar amount, unsigned. A share of whatever the promotion is
 * currently sitting on (floored so a struggling or negative balance still
 * gets a proportionate card), jittered so the same event doesn't always cost
 * the same, then hard-clamped so it can never be a rounding error or a
 * disaster regardless of how rich or poor the promotion is.
 */
export function moneyEventAmount(rng: Rng, bankBalance: number, settings: WorldSettings): number {
  const reference = Math.max(bankBalance, settings.moneyEventReferenceFloor);
  const target = reference * settings.moneyEventShareOfBank;
  const jittered = target * randFloat(rng, 0.7, 1.3);
  const clamped = clamp(jittered, settings.moneyEventMinAmount, settings.moneyEventMaxAmount);
  return Math.round(clamped / 25) * 25;
}
