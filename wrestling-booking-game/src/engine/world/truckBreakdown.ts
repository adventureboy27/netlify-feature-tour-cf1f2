// The equipment truck doesn't show up — a rare, blunt logistics failure with
// nothing to do with how worn anything is (see ringCall.ts for that one).
// Resolved the same shape: a warning, a real two-way decision, honest
// either-direction consequences. Deliberately its own small module rather
// than folded into ringCall.ts — the trigger is unrelated (bad luck on the
// road, not accumulated wear) and keeping them apart means neither system
// has to carry a branch for a cause it doesn't actually have.
//
// Pure: decides the call and resolves whatever the promoter picked into
// consequences the store applies. Nothing here touches the world.

import type { Rng } from '../rng';
import { chance, pick } from '../rng';
import type { Id, WorldSettings } from '../types';

export type TruckCallOptionId = 'cancelShow' | 'arenaFloor';

export interface TruckCall {
  week: number;
  territoryId: Id;
  territoryName: string;
  warning: string;
}

const WARNING_LINES = [
  "The equipment truck never made it into {town} tonight — broke down two states back, and there is no ring, no barricades, nothing but what's already inside the building.",
  'No truck, no ring. Whatever happens in {town} tonight happens on the arena floor or it does not happen at all.',
  'The rig hauling the ring blew a transmission on the way to {town}. It is not getting here in time for bell time.',
];

/** Roll for whether the truck simply failed to arrive at all this week. Independent of ring condition. */
export function truckBreakdownFrom(
  rng: Rng,
  week: number,
  territoryId: Id,
  territoryName: string,
  settings: WorldSettings,
): TruckCall | null {
  if (!chance(rng, settings.truckBreakdownChancePerWeek)) return null;
  return {
    week,
    territoryId,
    territoryName,
    warning: pick(rng, WARNING_LINES).replace(/\{town\}/g, territoryName),
  };
}

export const TRUCK_CALL_OPTIONS: { id: TruckCallOptionId; label: string; gains: string; costs: string }[] = [
  {
    id: 'cancelShow',
    label: 'Call it off',
    gains: 'Nobody works a show with no ring at all',
    costs: 'No contest, refunded — real morale and merch losses for a night that never happened',
  },
  {
    id: 'arenaFloor',
    label: 'Hold it on the arena floor',
    gains: 'The show still runs, ticket sales still count, and a bare-floor card can genuinely pop the house — and permanently unlocks Arena Floor as a bookable match type from here on',
    costs: 'Real, elevated injury risk for whoever is still out there tonight, and the crowd could just as easily turn on it',
  },
];

export interface TruckCallOutcome {
  /** Did the show run as a real card, or get called as a no-contest? */
  ran: boolean;
  /** Share of committed costs still owed when it's called off. */
  costShare: number;
  moraleDelta: number;
  /** Multiplies merch revenue on the "call it off" path. 1 means unaffected. */
  merchShare: number;
  /** Extra danger on the "arena floor" path — feeds the same casualty roll skill-injury reads. */
  injuryMultiplier: number;
  /** Positive or negative — a real gamble, never a guaranteed pop. */
  ratingSwing: number;
  line: string;
}

/**
 * What the call cost.
 *
 * Calling it off is a known, moderate cost — refunded, no contest, real but
 * ordinary morale and merch losses. Holding it on the arena floor is a real
 * swing either way: worse danger for whoever's still out there, and a
 * rating that can land big or flop, decided honestly rather than guaranteed
 * to reward the gamble.
 */
export function resolveTruckCall(
  call: TruckCall,
  choice: TruckCallOptionId,
  rng: Rng,
  settings: WorldSettings,
): TruckCallOutcome {
  const town = call.territoryName;

  if (choice === 'cancelShow') {
    return {
      ran: false,
      costShare: 1,
      moraleDelta: settings.truckBreakdownCancelMoraleDelta,
      merchShare: settings.truckBreakdownCancelMerchShare,
      injuryMultiplier: 1,
      ratingSwing: 0,
      line: `The truck never made it into ${town}, and the office called it rather than run a show with no ring at all. No contest, refunds all around.`,
    };
  }

  const swing = (chance(rng, 0.5) ? 1 : -1) * settings.truckBreakdownRatingSwing;
  return {
    ran: true,
    costShare: 0,
    moraleDelta: 0,
    merchShare: 1,
    injuryMultiplier: settings.truckBreakdownInjuryMultiplier,
    ratingSwing: swing,
    line:
      swing >= 0
        ? `No truck, no ring, no problem — ${town} got a bare-floor show instead and the building has never been louder for something this different.`
        : `No truck, no ring, and it showed — ${town} got a bare-floor show that read like exactly the mess it was.`,
  };
}
