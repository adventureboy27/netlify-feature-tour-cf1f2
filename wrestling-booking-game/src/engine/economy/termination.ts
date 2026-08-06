// How a deal ends — §3.3.
//
// There were three exits in the fiction and only one in the code: releasing
// somebody was free, instant, and identical whether they had four weeks left
// or eighteen months. That made contract *length* pure upside for the
// promotion, made over-signing costless, and made the `ironClad` clause a lie
// — the game told the player it meant "releasing them costs the full
// remaining term" and then charged nothing.
//
// Now there are three, and they are genuinely different:
//
//   EXPIRY. The deal runs out. He walks, owes nobody anything, and can work
//   for a rival the next day. The cleanest and cheapest exit, and the one you
//   get by planning ahead.
//
//   FIRING. You end it early, so you pay out whatever was guaranteed. He
//   walks free the same day — no restriction, because you are the one who
//   broke it. This is the worst exit on both counts and it is meant to be:
//   the price of a contract you should not have signed.
//
//   A NEGOTIATED RELEASE. He wants out and offers to walk away from the money
//   to get it. You pay nothing and he sits ninety days before he can sign
//   anywhere. Both sides give something up, which is what makes it the
//   interesting one — and why the answer is not automatically yes.
//
// GUARANTEED MONEY is the number all of this turns on. Most of the card has
// none and can be cut for nothing. A draw has all of it and is a liability
// for as long as the paper says.

import { clamp } from '../rng';
import type { Contract, Wrestler, WorldSettings } from '../types';

/** The ways somebody can stop working for you. */
export type ExitKind = 'expiry' | 'fired' | 'negotiatedRelease';

export const EXIT_LABELS: Record<ExitKind, string> = {
  expiry: 'Contract expired',
  fired: 'Released by the promotion',
  negotiatedRelease: 'Asked out and was let go',
};

/**
 * What guaranteed share somebody commands at the negotiating table.
 *
 * Driven by ego, which is what the player moves by pushing somebody — so
 * guaranteed money is the price of having built a star, the same way the
 * clause ladder is. Most of the card asks for none of it and stays
 * disposable; the man you spent two years making demands his money whatever
 * happens, and is a liability for as long as the paper says.
 *
 * (This was keyed to career status first. 'draw' and 'mainEventer' turn out
 * to be so rare — two people in a world of four hundred — that guarantees
 * never once appeared in a five-year save. A rule nobody ever meets is not
 * a rule.)
 */
export function guaranteedShareFor(ego: number, settings: WorldSettings): number {
  if (ego >= settings.egoGuaranteedFull) return 1;
  if (ego >= settings.egoGuaranteedHalf) return 0.5;
  if (ego >= settings.egoGuaranteedPartial) return settings.guaranteedPctPartial;
  return 0;
}

/** What they are asking for, in words, at the table. */
export function guaranteeLabel(ego: number, settings: WorldSettings): string | null {
  const share = guaranteedShareFor(ego, settings);
  if (share <= 0) return null;
  if (share >= 1) return 'Every penny guaranteed — you cannot cut them for free, ever';
  if (share >= 0.5) return 'Half the deal guaranteed';
  return 'Part of the deal guaranteed';
}

/**
 * What it costs to end this deal today.
 *
 * The money is owed on the term remaining, not the term signed, so a bad
 * contract gets cheaper to escape the longer you sit on it — which is a real
 * decision when somebody is finished but still owed a year.
 */
export function severanceOwed(contract: Contract | null): number {
  if (!contract) return 0;
  const guaranteed = contract.clauses.includes('ironClad') ? 1 : contract.guaranteedPct;
  return Math.round(contract.weeklyRate * Math.max(0, contract.weeksRemaining) * clamp(guaranteed, 0, 1));
}

/** In words, what cutting them today would mean. Never a bare number. */
export type SeveranceWeight = 'Free to cut' | 'Cheap to cut' | 'Expensive to cut' | 'You are stuck with them';

export function severanceWeight(contract: Contract | null, bankBalance: number): SeveranceWeight {
  const owed = severanceOwed(contract);
  if (owed <= 0) return 'Free to cut';
  if (owed > bankBalance) return 'You are stuck with them';
  if (owed > bankBalance * 0.25) return 'Expensive to cut';
  return 'Cheap to cut';
}

export interface ExitTerms {
  kind: ExitKind;
  /** What the promotion pays on the way out. */
  severance: number;
  /** Weeks before anybody, including you, can sign them again. */
  noCompeteWeeks: number;
  /** The line the newsfeed runs. Nothing happens to a person off-screen. */
  text: string;
}

/**
 * The terms of one exit, resolved.
 *
 * A single function for all three so the asymmetry is stated in one place
 * rather than scattered across the store: the side that breaks the deal pays,
 * and the side that asks out waits.
 */
export function exitTerms(
  wrestler: Wrestler,
  kind: ExitKind,
  settings: WorldSettings,
  promotionName: string,
): ExitTerms {
  if (kind === 'expiry') {
    return {
      kind,
      severance: 0,
      noCompeteWeeks: 0,
      text: `${wrestler.name}'s contract with ${promotionName} has run out. He is free to sign anywhere, today.`,
    };
  }

  if (kind === 'fired') {
    const severance = severanceOwed(wrestler.contract);
    return {
      kind,
      severance,
      // You broke it, so you do not also get to keep him off television.
      noCompeteWeeks: 0,
      text:
        severance > 0
          ? `${promotionName} have released ${wrestler.name} and paid off what was left of his deal. He can sign anywhere immediately.`
          : `${promotionName} have released ${wrestler.name}. There was nothing guaranteed on the deal, so it cost them nothing.`,
    };
  }

  return {
    kind,
    // He asked out. Walking away from the money is what he is offering.
    severance: 0,
    noCompeteWeeks: settings.noCompeteWeeks,
    text: `${wrestler.name} asked for his release and ${promotionName} granted it. He tore up what he was owed, and he cannot work anywhere for ninety days.`,
  };
}

/** Is this person legally able to sign for anybody right now? */
export function canBeSigned(wrestler: Wrestler): boolean {
  return (wrestler.noCompeteWeeks ?? 0) <= 0;
}

/** How long they are sitting out, in words. */
export function noCompeteLabel(wrestler: Wrestler): string | null {
  const weeks = wrestler.noCompeteWeeks ?? 0;
  if (weeks <= 0) return null;
  if (weeks <= 2) return 'Free to sign shortly';
  if (weeks <= 6) return 'Sitting out his notice';
  return 'Ninety days, just started';
}

/**
 * Would this person ask to be let go?
 *
 * Only the unhappy, and never out of nowhere — morale is visible on the
 * roster card long before it gets here, so a request is the consequence of
 * something the player watched happen.
 */
export function wantsOut(wrestler: Wrestler, settings: WorldSettings): boolean {
  if (wrestler.morale > settings.releaseRequestMorale) return false;
  if (!wrestler.contract) return false;
  // Somebody with a year of guaranteed money is not in a hurry to tear it up.
  return severanceOwed(wrestler.contract) < wrestler.contract.weeklyRate * 26;
}

/**
 * What refusing costs.
 *
 * Saying no is allowed and often correct — he is still your wrestler and he
 * still has to work. He just gets unhappier every week you make him, which
 * eventually turns into the locker-room problems the morale system already
 * models.
 */
export function refusalCost(settings: WorldSettings): number {
  return settings.releaseRefusedMoraleCost;
}
