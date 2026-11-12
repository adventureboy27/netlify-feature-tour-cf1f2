// A legend of the business announces a farewell tour — real, once-ever
// (not once-per-rival: there is only one business-wide "the legend is
// retiring" moment a save gets). Deliberately unnamed rather than tied to a
// specific Hall of Famer: the same limitation uninvitedLegend hit — there is
// no resolution path from a world story into a specific retired wrestler,
// and inventing one was more machinery than one event was worth.
//
// A real player decision, presented the same non-blocking, expiring way as
// the contract raid's aftermath: the tour stop offer is real and it
// expires if ignored.

import type { WorldSettings } from '../types';

export type FarewellTourOptionId = 'host' | 'decline';

export interface FarewellTourCall {
  week: number;
}

/**
 * Once-ever, business-wide — checked by the world-story registry
 * (data/worldStories.ts) the same way merger's own singleton is. Once
 * eligible and rolled, raises a pending decision rather than resolving
 * immediately; see World.pendingFarewellTour.
 */
export function eligibleForFarewellTour(week: number, alreadyHappened: boolean, settings: WorldSettings): boolean {
  return week >= settings.farewellTourEarliestWeek && !alreadyHappened;
}

export const FAREWELL_TOUR_OPTIONS: { id: FarewellTourOptionId; label: string; gains: string; costs: string }[] = [
  {
    id: 'host',
    label: 'Host a stop of the tour',
    gains: 'A real, once-in-a-save moment — a genuine rating and reputation boost for a night the wire will remember',
    costs: 'A real appearance fee, paid up front, whether the night lands or not',
  },
  {
    id: 'decline',
    label: 'Let somebody else host it',
    gains: 'No money spent',
    costs: 'The moment happens somewhere else, and it does not come back around',
  },
];

export interface FarewellTourOutcome {
  hosted: boolean;
  moneyDelta: number;
  ratingDelta: number;
  reputationDelta: number;
  line: string;
}

export function resolveFarewellTour(choice: FarewellTourOptionId, settings: WorldSettings): FarewellTourOutcome {
  if (choice === 'host') {
    return {
      hosted: true,
      moneyDelta: -settings.farewellTourHostFee,
      ratingDelta: settings.farewellTourHostRatingGain,
      reputationDelta: settings.farewellTourHostReputationGain,
      line: 'A legend of this business took a bow on this show tonight, for what everybody involved is calling the last time. The building will not forget it.',
    };
  }
  return {
    hosted: false,
    moneyDelta: 0,
    ratingDelta: 0,
    reputationDelta: -settings.farewellTourDeclineReputationCost,
    line: 'The farewell tour is happening somewhere else. This building was not the one that got the call.',
  };
}
