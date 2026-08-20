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
  Relationship,
  Segment,
  Title,
  TitleReignEndMethod,
  Wrestler,
} from '../engine/types';
import { findRelationship } from '../engine/career/relationships';
import { applyDrift } from '../engine/career/circle';
import { disciplineOf, sanctionFor, applySanction } from '../engine/career/discipline';
import type { Leave } from '../engine/career/onOurWatch';
import { wontWorkForUs, stillHeldAgainstUs } from '../engine/career/onOurWatch';
import { canSign } from '../engine/world/freeAgents';
import type { EventEffect } from '../engine/events/types';
import type { World } from './world';
import type { Rng } from '../engine/rng';
import { clamp, pick, chance, shuffle } from '../engine/rng';
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
import { exitTerms, canBeSigned, guaranteedShareFor } from '../engine/economy/termination';
import { loanTermsFor, buildLoan, loanCooldownCleared, type LoanTier } from '../engine/economy/loan';
import { rollBuyoutTerms } from '../engine/economy/buyout';
import { isFired } from '../engine/world/mandates';
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

  // A confrontation that actually goes physical is the one part of the
  // segment genuinely worth a decision — see confrontationCall.ts. The
  // segment's own rating/write-up are already locked in above; only the
  // injury itself waits on an answer, and only the first one this week (a
  // second physical confrontation the same night just goes through as
  // rolled — one open decision at a time, same as every other pending call).
  if (outcome.casualty && !world.pendingConfrontationCall) {
    const hurt = wrestlerById.get(outcome.casualty.wrestlerId);
    if (hurt && !hurt.injury) {
      const other = hurt.id === speaker.id ? opposite : speaker;
      world.pendingConfrontationCall = {
        week: world.week,
        wrestlerId: hurt.id,
        wrestlerName: hurt.name,
        otherName: other.name,
        twistLabel: outcome.twistLabel,
        weeks: outcome.casualty.weeks,
      };
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
 * Close a company down. Every belt it held goes vacant immediately — a
 * champion still needs a company behind them to defend it for — and the
 * roster goes up for the booker to pick through: whoever they want, one at a
 * time, with a rival's competing interest the only thing that turns a pick
 * into a real contest. See pickFromFoldedRoster/finishFoldPicking.
 */
export function closePromotion(world: World, promotion: Promotion): void {
  promotion.closedWeek = world.week;

  const roster = promotion.rosterIds.map((id) => world.wrestlers[id]).filter((w): w is Wrestler => Boolean(w));
  for (const title of world.titles) {
    if (title.promotionId !== promotion.id || title.vacant) continue;
    stripTitle(world, title, 'promotionFolded');
  }

  world.pendingFoldPicks = {
    fromPromotionId: promotion.id,
    fromPromotionName: promotion.name,
    wrestlerIds: roster.map((w) => w.id),
    openedWeek: world.week,
  };

  promotion.rosterIds = [];
  promotion.titleIds = [];
  promotion.bankBalance = 0;
}

/**
 * The booker reaches for one specific wrestler off a folded roster. If no
 * rival wants them too, they're signed on the spot — this is a pick, not a
 * negotiation. If a rival does want them, it's a real contest and goes
 * through the bidding-war module instead (queued if one is already running).
 */
export function pickFromFoldedRoster(world: World, rng: Rng, wrestlerId: Id): void {
  const pending = world.pendingFoldPicks;
  if (!pending || !pending.wrestlerIds.includes(wrestlerId)) return;
  const wrestler = world.wrestlers[wrestlerId];
  if (!wrestler) return;

  pending.wrestlerIds = pending.wrestlerIds.filter((id) => id !== wrestlerId);

  const minimum = askingMinimum(rng, wrestler, world.settings);
  const rivalsInterested = interestedIn(
    wrestler,
    world.rivals,
    { weeklyPayroll: (id) => payrollOf(world, id), minimum },
    world.settings,
  );

  if (rivalsInterested.length === 0) {
    signPickedWrestler(world, wrestler);
    return;
  }

  // Contested. Only one bidding war can run at a time, so anything already
  // in progress means this one waits its turn.
  if (world.pendingBiddingWar) {
    world.foldBidQueue.push(wrestlerId);
    return;
  }
  if (!openBiddingWar(world, rng, wrestler, 'foldPickup')) {
    // The interest check above and openBiddingWar's own don't ask exactly
    // the same question (affordability against a freshly-drawn minimum vs.
    // the announced one) — on the rare miss, the pick still goes through
    // rather than vanishing.
    signPickedWrestler(world, wrestler);
  }
}

/** Sign a folded-roster pick straight onto the roster, same guardrails as an ordinary free-agent signing. */
function signPickedWrestler(world: World, wrestler: Wrestler): void {
  if (!canSign(wrestler, world.promotion.bankBalance, world.settings)) return;
  if (!canBeSigned(wrestler)) return;
  const held = stillHeldAgainstUs(world.promotion.deathsOnOurWatch ?? [], world.week, world.settings);
  if (wontWorkForUs(wrestler, held, world.settings)) return;

  wrestler.promotionId = world.promotion.id;
  wrestler.contract = {
    ...createStandardContract(wrestler, world.settings, world.settings.startingYear, desiredContractWeeks(wrestler, world.settings)),
    weeklyRate: askingRate(wrestler, world.settings),
    guaranteedPct: guaranteedShareFor(wrestler.ego, world.settings),
  };
  world.promotion.rosterIds.push(wrestler.id);
}

/**
 * The booker is done browsing. Whoever is left in the pool — passed over, or
 * never gotten to — goes into ordinary free agency, same as any other
 * release. Nobody vanishes; everybody lands somewhere.
 */
export function finishFoldPicking(world: World): void {
  const pending = world.pendingFoldPicks;
  if (!pending) return;
  for (const id of pending.wrestlerIds) {
    const w = world.wrestlers[id];
    if (!w) continue;
    w.promotionId = null;
    w.contract = null;
    world.freeAgents.push({
      wrestlerId: id,
      reason: 'released',
      askingRate: askingRate(w, world.settings),
      wantsWeeks: desiredContractWeeks(w, world.settings),
      weeksUnsigned: 0,
    });
  }
  world.pendingFoldPicks = null;
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
  // A fold pickup earns its place in the room by the booker wanting them and
  // a rival wanting them too — that is the whole test. The ordinary
  // star/phenom popularity gate would exclude exactly the mid-card wrestlers
  // this pass is about surfacing.
  if (reason !== 'foldPickup' && !worthAnAuction(wrestler, world.settings)) return false;

  // Drawn once, before anybody is asked anything — the number is the thing
  // that decides who is even in the room.
  const minimum = askingMinimum(rng, wrestler, world.settings);
  // A fold pickup skips interestedIn's own desire test for the player: they
  // already expressed it by picking this exact wrestler off the folded
  // roster, so testing it again against a generic popularity-vs-rating
  // formula could contradict the click they just made. Rivals still go
  // through the ordinary desire test — that is what decides whether the
  // pick is actually contested.
  const everyone = reason === 'foldPickup' ? world.rivals : [world.promotion, ...world.rivals];
  const interested = interestedIn(
    wrestler,
    everyone,
    {
      weeklyPayroll: (id) => payrollOf(world, id),
      minimum,
    },
    world.settings,
  );

  const rivals = interested.filter((p) => p.id !== world.promotion.id);
  // Fewer than two other companies in the room and this is a negotiation, not
  // an auction — the ordinary free-agent flow handles that perfectly well.
  // A fold pickup is different: the booker already reached for this one
  // specifically, so a single rival also wanting them is the whole contest —
  // "any that they choose that other companies also want."
  const minRivals = reason === 'foldPickup' ? 1 : world.settings.biddingMinRivals;
  if (rivals.length < minRivals) return false;

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
    // Being told about an auction you could never have entered is noise. A
    // fold pickup always invites the player — see above.
    playerIn: reason === 'foldPickup' || interested.some((p) => p.id === world.promotion.id) ? null : false,
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
  } else if (war.reason === 'foldPickup') {
    // Every door in the room was one they would not walk through. Unlike an
    // ordinary bidding war they have nowhere to "stay" — the promotion that
    // employed them is gone — so they land in free agency like anybody else
    // the booker didn't pick.
    wrestler.promotionId = null;
    wrestler.contract = null;
    world.freeAgents.push({
      wrestlerId: wrestler.id,
      reason: 'released',
      askingRate: askingRate(wrestler, world.settings),
      wantsWeeks: desiredContractWeeks(wrestler, world.settings),
      weeksUnsigned: 0,
    });
    world.weeklyNews.push(
      biddingSettledLine(`${war.wrestlerName} signed with nobody. Not one of those offers was worth taking.`, world.week),
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

  // The booker can pick several contested wrestlers off one folded roster,
  // but only one bidding war can ever be open — so the rest queue and open
  // one at a time as each settles. Harmless no-op when the queue is empty or
  // this wasn't a fold pickup at all.
  while (world.foldBidQueue.length > 0 && !world.pendingBiddingWar) {
    const nextId = world.foldBidQueue.shift()!;
    const next = world.wrestlers[nextId];
    if (!next) continue;
    // Same fallback as the non-queued pick: if the recheck disagrees with
    // whatever queued this one, the pick still goes through rather than the
    // wrestler quietly vanishing with no resolution at all.
    if (!openBiddingWar(world, rng, next, 'foldPickup')) {
      signPickedWrestler(world, next);
    }
  }
}

// ---------------------------------------------------------------------------
// The loan
//
// The player's one real lifeline against bankruptcy — see economy/loan.ts
// for the reasoning behind the shape of it. No RNG anywhere in here: the
// offer is a pure function of payroll, attempt number, and how long the
// cooldown has run, so nothing here can shift a seeded roll.

/**
 * Should the bank make an offer this week? Called from resolveWeek, right
 * where the hard bankruptcy check already lives — the two share the same
 * `weeksInTheRed` reading, but the loan fires well before the grace period
 * runs out, since the whole point is to be a way off the countdown, not a
 * consolation prize once it is too late to matter.
 */
export function maybeOfferLoan(world: World): void {
  if (!world.settings.loanEnabled) return;
  if (world.activeLoan || world.pendingLoanOffer) return;
  if (world.weeksInTheRed < world.settings.loanTriggerWeeksInTheRed) return;
  if (!loanCooldownCleared(world.loansTaken, world.solventWeeksSinceLastLoan, world.settings)) return;

  world.pendingLoanOffer = {
    attemptNumber: world.loansTaken + 1,
    openedWeek: world.week,
    payrollAtOffer: payrollOf(world, world.promotion.id),
  };
}

/**
 * A pending offer that sat unanswered a full week lapses — same one-week
 * grace every other pending decision in the game gets before it is swept.
 * Silent on purpose: the bank does not send a reminder, it just stops
 * waiting.
 */
export function expireStaleLoanOffer(world: World): void {
  if (world.pendingLoanOffer && world.pendingLoanOffer.openedWeek < world.week) {
    world.pendingLoanOffer = null;
  }
}

/** The booker answers the offer — a tier, or nothing at all. */
export function answerLoanOffer(world: World, tier: LoanTier | null): void {
  const offer = world.pendingLoanOffer;
  if (!offer) return;
  world.pendingLoanOffer = null;

  if (!tier) {
    world.weeklyNews.push(
      wire('story', 'The booker turned down the bank. Whatever happens next, they will face it on their own.', world.week, 'minor'),
    );
    return;
  }

  const terms = loanTermsFor(offer.attemptNumber, offer.payrollAtOffer, world.settings);
  const loan = buildLoan(tier, terms, world.week);
  world.activeLoan = loan;
  world.loansTaken += 1;
  world.solventWeeksSinceLastLoan = 0;
  world.promotion.bankBalance += loan.borrowed;

  world.weeklyNews.push(
    wire(
      'story',
      `The bank came through: $${loan.borrowed.toLocaleString()} against the promotion, ` +
        `$${loan.weeklyPayment.toLocaleString()} a week for the next ${loan.weeksRemaining} weeks. ` +
        `It cannot be deferred.`,
      world.week,
      'lead',
    ),
  );

  if (world.settings.ownerMandatesEnabled && !world.fired) {
    world.mandateStrikes += terms.mandateStrikes;
    if (isFired(world.mandateStrikes, world.settings)) {
      world.fired = {
        week: world.week,
        reason: 'The owner heard about the loan before the booker could explain it. That was the last straw.',
      };
    }
  }
}

/**
 * The weekly tick: pay what is owed, unconditionally, and track whether the
 * business has earned the right to ask again. Called right before the
 * existing bankruptcy check, so a loan payment that itself tips the
 * promotion into the red is exactly the risk it is supposed to be — this
 * buys time, it does not buy immunity.
 */
export function tickLoan(world: World): void {
  if (world.activeLoan) {
    world.promotion.bankBalance -= world.activeLoan.weeklyPayment;
    world.activeLoan.weeksRemaining -= 1;
    if (world.activeLoan.weeksRemaining <= 0) {
      world.weeklyNews.push(wire('story', 'The loan is paid off. The books are the promotion\'s own again.', world.week, 'minor'));
      world.activeLoan = null;
    }
  }

  // Only a genuinely clean week counts — still repaying, or still in the
  // red, and the climb back to being trusted again starts over.
  if (!world.activeLoan && world.promotion.bankBalance >= 0) {
    world.solventWeeksSinceLastLoan += 1;
  } else {
    world.solventWeeksSinceLastLoan = 0;
  }
}

// ---------------------------------------------------------------------------
// The blind bulk buyout
//
// See economy/buyout.ts for the reasoning: only while an active loan means
// the promotion is genuinely drowning, and the booker never chooses who
// goes. The trigger roll here takes an rng the caller has already isolated
// (resolveWeek passes a per-week seed — see the CLAUDE.md note on why a
// weekly roll can never draw from the shared stream, even a gated one).
// `answerBuyoutOffer` is a player action, so it uses the shared stream, same
// as every other player-triggered draw in this file.

/** Should a rival make this offer this week? */
export function maybeOfferBuyout(world: World, rng: Rng): void {
  if (!world.settings.buyoutEnabled) return;
  if (!world.activeLoan) return;
  if (world.pendingBuyoutOffer) return;
  if (!chance(rng, world.settings.buyoutWeeklyChance)) return;

  const terms = rollBuyoutTerms(
    rng,
    payrollOf(world, world.promotion.id),
    world.promotion.rosterIds.length,
    world.settings,
  );
  // Only a company that can actually pay is a real offer. Skip silently —
  // there is always another week while the loan is still running.
  const affording = world.rivals.filter((r) => r.closedWeek === null && r.bankBalance >= terms.price);
  if (affording.length === 0) return;
  const buyer = pick(rng, affording);

  world.pendingBuyoutOffer = {
    openedWeek: world.week,
    fromPromotionId: buyer.id,
    fromPromotionName: buyer.name,
    count: terms.count,
    price: terms.price,
  };
  world.weeklyNews.push(
    wire(
      'story',
      `${buyer.name} has made an offer: ${terms.count} contracts, no names attached, for $${terms.price.toLocaleString()}.`,
      world.week,
      'lead',
    ),
  );
}

/** Same one-week grace every other pending decision gets before it lapses. */
export function expireStaleBuyoutOffer(world: World): void {
  const offer = world.pendingBuyoutOffer;
  if (offer && offer.openedWeek < world.week) {
    world.weeklyNews.push(
      wire('story', `${offer.fromPromotionName}'s offer went unanswered. It is off the table.`, world.week, 'minor'),
    );
    world.pendingBuyoutOffer = null;
  }
}

/** The booker says yes or no, before knowing who it costs. */
export function answerBuyoutOffer(world: World, rng: Rng, accept: boolean): void {
  const offer = world.pendingBuyoutOffer;
  if (!offer) return;
  world.pendingBuyoutOffer = null;

  const buyer = world.rivals.find((r) => r.id === offer.fromPromotionId);
  if (!accept || !buyer || buyer.closedWeek !== null) {
    world.weeklyNews.push(
      wire(
        'story',
        `The booker turned down ${offer.fromPromotionName}'s offer. Whatever this roster is worth, it is not for sale sight unseen — not today.`,
        world.week,
        'minor',
      ),
    );
    return;
  }

  world.promotion.bankBalance += offer.price;

  const roster = [...world.promotion.rosterIds];
  const taken = shuffle(rng, roster).slice(0, Math.min(offer.count, roster.length));
  const takenSet = new Set(taken);
  world.promotion.rosterIds = world.promotion.rosterIds.filter((id) => !takenSet.has(id));

  const takenNames: string[] = [];
  let championsTaken = 0;
  for (const id of taken) {
    const w = world.wrestlers[id];
    if (!w) continue;
    takenNames.push(w.name);

    // Their title, if any, does not travel with them.
    for (const title of world.titles) {
      if (title.promotionId === world.promotion.id && !title.vacant && title.currentHolderIds.includes(id)) {
        championsTaken += 1;
        stripTitle(world, title, 'soldOff');
      }
    }

    w.promotionId = buyer.id;
    w.contract = {
      ...createStandardContract(w, world.settings, world.settings.startingYear, desiredContractWeeks(w, world.settings)),
      weeklyRate: askingRate(w, world.settings),
      guaranteedPct: guaranteedShareFor(w.ego, world.settings),
    };
    buyer.rosterIds.push(id);
  }

  // The rest of the room hears about it — several colleagues gone at once,
  // to a company nobody chose, for a price nobody in the room will ever see.
  for (const id of world.promotion.rosterIds) {
    const member = world.wrestlers[id];
    if (!member || member.deceased) continue;
    member.morale = clampMorale(member.morale + world.settings.buyoutTeammateMoraleDelta, world.settings);
  }

  world.weeklyNews.push(
    wire(
      'story',
      `${offer.fromPromotionName} paid $${offer.price.toLocaleString()} for ${taken.length} contracts, sight unseen: ${takenNames.join(', ')}.` +
        (championsTaken > 0
          ? ` ${championsTaken === 1 ? 'A championship goes' : `${championsTaken} championships go`} with them.`
          : ''),
      world.week,
      'lead',
    ),
  );
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
    case 'relationship': {
      const existing = findRelationship(world.relationships, effect.aId, effect.bId);
      if (existing) {
        existing.strength = applyDrift(existing, effect.delta);
      } else {
        const relationship: Relationship = {
          aId: effect.aId,
          bId: effect.bId,
          type: effect.delta >= 0 ? 'friend' : 'enemy',
          strength: clamp(50 + effect.delta, 0, 100),
          history: [],
        };
        world.relationships.push(relationship);
      }
      break;
    }
    case 'fatigue': {
      const w = at(effect.wrestlerId);
      if (w) w.fatigueDebt = bump(w.fatigueDebt, effect.delta);
      break;
    }
    case 'leave': {
      const w = at(effect.wrestlerId);
      if (w) {
        const leave: Leave = { reason: effect.reason, weeksRemaining: effect.weeks, paid: true };
        w.leave = leave;
      }
      break;
    }
    case 'contractType': {
      const w = at(effect.wrestlerId);
      if (w?.contract) w.contract.type = effect.type;
      break;
    }
    case 'violation': {
      const w = at(effect.wrestlerId);
      if (w) {
        const file = disciplineOf(w);
        const sanction = sanctionFor(
          file,
          effect.violationKind,
          w.contract?.weeklyRate ?? world.settings.contractBaseWeeklyRate,
          world.settings,
        );
        applySanction(file, effect.violationKind, sanction, world.week);
      }
      break;
    }
    case 'wire': {
      // Plain world.week, not +1 — unlike a line pushed from inside
      // resolveWeek (see the CLAUDE.md trap), applyEffect for a creative
      // event only ever runs from chooseEventOption, which fires between
      // resolveWeek calls. world.week already reflects "now" here; the
      // +1 dodge is for code racing resolveWeek's own increment, which
      // this isn't.
      world.weeklyNews.push(wire(effect.wireKind, effect.text, world.week, 'minor'));
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
