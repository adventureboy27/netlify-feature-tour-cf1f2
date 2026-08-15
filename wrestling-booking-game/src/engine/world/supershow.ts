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
//   2. Titles never change hands. §16 is unambiguous and `lineageProtected`
//      enforces it. Champion vs champion is the marquee draw and the belts
//      still go home where they came from. What is on the table is credibility.
//   3. Losing is expensive in the currency that matters. A champion who loses
//      keeps the belt and looks like a fraud for months, and the company that
//      loses the night on aggregate hands its rival a rating swing, a morale
//      swing, and territory following in the host region.
//
// So: the incentive to win is money and standing, and the reason not to lose is
// that everybody watched, and the sim does not care what you intended.

import type { Rng } from '../rng';
import { chance, clamp, randInt } from '../rng';
import type { Id, Promotion, Title, Wrestler, WorldSettings } from '../types';

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
 * tampering, from being beaten badly on a previous joint show — overrides the
 * lot, because a booker who thinks you have wronged him does not care about
 * the gate.
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
): SupershowPurse {
  const pull = (p: Promotion) => p.rating * settings.supershowGatePerRatingPoint;
  const combined = (pull(player) + pull(partner)) * settings.supershowNoveltyMultiplier;

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

  const playerAppearanceBill = appearanceFee * playerOnCard + winBonus * playerWinners;
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

/** What one person walks away with. Shown on the card, so the roster can see it. */
export function personalPurse(
  purse: SupershowPurse,
  won: boolean,
  settings: WorldSettings,
): number {
  return purse.appearanceFee + (won ? purse.winBonus : 0) * (won ? 1 : settings.supershowLoserBonusShare);
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

/**
 * §16 is a hard rule and this is the only place that says so: a belt on a
 * cross-promotional card cannot move, whoever wins and whatever the finish.
 * The sim still picks a winner and the winner still gets everything else.
 */
export function titleCanTravel(title: Title): boolean {
  return !title.lineageProtected;
}

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
