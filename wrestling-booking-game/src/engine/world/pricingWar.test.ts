import { describe, it, expect } from 'vitest';
import { eligibleForPricingWar, pickPricingWarTarget, slashedPricing, pricingWarStartLine, pricingWarEndLine } from './pricingWar';
import { defaultWorldSettings } from './settings';
import { rngFromSeed } from '../rng';
import { defaultFanTaste } from './fanTaste';
import type { Promotion } from '../types';

const settings = defaultWorldSettings();

function promotion(overrides: Partial<Promotion> = {}): Promotion {
  return {
    id: 'rival-0',
    name: 'Atlas Pro',
    identity: 'athletic',
    fanTaste: defaultFanTaste('athletic'),
    isPlayer: false,
    rating: 60,
    bankBalance: 100_000,
    rosterIds: [],
    titleIds: [],
    ownedTerritoryIds: [],
    homeTerritoryId: 'territory-unassigned',
    styleProfile: {
      preferredStyles: [],
      violenceTolerance: 50,
      workrateVsStarPower: 50,
      divisionFocus: ['mens'],
      promoHeavy: false,
    },
    bookingCredibility: 50,
    reputation: 60,
    hardcoreSaturation: 0,
    recentShowQuality: 60,
    weeksInTheRed: 0,
    closedWeek: null,
    ownerId: 'owner-rival-0',
    ownerPersonality: 'showman' as const,
    ppvCalendar: ['The Reckoning'],
    ...overrides,
  };
}

describe('eligibleForPricingWar', () => {
  it('will not fire before the week gate', () => {
    const rivals = [promotion({ id: 'r1', conglomerateId: 'co-1' })];
    expect(eligibleForPricingWar(settings.pricingWarEarliestWeek - 1, rivals, false, settings)).toBe(false);
  });

  it('will not fire while one is already running', () => {
    const rivals = [promotion({ id: 'r1', conglomerateId: 'co-1' })];
    expect(eligibleForPricingWar(settings.pricingWarEarliestWeek, rivals, true, settings)).toBe(false);
  });

  it('will not fire without any conglomerate-backed rival', () => {
    const rivals = [promotion({ id: 'r1' }), promotion({ id: 'r2' })];
    expect(eligibleForPricingWar(settings.pricingWarEarliestWeek, rivals, false, settings)).toBe(false);
  });

  it('fires once a conglomerate rival exists, the gate clears, and nothing is already running', () => {
    const rivals = [promotion({ id: 'r1' }), promotion({ id: 'r2', conglomerateId: 'co-1' })];
    expect(eligibleForPricingWar(settings.pricingWarEarliestWeek, rivals, false, settings)).toBe(true);
  });
});

describe('pickPricingWarTarget', () => {
  it('only ever picks a conglomerate-backed rival', () => {
    const rivals = [
      promotion({ id: 'r1' }),
      promotion({ id: 'r2', conglomerateId: 'co-1' }),
      promotion({ id: 'r3', conglomerateId: 'co-1' }),
    ];
    for (let i = 0; i < 20; i++) {
      const picked = pickPricingWarTarget(rngFromSeed(`seed-${i}`), rivals);
      expect(picked.conglomerateId).toBe('co-1');
    }
  });
});

describe('slashedPricing', () => {
  it('cuts every item down and never below $1', () => {
    const slashed = slashedPricing({ ticketPrice: 50, merchPrice: 30, ppvPrice: 40 }, settings);
    expect(slashed.ticketPrice).toBeLessThan(50);
    expect(slashed.merchPrice).toBeLessThan(30);
    expect(slashed.ppvPrice).toBeLessThan(40);
    expect(slashed.ticketPrice).toBeGreaterThanOrEqual(1);
    expect(slashed.merchPrice).toBeGreaterThanOrEqual(1);
    expect(slashed.ppvPrice).toBeGreaterThanOrEqual(1);
  });

  it('never produces a zero or negative price even off a $1 starting point', () => {
    const slashed = slashedPricing({ ticketPrice: 1, merchPrice: 1, ppvPrice: 1 }, settings);
    expect(slashed.ticketPrice).toBeGreaterThanOrEqual(1);
    expect(slashed.merchPrice).toBeGreaterThanOrEqual(1);
    expect(slashed.ppvPrice).toBeGreaterThanOrEqual(1);
  });
});

describe('wire lines', () => {
  it('names the rival in both the start and end line', () => {
    expect(pricingWarStartLine('Colossus East')).toContain('Colossus East');
    expect(pricingWarEndLine('Colossus East')).toContain('Colossus East');
  });
});
