import { describe, it, expect } from 'vitest';
import { eligibleForContractRaid, rollContractRaid, resolveContractRaid } from './contractRaid';
import { defaultWorldSettings } from './settings';
import { defaultFanTaste } from './fanTaste';
import { rngFromSeed } from '../rng';
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

const roster = Array.from({ length: 20 }, (_, i) => `w${i}`);

describe('eligibleForContractRaid', () => {
  it('never fires before the week gate', () => {
    expect(eligibleForContractRaid(settings.contractRaidEarliestWeek - 1, 20, [promotion()], settings)).toBe(false);
  });

  it('never fires against a roster too thin to spare it', () => {
    expect(eligibleForContractRaid(settings.contractRaidEarliestWeek, 2, [promotion()], settings)).toBe(false);
  });

  it('never fires with no living rival to do the raiding', () => {
    expect(eligibleForContractRaid(settings.contractRaidEarliestWeek, 20, [], settings)).toBe(false);
  });

  it('fires once every gate clears', () => {
    expect(eligibleForContractRaid(settings.contractRaidEarliestWeek, 20, [promotion()], settings)).toBe(true);
  });
});

describe('rollContractRaid', () => {
  it('never rolls with the chance at zero', () => {
    const zero = { ...settings, contractRaidChancePerWeek: 0 };
    for (let i = 0; i < 30; i++) {
      expect(rollContractRaid(rngFromSeed(`never-${i}`), settings.contractRaidEarliestWeek, roster, [promotion()], zero)).toBeNull();
    }
  });

  it('picks a real rival and a real handful of the roster at certainty', () => {
    const always = { ...settings, contractRaidChancePerWeek: 1 };
    const rivals = [promotion({ id: 'r1' }), promotion({ id: 'r2' })];
    const result = rollContractRaid(rngFromSeed('raid'), settings.contractRaidEarliestWeek, roster, rivals, always);
    expect(result).not.toBeNull();
    expect(rivals.some((r) => r.id === result!.rival.id)).toBe(true);
    expect(result!.raidedIds.length).toBeGreaterThan(0);
    expect(result!.raidedIds.length).toBeLessThanOrEqual(roster.length);
    expect(new Set(result!.raidedIds).size).toBe(result!.raidedIds.length);
  });
});

describe('resolveContractRaid', () => {
  it('overhaul costs real money and lifts morale', () => {
    const outcome = resolveContractRaid('overhaul', settings);
    expect(outcome.moneyDelta).toBeLessThan(0);
    expect(outcome.moraleDelta).toBeGreaterThan(0);
    expect(outcome.grudgeDelta).toBe(0);
  });

  it('retaliate costs reputation and money, and buys a real grudge', () => {
    const outcome = resolveContractRaid('retaliate', settings);
    expect(outcome.reputationDelta).toBeLessThan(0);
    expect(outcome.grudgeDelta).toBeGreaterThan(0);
  });

  it('doing nothing costs nothing but morale', () => {
    const outcome = resolveContractRaid('doNothing', settings);
    expect(outcome.moneyDelta).toBe(0);
    expect(outcome.reputationDelta).toBe(0);
    expect(outcome.moraleDelta).toBeLessThan(0);
  });

  it('every outcome carries a real line for the wire', () => {
    for (const choice of ['overhaul', 'retaliate', 'doNothing'] as const) {
      expect(resolveContractRaid(choice, settings).line.length).toBeGreaterThan(0);
    }
  });
});
