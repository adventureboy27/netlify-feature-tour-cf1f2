// How each kind of owner bids.
//
// The first version of the auction had every company bidding the same way:
// asking rate times keenness, plus noise. Which meant the field was one
// number with a wobble on it, and no company ever behaved like a company. A
// penny-pincher and a star-chaser both stretched to 1.4x and both handed over
// the same sweeteners.
//
// Every promotion already has an `ownerPersonality`, and it already biases
// what they demand of the booker. This is the same five people deciding what
// to spend, which is the other half of the same character.
//
// The `stretch` spread is deliberately narrower than it first looks. An early
// version ran from 0.95 to 1.75, and measured against a mixed field the
// star-chaser won ninety-four per cent of every auction for an established
// name: the money gap it opened was larger than the clause, term and standing
// axes put together, so nothing else in the model could ever matter. Kept
// inside about half a turn of the money dial, the other four have something
// to beat it with.
//
// The important field is `prudence`, and it is the one that keeps bids honest.
// Somebody signs these cheques and that somebody has a job. A booker who
// empties the account on one contract is out of work by spring, so every
// company keeps a runway it will not touch, and the cautious ones keep more.
// That is why the field does not spiral: nobody in the room is bidding with
// money they do not have.

import type { OwnerPersonality } from '../engine/types';

export interface Temperament {
  /** What this company is like in a negotiation, for the result screen. */
  label: string;
  /**
   * The most they will offer, as a multiple of what the business reckons
   * somebody is worth. Above 1 is paying over the odds.
   */
  stretch: number;
  /**
   * 0-1. How much they pay for what somebody will become rather than what
   * they are tonight. A win-now company barely counts potential; a company
   * building for five years pays for it.
   */
  future: number;
  /** 0-1. How readily they hand over clauses instead of money. */
  generosity: number;
  /** 0-1. Appetite for paying up front rather than weekly. */
  bonusAppetite: number;
  /** 0 short deals .. 1 long deals. */
  termBias: number;
  /**
   * 0-1. How much of the company they refuse to risk. High prudence keeps a
   * long runway and will walk away from a bidding war rather than gamble the
   * building on one signing.
   */
  prudence: number;
  /** Bid-to-bid variance. A steady operator is predictable; a showman is not. */
  nerve: number;
}

export const TEMPERAMENTS: Record<OwnerPersonality, Temperament> = {
  // Spends whatever it takes for a name, today, and worries about it later.
  // The one that will genuinely overpay — and the one that gets into trouble.
  starChaser: {
    label: 'chases names',
    stretch: 1.5,
    future: 0.2,
    generosity: 0.85,
    bonusAppetite: 0.8,
    termBias: 0.35,
    prudence: 0.25,
    nerve: 0.11,
  },
  // Will not be beaten on flash, and pays up front because a signing is an
  // announcement. Slightly less reckless than the star-chaser, and keener on
  // charisma than on anything else.
  showman: {
    label: 'likes an announcement',
    stretch: 1.4,
    future: 0.35,
    generosity: 0.7,
    bonusAppetite: 0.95,
    termBias: 0.4,
    prudence: 0.4,
    nerve: 0.12,
  },
  // Long deals, young talent, and a firm ceiling. Loses most auctions for
  // established stars and wins more than its share for prospects.
  traditionalist: {
    label: 'builds slowly',
    stretch: 1.22,
    future: 0.85,
    generosity: 0.45,
    bonusAppetite: 0.25,
    termBias: 0.9,
    prudence: 0.7,
    nerve: 0.06,
  },
  // Pays for people who can take a beating, on middling terms, and does not
  // get carried away.
  hardcore: {
    label: 'pays for grit',
    stretch: 1.28,
    future: 0.4,
    generosity: 0.5,
    bonusAppetite: 0.4,
    termBias: 0.5,
    prudence: 0.55,
    nerve: 0.09,
  },
  // Turns up, offers what somebody is worth and not a dollar more, and goes
  // home. Wins auctions only when everybody else has priced themselves out —
  // which does happen, because everybody else keeps overpaying.
  pennyPincher: {
    label: 'counts every dollar',
    stretch: 1.02,
    future: 0.5,
    generosity: 0.2,
    bonusAppetite: 0.1,
    // Long, cheap, locked in. The whole strategy.
    termBias: 0.95,
    prudence: 0.9,
    nerve: 0.05,
  },
};

export function temperamentOf(personality: OwnerPersonality): Temperament {
  return TEMPERAMENTS[personality] ?? TEMPERAMENTS.traditionalist;
}
