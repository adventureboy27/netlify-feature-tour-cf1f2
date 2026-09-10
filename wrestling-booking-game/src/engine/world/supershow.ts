// Cross-promotional supershows (§16).
//
// Two companies agree to run one PPV together. It is the biggest night either
// of them will have — and the reason it works is that neither booker controls
// the outcome. The sim picks the winners, on their card as much as yours, and
// you do not get to see what they stacked.
//
// Three things are true at once, and the tension between them is the system:
//
//   1. It is the most money anybody makes all year. Two audiences buy one show,
//      so the gate is bigger than either company could draw alone, everybody on
//      the card takes an appearance fee well above a normal night, and the
//      winners take a bonus on top.
//   2. Titles never change hands. §16 is unambiguous, and it is enforced in
//      supershowRun.ts by giving the joint card no belts to put on the line.
//      Champion vs champion is the marquee draw and the belts still go home
//      where they came from. What is on the table is credibility.
//   3. Losing is expensive in the currency that matters. A champion who loses
//      keeps the belt and looks like a fraud for months, and the company that
//      loses the night on aggregate hands its rival a rating swing, a morale
//      swing, and territory following in the host region.
//
// So: the incentive to win is money and standing, and the reason not to lose is
// that everybody watched, and the sim does not care what you intended.

import type { Rng } from '../rng';
import { chance, clamp, randInt } from '../rng';
import type { Id, Promotion, Wrestler, WorldSettings } from '../types';

// ---------------------------------------------------------------- the deal

export interface SupershowDeal {
  /** The other company. The player is always the counterparty. */
  partnerId: Id;
  /** Whose building. The host takes a larger cut and their people work at home. */
  hostPromotionId: Id;
  hostTerritoryId: Id | null;
  /** The proposer's share of the gate, 0-1. The rest goes to the partner. */
  gateSplit: number;
  /** Total segments across both companies. §16: 8-14. */
  cardSize: number;
  /** How many of those the player books. The partner books the rest. */
  playerSegments: number;
  /** Flat fee the bigger company pays the smaller one just to turn up. */
  appearanceGuarantee: number;
  /** Whether champion-vs-champion pairings are permitted at all. */
  championVsChampion: boolean;
  proposedByPlayer: boolean;
  week: number;
}

export type DealResponse =
  | { kind: 'accepted'; deal: SupershowDeal }
  | { kind: 'countered'; deal: SupershowDeal; because: string }
  | { kind: 'refused'; because: string; publicly: boolean };

/**
 * When the joint shows happen.
 *
 * Two a year, on the calendar rather than on a dice roll — spring and autumn,
 * far enough apart that neither cannibalises the other and neither collides
 * with the year's own big shows. A weekly random chance was the first attempt
 * and it measured badly: a save could run three years without ever seeing the
 * biggest night in the game.
 */
export const SUPERSHOW_SEASONS = ['May', 'November'] as const;

// ---------------------------------------------------------------- appetite

export type CoopMood = 'eager' | 'cautious' | 'dismissive' | 'hostile';

/**
 * How badly a company wants to be on a show with you (§16, 0-100).
 *
 * Standing is the spine of it: a smaller company sees a bigger stage, a bigger
 * one sees no upside in legitimising you. Resentment — from poaching, from
 * being beaten badly on a previous joint show — overrides the lot, because a
 * booker who thinks you have wronged him does not care about the gate.
 */
export function coopAppetite(
  us: Promotion,
  them: Promotion,
  resentment: number,
  settings: WorldSettings,
): number {
  // Below you: eager. Above you: dismissive. Scaled so a big gap dominates.
  const standingGap = (us.rating - them.rating) / 100;
  const base =
    settings.supershowAppetiteBase + standingGap * settings.supershowAppetiteStandingWeight;

  // A company with a reputation for straight dealing gets a hearing.
  const goodwill = (us.reputation - 50) / 100 * settings.supershowAppetiteReputationWeight;

  return clamp(base + goodwill - resentment * settings.supershowAppetiteResentmentWeight, 0, 100);
}

export function moodFor(appetite: number, resentment: number, settings: WorldSettings): CoopMood {
  if (resentment >= settings.supershowHostileResentment) return 'hostile';
  if (appetite >= settings.supershowEagerAt) return 'eager';
  if (appetite >= settings.supershowCautiousAt) return 'cautious';
  return 'dismissive';
}

export function moodLine(mood: CoopMood, partnerName: string): string {
  switch (mood) {
    case 'eager':
      return `${partnerName} would bite your hand off for a night like that.`;
    case 'cautious':
      return `${partnerName} will do business, but they will want looking after.`;
    case 'dismissive':
      return `${partnerName} do not think they need you.`;
    case 'hostile':
      return `${partnerName} would not share a building with you.`;
  }
}

// ---------------------------------------------------------------- the money

export interface SupershowPurse {
  /** Everything through the door and on the buys. */
  totalGate: number;
  playerShare: number;
  partnerShare: number;
  /** Paid per person who worked, per company. */
  appearanceFee: number;
  /** On top, per winner. The incentive. */
  winBonus: number;
  playerAppearanceBill: number;
  /** What the player actually banks after paying their own people. */
  playerNet: number;
}

/**
 * What the night is worth.
 *
 * The whole reason two bookers hold their nose and do this: the draw is not
 * the bigger company's audience, it is *both* audiences, plus everybody who
 * only turns up for something that has never happened before. That last part
 * is `supershowNoveltyMultiplier`, and it is why this beats running the same
 * two PPVs separately.
 */
export function supershowPurse(
  player: Promotion,
  partner: Promotion,
  deal: SupershowDeal,
  playerOnCard: number,
  playerWinners: number,
  settings: WorldSettings,
  /**
   * What the card came out at against what was agreed. Both offices get to
   * strike pairings they will not do (see supershowCard.ts), and a night that
   * ran ten matches instead of fourteen is a smaller night.
   */
  sizeMultiplier = 1,
): SupershowPurse {
  const pull = (p: Promotion) => p.rating * settings.supershowGatePerRatingPoint;
  const combined = (pull(player) + pull(partner)) * settings.supershowNoveltyMultiplier * sizeMultiplier;

  const hostBonus =
    deal.hostPromotionId === player.id ? settings.supershowHostGateBonus : -settings.supershowHostGateBonus;
  const playerCut = clamp(deal.gateSplit + hostBonus, 0.1, 0.9);

  const totalGate = Math.round(combined);
  const playerShare = Math.round(totalGate * playerCut);
  const partnerShare = totalGate - playerShare;

  // Everybody on the card gets paid well above a normal night — this is the
  // show wrestlers want to be on.
  const appearanceFee = Math.round(totalGate * settings.supershowAppearanceShare);
  const winBonus = Math.round(appearanceFee * settings.supershowWinBonusMultiple);

  // What the office actually writes out, rather than an estimate of it: the
  // same per-person figure the roster is shown, added up. These two used to
  // disagree, because the bill assumed a loser took the flat fee and nothing
  // else, which stopped being true the moment the loser's share was wired up.
  const playerAppearanceBill =
    walkAwayWith(appearanceFee, winBonus, true, settings) * playerWinners +
    walkAwayWith(appearanceFee, winBonus, false, settings) * Math.max(0, playerOnCard - playerWinners);
  const guarantee =
    deal.appearanceGuarantee * (deal.hostPromotionId === player.id ? -1 : 1);

  return {
    totalGate,
    playerShare,
    partnerShare,
    appearanceFee,
    winBonus,
    playerAppearanceBill,
    playerNet: playerShare + guarantee - playerAppearanceBill,
  };
}

/**
 * One person's night, from the two numbers the deal produced.
 *
 * The loser's share is deliberately not zero. Losing a cross-promotional match
 * costs a career something real — §16 hands out the popularity and prestige
 * hits and they are the punishment — and taking the man's money as well would
 * be charging him twice for the same loss. He worked the biggest show of the
 * year in front of both audiences; he goes home paid.
 */
function walkAwayWith(
  appearanceFee: number,
  winBonus: number,
  won: boolean,
  settings: WorldSettings,
): number {
  return appearanceFee + winBonus * (won ? 1 : settings.supershowLoserBonusShare);
}

/** What one person walks away with. Shown on the card, so the roster can see it. */
export function personalPurse(
  purse: SupershowPurse,
  won: boolean,
  settings: WorldSettings,
): number {
  return Math.round(walkAwayWith(purse.appearanceFee, purse.winBonus, won, settings));
}

/**
 * What a short card is worth against the card that was agreed.
 *
 * Both offices can strike pairings they will not do, and once the standbys are
 * gone every strike is a segment that does not happen. The gate follows,
 * because the thing two audiences bought was a fourteen-match show.
 */
export function cardSizeMultiplier(ran: number, agreed: number, settings: WorldSettings): number {
  if (agreed <= 0 || ran >= agreed) return 1;
  const missing = (agreed - ran) / agreed;
  return Math.max(settings.supershowShortCardFloor, 1 - missing * settings.supershowShortCardPenalty);
}

// ---------------------------------------------------------------- the stakes

export interface CrossPromoStakes {
  popularityMultiplier: number;
  moraleSwing: number;
  titlePrestigeSwing: number;
}

/**
 * §16's amplification, applied to both ends of every result.
 *
 * A midcarder who beats a rival's main eventer gets a career out of one night;
 * a champion who loses keeps the belt and carries the loss around for months.
 * Both come out of the same multiplier, which is the point — the risk and the
 * reward are the same number seen from either side.
 */
export function crossPromoStakes(isChampion: boolean, settings: WorldSettings): CrossPromoStakes {
  return {
    popularityMultiplier: settings.supershowPopularityMultiplier,
    moraleSwing: settings.supershowMoraleSwing,
    titlePrestigeSwing: isChampion ? settings.supershowTitlePrestigeSwing : 0,
  };
}

// §16's hard rule — a belt on a cross-promotional card cannot move — used to
// live here as `titleCanTravel(title)`, returning `!title.lineageProtected`.
// It was never called, and it was worse than dead: exactly one belt in the
// game sets that flag, so anybody who had wired it up would have found every
// other title in the world cheerfully changing hands on a joint show. The rule
// is enforced where it cannot be got around, in supershowRun.ts, by giving the
// card no titles to put on the line in the first place.

export interface NightVerdict {
  playerWins: number;
  partnerWins: number;
  /** Positive means the player's company won the night. */
  margin: number;
  companyRatingSwing: number;
  /** Following gained in the host region by the winner, lost by the loser. */
  territorySwing: number;
  line: string;
}

/**
 * Who won the night, on aggregate, and what it costs the loser.
 *
 * Deliberately about the *count* rather than the ratings: a booker who wins
 * six of eight has beaten you in front of both audiences, and no amount of
 * star quality in the two you took makes that read differently the next day.
 */
export function nightVerdict(
  playerWins: number,
  partnerWins: number,
  playerName: string,
  partnerName: string,
  settings: WorldSettings,
): NightVerdict {
  const total = Math.max(1, playerWins + partnerWins);
  const margin = (playerWins - partnerWins) / total;
  const swing = margin * settings.supershowCompanyRatingSwing;

  const winner = margin > 0 ? playerName : partnerName;
  const loser = margin > 0 ? partnerName : playerName;
  const line =
    margin === 0
      ? `${playerName} and ${partnerName} split the night ${playerWins}-${partnerWins}. Nobody got to claim it.`
      : Math.abs(margin) >= settings.supershowRoutMargin
        ? `${winner} did not just win the night, they embarrassed ${loser} in front of both audiences.`
        : `${winner} took the night ${Math.max(playerWins, partnerWins)}-${Math.min(playerWins, partnerWins)}.`;

  return {
    playerWins,
    partnerWins,
    margin,
    companyRatingSwing: swing,
    territorySwing: margin * settings.supershowTerritorySwing,
    line,
  };
}

// ---------------------------------------------------------------- the AI

/**
 * What the other booker says when you put a deal in front of him.
 *
 * He is not evaluating whether the show is good. He is evaluating whether he
 * is being had — a company that thinks it is the bigger name wants the bigger
 * cut, the smaller one wants a guarantee in case the night goes badly, and
 * either of them will walk if the split is an insult.
 */
export function respondToOffer(
  rng: Rng,
  offer: SupershowDeal,
  us: Promotion,
  them: Promotion,
  resentment: number,
  settings: WorldSettings,
): DealResponse {
  const appetite = coopAppetite(us, them, resentment, settings);
  const mood = moodFor(appetite, resentment, settings);

  if (mood === 'hostile') {
    return {
      kind: 'refused',
      because: `${them.name} want nothing to do with you, at any price.`,
      publicly: true,
    };
  }
  if (mood === 'dismissive') {
    // Sometimes he says no in the trades, which costs you something.
    return {
      kind: 'refused',
      because: `${them.name} do not believe the show does anything for them.`,
      publicly: chance(rng, settings.supershowPublicRefusalChance),
    };
  }

  // What he thinks he is worth: his share of the two ratings, nudged by mood.
  const fairShare = them.rating / Math.max(1, us.rating + them.rating);
  const wants = clamp(
    fairShare + (mood === 'cautious' ? settings.supershowCautiousPremium : 0),
    settings.supershowMinPartnerShare,
    settings.supershowMaxPartnerShare,
  );
  const offered = 1 - offer.gateSplit;

  if (offered >= wants - settings.supershowSplitTolerance) {
    return { kind: 'accepted', deal: offer };
  }

  const counter: SupershowDeal = {
    ...offer,
    gateSplit: Number((1 - wants).toFixed(3)),
    // A cautious partner also wants money up front, and wants the belts safe.
    appearanceGuarantee:
      mood === 'cautious'
        ? randInt(rng, settings.supershowGuaranteeMin, settings.supershowGuaranteeMax)
        : offer.appearanceGuarantee,
    championVsChampion: mood === 'cautious' ? false : offer.championVsChampion,
    proposedByPlayer: false,
  };

  return {
    kind: 'countered',
    deal: counter,
    because:
      mood === 'cautious'
        ? `${them.name} will do it, but they want ${Math.round(wants * 100)}% and their champion kept out of it.`
        : `${them.name} want ${Math.round(wants * 100)}% of the gate.`,
  };
}

/** A default package to put in front of a partner, weighted by who is bigger. */
export function openingOffer(
  player: Promotion,
  partner: Promotion,
  hostTerritoryId: Id | null,
  week: number,
  settings: WorldSettings,
): SupershowDeal {
  const cardSize = clamp(
    Math.round((player.rating + partner.rating) / settings.supershowRatingPerSegment),
    settings.supershowMinCard,
    settings.supershowMaxCard,
  );
  return {
    partnerId: partner.id,
    hostPromotionId: player.rating >= partner.rating ? player.id : partner.id,
    hostTerritoryId,
    gateSplit: clamp(
      player.rating / Math.max(1, player.rating + partner.rating),
      settings.supershowMinPartnerShare,
      settings.supershowMaxPartnerShare,
    ),
    cardSize,
    playerSegments: Math.round(cardSize / 2),
    appearanceGuarantee: 0,
    championVsChampion: true,
    proposedByPlayer: true,
    week,
  };
}

/** Who on a roster is worth putting on a show this size. */
export function supershowCandidates(
  roster: readonly Wrestler[],
  slots: number,
): Wrestler[] {
  return [...roster]
    .filter((w) => !w.deceased && w.role === 'wrestler')
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, slots);
}
