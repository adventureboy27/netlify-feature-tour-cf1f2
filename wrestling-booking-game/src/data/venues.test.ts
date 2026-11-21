import { describe, expect, it } from 'vitest';
import {
  VENUES,
  VENUE_COMFORTABLE_FILL,
  availableVenues,
  bestAvailableVenue,
  bestFittingVenue,
} from './venues';
import { defaultWorldSettings } from '../engine/world/settings';
import { computeDemand, potentialAudience } from '../engine/economy/showBudget';
import { venueFitsTerritory } from '../engine/world/territories';
import { TERRITORIES } from './territories';

const settings = defaultWorldSettings();

describe('the venue list', () => {
  // The old assertion here was that the list is a strict ladder: each room
  // bigger, dearer and higher-rated than the last. That made every venue
  // strictly better than the one below it the moment you could fill it, which
  // is a queue rather than a decision. These are the properties that replace
  // it — weaker, and the ones that actually matter.

  it('has no room that another room simply beats', () => {
    // The property that makes this a list of choices: for every venue there is
    // something it is the best answer to. A room that is worse on every axis
    // and no cheaper is dead content nobody would ever pick.
    for (const a of VENUES) {
      const dominators = VENUES.filter(
        (b) =>
          b.id !== a.id &&
          b.rentalCost <= a.rentalCost &&
          b.loadIn <= a.loadIn &&
          b.minCompanyRating <= a.minCompanyRating &&
          b.capacity >= a.capacity &&
          b.houseCut <= a.houseCut &&
          b.merchCut <= a.merchCut &&
          b.concessionsPerHead >= a.concessionsPerHead &&
          b.productionCapacity >= a.productionCapacity &&
          b.atmosphere >= a.atmosphere &&
          Number(b.outdoor) <= Number(a.outdoor),
      );
      expect(dominators.map((v) => v.name), `${a.name} is beaten outright`).toEqual([]);
    }
  });

  it('charges more for a bigger room, taken as a whole', () => {
    const bySize = [...VENUES].sort((a, b) => a.capacity - b.capacity);
    for (let i = 1; i < bySize.length; i += 1) {
      // Not every step up costs more, but no room costs less than one an
      // order of magnitude smaller than it.
      const tenTimesSmaller = bySize.filter((v) => v.capacity * 10 <= bySize[i]!.capacity);
      for (const small of tenTimesSmaller) {
        expect(bySize[i]!.rentalCost).toBeGreaterThan(small.rentalCost);
      }
    }
  });

  it('sells the cheap seats outdoors, which is the whole bargain', () => {
    // An outdoor room has to be better value per seat than anything indoors
    // it competes with, or nobody would ever take the weather risk.
    for (const open of VENUES.filter((v) => v.outdoor)) {
      const perSeat = open.rentalCost / open.capacity;
      const indoorRivals = VENUES.filter(
        (v) => !v.outdoor && v.minCompanyRating <= open.minCompanyRating + 10 && v.capacity >= open.capacity * 0.5,
      );
      for (const rival of indoorRivals) {
        expect(perSeat, `${open.name} vs ${rival.name}`).toBeLessThan(rival.rentalCost / rival.capacity);
      }
    }
  });

  it('gives a promotion something to choose between at every stage', () => {
    // A tier with one room in it is not a decision either.
    for (const rating of [0, 20, 30, 40, 50, 60, 70, 80, 90]) {
      expect(availableVenues(rating).length, `rating ${rating}`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('every rung of the ladder is reachable', () => {
  // The bug this locks: venueFitsTerritory gates a building on the size of the
  // market, and the two biggest buildings were larger than any market on the
  // map. They existed in data/, showed up in no list, and could never be
  // booked by anybody — dead content nobody would have noticed.
  it('has a market big enough for every building', () => {
    const biggestMarket = Math.max(...TERRITORIES.map((t) => t.capacity));
    for (const v of VENUES) {
      expect(
        TERRITORIES.some((t) => venueFitsTerritory(v.capacity, t.capacity)),
        `${v.name} (${v.capacity}) has no market to run in — biggest is ${biggestMarket}`,
      ).toBe(true);
    }
  });
});

describe('bestFittingVenue', () => {
  it('never picks a room the audience would leave visibly empty', () => {
    for (const rating of [0, 30, 50, 70, 90]) {
      for (const audience of [80, 400, 1200, 5000, 20000]) {
        const venue = bestFittingVenue(rating, audience);
        // bestFittingVenue is indoor-only (see its own doc comment), so the
        // fallback it can actually land on is the smallest *indoor* room, not
        // availableVenues(rating)[0] — that list also carries outdoor rooms
        // like the backyard, which bestFittingVenue would never return.
        const indoor = availableVenues(rating).filter((v) => !v.outdoor);
        const smallest = indoor.reduce((a, b) => (b.capacity < a.capacity ? b : a));
        if (venue.id === smallest.id) continue; // nothing fit; falling back is allowed
        expect(audience).toBeGreaterThanOrEqual(venue.capacity * VENUE_COMFORTABLE_FILL);
      }
    }
  });

  it('is not the same answer as the biggest room you are allowed to rent', () => {
    // The whole point of splitting the two: permission and sense differ.
    const rating = 72;
    expect(bestAvailableVenue(rating).id).toBe('majorArena');
    expect(bestFittingVenue(rating, 500).id).not.toBe('majorArena');
  });

  it('moves up the ladder as the audience grows', () => {
    const rating = 90;
    const small = bestFittingVenue(rating, 300);
    const middling = bestFittingVenue(rating, 4500);
    const large = bestFittingVenue(rating, 12000);
    expect(middling.capacity).toBeGreaterThan(small.capacity);
    expect(large.capacity).toBeGreaterThan(middling.capacity);
  });
});

describe('the audience a new promotion actually draws', () => {
  // The bug this locks: the demand curve used to hand a promotion nobody had
  // heard of several thousand people, so every building on the ladder sold out
  // from week one and picking a bigger room was free money.
  it('cannot fill a real arena on day one', () => {
    const openingNight = computeDemand(20, 50, 20, settings);
    const audience = potentialAudience(openingNight, settings);
    expect(audience).toBeLessThan(1000);
    expect(bestFittingVenue(20, audience).capacity).toBeLessThanOrEqual(900);
  });

  it('separates a promotion people quite like from one they will travel for', () => {
    const liked = potentialAudience(computeDemand(55, 65, 55, settings), settings);
    const loved = potentialAudience(computeDemand(95, 95, 95, settings), settings);
    expect(loved).toBeGreaterThan(liked * 10);
  });
});
