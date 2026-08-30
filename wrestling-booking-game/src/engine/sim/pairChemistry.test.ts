import { describe, it, expect } from 'vitest';
import {
  allPairingHistories,
  innateChemistry,
  legendStatus,
  pairChemistryBonus,
  pastBlowoffs,
  segmentPairChemistry,
  sharedHistoryBonus,
  type PastBlowoff,
} from './pairChemistry';
import { defaultWorldSettings } from '../world/settings';
import type { Segment } from '../types';
import type { Storyline as StorylineType } from '../world/storyline';

const settings = defaultWorldSettings();

function blownOff(participantIds: string[], week: number, quality: number): StorylineType {
  return {
    id: `story-${week}`,
    name: 'Test story',
    participantIds,
    rivalryId: `rivalry-${week}`,
    stage: 'blownOff',
    startWeek: week - 10,
    lastAdvancedWeek: week,
    beats: [],
    neglectedWeeks: 0,
    resolvedWeek: week,
    payoff: 'Settled it.',
    blowOffQuality: quality,
  };
}

function match(sideA: string[], sideB: string[]): Segment {
  return {
    slot: 0,
    kind: 'match',
    participants: [
      ...sideA.map((wrestlerId) => ({ wrestlerId, side: 0, role: 'competitor' as const })),
      ...sideB.map((wrestlerId) => ({ wrestlerId, side: 1, role: 'competitor' as const })),
    ],
    rules: { pace: 'standard', minutes: 12 } as unknown as Segment['rules'],
    stipulation: null,
    titleIds: [],
    deckStacking: {} as unknown as Segment['deckStacking'],
    result: null,
  } as Segment;
}

describe('innateChemistry', () => {
  it('is deterministic for the same pair', () => {
    const a = innateChemistry(['w1', 'w2'], settings);
    const b = innateChemistry(['w1', 'w2'], settings);
    expect(a).toBe(b);
  });

  it('does not care which order the ids come in', () => {
    expect(innateChemistry(['w1', 'w2'], settings)).toBe(innateChemistry(['w2', 'w1'], settings));
  });

  it('differs for a different pair', () => {
    expect(innateChemistry(['w1', 'w2'], settings)).not.toBe(innateChemistry(['w1', 'w3'], settings));
  });

  it('stays within the configured bounds across many pairs', () => {
    for (let i = 0; i < 200; i++) {
      const roll = innateChemistry([`a${i}`, `b${i}`], settings);
      expect(roll).toBeGreaterThanOrEqual(settings.chemistryFloor);
      expect(roll).toBeLessThanOrEqual(settings.chemistryCeiling);
    }
  });

  it('produces both a real positive tail and a real negative tail across many pairs', () => {
    const rolls = Array.from({ length: 300 }, (_, i) => innateChemistry([`x${i}`, `y${i}`], settings));
    expect(Math.max(...rolls)).toBeGreaterThan(settings.chemistryMean + settings.chemistrySpread);
    expect(Math.min(...rolls)).toBeLessThan(settings.chemistryMean - settings.chemistrySpread);
  });
});

describe('pastBlowoffs', () => {
  it('finds a blown-off story between exactly these two', () => {
    const storylines = [blownOff(['w1', 'w2'], 40, 1.1)];
    expect(pastBlowoffs(storylines, ['w1', 'w2'])).toEqual([{ week: 40, quality: 1.1 }]);
  });

  it('ignores a story between a different set of people', () => {
    const storylines = [blownOff(['w1', 'w3'], 40, 1.1)];
    expect(pastBlowoffs(storylines, ['w1', 'w2'])).toEqual([]);
  });

  it('ignores anything not actually blown off', () => {
    const storylines: StorylineType[] = [
      { ...blownOff(['w1', 'w2'], 40, 1.1), stage: 'fizzled' },
    ];
    expect(pastBlowoffs(storylines, ['w1', 'w2'])).toEqual([]);
  });

  it('ignores a blown-off story with no recorded quality (an old save)', () => {
    const storylines: StorylineType[] = [{ ...blownOff(['w1', 'w2'], 40, 1.1), blowOffQuality: undefined }];
    expect(pastBlowoffs(storylines, ['w1', 'w2'])).toEqual([]);
  });

  it('returns multiple blow-offs oldest first', () => {
    const storylines = [blownOff(['w1', 'w2'], 80, 0.9), blownOff(['w1', 'w2'], 20, 1.3)];
    expect(pastBlowoffs(storylines, ['w1', 'w2']).map((h) => h.week)).toEqual([20, 80]);
  });
});

describe('sharedHistoryBonus', () => {
  it('is zero with no history at all', () => {
    expect(sharedHistoryBonus([], 100, settings)).toBe(0);
  });

  it('penalises a revival brought back too soon after the last blow-off', () => {
    const history: PastBlowoff[] = [{ week: 100, quality: 1.5 }];
    const bonus = sharedHistoryBonus(history, 101, settings);
    expect(bonus).toBeLessThan(0);
  });

  it('rewards a revival brought back after a real gap, scaled by the best past quality', () => {
    const history: PastBlowoff[] = [{ week: 100, quality: 1.5 }];
    const bonus = sharedHistoryBonus(history, 100 + settings.rivalryRestWeeks + 5, settings);
    expect(bonus).toBeGreaterThan(0);
  });

  it('gives a weaker spark for a mediocre past blow-off than a great one', () => {
    const week = 100 + settings.rivalryRestWeeks + 5;
    const weak = sharedHistoryBonus([{ week: 100, quality: 0.3 }], week, settings);
    const strong = sharedHistoryBonus([{ week: 100, quality: 1.8 }], week, settings);
    expect(strong).toBeGreaterThan(weak);
  });

  it('fades the spark with every additional revival', () => {
    const week = 500;
    const once = sharedHistoryBonus([{ week: week - 100, quality: 1.5 }], week, settings);
    const manyTimes = sharedHistoryBonus(
      [
        { week: week - 400, quality: 1.5 },
        { week: week - 300, quality: 1.5 },
        { week: week - 200, quality: 1.5 },
        { week: week - 100, quality: 1.5 },
      ],
      week,
      settings,
    );
    expect(manyTimes).toBeLessThan(once);
  });
});

describe('pairChemistryBonus', () => {
  it('stays within the combined bounds', () => {
    const history = [blownOff(['w1', 'w2'], 100, 2)];
    const bonus = pairChemistryBonus(['w1', 'w2'], history, 100 + settings.rivalryRestWeeks + 1, settings);
    expect(bonus).toBeGreaterThanOrEqual(settings.chemistryBonusFloor);
    expect(bonus).toBeLessThanOrEqual(settings.chemistryBonusCeiling);
  });
});

describe('segmentPairChemistry', () => {
  it('averages across every cross-side pairing, not just one', () => {
    const segment = match(['a1', 'a2'], ['b1', 'b2']);
    // Should not throw, and should land inside the same overall bounds a
    // single pairing would, since it is an average of them.
    const value = segmentPairChemistry(segment, [], 10, settings);
    expect(value).toBeGreaterThanOrEqual(settings.chemistryBonusFloor);
    expect(value).toBeLessThanOrEqual(settings.chemistryBonusCeiling);
  });

  it('is zero for a segment with nobody on opposing sides', () => {
    const segment = match(['a1'], []);
    expect(segmentPairChemistry(segment, [], 10, settings)).toBe(0);
  });
});

describe('legendStatus', () => {
  it('is none with no history', () => {
    expect(legendStatus([], settings)).toBe('none');
  });

  it('is notable off a single great blow-off', () => {
    expect(legendStatus([{ week: 1, quality: settings.storylineGreatBlowoff }], settings)).toBe('notable');
  });

  it('is notable off enough fair blow-offs even with none great', () => {
    const history = Array.from({ length: settings.classicRivalryFairBlowoffs }, (_, i) => ({
      week: i,
      quality: settings.storylineFairBlowoff,
    }));
    expect(legendStatus(history, settings)).toBe('notable');
  });

  it('is allTime once enough blow-offs clear the great bar', () => {
    const history = Array.from({ length: settings.allTimeRivalGreatBlowoffs }, (_, i) => ({
      week: i,
      quality: settings.storylineGreatBlowoff,
    }));
    expect(legendStatus(history, settings)).toBe('allTime');
  });
});

describe('allPairingHistories', () => {
  it('groups blow-offs by their exact participant set', () => {
    const storylines = [
      blownOff(['w1', 'w2'], 10, 1.0),
      blownOff(['w1', 'w2'], 200, 1.5),
      blownOff(['w3', 'w4'], 50, 0.5),
    ];
    const grouped = allPairingHistories(storylines);
    expect(grouped).toHaveLength(2);
    const pair12 = grouped.find((g) => g.participantIds.includes('w1'))!;
    expect(pair12.history.map((h) => h.week)).toEqual([10, 200]);
  });

  it('ignores fizzled and quality-less storylines', () => {
    const storylines: StorylineType[] = [
      { ...blownOff(['w1', 'w2'], 10, 1.0), stage: 'fizzled' },
    ];
    expect(allPairingHistories(storylines)).toEqual([]);
  });
});
