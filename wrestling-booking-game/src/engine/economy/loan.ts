// The one real lifeline against bankruptcy, and what it costs.
//
// Built directly from a conversation with the player about running a
// promotion into the ground: it should be attainable, and it should be
// difficult, and it should not be a number the player can quietly solve.
// Three decisions came out of that conversation, in order:
//
//   1. Not a flat dollar figure. $250,000 (the number rivals already get
//      bailed out at) is nothing to a $400k-starting company and more money
//      than a $25k-starting one has ever seen — sized against the
//      promotion's own current payroll instead, so it means the same thing
//      at any point in a save that can run for decades.
//   2. Not one-time-ever. A save that runs decades will outlive a single
//      lifeline being permanently spent in year three, and a one-shot rule
//      quietly teaches a careful player to hoard it against an imagined
//      worse crisis instead of using it when they actually need it. Instead:
//      unlimited attempts, each one harsher than the last, gated behind a
//      real cooldown — the business has to demonstrate it can stand on its
//      own again before anyone will lend to it a second time.
//   3. The escalation is cumulative and never resets. Staying solvent earns
//      back *access* (the cooldown clears); it does not erase the fact that
//      this promotion has needed rescuing before. The fourth loan is not the
//      first loan with a wait attached — it is a company the business has
//      stopped trusting.

import type { WorldSettings } from '../types';

export type LoanTier = 'small' | 'medium' | 'large';

export interface LoanTerms {
  /** 1st, 2nd, 3rd... — everything below is read off this. */
  attemptNumber: number;
  /** What the ceiling is sized against, so the offer can show its work. */
  weeklyPayroll: number;
  /** The full ceiling, before a tier fraction is taken of it. */
  ceiling: number;
  tiers: Record<LoanTier, number>;
  /** How much comes back for every dollar borrowed. 1.3 means 130%. */
  repaymentMultiple: number;
  /** Weeks the repayment is spread over — fixed once taken, never adjusted. */
  repaymentWeeks: number;
  /** Solvent weeks required, loan-free, before the next offer can appear. */
  cooldownWeeks: number;
  /** Added to World.mandateStrikes the moment the loan is taken. */
  mandateStrikes: number;
}

/** Which attempt this is reads off unlimited history, but the terms only get harsher through the third. */
function attemptIndex(attemptNumber: number): 1 | 2 | 3 {
  if (attemptNumber <= 1) return 1;
  if (attemptNumber === 2) return 2;
  return 3;
}

/**
 * What a loan looks like right now, for a promotion about to be offered one.
 *
 * Pure: takes the payroll and the attempt number, hands back the ceiling,
 * the three tiers, and the terms that attempt carries. Nothing here decides
 * *whether* to offer one — that is resolveWeek's trigger, reading
 * World.weeksInTheRed and the cooldown counter. This only prices the offer
 * once the trigger has already fired.
 */
export function loanTermsFor(attemptNumber: number, weeklyPayroll: number, settings: WorldSettings): LoanTerms {
  const n = attemptIndex(attemptNumber);
  const ceilingWeeks =
    n === 1 ? settings.loanCeilingWeeks1st : n === 2 ? settings.loanCeilingWeeks2nd : settings.loanCeilingWeeks3rd;
  const repaymentMultiple =
    n === 1
      ? settings.loanRepaymentMultiple1st
      : n === 2
        ? settings.loanRepaymentMultiple2nd
        : settings.loanRepaymentMultiple3rd;
  const repaymentWeeks =
    n === 1 ? settings.loanRepaymentWeeks1st : n === 2 ? settings.loanRepaymentWeeks2nd : settings.loanRepaymentWeeks3rd;
  const cooldownWeeks =
    n === 1 ? settings.loanCooldownWeeks1st : n === 2 ? settings.loanCooldownWeeks2nd : settings.loanCooldownWeeks3rd;
  const mandateStrikes =
    n === 1 ? settings.loanMandateStrikes1st : n === 2 ? settings.loanMandateStrikes2nd : settings.loanMandateStrikes3rd;

  const ceiling = Math.max(weeklyPayroll * ceilingWeeks, settings.loanMinimumCeiling);

  return {
    attemptNumber,
    weeklyPayroll,
    ceiling,
    tiers: {
      small: Math.round(ceiling * settings.loanTierSmallFraction),
      medium: Math.round(ceiling * settings.loanTierMediumFraction),
      large: Math.round(ceiling * settings.loanTierLargeFraction),
    },
    repaymentMultiple,
    repaymentWeeks,
    cooldownWeeks,
    mandateStrikes,
  };
}

export interface ActiveLoan {
  attemptNumber: number;
  tier: LoanTier;
  borrowed: number;
  /** Total that will have been paid back by the time weeksRemaining hits 0. */
  totalOwed: number;
  /** Fixed the day the loan is taken. Cannot be deferred or renegotiated. */
  weeklyPayment: number;
  weeksRemaining: number;
  startedWeek: number;
}

/** Build the loan the booker actually took, from the tier they picked. */
export function buildLoan(tier: LoanTier, terms: LoanTerms, week: number): ActiveLoan {
  const borrowed = terms.tiers[tier];
  const totalOwed = Math.round(borrowed * terms.repaymentMultiple);
  const weeklyPayment = Math.max(1, Math.round(totalOwed / terms.repaymentWeeks));
  return {
    attemptNumber: terms.attemptNumber,
    tier,
    borrowed,
    totalOwed,
    weeklyPayment,
    weeksRemaining: terms.repaymentWeeks,
    startedWeek: week,
  };
}

/** Is the business willing to talk about a loan at all right now? */
export function loanCooldownCleared(
  loansTaken: number,
  solventWeeksSinceLastLoan: number,
  settings: WorldSettings,
): boolean {
  if (loansTaken <= 0) return true;
  const terms = loanTermsFor(loansTaken, 0, settings);
  return solventWeeksSinceLastLoan >= terms.cooldownWeeks;
}

/** Words for the tier, since §0 wants a sentence rather than a slider. */
export const LOAN_TIER_LABELS: Record<LoanTier, string> = {
  small: 'Take the small offer',
  medium: 'Take the middle offer',
  large: 'Take the full amount',
};
