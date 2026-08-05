import { describe, it, expect } from 'vitest';
import { bookRivalCard, runRivalShow, canWork } from './rivalBooking';
import { defaultWorldSettings } from './settings';
import { rngFromSeed } from '../rng';
import { generateWrestlers } from '../generate/wrestler';
import { createStartingTitles, awardTitle } from '../../data/titles';
import { formTeams, teamIdFactory } from './tagTeams';
import type { Promotion, Wrestler } from '../types';

const settings = defaultWorldSettings();

function promotion(overrides: Partial<Promotion> = {}): Promotion {
  return {
    id: 'rival-0',
    name: 'Atlas Pro',
    identity: 'athletic',
    isPlayer: false,
    rating: 60,
    bankBalance: 100_000,
    rosterIds: [],
    titleIds: [],
    ownedTerritoryIds: [],
    homeTerritoryId: 'territory-unassigned',
    styleProfile: {
      preferredStyles: [],
      violenceTolerance: 50,
      workrateVsStarPower: 50,
      divisionFocus: ['mens'],
      promoHeavy: false,
    },
    bookingCredibility: 50,
    reputation: 60,
    hardcoreSaturation: 0,
    recentShowQuality: 60,
    weeksInTheRed: 0,
    closedWeek: null,
    ownerId: 'owner-rival-0',
    ...overrides,
  };
}

function roster(count: number, seed = 'rival-roster'): Wrestler[] {
  return generateWrestlers(rngFromSeed(seed), count, { currentYear: 1985 }).map((w) => ({
    ...w,
    gender: 'm' as const,
    health: 100,
    injury: null,
  }));
}

describe('who a rival can book', () => {
  it('sits the injured and the badly banged up', () => {
    const [w] = roster(1);
    expect(canWork({ ...w!, health: 100 }, settings)).toBe(true);
    expect(canWork({ ...w!, health: 10 }, settings)).toBe(false);
    expect(
      canWork(
        {
          ...w!,
          injury: {
            severity: 'moderate',
            description: 'Knee',
            sufferedWeek: 1,
            totalWeeks: 6,
            weeksRemaining: 4,
            permanentStatLoss: {},
            earlyReturnWeeksUsed: 0,
          },
        },
        settings,
      ),
    ).toBe(false);
  });

  it('will not book the retired or the dead', () => {
    const [w] = roster(1);
    expect(canWork({ ...w!, careerStatus: 'retired' }, settings)).toBe(false);
    expect(canWork({ ...w!, deceased: { wrestlerId: w!.id, cause: 'age', age: 80, week: 5 } }, settings)).toBe(false);
  });
});

describe('the card an AI booker builds', () => {
  it('puts its two biggest names in the main event', () => {
    const available = roster(12);
    const { matches } = bookRivalCard(rngFromSeed('card'), {
      promotion: promotion(),
      available,
      titles: [],
      week: 1,
      settings,
    });
    const top = [...available].sort((a, b) => b.popularity - a.popularity).slice(0, 2).map((w) => w.id);
    const mainEvent = matches[matches.length - 1]!;
    expect(mainEvent.sides.flat().map((w) => w.id).sort()).toEqual(top.sort());
  });

  it('never books the same person twice on one card', () => {
    const { matches } = bookRivalCard(rngFromSeed('dupes'), {
      promotion: promotion(),
      available: roster(14),
      titles: [],
      week: 1,
      settings,
    });
    const booked = matches.flatMap((m) => m.sides.flat().map((w) => w.id));
    expect(new Set(booked).size).toBe(booked.length);
  });

  it('runs a shorter card when the roster is thin', () => {
    const thin = bookRivalCard(rngFromSeed('thin'), {
      promotion: promotion(),
      available: roster(5),
      titles: [],
      week: 1,
      settings,
    });
    expect(thin.matches.length).toBeLessThanOrEqual(2);
  });

  it('cannot run at all with nobody healthy', () => {
    expect(
      runRivalShow(rngFromSeed('empty'), {
        promotion: promotion(),
        available: [],
        titles: [],
        week: 1,
        settings,
      }),
    ).toBeNull();
  });
});

describe('a rival week', () => {
  it('books its actual teams in the tag match, and only one a card', () => {
    const people = roster(16, 'tags');
    const rng = rngFromSeed('tag-cards');
    const teams = formTeams(
      rng,
      people,
      'rival-0',
      { taken: new Set(), week: 1, count: 4 },
      teamIdFactory('rival-0'),
    );
    expect(teams.length).toBeGreaterThanOrEqual(2);

    let tagMatches = 0;
    for (let i = 0; i < 25; i++) {
      const { matches } = bookRivalCard(rng, {
        promotion: promotion(),
        available: people,
        titles: [],
        stables: teams,
        week: i,
        settings,
      });
      const tags = matches.filter((m) => m.sides[0].length > 1);
      tagMatches += tags.length;
      // Never more than one on a card — this is a wrestling show, not a
      // tag tournament.
      expect(tags.length).toBeLessThanOrEqual(1);
      // And when there is one, it is between two real teams.
      for (const tag of tags) {
        expect(tag.teamIds).toBeDefined();
        const [idA, idB] = tag.teamIds!;
        expect(idA).not.toBe(idB);
        const teamA = teams.find((t) => t.id === idA)!;
        expect(tag.sides[0].map((w) => w.id).sort()).toEqual([...teamA.memberIds].sort());
      }
    }
    expect(tagMatches).toBeGreaterThan(3);
  });

  it('books no tag match at all when the promotion has no teams', () => {
    const rng = rngFromSeed('no-teams');
    for (let i = 0; i < 10; i++) {
      const { matches } = bookRivalCard(rng, {
        promotion: promotion(),
        available: roster(16, 'solo'),
        titles: [],
        stables: [],
        week: i,
        settings,
      });
      expect(matches.every((m) => m.sides[0].length === 1)).toBe(true);
    }
  });

  it('produces a rated show with a winner in every match', () => {
    const show = runRivalShow(rngFromSeed('week'), {
      promotion: promotion(),
      available: roster(12),
      titles: [],
      week: 4,
      settings,
    })!;

    expect(show.matches.length).toBeGreaterThan(1);
    expect(show.showRating).toBeGreaterThan(0);
    expect(show.showStars).toBeGreaterThan(0);
    for (const match of show.matches) {
      expect(match.participantIds.length).toBeGreaterThanOrEqual(2);
      expect(match.aftermath).toHaveLength(match.participantIds.length);
    }
  });

  it('defends its own belts and nobody else’s', () => {
    const people = roster(12);
    const mine = createStartingTitles('rival-0', 'Atlas Pro', 'athletic').map((t) =>
      t.tier === 'world' && t.division === 'mens' ? awardTitle(t, [people[0]!.id], 1) : t,
    );
    const theirs = createStartingTitles('player-promotion', 'Southside Championship Wrestling', 'territory');

    // Enough weeks that a defence is a near-certainty at ~28% a week.
    const rng = rngFromSeed('belts');
    const defended = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const show = runRivalShow(rng, {
        promotion: promotion({ rosterIds: people.map((w) => w.id) }),
        available: people,
        titles: [...mine, ...theirs],
        week: i,
        settings,
      })!;
      for (const match of show.matches) for (const id of match.titleIds) defended.add(id);
    }

    expect(defended.size).toBeGreaterThan(0);
    for (const id of defended) expect(id.startsWith('rival-0')).toBe(true);
  });

  it('rates a stacked roster above a thin one over a season', () => {
    const strong = roster(16, 'strong').map((w) => ({ ...w, popularity: 80, skill: 80, agility: 75, stamina: 78 }));
    const weak = roster(16, 'weak').map((w) => ({ ...w, popularity: 25, skill: 30, agility: 28, stamina: 30 }));

    const average = (people: Wrestler[], seed: string) => {
      const rng = rngFromSeed(seed);
      let total = 0;
      for (let i = 0; i < 20; i++) {
        total += runRivalShow(rng, { promotion: promotion(), available: people, titles: [], week: i, settings })!.showRating;
      }
      return total / 20;
    };

    expect(average(strong, 'a')).toBeGreaterThan(average(weak, 'b') + 10);
  });
});
