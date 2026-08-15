// Running the joint show, once both sides have signed (§16).
//
// The card is built and simmed by exactly the machinery that books every other
// show in the game — `bookRivalCard` over a pool drawn from both rosters, then
// `runRivalShow` to work it. That is not laziness, it is the point: §16's whole
// tension is that neither booker controls the outcome, and the fastest way to
// guarantee that is to hand the night to the same simulation that runs
// everybody else's and let it pick.
//
// What this module adds on top is the cross-promotional part — who each winner
// was working for, what the night did to the two companies, and what everybody
// gets paid.

import type { Rng } from '../rng';
import type { Id, Promotion, Wrestler, WorldSettings, Territory, Title, Stable } from '../types';
import { bookRivalCard, runRivalShow, type RivalShow } from './rivalBooking';
import {
  supershowCandidates,
  supershowPurse,
  nightVerdict,
  type SupershowDeal,
  type SupershowPurse,
  type NightVerdict,
} from './supershow';

export interface SupershowOffer {
  deal: SupershowDeal;
  partnerName: string;
  /** Why they are asking, in the booker's own words. */
  pitch: string;
  /** What the player's side stands to clear if the night goes averagely. */
  estimatedNet: number;
  expiresWeek: number;
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
}

/**
 * Work the show.
 *
 * Both companies put their best available names in, split by the segment
 * allocation the deal agreed. The pool then goes through the ordinary booker,
 * which will happily pair a player wrestler with a partner wrestler — and that
 * is where the interesting matches come from.
 *
 * Titles are deliberately NOT passed through. §16 says the belts do not move,
 * and the surest way to honour that is to give the card no titles to put on the
 * line in the first place; a champion is still a champion in the write-up and
 * still carries the prestige swing, but there is nothing for the sim to move.
 */
export function runSupershow(rng: Rng, ctx: SupershowRunContext): SupershowResult | null {
  const perSide = Math.max(2, Math.round(ctx.deal.cardSize));
  const ours = supershowCandidates(ctx.playerRoster, perSide);
  const theirs = supershowCandidates(ctx.partnerRoster, perSide);
  if (ours.length < 2 || theirs.length < 2) return null;

  const sideOf: Record<Id, Id> = {};
  for (const w of ours) sideOf[w.id] = ctx.player.id;
  for (const w of theirs) sideOf[w.id] = ctx.partner.id;

  const host =
    ctx.deal.hostPromotionId === ctx.player.id ? ctx.player : ctx.partner;

  const show = runRivalShow(rng, {
    promotion: host,
    available: [...ours, ...theirs],
    // No belts on this card. See the note above — §16 is enforced by absence.
    titles: [],
    stables: ctx.stables,
    week: ctx.week,
    settings: { ...ctx.settings, segmentsPerTV: ctx.deal.cardSize },
    // Nobody has seen these two on the same card before, which is the draw.
    memory: { weeksSeen: new Map(), pairings: new Map() },
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
  );

  // Everybody who worked gets the fee; the winners get the bonus on top. This
  // is the money the roster actually sees, and it is why they want to be on it.
  const winners = new Set([...playerWinnerIds, ...partnerWinnerIds]);
  const payouts: Record<Id, number> = {};
  for (const id of onCard) {
    payouts[id] = purse.appearanceFee + (winners.has(id) ? purse.winBonus : 0);
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
  };
}

/** Keeps `bookRivalCard` reachable for callers that only want the card. */
export { bookRivalCard };
