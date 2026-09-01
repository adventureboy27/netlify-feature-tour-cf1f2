import { describe, it, expect } from 'vitest';
import {
  eligibleForNetworkDemand,
  rollNetworkDemand,
  resolveNetworkDemand,
  networkDemandOptions,
  type NetworkDemandCall,
} from './networkDemand';
import { defaultWorldSettings } from './settings';
import { generateWrestlers } from '../generate/wrestler';
import { rngFromSeed } from '../rng';
import { BROADCASTERS } from '../../data/broadcasters';
import type { Wrestler } from '../types';

const settings = defaultWorldSettings();
const deal = BROADCASTERS[0]!;

function roster(size = 20, seed = 'network-demand'): Wrestler[] {
  return generateWrestlers(rngFromSeed(seed), size).map((w) => ({ ...w, popularity: 40 }));
}

function withDiscipline(w: Wrestler): Wrestler {
  return {
    ...w,
    discipline: {
      violations: [{ kind: 'conduct', week: 1, note: 'Sounded off to a reporter about the finish.' }],
      finesPaid: 0,
      suspendedUntilWeek: null,
    },
  };
}

describe('eligibleForNetworkDemand', () => {
  it('never fires with no active deal', () => {
    expect(eligibleForNetworkDemand(settings.networkDemandEarliestWeek, null, 20, settings)).toBe(false);
  });

  it('never fires before the week gate', () => {
    expect(eligibleForNetworkDemand(settings.networkDemandEarliestWeek - 1, deal.id, 20, settings)).toBe(false);
  });

  it('never fires against a roster too thin to spare the ask', () => {
    expect(eligibleForNetworkDemand(settings.networkDemandEarliestWeek, deal.id, 2, settings)).toBe(false);
  });

  it('fires once every gate clears', () => {
    expect(eligibleForNetworkDemand(settings.networkDemandEarliestWeek, deal.id, 20, settings)).toBe(true);
  });
});

describe('rollNetworkDemand', () => {
  it('never rolls with the chance at zero', () => {
    const zero = { ...settings, networkDemandChancePerWeek: 0 };
    for (let i = 0; i < 20; i++) {
      expect(rollNetworkDemand(rngFromSeed(`never-${i}`), settings.networkDemandEarliestWeek, deal, roster(), zero)).toBeNull();
    }
  });

  it('only ever targets mustFeature on a clean roster — no invented reason for keepOffAir', () => {
    const always = { ...settings, networkDemandChancePerWeek: 1, networkDemandKeepOffAirShare: 1 };
    for (let i = 0; i < 10; i++) {
      const call = rollNetworkDemand(rngFromSeed(`clean-${i}`), settings.networkDemandEarliestWeek, deal, roster(20, `clean-${i}`), always);
      expect(call).not.toBeNull();
      expect(call!.kind).toBe('mustFeature');
    }
  });

  it('targets the actual most popular roster member for mustFeature', () => {
    const always = { ...settings, networkDemandChancePerWeek: 1, networkDemandKeepOffAirShare: 0 };
    const list = roster();
    list[3]!.popularity = 95;
    const call = rollNetworkDemand(rngFromSeed('feature'), settings.networkDemandEarliestWeek, deal, list, always);
    expect(call).not.toBeNull();
    expect(call!.kind).toBe('mustFeature');
    expect(call!.targetId).toBe(list[3]!.id);
  });

  it('only ever targets somebody with a real discipline record for keepOffAir', () => {
    const always = { ...settings, networkDemandChancePerWeek: 1, networkDemandKeepOffAirShare: 1 };
    const list = roster();
    const flaggedIds = new Set([list[2]!.id, list[7]!.id]);
    list[2] = withDiscipline(list[2]!);
    list[7] = withDiscipline(list[7]!);
    for (let i = 0; i < 10; i++) {
      const call = rollNetworkDemand(rngFromSeed(`flagged-${i}`), settings.networkDemandEarliestWeek, deal, list, always);
      expect(call).not.toBeNull();
      expect(call!.kind).toBe('keepOffAir');
      expect(flaggedIds.has(call!.targetId)).toBe(true);
    }
  });
});

function call(kind: NetworkDemandCall['kind']): NetworkDemandCall {
  return { week: 40, dealId: deal.id, dealName: deal.name, kind, targetId: 'w1', targetName: 'Test Wrestler' };
}

describe('resolveNetworkDemand', () => {
  it('complying with mustFeature pays a bonus and costs the room, not the target', () => {
    const outcome = resolveNetworkDemand(call('mustFeature'), 'comply', settings);
    expect(outcome.moneyDelta).toBeGreaterThan(0);
    expect(outcome.roomMoraleDelta).toBeLessThan(0);
    expect(outcome.targetMoraleDelta).toBe(0);
    expect(outcome.breach).toBe(false);
  });

  it('complying with keepOffAir pays a bonus and costs the target, not the room', () => {
    const outcome = resolveNetworkDemand(call('keepOffAir'), 'comply', settings);
    expect(outcome.moneyDelta).toBeGreaterThan(0);
    expect(outcome.targetMoraleDelta).toBeLessThan(0);
    expect(outcome.roomMoraleDelta).toBe(0);
    expect(outcome.breach).toBe(false);
  });

  it('refusing costs real money and counts as a breach, whichever kind', () => {
    for (const kind of ['mustFeature', 'keepOffAir'] as const) {
      const outcome = resolveNetworkDemand(call(kind), 'refuse', settings);
      expect(outcome.moneyDelta).toBeLessThan(0);
      expect(outcome.breach).toBe(true);
    }
  });

  it('refusing a keepOffAir demand lifts the target — stood up for by name', () => {
    const outcome = resolveNetworkDemand(call('keepOffAir'), 'refuse', settings);
    expect(outcome.targetMoraleDelta).toBeGreaterThan(0);
  });

  it('every outcome carries a real line for the wire', () => {
    for (const kind of ['mustFeature', 'keepOffAir'] as const) {
      for (const choice of ['comply', 'refuse'] as const) {
        expect(resolveNetworkDemand(call(kind), choice, settings).line.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('networkDemandOptions', () => {
  it('names the target in every option, for both kinds', () => {
    for (const kind of ['mustFeature', 'keepOffAir'] as const) {
      const options = networkDemandOptions(call(kind));
      expect(options).toHaveLength(2);
      expect(options.map((o) => o.id).sort()).toEqual(['comply', 'refuse']);
    }
  });
});
