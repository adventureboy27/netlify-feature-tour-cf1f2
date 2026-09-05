// A billionaire-backed pricing war — §16-adjacent, and only possible once the
// billionaire merger (engine/world/merger.ts) has actually happened. One half
// of the new conglomerate spends a stretch of weeks pricing below cost — the
// backing money is happy to eat the loss to bury whoever else is left in the
// business. Visible on the pricing dashboard (engine/world/pricing.ts) the
// whole time it runs, and it reverts to an ordinary, freshly-randomised price
// the moment it ends — the "billionaire below-cost pricing turmoil" promised
// alongside the dashboard itself.
//
// Deliberately display-adjacent rather than plumbed into rivalEconomy.ts's
// actual revenue math: the rating boost below is the same kind of summary
// move every other world story in this pool already makes (a scandal drops
// rating, a network deal raises it) rather than inventing a price-elasticity
// model for one company for six weeks.

import type { Rng } from '../rng';
import { pick } from '../rng';
import type { Promotion, WorldSettings } from '../types';
import type { RivalPricing } from './pricing';

export function eligibleForPricingWar(
  week: number,
  livingRivals: readonly Promotion[],
  alreadyActive: boolean,
  settings: WorldSettings,
): boolean {
  if (alreadyActive) return false;
  if (week < settings.pricingWarEarliestWeek) return false;
  return livingRivals.some((r) => Boolean(r.conglomerateId));
}

/** Which half of a conglomerate starts undercutting everybody. */
export function pickPricingWarTarget(rng: Rng, livingRivals: readonly Promotion[]): Promotion {
  const eligible = livingRivals.filter((r) => Boolean(r.conglomerateId));
  return pick(rng, eligible);
}

/** Below cost, and visibly so — floored at $1 so a "giveaway" still reads as a real number. */
export function slashedPricing(current: RivalPricing, settings: WorldSettings): RivalPricing {
  const slash = (n: number) => Math.max(1, Math.round(n * settings.pricingWarSlashFraction));
  return {
    ticketPrice: slash(current.ticketPrice),
    merchPrice: slash(current.merchPrice),
    ppvPrice: slash(current.ppvPrice),
  };
}

export function pricingWarStartLine(rivalName: string): string {
  return `${rivalName} just slashed their prices to next to nothing — the money behind them is happy to eat the loss to bury the rest of the business.`;
}

export function pricingWarEndLine(rivalName: string): string {
  return `${rivalName}'s prices are back to normal. However long that was supposed to hurt everybody else, the bill's been paid.`;
}
