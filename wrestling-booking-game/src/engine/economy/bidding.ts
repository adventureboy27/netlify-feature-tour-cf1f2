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
import { chance, clamp, gaussian, randInt } from '../rng';
import type { Clause, Id, Promotion, Relationship, Wrestler, WorldSettings } from '../types';
import { askingRate } from './contracts';
import { CLAUSE_LADDER, clauseLabel } from '../career/ego';
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
  return wrestler.talent >= settings.biddingProspectTalent && wrestler.age <= settings.biddingProspectAge;
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
  ctx: { weeklyPayroll: (promotionId: Id) => number; banned: (promotionId: Id) => boolean },
  settings: WorldSettings,
): Promotion[] {
  const rate = askingRate(wrestler, settings);
  return promotions.filter((promotion) => {
    if (!canBid(promotion, ctx.banned(promotion.id))) return false;
    if (promotion.rosterIds.includes(wrestler.id)) {
      // The current employer is always in — they are the ones about to lose
      // him, and they get to fight for him like everybody else.
      return true;
    }
    const headroom = promotion.bankBalance - ctx.weeklyPayroll(promotion.id) * settings.biddingHeadroomWeeks;
    if (headroom < rate * settings.biddingHeadroomWeeks) return false;
    // And they have to actually want him: somebody who would not improve the
    // top of their card is not worth an auction to them.
    return wrestler.popularity >= promotion.rating * settings.biddingWantsThreshold;
  });
}

// ---------------------------------------------------------------------------
// What a rival offers

/**
 * How badly a company wants this person, 0-1.
 *
 * Drives everything about their bid: the rate, the bonus, and how many
 * sweeteners they are willing to hand over.
 */
export function keenness(wrestler: Wrestler, promotion: Promotion, settings: WorldSettings): number {
  const s = settings;
  // A star is worth more to a company he would headline than to one where he
  // would be fourth from the top.
  const lift = clamp((wrestler.popularity - promotion.rating) / 100, -0.5, 0.5);
  const upside = clamp((wrestler.talent - 50) / 100, -0.5, 0.5);
  const youth = clamp((s.biddingYouthPivot - wrestler.age) / 40, -0.4, 0.4);
  return clamp(
    s.biddingKeennessBase + lift * s.biddingKeennessLift + upside * s.biddingKeennessUpside + youth * s.biddingKeennessYouth,
    0.05,
    1,
  );
}

/**
 * A rival's one offer.
 *
 * They bid what they want him at, clipped to what they can actually stand.
 * The clauses come off the same ladder the player picks from — a rival that
 * really wants somebody will hand over creative control just as readily.
 */
export function rivalBid(
  rng: Rng,
  wrestler: Wrestler,
  promotion: Promotion,
  weeklyPayroll: number,
  settings: WorldSettings,
): Bid {
  const s = settings;
  const base = askingRate(wrestler, s);
  const want = keenness(wrestler, promotion, s);

  // A little noise so two companies in identical shape do not bid identically,
  // and so the player cannot solve the auction by arithmetic.
  const nerve = 1 + gaussian(rng, 0, s.biddingRivalNerve);
  const wanted = base * (1 + want * s.biddingRivalStretch) * nerve;

  // What they can stand: the payroll headroom, spread over the term.
  const ceiling = Math.max(base * 0.5, (promotion.bankBalance - weeklyPayroll * s.biddingHeadroomWeeks) / s.biddingHeadroomWeeks);
  const weeklyRate = Math.max(s.contractBaseWeeklyRate, Math.round(Math.min(wanted, ceiling) / 25) * 25);

  const signingBonus =
    chance(rng, want * s.biddingRivalBonusChance)
      ? Math.round((weeklyRate * s.biddingBonusWeeks * want) / 100) * 100
      : 0;

  const weeks = randInt(rng, s.biddingMinWeeks, s.biddingMaxWeeks);

  // Sweeteners: the ones this person qualifies for, as many as their keenness
  // buys. A desperate company empties the drawer.
  const affordable = CLAUSE_LADDER.filter((entry) => wrestler.ego >= entry.egoRequired);
  // Squared, so generosity is the exception rather than the default. Linear in
  // keenness, a typical rival handed over three clauses on almost every bid,
  // which saturated the sweetener axis for the whole field and left the player
  // no way to win with money — the auction had exactly one correct answer.
  const count = Math.min(affordable.length, Math.round(want * want * s.biddingRivalMaxClauses));
  const clauses = affordable.slice(-count).map((entry) => entry.clause);

  return {
    promotionId: promotion.id,
    promotionName: promotion.name,
    weeklyRate,
    signingBonus,
    weeks,
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
  const base = Math.max(1, askingRate(wrestler, s));
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
  const wantsLong = clamp(0.5 + (wrestler.age - s.biddingYouthPivot) / 30 - (wrestler.ego / 100) * 0.5, 0, 1);
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
  const roster = ctx.rosterOf(bid.promotionId);
  let people = 0;
  for (const bond of ctx.relationships) {
    if (bond.aId !== wrestler.id && bond.bId !== wrestler.id) continue;
    const otherId = otherParty(bond, wrestler.id);
    if (!roster.some((w) => w.id === otherId)) continue;
    if (isAlly(bond)) people += s.biddingWeightAlly;
    else if (isEnemy(bond)) people -= s.biddingWeightEnemy;
  }
  people = clamp(people, -s.biddingWeightEnemy * 2, s.biddingWeightAlly * 2);
  if (people > 0) reasons.push({ text: 'the people already there', weight: people });

  // --- the map ------------------------------------------------------------
  const home =
    promotion && promotion.ownedTerritoryIds.includes(wrestler.homeTerritoryId) ? s.biddingWeightHome : 0;
  if (home > 0) reasons.push({ text: 'working close to home', weight: home });

  const score = money + bonus + term + clauses + standing + loyalty + people + home;
  const headline = reasons.sort((a, b) => b.weight - a.weight)[0]?.text ?? 'the money';
  return { bid, score, headline };
}

/**
 * The decision. One shot — every bid is scored once and the best one wins.
 *
 * The gut-feeling term is small and seeded. It exists so that two nearly
 * identical offers do not always resolve the same way, not so that a bad offer
 * can beat a good one.
 */
export function chooseBid(
  rng: Rng,
  wrestler: Wrestler,
  bids: readonly Bid[],
  ctx: ChoiceContext,
  settings: WorldSettings,
): BiddingResult | null {
  if (bids.length === 0) return null;

  const scored = bids
    .map((bid) => {
      const base = scoreBid(bid, wrestler, ctx, settings);
      return { ...base, score: base.score + gaussian(rng, 0, settings.biddingGutFeeling) };
    })
    .sort((a, b) => b.score - a.score);

  const winner = scored[0]!;
  const runnerUp = scored[1];
  // "What swung it" is the winning offer's strongest term, unless the two were
  // close enough that it was really about one specific thing being better.
  const swungIt =
    runnerUp && winner.score - runnerUp.score < settings.biddingCloseCall
      ? `It came down to ${winner.headline}.`
      : `${winner.bid.promotionName} won it on ${winner.headline}.`;

  return {
    winningPromotionId: winner.bid.promotionId,
    winningPromotionName: winner.bid.promotionName,
    bid: winner.bid,
    allBids: scored.map((s) => s.bid),
    swungIt,
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
