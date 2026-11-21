// Free agents get wary of a promotion that has been visibly releasing
// people — a company-wide reputation effect, distinct from the individual
// 🛡️ security-motivated trait in the motivation system. Confirmed directly
// by the player as something that belongs in ordinary, everyday
// negotiation, not just inside a contested bidding war where
// ContractBid.signingBonus already exists.
//
// Shape deliberately mirrors the loan cooldown (World.solventWeeksSinceLastLoan):
// any release resets the clock to zero, and only genuinely solvent weeks —
// time passing alone does not count — bring it back down.

import type { Wrestler, WorldSettings } from '../types';
import { guaranteedShareFor } from './termination';

/** Is the promotion still being held to account for a recent release? */
export function releaseStigmaActive(solventWeeksSinceLastRelease: number, settings: WorldSettings): boolean {
  if (!settings.releaseStigmaEnabled) return false;
  return solventWeeksSinceLastRelease < settings.releaseStigmaCooldownWeeks;
}

export interface ReleaseStigmaTerms {
  /** What to actually sign at — wariness already folded in, never applied on top separately. */
  guaranteedPct: number;
  /** Paid once, off the bank, at signing — same vocabulary as a bidding war's signing bonus. */
  signingBonus: number;
}

/**
 * What a wary free agent actually wants to see before signing.
 *
 * Somebody who would already command a guarantee off pure ego asks for cash
 * up front instead — the guarantee has nowhere further to go once ego
 * already put it there. Somebody who would not otherwise get one gets a
 * flat guaranteed floor instead: proof this promotion means it this time.
 */
export function releaseStigmaTerms(
  wrestler: Wrestler,
  weeklyRate: number,
  active: boolean,
  settings: WorldSettings,
): ReleaseStigmaTerms {
  const baseGuaranteed = guaranteedShareFor(wrestler.ego, settings);
  if (!active) return { guaranteedPct: baseGuaranteed, signingBonus: 0 };
  if (baseGuaranteed > 0) {
    return { guaranteedPct: baseGuaranteed, signingBonus: Math.round(weeklyRate * settings.releaseStigmaBonusWeeks) };
  }
  return { guaranteedPct: settings.releaseStigmaGuaranteedPct, signingBonus: 0 };
}
