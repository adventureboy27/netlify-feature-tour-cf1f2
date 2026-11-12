// Running the joint show, once both sides have signed (§16).
//
// Two stages, and the gap between them is the point.
//
// `draftSupershow` builds the running order and hands it to the other office
// first. He strikes what he will not do — his champion, anybody of his who
// would be squashed — and what comes back is a sheet with his name against
// half the matches and his refusals already on it. That is what the player
// gets to argue with.
//
// `runSupershow` then works whatever survived. The card is simmed by exactly
// the machinery that books every other show in the game — `runRivalShow` over
// a pool drawn from both rosters. That is not laziness, it is the point: §16's
// whole tension is that neither booker controls the outcome, and the fastest
// way to guarantee that is to hand the night to the same simulation that runs
// everybody else's and let it pick.
//
// What this module adds on top is the cross-promotional part — who each winner
// was working for, what the night did to the two companies, and what everybody
// gets paid.

import type { Rng } from '../rng';
import type { Id, Promotion, Wrestler, WorldSettings, Territory, Title, Stable } from '../types';
import { bookRivalCard, runRivalShow, type BookedMatch, type RivalCard, type RivalShow } from './rivalBooking';
import {
  cardSizeMultiplier,
  coopAppetite,
  moodFor,
  personalPurse,
  supershowCandidates,
  supershowPurse,
  nightVerdict,
  type SupershowDeal,
  type SupershowPurse,
  type NightVerdict,
} from './supershow';
import {
  draftJointCard,
  partnerApproval,
  type JointCard,
  type ProposedMatch,
} from './supershowCard';

export interface SupershowOffer {
  deal: SupershowDeal;
  partnerName: string;
  /** Why they are asking, in the booker's own words. */
  pitch: string;
  /** What the player's side stands to clear if the night goes averagely. */
  estimatedNet: number;
  expiresWeek: number;
}

/**
 * A signed deal with a card attached, sitting between the handshake and the
 * bell. Plain data: everything in it is ids and strings, so it survives a save
 * without the world having to hold live wrestler objects.
 */
export interface SupershowBooking {
  deal: SupershowDeal;
  partnerId: Id;
  partnerName: string;
  card: JointCard;
  /** Which company each competitor belongs to. */
  sideOf: Record<Id, Id>;
}

export interface SupershowResult {
  week: number;
  partnerId: Id;
  partnerName: string;
  hostPromotionId: Id;
  show: RivalShow;
  verdict: NightVerdict;
  purse: SupershowPurse;
  /** Per-person payout, by wrestler id — appearance plus any win bonus. */
  payouts: Record<Id, number>;
  /** Which side each competitor was on, so the write-up can say. */
  sideOf: Record<Id, Id>;
  playerWinnerIds: Id[];
  partnerWinnerIds: Id[];
  /** What ran against what was agreed, so the panel can say why the gate moved. */
  matchesRun: number;
  agreedSize: number;
}

export interface SupershowRunContext {
  player: Promotion;
  partner: Promotion;
  deal: SupershowDeal;
  playerRoster: readonly Wrestler[];
  partnerRoster: readonly Wrestler[];
  titles: readonly Title[];
  stables: readonly Stable[];
  territories: readonly Territory[];
  week: number;
  settings: WorldSettings;
  /** How badly the partner resents the player, for the mood the card is read in. */
  resentment?: number;
}

/** Both rosters' best, and who belongs to whom. */
function jointPool(ctx: SupershowRunContext): { ours: Wrestler[]; theirs: Wrestler[]; sideOf: Record<Id, Id> } {
  // Enough bodies for the agreed card plus the standbys that backfill strikes.
  const perSide = Math.max(2, ctx.deal.cardSize + ctx.settings.supershowStandbys);
  const ours = supershowCandidates(ctx.playerRoster, perSide);
  const theirs = supershowCandidates(ctx.partnerRoster, perSide);
  const sideOf: Record<Id, Id> = {};
  for (const w of ours) sideOf[w.id] = ctx.player.id;
  for (const w of theirs) sideOf[w.id] = ctx.partner.id;
  return { ours, theirs, sideOf };
}

/**
 * Build the sheet and let the other office go through it.
 *
 * Deliberately drafts more pairings than the deal agreed. The surplus comes
 * off the bottom of the running order and becomes the standby list, so a
 * struck match is replaced by an opener rather than by a hole — and when the
 * standbys are gone, striking starts costing segments.
 *
 * Titles are not passed in. §16 says the belts do not move, and the surest way
 * to honour that is to give the card no titles to put on the line in the first
 * place; a champion is still a champion in the write-up and still carries the
 * prestige swing, but there is nothing for the sim to move.
 */
export function draftSupershow(rng: Rng, ctx: SupershowRunContext): SupershowBooking | null {
  const { ours, theirs, sideOf } = jointPool(ctx);
  if (ours.length < 2 || theirs.length < 2) return null;

  const host = ctx.deal.hostPromotionId === ctx.player.id ? ctx.player : ctx.partner;
  const drafted = bookRivalCard(rng, {
    promotion: host,
    available: [...ours, ...theirs],
    titles: [],
    stables: ctx.stables,
    week: ctx.week,
    settings: {
      ...ctx.settings,
      segmentsPerTV: ctx.deal.cardSize + ctx.settings.supershowStandbys,
    },
    // Nobody has seen these two on the same card before, which is the draw.
    memory: { weeksSeen: new Map(), pairings: new Map() },
  });
  if (drafted.matches.length === 0) return null;

  const card = draftJointCard(drafted, {
    playerId: ctx.player.id,
    partnerId: ctx.partner.id,
    hostPromotionId: ctx.deal.hostPromotionId,
    playerSegments: ctx.deal.playerSegments,
    agreedSize: ctx.deal.cardSize,
    sideOf,
  });

  // Their office reads it before the player does. A card that comes back
  // untouched is a card he was happy with, which is information too.
  const byId = new Map([...ours, ...theirs].map((w) => [w.id, w]));
  const resentment = ctx.resentment ?? 0;
  const mood = moodFor(coopAppetite(ctx.player, ctx.partner, resentment, ctx.settings), resentment, ctx.settings);
  const championIds = new Set(
    ctx.titles
      .filter((t) => t.promotionId === ctx.partner.id)
      .flatMap((t) => t.currentHolderIds),
  );

  const answered = partnerApproval(card, {
    playerId: ctx.player.id,
    partner: ctx.partner,
    mood,
    championVsChampion: ctx.deal.championVsChampion,
    wrestler: (id) => byId.get(id),
    sideOf,
    championIds,
    settings: ctx.settings,
  });

  return {
    deal: ctx.deal,
    partnerId: ctx.partner.id,
    partnerName: ctx.partner.name,
    card: answered,
    sideOf,
  };
}

/** The approved sheet, back in the shape the simulation books from. */
function asRivalCard(matches: readonly ProposedMatch[], byId: Map<Id, Wrestler>): RivalCard {
  const booked: BookedMatch[] = [];
  for (const match of matches) {
    const sides = match.sides.map((side) =>
      side.map((id) => byId.get(id)).filter((w): w is Wrestler => Boolean(w)),
    );
    // Somebody on the sheet got hurt between the handshake and the bell. The
    // match does not happen; the card is one shorter and the gate says so.
    if (!sides[0]?.length || !sides[1]?.length) continue;
    booked.push({ sides: [sides[0], sides[1]] });
  }
  return { matches: booked };
}

/**
 * Work the show.
 *
 * Runs the card both offices signed off on, not a fresh one. Everything below
 * the booking — who wins, how it is rated, what it does to the people in it —
 * belongs to the simulation, which is why neither booker can promise anybody
 * anything.
 */
export function runSupershow(
  rng: Rng,
  ctx: SupershowRunContext,
  booking: SupershowBooking,
): SupershowResult | null {
  const { ours, theirs } = jointPool(ctx);
  const byId = new Map([...ours, ...theirs].map((w) => [w.id, w]));
  const sideOf = booking.sideOf;

  const approved = asRivalCard(booking.card.matches, byId);
  if (approved.matches.length === 0) return null;

  const host = ctx.deal.hostPromotionId === ctx.player.id ? ctx.player : ctx.partner;
  const show = runRivalShow(rng, {
    promotion: host,
    available: [...ours, ...theirs],
    // No belts on this card. See the note above — §16 is enforced by absence.
    titles: [],
    stables: ctx.stables,
    week: ctx.week,
    settings: { ...ctx.settings, segmentsPerTV: approved.matches.length },
    memory: { weeksSeen: new Map(), pairings: new Map() },
    card: approved,
  });
  if (!show) return null;

  const playerWinnerIds: Id[] = [];
  const partnerWinnerIds: Id[] = [];
  for (const match of show.matches) {
    for (const id of match.winnerIds) {
      if (sideOf[id] === ctx.player.id) playerWinnerIds.push(id);
      else if (sideOf[id] === ctx.partner.id) partnerWinnerIds.push(id);
    }
  }

  const onCard = new Set<Id>();
  for (const match of show.matches) for (const id of match.participantIds) onCard.add(id);
  const oursOnCard = [...onCard].filter((id) => sideOf[id] === ctx.player.id);

  const purse = supershowPurse(
    ctx.player,
    ctx.partner,
    ctx.deal,
    oursOnCard.length,
    playerWinnerIds.length,
    ctx.settings,
    cardSizeMultiplier(show.matches.length, booking.card.agreedSize, ctx.settings),
  );

  // Everybody who worked gets the fee; the winners get the bonus on top, and a
  // loser still takes a share of it. This is the money the roster actually
  // sees, and it is why they want to be on it.
  const winners = new Set([...playerWinnerIds, ...partnerWinnerIds]);
  const payouts: Record<Id, number> = {};
  for (const id of onCard) {
    payouts[id] = personalPurse(purse, winners.has(id), ctx.settings);
  }

  const verdict = nightVerdict(
    playerWinnerIds.length,
    partnerWinnerIds.length,
    ctx.player.name,
    ctx.partner.name,
    ctx.settings,
  );

  return {
    week: ctx.week,
    partnerId: ctx.partner.id,
    partnerName: ctx.partner.name,
    hostPromotionId: ctx.deal.hostPromotionId,
    show,
    verdict,
    purse,
    payouts,
    sideOf,
    playerWinnerIds,
    partnerWinnerIds,
    matchesRun: show.matches.length,
    agreedSize: booking.card.agreedSize,
  };
}

/** Keeps `bookRivalCard` reachable for callers that only want the card. */
export { bookRivalCard };
