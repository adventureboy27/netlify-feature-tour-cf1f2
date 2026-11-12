import { describe, it, expect } from 'vitest';
import {
  AWARDS,
  awardById,
  awardEffects,
  decideAwards,
  emptyYearRecord,
  noteMatch,
  noteTeamResult,
  yearMovement,
  type AwardContext,
  type AwardId,
  type YearRecord,
} from './awards';
import { defaultWorldSettings } from '../world/settings';
import type { Wrestler } from '../types';

const settings = defaultWorldSettings();

let nextId = 0;
function person(over: Partial<Wrestler> = {}): Wrestler {
  nextId += 1;
  return {
    id: `w${nextId}`,
    name: `Wrestler ${nextId}`,
    popularity: 50,
    momentum: 0,
    morale: 60,
    deceased: null,
    careerStatus: 'midcarder',
    promotionId: 'player',
    career: { matches: 40 },
    ...over,
  } as unknown as Wrestler;
}

/** A year in which everybody worked enough to be eligible. */
function yearOf(people: Wrestler[]): YearRecord {
  const record = emptyYearRecord(2000, people);
  for (const w of people) record.matches[w.id] = settings.awardMinMatches + 4;
  return record;
}

function ctxFor(people: Wrestler[], record: YearRecord, over: Partial<AwardContext> = {}): AwardContext {
  return { year: 2000, wrestlers: people, record, teams: [], settings, ...over };
}

const idsFor = (winners: ReturnType<typeof decideAwards>, id: AwardId) =>
  winners.find((w) => w.awardId === id)?.wrestlerIds ?? [];

describe('the award list', () => {
  it('has good ones and bad ones', () => {
    expect(AWARDS.some((a) => a.good)).toBe(true);
    expect(AWARDS.some((a) => !a.good)).toBe(true);
  });

  it('has no duplicate ids and every one is findable', () => {
    const ids = AWARDS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(awardById(id)?.id).toBe(id);
  });
});

describe('gathering the year', () => {
  it('keeps only the best and the worst match', () => {
    const record = emptyYearRecord(2000, []);
    noteMatch(record, { wrestlerIds: ['a', 'b'], rating: 55, week: 3, promotionName: 'X' });
    noteMatch(record, { wrestlerIds: ['c', 'd'], rating: 91, week: 20, promotionName: 'X' });
    noteMatch(record, { wrestlerIds: ['e', 'f'], rating: 12, week: 44, promotionName: 'Y' });
    expect(record.bestMatch?.rating).toBe(91);
    expect(record.worstMatch?.rating).toBe(12);
  });

  it('counts everybody s matches', () => {
    const record = emptyYearRecord(2000, []);
    noteMatch(record, { wrestlerIds: ['a', 'b'], rating: 50, week: 1, promotionName: 'X' });
    noteMatch(record, { wrestlerIds: ['a', 'c'], rating: 50, week: 2, promotionName: 'X' });
    expect(record.matches['a']).toBe(2);
    expect(record.matches['b']).toBe(1);
  });

  it('remembers where everybody started, so movement is measurable', () => {
    const hot = person({ popularity: 30 });
    const record = yearOf([hot]);
    hot.popularity = 62;
    expect(yearMovement(hot, record)).toBe(32);
  });

  it('reports no movement for somebody who was not there in January', () => {
    const record = yearOf([]);
    expect(yearMovement(person({ popularity: 80 }), record)).toBe(0);
  });

  it('keeps this year s tag results apart from a lifetime of them', () => {
    const record = emptyYearRecord(2000, []);
    noteTeamResult(record, 't1', 'win');
    noteTeamResult(record, 't1', 'win');
    noteTeamResult(record, 't1', 'loss');
    noteTeamResult(record, 't1', 'draw');
    expect(record.teamWins['t1']).toBe(2);
    expect(record.teamLosses['t1']).toBe(1);
  });
});

describe('handing out the year', () => {
  it('gives Wrestler of the Year to the one who climbed, not the one who coasted', () => {
    const legend = person({ popularity: 88 });
    const riser = person({ popularity: 70 });
    const record = yearOf([legend, riser]);
    // The legend ends the year exactly where they started. The riser doubles.
    riser.popularity = 70;
    record.popularityAtStart[riser.id] = 35;
    const winners = decideAwards(ctxFor([legend, riser], record));
    expect(idsFor(winners, 'wrestlerOfTheYear')).toEqual([riser.id]);
  });

  it('will not give Wrestler of the Year to somebody off the bottom of the card', () => {
    const nobody = person({ popularity: 12 });
    const winners = decideAwards(ctxFor([nobody], yearOf([nobody])));
    expect(idsFor(winners, 'wrestlerOfTheYear')).toEqual([]);
  });

  it('ignores anybody who barely worked', () => {
    const star = person({ popularity: 90 });
    const record = emptyYearRecord(2000, [star]);
    record.matches[star.id] = settings.awardMinMatches - 1;
    expect(decideAwards(ctxFor([star], record))).toEqual([]);
  });

  it('names the match of the year, and where it happened', () => {
    const a = person({ name: 'Doomsday' });
    const b = person({ name: 'Wren Stillwater' });
    const record = yearOf([a, b]);
    noteMatch(record, {
      wrestlerIds: [a.id, b.id],
      rating: 94,
      week: 30,
      promotionName: 'Atlas Pro',
    });
    const winners = decideAwards(ctxFor([a, b], record));
    const motY = winners.find((w) => w.awardId === 'matchOfTheYear');
    expect(motY?.wrestlerIds).toEqual([a.id, b.id]);
    expect(motY?.citation).toContain('Doomsday vs Wren Stillwater');
    expect(motY?.citation).toContain('Atlas Pro');
  });

  it('leaves Match of the Year unclaimed in a year with no good matches', () => {
    const a = person();
    const b = person();
    const record = yearOf([a, b]);
    noteMatch(record, { wrestlerIds: [a.id, b.id], rating: 55, week: 4, promotionName: 'X' });
    const winners = decideAwards(ctxFor([a, b], record));
    expect(idsFor(winners, 'matchOfTheYear')).toEqual([]);
  });

  it('names a Worst Match, and puts it on everybody who was in it', () => {
    const a = person();
    const b = person();
    const record = yearOf([a, b]);
    noteMatch(record, { wrestlerIds: [a.id, b.id], rating: 8, week: 9, promotionName: 'X' });
    expect(idsFor(decideAwards(ctxFor([a, b], record)), 'worstMatchOfTheYear')).toEqual([a.id, b.id]);
  });

  it('separates a comeback from an improvement', () => {
    // Neither of them is big enough to be Wrestler of the Year, so both of
    // these awards are still on the table.
    const fallen = person({ popularity: 50 });
    const rookie = person({ popularity: 45 });
    const record = yearOf([fallen, rookie]);
    record.popularityAtStart[fallen.id] = 20;
    record.popularityAtStart[rookie.id] = 22;
    const winners = decideAwards(ctxFor([fallen, rookie], record));
    expect(idsFor(winners, 'comebackOfTheYear')).toEqual([fallen.id]);
    // And whoever the comeback was, they do not also win most improved.
    expect(idsFor(winners, 'mostImproved')).toEqual([rookie.id]);
  });

  it('never gives one person two of the individual awards', () => {
    const people = [
      person({ popularity: 84 }),
      person({ popularity: 61 }),
      person({ popularity: 38 }),
      person({ popularity: 20 }),
    ];
    const record = yearOf(people);
    record.popularityAtStart[people[0]!.id] = 40;
    record.popularityAtStart[people[1]!.id] = 88;
    record.popularityAtStart[people[2]!.id] = 20;
    record.popularityAtStart[people[3]!.id] = 70;
    const individual = decideAwards(ctxFor(people, record)).filter(
      (w) => w.awardId !== 'matchOfTheYear' && w.awardId !== 'worstMatchOfTheYear',
    );
    const named = individual.flatMap((w) => w.wrestlerIds);
    expect(new Set(named).size).toBe(named.length);
  });

  it('gives Tag Team of the Year on this year s record', () => {
    const a = person();
    const b = person();
    const record = yearOf([a, b]);
    for (let i = 0; i < settings.awardTeamMinWins + 2; i++) noteTeamResult(record, 'team-1', 'win');
    noteTeamResult(record, 'team-1', 'loss');
    const winners = decideAwards(
      ctxFor([a, b], record, { teams: [{ id: 'team-1', name: 'The Wreckers', memberIds: [a.id, b.id] }] }),
    );
    const team = winners.find((w) => w.awardId === 'tagTeamOfTheYear');
    expect(team?.wrestlerIds).toEqual([a.id, b.id]);
    expect(team?.citation).toContain('The Wreckers');
  });

  it('does not hand a tag award to a team that barely wrestled', () => {
    const a = person();
    const b = person();
    const record = yearOf([a, b]);
    noteTeamResult(record, 'team-1', 'win');
    const winners = decideAwards(
      ctxFor([a, b], record, { teams: [{ id: 'team-1', name: 'The Wreckers', memberIds: [a.id, b.id] }] }),
    );
    expect(idsFor(winners, 'tagTeamOfTheYear')).toEqual([]);
  });

  it('names a Downfall when somebody really fell', () => {
    const fallen = person({ popularity: 30 });
    const steady = person({ popularity: 50 });
    const record = yearOf([fallen, steady]);
    record.popularityAtStart[fallen.id] = 78;
    const winners = decideAwards(ctxFor([fallen, steady], record));
    expect(idsFor(winners, 'downfallOfTheYear')).toEqual([fallen.id]);
  });

  it('leaves the bad awards unclaimed in a year nobody fell', () => {
    const a = person({ popularity: 55 });
    const b = person({ popularity: 52 });
    const record = yearOf([a, b]);
    // Everybody drifted up a little.
    record.popularityAtStart[a.id] = 50;
    record.popularityAtStart[b.id] = 50;
    const winners = decideAwards(ctxFor([a, b], record));
    expect(idsFor(winners, 'downfallOfTheYear')).toEqual([]);
    expect(idsFor(winners, 'biggestDisappointment')).toEqual([]);
  });

  it('names a Disappointment for a big name who went backwards while their peers did not', () => {
    // Three names at the top of the business. Two held their ground; one did
    // not, and that is the story.
    // The slip is small enough not to be a Downfall — this is the softer,
    // more annoying version of the same story.
    const slipped = person({ popularity: 75 });
    const held = person({ popularity: 76 });
    const alsoHeld = person({ popularity: 74 });
    const record = yearOf([slipped, held, alsoHeld]);
    record.popularityAtStart[slipped.id] = 78;
    record.popularityAtStart[held.id] = 70;
    record.popularityAtStart[alsoHeld.id] = 66;
    const winners = decideAwards(ctxFor([slipped, held, alsoHeld], record));
    expect(idsFor(winners, 'biggestDisappointment')).toEqual([slipped.id]);
  });

  it('does not call it a disappointment when the whole top of the card drifted down', () => {
    // Everybody slipped by about the same amount. That is a flat year for the
    // business, not one person's failure.
    const people = [person({ popularity: 73 }), person({ popularity: 75 }), person({ popularity: 69 })];
    const record = yearOf(people);
    record.popularityAtStart[people[0]!.id] = 79;
    record.popularityAtStart[people[1]!.id] = 80;
    record.popularityAtStart[people[2]!.id] = 76;
    const winners = decideAwards(ctxFor(people, record));
    expect(idsFor(winners, 'biggestDisappointment')).toEqual([]);
  });

  it('does not punish the biggest name in the world for having nowhere left to climb', () => {
    // Popularity has a ceiling. Somebody sitting on it cannot gain, and
    // judging that absolutely hands them this award every single year.
    const atTheCeiling = person({ popularity: 100 });
    // One of them has a huge year, so the award for it is not what is keeping
    // the wrestler on the ceiling out of the disappointment.
    const climbers = [person({ popularity: 95 }), person({ popularity: 92 })];
    const record = yearOf([atTheCeiling, ...climbers]);
    record.popularityAtStart[atTheCeiling.id] = 100;
    record.popularityAtStart[climbers[0]!.id] = 60;
    record.popularityAtStart[climbers[1]!.id] = 78;
    const winners = decideAwards(ctxFor([atTheCeiling, ...climbers], record));
    expect(idsFor(winners, 'wrestlerOfTheYear')).not.toContain(atTheCeiling.id);
    expect(idsFor(winners, 'downfallOfTheYear')).not.toContain(atTheCeiling.id);
    expect(idsFor(winners, 'biggestDisappointment')).not.toContain(atTheCeiling.id);
  });

  it('skips the dead and the retired', () => {
    const gone = person({ popularity: 95, careerStatus: 'retired' });
    const dead = person({ popularity: 96, deceased: { week: 4, age: 60, cause: 'illness' } as never });
    const record = yearOf([gone, dead]);
    expect(decideAwards(ctxFor([gone, dead], record))).toEqual([]);
  });

  it('stamps the year on everything it hands out', () => {
    const star = person({ popularity: 80 });
    const record = yearOf([star]);
    record.popularityAtStart[star.id] = 40;
    for (const winner of decideAwards(ctxFor([star], record, { year: 1987 }))) {
      expect(winner.year).toBe(1987);
      expect(winner.citation.length).toBeGreaterThan(0);
    }
  });
});

describe('what an award is worth', () => {
  it('lifts the people who won a good one', () => {
    const [effect] = awardEffects(
      { awardId: 'mostImproved', wrestlerIds: ['a'], year: 2000, citation: '' },
      settings,
    );
    expect(effect!.popularity).toBeGreaterThan(0);
    expect(effect!.momentum).toBeGreaterThan(0);
    expect(effect!.morale).toBeGreaterThan(0);
  });

  it('costs the people who won a bad one', () => {
    const [effect] = awardEffects(
      { awardId: 'worstMatchOfTheYear', wrestlerIds: ['a'], year: 2000, citation: '' },
      settings,
    );
    expect(effect!.popularity).toBeLessThan(0);
    expect(effect!.momentum).toBeLessThan(0);
    expect(effect!.morale).toBeLessThan(0);
  });

  it('makes the headline awards hurt and help more than the rest', () => {
    const big = awardEffects({ awardId: 'wrestlerOfTheYear', wrestlerIds: ['a'], year: 2000, citation: '' }, settings);
    const small = awardEffects({ awardId: 'mostImproved', wrestlerIds: ['a'], year: 2000, citation: '' }, settings);
    expect(big[0]!.popularity).toBeGreaterThan(small[0]!.popularity);

    const worstYear = awardEffects(
      { awardId: 'downfallOfTheYear', wrestlerIds: ['a'], year: 2000, citation: '' },
      settings,
    );
    const worstMatch = awardEffects(
      { awardId: 'worstMatchOfTheYear', wrestlerIds: ['a'], year: 2000, citation: '' },
      settings,
    );
    expect(worstYear[0]!.popularity).toBeLessThan(worstMatch[0]!.popularity);
  });

  it('applies to everybody named on a shared award', () => {
    const effects = awardEffects(
      { awardId: 'tagTeamOfTheYear', wrestlerIds: ['a', 'b'], year: 2000, citation: '' },
      settings,
    );
    expect(effects.map((e) => e.wrestlerId)).toEqual(['a', 'b']);
  });
});
