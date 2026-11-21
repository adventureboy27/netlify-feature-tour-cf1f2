import { describe, it, expect } from 'vitest';
import {
  reignDays,
  ageWhenWon,
  daysAsChampion,
  longestReign,
  championshipRecords,
  titleRecords,
  ringRecords,
  oddityRecords,
  careerRecords,
  type RecordsContext,
} from './records';
import { rngFromSeed } from '../rng';
import { generateWrestlers } from '../generate/wrestler';
import { createStartingTitles, awardTitle } from '../../data/titles';
import type { TitleReignRecord, Wrestler } from '../types';

function people(count: number): Wrestler[] {
  return generateWrestlers(rngFromSeed('records'), count, { currentYear: 1985 }).map((w, i) => ({
    ...w,
    id: `w-${i}`,
    age: 30,
    debutYear: 1975,
    role: 'wrestler' as const,
  }));
}

function reign(over: Partial<TitleReignRecord> = {}): TitleReignRecord {
  return {
    titleId: 't0',
    promotionId: 'p',
    holderIds: ['w-0'],
    holderAges: [30],
    wonFromIds: null,
    wonByMethod: 'match',
    startWeek: 10,
    endWeek: 20,
    endMethod: 'lostMatch',
    ...over,
  };
}

function ctxFor(wrestlers: Wrestler[], titles = [] as ReturnType<typeof createStartingTitles>): RecordsContext {
  return { wrestlers, titles, currentWeek: 500, limit: 5 };
}

const promotionName = () => 'Atlas Pro';
const titleName = (id: string) => `Title ${id}`;

describe('reading a reign', () => {
  it('counts a finished reign in days', () => {
    expect(reignDays(reign({ startWeek: 10, endWeek: 20 }), 500)).toBe(70);
  });

  it('counts an ongoing reign up to today', () => {
    expect(reignDays(reign({ startWeek: 480, endWeek: null }), 500)).toBe(140);
  });

  it('never goes negative on a same-week reign', () => {
    expect(reignDays(reign({ startWeek: 30, endWeek: 30 }), 500)).toBe(0);
  });

  it('adds a career up and finds the single best run', () => {
    const [w] = people(1);
    w!.titleReigns = [
      reign({ startWeek: 0, endWeek: 10 }),
      reign({ startWeek: 20, endWeek: 120 }),
      reign({ startWeek: 200, endWeek: 210 }),
    ];
    expect(daysAsChampion(w!, 500)).toBe((10 + 100 + 10) * 7);
    expect(longestReign(w!, 500)).toBe(700);
  });
});

describe('how old somebody was when they won it', () => {
  it('reads the age off the reign, not off who they are today', () => {
    const r = reign({ holderIds: ['w-0', 'w-1'], holderAges: [24, 38] });
    expect(ageWhenWon(r, 'w-0')).toBe(24);
    expect(ageWhenWon(r, 'w-1')).toBe(38);
  });

  it('says nothing rather than guessing when the age was never recorded', () => {
    expect(ageWhenWon(reign({ holderIds: ['w-0'], holderAges: [] }), 'w-0')).toBeNull();
    expect(ageWhenWon(reign({ holderIds: ['w-0'], holderAges: [0] }), 'w-0')).toBeNull();
    expect(ageWhenWon(reign(), 'nobody')).toBeNull();
  });
});

describe('championship records', () => {
  it('ranks by reigns, days and single longest run', () => {
    const roster = people(3);
    roster[0]!.titleReigns = [reign({ holderIds: ['w-0'] }), reign({ holderIds: ['w-0'] })];
    roster[1]!.titleReigns = [reign({ holderIds: ['w-1'], startWeek: 0, endWeek: 300 })];

    const sections = championshipRecords(ctxFor(roster), promotionName);
    const most = sections.find((s) => s.id === 'mostReigns')!;
    const days = sections.find((s) => s.id === 'mostDays')!;

    expect(most.entries[0]!.wrestlerIds).toEqual(['w-0']);
    expect(most.entries[0]!.value).toBe(2);
    // Two short reigns lose to one very long one on total days.
    expect(days.entries[0]!.wrestlerIds).toEqual(['w-1']);
  });

  it('leaves out anybody who never won anything', () => {
    const roster = people(4);
    roster[0]!.titleReigns = [reign()];
    const most = championshipRecords(ctxFor(roster), promotionName).find((s) => s.id === 'mostReigns')!;
    expect(most.entries).toHaveLength(1);
  });

  it('says when a career spanned more than one company', () => {
    const roster = people(1);
    roster[0]!.titleReigns = [reign({ promotionId: 'a' }), reign({ promotionId: 'b' })];
    const most = championshipRecords(ctxFor(roster), (id) => `Company ${id}`).find((s) => s.id === 'mostReigns')!;
    expect(most.entries[0]!.detail).toContain('2 companies');
  });
});

describe('per-belt records', () => {
  it('finds the longest, the shortest and the most-decorated holder', () => {
    const roster = people(3);
    const belts = createStartingTitles('p', 'Atlas Pro', 'athletic');
    let belt = awardTitle(belts[0]!, ['w-0'], 0);
    belt = awardTitle(belt, ['w-1'], 200);
    belt = awardTitle(belt, ['w-0'], 202);
    belt = awardTitle(belt, ['w-2'], 400);

    const [record] = titleRecords(ctxFor(roster, [belt]));
    expect(record!.reigns).toBe(4);
    expect(record!.longest!.holderIds).toEqual(['w-0']);
    // w-1 held it two weeks, the shortest completed run.
    expect(record!.shortest!.holderIds).toEqual(['w-1']);
    expect(record!.shortest!.days).toBe(14);
    expect(record!.mostReigns!.count).toBe(2);
    expect(record!.currentHolderIds).toEqual(['w-2']);
  });

  it('does not call an ongoing reign the shortest one', () => {
    const roster = people(2);
    const belts = createStartingTitles('p', 'Atlas Pro', 'athletic');
    let belt = awardTitle(belts[0]!, ['w-0'], 0);
    belt = awardTitle(belt, ['w-1'], 499); // one week old, still running

    const [record] = titleRecords(ctxFor(roster, [belt]));
    expect(record!.shortest!.holderIds).toEqual(['w-0']);
  });

  it('handles a belt nobody has ever held', () => {
    const belts = createStartingTitles('p', 'Atlas Pro', 'athletic');
    const [record] = titleRecords(ctxFor(people(2), [belts[0]!]));
    expect(record!.reigns).toBe(0);
    expect(record!.longest).toBeNull();
    expect(record!.currentHolderIds).toEqual([]);
  });
});

describe('in-ring records', () => {
  it('keeps the bad half as well as the good', () => {
    const roster = people(3);
    roster[0]!.record = { wins: 90, losses: 10, draws: 0 };
    roster[0]!.career = { ...roster[0]!.career, matches: 100, bestWinStreak: 14, worstLosingStreak: -2 };
    roster[1]!.record = { wins: 5, losses: 95, draws: 0 };
    roster[1]!.career = { ...roster[1]!.career, matches: 100, bestWinStreak: 2, worstLosingStreak: -11 };

    const sections = ringRecords(ctxFor(roster));
    expect(sections.find((s) => s.id === 'mostWins')!.entries[0]!.wrestlerIds).toEqual(['w-0']);
    expect(sections.find((s) => s.id === 'mostLosses')!.entries[0]!.wrestlerIds).toEqual(['w-1']);
    expect(sections.find((s) => s.id === 'bestStreak')!.entries[0]!.value).toBe(14);
    // Reported as a positive length, not a negative streak.
    expect(sections.find((s) => s.id === 'worstStreak')!.entries[0]!.value).toBe(11);
  });

  it('will not rank a win percentage off three matches', () => {
    const roster = people(2);
    roster[0]!.record = { wins: 3, losses: 0, draws: 0 };
    roster[0]!.career = { ...roster[0]!.career, matches: 3 };
    roster[1]!.record = { wins: 15, losses: 15, draws: 0 };
    roster[1]!.career = { ...roster[1]!.career, matches: 30 };

    const pct = ringRecords(ctxFor(roster)).find((s) => s.id === 'winPct')!;
    expect(pct.entries.map((e) => e.wrestlerIds[0])).not.toContain('w-0');
    expect(pct.entries[0]!.wrestlerIds).toEqual(['w-1']);
  });
});

describe('the oddities', () => {
  it('uses the age on the day, not the age today', () => {
    const roster = people(2);
    // Both are 50 now; one won it at 40 a decade ago, the other last week.
    roster[0]!.age = 50;
    roster[0]!.titleReigns = [reign({ holderIds: ['w-0'], holderAges: [40], startWeek: 20, endWeek: null })];
    roster[1]!.age = 50;
    roster[1]!.titleReigns = [reign({ holderIds: ['w-1'], holderAges: [49], startWeek: 495, endWeek: null })];

    const oldest = oddityRecords(ctxFor(roster), titleName).find((s) => s.id === 'oldestChampion')!;
    expect(oldest.entries[0]!.wrestlerIds).toEqual(['w-1']);
    expect(oldest.entries[0]!.value).toBe(49);
    expect(oldest.entries[1]!.value).toBe(40);
  });

  it('never invents an impossible age for somebody who joined mid-save', () => {
    // The bug this replaced: a graduate who arrived years in, whose age was
    // reconstructed by subtracting the whole elapsed time, came out at twelve.
    const roster = people(1);
    roster[0]!.age = 30;
    roster[0]!.titleReigns = [reign({ holderIds: ['w-0'], holderAges: [22], startWeek: 20, endWeek: null })];

    const sections = oddityRecords(ctxFor(roster), titleName);
    const ages = sections
      .filter((s) => s.id === 'oldestChampion' || s.id === 'youngestChampion')
      .flatMap((s) => s.entries.map((e) => e.value));
    expect(ages.every((age) => age >= 16)).toBe(true);
    expect(ages).toContain(22);
  });

  it('reports the oldest and youngest anybody has ever wrestled at', () => {
    const roster = people(2);
    roster[0]!.career = { ...roster[0]!.career, youngestMatchAge: 19, oldestMatchAge: 52, matches: 400 };
    roster[1]!.career = { ...roster[1]!.career, youngestMatchAge: 24, oldestMatchAge: 39, matches: 200 };

    const sections = oddityRecords(ctxFor(roster), titleName);
    expect(sections.find((s) => s.id === 'oldestInAMatch')!.entries[0]!.value).toBe(52);
    expect(sections.find((s) => s.id === 'youngestInAMatch')!.entries[0]!.value).toBe(19);
  });

  it('remembers the worst injury and both ends of match quality', () => {
    const roster = people(2);
    roster[0]!.career = {
      ...roster[0]!.career,
      longestInjuryWeeks: 41,
      bestMatchRating: 95,
      worstMatchRating: 12,
      matches: 50,
    };

    const sections = oddityRecords(ctxFor(roster), titleName);
    expect(sections.find((s) => s.id === 'longestInjury')!.entries[0]!.value).toBe(41);
    expect(sections.find((s) => s.id === 'bestMatch')!.entries[0]!.value).toBe(4.75);
    expect(sections.find((s) => s.id === 'worstMatch')!.entries[0]!.value).toBe(0.5);
  });

  it('says nothing at all about a world where nothing has happened', () => {
    const sections = oddityRecords(ctxFor(people(3)), titleName);
    for (const section of sections) expect(section.entries).toHaveLength(0);
  });
});

describe('longevity', () => {
  it('measures a career from the debut year', () => {
    const roster = people(2);
    roster[0]!.debutYear = 1960;
    roster[1]!.debutYear = 1990;
    const longest = careerRecords(ctxFor(roster), 2000).find((s) => s.id === 'longestCareer')!;
    expect(longest.entries[0]!.value).toBe(40);
  });

  it('notes whether a big draw still has it', () => {
    const roster = people(2);
    roster[0]!.careerHighPopularity = 95;
    roster[0]!.popularity = 40;
    roster[1]!.careerHighPopularity = 90;
    roster[1]!.popularity = 90;

    const peak = careerRecords(ctxFor(roster), 2000).find((s) => s.id === 'highestPeak')!;
    expect(peak.entries[0]!.detail).toBe('past it now');
    expect(peak.entries[1]!.detail).toBe('still there');
  });
});
