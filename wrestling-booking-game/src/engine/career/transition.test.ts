import { describe, it, expect } from 'vitest';
import {
  canChangeRole,
  hasNeverChangedRole,
  weeksInRole,
  lockLabel,
  convertedRefereeCompetence,
  refereeFromWrestler,
  learnOnTheJob,
  managerFromWrestler,
  bookableRoster,
  staffOf,
  TRANSITION_ROLE_LABELS,
} from './transition';
import { seedRefereePool, effectiveCompetence, missChance } from '../sim/referees';
import { defaultWorldSettings } from '../world/settings';
import { generateWrestler } from '../generate/wrestler';
import { rngFromSeed } from '../rng';
import type { Wrestler } from '../types';

const settings = defaultWorldSettings();
const YEAR = settings.startingYear;

function person(over: Partial<Wrestler> = {}): Wrestler {
  return { ...generateWrestler(rngFromSeed('t'), new Set()), role: 'wrestler', roleSinceWeek: 0, ...over };
}

describe('the year they owe the job', () => {
  it('lets somebody who has been wrestling all along take the shirt', () => {
    const veteran = person({ roleSinceWeek: 0 });
    expect(canChangeRole(veteran, 'referee', 60, settings).ok).toBe(true);
  });

  it('does not charge a cooldown to somebody who has never changed jobs', () => {
    // roleSinceWeek 0 means "never moved", not "moved in week zero". Reading
    // it as tenure locked every brand-new save out of the whole system for
    // its first year — found by playing, not by testing.
    const openingRoster = person({ roleSinceWeek: 0 });
    expect(hasNeverChangedRole(openingRoster)).toBe(true);
    expect(canChangeRole(openingRoster, 'referee', 1, settings).ok).toBe(true);
    expect(lockLabel(openingRoster, 1, settings)).toBe('Free to move');
  });

  it('will not let them move again the week after they moved', () => {
    // The whole point. Without this you could put somebody in the shirt
    // because your official got hurt on Tuesday and have them wrestling again
    // on Sunday, and the officials roster would be decoration.
    const converted = person({ role: 'referee', roleSinceWeek: 40 });
    const check = canChangeRole(converted, 'wrestler', 41, settings);
    expect(check.ok).toBe(false);
    expect(check.weeksLeft).toBe(settings.roleTransitionLockWeeks - 1);
    expect(check.reason).toContain('weeks');
  });

  it('lets them back out once the year is served', () => {
    const converted = person({ role: 'referee', roleSinceWeek: 40 });
    expect(canChangeRole(converted, 'wrestler', 40 + settings.roleTransitionLockWeeks, settings).ok).toBe(true);
  });

  it('locks the same length in both directions', () => {
    // Symmetric because it is easier to explain and because the commitment is
    // the same either way — a year is a year.
    const toShirt = person({ role: 'wrestler', roleSinceWeek: 10 });
    const toRing = person({ role: 'referee', roleSinceWeek: 10 });
    expect(canChangeRole(toShirt, 'referee', 20, settings).weeksLeft).toBe(
      canChangeRole(toRing, 'wrestler', 20, settings).weeksLeft,
    );
  });

  it('refuses the job they are already doing', () => {
    expect(canChangeRole(person({ role: 'referee', roleSinceWeek: 0 }), 'referee', 99, settings).ok).toBe(false);
  });

  it('will not move somebody who is hurt, dead or retired', () => {
    const hurt = person({
      injury: {
        severity: 'severe',
        description: 'Knee ligament',
        sufferedWeek: 1,
        totalWeeks: 14,
        weeksRemaining: 9,
        permanentStatLoss: {},
        earlyReturnWeeksUsed: 0,
      },
    });
    expect(canChangeRole(hurt, 'referee', 99, settings).ok).toBe(false);
    expect(canChangeRole(person({ careerStatus: 'retired' }), 'referee', 99, settings).ok).toBe(false);
    expect(
      canChangeRole(
        person({ deceased: { week: 4, age: 60, cause: 'heart', text: 'gone' } as never }),
        'referee',
        99,
        settings,
      ).ok,
    ).toBe(false);
  });

  it('counts the weeks and says where they are in words', () => {
    const fresh = person({ role: 'referee', roleSinceWeek: 50 });
    expect(weeksInRole(fresh, 52)).toBe(2);
    expect(lockLabel(fresh, 52, settings)).toBe('Just took the job');
    expect(lockLabel(fresh, 50 + settings.roleTransitionLockWeeks, settings)).toBe('Free to move');
    // Words, never a number — CLAUDE.md.
    expect(lockLabel(fresh, 60, settings)).not.toMatch(/\d/);
  });
});

describe('what they are worth in the shirt', () => {
  it('reads time in the business, not how good a wrestler they were', () => {
    // A main eventer is no better placed to count to three than the man he
    // beat. What matters is twenty years of being in there.
    const star = person({ debutYear: YEAR - 4, popularity: 95, skill: 95 });
    const journeyman = person({ debutYear: YEAR - 20, popularity: 30, skill: 40 });
    expect(convertedRefereeCompetence(journeyman, YEAR, settings)).toBeGreaterThan(
      convertedRefereeCompetence(star, YEAR, settings),
    );
  });

  it('never makes them the best in the business, however long they went', () => {
    const lifer = person({ debutYear: YEAR - 40 });
    const best = Math.max(...seedRefereePool().map((r) => r.competence));
    expect(convertedRefereeCompetence(lifer, YEAR, settings)).toBeLessThanOrEqual(
      settings.convertedRefereeCompetenceCap,
    );
    expect(convertedRefereeCompetence(lifer, YEAR, settings)).toBeLessThan(best);
  });

  it('starts a rookie somewhere between useless and passable', () => {
    const rookie = person({ debutYear: YEAR });
    const competence = convertedRefereeCompetence(rookie, YEAR, settings);
    expect(competence).toBeGreaterThan(20);
    expect(competence).toBeLessThan(50);
  });

  it('brings their own toughness with them, which is the point', () => {
    // The one thing a career official cannot buy: they can take a bump.
    const hard = person({ debutYear: YEAR - 15, toughness: 95 });
    const asOfficial = refereeFromWrestler(hard, YEAR, settings);
    expect(asOfficial.toughness).toBe(95);
    const careerOfficials = seedRefereePool();
    const typical = careerOfficials.reduce((sum, r) => sum + r.toughness, 0) / careerOfficials.length;
    expect(asOfficial.toughness).toBeGreaterThan(typical);
  });

  it('is one of your own — no contract of their own, and not for sale', () => {
    const asOfficial = refereeFromWrestler(person({ promotionId: 'me' }), YEAR, settings);
    // The wage is already on the roster payroll. Charging it twice was the
    // obvious bug waiting in this feature.
    expect(asOfficial.contract).toBeNull();
    expect(asOfficial.wrestlerId).toBeTruthy();
    expect(asOfficial.promotionId).toBe('me');
  });

  it('makes somebody with an attitude problem the one who can be got at', () => {
    const professional = refereeFromWrestler(person({ attitude: 95 }), YEAR, settings);
    const trouble = refereeFromWrestler(person({ attitude: 5 }), YEAR, settings);
    expect(trouble.bendable).toBeGreaterThan(professional.bendable);
  });
});

describe('learning the job', () => {
  it('gets better the longer they do it', () => {
    const official = refereeFromWrestler(person({ debutYear: YEAR - 10 }), YEAR, settings);
    const start = official.competence;
    for (let i = 0; i < 200; i++) learnOnTheJob(official, settings);
    expect(official.competence).toBeGreaterThan(start);
    // And it shows up where it matters, not just on a hidden number.
    expect(missChance(official, settings)).toBeLessThan(
      missChance({ ...official, competence: start }, settings),
    );
  });

  it('stops at the cap however many years they put in', () => {
    const official = refereeFromWrestler(person({ debutYear: YEAR - 10 }), YEAR, settings);
    for (let i = 0; i < 5000; i++) learnOnTheJob(official, settings);
    expect(official.competence).toBeLessThanOrEqual(settings.convertedRefereeCompetenceCap);
    expect(effectiveCompetence(official, settings)).toBeLessThan(92);
  });

  it('takes a real stretch of weeks, not a month', () => {
    // A year of Tuesdays should be worth something and not everything.
    const official = refereeFromWrestler(person({ debutYear: YEAR - 10 }), YEAR, settings);
    const start = official.competence;
    for (let i = 0; i < 52 * 3; i++) learnOnTheJob(official, settings); // ~3 matches a week for a year
    const gained = official.competence - start;
    expect(gained).toBeGreaterThan(5);
    expect(gained).toBeLessThan(25);
  });

  it('leaves the career officials exactly as they are', () => {
    // Earl Hollis has been doing this for thirty years and is not going to
    // get better at it. Only a converted wrestler is still learning.
    const hollis = seedRefereePool().find((r) => r.id === 'ref-hollis')!;
    const before = hollis.competence;
    for (let i = 0; i < 500; i++) learnOnTheJob(hollis, settings);
    expect(hollis.competence).toBe(before);
  });
});

describe('the suit', () => {
  it('is worth more when the crowd already knows them', () => {
    const star = managerFromWrestler(person({ popularity: 90, charisma: 60 }));
    const stranger = managerFromWrestler(person({ popularity: 10, charisma: 60 }));
    expect(star.presence).toBeGreaterThan(stranger.presence);
  });

  it('talks as well as they always talked', () => {
    expect(managerFromWrestler(person({ charisma: 88 })).micWork).toBe(88);
  });

  it('costs nothing a night, because they are already being paid', () => {
    expect(managerFromWrestler(person()).feePerShow).toBe(0);
  });

  it('makes a heel the devious one', () => {
    expect(managerFromWrestler(person({ alignment: -90 })).deviousness).toBeGreaterThan(
      managerFromWrestler(person({ alignment: 90 })).deviousness,
    );
  });
});

describe('who can actually be booked', () => {
  it('leaves the officials and the suits off the active roster', () => {
    const roster = [
      person({ id: 'a', role: 'wrestler' }),
      person({ id: 'b', role: 'referee' }),
      person({ id: 'c', role: 'manager' }),
    ];
    expect(bookableRoster(roster).map((w) => w.id)).toEqual(['a']);
    expect(staffOf(roster, 'referee').map((w) => w.id)).toEqual(['b']);
    expect(staffOf(roster, 'manager').map((w) => w.id)).toEqual(['c']);
  });

  it('does not count the dead and retired as staff', () => {
    const roster = [
      person({ id: 'a', role: 'referee', careerStatus: 'retired' }),
      person({ id: 'b', role: 'referee' }),
    ];
    expect(staffOf(roster, 'referee').map((w) => w.id)).toEqual(['b']);
  });

  it('names every role it offers', () => {
    for (const label of Object.values(TRANSITION_ROLE_LABELS)) expect(label.length).toBeGreaterThan(0);
  });
});
