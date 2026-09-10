// What somebody is actually chasing, and whether the week gave it to them.

import { describe, it, expect } from 'vitest';
import {
  MOTIVATORS,
  drawMotivators,
  motivatorLeverWeight,
  motivatorReasons,
  motivationLegend,
  motivationSymbolsOf,
} from './motivation';
import { dealAppetite } from './theBody';
import { weeklyMorale, type MoraleContext } from './morale';
import { defaultWorldSettings } from '../world/settings';
import { generateWrestlers } from '../generate/wrestler';
import { rngFromSeed } from '../rng';
import type { Wrestler } from '../types';

const settings = defaultWorldSettings();

function person(over: Partial<Wrestler> = {}, seed = 'motivation'): Wrestler {
  const [w] = generateWrestlers(rngFromSeed(seed), 1, { settings });
  return { ...w!, motivators: [], traits: [], popularity: 50, ego: 50, morale: 65, ...over };
}

describe('drawing motivators', () => {
  it('never draws security and competition on the same person', () => {
    for (let i = 0; i < 500; i++) {
      const rng = rngFromSeed(`draw-${i}`);
      const drawn = drawMotivators(() => rng.next(), settings);
      expect(drawn.includes('security') && drawn.includes('competition')).toBe(false);
    }
  });

  it('draws between one and three, never zero, never a duplicate', () => {
    for (let i = 0; i < 200; i++) {
      const rng = rngFromSeed(`count-${i}`);
      const drawn = drawMotivators(() => rng.next(), settings);
      expect(drawn.length).toBeGreaterThanOrEqual(1);
      expect(drawn.length).toBeLessThanOrEqual(3);
      expect(new Set(drawn).size).toBe(drawn.length);
    }
  });

  it('is deterministic for the same seed', () => {
    const a = drawMotivators(() => rngFromSeed('same').next(), settings);
    const b = drawMotivators(() => rngFromSeed('same').next(), settings);
    expect(a).toEqual(b);
  });
});

describe('generation', () => {
  it('gives every wrestler at least one motivator when settings are supplied', () => {
    const roster = generateWrestlers(rngFromSeed('roster-1'), 30, { settings });
    for (const w of roster) {
      expect(w.motivators && w.motivators.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('draws nothing when generated without settings, same as traits do', () => {
    const [w] = generateWrestlers(rngFromSeed('no-settings'), 1);
    expect(w!.motivators).toEqual([]);
  });
});

describe('championship and push re-weight existing morale terms', () => {
  it('championship-motivated cares more about gold than push-motivated does', () => {
    const champion = person({ motivators: ['championship'] });
    const pusher = person({ motivators: ['push'] });
    expect(motivatorLeverWeight(champion, 'gold')).toBeGreaterThan(motivatorLeverWeight(pusher, 'gold'));
  });

  it('push-motivated cares more about the spotlight than an unmotivated person', () => {
    const pusher = person({ motivators: ['push'] });
    const plain = person({ motivators: [] });
    expect(motivatorLeverWeight(pusher, 'spotlight')).toBeGreaterThan(motivatorLeverWeight(plain, 'spotlight'));
  });

  it('does not touch a lever it was never given', () => {
    const champion = person({ motivators: ['championship'] });
    expect(motivatorLeverWeight(champion, 'money')).toBe(1);
  });
});

describe('bespoke weekly reads', () => {
  it('fame-motivated is happy at their career peak and sour a long way off it', () => {
    const atPeak = person({ motivators: ['fame'], popularity: 80, careerHighPopularity: 80 });
    const wayDown = person({ motivators: ['fame'], popularity: 20, careerHighPopularity: 90 });

    const peakReasons = motivatorReasons(atPeak, { worked: true, opponentPopularity: null }, settings);
    const downReasons = motivatorReasons(wayDown, { worked: true, opponentPopularity: null }, settings);

    expect(peakReasons.find((r) => r.delta > 0)).toBeTruthy();
    expect(downReasons.find((r) => r.delta < 0)).toBeTruthy();
  });

  it('says nothing about fame for somebody who is not fame-motivated', () => {
    const wayDown = person({ motivators: [], popularity: 20, careerHighPopularity: 90 });
    expect(motivatorReasons(wayDown, { worked: true, opponentPopularity: null }, settings)).toHaveLength(0);
  });

  it('creative-motivated reads a fresh gimmick as good and a stale one as bad', () => {
    const fresh = person({ motivators: ['creative'], gimmickFreshness: 95 });
    const stale = person({ motivators: ['creative'], gimmickFreshness: 5 });

    expect(motivatorReasons(fresh, { worked: true, opponentPopularity: null }, settings)[0]!.delta).toBeGreaterThan(0);
    expect(motivatorReasons(stale, { worked: true, opponentPopularity: null }, settings)[0]!.delta).toBeLessThan(0);
  });

  it('competition-motivated wants a real opponent, win or lose, and only when they actually worked', () => {
    const seeker = person({ motivators: ['competition'], popularity: 40 });

    const toughTest = motivatorReasons(seeker, { worked: true, opponentPopularity: 90 }, settings);
    const easyNight = motivatorReasons(seeker, { worked: true, opponentPopularity: 5 }, settings);
    const didNotWork = motivatorReasons(seeker, { worked: false, opponentPopularity: 90 }, settings);

    expect(toughTest[0]!.delta).toBeGreaterThan(0);
    expect(easyNight[0]!.delta).toBeLessThan(0);
    expect(didNotWork).toHaveLength(0);
  });
});

describe('security-motivated at the negotiating table', () => {
  it('always reads as wanting the cover, regardless of ego or injury history', () => {
    const fearless = person({ motivators: ['security'], ego: 95, injuryHistory: [] });
    expect(dealAppetite(fearless, [], settings)).toBe('insurance');
  });

  it('leaves everybody else to the ordinary read', () => {
    const fearless = person({ motivators: [], ego: 95, injuryHistory: [] });
    expect(dealAppetite(fearless, [], settings)).not.toBe('insurance');
  });
});

describe('the unified icon row', () => {
  it('shows a motivator and an iconified trait side by side', () => {
    const w = person({ motivators: ['championship'], traits: ['inItForTheMoney'] });
    const symbols = motivationSymbolsOf(w);
    expect(symbols.some((s) => s.icon === '🏆')).toBe(true);
    expect(symbols.some((s) => s.icon === '💰')).toBe(true);
  });

  it('shows nothing for somebody with neither', () => {
    const w = person({ motivators: [], traits: [] });
    expect(motivationSymbolsOf(w)).toHaveLength(0);
  });

  it('the legend lists every motivator and every iconified trait exactly once', () => {
    const legend = motivationLegend();
    expect(legend).toHaveLength(MOTIVATORS.length + 5);
    const icons = legend.map((s) => s.icon);
    expect(new Set(icons).size).toBe(icons.length);
  });
});

describe('reaches the real weekly report', () => {
  function week(over: Partial<MoraleContext> = {}): MoraleContext {
    return {
      worked: true,
      slot: 3,
      slotCount: 6,
      currentWeek: 40,
      moodOfTheOthers: [],
      carryingSomethingReal: null,
      outcome: 'neither',
      beatenByPopularity: null,
      opponentPopularity: null,
      weeksIdle: 0,
      beltsHeld: 0,
      showRating: 55,
      gaveThemWhatTheyWanted: false,
      workedWithAllies: 0,
      workedWithEnemies: 0,
      companyRating: 55,
      roster: [],
      who: {
        id: 'w1',
        morale: 65,
        popularity: 50,
        weeklyPay: 300,
        worth: 300,
        weeksStraight: 1,
        injuries: 0,
        attached: null,
        promotionName: 'Test Co',
      },
      ...over,
    };
  }

  it('a champion who is championship-motivated is happier about the belt than one who is not', () => {
    const motivated = person({ id: 'w1', motivators: ['championship'] });
    const plain = person({ id: 'w1', motivators: [] });

    const motivatedReport = weeklyMorale(motivated, week({ beltsHeld: 1 }), settings);
    const plainReport = weeklyMorale(plain, week({ beltsHeld: 1 }), settings);

    expect(motivatedReport.delta).toBeGreaterThan(plainReport.delta);
  });
});
