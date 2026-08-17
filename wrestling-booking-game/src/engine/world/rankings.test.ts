import { describe, it, expect } from 'vitest';
import { contenderRankings, worldRankings, contenderScore, worldScore, positionOf } from './rankings';
import { defaultWorldSettings } from './settings';
import { rngFromSeed } from '../rng';
import { generateWrestlers } from '../generate/wrestler';
import { createStartingTitles, awardTitle } from '../../data/titles';
import type { TitleReignRecord, Wrestler } from '../types';

const settings = defaultWorldSettings();

function people(count: number): Wrestler[] {
  return generateWrestlers(rngFromSeed('rankings'), count, { currentYear: 1985 }).map((w) => ({
    ...w,
    momentum: 50,
    popularity: 50,
    injury: null,
    record: { wins: 10, losses: 10, draws: 0 },
    titleReigns: [],
    promotionId: 'player-promotion',
  }));
}

function reigns(count: number, weeksEach: number): TitleReignRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    titleId: `t${i}`,
    promotionId: 'p',
    holderIds: ['x'],
    holderAges: [30],
    wonFromIds: null,
    wonByMethod: 'match' as const,
    startWeek: i * 60,
    endWeek: i * 60 + weeksEach,
    endMethod: 'lostMatch' as const,
  }));
}

const ctx = { currentWeek: 300, titles: [], settings };

describe('contenders', () => {
  it('puts the hot hand above the bigger name', () => {
    const [a, b] = people(2);
    const hot = { ...a!, momentum: 95, popularity: 55, record: { wins: 18, losses: 2, draws: 0 } };
    const coasting = { ...b!, momentum: 20, popularity: 70, record: { wins: 5, losses: 15, draws: 0 } };
    expect(contenderScore(hot, ctx)).toBeGreaterThan(contenderScore(coasting, ctx));
  });

  it('leaves the champion off its own contender list', () => {
    const roster = people(6);
    const belt = awardTitle(
      createStartingTitles('player-promotion', 'Southside Championship Wrestling', 'territory')[0]!,
      [roster[0]!.id],
      1,
    );
    const ranked = contenderRankings(roster, 'player-promotion', { ...ctx, titles: [belt] });
    expect(ranked.map((r) => r.wrestlerId)).not.toContain(roster[0]!.id);
    expect(ranked).toHaveLength(5);
  });

  it('leaves out anybody who cannot work', () => {
    const roster = people(4);
    roster[0]!.injury = {
      severity: 'moderate',
      grade: 35,
      description: 'Ribs',
      sufferedWeek: 1,
      totalWeeks: 8,
      weeksRemaining: 5,
      permanentStatLoss: {},
      earlyReturnWeeksUsed: 0,
    };
    roster[1]!.careerStatus = 'retired';
    const ranked = contenderRankings(roster, 'player-promotion', ctx);
    expect(ranked).toHaveLength(2);
  });

  it('caps the list', () => {
    expect(contenderRankings(people(40), 'player-promotion', ctx)).toHaveLength(settings.contenderRankingSize);
  });

  it('numbers from one, in order', () => {
    const ranked = contenderRankings(people(8), 'player-promotion', ctx);
    expect(ranked[0]!.rank).toBe(1);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i]!.score).toBeLessThanOrEqual(ranked[i - 1]!.score);
      expect(ranked[i]!.rank).toBe(i + 1);
    }
  });
});

describe('the world list', () => {
  it('rates a decorated career above a hot month', () => {
    const [a, b] = people(2);
    const legend = {
      ...a!,
      popularity: 78,
      careerHighPopularity: 95,
      titleReigns: reigns(5, 60),
      momentum: 40,
    };
    const streak = { ...b!, popularity: 70, careerHighPopularity: 70, momentum: 100 };
    expect(worldScore(legend, ctx)).toBeGreaterThan(worldScore(streak, ctx));
  });

  it('ranks across promotions', () => {
    const mine = people(5).map((w) => ({ ...w, promotionId: 'player-promotion', popularity: 60 }));
    const theirs = people(5).map((w, i) => ({
      ...w,
      id: `rival-w-${i}`,
      promotionId: 'rival-0',
      popularity: 90,
      careerHighPopularity: 92,
    }));
    const ranked = worldRankings([...mine, ...theirs], ctx);
    expect(ranked[0]!.wrestlerId.startsWith('rival-w')).toBe(true);
  });

  it('leaves out the unsigned — a world ranking is for people who work somewhere', () => {
    const signed = people(3);
    const freeAgents = people(3).map((w, i) => ({ ...w, id: `fa-${i}`, promotionId: null }));
    const ranked = worldRankings([...signed, ...freeAgents], ctx);
    expect(ranked).toHaveLength(3);
  });

  it('shows the most prestigious belt somebody holds', () => {
    const roster = people(3);
    const belts = createStartingTitles('player-promotion', 'Southside Championship Wrestling', 'territory');
    const world = awardTitle(belts[0]!, [roster[0]!.id], 1);
    const secondary = awardTitle(belts[1]!, [roster[0]!.id], 1);

    const ranked = worldRankings(roster, { ...ctx, titles: [world, secondary] });
    const champion = ranked.find((r) => r.wrestlerId === roster[0]!.id)!;
    expect(champion.titleId).toBe(world.id);
  });

  it('reports where somebody sits, or that they are off the list', () => {
    const roster = people(4);
    const ranked = worldRankings(roster, ctx);
    expect(positionOf(ranked, ranked[2]!.wrestlerId)).toBe(3);
    expect(positionOf(ranked, 'nobody')).toBeNull();
  });
});
