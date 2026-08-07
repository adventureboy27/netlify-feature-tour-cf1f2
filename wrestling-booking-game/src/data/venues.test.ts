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

describe('the venue ladder', () => {
  it('goes up in both capacity and the rating it takes to rent it', () => {
    for (let i = 1; i < VENUES.length; i += 1) {
      expect(VENUES[i]!.capacity).toBeGreaterThan(VENUES[i - 1]!.capacity);
      expect(VENUES[i]!.minCompanyRating).toBeGreaterThanOrEqual(VENUES[i - 1]!.minCompanyRating);
      expect(VENUES[i]!.rentalCost).toBeGreaterThan(VENUES[i - 1]!.rentalCost);
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
        const smallest = availableVenues(rating)[0]!;
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
