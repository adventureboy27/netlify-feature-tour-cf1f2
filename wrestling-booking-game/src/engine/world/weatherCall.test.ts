import { describe, expect, it } from 'vitest';
import { carriedWeather, hasCallLines, resolveWeatherCall, weatherCallFrom } from './weatherCall';
import { rollWeather } from './seasons';
import { WEATHER_CALL_LINES, WEATHER_CALL_OPTIONS, FORECAST_LINES } from '../../data/weatherCalls';
import { WEATHER_EVENTS } from '../../data/weather';
import { defaultWorldSettings } from './settings';
import { createTerritories } from '../../data/territories';
import { rngFromSeed } from '../rng';
import type { WeatherCall } from './weatherCall';

const settings = defaultWorldSettings();
const towns = createTerritories();
const town = towns.find((t) => t.id === 'northRidge')!;

const severeRoll = () => {
  const rng = rngFromSeed('severe');
  for (let i = 0; i < 20000; i += 1) {
    const roll = rollWeather(rng, (i % 52) + 1, town, { ...settings, chaosLevel: 3 });
    if (roll?.severity === 'severe') return roll;
  }
  throw new Error('no severe weather in 20000 rolls');
};

const callWith = (over: Partial<WeatherCall> = {}): WeatherCall => ({
  week: 10,
  territoryId: town.id,
  territoryName: town.name,
  eventId: 'blizzard',
  eventName: 'Blizzard',
  warning: 'A blizzard shut North Ridge down.',
  forecast: 'The forecast is as bad as forecasts get.',
  strength: 'likely',
  willHit: true,
  options: WEATHER_CALL_OPTIONS,
  ...over,
});

describe('when the call is offered', () => {
  it('only ever asks about severe weather', () => {
    const rng = rngFromSeed('tiers');
    for (let i = 0; i < 4000; i += 1) {
      const roll = rollWeather(rng, (i % 52) + 1, town, { ...settings, chaosLevel: 3 });
      if (!roll) continue;
      const call = weatherCallFrom(rng, roll, 1, town.id, town.name, settings);
      // A roof coming in is not a decision, it is a fact; drizzle is not
      // worth stopping the week for.
      expect(Boolean(call)).toBe(roll.severity === 'severe');
    }
  });

  it('has prose written for every severe event that can ask', () => {
    // A decision the player makes and never hears the result of is worse than
    // no decision at all.
    for (const e of WEATHER_EVENTS) {
      if (e.severity !== 'severe') continue;
      expect(hasCallLines(e.id), e.id).toBe(true);
    }
  });

  it('says how sure the forecast is in words, never a number', () => {
    for (const lines of Object.values(FORECAST_LINES)) {
      for (const line of lines) {
        expect(line, line).not.toMatch(/\d/);
        expect(line, line).not.toContain('%');
      }
    }
  });

  it('offers two strengths of forecast, because one would make the answer fixed', () => {
    const rng = rngFromSeed('strengths');
    const roll = severeRoll();
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      seen.add(weatherCallFrom(rng, roll, 1, town.id, town.name, settings)!.strength);
    }
    expect(seen).toEqual(new Set(['likely', 'even']));
  });

  it('decides whether the storm hits before the player answers', () => {
    // The choice must not reach backwards. Whether it was ever going to
    // arrive is settled when the warning is issued.
    const rng = rngFromSeed('predetermined');
    const call = weatherCallFrom(rng, severeRoll(), 1, town.id, town.name, settings)!;
    expect(typeof call.willHit).toBe('boolean');
    const a = resolveWeatherCall(call, 'runIt', settings, 0.4);
    const b = resolveWeatherCall(call, 'runIt', settings, 0.4);
    expect(a).toEqual(b);
  });

  it('carries the weather rather than re-rolling it when answered', () => {
    const roll = severeRoll();
    const rng = rngFromSeed('carry');
    const call = weatherCallFrom(rng, roll, 1, town.id, town.name, settings)!;
    expect(carriedWeather(call).event.id).toBe(roll.event.id);
    expect(carriedWeather(call).cancelled).toBe(false);
  });
});

describe('the shape of the decision', () => {
  it('gives every option something to lose', () => {
    // An option with no cost is not a decision, it is a button.
    for (const option of WEATHER_CALL_OPTIONS) {
      expect(option.gains.length, option.id).toBeGreaterThan(20);
      expect(option.costs.length, option.id).toBeGreaterThan(20);
    }
  });

  it('never lets calling it off be free', () => {
    // THE trap this whole system exists to avoid: if cancelling avoided the
    // costs it would be strictly correct every time a warning appeared, and
    // the player would click it forever without thinking.
    const off = resolveWeatherCall(callWith(), 'callItOff', settings);
    expect(off.costShare).toBeGreaterThan(0);
    expect(off.following).toBeLessThan(0);
    expect(off.ran).toBe(false);
    expect(off.draw).toBe(0);
  });

  it('punishes calling off a storm that never came harder than one that did', () => {
    const rightCall = resolveWeatherCall(callWith({ willHit: true }), 'callItOff', settings);
    const wrongCall = resolveWeatherCall(callWith({ willHit: false }), 'callItOff', settings);
    expect(wrongCall.following).toBeLessThan(rightCall.following);
  });

  it('rewards running into it, and charges for it when it lands', () => {
    const hit = resolveWeatherCall(callWith({ willHit: true }), 'runIt', settings, 0.4);
    const missed = resolveWeatherCall(callWith({ willHit: false }), 'runIt', settings, 0.4);
    // They turned out for you in it — that counts either way.
    expect(hit.following).toBeGreaterThan(0);
    expect(missed.following).toBeGreaterThan(0);
    // But the night itself is far worse, and somebody may not walk away.
    expect(hit.draw).toBeLessThan(missed.draw);
    expect(hit.injuryRisk).toBeGreaterThan(0);
    expect(missed.injuryRisk).toBe(0);
    expect(hit.extraWear).toBeGreaterThan(0);
  });

  it('makes moving it a hedge — the show happens, badly, and is billed', () => {
    const moved = resolveWeatherCall(callWith(), 'moveIt', settings);
    expect(moved.ran).toBe(true);
    expect(moved.draw).toBeGreaterThan(0);
    expect(moved.draw).toBeLessThan(1);
    expect(moved.extraCost).toBeGreaterThan(0);
    expect(moved.following).toBeLessThan(0);
    expect(moved.injuryRisk).toBe(0);
  });

  it('has no option that dominates the others', () => {
    // Running is best when the storm misses; calling off is best when it
    // lands. If either were best in both worlds there would be no decision.
    const hit = {
      run: resolveWeatherCall(callWith({ willHit: true }), 'runIt', settings, 0.35),
      off: resolveWeatherCall(callWith({ willHit: true }), 'callItOff', settings),
    };
    const miss = {
      run: resolveWeatherCall(callWith({ willHit: false }), 'runIt', settings, 0.35),
      off: resolveWeatherCall(callWith({ willHit: false }), 'callItOff', settings),
    };
    // Storm lands: calling off keeps more of the money and hurts nobody.
    expect(hit.off.costShare).toBeLessThan(hit.run.costShare);
    // Storm turns: running keeps a house and the town's goodwill.
    expect(miss.run.draw).toBeGreaterThan(miss.off.draw);
    expect(miss.run.following).toBeGreaterThan(miss.off.following);
  });

  it('always says what happened, with the town in it', () => {
    for (const eventId of Object.keys(WEATHER_CALL_LINES)) {
      for (const choice of ['runIt', 'callItOff', 'moveIt'] as const) {
        for (const willHit of [true, false]) {
          const out = resolveWeatherCall(callWith({ eventId, willHit }), choice, settings, 0.4);
          expect(out.line.length, `${eventId}/${choice}`).toBeGreaterThan(30);
          expect(out.line, `${eventId}/${choice}`).not.toMatch(/\{[a-z]+\}/i);
          expect(out.line, `${eventId}/${choice}`).toContain(town.name);
        }
      }
    }
  });
});
