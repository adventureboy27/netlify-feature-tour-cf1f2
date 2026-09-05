import { describe, it, expect } from 'vitest';
import {
  managerPoachingAppeal,
  managerTemptation,
  rollManagerApproaches,
  managerDepartureClientLines,
  type ManagerApproachContext,
} from './managerPoaching';
import { responseOutcome } from './poaching';
import { defaultWorldSettings } from '../world/settings';
import { createStandardContract } from '../economy/contracts';
import { generateWrestler } from '../generate/wrestler';
import { rngFromSeed } from '../rng';
import type { Wrestler, Promotion } from '../types';
import type { Representation } from '../career/representation';

const settings = defaultWorldSettings();

function w(over: Partial<Wrestler> = {}): Wrestler {
  const base = generateWrestler(rngFromSeed('mp'), new Set());
  const contract = createStandardContract(base, settings, 2000);
  return { ...base, contract, traits: [], attachedTo: null, role: 'manager', ...over } as Wrestler;
}

function promo(over: Partial<Promotion> = {}): Promotion {
  return { id: 'rival', name: 'Atlas', rating: 60, rosterIds: [], ...over } as Promotion;
}

function rep(over: Partial<Representation> = {}): Representation {
  return { managerId: 'm1', clientId: 'c1', cut: 0.2, signedWeek: 1, ...over };
}

describe('a manager can be poached, same as a wrestler', () => {
  it('is more appealing with a real book behind him', () => {
    const manager = w({ popularity: 40, morale: 70 });
    const thin = managerPoachingAppeal(manager, 0);
    const proven = managerPoachingAppeal(manager, 5);
    expect(proven).toBeGreaterThan(thin);
  });

  it('a real book resists the pull — leaving means abandoning clients', () => {
    const manager = w({ id: 'm1', popularity: 60, morale: 50, momentum: 50 });
    const alone = managerTemptation(manager, 500, 0, 0, settings);
    const withBook = managerTemptation(manager, 500, 0, 4, settings);
    expect(withBook).toBeLessThan(alone);
  });

  it('offers 0-1, clamped', () => {
    const manager = w({ popularity: 100, morale: 0, momentum: 0 });
    const t = managerTemptation(manager, 100000, 0, 0, settings);
    expect(t).toBeGreaterThanOrEqual(0);
    expect(t).toBeLessThanOrEqual(1);
  });

  it('a live deal is off limits, same rule as a wrestler', () => {
    const manager = w({ id: 'm1', popularity: 90, morale: 10 });
    manager.contract!.weeksRemaining = 10;
    const ctx: ManagerApproachContext = {
      roster: [manager],
      rivals: [promo()],
      reps: [],
      settings,
    };
    const approaches = rollManagerApproaches(rngFromSeed('roll'), ctx);
    expect(approaches).toHaveLength(0);
  });

  it('only ever considers roster members who are actually managers', () => {
    const wrestler = w({ id: 'w1', role: 'wrestler', popularity: 90, morale: 10 });
    wrestler.contract!.weeksRemaining = 0;
    const ctx: ManagerApproachContext = {
      roster: [wrestler],
      rivals: [promo()],
      reps: [],
      settings,
    };
    // rollManagerApproaches should never produce an offer for a non-manager,
    // even with a lapsed deal and a high appeal profile.
    const approaches = rollManagerApproaches(rngFromSeed('roll2'), ctx);
    expect(approaches).toHaveLength(0);
  });

  it('promiseABiggerBook is a real, costed response, distinct from promiseAPush', () => {
    const outcome = responseOutcome({ kind: 'promiseABiggerBook' }, settings);
    expect(outcome.temptationDelta).toBeLessThan(0);
    const costsSomething =
      outcome.rosterMoraleDelta < 0 || outcome.reputationDelta < 0 || outcome.moraleDelta < 0;
    expect(costsSomething).toBe(true);
  });
});

describe('when a manager is gone, his whole book hears about it', () => {
  it('ends every client rep and writes one line per client', () => {
    const client1 = w({ id: 'c1', name: 'Client One', role: 'wrestler' });
    const client2 = w({ id: 'c2', name: 'Client Two', role: 'wrestler' });
    const reps = [rep({ managerId: 'm1', clientId: 'c1' }), rep({ managerId: 'm1', clientId: 'c2' })];
    const byId: Record<string, Wrestler> = { c1: client1, c2: client2 };

    const { remainingReps, lines } = managerDepartureClientLines(reps, 'm1', 'The Manager', (id) => byId[id]);

    expect(remainingReps).toHaveLength(0);
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line).toContain('The Manager');
    }
  });

  it('leaves other managers-and-clients alone', () => {
    const reps = [rep({ managerId: 'm1', clientId: 'c1' }), rep({ managerId: 'm2', clientId: 'c2' })];
    const client1 = w({ id: 'c1', role: 'wrestler' });
    const byId: Record<string, Wrestler> = { c1: client1 };

    const { remainingReps } = managerDepartureClientLines(reps, 'm1', 'The Manager', (id) => byId[id]);

    expect(remainingReps).toHaveLength(1);
    expect(remainingReps[0]!.managerId).toBe('m2');
  });
});
