import { describe, expect, it } from 'vitest';
import { rngFromSeed } from '../rng';
import { defaultWorldSettings } from '../world/settings';
import { generateWrestler } from '../generate/wrestler';
import { graduateClass } from '../world/academy';
import { walkOnIntake } from '../world/walkOns';
import { worthAnAuction, keenness, marketValue } from '../economy/bidding';
import type { Promotion, Wrestler } from '../types';
import { crossing, hypeDrift, hypeLabel, isBust, isSleeper, rollHype, rollStandoutTalent } from './hype';

const settings = defaultWorldSettings();

function person(seed: string, over: Partial<Wrestler> = {}): Wrestler {
  return { ...generateWrestler(rngFromSeed(seed), new Set(), { currentYear: 2030 }), ...over };
}

describe('what the business believes', () => {
  it('is usually about right', () => {
    const reads = Array.from({ length: 600 }, (_, i) => rollHype(rngFromSeed(`h-${i}`), 60, settings));
    const mean = reads.reduce((a, b) => a + b, 0) / reads.length;
    expect(Math.abs(mean - 60)).toBeLessThan(3);
  });

  it('is wrong often enough to matter', () => {
    // A business where scouting is 95% accurate has no draft busts in it.
    const reads = Array.from({ length: 600 }, (_, i) => rollHype(rngFromSeed(`w-${i}`), 60, settings));
    const badlyWrong = reads.filter((h) => Math.abs(h - 60) >= settings.hypeBustGap).length;
    expect(badlyWrong / reads.length).toBeGreaterThan(0.05);
  });

  it('stays inside the range whatever the noise does', () => {
    for (const talent of [5, 50, 99]) {
      for (let i = 0; i < 200; i++) {
        const h = rollHype(rngFromSeed(`r-${talent}-${i}`), talent, settings);
        expect(h).toBeGreaterThanOrEqual(5);
        expect(h).toBeLessThanOrEqual(99);
      }
    }
  });
});

describe('the certainties, and the ones with nothing behind them', () => {
  it('mostly delivers what the room expects', () => {
    const rolls = Array.from({ length: 800 }, (_, i) =>
      rollStandoutTalent(rngFromSeed(`s-${i}`), settings.biddingPhenomTalentFloor, settings),
    );
    const good = rolls.filter((t) => t >= settings.biddingPhenomTalentFloor).length;
    expect(good / rolls.length).toBeGreaterThan(0.7);
  });

  it('produces a bad draft pick often enough to be a real risk', () => {
    const rolls = Array.from({ length: 800 }, (_, i) =>
      rollStandoutTalent(rngFromSeed(`b-${i}`), settings.biddingPhenomTalentFloor, settings),
    );
    const busts = rolls.filter((t) => t < 60).length / rolls.length;
    expect(busts).toBeGreaterThan(0.1);
    expect(busts).toBeLessThan(0.35);
  });

  it('never turns a bust into a phenom who arrived late', () => {
    // A bust who kept a phenom's ceiling is not a bust.
    const rolls = Array.from({ length: 400 }, (_, i) =>
      rollStandoutTalent(rngFromSeed(`c-${i}`), settings.biddingPhenomTalentFloor, settings),
    );
    expect(Math.min(...rolls)).toBeLessThan(settings.hypeBustTalent + 20);
  });
});

describe('a phenom who cannot do it', () => {
  it('turns up in the schools, with the ceiling to match what is really there', () => {
    const certain = { ...settings, biddingPhenomChancePerClass: 1 };
    const phenoms: Wrestler[] = [];
    for (let i = 0; i < 200; i++) {
      const { wrestlers, phenomId } = graduateClass(rngFromSeed(`p-${i}`), 4, 2030, certain);
      const phenom = wrestlers.find((w) => w.id === phenomId);
      if (phenom) phenoms.push(phenom);
    }
    // Every one of them is rated. Not every one of them is any good.
    for (const phenom of phenoms) expect(phenom.hype).toBeGreaterThanOrEqual(settings.biddingPhenomTalentFloor);
    const busts = phenoms.filter((w) => isBust(w, settings));
    expect(busts.length).toBeGreaterThan(0);
    // And the ones with nothing behind them have nothing behind them: their
    // ceiling follows the truth rather than the noise.
    const meanBustCeiling = busts.reduce((sum, w) => sum + w.potentials.skill, 0) / busts.length;
    const solid = phenoms.filter((w) => !isBust(w, settings));
    const meanRealCeiling = solid.reduce((sum, w) => sum + w.potentials.skill, 0) / solid.length;
    expect(meanBustCeiling).toBeLessThan(meanRealCeiling);
  });

  it('turns up off the street too', () => {
    const { wrestlers, kinds } = walkOnIntake(rngFromSeed('street'), 500, 2030, settings);
    const gems = wrestlers.filter((w) => kinds[w.id] === 'gem');
    expect(gems.length).toBeGreaterThan(10);
    expect(gems.some((w) => isBust(w, settings))).toBe(true);
    // Everybody in the room can see it in them, whichever they turn out to be.
    for (const gem of gems) expect(gem.hype).toBeGreaterThanOrEqual(settings.walkOnGemTalentFloor);
  });
});

describe('nobody can tell at the point of decision', () => {
  function company(over: Partial<Promotion> = {}): Promotion {
    return {
      id: 'a', name: 'A', identity: 'sportsEntertainment', isPlayer: false, rating: 55,
      bankBalance: 2_000_000, rosterIds: [], titleIds: [], ownedTerritoryIds: [], homeTerritoryId: 't1',
      styleProfile: { workrate: 50, hardcore: 50, comedy: 50, spectacle: 50 }, bookingCredibility: 50,
      reputation: 50, hardcoreSaturation: 0, recentShowQuality: 50, weeksInTheRed: 0, closedWeek: null,
      ownerId: 'o', ownerPersonality: 'traditionalist', ppvCalendar: [], ...over,
    } as Promotion;
  }

  it('makes the auction read reputation, not the truth', () => {
    // The whole point. Two people with identical reputations and opposite
    // ceilings are indistinguishable to every company in the room — which is
    // what makes a bad signing possible at all.
    // The same man twice, differing only in what is actually there.
    const base = person('twin', { hype: 92, age: 22, popularity: 38 });
    const bust = { ...base, talent: 40 };
    const real = { ...base, talent: 92 };

    expect(worthAnAuction(bust, settings)).toBe(worthAnAuction(real, settings));
    expect(keenness(bust, company(), settings)).toBe(keenness(real, company(), settings));
    expect(marketValue(bust, 0.85, settings)).toBe(marketValue(real, 0.85, settings));
  });

  it('still lets a nobody be secretly excellent', () => {
    const sleeper = person('sleeper', { hype: 30, talent: 90 });
    expect(isSleeper(sleeper, settings)).toBe(true);
    expect(worthAnAuction({ ...sleeper, popularity: 40, age: 22 }, settings)).toBe(false);
  });
});

describe('the market finds out by watching', () => {
  it('closes on the truth for somebody who works', () => {
    let w = person('learn', { hype: 92, talent: 40 });
    for (let week = 0; week < 200; week++) {
      w = { ...w, hype: w.hype + hypeDrift(w, true, settings) };
    }
    expect(w.hype).toBeLessThan(60);
    expect(w.hype).toBeGreaterThan(38);
  });

  it('takes years rather than weeks, so it reads as a stock falling', () => {
    let w = person('slow', { hype: 92, talent: 40 });
    for (let week = 0; week < 26; week++) w = { ...w, hype: w.hype + hypeDrift(w, true, settings) };
    // Half a year in, the business has barely started to change its mind.
    expect(w.hype).toBeGreaterThan(80);
  });

  it('leaves a reputation intact for somebody kept off television', () => {
    let worked = person('a', { hype: 92, talent: 40 });
    let hidden = person('b', { hype: 92, talent: 40 });
    for (let week = 0; week < 104; week++) {
      worked = { ...worked, hype: worked.hype + hypeDrift(worked, true, settings) };
      hidden = { ...hidden, hype: hidden.hype + hypeDrift(hidden, false, settings) };
    }
    expect(hidden.hype).toBeGreaterThan(worked.hype + 15);
  });

  it('says so, once, on the week it becomes undeniable', () => {
    const written = person('w', { name: 'Vance Mercer', hype: 69, talent: 40 });
    const verdict = crossing(written, 71, settings);
    expect(verdict.kind).toBe('writtenOff');
    if (verdict.kind === 'writtenOff') expect(verdict.note).toContain('Vance Mercer');

    // And it says nothing on all the weeks either side of it.
    expect(crossing(written, 69.5, settings).kind).toBe('nothing');
    expect(crossing(person('x', { hype: 40, talent: 40 }), 41, settings).kind).toBe('nothing');
  });

  it('says the opposite thing about somebody nobody rated', () => {
    const found = person('f', { name: 'Cass Dunmore', hype: 71, talent: 90 });
    const verdict = crossing(found, 69, settings);
    expect(verdict.kind).toBe('discovered');
    if (verdict.kind === 'discovered') expect(verdict.note).toContain('Cass Dunmore');
  });

  it('has nothing more to learn once it has learned it', () => {
    const settled = person('s', { hype: 60, talent: 60 });
    expect(hypeDrift(settled, true, settings)).toBe(0);
  });
});

describe('what the sheet says', () => {
  it('describes the belief in words, never a number', () => {
    expect(hypeLabel(person('p', { hype: 90 }), settings)).toContain('next one');
    expect(hypeLabel(person('r', { hype: 75 }), settings)).toBe('Rated highly');
    expect(hypeLabel(person('n', { hype: 40 }), settings)).toBeNull();
    for (const hype of [90, 75]) {
      expect(hypeLabel(person('t', { hype }), settings)).not.toMatch(/\d/);
    }
  });
});
