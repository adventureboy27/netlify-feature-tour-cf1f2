// Taking a room for the season.
//
// The trade this has to keep honest: a residency is cheaper in every line of
// the budget and worse at the door, and the longer it runs the worse the door
// gets. If either half stops being true it becomes either a free win or a
// thing nobody would ever sign.

import { describe, expect, it } from 'vitest';
import {
  residencyTerms,
  residencyRent,
  residencyDeposit,
  saturationDraw,
  saturationLine,
  residencyTravelCost,
  residencyHaulageCost,
  breakLeaseCost,
  tickResidency,
  signResidency,
  residencyAvailable,
  residencyBlockedNote,
  residencyStatus,
  type Residency,
} from './residency';
import { defaultWorldSettings } from '../world/settings';
import { VENUES, venueById } from '../../data/venues';

const settings = defaultWorldSettings();
const hall = venueById('vfwHall')!;
const [short, long] = residencyTerms(settings);

const run = (showsRun: number, weeksLeft = 20): Residency => ({
  ...signResidency(hall, short!, 1),
  showsRun,
  weeksLeft,
});

describe('the deal', () => {
  it('offers half a year and a whole one', () => {
    expect(residencyTerms(settings)).toHaveLength(2);
    expect(short!.weeks).toBeLessThan(long!.weeks);
  });

  it('charges less a night for the longer commitment', () => {
    expect(residencyRent(hall, long!)).toBeLessThan(residencyRent(hall, short!));
  });

  it('is cheaper than renting the same room week to week', () => {
    for (const venue of VENUES) {
      expect(residencyRent(venue, short!)).toBeLessThan(venue.rentalCost);
      expect(residencyRent(venue, long!)).toBeLessThan(venue.rentalCost);
    }
  });

  it('wants money before the first bell', () => {
    expect(residencyDeposit(hall, short!, settings)).toBe(
      residencyRent(hall, short!) * settings.residencyDepositWeeks,
    );
  });

  it('holds the rent it was signed at', () => {
    const deal = signResidency(hall, long!, 12);
    expect(deal.rentPerWeek).toBe(residencyRent(hall, long!));
    expect(deal.weeksLeft).toBe(long!.weeks);
    expect(deal.showsRun).toBe(0);
    expect(deal.signedWeek).toBe(12);
  });
});

describe('nobody is travelling', () => {
  it('costs nothing to move a roster that has not moved', () => {
    expect(residencyTravelCost(run(0), 8_400)).toBe(0);
    expect(residencyHaulageCost(run(0), 900)).toBe(0);
  });

  it('charges a touring company the lot', () => {
    expect(residencyTravelCost(null, 8_400)).toBe(8_400);
    expect(residencyHaulageCost(null, 900)).toBe(900);
  });
});

describe('wearing the town out', () => {
  it('starts at full price and gets worse every show', () => {
    expect(saturationDraw(null, settings)).toBe(1);
    expect(saturationDraw(run(0), settings)).toBe(1);
    expect(saturationDraw(run(10), settings)).toBeLessThan(saturationDraw(run(2), settings));
  });

  it('costs a real slice of the house by the end of a half-year run', () => {
    // Not ruinous, and not nothing: the whole bargain in one number.
    const atTheEnd = saturationDraw(run(settings.residencyShortWeeks), settings);
    expect(atTheEnd).toBeLessThan(0.8);
    expect(atTheEnd).toBeGreaterThan(0.6);
  });

  it('never quite empties the room', () => {
    expect(saturationDraw(run(10_000), settings)).toBe(settings.residencyWorstDraw);
    expect(settings.residencyWorstDraw).toBeGreaterThan(0);
  });

  it('says how tired the town is, in words and without a figure', () => {
    for (const shows of [0, 5, 20, 40, 100]) {
      const line = saturationLine(run(shows), settings);
      expect(line).not.toMatch(/\d/);
    }
    expect(saturationLine(run(0), settings)).toMatch(/not tired/i);
    expect(saturationLine(run(200), settings)).toMatch(/worn this town out/i);
  });
});

describe('the term running out', () => {
  it('counts down a week at a time and only counts shows that happened', () => {
    const after = tickResidency(run(3, 5), false)!;
    expect(after.weeksLeft).toBe(4);
    expect(after.showsRun).toBe(3);
    expect(tickResidency(run(3, 5), true)!.showsRun).toBe(4);
  });

  it('ends when the term does', () => {
    expect(tickResidency(run(10, 1), true)).toBeNull();
  });

  it('charges most of what is left to walk away, but not all', () => {
    const deal = run(4, 20);
    const owed = breakLeaseCost(deal, settings);
    expect(owed).toBeGreaterThan(0);
    expect(owed).toBeLessThan(deal.rentPerWeek * deal.weeksLeft);
  });

  it('costs nothing to walk away from a deal that is already over', () => {
    expect(breakLeaseCost(run(4, 0), settings)).toBe(0);
  });
});

describe('which rooms do this at all', () => {
  it('is a small-room arrangement', () => {
    expect(residencyAvailable(venueById('vfwHall')!, settings)).toBe(true);
    expect(residencyAvailable(venueById('bingoHall')!, settings)).toBe(true);
    expect(residencyAvailable(venueById('coliseum')!, settings)).toBe(false);
  });

  it('will not sign a year of Saturdays in a field', () => {
    expect(residencyAvailable(venueById('countyFairground')!, settings)).toBe(false);
    expect(residencyBlockedNote(venueById('countyFairground')!, settings)).toMatch(/field/i);
  });

  it('says why a big building will not, in words', () => {
    const note = residencyBlockedNote(venueById('majorArena')!, settings)!;
    expect(note).toMatch(/calendar/i);
    expect(note).not.toMatch(/\d/);
  });

  it('leaves a startup a real choice of rooms', () => {
    // If only one building did this it would be a scripted opening rather
    // than a decision.
    const open = VENUES.filter((v) => residencyAvailable(v, settings) && v.minCompanyRating === 0);
    expect(open.length).toBeGreaterThanOrEqual(3);
  });
});

describe('reading the deal while it runs', () => {
  it('says how long is left and how tired the town is', () => {
    expect(residencyStatus(run(2, 30), settings)).toMatch(/still to run/i);
    expect(residencyStatus(run(2, 5), settings)).toMatch(/weeks left/i);
    expect(residencyStatus(run(2, 1), settings)).toMatch(/last week/i);
  });
});
