// The rule this file holds: how hard you work is a decision with two sides,
// and the sides cross somewhere the game never tells you about.

import { describe, expect, it } from 'vitest';
import { rngFromSeed } from '../rng';
import { defaultWorldSettings } from './settings';
import { MONTHS, WEEKS_PER_YEAR, weekLabel, weekLine, isLastWeekOfMonth } from './calendar';
import {
  bigShowName,
  defaultSchedule,
  nightsOfWork,
  houseShowRevenueMultiplier,
  houseShowsThisWeek,
  isBigShowWeek,
  nightsOff,
  recoveryMultiplier,
  resizeSchedule,
  scheduleForRival,
  scheduleLine,
  showsPerWeek,
  showsThisWeek,
  workloadRatio,
  type PPVCadence,
  type PromotionSchedule,
} from './schedule';

const settings = defaultWorldSettings();
const names = ['Cold Snap', 'Spring Break', 'Midsummer Riot', 'Harvest', 'Last Rites', 'New Year Rising'];

function schedule(count: number, cadence: PPVCadence = 'monthly'): PromotionSchedule {
  const base = defaultSchedule(rngFromSeed('s'), 'Southside Championship Wrestling', names, settings);
  return { ...resizeSchedule(base, count, 'Southside', rngFromSeed('r'), settings), ppvCadence: cadence };
}

describe('telling the time without dates', () => {
  it('runs January to December and lands exactly on week 52', () => {
    const first = weekLabel(1, settings);
    expect(first.month).toBe('January');
    expect(first.weekOfMonth).toBe(1);
    expect(first.weekOfYear).toBe(1);

    const last = weekLabel(WEEKS_PER_YEAR, settings);
    expect(last.month).toBe('December');
    expect(last.weekOfYear).toBe(WEEKS_PER_YEAR);
  });

  it('gives every month a name and nobody a date', () => {
    const seen = new Set<string>();
    for (let week = 1; week <= WEEKS_PER_YEAR; week++) {
      const label = weekLabel(week, settings);
      seen.add(label.month);
      expect(label.weekOfMonth).toBeGreaterThanOrEqual(1);
      expect(label.weekOfMonth).toBeLessThanOrEqual(5);
      // Month name and a week number. Never a day of the month.
      expect(weekLine(week, settings)).toMatch(/^[A-Z][a-z]+, week [1-5]$/);
    }
    expect(seen.size).toBe(MONTHS.length);
  });

  it('rolls the year over and keeps counting', () => {
    expect(weekLabel(WEEKS_PER_YEAR + 1, settings).year).toBe(settings.startingYear + 1);
    expect(weekLabel(WEEKS_PER_YEAR + 1, settings).month).toBe('January');
    expect(weekLabel(WEEKS_PER_YEAR * 7 + 3, settings).year).toBe(settings.startingYear + 7);
  });

  it('has exactly twelve last-weeks-of-a-month in a year', () => {
    let ends = 0;
    for (let week = 1; week <= WEEKS_PER_YEAR; week++) if (isLastWeekOfMonth(week, settings)) ends += 1;
    expect(ends).toBe(12);
  });
});

describe('the pattern', () => {
  it('starts everybody on the shape the business settled on', () => {
    const s = defaultSchedule(rngFromSeed('d'), 'Atlas Pro Wrestling', names, settings);
    expect(showsPerWeek(s)).toBe(settings.scheduleIdealShows);
    expect(s.ppvCadence).toBe('monthly');
    expect(s.shows.filter((show) => show.televised)).toHaveLength(1);
  });

  it('names the shows rather than numbering them', () => {
    const s = defaultSchedule(rngFromSeed('n'), 'Atlas Pro Wrestling', names, settings);
    for (const show of s.shows) {
      expect(show.name.length).toBeGreaterThan(3);
      expect(show.name).not.toMatch(/^show/i);
    }
    // ...and puts them on different nights.
    expect(new Set(s.shows.map((show) => show.day)).size).toBe(s.shows.length);
  });

  it('never leaves the week without a show the player books', () => {
    for (let count = 1; count <= settings.scheduleMaxShows; count++) {
      const s = schedule(count);
      expect(showsThisWeek(1, s, settings).filter((show) => show.booked)).toHaveLength(1);
    }
  });

  it('runs the same top number of nights whatever the cadence, but not every week', () => {
    // A pay-per-view replaces the television rather than being added to it,
    // which is why some weeks come in under the top number and why a promotion
    // running four nights sometimes runs four with a different one on top.
    const s = schedule(3);
    let ppvWeeks = 0;
    for (let week = 1; week <= WEEKS_PER_YEAR; week++) {
      const tonight = showsThisWeek(week, s, settings);
      expect(tonight).toHaveLength(3);
      if (tonight.some((show) => show.kind === 'ppv')) {
        ppvWeeks += 1;
        // The television is gone that week: the big one took its slot.
        expect(tonight.filter((show) => show.kind === 'television')).toHaveLength(0);
      }
    }
    expect(ppvWeeks).toBe(12);
  });

  it('counts the big shows the cadence promises', () => {
    const counts: Record<PPVCadence, number> = { monthly: 0, biMonthly: 0, annual: 0 };
    for (const cadence of ['monthly', 'biMonthly', 'annual'] as const) {
      for (let week = 1; week <= WEEKS_PER_YEAR; week++) {
        if (isBigShowWeek(week, schedule(2, cadence), settings)) counts[cadence] += 1;
      }
    }
    expect(counts.monthly).toBe(12);
    expect(counts.biMonthly).toBe(6);
    expect(counts.annual).toBe(1);
  });

  it('always puts the big one at the end of a month, never mid-build', () => {
    for (const cadence of ['monthly', 'biMonthly', 'annual'] as const) {
      const s = schedule(2, cadence);
      for (let week = 1; week <= WEEKS_PER_YEAR * 3; week++) {
        if (isBigShowWeek(week, s, settings)) expect(isLastWeekOfMonth(week, settings)).toBe(true);
      }
    }
  });

  it('brings the same event round at the same point every year', () => {
    const s = schedule(2);
    for (let week = 1; week <= WEEKS_PER_YEAR; week++) {
      expect(bigShowName(week + WEEKS_PER_YEAR, s, settings)).toBe(bigShowName(week, s, settings));
    }
  });

  it('leaves the roster nights off until you take them all', () => {
    expect(nightsOff(schedule(1))).toHaveLength(6);
    expect(nightsOff(schedule(2))).toHaveLength(5);
    expect(nightsOff(schedule(5))).toHaveLength(2);
  });

  it('hands the office everything the player is not booking', () => {
    expect(houseShowsThisWeek(1, schedule(1), settings)).toHaveLength(0);
    expect(houseShowsThisWeek(1, schedule(4), settings)).toHaveLength(3);
  });
});

describe('what running that hard costs, and pays', () => {
  it('pays more every time you add a night', () => {
    let last = 0;
    for (let count = 1; count <= settings.scheduleMaxShows; count++) {
      const money = houseShowRevenueMultiplier(schedule(count), settings);
      expect(money).toBeGreaterThan(last);
      last = money;
    }
  });

  it('costs more every time you add a night, and costs more than it pays', () => {
    // The gap between these two curves is the entire decision. If money ever
    // outran work, five nights a week would be strictly correct and there
    // would be nothing to decide.
    //
    // Work is linear — a house show is a card, worked by a card's worth of
    // people — and money is concave, so the gap has to widen every time.
    let lastGap = -Infinity;
    for (let count = settings.scheduleIdealShows; count <= settings.scheduleMaxShows; count++) {
      const s = schedule(count);
      const gap = nightsOfWork(s) / settings.scheduleIdealShows - houseShowRevenueMultiplier(s, settings);
      expect(gap).toBeGreaterThan(lastGap);
      lastGap = gap;
    }
  });

  it('makes the third night a real call and the fifth plainly not', () => {
    // Measured against the ideal rather than against nothing: what the player
    // is actually choosing is whether to work harder than everybody else.
    //
    // The third night cannot be *free* — if it were, two would not be the
    // ideal and there would be nothing to decide. What it has to be is
    // takeable: a deep, healthy roster can absorb it and the money is real.
    // The fifth has to be somewhere else entirely.
    const ideal = schedule(settings.scheduleIdealShows);
    const base = {
      money: houseShowRevenueMultiplier(ideal, settings),
      wear: nightsOfWork(ideal),
    };
    const gain = (count: number) => {
      const s = schedule(count);
      return {
        money: houseShowRevenueMultiplier(s, settings) / base.money - 1,
        wear: nightsOfWork(s) / base.wear - 1,
      };
    };
    const third = gain(3);
    const fifth = gain(5);
    // A third night is a tenth more money for half again the work — bad on
    // paper, and takeable if the roster is deep enough to spread it.
    expect(third.money).toBeGreaterThan(0.08);
    expect(third.wear).toBeLessThan(third.money * 6);
    // A fifth is a different question entirely.
    expect(fifth.wear).toBeGreaterThan(fifth.money * 5);
  });

  it('stops a heavy week from healing anybody, without stopping healing dead', () => {
    expect(recoveryMultiplier(schedule(1), settings)).toBe(1);
    expect(recoveryMultiplier(schedule(5), settings)).toBeLessThan(0.6);
    expect(recoveryMultiplier(schedule(5), settings)).toBeGreaterThanOrEqual(settings.scheduleRecoveryFloor);
  });

  it('centres the workload on the ideal', () => {
    expect(workloadRatio(schedule(settings.scheduleIdealShows), settings)).toBe(1);
    expect(workloadRatio(schedule(1), settings)).toBeLessThan(1);
    expect(workloadRatio(schedule(5), settings)).toBeGreaterThan(1);
  });
});

describe('what rivals run', () => {
  it('scales the pattern to what the company can carry', () => {
    const small = scheduleForRival(rngFromSeed('a'), { name: 'Backyard', rating: 12, identity: 'territory' }, names, settings);
    const big = scheduleForRival(rngFromSeed('b'), { name: 'National', rating: 92, identity: 'sportsEntertainment' }, names, settings);
    expect(showsPerWeek(small)).toBeLessThan(showsPerWeek(big));
    // ...and a company that cannot fill a building monthly does not pretend to.
    expect(small.ppvCadence).toBe('annual');
    expect(big.ppvCadence).toBe('monthly');
  });

  it('never puts anybody outside the stops', () => {
    for (let rating = 0; rating <= 100; rating += 4) {
      const s = scheduleForRival(rngFromSeed(`r-${rating}`), { name: 'X', rating, identity: 'territory' }, names, settings);
      expect(showsPerWeek(s)).toBeGreaterThanOrEqual(1);
      expect(showsPerWeek(s)).toBeLessThanOrEqual(settings.scheduleMaxShows);
    }
  });
});

describe('changing the pattern', () => {
  it('keeps the names of the shows that survive', () => {
    const before = schedule(4);
    const after = resizeSchedule(before, 2, 'Southside', rngFromSeed('x'), settings);
    expect(after.shows.map((s) => s.name)).toEqual(before.shows.slice(0, 2).map((s) => s.name));
  });

  it('always leaves somebody on television', () => {
    for (let count = 1; count <= settings.scheduleMaxShows; count++) {
      const after = resizeSchedule(schedule(3), count, 'Southside', rngFromSeed('y'), settings);
      expect(after.shows.filter((s) => s.televised)).toHaveLength(1);
    }
  });

  it('refuses to run more nights than there are to run', () => {
    expect(showsPerWeek(resizeSchedule(schedule(2), 99, 'S', rngFromSeed('z'), settings))).toBe(
      settings.scheduleMaxShows,
    );
    expect(showsPerWeek(resizeSchedule(schedule(2), 0, 'S', rngFromSeed('z'), settings))).toBe(1);
  });
});

describe('how the office describes it', () => {
  it('says it in words and never in numbers the player has to interpret', () => {
    for (let count = 1; count <= settings.scheduleMaxShows; count++) {
      const line = scheduleLine(schedule(count), settings);
      expect(line).toContain('week');
      expect(line.length).toBeGreaterThan(30);
    }
  });

  it('does not tell the player which one is correct', () => {
    // §0: the game never warns before a bad decision. Five nights a week is a
    // terrible idea and the office is allowed to say the room is unhappy — it
    // is not allowed to say "don't".
    const worst = scheduleLine(schedule(5), settings);
    expect(worst).not.toMatch(/should|don't|do not|recommend|avoid|warning/i);
  });
});
