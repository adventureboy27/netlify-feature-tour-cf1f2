// Shared logic behind the store's actions.
//
// Split out of store.ts (which used to be ~9,400 lines, most of it
// `resolveWeek`) purely for navigability — nothing here changed behavior when
// it moved. Every function is called from `resolveWeek` and from at least one
// ordinary player action, which is exactly why it couldn't live next to
// either one alone: `stripTitle` belongs to both the championships phase of
// the weekly loop and to `unretireTitle`; `settleBiddingWar` belongs to both
// the loop's forced-settlement path and to `submitBid`. Keeping these in one
// place means there is exactly one version of "what closing a title reign
// means" or "what winning an auction means" for the rest of the store to
// call, rather than two that could quietly drift apart.
//
// RNG discipline: every function that draws randomness takes `rng: Rng`
// explicitly as a parameter rather than closing over anything module-level —
// store.ts passes its own single shared stream in at every call site, same
// as it always has.

import type {
  FinishType,
  Id,
  Promotion,
  Segment,
  Title,
  TitleReignEndMethod,
  Wrestler,
} from '../engine/types';
import type { EventEffect } from '../engine/events/types';
import type { World } from './world';
import type { Rng } from '../engine/rng';
import { clamp, pick } from '../engine/rng';
import type { Manager } from '../engine/sim/ringside';
import { managerFromWrestler } from '../engine/career/transition';
import { holidayForWeek, seasonForWeek } from '../engine/world/seasons';
import { carriedWeather, type WeatherCall } from '../engine/world/weatherCall';
import { awardTitle } from '../data/titles';
import type { StorylineBeatKind } from '../data/storylineBeats';
import { findRivalry, createRivalry } from '../engine/sim/rivalry';
import { resolveConfrontation } from '../engine/sim/confrontation';
import { promoShowContribution } from '../engine/sim/promo';
import { gradeFromLength, severityOf } from '../engine/sim/casualties';
import { recordInjury } from '../engine/career/theBody';
import { wire, biddingOpenedLine, biddingSettledLine } from '../engine/world/wire';
import { createStandardContract, askingRate, desiredContractWeeks } from '../engine/economy/contracts';
import { exitTerms } from '../engine/economy/termination';
import { appraise, aiBid, settleAuction, playerBidAmount, type Bid, type PlayerBidLevel } from '../engine/world/auction';
import { StatementBuilder } from '../engine/economy/statement';
import { runSupershow } from '../engine/world/supershowRun';
import { canWork } from '../engine/world/rivalBooking';
import { grudgeAgainst, grudgeLine, rememberNight } from '../engine/world/grudges';
import { creditPay } from '../engine/career/ledger';
import { ledgerOf } from '../engine/career/ledgerAccess';
import { crossPromoStakes } from '../engine/world/supershow';
import { clampMorale } from '../engine/career/morale';
import {
  askingMinimum,
  decideBids,
  interestedIn,
  minimumLine,
  rosterStrengthOf,
  invitationLine,
  resultLine,
  rivalBid,
  watchedItLine,
  worthAnAuction,
  guaranteeFor,
  type Bid as ContractBid,
  type BiddingReason,
} from '../engine/economy/bidding';
import { causesFor } from '../data/casualties';
import { GIMMICKS } from '../data/gimmicks';
import { applyGimmickLook, stableColorsFrom } from '../engine/generate/gimmickLook';
import type { IncidentContext } from '../engine/sim/incidents';

/**
 * A manager by id, from the standing pool or from your own roster.
 *
 * One lookup so no caller has to know which kind it got. A wrestler in a suit
 * is a Manager record like any other; the only difference is that his fee is
 * zero, because he is already on the payroll.
 */
export function findManager(world: World, id: Id): Manager | undefined {
  // No rental list any more: a manager is somebody under contract. Resolved
  // from the roster so a signed manager is bookable the week they arrive,
  // whether they were signed as one or moved into a suit.
  const signed = world.staffManagers.find((m) => m.id === id);
  if (signed) return signed;
  const person = world.wrestlers[id];
  return person && person.role === 'manager' ? managerFromWrestler(person) : undefined;
}

export function dropFromCard(world: World, wrestlerId: Id): void {
  for (const segment of [...world.currentCard, ...world.currentPromos]) {
    segment.participants = segment.participants.filter((p) => p.wrestlerId !== wrestlerId);
    if (segment.guestRefereeId === wrestlerId) segment.guestRefereeId = null;
    segment.managerIds = (segment.managerIds ?? []).filter((m) => m.managerId !== `mgr-of-${wrestlerId}`);
    if (segment.promoSpeakerId === wrestlerId) segment.promoSpeakerId = null;
    if (segment.promoTargetId === wrestlerId) segment.promoTargetId = null;
  }
}

/**
 * The night, rebuilt from a forecast the booker has just answered. The
 * holiday is looked up again because it is a fact about the date, but the
 * weather is carried rather than re-rolled.
 */
export function carriedNight(week: number, call: WeatherCall) {
  const holiday = holidayForWeek(week);
  return {
    season: seasonForWeek(week),
    holiday,
    weather: carriedWeather(call),
    draw: holiday?.draw ?? 1,
    merch: holiday?.merch ?? 1,
    cancelled: false,
  };
}

/**
 * Close the reign a lineage is currently showing for a belt, with a reason.
 * Shared by every path that takes a title off somebody without a pin.
 */
export function closeReign(world: World, title: Title, method: TitleReignEndMethod): void {
  const last = title.history[title.history.length - 1];
  if (last && last.endWeek === null) {
    last.endWeek = world.week;
    last.endMethod = method;
  }
  for (const id of title.currentHolderIds) {
    const open = world.wrestlers[id]?.titleReigns.find((r) => r.endWeek === null);
    if (open) {
      open.endWeek = world.week;
      open.endMethod = method;
    }
  }
}

/** Take a belt back off whoever has it and leave it vacant. */
export function stripTitle(world: World, title: Title, method: TitleReignEndMethod): void {
  closeReign(world, title, method);
  title.vacant = true;
  title.currentHolderIds = [];
  title.interimHolderIds = [];
  title.interimSinceWeek = null;
  title.lastDefendedWeek = world.week;
}

/**
 * The unification is over. The loser's claim ends — recorded as 'unified'
 * rather than a loss, because for whichever of them was the interim it never
 * was the real belt.
 */
export function closeInterimClaim(world: World, title: Title, winnerIds: readonly Id[]): void {
  const winners = new Set(winnerIds);
  const losers = [...title.currentHolderIds, ...title.interimHolderIds].filter((id) => !winners.has(id));
  for (const id of losers) {
    const open = world.wrestlers[id]?.titleReigns.find((r) => r.endWeek === null);
    if (open) {
      open.endWeek = world.week;
      open.endMethod = 'unified';
    }
  }
  title.interimHolderIds = [];
  title.interimSinceWeek = null;
}

/**
 * Run one confrontation slot and apply everything it did.
 *
 * Returns the segment's contribution to the show, or null when the slot was
 * not filled in properly. Lives beside the promo loop rather than inside it
 * because a confrontation touches more of the world than a promo does — heat,
 * real animosity, an alignment, and occasionally somebody's ribs.
 */
export function resolveConfrontationSlot(
  world: World,
  slot: Segment,
  wrestlerById: Map<Id, Wrestler>,
  rng: Rng,
  /** Where this slot's storyline beat is reported, if it produced one. */
  confrontationBeats: { participantIds: Id[]; kind: StorylineBeatKind; text: string }[],
): number | null {
  const speaker = slot.promoSpeakerId ? wrestlerById.get(slot.promoSpeakerId) : undefined;
  const opposite = slot.confrontationOppositeId ? wrestlerById.get(slot.confrontationOppositeId) : undefined;
  const third = slot.confrontationThirdId ? wrestlerById.get(slot.confrontationThirdId) : undefined;
  if (!slot.confrontationId || !speaker || !opposite || speaker.id === opposite.id) {
    slot.confrontationResult = null;
    return null;
  }

  const rivalry = findRivalry(world.rivalries, [speaker.id, opposite.id]);
  const outcome = resolveConfrontation(rng, {
    definitionId: slot.confrontationId,
    venue: slot.confrontationVenue ?? 'ring',
    speaker,
    opposite,
    third: third ?? null,
    existingHeat: rivalry?.heat ?? 0,
    settings: world.settings,
  });
  if (!outcome) {
    slot.confrontationResult = null;
    return null;
  }

  // A confrontation is the deliberate way to start a feud, so it makes one
  // where there was not one — that is the whole point of booking it. Routed
  // through the same closed effect set promos use, so a confrontation can
  // only do things the game can already do.
  const pair = [speaker.id, opposite.id];
  // Two people in the same room is a story beat, and a bigger one than a
  // monologue. Collected by the caller — see tonightsBeats.
  confrontationBeats.push({
    participantIds: pair,
    kind: 'confrontation',
    text: `${speaker.name} and ${opposite.name} came face to face. ${outcome.twistLabel}.`,
  });
  if (outcome.heat !== 0) applyEffect(world, rng, { kind: 'crowdHeat', wrestlerIds: pair, delta: outcome.heat });
  if (outcome.shootHeat !== 0) {
    applyEffect(world, rng, { kind: 'shootHeat', wrestlerIds: pair, delta: outcome.shootHeat });
  }

  // Whoever won the exchange got the night; whoever lost it paid for being
  // out there. A segment you came second in is worse than one you missed.
  const winner = outcome.wonBy ? wrestlerById.get(outcome.wonBy) : undefined;
  const loser = outcome.wonBy
    ? outcome.wonBy === speaker.id
      ? opposite
      : speaker
    : undefined;
  if (winner) {
    winner.momentum = clamp(winner.momentum + world.settings.confrontationWinMomentum, 0, 100);
    winner.popularity = clamp(winner.popularity + world.settings.confrontationWinPopularity, 0, 100);
  }
  if (loser) {
    loser.momentum = clamp(loser.momentum - world.settings.confrontationLossMomentum, 0, 100);
  }

  // A booked turn moves the speaker. The crowd gets a vote on which way.
  if (outcome.alignmentShift !== 0) {
    speaker.alignment = clamp(
      speaker.alignment + (speaker.alignment >= 0 ? -1 : 1) * outcome.alignmentShift,
      -100,
      100,
    );
  }

  // Talking is work, and a confrontation that goes physical is more of it.
  speaker.energy = clamp(speaker.energy - world.settings.confrontationEnergyCost, 0, 100);
  opposite.energy = clamp(opposite.energy - world.settings.confrontationEnergyCost, 0, 100);

  // Nothing happens to a person off-screen. If somebody got hurt in a
  // corridor, the results page says who and how.
  if (outcome.casualty) {
    const hurt = wrestlerById.get(outcome.casualty.wrestlerId);
    if (hurt && !hurt.injury) {
      const twistGrade = gradeFromLength(outcome.casualty.weeks, world.settings);
      hurt.injury = {
        severity: severityOf(twistGrade, world.settings),
        grade: twistGrade,
        description: outcome.twistLabel,
        sufferedWeek: world.week,
        totalWeeks: outcome.casualty.weeks,
        weeksRemaining: outcome.casualty.weeks,
        permanentStatLoss: {},
        earlyReturnWeeksUsed: 0,
      };
      // Written into the body's permanent record, not only the current
      // status. A career is what has already happened to it.
      hurt.injuryHistory = recordInjury(
        hurt.injuryHistory ?? [],
        hurt.injury,
        world.settings.startingYear + Math.floor(world.week / 52),
      );
      hurt.health = clamp(hurt.health - world.settings.casualtyHealthCost, 0, 100);
    }
  }

  slot.confrontationResult = {
    quality: outcome.quality,
    text: outcome.text,
    twistLabel: outcome.twistLabel,
    wonByName: winner?.name ?? null,
  };
  return promoShowContribution(outcome.quality, world.settings);
}

/**
 * Take somebody out of the business entirely — dead or retired.
 *
 * Hoisted to module scope when deaths and retirements moved from an annual
 * roll to a weekly one. Returns the belts it had to vacate so the year-end
 * digest can still list them.
 */
export function leaveTheBusiness(world: World, id: Id, method: TitleReignEndMethod): Id[] {
  const vacated: Id[] = [];

  // A belt split between a hurt champion and an interim has to be resolved
  // before anything else, because whichever of them is leaving changes what
  // happens to the other. Without this the interim claim outlives the person
  // holding it: `needsUnification` stays true against somebody who is off
  // every roster, so the belt can never be defended again and the defence
  // clock quietly strips it. A soft-lock that reads as a bug.
  for (const title of world.titles) {
    if (!title.interimHolderIds.includes(id) && !title.currentHolderIds.includes(id)) continue;
    if (title.interimHolderIds.length === 0) continue;

    if (title.interimHolderIds.includes(id)) {
      // The stand-in is gone. There is nobody left to settle it with, so the
      // champion who never lost it is simply the champion.
      const champion = title.currentHolderIds.map((h) => world.wrestlers[h]?.name).filter(Boolean).join(' & ');
      title.interimHolderIds = [];
      title.interimSinceWeek = null;
      if (champion) {
        world.weeklyNews.push(
          wire(
            'title',
            `There is no unification to book for the ${title.name} any more. ${champion} is the champion, undisputed by default.`,
            world.week,
            'normal',
          ),
        );
      }
    } else {
      // The champion is gone and the stand-in is still here. An interim
      // champion is exactly the person who should inherit it — that is what
      // the belt was crowned for — so they get it outright rather than the
      // company vacating a title somebody is already carrying.
      const [heir] = title.interimHolderIds;
      const heirName = heir ? world.wrestlers[heir]?.name : undefined;
      if (heir && heirName) {
        const last = title.history[title.history.length - 1];
        if (last && last.endWeek === null) {
          last.endWeek = world.week;
          last.endMethod = method;
        }
        title.currentHolderIds = [heir];
        title.interimHolderIds = [];
        title.interimSinceWeek = null;
        title.vacant = false;
        title.reignStartWeek = world.week;
        world.weeklyNews.push(
          wire(
            'title',
            `${heirName} is no longer the interim ${title.name}. With the champion gone there is nothing left to settle, and the belt is theirs.`,
            world.week,
            'lead',
          ),
        );
      }
    }
  }

  // A champion who is gone cannot carry a belt. It goes vacant, and the
  // lineage records why.
  for (const title of world.titles) {
    if (title.vacant || !title.currentHolderIds.includes(id)) continue;
    const last = title.history[title.history.length - 1];
    if (last && last.endWeek === null) {
      last.endWeek = world.week;
      last.endMethod = method;
    }
    title.vacant = true;
    title.currentHolderIds = [];
    vacated.push(title.id);
  }
  for (const w of Object.values(world.wrestlers)) {
    const open = w.id === id ? w.titleReigns.find((r) => r.endWeek === null) : undefined;
    if (open) {
      open.endWeek = world.week;
      open.endMethod = method;
    }
  }
  world.promotion.rosterIds = world.promotion.rosterIds.filter((rosterId) => rosterId !== id);
  for (const rival of world.rivals) {
    rival.rosterIds = rival.rosterIds.filter((rosterId) => rosterId !== id);
  }
  world.freeAgents = world.freeAgents.filter((agent) => agent.wrestlerId !== id);
  world.pendingRenewals = world.pendingRenewals.filter((r) => r.wrestlerId !== id);
  world.releaseRequests = world.releaseRequests.filter((r) => r.wrestlerId !== id);
  return vacated;
}

/**
 * Take somebody off the roster, whichever exit it was.
 *
 * One function so every departure does the same four things: off the roster,
 * contract torn up, into the free-agent pool with whatever restriction the
 * exit carries, and — the part that matters — a sentence saying what
 * happened. A wrestler must never just be absent from the list one week.
 */
export function letThemGo(world: World, wrestler: Wrestler, terms: ReturnType<typeof exitTerms>): void {
  wrestler.promotionId = null;
  wrestler.contract = null;
  wrestler.noCompeteWeeks = terms.noCompeteWeeks;
  // A departure ends any second career too — you cannot referee for a company
  // you no longer work for.
  wrestler.role = 'wrestler';
  world.promotion.rosterIds = world.promotion.rosterIds.filter((id) => id !== wrestler.id);
  world.releaseRequests = world.releaseRequests.filter((r) => r.wrestlerId !== wrestler.id);
  // And off this week's card. Cutting somebody on the Tuesday used to leave
  // them booked in Monday's main event.
  dropFromCard(world, wrestler.id);

  const asOfficial = world.referees.find((r) => r.wrestlerId === wrestler.id);
  if (asOfficial) asOfficial.promotionId = null;
  if (world.defaultRefereeId === asOfficial?.id) world.defaultRefereeId = null;
  world.staffManagers = world.staffManagers.filter((m) => m.wrestlerId !== wrestler.id);

  // They do not vanish — they go back into the pool, where a rival can pick
  // them up and you can watch them do it.
  world.freeAgents.push({
    wrestlerId: wrestler.id,
    reason: 'released',
    askingRate: askingRate(wrestler, world.settings),
    wantsWeeks: desiredContractWeeks(wrestler, world.settings),
    weeksUnsigned: 0,
  });
  world.weeklyNews.push(wire('departure', terms.text, world.week));
}

/**
 * Move a championship, and write the lineage on both sides of it: the old
 * champion's reign closes, the new one's opens. Shared by the player's show
 * and by every rival's, so a belt changing hands means the same thing
 * wherever it happens.
 */
export function commitTitleChange(world: World, titleIndex: number, newHolderIds: Id[]): void {
  const title = world.titles[titleIndex];
  if (!title) return;

  const previousHolders = [...title.currentHolderIds];
  const holderAges = newHolderIds.map((id) => world.wrestlers[id]?.age ?? 0);
  world.titles[titleIndex] = awardTitle(title, newHolderIds, world.week, holderAges);

  for (const id of previousHolders) {
    const open = world.wrestlers[id]?.titleReigns.find((r) => r.titleId === title.id && r.endWeek === null);
    if (open) {
      open.endWeek = world.week;
      open.endMethod = 'lostMatch';
    }
  }

  for (const id of newHolderIds) {
    const champion = world.wrestlers[id];
    if (!champion) continue;
    champion.titleReigns.push({
      titleId: title.id,
      promotionId: title.promotionId,
      holderIds: [...newHolderIds],
      holderAges,
      wonFromIds: previousHolders.length > 0 ? previousHolders : null,
      wonByMethod: 'match',
      startWeek: world.week,
      endWeek: null,
      endMethod: null,
    });
    // Winning a belt is the single biggest thing that happens to somebody's
    // standing, and the crowd reacts accordingly.
    champion.momentum = clamp(champion.momentum + world.settings.titleWinMomentum, 0, 100);
    champion.popularity = clamp(champion.popularity + world.settings.titleWinPopularity, 0, 100);
  }
}

/**
 * Close a company down and put everything it owned on the block. The lot is
 * one package — contracts, belts and whatever was in the account — because a
 * dead promotion being swallowed whole is an event, and its roster being
 * quietly redistributed is not.
 */
export function closePromotion(world: World, promotion: Promotion): void {
  promotion.closedWeek = world.week;

  const roster = promotion.rosterIds.map((id) => world.wrestlers[id]).filter((w): w is Wrestler => Boolean(w));
  const titles = world.titles.filter((t) => t.promotionId === promotion.id);
  const cash = Math.max(0, promotion.bankBalance);

  world.pendingAuction = {
    openedWeek: world.week,
    lot: {
      fromPromotionId: promotion.id,
      fromPromotionName: promotion.name,
      wrestlerIds: roster.map((w) => w.id),
      titleIds: titles.map((t) => t.id),
      cash,
      appraisal: appraise(roster, titles, cash, world.settings),
    },
  };
}

/**
 * Settle the fire sale. The player's bid comes in as a level; everybody still
 * open bids for themselves. Whoever wins absorbs the roster and the belts —
 * lineage and all — and pays for the privilege.
 */
export function resolveAuction(world: World, rng: Rng, playerLevel: PlayerBidLevel, books?: StatementBuilder): void {
  const pending = world.pendingAuction;
  if (!pending) return;
  const { lot } = pending;

  const incoming = lot.wrestlerIds.map((id) => world.wrestlers[id]).filter((w): w is Wrestler => Boolean(w));
  const bidders = world.rivals.filter((r) => r.closedWeek === null && r.id !== lot.fromPromotionId);

  const bids: Bid[] = bidders.map((rival) => ({
    promotionId: rival.id,
    amount: aiBid(rng, rival, lot, incoming, world.settings),
  }));

  const playerAmount = playerBidAmount(playerLevel, lot, world.settings);
  // You cannot bid money you do not have. Bidding the house is allowed;
  // bidding somebody else's is not.
  const affordable = Math.min(playerAmount, Math.max(0, world.promotion.bankBalance));
  if (affordable > 0 && !world.folded) {
    bids.push({ promotionId: world.promotion.id, amount: affordable });
  }

  const standingOf = (id: Id) =>
    id === world.promotion.id ? world.promotion.rating : (world.rivals.find((r) => r.id === id)?.rating ?? 0);
  const result = settleAuction(bids, lot, world.settings, standingOf);

  const winner =
    result.winnerId === world.promotion.id
      ? world.promotion
      : world.rivals.find((r) => r.id === result.winnerId);

  if (winner) {
    winner.bankBalance -= result.winningBid;
    // The cash in the dead company's account comes with the lot.
    winner.bankBalance += lot.cash;
    if (winner.id === world.promotion.id) {
      books?.spend('other', result.winningBid);
      books?.earn('other', lot.cash);
    }

    for (const w of incoming) {
      w.promotionId = winner.id;
      // Deals carry over as they were — the new owner inherits the contract,
      // including whatever it costs them.
      if (!w.contract) w.contract = createStandardContract(w, world.settings, world.settings.startingYear);
      winner.rosterIds.push(w.id);
    }

    for (const title of world.titles) {
      if (!lot.titleIds.includes(title.id)) continue;
      // The belt keeps its name and every reign in its history. It is being
      // defended somewhere else now, that is all.
      title.promotionId = winner.id;
      winner.titleIds.push(title.id);
    }
  } else {
    // Nobody met the reserve. The contracts lapse and everyone is loose.
    for (const w of incoming) {
      w.promotionId = null;
      w.contract = null;
      world.freeAgents.push({
        wrestlerId: w.id,
        reason: 'released',
        askingRate: askingRate(w, world.settings),
        wantsWeeks: desiredContractWeeks(w, world.settings),
        weeksUnsigned: 0,
      });
    }
  }

  const dead = world.rivals.find((r) => r.id === lot.fromPromotionId);
  if (dead) {
    dead.rosterIds = [];
    dead.titleIds = [];
    dead.bankBalance = 0;
  }

  world.lastAuction = {
    lot,
    result,
    wonByName: winner?.name ?? 'Nobody',
  };
  world.pendingAuction = null;
}

// ---------------------------------------------------------------------------
// The joint show

/**
 * Work the joint show and apply everything it did (§16).
 *
 * Module scope rather than inside the action, because two things set it off:
 * the player signing the card off, and the week turning while he is still
 * arguing about it. The building is booked either way — a booker who has not
 * finished the negotiation by the bell runs the card as it stands.
 */
export function settleSupershow(world: World, rng: Rng): void {
  const booking = world.pendingSupershowCard;
  if (!booking) return;
  world.pendingSupershowCard = null;

  const partner = world.rivals.find((r) => r.id === booking.partnerId);
  if (!partner || partner.closedWeek !== null) return;

  const result = runSupershow(
    rng,
    {
      player: world.promotion,
      partner,
      deal: booking.deal,
      playerRoster: supershowRoster(world, world.promotion.rosterIds),
      partnerRoster: supershowRoster(world, partner.rosterIds),
      titles: world.titles,
      stables: world.stables,
      territories: world.territories,
      week: world.week,
      settings: world.settings,
    },
    booking,
  );
  if (!result) return;

  world.lastSupershow = result;

  // What they will remember about it. The split of the joint card is the
  // thing a rival booker actually carries, so taking everything costs
  // you the next approach and possibly the one after that.
  const remembered = rememberNight(
    grudgeAgainst(world.grudges, partner.id),
    partner.id,
    {
      playerWins: result.playerWinnerIds.length,
      partnerWins: result.partnerWinnerIds.length,
      showStars: result.show.showStars,
    },
    world.week,
    world.settings,
  );
  world.grudges = world.grudges.filter((g) => g.promotionId !== partner.id);
  if (remembered) {
    world.grudges.push(remembered);
    // Nothing happens off-screen: if the night has cost you a
    // relationship, the wire says so on the night rather than leaving
    // the player to work it out from a refusal six months later.
    world.weeklyNews.push(
      wire('story', `${grudgeLine(remembered, partner.name)}`, world.week, 'minor'),
    );
  }

  // The money. The company banks its share of a gate neither of them
  // could have drawn alone, and pays its own people out of it.
  world.promotion.bankBalance += result.purse.playerNet;

  // And everybody who worked gets paid, which is the whole reason the
  // roster wants to be on this show. Recorded against their career
  // earnings, not just handed over and forgotten.
  for (const [wrestlerId, amount] of Object.entries(result.payouts)) {
    const person = world.wrestlers[wrestlerId];
    if (!person) continue;
    creditPay(ledgerOf(person), amount);
  }

  // §16 amplification. A win on a night like this is worth more than a
  // win on a Tuesday, and a loss costs more.
  const winners = new Set([...result.playerWinnerIds, ...result.partnerWinnerIds]);
  for (const id of Object.keys(result.sideOf)) {
    const person = world.wrestlers[id];
    if (!person) continue;
    if (!(id in result.payouts)) continue;
    const holdsTitle = world.titles.some((t) => t.currentHolderIds.includes(id));
    const stakes = crossPromoStakes(holdsTitle, world.settings);
    const swing = stakes.popularityMultiplier * world.settings.supershowMoraleSwing / 2;
    person.popularity = clamp(person.popularity + (winners.has(id) ? swing : -swing), 0, 100);
    person.morale = clampMorale(
      person.morale + (winners.has(id) ? stakes.moraleSwing : -stakes.moraleSwing),
      world.settings,
    );
  }

  // Who won the night, and what it did to the two companies.
  world.promotion.rating = clamp(
    world.promotion.rating + result.verdict.companyRatingSwing,
    0,
    100,
  );
  partner.rating = clamp(partner.rating - result.verdict.companyRatingSwing, 0, 100);

  world.weeklyNews.push(wire('story', result.verdict.line, world.week, 'lead'));
  world.weeklyNews.push(
    wire(
      'story',
      `The joint show with ${result.partnerName} drew $${result.purse.totalGate.toLocaleString()}. ` +
        `Everybody on the card took $${result.purse.appearanceFee.toLocaleString()}, winners $${result.purse.winBonus.toLocaleString()} on top. ` +
        `No titles changed hands.`,
      world.week,
      'lead',
    ),
  );

  // A card that came up short is a smaller night, and the player is told which
  // it was rather than left to wonder why the gate looked thin.
  if (result.matchesRun < result.agreedSize) {
    world.weeklyNews.push(
      wire(
        'story',
        `The joint show ran ${result.matchesRun} matches against the ${result.agreedSize} the two offices agreed. ` +
          `Neither of them could fill the gaps.`,
        world.week,
        'minor',
      ),
    );
  }
}

/** Who this company can actually put on a joint card tonight. */
export function supershowRoster(world: World, ids: readonly Id[]): Wrestler[] {
  return ids
    .map((id) => world.wrestlers[id])
    .filter((w): w is Wrestler => Boolean(w) && canWork(w!, world.settings, world.week));
}

// ---------------------------------------------------------------------------
// The bidding war
//
// Opening one and settling one, kept together because the invariant that
// matters spans both: exactly one auction runs at a time, and every auction
// that opens settles — whether or not the booker ever looks at it. A pending
// war that could be left hanging would be a way to freeze a star out of the
// business forever by ignoring a dialog.

/** Everybody a promotion is paying this week, for the headroom check. */
export function payrollOf(world: World, promotionId: Id): number {
  const company =
    world.promotion.id === promotionId ? world.promotion : world.rivals.find((r) => r.id === promotionId);
  if (!company) return 0;
  return company.rosterIds.reduce((sum, id) => {
    const member = world.wrestlers[id];
    return sum + (member?.contract?.weeklyRate ?? 0);
  }, 0);
}

/**
 * Open an auction, if this person actually warrants one and enough of the
 * business can afford to turn up. Returns whether one opened.
 */
export function openBiddingWar(world: World, rng: Rng, wrestler: Wrestler, reason: BiddingReason): boolean {
  if (!world.settings.biddingEnabled) return false;
  // One at a time. Two open auctions would mean two blocking dialogs and a
  // player choosing between them, which is not the decision this is about.
  if (world.pendingBiddingWar) return false;
  if (!worthAnAuction(wrestler, world.settings)) return false;

  // Drawn once, before anybody is asked anything — the number is the thing
  // that decides who is even in the room.
  const minimum = askingMinimum(rng, wrestler, world.settings);
  const everyone = [world.promotion, ...world.rivals];
  const interested = interestedIn(
    wrestler,
    everyone,
    {
      weeklyPayroll: (id) => payrollOf(world, id),
      banned: (id) => (id === world.promotion.id ? world.signingBanWeeks > 0 : false),
      minimum,
    },
    world.settings,
  );

  const rivals = interested.filter((p) => p.id !== world.promotion.id);
  // Fewer than two other companies in the room and this is a negotiation, not
  // an auction — the ordinary free-agent flow handles that perfectly well.
  if (rivals.length < world.settings.biddingMinRivals) return false;

  world.pendingBiddingWar = {
    id: `war-${world.nextId++}`,
    wrestlerId: wrestler.id,
    wrestlerName: wrestler.name,
    reason,
    openedWeek: world.week,
    stage: 'invited',
    minimum,
    round: 1,
    reBidReason: null,
    // The player is only invited if they are one of the interested parties.
    // Being told about an auction you could never have entered is noise.
    playerIn: interested.some((p) => p.id === world.promotion.id) ? null : false,
    rivalIds: rivals.map((p) => p.id),
    bids: [],
    result: null,
  };
  world.weeklyNews.push(
    biddingOpenedLine(
      `${invitationLine(world.pendingBiddingWar, wrestler, rivals.length)} ${minimumLine(wrestler, minimum)}`,
      world.week,
    ),
  );
  return true;
}

/** Move somebody onto a roster on the terms that won them. */
export function awardContract(world: World, wrestler: Wrestler, bid: ContractBid, promotionId: Id, books?: StatementBuilder): void {
  const winner =
    world.promotion.id === promotionId ? world.promotion : world.rivals.find((r) => r.id === promotionId);
  if (!winner) return;

  // Wherever they were, they are not there now.
  for (const company of [world.promotion, ...world.rivals]) {
    company.rosterIds = company.rosterIds.filter((id) => id !== wrestler.id);
  }
  world.freeAgents = world.freeAgents.filter((a) => a.wrestlerId !== wrestler.id);

  wrestler.promotionId = winner.id;
  wrestler.contract = {
    ...createStandardContract(wrestler, world.settings, world.settings.startingYear + Math.floor(world.week / 52)),
    weeklyRate: bid.weeklyRate,
    weeksRemaining: bid.weeks,
    totalWeeks: bid.weeks,
    clauses: [...bid.clauses],
    guaranteedPct: guaranteeFor(bid, world.settings),
  };
  winner.rosterIds.push(wrestler.id);
  // The bonus is real money and it leaves the bank the day they sign.
  winner.bankBalance -= bid.signingBonus;
  if (winner.id === world.promotion.id) books?.spend('payroll', bid.signingBonus);
}

/**
 * Take every bid, let them choose, and hand over the contract.
 *
 * Called both when the player answers and when the week rolls over without
 * them — an auction the booker ignored still happens, they just watch it.
 */
export function settleBiddingWar(world: World, rng: Rng, playerBid: ContractBid | null, books?: StatementBuilder): void {
  const war = world.pendingBiddingWar;
  if (!war) return;
  const wrestler = world.wrestlers[war.wrestlerId];
  if (!wrestler) {
    world.pendingBiddingWar = null;
    return;
  }

  const bids: ContractBid[] = [];
  if (playerBid) bids.push(playerBid);
  for (const rivalId of war.rivalIds) {
    const rival = world.rivals.find((r) => r.id === rivalId);
    if (!rival || rival.closedWeek !== null) continue;
    // Null when they cannot make the announced number at all.
    const offer = rivalBid(
      rng,
      wrestler,
      rival,
      {
        weeklyPayroll: payrollOf(world, rival.id),
        minimum: war.minimum,
        rosterStrength: rosterStrengthOf(
          rival.rosterIds.map((id) => world.wrestlers[id]).filter((w): w is Wrestler => Boolean(w)),
          world.settings,
        ),
      },
      world.settings,
    );
    if (offer) bids.push(offer);
  }

  const outcome = decideBids(
    rng,
    wrestler,
    bids,
    {
      promotions: [world.promotion, ...world.rivals],
      relationships: world.relationships,
      rosterOf: (id) => {
        const company =
          world.promotion.id === id ? world.promotion : world.rivals.find((r) => r.id === id);
        return (company?.rosterIds ?? []).map((rid) => world.wrestlers[rid]).filter((w): w is Wrestler => Boolean(w));
      },
      currentPromotionId: wrestler.promotionId,
    },
    world.settings,
    war.round,
    war.minimum,
  );

  // Nobody in the room was worth signing. They say so, and everybody goes
  // again — including the player, who gets a fresh invitation rather than an
  // automatic re-entry, because staying out is still a choice they can make.
  if (outcome?.kind === 'reBid') {
    war.round += 1;
    war.stage = 'invited';
    war.playerIn = war.playerIn === false ? false : null;
    war.reBidReason = outcome.reason;
    world.weeklyNews.push(biddingOpenedLine(outcome.reason, world.week));
    return;
  }

  const result = outcome?.kind === 'signed' ? outcome.result : null;
  if (result) {
    awardContract(world, wrestler, result.bid, result.winningPromotionId, books);
    war.bids = result.allBids;
    war.result = result;
    world.weeklyNews.push(
      biddingSettledLine(
        war.playerIn ? resultLine(war, result) : watchedItLine(war, result),
        world.week,
      ),
    );
  } else {
    // Every door in the room was one they would not walk through. They stay
    // where they are — unsigned, and still in the business.
    world.weeklyNews.push(
      biddingSettledLine(`${war.wrestlerName} signed with nobody. Not one of those offers was worth taking.`, world.week),
    );
  }

  war.stage = 'settled';
  world.lastBiddingWar = { war, result: war.result ?? null } as World['lastBiddingWar'];
  world.pendingBiddingWar = null;
}

/**
 * Apply one event effect, and report the money it moved.
 *
 * The return exists so the weekly statement can account for incidents. An
 * effect that pays a fine or costs a settlement moves the bank balance like
 * anything else, and a statement that cannot see it would close out of
 * balance with its own closing figure.
 */
export function applyEffect(world: World, rng: Rng, effect: EventEffect): number {
  const at = (id: Id): Wrestler | undefined => world.wrestlers[id];
  const bump = (value: number, delta: number) => clamp(value + delta, 0, 100);

  switch (effect.kind) {
    case 'morale': {
      const w = at(effect.wrestlerId);
      if (w) w.morale = clampMorale(w.morale + effect.delta, world.settings);
      break;
    }
    case 'rosterMorale':
      for (const id of world.promotion.rosterIds) {
        const w = at(id);
        if (w) w.morale = clampMorale(w.morale + effect.delta, world.settings);
      }
      break;
    case 'popularity': {
      const w = at(effect.wrestlerId);
      if (w) {
        w.popularity = bump(w.popularity, effect.delta);
        if (w.popularity > w.careerHighPopularity) {
          w.careerHighPopularity = w.popularity;
          w.careerHighWeek = world.week;
        }
      }
      break;
    }
    case 'momentum': {
      const w = at(effect.wrestlerId);
      if (w) w.momentum = bump(w.momentum, effect.delta);
      break;
    }
    case 'health': {
      const w = at(effect.wrestlerId);
      if (w) w.health = bump(w.health, effect.delta);
      break;
    }
    case 'money':
      world.promotion.bankBalance += effect.delta;
      return effect.delta;
    case 'companyRating':
      world.promotion.rating = bump(world.promotion.rating, effect.delta);
      break;
    case 'bookingCredibility':
      world.promotion.bookingCredibility = bump(world.promotion.bookingCredibility, effect.delta);
      break;
    case 'reputation':
      world.promotion.reputation = bump(world.promotion.reputation, effect.delta);
      break;
    case 'shootHeat':
    case 'crowdHeat': {
      const existing = findRivalry(world.rivalries, effect.wrestlerIds);
      if (existing) {
        const index = world.rivalries.findIndex((r) => r.id === existing.id);
        const field = effect.kind === 'shootHeat' ? 'shootHeat' : 'heat';
        world.rivalries[index] = { ...existing, [field]: bump(existing[field], effect.delta) };
      } else if (effect.delta > 0) {
        world.rivalries.push(
          createRivalry(
            `rivalry-${world.nextId++}`,
            effect.wrestlerIds,
            effect.kind === 'shootHeat' ? 'shoot' : 'worked',
            world.week,
            effect.delta,
          ),
        );
      }
      break;
    }
    case 'gimmickChange': {
      const w = at(effect.wrestlerId);
      if (w) {
        // The look follows the character — that's the whole point of granting
        // the request rather than making the player dress them.
        const next = pick(rng, GIMMICKS.filter((g) => g.id !== w.gimmick.id));
        w.gimmick = next;
        w.appearance = applyGimmickLook(w.appearance, next, rng);
        w.gimmickFreshness = 100;
      }
      break;
    }
    case 'alignmentTurn': {
      const w = at(effect.wrestlerId);
      if (w) {
        w.alignment = effect.toward === 'heel' ? -Math.abs(w.alignment || 40) : Math.abs(w.alignment || 40);
        w.crowdReaction = w.alignment;
      }
      break;
    }
    case 'contractRate': {
      const w = at(effect.wrestlerId);
      if (w?.contract) w.contract.weeklyRate = Math.round(w.contract.weeklyRate * effect.multiplier);
      break;
    }
    case 'release': {
      world.promotion.rosterIds = world.promotion.rosterIds.filter((id) => id !== effect.wrestlerId);
      const w = at(effect.wrestlerId);
      if (w) {
        w.promotionId = null;
        w.contract = null;
      }
      break;
    }
    case 'injury': {
      const w = at(effect.wrestlerId);
      if (w) {
        w.health = bump(w.health, -world.settings.casualtyHealthCost);
        // A named cause rather than a generic "Injured" — CLAUDE.md, nothing
        // happens to a person off-screen. The event or incident that caused
        // this already carries the sentence explaining it; this makes sure
        // the roster card agrees with the story.
        const cause = pick(rng, causesFor('competitor', 0));
        const effectGrade = gradeFromLength(effect.weeks, world.settings);
        w.injury = {
          severity: severityOf(effectGrade, world.settings),
          grade: effectGrade,
          description: cause?.label ?? 'Injured',
          sufferedWeek: world.week,
          totalWeeks: effect.weeks,
          weeksRemaining: effect.weeks,
          permanentStatLoss: {},
          earlyReturnWeeksUsed: 0,
        };
        // Written into the body's permanent record, not only the current
        // status. A career is what has already happened to it.
        w.injuryHistory = recordInjury(
          w.injuryHistory ?? [],
          w.injury,
          world.settings.startingYear + Math.floor(world.week / 52),
        );
      }
      break;
    }
    case 'formStable': {
      const founder = at(effect.memberIds[0]!);
      if (!founder) break;
      world.stables.push({
        id: `stable-${world.nextId++}`,
        name: `${founder.name}'s ${effect.name === 'faction' ? 'Faction' : 'Team'}`,
        kind: effect.memberIds.length > 2 ? 'stable' : 'tagTeam',
        memberIds: [...effect.memberIds],
        leaderId: founder.id,
        colors: stableColorsFrom(founder),
        unifiedLook: true,
        formedWeek: world.week,
        disbandedWeek: null,
        record: { wins: 0, losses: 0, draws: 0 },
      });
      break;
    }
    case 'disbandStable': {
      // Marked as broken up rather than deleted — the tag division's history
      // is the point of keeping teams around at all.
      const team = world.stables.find((t) => t.id === effect.stableId);
      if (team && team.disbandedWeek === null) team.disbandedWeek = world.week;
      break;
    }
  }

  // Everything that is not a `money` effect moved no money.
  return 0;
}

/**
 * Run a list of effects and book whatever they cost or paid.
 *
 * Incidents and promos can hand out a bonus or a bill. Routing them through
 * one place keeps the statement honest without every call site remembering.
 */
export function applyEffects(world: World, rng: Rng, effects: readonly EventEffect[], books: StatementBuilder): void {
  for (const effect of effects) {
    const money = applyEffect(world, rng, effect);
    if (money >= 0) books.earn('other', money);
    else books.spend('other', money);
  }
}

/**
 * Everything an incident is allowed to know about a match that just finished.
 *
 * Built here rather than in the engine because it is the one place that can
 * see the whole world at once — who is in which stable, who cannot stand whom,
 * and who was left off the card and could therefore walk through the curtain.
 */
export function incidentContextFor(
  world: World,
  match: {
    competitors: { wrestler: Wrestler; side: number }[];
    winnerIds: Id[];
    finish: FinishType;
    rating: number;
    isMainEvent: boolean;
    titleIds: Id[];
    titleChanged: boolean;
    managers?: { id: Id; name: string; forSide: number }[];
    hasReferee?: boolean;
    availableReturns?: Wrestler[];
  },
): IncidentContext {
  const inMatch = new Set(match.competitors.map((c) => c.wrestler.id));
  const rivalry = findRivalry(world.rivalries, [...inMatch]);
  const title = match.titleIds.map((id) => world.titles.find((t) => t.id === id)).find(Boolean);

  const enemies: [Id, Id][] = world.relationships
    .filter((r) => r.type === 'enemy' && inMatch.has(r.aId) && inMatch.has(r.bId))
    .map((r) => [r.aId, r.bId]);

  return {
    week: world.week,
    isMainEvent: match.isMainEvent,
    rating: match.rating,
    finish: match.finish,
    titleOnTheLine: match.titleIds.length > 0,
    titleChanged: match.titleChanged,
    titleName: title?.name ?? null,
    competitors: match.competitors,
    winnerIds: match.winnerIds,
    loserIds: match.competitors.map((c) => c.wrestler.id).filter((id) => !match.winnerIds.includes(id)),
    managers: match.managers ?? [],
    hasReferee: match.hasReferee ?? false,
    groups: world.stables
      .filter((t) => t.disbandedWeek === null && t.memberIds.filter((id) => inMatch.has(id)).length >= 2)
      .map((t) => ({ id: t.id, name: t.name, memberIds: [...t.memberIds] })),
    enemies,
    heat: rivalry?.heat ?? 0,
    shootHeat: rivalry?.shootHeat ?? 0,
    availableReturns: match.availableReturns ?? [],
    settings: world.settings,
  };
}

/**
 * Who could walk through the curtain during this match.
 *
 * Off the card and fit to work is not enough — they also need a reason to be
 * out there, which means live heat with somebody in the match. Without that
 * condition a run-in was eligible in almost every main event in the business
 * and swamped every other incident.
 */
export function couldTurnUp(
  world: World,
  promotionId: Id,
  booked: ReadonlySet<Id>,
  againstIds: readonly Id[],
): Wrestler[] {
  const company = promotionId === world.promotion.id ? world.promotion : world.rivals.find((r) => r.id === promotionId);
  if (!company) return [];
  const hasSomethingToSettle = (id: Id) =>
    world.rivalries.some(
      (r) => r.resolvedWeek === null && r.participantIds.includes(id) && r.participantIds.some((p) => againstIds.includes(p)),
    );
  return company.rosterIds
    .map((id) => world.wrestlers[id])
    .filter(
      (w): w is Wrestler =>
        Boolean(w) &&
        !booked.has(w!.id) &&
        !w!.injury &&
        !w!.deceased &&
        w!.careerStatus !== 'retired' &&
        hasSomethingToSettle(w!.id),
    );
}
