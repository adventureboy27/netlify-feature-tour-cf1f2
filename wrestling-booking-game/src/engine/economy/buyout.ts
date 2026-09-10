// The blind bulk buyout — a rival's offer while the promotion is genuinely
// drowning, not a trading market.
//
// Grew directly out of a conversation with the player about the loan system
// in economy/loan.ts, and the shape of it answers a specific worry they
// raised: wrestling doesn't have real transfer fees, and a general "sell a
// contract for cash" mechanic would just become sign-cheap-develop-and-flip,
// a strategy from a completely different kind of game. Two things close
// that off, agreed explicitly:
//
//   1. It only ever fires while the promotion is already in real trouble —
//      see maybeOfferBuyout in state/storeHelpers.ts, gated on an active
//      loan. Nobody signs a prospect hoping to go bankrupt later so they can
//      cash out; the gate itself makes that not a strategy.
//   2. The booker never chooses who goes. A rival offers a flat sum for a
//      fixed *number* of contracts, and only finds out who once they say
//      yes — "could be five crappy ones, could be five champions." That is
//      the whole tension, and it is also what makes the mechanic impossible
//      to target: there is nothing to develop-and-sell if you cannot choose
//      what gets sold.
//
// The price is deliberately not derived from the wrestlers actually taken,
// even after the fact — anchored to the *selling* promotion's own weekly
// payroll instead, with real randomness on top, so there is no formula a
// player could reverse-engineer into "is this a good deal." The dollars do
// not have to make sense against what gets taken. That was the point.

import type { Rng } from '../rng';
import { randFloat, clamp } from '../rng';
import type { WorldSettings } from '../types';

export interface BuyoutTerms {
  /** How many contracts the rival will take. Known up front. */
  count: number;
  /** The flat sum on offer. Not derived from who is taken. */
  price: number;
}

/**
 * What a rival would offer this week, if one is about to. Pure: the caller
 * decides whether to actually roll this (the weekly chance, and whether the
 * promotion is distressed enough to draw an offer at all) and which rival
 * can afford it.
 */
export function rollBuyoutTerms(
  rng: Rng,
  weeklyPayroll: number,
  rosterSize: number,
  settings: WorldSettings,
): BuyoutTerms {
  const fraction = randFloat(rng, settings.buyoutCountFractionMin, settings.buyoutCountFractionMax);
  // Never the whole roster and never nobody — there always has to be a
  // company left on the other side of this decision. And never more than
  // buyoutCountMax outright, whatever the roster's size: a buyout is a
  // chunk taken out of the company, not a way to gut an oversized roster in
  // one offer.
  const upperBound = Math.min(settings.buyoutCountMax, Math.max(1, rosterSize - 1));
  const count = clamp(Math.round(rosterSize * fraction), settings.buyoutCountMin, upperBound);
  const multiplier = randFloat(rng, settings.buyoutPriceMultiplierMin, settings.buyoutPriceMultiplierMax);
  const price = Math.max(1, Math.round(weeklyPayroll * multiplier));
  return { count, price };
}
