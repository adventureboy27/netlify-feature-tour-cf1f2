// What a rival promotion charges — a ticket, a shirt, a pay-per-view buy.
//
// The player's own ticket price is a real decision with a real reaction (see
// economy/showBudget.ts's fairTicketPrice/priceReaction). A rival's is not
// modelled that deeply — same reasoning as rivalEconomy.ts's revenue, which
// is a summary of the forces rather than an invented ledger. What a rival
// charges exists here purely so the booker can see it and size it up: some
// rivals are giving tickets away, some are gouging on shirts, and there is no
// pattern linking the three numbers for any one company. Three independent
// draws, not a single "cheap/mid/pricey" tier applied across the board — a
// rival who undercuts everybody on the door can still be robbing the merch
// table, and a booker who thinks they've found the tell is wrong.

import type { Rng } from '../rng';
import { randInt, rngFromSeed } from '../rng';
import type { Id, WorldSettings } from '../types';

export interface RivalPricing {
  ticketPrice: number;
  merchPrice: number;
  ppvPrice: number;
}

/**
 * A rival's storefront, invented the moment they show up in the world.
 *
 * Callers seed `rng` from the rival's own id (`rngFromSeed(\`rival-pricing:${id}\`)`)
 * rather than drawing from the shared stream — this is a brand-new insertion
 * point, and the entity seed keeps it from shifting a single existing seeded
 * roll anywhere else in the game.
 */
export function randomRivalPricing(rng: Rng, settings: WorldSettings): RivalPricing {
  return {
    ticketPrice: randInt(rng, settings.rivalTicketPriceMin, settings.rivalTicketPriceMax),
    merchPrice: randInt(rng, settings.rivalMerchPriceMin, settings.rivalMerchPriceMax),
    ppvPrice: randInt(rng, settings.rivalPpvPriceMin, settings.rivalPpvPriceMax),
  };
}

/** Build (or rebuild) the pricing map for a whole set of rivals at once. */
export function randomRivalPricingFor(rivalIds: readonly Id[], settings: WorldSettings): Record<Id, RivalPricing> {
  const out: Record<Id, RivalPricing> = {};
  for (const id of rivalIds) {
    out[id] = randomRivalPricing(rngFromSeed(`rival-pricing:${id}`), settings);
  }
  return out;
}
