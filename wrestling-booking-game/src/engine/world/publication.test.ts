import { describe, it, expect } from 'vitest';
import { publish, publishPositions, rankingOf, movement } from './publication';
import { formTeams, teamIdFactory } from './tagTeams';
import { defaultWorldSettings } from './settings';
import { rngFromSeed } from '../rng';
import { generateWrestlers } from '../generate/wrestler';
import { createStartingTitles, awardTitle } from '../../data/titles';
import type { Stable, Title, Wrestler } from '../types';

const settings = defaultWorldSettings();

function people(count: number, gender: 'm' | 'f', promotionId: string, seed = 'pub'): Wrestler[] {
  return generateWrestlers(rngFromSeed(seed + gender), count, { currentYear: 1985 }).map((w, i) => ({
    ...w,
    id: `${promotionId}-${gender}-${i}`,
    gender,
    promotionId,
    popularity: 80 - i * 4,
    careerHighPopularity: 82 - i * 4,
  }));
}

function ctxFor(wrestlers: Wrestler[], titles: Title[] = [], stables: Stable[] = [], currentWeek = 200) {
  return { currentWeek, currentYear: 1990, titles, wrestlers, stables, settings };
}

describe('the weekly sheet', () => {
  it('keeps the two divisions separate', () => {
    const roster = [...people(12, 'm', 'p'), ...people(12, 'f', 'p')];
    const sheet = publish(ctxFor(roster));

    expect(sheet.mens.wrestlers.length).toBe(settings.publicationWrestlerListSize);
    expect(sheet.womens.wrestlers.length).toBe(settings.publicationWrestlerListSize);

    const byId = new Map(roster.map((w) => [w.id, w]));
    for (const entry of sheet.mens.wrestlers) expect(byId.get(entry.wrestlerId)!.gender).toBe('m');
    for (const entry of sheet.womens.wrestlers) expect(byId.get(entry.wrestlerId)!.gender).toBe('f');
  });

  it('ranks across every company, not just yours', () => {
    const roster = [...people(6, 'm', 'you'), ...people(6, 'm', 'rival-0', 'other')];
    const sheet = publish(ctxFor(roster));
    const promotions = new Set(sheet.mens.wrestlers.map((r) => r.promotionId));
    expect(promotions.size).toBeGreaterThan(1);
  });

  it('leaves out the unsigned, the retired and the dead', () => {
    const roster = people(12, 'm', 'p');
    roster[0]!.promotionId = null;
    roster[1]!.careerStatus = 'retired';
    roster[2]!.deceased = { wrestlerId: roster[2]!.id, cause: 'age', age: 70, week: 10 };

    const listed = new Set(publish(ctxFor(roster)).mens.wrestlers.map((r) => r.wrestlerId));
    expect(listed.has(roster[0]!.id)).toBe(false);
    expect(listed.has(roster[1]!.id)).toBe(false);
    expect(listed.has(roster[2]!.id)).toBe(false);
  });

  it('numbers from one, in descending order', () => {
    const sheet = publish(ctxFor(people(14, 'm', 'p')));
    sheet.mens.wrestlers.forEach((entry, i) => {
      expect(entry.rank).toBe(i + 1);
      if (i > 0) expect(entry.score).toBeLessThanOrEqual(sheet.mens.wrestlers[i - 1]!.score);
    });
  });

  it('shows the best belt somebody holds beside their name', () => {
    const roster = people(8, 'm', 'p');
    const belts = createStartingTitles('p', 'Atlas Pro', 'athletic');
    const world = awardTitle(belts[0]!, [roster[0]!.id], 1);
    const secondary = awardTitle(belts[1]!, [roster[0]!.id], 1);

    const sheet = publish(ctxFor(roster, [world, secondary]));
    const champion = sheet.mens.wrestlers.find((r) => r.wrestlerId === roster[0]!.id)!;
    expect(champion.titleId).toBe(world.id);
  });
});

describe('the tag lists', () => {
  it('ranks teams in each division, and only intact ones', () => {
    const men = people(12, 'm', 'p');
    const women = people(12, 'f', 'p');
    const teams = [
      ...formTeams(rngFromSeed('t1'), men, 'p', { taken: new Set(), week: 1, count: 4 }, teamIdFactory('m')),
      ...formTeams(rngFromSeed('t2'), women, 'p', { taken: new Set(), week: 1, count: 4 }, teamIdFactory('f')),
    ];
    const sheet = publish(ctxFor([...men, ...women], [], teams));

    expect(sheet.mens.teams.length).toBeGreaterThan(0);
    expect(sheet.womens.teams.length).toBeGreaterThan(0);
    for (const entry of sheet.mens.teams) {
      const members = entry.memberIds.map((id) => men.find((w) => w.id === id));
      expect(members.every(Boolean)).toBe(true);
    }
  });

  it('drops a team once it has broken up', () => {
    const men = people(12, 'm', 'p');
    const teams = formTeams(rngFromSeed('t3'), men, 'p', { taken: new Set(), week: 1, count: 4 }, teamIdFactory('m'));
    const before = publish(ctxFor(men, [], teams)).mens.teams.length;

    teams[0]!.disbandedWeek = 50;
    expect(publish(ctxFor(men, [], teams)).mens.teams.length).toBe(before - 1);
  });

  it('rewards a partnership that has lasted', () => {
    const men = people(8, 'm', 'p');
    const teams = formTeams(rngFromSeed('t4'), men, 'p', { taken: new Set(), week: 1, count: 2 }, teamIdFactory('m'));
    if (teams.length < 2) return;

    // Identical on paper except one has been together for years.
    teams[0]!.formedWeek = 1;
    teams[1]!.formedWeek = 195;
    const sheet = publish(ctxFor(men, [], teams, 200));
    const older = sheet.mens.teams.find((t) => t.teamId === teams[0]!.id)!;
    const newer = sheet.mens.teams.find((t) => t.teamId === teams[1]!.id)!;
    expect(older.score).toBeGreaterThan(newer.score);
  });
});

describe('the championship roll', () => {
  it('lists every held belt, most prestigious first, and no vacancies', () => {
    const roster = people(10, 'm', 'p');
    const belts = createStartingTitles('p', 'Atlas Pro', 'athletic');
    const held = [awardTitle(belts[0]!, [roster[0]!.id], 1), awardTitle(belts[1]!, [roster[1]!.id], 20), belts[4]!];

    const champions = publish(ctxFor(roster, held, [], 60)).mens.champions;
    expect(champions).toHaveLength(2);
    expect(champions[0]!.titleId).toBe(belts[0]!.id);
    expect(champions[0]!.reignWeeks).toBe(59);
  });

  it('files a women’s belt under the women’s division', () => {
    const women = people(6, 'f', 'p');
    const belts = createStartingTitles('p', 'Atlas Pro', 'athletic');
    const womensBelt = awardTitle(belts.find((t) => t.division === 'womens')!, [women[0]!.id], 1);

    const sheet = publish(ctxFor(women, [womensBelt]));
    expect(sheet.womens.champions).toHaveLength(1);
    expect(sheet.mens.champions).toHaveLength(0);
  });

  it('files an open-division belt under whoever is holding it', () => {
    const women = people(6, 'f', 'p');
    const belts = createStartingTitles('p', 'Atlas Pro', 'athletic');
    const openBelt = awardTitle(belts.find((t) => t.division === 'open')!, [women[0]!.id, women[1]!.id], 1);

    const sheet = publish(ctxFor(women, [openBelt]));
    expect(sheet.womens.champions).toHaveLength(1);
    expect(sheet.mens.champions).toHaveLength(0);
  });
});

describe('week to week', () => {
  it('the light snapshot agrees with the full sheet on positions', () => {
    const roster = [...people(12, 'm', 'p'), ...people(8, 'f', 'p')];
    const full = publish(ctxFor(roster));
    const light = publishPositions(ctxFor(roster));

    for (const entry of full.mens.wrestlers) expect(light.mens[entry.wrestlerId]).toBe(entry.rank);
    for (const entry of full.womens.wrestlers) expect(light.womens[entry.wrestlerId]).toBe(entry.rank);
  });

  it('reports where somebody sits', () => {
    const roster = people(12, 'm', 'p');
    const sheet = publish(ctxFor(roster));
    expect(rankingOf(sheet, sheet.mens.wrestlers[0]!.wrestlerId, 'm')).toBe(1);
    expect(rankingOf(sheet, 'nobody', 'm')).toBeNull();
  });

  it('reports which way they moved', () => {
    const roster = people(12, 'm', 'p');
    const before = publishPositions(ctxFor(roster));
    const climber = roster.find((w) => w.id === publish(ctxFor(roster)).mens.wrestlers[4]!.wrestlerId)!;
    climber.popularity = 100;
    climber.careerHighPopularity = 100;
    const after = publish(ctxFor(roster));

    expect(movement(after, before, climber.id, 'm')).toBe('up');
    expect(movement(after, null, climber.id, 'm')).toBe('same');
    expect(movement(after, before, 'nobody', 'm')).toBeNull();
  });
});
