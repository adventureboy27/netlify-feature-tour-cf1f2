import { describe, it, expect } from 'vitest';
import { eligibleForFarewellTour, resolveFarewellTour } from './farewellTour';
import { defaultWorldSettings } from './settings';

const settings = defaultWorldSettings();

describe('eligibleForFarewellTour', () => {
  it('will not fire before the week gate', () => {
    expect(eligibleForFarewellTour(settings.farewellTourEarliestWeek - 1, false, settings)).toBe(false);
  });

  it('will not fire once it has already happened', () => {
    expect(eligibleForFarewellTour(settings.farewellTourEarliestWeek, true, settings)).toBe(false);
  });

  it('fires once the gate clears and it has not already happened', () => {
    expect(eligibleForFarewellTour(settings.farewellTourEarliestWeek, false, settings)).toBe(true);
  });
});

describe('resolveFarewellTour', () => {
  it('hosting costs a real fee and gives a real rating and reputation gain', () => {
    const outcome = resolveFarewellTour('host', settings);
    expect(outcome.hosted).toBe(true);
    expect(outcome.moneyDelta).toBeLessThan(0);
    expect(outcome.ratingDelta).toBeGreaterThan(0);
    expect(outcome.reputationDelta).toBeGreaterThan(0);
  });

  it('declining costs nothing but a little reputation', () => {
    const outcome = resolveFarewellTour('decline', settings);
    expect(outcome.hosted).toBe(false);
    expect(outcome.moneyDelta).toBe(0);
    expect(outcome.ratingDelta).toBe(0);
    expect(outcome.reputationDelta).toBeLessThan(0);
  });

  it('every outcome carries a real line for the wire', () => {
    expect(resolveFarewellTour('host', settings).line.length).toBeGreaterThan(0);
    expect(resolveFarewellTour('decline', settings).line.length).toBeGreaterThan(0);
  });
});
