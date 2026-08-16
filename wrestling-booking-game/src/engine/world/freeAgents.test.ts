import { describe, it, expect } from 'vitest';
import {
  generateFreeAgentPool,
  currentAskingRate,
  canSign,
  tickPool,
  rankPool,
  AVAILABILITY_LABELS,
  type FreeAgent,
} from './freeAgents';
import { defaultWorldSettings } from './settings';
import { deriveCareerStatus } from '../career/status';
import { rngFromSeed } from '../rng';
import type { Wrestler } from '../types';

const settings = defaultWorldSettings();

function pool(seed = 'fa') {
  const { wrestlers, freeAgents } = generateFreeAgentPool(rngFromSeed(seed), settings);
  const byId = new Map(wrestlers.map((w) => [w.id, w]));
  return { wrestlers, freeAgents, byId, get: (id: string) => byId.get(id) };
}

describe('the pool', () => {
  it('is as big as the settings ask for', () => {
    expect(pool().freeAgents).toHaveLength(settings.freeAgentPoolSize);
  });

  it('leaves everyone genuinely unsigned', () => {
    const { wrestlers } = pool();
    for (const w of wrestlers) {
      expect(w.promotionId).toBeNull();
      expect(w.contract).toBeNull();
    }
  });

  it('says why each of them is available', () => {
    for (const agent of pool().freeAgents) {
      expect(AVAILABILITY_LABELS[agent.reason]).toBeTruthy();
    }
  });

  it('covers more than one reason across a pool of forty', () => {
    const reasons = new Set(pool().freeAgents.map((a) => a.reason));
    expect(reasons.size).toBeGreaterThan(2);
  });

  it('quotes an asking rate for everybody', () => {
    for (const agent of pool().freeAgents) expect(agent.askingRate).toBeGreaterThan(0);
  });

  it('holds people the player might genuinely want', () => {
    const { freeAgents, get } = pool();
    const best = Math.max(...freeAgents.map((a) => get(a.wrestlerId)!.popularity));
    expect(best).toBeGreaterThan(40);
  });
});

describe('sitting on the shelf', () => {
  const agent = (weeksUnsigned: number): FreeAgent => ({
    wrestlerId: 'x',
    reason: 'released',
    askingRate: 1000,
    wantsWeeks: 52,
    weeksUnsigned,
  });

  it('makes somebody cheaper the longer nobody signs them', () => {
    expect(currentAskingRate(agent(40), settings)).toBeLessThan(currentAskingRate(agent(0), settings));
  });

  it('stops discounting at the floor, so patience is not infinite', () => {
    const veryStale = currentAskingRate(agent(500), settings);
    expect(veryStale).toBeGreaterThanOrEqual(settings.contractBaseWeeklyRate);
    expect(veryStale).toBeGreaterThanOrEqual(1000 * (1 - settings.freeAgentMaxDiscount) - 25);
  });
});

describe('signing', () => {
  const { wrestlers } = pool();
  const cheap = [...wrestlers].sort((a, b) => a.popularity - b.popularity)[0]!;
  const dear = [...wrestlers].sort((a, b) => b.popularity - a.popularity)[0]!;

  it('lets you take on someone you can service for a season', () => {
    expect(canSign(cheap, 500000, 0, settings)).toBe(true);
  });

  it('refuses a deal you cannot cover', () => {
    expect(canSign(dear, 100, 0, settings)).toBe(false);
  });

  it('refuses everybody while you are banned from signing', () => {
    expect(canSign(cheap, 1_000_000, 4, settings)).toBe(false);
  });
});

describe('a week in the pool', () => {
  const statusOf = (w: Wrestler) =>
    deriveCareerStatus(w, { currentYear: settings.startingYear, rosterPeakPopularity: 90, settings });

  it('ages everybody on the shelf by a week', () => {
    const { freeAgents, get } = pool();
    const { updated } = tickPool(rngFromSeed('tick'), {
      freeAgents,
      wrestlerById: get,
      statusOf,
      rivalDemand: 0,
      settings,
    });
    for (const agent of updated) {
      const before = freeAgents.find((a) => a.wrestlerId === agent.wrestlerId)!;
      expect(agent.weeksUnsigned).toBe(before.weeksUnsigned + 1);
    }
  });

  it('keeps everyone when no rival is interested', () => {
    const { freeAgents, get } = pool();
    const { signedAway } = tickPool(rngFromSeed('quiet'), {
      freeAgents,
      wrestlerById: get,
      statusOf,
      rivalDemand: 0,
      settings,
    });
    expect(signedAway).toEqual([]);
  });

  it('lets rivals take the good ones if you leave them there', () => {
    // The pool is not a reservation — sit on a prospect and somebody else
    // signs them.
    let { freeAgents } = pool();
    const { get } = pool();
    const rng = rngFromSeed('rivals-hungry');
    let taken = 0;
    for (let week = 0; week < 52; week++) {
      const result = tickPool(rng, { freeAgents, wrestlerById: get, statusOf, rivalDemand: 1, settings });
      taken += result.signedAway.length;
      freeAgents = result.updated;
    }
    expect(taken).toBeGreaterThan(0);
    expect(freeAgents.length).toBeLessThan(settings.freeAgentPoolSize);
  });

  it('takes the desirable ones first', () => {
    const { freeAgents, get } = pool();
    const rng = rngFromSeed('who-goes');
    const { signedAway } = tickPool(rng, { freeAgents, wrestlerById: get, statusOf, rivalDemand: 1, settings });
    if (signedAway.length === 0) return;
    const takenPop = signedAway.map((id) => get(id)!.popularity);
    const allPop = freeAgents.map((a) => get(a.wrestlerId)!.popularity);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(takenPop)).toBeGreaterThan(mean(allPop) * 0.8);
  });
});

describe('rankPool', () => {
  it('puts the best available at the top', () => {
    const { freeAgents, get } = pool();
    const ranked = rankPool(freeAgents, get);
    for (let i = 1; i < ranked.length; i++) {
      expect(get(ranked[i - 1]!.wrestlerId)!.popularity).toBeGreaterThanOrEqual(get(ranked[i]!.wrestlerId)!.popularity);
    }
  });
});
