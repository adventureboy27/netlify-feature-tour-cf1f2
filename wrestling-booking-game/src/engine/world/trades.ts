// Trades — moving somebody on, and the contract that goes with them.
//
// The whole reason this is interesting is that a CONTRACT TRAVELS WITH THE
// WRESTLER. A trade is not "swap two names", it is "swap two names and two
// sets of obligations", so the deal you regret is a thing you can try to make
// somebody else's problem — and they can see you doing it.
//
// That means the valuation has two halves that pull against each other:
//
//   WORTH is what they draw. Curved off popularity so a genuine draw is worth
//   several midcarders rather than a few more points than one, because a
//   linear scale makes every trade a wash.
//
//   BURDEN is what they cost to keep and what they cost to get rid of — the
//   wage for the term remaining, plus the severance you would owe if you ever
//   wanted out. A star on a fully guaranteed eighty-week deal can be worth
//   *less than nothing*, which is exactly the dynamic guaranteed money was
//   built to create.
//
// The acceptance margin is what stops the player laundering bad paper through
// the AI. A rival does not trade at par. They have to come out ahead, and if
// they do not, they say so in words.
//
// A NO-TRADE CLAUSE beats all of it. Somebody with enough leverage to demand
// one cannot be moved at any price, whatever they later become — which is the
// cost of having agreed to it two years earlier.

import { clamp } from '../rng';
import type { Id, Promotion, Wrestler, WorldSettings } from '../types';
import { severanceOwed } from '../economy/termination';
import { askingRate } from '../economy/contracts';

/**
 * What a wrestler is worth to somebody else, contract and all.
 *
 * The burden is what they are OVERPAID by, not what they are paid. Charging
 * the gross wage bill against an abstract worth score compares two different
 * units — and the moment wages were re-tuned upward it turned the entire
 * roster into liabilities and killed the trade market outright. Measuring
 * against the going rate is scale-independent: somebody on a fair deal is
 * worth what they draw, a bargain is an asset, and a bloated guaranteed deal
 * is the thing nobody will take.
 */
export function tradeValue(wrestler: Wrestler, settings: WorldSettings): number {
  const draw = clamp(wrestler.popularity / 100, 0, 1);
  const worth = draw ** settings.tradeValueCurve * settings.tradeValueScale;

  const contract = wrestler.contract;
  if (!contract) return Math.round(worth);

  // How far above the going rate this deal sits, over the term left to run.
  const fair = askingRate(wrestler, settings);
  const overpayment = ((contract.weeklyRate - fair) * Math.max(0, contract.weeksRemaining)) / 100;

  // Plus the money genuinely at risk: what it would cost to get out of it.
  const atRisk = severanceOwed(contract) / 100;

  return Math.round(worth - (overpayment + atRisk) * settings.tradeContractBurdenWeight);
}

/** Whether somebody can be moved at all, and why not. */
export function canBeTraded(wrestler: Wrestler): { ok: boolean; reason: string | null } {
  if (wrestler.deceased) return { ok: false, reason: 'They are gone.' };
  if (wrestler.careerStatus === 'retired') return { ok: false, reason: 'They have retired.' };
  if (wrestler.role !== 'wrestler') return { ok: false, reason: 'They are not on the active roster.' };
  if (!wrestler.contract) return { ok: false, reason: 'They are not under contract.' };
  if (wrestler.contract.clauses.includes('noTrade')) {
    // The cost of a clause you agreed to two years ago, arriving late.
    return { ok: false, reason: 'They have a no-trade clause. Whatever they become, they are yours.' };
  }
  if (wrestler.injury) return { ok: false, reason: 'Nobody trades for somebody who cannot work.' };
  return { ok: true, reason: null };
}

export interface TradeOffer {
  /** Who you are sending. */
  outgoing: Wrestler;
  /** Who you want back, if anybody. */
  incoming: Wrestler | null;
  /** Cash you are adding to make it work. Negative means cash coming to you. */
  cashFromYou: number;
}

export interface TradeContext {
  offer: TradeOffer;
  /** The company being asked. */
  them: Promotion;
  /** How many wrestlers they have, so a thin roster values bodies. */
  theirRosterSize: number;
  targetRosterSize: number;
  settings: WorldSettings;
}

export interface TradeVerdict {
  accepted: boolean;
  /** What they say, in words. Never a number. */
  reason: string;
}

/**
 * Would they do it?
 *
 * Everything that decides this is something the player can see before they
 * ask: who is on the table, what each is owed, and how thin the other roster
 * is. No hidden dice — a refusal is information, and the reason says which
 * half of the deal was wrong.
 */
export function evaluateTrade(ctx: TradeContext): TradeVerdict {
  const { offer, settings } = ctx;

  const mine = canBeTraded(offer.outgoing);
  if (!mine.ok) return { accepted: false, reason: mine.reason ?? 'That one cannot be moved.' };

  if (offer.incoming) {
    const theirs = canBeTraded(offer.incoming);
    if (!theirs.ok) {
      return { accepted: false, reason: `They will not part with him — ${(theirs.reason ?? '').toLowerCase()}` };
    }
  }

  // What each side ends up holding. Cash counts at face value against the
  // same scale the wrestlers are measured on.
  const cashInTheirFavour = offer.cashFromYou / 100;
  const theyGain = tradeValue(offer.outgoing, settings) + cashInTheirFavour;
  const theyGiveUp = offer.incoming ? tradeValue(offer.incoming, settings) : 0;

  // A company that cannot fill a card values a warm body more than the
  // spreadsheet says, which is what makes a thin rival a trading partner.
  const shortfall = Math.max(0, ctx.targetRosterSize - ctx.theirRosterSize);
  const desperation = 1 + shortfall * 0.06;

  const incomingWage = offer.outgoing.contract?.weeklyRate ?? 0;
  const outgoingWage = offer.incoming?.contract?.weeklyRate ?? 0;
  const extraWeekly = incomingWage - outgoingWage;
  // They will not take on a wage they cannot service out of what they clear.
  const affordable = extraWeekly <= 0 || extraWeekly <= ctx.them.bankBalance * settings.tradeAffordabilityShare;
  if (!affordable) {
    return { accepted: false, reason: `${ctx.them.name} cannot carry that wage.` };
  }

  // The surplus they need on top of what they give up.
  //
  // Expressed as an amount rather than as a multiplier because a multiplier
  // inverts on negative values: somebody worth -90 times a 1.15 margin is
  // -103, which *lowers* the bar, so handing over a liability read as a good
  // deal for the other side. Scaled by the size of what is moving, with a
  // floor so a swap of two worthless contracts still has to be worth doing.
  const stake = Math.max(Math.abs(theyGiveUp), Math.abs(theyGain));
  const surplusNeeded = Math.max(20, stake * (settings.tradeAcceptanceMargin - 1));

  if (theyGain * desperation >= theyGiveUp + surplusNeeded) {
    return { accepted: true, reason: `${ctx.them.name} will do that deal.` };
  }

  // Say which way it is wrong, because "no" on its own is not information.
  if (theyGiveUp <= 0 && theyGain <= 0) {
    return {
      accepted: false,
      reason: `Nobody wants ${offer.outgoing.name} on that contract.`,
    };
  }
  if (offer.incoming) {
    return {
      accepted: false,
      reason: `${ctx.them.name} rate ${offer.incoming.name} well above that. Add more.`,
    };
  }
  return { accepted: false, reason: `${ctx.them.name} are not interested at that price.` };
}

/** How a trade reads on the wire. */
export function tradeLine(
  outgoingName: string,
  incomingName: string | null,
  yourName: string,
  theirName: string,
  cashFromYou: number,
): string {
  const back = incomingName
    ? ` in exchange for ${incomingName}`
    : cashFromYou < 0
      ? ' for cash'
      : '';
  const sweetener = cashFromYou > 0 ? `, with ${yourName} adding cash` : '';
  return `${yourName} have traded ${outgoingName} to ${theirName}${back}${sweetener}.`;
}

/** In words, what somebody is worth on the market. Never a number. */
export type TradeWorth = 'A liability' | 'Hard to move' | 'Tradeable' | 'Wanted' | 'Everybody wants him';

export function tradeWorth(wrestler: Wrestler, settings: WorldSettings): TradeWorth {
  const value = tradeValue(wrestler, settings);
  if (value <= 0) return 'A liability';
  if (value < 60) return 'Hard to move';
  if (value < 250) return 'Tradeable';
  if (value < 550) return 'Wanted';
  return 'Everybody wants him';
}

/** Rivals who would even take the call this week. */
export function tradePartners(
  rivals: readonly Promotion[],
  refusedRecently: Readonly<Record<Id, number>>,
  week: number,
  settings: WorldSettings,
): Promotion[] {
  return rivals.filter(
    (r) => r.closedWeek === null && week - (refusedRecently[r.id] ?? -Infinity) >= settings.tradeCooldownWeeks,
  );
}
