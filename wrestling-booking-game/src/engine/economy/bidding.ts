// The bidding war.
//
// Almost every signing in this game is a private transaction: somebody's deal
// runs out, you offer them a number, they take it or they don't. This module
// is the exception, and it is deliberately rare. When a genuine star reaches
// the open market — or when the schools turn out somebody who is obviously
// going to be one — every promotion that can afford him finds out at the same
// time, and the thing turns into an auction.
//
// ---------------------------------------------------------------------------
// One shot
//
// The rule that makes this interesting is that there are no counter-offers.
// Everybody submits once, blind, and the wrestler picks. No round two, no
// "they've come back with more, do you want to go again". You commit a number
// against people whose numbers you cannot see, and then you find out.
//
// That is also why the player is asked to opt in first. Saying no is a real
// choice with a real cost — you are not merely declining to bid, you are out,
// and the man signs somewhere else while you watch. §0 says the game never
// warns before a bad decision, so there is no hint about whether your offer is
// competitive, and no probability anywhere: the whole point is not knowing.
//
// ---------------------------------------------------------------------------
// It is not only about money
//
// A promotion with a thinner chequebook can still win. What a wrestler is
// actually weighing:
//
//   money        the weekly rate against what they believe they are worth
//   the bonus    cash today, which is worth more to somebody young or broke
//   the term     security if they are old, a cage if their ego says they will
//                be worth more in eighteen months
//   the clauses  the ones that matter to *this* person — insurance to somebody
//                who has been hurt, creative control to somebody who thinks
//                they are the draw, a merchandise cut to somebody who moves
//                shirts
//   the company  whether it is somewhere worth being
//   the people   allies pull, enemies push
//   the map      a promotion that runs their home town
//
// So the counter to a rival with deeper pockets is knowing the person better
// than they do.

import type { Rng } from '../rng';
import { chance, clamp, gaussian } from '../rng';
import type { Clause, Id, Promotion, Relationship, Wrestler, WorldSettings } from '../types';
import { askingRate } from './contracts';
import { CLAUSE_LADDER, clauseLabel } from '../career/ego';
import { temperamentOf, type Temperament } from '../../data/biddingTemperaments';
import { isAlly, isEnemy, otherParty } from '../career/relationships';

// ---------------------------------------------------------------------------
// What an offer is

export interface Bid {
  promotionId: Id;
  /** Denormalised: a company can fold between the bid and the retelling. */
  promotionName: string;
  weeklyRate: number;
  /** Paid once, on signing. Comes straight off the bank. */
  signingBonus: number;
  /** Term in weeks. */
  weeks: number;
  clauses: Clause[];
}

export type BiddingStage =
  /** The player has been asked whether they want in, and has not answered. */
  | 'invited'
  /** The player is in, and composing an offer. Nobody has bid yet. */
  | 'bidding'
  /** Everything is submitted and the wrestler has chosen. */
  | 'settled';

export interface BiddingWar {
  id: Id;
  wrestlerId: Id;
  /** Denormalised so the result reads correctly however the world moves on. */
  wrestlerName: string;
  /** Why this person is worth an auction. */
  reason: BiddingReason;
  openedWeek: number;
  stage: BiddingStage;
  /**
   * Whether the player took the invitation. Null while unanswered. False
   * locks them out — there is no changing your mind once the room has been
   * told you are not bidding.
   */
  playerIn: boolean | null;
  /**
   * The floor their people announced, in dollars a week. Public from the
   * moment the room opens: it is what the booker is told before they decide
   * whether to be in it, and it is what emptied the room of everybody who
   * could not say yes.
   */
  minimum: number;
  /** Which round of offers this is. Only a wrestler can call for another. */
  round: number;
  /** Why they sent the room away, when they did. Shown on the second ask. */
  reBidReason: string | null;
  /** Every rival that is in. Their bids are not visible until it settles. */
  rivalIds: Id[];
  bids: Bid[];
  /** Set when it settles. */
  result: BiddingResult | null;
}

export type BiddingReason =
  /** A star whose contract has run out and who is now on the open market. */
  | 'freeAgentStar'
  /** A school leaver who came out with a professional's tools. */
  | 'phenom';

export interface BiddingResult {
  winningPromotionId: Id;
  winningPromotionName: string;
  /** The bid that won, so the contract can be written from it. */
  bid: Bid;
  /** Every bid, revealed. The player only ever sees these afterwards. */
  allBids: Bid[];
  /**
   * Offers that were never in it, and why. A refusal is not a low score — it
   * is an envelope that was never opened, and the result screen says so.
   */
  vetoed: { bid: Bid; reason: string }[];
  /** What actually swung it, in words. Never a number and never a percentage. */
  swungIt: string;
}

// ---------------------------------------------------------------------------
// Who is worth an auction

/**
 * A star, by the standard that makes an auction plausible: over enough that
 * every company in the business would take the call.
 */
export function worthAnAuction(wrestler: Wrestler, settings: WorldSettings): boolean {
  if (wrestler.deceased || wrestler.careerStatus === 'retired') return false;
  if (wrestler.role !== 'wrestler') return false;
  if (wrestler.popularity >= settings.biddingStarPopularity) return true;
  // ...or somebody who has not proved it yet but plainly will. This is the
  // door the phenom comes through, and it is why a graduate with nothing on
  // his record can still start a war.
  return wrestler.hype >= settings.biddingProspectTalent && wrestler.age <= settings.biddingProspectAge;
}

/** Can this company sign anybody at all right now? */
export function canBid(promotion: Promotion, banned: boolean): boolean {
  return promotion.closedWeek === null && !banned;
}

/**
 * Which promotions want them and can pay.
 *
 * Interest is not the same as being able to afford it — a company on its knees
 * does not enter an auction for a main-eventer, however much it would like to.
 * The bar is deliberately about *headroom* rather than the balance, so a rich
 * company with a bloated payroll can still be priced out.
 */
export function interestedIn(
  wrestler: Wrestler,
  promotions: readonly Promotion[],
  ctx: {
    weeklyPayroll: (promotionId: Id) => number;
    banned: (promotionId: Id) => boolean;
    /** The announced floor. A company that cannot reach it is not in the room. */
    minimum: number;
  },
  settings: WorldSettings,
): Promotion[] {
  return promotions.filter((promotion) => {
    if (!canBid(promotion, ctx.banned(promotion.id))) return false;
    // Measured with the same runway maths the bid itself uses, so a company
    // that turns up cannot then bid the floor. Two different affordability
    // checks put ghost bidders in the room: broke companies entered on the
    // looser test and then offered the statutory minimum, which is not an
    // offer, it is noise on the result screen.
    //
    // The announced minimum does this job on its own now, and it does it in
    // public: a number somebody has earned the right to name empties the room
    // of everybody who cannot say yes to it, including the office that
    // currently employs them.
    const mood = temperamentOf(promotion.ownerPersonality);
    const ceiling = bidCeiling(promotion, ctx.weeklyPayroll(promotion.id), mood, settings);
    if (ceiling < ctx.minimum) return false;
    if (promotion.rosterIds.includes(wrestler.id)) {
      // The current employer is in if they can pay — they are the ones about
      // to lose him, and they fight for him like everybody else.
      return true;
    }
    // And they have to actually want him: somebody who would not improve the
    // top of their card is not worth an auction to them.
    return wrestler.popularity >= promotion.rating * settings.biddingWantsThreshold;
  });
}

// ---------------------------------------------------------------------------
// What somebody is worth

/**
 * The number the business roughly agrees on.
 *
 * `askingRate` is what the *wrestler* wants. This is what a buyer thinks they
 * are buying, and the two are not the same person's opinion. Every bid in the
 * room anchors here, which is what stops the auction being a number with a
 * wobble on it: companies differ by how far over this they will go and by how
 * much of it they pay for the future rather than the present, not by luck.
 *
 * `future` is the buyer's own appetite for potential — a company building for
 * five years pays for a twenty-two-year-old's ceiling, a win-now company
 * barely counts it.
 */
export function marketValue(wrestler: Wrestler, future: number, settings: WorldSettings): number {
  const s = settings;
  const ask = askingRate(wrestler, s);

  // What they are tonight: how over they are, and whether they are trending.
  const present = clamp(wrestler.popularity / 100, 0, 1);
  // What they might be: the hidden ceiling, worth less the older they get,
  // and worth nothing at all once there is no time left to reach it.
  const runway = clamp((s.biddingCeilingAge - wrestler.age) / (s.biddingCeilingAge - 18), 0, 1);
  // Reputation, not truth. A room full of companies bidding on somebody's
  // real hidden ceiling could never be wrong about anybody.
  const potential = clamp(wrestler.hype / 100, 0, 1) * runway;

  const blend = present * (1 - future) + potential * future;
  // Around the asking rate for somebody exactly average on that blend, and up
  // or down from there. A wreck of a body is worth less than the same career
  // on a fit one, whatever the record says.
  const condition = 1 - (1 - wrestler.health / 100) * s.biddingDamageDiscount;
  const form = 1 + ((wrestler.momentum - 50) / 100) * s.biddingMomentumSwing;

  const value = ask * (s.biddingValueFloor + blend * s.biddingValueRange) * condition * form;
  return Math.max(s.contractBaseWeeklyRate, Math.round(value / 25) * 25);
}

/**
 * The number their people put out before anybody bids.
 *
 * This is announced with the invitation and it is the floor: an offer under it
 * is not a low offer, it is not an offer. How a company gets over the line —
 * weekly money, cash up front, insurance, creative control — is entirely
 * theirs to decide.
 *
 * It does two jobs at once. It tells the booker what the ticket costs before
 * they decide whether to be in the room at all, which is the honest version of
 * the thing a blind auction otherwise hides. And it thins the field by itself:
 * a modest number brings the whole business in, and a number somebody has
 * earned the right to name leaves three companies who can even talk.
 *
 * The roll is small and seeded. Two identical wrestlers do not name the same
 * figure, because the number is what somebody's people *decided to say*, not a
 * readout of their stats — and a minimum the player could compute exactly
 * would turn the whole auction back into arithmetic.
 */
export function askingMinimum(rng: Rng, wrestler: Wrestler, settings: WorldSettings): number {
  const s = settings;
  const value = marketValue(wrestler, s.biddingSelfRegardFuture, s);
  // What somebody thinks they are worth is not what the business thinks. Ego
  // is the whole gap, and it is why a modest draw is often a better signing
  // than a slightly bigger one.
  const selfRegard = s.biddingMinimumBase + (wrestler.ego / 100) * s.biddingMinimumEgoRange;
  const nerve = 1 + gaussian(rng, 0, s.biddingMinimumNerve);
  return Math.max(s.contractBaseWeeklyRate, Math.round((value * selfRegard * nerve) / 25) * 25);
}

/** Said plainly, for the invitation. Never a percentage, never a probability. */
export function minimumLine(wrestler: Wrestler, minimum: number): string {
  return `${wrestler.name}'s people have named a number: nothing under $${minimum.toLocaleString()} a week gets read. How anybody gets there — the rate, money up front, what else they put on the table — is up to them.`;
}

// ---------------------------------------------------------------------------
// Who somebody will and will not work for

export type Stance =
  /** They will not sign there at any price. */
  | 'refuses'
  /** They will, but it costs more. */
  | 'premium'
  | 'neutral'
  /** They will take less to be there. */
  | 'discount';

export interface StanceRead {
  stance: Stance;
  /** What the same money is worth to them there. Below 1 is a discount. */
  multiplier: number;
  /** Said plainly, for the offer sheet and the result. Null when neutral. */
  reason: string | null;
}

const WARMTH: Partial<Record<Relationship['type'], string>> = {
  married: 'their husband or wife works there',
  dating: 'their partner works there',
  friend: 'a friend works there',
  sibling: 'their brother or sister works there',
  parentChild: 'family works there',
  mentor: 'the person who trained them works there',
  protege: 'somebody they trained works there',
};

const COLD: Partial<Record<Relationship['type'], string>> = {
  enemy: 'they cannot stand',
  divorced: 'they used to be married to',
  exPartner: 'they used to be with',
};

/**
 * What the people already in that locker room do to the price.
 *
 * This replaced a flat score bonus for allies and enemies, which was the wrong
 * shape: somebody does not think "that company is worth four more points
 * because my friend is there", they think "I will take less to work with him"
 * or "I am not going anywhere near her". Money is the language, and at the far
 * end there is no number at all.
 */
export function stanceToward(
  wrestler: Wrestler,
  promotionId: Id,
  roster: readonly Wrestler[],
  relationships: readonly Relationship[],
  settings: WorldSettings,
): StanceRead {
  const s = settings;
  // A company that has already done them wrong does not get a second look.
  if ((wrestler.grudges ?? []).includes(promotionId)) {
    return {
      stance: 'refuses',
      multiplier: Infinity,
      reason: 'they will not work for that office again',
    };
  }

  const inTheRoom = new Map(roster.map((w) => [w.id, w]));
  let warmth = 0;
  let chill = 0;
  let hardNo: string | null = null;
  let bestWarm: string | null = null;
  let worstCold: string | null = null;

  for (const bond of relationships) {
    if (bond.aId !== wrestler.id && bond.bId !== wrestler.id) continue;
    const other = inTheRoom.get(otherParty(bond, wrestler.id));
    if (!other) continue;

    if (isEnemy(bond)) {
      const how = COLD[bond.type] ?? 'they cannot stand';
      // Past a certain heat there is no price. This is the line the whole
      // feature turns on: an offer can be dead before it is opened.
      if (bond.strength >= s.biddingRefusalStrength) {
        hardNo = `they will not be on the same show as ${other.name}, somebody ${how}`;
      }
      chill += bond.strength / 100;
      if (!worstCold) worstCold = `${other.name} is somebody ${how}`;
    } else if (isAlly(bond)) {
      warmth += bond.strength / 100;
      if (!bestWarm) bestWarm = WARMTH[bond.type] ?? 'a friend works there';
    }
  }

  if (hardNo) return { stance: 'refuses', multiplier: Infinity, reason: hardNo };

  const net = warmth * s.biddingWarmthPull - chill * s.biddingChillPush;
  if (net >= s.biddingStanceDeadzone) {
    return {
      stance: 'discount',
      multiplier: Math.max(1 - s.biddingDiscountMax, 1 - net),
      reason: bestWarm,
    };
  }
  if (net <= -s.biddingStanceDeadzone) {
    return {
      stance: 'premium',
      multiplier: Math.min(1 + s.biddingPremiumMax, 1 - net),
      reason: worstCold ? `${worstCold} — it will cost more to get them there` : null,
    };
  }
  return { stance: 'neutral', multiplier: 1, reason: null };
}

// ---------------------------------------------------------------------------
// What a rival offers

/**
 * How badly a company wants this person, 0-1.
 *
 * Separate from what they can afford and from how they negotiate — this is
 * appetite alone. It scales the stretch their temperament allows, so a
 * penny-pincher who badly wants somebody still bids like a penny-pincher.
 */
export function keenness(
  wrestler: Wrestler,
  promotion: Promotion,
  settings: WorldSettings,
  /**
   * How good the roster they already have is, 0-100 — the mean of their best
   * few. A company with nobody wants somebody badly; a company whose top of
   * the card is already full is shopping rather than starving.
   */
  rosterStrength = promotion.rating,
): number {
  const s = settings;
  const mood = temperamentOf(promotion.ownerPersonality);
  // A star is worth more to a company he would headline than to one where he
  // would be fourth from the top.
  const lift = clamp((wrestler.popularity - promotion.rating) / 100, -0.5, 0.5);
  const upside = clamp((wrestler.hype - 50) / 100, -0.5, 0.5);
  const youth = clamp((s.biddingYouthPivot - wrestler.age) / 40, -0.4, 0.4);

  // Appetite is not only a matter of degree — a win-now company and a company
  // building for five years want *different people*. Valuing a prospect
  // higher was not enough on its own: the star-chaser's stretch swallowed the
  // builder's better valuation and won auctions for prospects it did not
  // even want. So the two halves of the read are weighted by temperament.
  const nowWeight = (1 - mood.future) * 2;
  const laterWeight = mood.future * 2;

  // Hunger. What a company already has is the other half of what it wants:
  // somebody with a thin top of the card will stretch for a name that a
  // stacked promotion would treat as a luxury.
  const hunger = clamp((s.biddingRosterFullAt - rosterStrength) / 100, -0.5, 0.5);

  return clamp(
    s.biddingKeennessBase +
      lift * s.biddingKeennessLift * nowWeight +
      upside * s.biddingKeennessUpside * laterWeight +
      youth * s.biddingKeennessYouth +
      hunger * s.biddingKeennessHunger,
    0.05,
    1,
  );
}

/** The mean of a roster's best few, which is what "how good are they" means. */
export function rosterStrengthOf(roster: readonly Wrestler[], settings: WorldSettings): number {
  const top = [...roster]
    .filter((w) => !w.deceased && w.careerStatus !== 'retired')
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, settings.biddingRosterTopN);
  if (top.length === 0) return 0;
  return top.reduce((sum, w) => sum + w.popularity, 0) / top.length;
}

/**
 * The most a company can put on the table without the person signing the
 * cheques losing their nerve — or their job.
 *
 * Nobody in this business bids with money they do not have. Whatever the
 * appetite, a promotion keeps a runway it will not touch, and a cautious one
 * keeps a longer one. The whole ceiling is expressed as a weekly rate: what
 * is left after the runway, spread over the term they are committing to.
 *
 * This is what stops the auction spiralling. Without it a keen company would
 * bid whatever its keenness told it to and be bankrupt by spring, which is
 * neither realistic nor any fun to lose to.
 */
export function bidCeiling(
  promotion: Promotion,
  weeklyPayroll: number,
  temperament: Temperament,
  settings: WorldSettings,
): number {
  const s = settings;
  // Weeks of trading the booker refuses to gamble. A prudent one wants half a
  // year in the bank before they will talk about anybody.
  const runwayWeeks = s.biddingRunwayWeeksMin + temperament.prudence * s.biddingRunwayWeeksRange;
  const committed = weeklyPayroll * runwayWeeks;
  const spare = promotion.bankBalance - committed;
  if (spare <= 0) return 0;
  return spare / runwayWeeks;
}

/**
 * A rival's one offer.
 *
 * Anchored on what the business reckons somebody is worth, shaped by the kind
 * of company it is, and clipped by what the booker can defend to the owner.
 */
export interface RivalBidContext {
  weeklyPayroll: number;
  /** The floor their people announced. Nobody bids under it and gets read. */
  minimum: number;
  /** How good the roster they already have is. Drives hunger. */
  rosterStrength?: number;
}

export function rivalBid(
  rng: Rng,
  wrestler: Wrestler,
  promotion: Promotion,
  ctx: RivalBidContext,
  settings: WorldSettings,
): Bid | null {
  const s = settings;
  const mood = temperamentOf(promotion.ownerPersonality);
  // Each company values them their own way: a builder pays for the ceiling, a
  // win-now company pays for the name on the poster.
  const value = marketValue(wrestler, mood.future, s);
  const want = keenness(wrestler, promotion, s, ctx.rosterStrength);

  // Appetite scales the stretch their temperament allows, so a keen
  // penny-pincher still bids like a penny-pincher.
  const nerve = 1 + gaussian(rng, 0, mood.nerve);

  // ...and then, once in a while, somebody decides this is the signing that
  // defines their year and goes to the wall for it.
  //
  // This is the thing that stops a rich player simply buying every auction.
  // Without it the field was predictable from the settings table: bid enough
  // over the top of what the temperaments allow and you win every time, which
  // makes an auction a purchase. A big swing is rare, it is capped by the same
  // runway as everything else — nobody bankrupts themselves — and it is drawn
  // per company per auction, so the player never knows which room they are in.
  const swinging = chance(rng, s.biddingBigSwingChance * (0.4 + want));
  const stretch = swinging ? mood.stretch * s.biddingBigSwingMultiple : mood.stretch;
  const wanted = value * (1 + (stretch - 1) * want) * nerve;

  const ceiling = bidCeiling(promotion, ctx.weeklyPayroll, mood, s);
  // A company that cannot make the announced number does not put in a token
  // offer, it stays home. Floored at the statutory minimum instead, a
  // promotion that had gone broke between the room opening and the offers
  // being read still turned up on the result screen bidding sixty dollars a
  // week — which is not an offer, it is noise.
  if (ceiling < ctx.minimum) return null;

  // Whatever they wanted to pay, the floor is the floor. A company in the
  // room has already decided the number is worth saying yes to.
  const weeklyRate = Math.max(
    ctx.minimum,
    Math.round(Math.min(Math.max(wanted, ctx.minimum), ceiling) / 25) * 25,
  );

  // Up-front money is a different appetite from weekly money, and it is the
  // showman's whole move.
  const signingBonus = chance(rng, want * mood.bonusAppetite)
    ? Math.round((weeklyRate * s.biddingBonusWeeks * want * mood.bonusAppetite) / 100) * 100
    : 0;

  // Term follows the strategy: lock somebody in cheap, or keep it short and
  // keep the flexibility.
  const span = s.biddingMaxWeeks - s.biddingMinWeeks;
  const weeks =
    s.biddingMinWeeks +
    Math.round(clamp(mood.termBias + gaussian(rng, 0, 0.12), 0, 1) * span / 13) * 13;

  // Sweeteners: the ones this person qualifies for, as many as appetite and
  // temperament between them buy. Squared, so generosity is the exception
  // rather than the default — linear, a typical rival handed over three
  // clauses on almost every bid, which saturated the sweetener axis for the
  // whole field and left the player no way to win with money at all.
  const affordable = CLAUSE_LADDER.filter((entry) => wrestler.ego >= entry.egoRequired);
  const appetite = want * mood.generosity;
  const count = Math.min(affordable.length, Math.round(appetite * appetite * s.biddingRivalMaxClauses));
  // `slice(-0)` is `slice(0)` — the whole array. Left as a bare slice, the one
  // company that had decided to offer nothing handed over every clause on the
  // ladder, so the tightest owner in the business was the most generous.
  const clauses = count <= 0 ? [] : affordable.slice(-count).map((entry) => entry.clause);

  return {
    promotionId: promotion.id,
    promotionName: promotion.name,
    weeklyRate,
    signingBonus,
    weeks: Math.min(weeks, s.biddingMaxWeeks),
    clauses,
  };
}

// ---------------------------------------------------------------------------
// How the wrestler chooses

/** What each clause is worth to this particular person, 0-1 per clause. */
export function clauseAppeal(clause: Clause, wrestler: Wrestler, settings: WorldSettings): number {
  const s = settings;
  const ego = wrestler.ego / 100;
  const worn = 1 - wrestler.health / 100;
  const old = clamp((wrestler.age - s.biddingYouthPivot) / 20, 0, 1);
  const draw = wrestler.popularity / 100;

  switch (clause) {
    // Somebody who has been hurt, or is old enough to expect to be, wants
    // covering. Somebody twenty-three and healthy barely notices this.
    case 'healthInsurance':
      return clamp(0.2 + worn * 0.6 + old * 0.4, 0, 1);
    case 'travelCovered':
      return clamp(0.25 + old * 0.3, 0, 1);
    // The ego clauses. These are what a man who thinks he is the business
    // actually wants, and they are worth almost nothing to anybody else.
    case 'creativeControl':
      return clamp(ego * 1.1, 0, 1);
    case 'noJobbing':
      return clamp(ego * 0.95, 0, 1);
    case 'titlePush':
      return clamp(0.15 + ego * 0.8, 0, 1);
    case 'ironClad':
      return clamp(0.2 + ego * 0.6 + old * 0.3, 0, 1);
    case 'noTrade':
      return clamp(0.15 + ego * 0.4, 0, 1);
    // Money-shaped clauses scale with how much money they would actually move.
    case 'merchandiseCut':
      return clamp(0.1 + draw * 0.9, 0, 1);
    case 'incentive':
      return clamp(0.15 + draw * 0.6, 0, 1);
    default:
      return s.biddingUnlistedClauseAppeal;
  }
}

export interface BidScore {
  bid: Bid;
  score: number;
  /** The single biggest reason this offer scored where it did. */
  headline: string;
  /** Who is already in that building, and what it does to the price. */
  stance: StanceRead;
}

export interface ChoiceContext {
  promotions: readonly Promotion[];
  relationships: readonly Relationship[];
  /** Everybody in the business, for reading who is on whose roster. */
  rosterOf: (promotionId: Id) => readonly Wrestler[];
  currentPromotionId: Id | null;
}

/**
 * What one offer is worth to this wrestler.
 *
 * Every term is bounded and named, so a result can always be explained in a
 * sentence — which matters, because the player is going to lose some of these
 * and deserves to know what beat them.
 */
export function scoreBid(
  bid: Bid,
  wrestler: Wrestler,
  ctx: ChoiceContext,
  settings: WorldSettings,
): BidScore {
  const s = settings;
  // What they want, adjusted for who is already in that building. A friend
  // there means the same money goes further; somebody they cannot stand means
  // it does not go far enough. See stanceToward.
  const roster = ctx.rosterOf(bid.promotionId);
  const stance = stanceToward(wrestler, bid.promotionId, roster, ctx.relationships, s);
  const base = Math.max(1, askingRate(wrestler, s) * (stance.stance === 'refuses' ? 1 : stance.multiplier));
  const reasons: { text: string; weight: number }[] = [];

  // --- the money ----------------------------------------------------------
  // Against what they think they are worth, not against the other bids: a
  // wrestler does not know the other bids either.
  // Normalised by the ceiling, so `biddingWeightMoney` really is the most
  // money can ever be worth. Left un-normalised, a weight of 55 against a
  // ceiling of 2.2 quietly made money worth 121 — more than the entire rest
  // of the sheet put together — and the auction became "who is richest".
  const moneyRatio = clamp(bid.weeklyRate / base, 0, s.biddingMoneyCeiling);
  const money = (moneyRatio / s.biddingMoneyCeiling) * s.biddingWeightMoney;
  reasons.push({ text: 'the money', weight: money });

  // A bonus is cash today. Worth more to somebody young, who has not made any
  // yet, than to a veteran on their third big deal.
  const youth = clamp((s.biddingYouthPivot - wrestler.age) / 25, 0, 1);
  const bonus =
    clamp(bid.signingBonus / (base * s.biddingBonusWeeks), 0, 1) * s.biddingWeightBonus * (0.6 + youth * 0.8);
  if (bid.signingBonus > 0) reasons.push({ text: 'the money up front', weight: bonus });

  // --- the term -----------------------------------------------------------
  // Security or a cage, depending on who is asking. A twenty-four-year-old
  // who believes he will be worth double in a year does not want five years.
  // Security is about how much you have to lose, not about being old. The
  // first version read age alone, which had a twenty-one-year-old with no
  // money and no name turning down the long guaranteed deal that would have
  // changed his life — and made every company that builds slowly lose the
  // prospects it bid highest on. What actually wants a short deal is a hot
  // commodity with an opinion of itself.
  const wantsLong = clamp(
    0.5 +
      (wrestler.age - s.biddingYouthPivot) / 25 +
      (1 - wrestler.popularity / 100) * s.biddingTermSecurityPull -
      (wrestler.ego / 100) * s.biddingTermEgoPush,
    0,
    1,
  );
  const termRatio = clamp((bid.weeks - s.biddingMinWeeks) / Math.max(1, s.biddingMaxWeeks - s.biddingMinWeeks), 0, 1);
  const term = (wantsLong * termRatio + (1 - wantsLong) * (1 - termRatio)) * s.biddingWeightTerm;
  reasons.push({ text: wantsLong > 0.5 ? 'the security of the term' : 'a short deal', weight: term });

  // --- the clauses --------------------------------------------------------
  let clauseTotal = 0;
  let bestClause: { clause: Clause; value: number } | null = null;
  for (const clause of bid.clauses) {
    const value = clauseAppeal(clause, wrestler, s);
    clauseTotal += value;
    if (!bestClause || value > bestClause.value) bestClause = { clause, value };
  }
  const clauses = clamp(clauseTotal / Math.max(1, s.biddingClauseSaturation), 0, 1) * s.biddingWeightClauses;
  if (bestClause && bestClause.value > 0.2) {
    reasons.push({ text: clauseLabel(bestClause.clause).toLowerCase(), weight: clauses });
  }

  // --- the company --------------------------------------------------------
  const promotion = ctx.promotions.find((p) => p.id === bid.promotionId);
  const standing = promotion ? clamp(promotion.rating / 100, 0, 1) * s.biddingWeightStanding : 0;
  if (promotion) reasons.push({ text: `what ${promotion.name} is`, weight: standing });

  // Staying put is easier than moving, and a locker room somebody already
  // knows counts for something.
  const loyalty = bid.promotionId === ctx.currentPromotionId ? s.biddingWeightLoyalty : 0;
  if (loyalty > 0) reasons.push({ text: 'not wanting to move', weight: loyalty });

  // --- the people ---------------------------------------------------------
  // Priced into `base` above rather than scored here, because that is how it
  // actually works: somebody does not think "that company is worth four more
  // points because my friend is there", they think "I will take less to work
  // with him". The reason still gets to be the headline when it is what made
  // the difference.
  if (stance.reason) {
    reasons.push({
      text: stance.reason,
      weight: stance.stance === 'discount' ? s.biddingWeightStanceHeadline : 0,
    });
  }

  // --- the map ------------------------------------------------------------
  const home =
    promotion && promotion.ownedTerritoryIds.includes(wrestler.homeTerritoryId) ? s.biddingWeightHome : 0;
  if (home > 0) reasons.push({ text: 'working close to home', weight: home });

  const score = money + bonus + term + clauses + standing + loyalty + home;
  const headline = reasons.sort((a, b) => b.weight - a.weight)[0]?.text ?? 'the money';
  return { bid, score, headline, stance };
}

export type BiddingOutcome =
  /** Somebody won it. */
  | { kind: 'signed'; result: BiddingResult }
  /**
   * Nobody made the number, and they have told the room to go again.
   * Everybody who is still interested gets one more offer — including whoever
   * they refused to work for, who is still refused.
   */
  | { kind: 'reBid'; reason: string; vetoed: readonly Bid[] };

/**
 * The decision.
 *
 * Offers from companies they will not work for are thrown out before anything
 * is scored — no amount of money opens that envelope. What is left is scored
 * once, and if the best of it is still below what they think they are worth,
 * they send the room away and ask for better. That is the one thing that can
 * extend an auction past a single round, and it is the wrestler's call, never
 * a bidder's: nobody gets to see a rival's number and go again.
 *
 * The gut-feeling term is small and seeded. It exists so that two nearly
 * identical offers do not always resolve the same way, not so that a bad offer
 * can beat a good one.
 */
export function decideBids(
  rng: Rng,
  wrestler: Wrestler,
  bids: readonly Bid[],
  ctx: ChoiceContext,
  settings: WorldSettings,
  round = 1,
  /** The floor their people announced. Anything under it is not read. */
  minimum = 0,
): BiddingOutcome | null {
  if (bids.length === 0) return null;

  const scored = bids
    .map((bid) => {
      const base = scoreBid(bid, wrestler, ctx, settings);
      return { ...base, score: base.score + gaussian(rng, 0, settings.biddingGutFeeling) };
    })
    .sort((a, b) => b.score - a.score);

  // Two ways an envelope goes unopened, and they are different things. One is
  // a company they will not work for at any price; the other is a company
  // that did not make the number they announced. The result screen says which.
  const vetoed = scored.filter((entry) => entry.stance.stance === 'refuses');
  const short = scored.filter(
    (entry) => entry.stance.stance !== 'refuses' && entry.bid.weeklyRate < minimum,
  );
  const live = scored.filter(
    (entry) => entry.stance.stance !== 'refuses' && entry.bid.weeklyRate >= minimum,
  );

  if (live.length === 0) {
    // Nobody in the room either made the number or is somewhere they would
    // go. Ask again; if the rounds run out, the auction produces nobody and
    // they stay unsigned rather than taking something they said they would
    // not take.
    if (round >= settings.biddingMaxRounds) return null;
    const reason = vetoed[0]?.stance.reason
      ? `${wrestler.name} will not sign any of these — ${vetoed[0]!.stance.reason}.`
      : short.length > 0
        ? `Nobody met ${wrestler.name}'s number. Their people have put it out again and asked the room to come back properly.`
        : `${wrestler.name} turned the room down flat.`;
    return { kind: 'reBid', reason, vetoed: [...vetoed, ...short].map((entry) => entry.bid) };
  }

  const winner = live[0]!;
  const runnerUp = live[1];
  const swungIt =
    runnerUp && winner.score - runnerUp.score < settings.biddingCloseCall
      ? `It came down to ${winner.headline}.`
      : `${winner.bid.promotionName} won it on ${winner.headline}.`;

  return {
    kind: 'signed',
    result: {
      winningPromotionId: winner.bid.promotionId,
      winningPromotionName: winner.bid.promotionName,
      bid: winner.bid,
      allBids: scored.map((entry) => entry.bid),
      vetoed: [
        ...vetoed.map((entry) => ({
          bid: entry.bid,
          reason: entry.stance.reason ?? 'they would not go there',
        })),
        ...short.map((entry) => ({ bid: entry.bid, reason: 'under the number they named' })),
      ],
      swungIt,
    },
  };
}

// ---------------------------------------------------------------------------
// Turning a winning bid into a contract

/**
 * `ironClad` is the clause that makes a deal fully guaranteed — releasing
 * somebody costs the whole remaining term. Everything else leaves the standard
 * guarantee alone.
 */
export function guaranteeFor(bid: Bid, settings: WorldSettings): number {
  return bid.clauses.includes('ironClad') ? 1 : settings.biddingBaseGuarantee;
}

/** What signing this actually costs the winner on the day. */
export function signingCost(bid: Bid): number {
  return bid.signingBonus;
}

// ---------------------------------------------------------------------------
// Saying it out loud

/** How the paper announces the whole thing. Nothing happens off-screen. */
export function resultLine(war: BiddingWar, result: BiddingResult): string {
  const beaten = result.allBids.length - 1;
  const field =
    beaten <= 0
      ? 'unopposed'
      : beaten === 1
        ? 'seeing off one other offer'
        : `seeing off ${beaten} other offers`;
  const opener =
    war.reason === 'phenom'
      ? `Every company in the business wanted ${war.wrestlerName} out of the school.`
      : `${war.wrestlerName} hit the open market and the phones did not stop.`;
  return `${opener} ${result.winningPromotionName} have signed them, ${field}. ${result.swungIt}`;
}

/** How it is announced when the player stayed out of it. */
export function watchedItLine(war: BiddingWar, result: BiddingResult): string {
  return `${result.winningPromotionName} have signed ${war.wrestlerName}. You did not bid.`;
}

/** The invitation, in the words the player reads. */
export function invitationLine(war: BiddingWar, wrestler: Wrestler, rivalCount: number): string {
  const who =
    war.reason === 'phenom'
      ? `${wrestler.name} came out of the school this week with a professional's tools and a professional's body, at ${wrestler.age}.`
      : `${wrestler.name}'s contract is up.`;
  const room =
    rivalCount === 1
      ? 'One other company is in for them.'
      : `${rivalCount} other companies are in for them.`;
  return `${who} ${room} Everybody submits one offer, nobody sees anybody else's, and they pick. There is no second round.`;
}
