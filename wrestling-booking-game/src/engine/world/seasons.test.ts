import { describe, expect, it } from 'vitest';
import {
  cancellationCost,
  holidayForWeek,
  memoriamFor,
  nightModifiers,
  rollWeather,
  seasonForWeek,
  weekOfYear,
  weeksUntilHoliday,
} from './seasons';
import { HOLIDAYS, WEEKS_PER_YEAR } from '../../data/seasons';
import { WEATHER_EVENTS, eligibleWeather } from '../../data/weather';
import { defaultWorldSettings } from './settings';
import { createTerritories } from '../../data/territories';
import { rngFromSeed } from '../rng';
import type { Territory } from '../types';

const settings = defaultWorldSettings();
const towns = createTerritories();
const townBy = (id: string) => towns.find((t) => t.id === id)!;

describe('the year', () => {
  it('wraps every 52 weeks', () => {
    expect(weekOfYear(1)).toBe(1);
    expect(weekOfYear(52)).toBe(52);
    expect(weekOfYear(53)).toBe(1);
    expect(weekOfYear(105)).toBe(1);
  });

  it('runs through all four seasons and comes back round', () => {
    const seen = new Set(Array.from({ length: WEEKS_PER_YEAR }, (_, i) => seasonForWeek(i + 1)));
    expect(seen).toEqual(new Set(['winter', 'spring', 'summer', 'autumn']));
    expect(seasonForWeek(1)).toBe(seasonForWeek(53));
  });

  it('brings the same holidays round at the same point every year', () => {
    for (const h of HOLIDAYS) {
      expect(holidayForWeek(h.week)?.id).toBe(h.id);
      expect(holidayForWeek(h.week + WEEKS_PER_YEAR)?.id).toBe(h.id);
    }
  });

  it('always has a next holiday to build toward', () => {
    for (let week = 1; week <= WEEKS_PER_YEAR; week += 1) {
      const next = weeksUntilHoliday(week);
      expect(next, `week ${week}`).not.toBeNull();
      expect(next!.weeksAway).toBeGreaterThanOrEqual(0);
      expect(next!.weeksAway).toBeLessThan(WEEKS_PER_YEAR);
    }
  });

  it('makes a holiday worth turning out for, and never a punishment', () => {
    for (const h of HOLIDAYS) {
      expect(h.draw, h.id).toBeGreaterThan(1);
      expect(h.merch, h.id).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('regional weather', () => {
  it('never puts a blizzard in the desert or a hurricane in the mountains', () => {
    // The whole appeal of regional weather is that it is regional.
    for (const e of WEATHER_EVENTS) {
      if (e.climates === 'any') continue;
      expect(e.climates.length, e.id).toBeGreaterThan(0);
    }
    expect(eligibleWeather('winter', 'desert', 'severe').map((e) => e.id)).not.toContain('blizzard');
    expect(eligibleWeather('autumn', 'mountain', 'catastrophe').map((e) => e.id)).not.toContain('hurricane');
    expect(eligibleWeather('summer', 'northern', 'notable').map((e) => e.id)).not.toContain('heavySnow');
  });

  it('names the town in every line it prints', () => {
    // A weather line that does not say where is a line the player cannot use.
    for (const e of WEATHER_EVENTS) {
      for (const line of e.lines) {
        expect(line, e.id).toContain('{town}');
      }
    }
  });

  it('substitutes the town and leaves no placeholder behind', () => {
    const rng = rngFromSeed('weather-lines');
    for (let i = 0; i < 400; i += 1) {
      const roll = rollWeather(rng, (i % WEEKS_PER_YEAR) + 1, townBy('ironbeltCity'), settings);
      if (!roll) continue;
      expect(roll.line).not.toMatch(/\{[a-z]+\}/i);
      expect(roll.line).toContain('Ironbelt City');
    }
  });

  it('only ever cancels at the catastrophe tier', () => {
    const rng = rngFromSeed('weather-cancel');
    for (let i = 0; i < 3000; i += 1) {
      const roll = rollWeather(rng, (i % WEEKS_PER_YEAR) + 1, townBy('harborlineMetro'), settings);
      if (!roll) continue;
      expect(roll.cancelled).toBe(roll.severity === 'catastrophe');
      if (roll.cancelled) expect(roll.draw).toBe(0);
    }
  });

  it('loads the dice heavily toward the harmless end', () => {
    // The design: most sides of the die are drizzle, one side is the roof
    // coming in. If catastrophe were common it would be a tax the player
    // stopped reading; if it never happened the world could not hurt them.
    const rng = rngFromSeed('weather-spread');
    const counts: Record<string, number> = {};
    const runs = 20000;
    for (let i = 0; i < runs; i += 1) {
      const roll = rollWeather(rng, (i % WEEKS_PER_YEAR) + 1, townBy('ironbeltCity'), settings);
      counts[roll?.severity ?? 'none'] = (counts[roll?.severity ?? 'none'] ?? 0) + 1;
    }
    const mild = (counts.flavour ?? 0) + (counts.minor ?? 0);
    expect(mild).toBeGreaterThan((counts.notable ?? 0) * 3);
    expect(counts.notable ?? 0).toBeGreaterThan(counts.severe ?? 0);
    expect(counts.severe ?? 0).toBeGreaterThan(counts.catastrophe ?? 0);
    // Roughly once every few years of weekly shows, not once a season.
    expect((counts.catastrophe ?? 0) / runs).toBeLessThan(0.006);
    expect((counts.catastrophe ?? 0) / runs).toBeGreaterThan(0);
  });

  it('lets chaos bend the rare end without making ordinary weeks noisier', () => {
    const spread = (chaosLevel: number) => {
      const rng = rngFromSeed('weather-chaos');
      let dangerous = 0;
      let any = 0;
      for (let i = 0; i < 20000; i += 1) {
        const roll = rollWeather(rng, (i % WEEKS_PER_YEAR) + 1, townBy('ironbeltCity'), {
          ...settings,
          chaosLevel,
        });
        if (!roll) continue;
        any += 1;
        if (roll.severity === 'severe' || roll.severity === 'catastrophe') dangerous += 1;
      }
      return { dangerous, any };
    };
    const calm = spread(0);
    const wild = spread(3);
    expect(wild.dangerous).toBeGreaterThan(calm.dangerous * 2);
    // The number of weeks with *any* weather barely moves — chaos changes
    // what happens, not how often something does.
    expect(Math.abs(wild.any - calm.any) / calm.any).toBeLessThan(0.05);
  });

  it('gives a town with no eligible weather a quiet week rather than the wrong weather', () => {
    const nowhere: Territory = { ...townBy('sunKingCounty'), climate: 'desert' };
    const rng = rngFromSeed('weather-desert');
    for (let i = 0; i < 500; i += 1) {
      const roll = rollWeather(rng, 5, nowhere, settings); // deep winter, desert
      if (!roll) continue;
      expect(roll.event.climates === 'any' || roll.event.climates.includes('desert')).toBe(true);
    }
  });
});

describe('a night that never happened', () => {
  it('still costs most of what it was going to', () => {
    // The building was booked and the trucks went out before anybody looked
    // at the sky. That is what makes a venue a bet rather than a purchase.
    const cost = cancellationCost(10000, settings);
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(10000);
  });
});

describe('the tribute', () => {
  it('draws better than an ordinary night and says who it was for', () => {
    const m = memoriamFor('w1', 'Earl Mercer', 'Southside Championship Wrestling', settings);
    expect(m.draw).toBeGreaterThan(1);
    expect(m.line).toContain('Earl Mercer');
    expect(m.line).toContain('Southside Championship Wrestling');
  });
});

describe('what a night is worth altogether', () => {
  it('multiplies the date and the weather together', () => {
    const rng = rngFromSeed('night');
    const night = nightModifiers(rng, 51, townBy('ashfordHeights'), settings);
    expect(night.holiday?.id).toBe('midwinter');
    expect(night.draw).toBeCloseTo(night.holiday!.draw * (night.weather?.draw ?? 1), 5);
    expect(night.merch).toBeCloseTo(night.holiday!.merch, 5);
  });

  it('is an ordinary week most weeks', () => {
    const rng = rngFromSeed('ordinary');
    let plain = 0;
    for (let i = 0; i < 200; i += 1) {
      const night = nightModifiers(rng, 20 + i, townBy('millValley'), settings);
      if (!night.holiday && night.draw === 1) plain += 1;
    }
    expect(plain).toBeGreaterThan(100);
  });
});

describe('variety', () => {
  it('does not say the same thing week after week', () => {
    // "Very few repeats" is the requirement. A flavour table whose only
    // any-season any-climate entry has the highest weight produces the same
    // sentence five weeks running, which is what the first cut of this did.
    const rng = rngFromSeed('variety');
    const lines: string[] = [];
    for (let week = 1; week <= 52; week += 1) {
      const roll = rollWeather(rng, week, townBy('brambleHollow'), settings);
      if (roll) lines.push(roll.line);
    }
    const distinct = new Set(lines).size;
    expect(lines.length).toBeGreaterThan(10);
    expect(distinct).toBeGreaterThan(lines.length * 0.55);
    // And no single line dominates the year.
    const commonest = Math.max(...[...new Set(lines)].map((l) => lines.filter((x) => x === l).length));
    expect(commonest).toBeLessThan(lines.length * 0.3);
  });

  it('gives every town a different year', () => {
    const yearFor = (townId: string) => {
      const rng = rngFromSeed('same-seed');
      const out: string[] = [];
      for (let week = 1; week <= 52; week += 1) {
        const roll = rollWeather(rng, week, townBy(townId), settings);
        if (roll) out.push(roll.event.id);
      }
      return out.join(',');
    };
    // Same rng seed, different climates — the weather has to differ.
    expect(yearFor('northRidge')).not.toBe(yearFor('sunKingCounty'));
    expect(yearFor('harborlineMetro')).not.toBe(yearFor('graniteFalls'));
  });
});
