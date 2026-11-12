import { describe, it, expect } from 'vitest';
import {
  generateFreeAgentPool,
  currentAskingRate,
  canSign,
  agePool,
  rankPool,
  AVAILABILITY_LABELS,
  type FreeAgent,
} from './freeAgents';
import { defaultWorldSettings } from './settings';
import { rngFromSeed } from '../rng';
import { generateWrestler } from '../generate/wrestler';
import type { Wrestler } from '../types';

const settings = defaultWorldSettings();

function pool(seed = 'fa') {
  const { wrestlers, freeAgents } = generateFreeAgentPool(rngFromSeed(seed), settings);
  const byId = new Map(wrestlers.map((w) => [w.id, w]));
  return { wrestlers, freeAgents, byId, get: (id: string) => byId.get(id) };
}

/** A plain, ego-neutral wrestler for tests that only care about the shelf-time discount, not the market. */
function neutralWrestler(over: Partial<Wrestler> = {}): Wrestler {
  return { ...generateWrestler(rngFromSeed('fa-neutral'), new Set()), ego: 50, ...over };
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

  const w = neutralWrestler();

  it('makes somebody cheaper the longer nobody signs them', () => {
    expect(currentAskingRate(agent(40), w, 0, settings)).toBeLessThan(currentAskingRate(agent(0), w, 0, settings));
  });

  it('stops discounting at the floor, so patience is not infinite', () => {
    const veryStale = currentAskingRate(agent(500), w, 0, settings);
    expect(veryStale).toBeGreaterThanOrEqual(settings.contractBaseWeeklyRate);
    expect(veryStale).toBeGreaterThanOrEqual(1000 * (1 - settings.freeAgentMaxDiscount) - 25);
  });
});

describe('the wider economy', () => {
  const agent: FreeAgent = { wrestlerId: 'x', reason: 'released', askingRate: 1000, wantsWeeks: 52, weeksUnsigned: 0 };

  it('a humble free agent asks for less in a downturn and more in a boom', () => {
    const humble = neutralWrestler({ ego: 0 });
    const steady = currentAskingRate(agent, humble, 0, settings);
    const recession = currentAskingRate(agent, humble, -1, settings);
    const boom = currentAskingRate(agent, humble, 1, settings);
    expect(recession).toBeLessThan(steady);
    expect(boom).toBeGreaterThan(steady);
  });

  it('a maximum-ego free agent is stubborn in a recession — asks exactly the same as steady times', () => {
    const egotist = neutralWrestler({ ego: 100 });
    const steady = currentAskingRate(agent, egotist, 0, settings);
    const recession = currentAskingRate(agent, egotist, -1, settings);
    expect(recession).toBe(steady);
  });

  it('a maximum-ego free agent leverages a boom for more than the market alone would give a humble one', () => {
    const egotist = neutralWrestler({ ego: 100 });
    const humble = neutralWrestler({ ego: 0 });
    const steady = currentAskingRate(agent, egotist, 0, settings);
    const egotistBoom = currentAskingRate(agent, egotist, 1, settings);
    const humbleBoom = currentAskingRate(agent, humble, 1, settings);
    expect(egotistBoom).toBeGreaterThan(steady);
    expect(egotistBoom).toBeGreaterThan(humbleBoom);
  });

  it('a mid-ego free agent moves less than a fully humble one, for the same climate', () => {
    const humble = neutralWrestler({ ego: 0 });
    const middling = neutralWrestler({ ego: 50 });
    const humbleSwing = Math.abs(currentAskingRate(agent, humble, -1, settings) - currentAskingRate(agent, humble, 0, settings));
    const middlingSwing = Math.abs(
      currentAskingRate(agent, middling, -1, settings) - currentAskingRate(agent, middling, 0, settings),
    );
    expect(middlingSwing).toBeLessThan(humbleSwing);
  });

  it('never moves anybody below the floor even in the deepest recession', () => {
    const humble = neutralWrestler({ ego: 0 });
    expect(currentAskingRate(agent, humble, -1, settings)).toBeGreaterThanOrEqual(settings.contractBaseWeeklyRate);
  });

  it('clamps an out-of-range climate value rather than extrapolating past the ceiling', () => {
    const humble = neutralWrestler({ ego: 0 });
    expect(currentAskingRate(agent, humble, 5, settings)).toBe(currentAskingRate(agent, humble, 1, settings));
    expect(currentAskingRate(agent, humble, -5, settings)).toBe(currentAskingRate(agent, humble, -1, settings));
  });
});

describe('secular salary inflation', () => {
  const agent: FreeAgent = { wrestlerId: 'x', reason: 'released', askingRate: 1000, wantsWeeks: 52, weeksUnsigned: 0 };
  const w = neutralWrestler({ ego: 50 });

  it('defaults to no drift when no week is given, matching week zero', () => {
    expect(currentAskingRate(agent, w, 0, settings)).toBe(currentAskingRate(agent, w, 0, settings, 0));
  });

  it('makes the whole market ask for more the further a save runs, even with the climate flat', () => {
    const early = currentAskingRate(agent, w, 0, settings, 10);
    const late = currentAskingRate(agent, w, 0, settings, 300);
    expect(late).toBeGreaterThan(early);
  });

  it('is linear per year, not compounding — doubling the weeks roughly doubles the drift', () => {
    const inflatedSettings = { ...settings, salaryInflation: 0.5 };
    const base = currentAskingRate(agent, w, 0, inflatedSettings, 0);
    const oneYear = currentAskingRate(agent, w, 0, inflatedSettings, 52);
    const twoYears = currentAskingRate(agent, w, 0, inflatedSettings, 104);
    const firstYearGain = oneYear - base;
    const secondYearGain = twoYears - oneYear;
    expect(secondYearGain).toBeGreaterThan(firstYearGain * 0.8);
    expect(secondYearGain).toBeLessThan(firstYearGain * 1.2);
  });

  it('never reads a negative week as a discount', () => {
    expect(currentAskingRate(agent, w, 0, settings, -50)).toBe(currentAskingRate(agent, w, 0, settings, 0));
  });
});

describe('signing', () => {
  const { wrestlers } = pool();
  const cheap = [...wrestlers].sort((a, b) => a.popularity - b.popularity)[0]!;
  const dear = [...wrestlers].sort((a, b) => b.popularity - a.popularity)[0]!;

  it('lets you take on someone you can service for a season', () => {
    expect(canSign(cheap, 500000, settings)).toBe(true);
  });

  it('refuses a deal you cannot cover', () => {
    expect(canSign(dear, 100, settings)).toBe(false);
  });
});

describe('a week in the pool', () => {
  it('ages everybody on the shelf by a week', () => {
    const { freeAgents } = pool();
    const updated = agePool(freeAgents);
    for (const agent of updated) {
      const before = freeAgents.find((a) => a.wrestlerId === agent.wrestlerId)!;
      expect(agent.weeksUnsigned).toBe(before.weeksUnsigned + 1);
    }
  });

  it('is what brings a price down, so patience is a strategy', () => {
    // The whole reason the shelf-time is counted. Without the ageing this was
    // a frozen price list and waiting somebody out did nothing at all.
    const { freeAgents, get } = pool();
    const agent = freeAgents[0]!;
    const w = get(agent.wrestlerId)!;
    let aged = [agent];
    for (let week = 0; week < 30; week++) aged = agePool(aged);
    expect(currentAskingRate(aged[0]!, w, 0, settings)).toBeLessThan(currentAskingRate(agent, w, 0, settings));
  });

  it('stops discounting somewhere — he is not eventually free', () => {
    const { freeAgents, get } = pool();
    const w = get(freeAgents[0]!.wrestlerId)!;
    let aged = [freeAgents[0]!];
    for (let week = 0; week < 5000; week++) aged = agePool(aged);
    expect(currentAskingRate(aged[0]!, w, 0, settings)).toBeGreaterThanOrEqual(settings.contractBaseWeeklyRate);
  });

  it('changes nothing else about anybody', () => {
    const { freeAgents } = pool();
    const [before] = freeAgents;
    const [after] = agePool(freeAgents);
    expect({ ...after!, weeksUnsigned: 0 }).toEqual({ ...before!, weeksUnsigned: 0 });
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
