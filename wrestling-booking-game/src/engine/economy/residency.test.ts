// Taking a room for the season.
//
// The trade this has to keep honest: a residency is cheaper in every line of
// the budget and worse at almost everything else. If any of the downsides
// stops biting it becomes a free win, and the whole point of it is that it is
// a place to survive rather than a place to grow.

import { describe, expect, it } from 'vitest';
import {
  residencyTerms,
  residencyRent,
  residencyDeposit,
  saturationDraw,
  saturationLine,
  localCeiling,
  localTopTicket,
  residencyMerchMultiplier,
  residencyExposure,
  exposureLine,
  residencyTravelCost,
  residencyHaulageCost,
  breakLeaseCost,
  tickResidency,
  signResidency,
  homesOnOffer,
  residencyStatus,
  expectedHouseLine,
  RESIDENCY_HOMES,
  residencyHomeById,
  type Residency,
} from './residency';
import { defaultWorldSettings } from '../world/settings';
import { VENUES } from '../../data/venues';
import { fairTicketPrice } from './showBudget';

const settings = defaultWorldSettings();
const home = residencyHomeById('millTownArmory')!;
const [short, long] = residencyTerms(settings);

const run = (showsRun: number, weeksLeft = 20): Residency => ({
  ...signResidency(home, short!, 1),
  showsRun,
  weeksLeft,
});

describe('the deal', () => {
  it('offers half a year and a whole one', () => {
    expect(residencyTerms(settings)).toHaveLength(2);
    expect(short!.weeks).toBeLessThan(long!.weeks);
  });

  it('charges less a week for the longer commitment', () => {
    expect(residencyRent(home, long!)).toBeLessThan(residencyRent(home, short!));
  });

  it('is cheaper than the room lists for', () => {
    for (const h of RESIDENCY_HOMES) {
      expect(residencyRent(h, short!)).toBeLessThan(h.rentPerWeek);
      expect(residencyRent(h, long!)).toBeLessThan(h.rentPerWeek);
    }
  });

  it('wants money before the first bell', () => {
    expect(residencyDeposit(home, short!, settings)).toBe(
      residencyRent(home, short!) * settings.residencyDepositWeeks,
    );
  });

  it('holds the rent it was signed at, and remembers the town', () => {
    const deal = signResidency(home, long!, 12);
    expect(deal.rentPerWeek).toBe(residencyRent(home, long!));
    expect(deal.town).toBe(home.town);
    expect(deal.weeksLeft).toBe(long!.weeks);
    expect(deal.showsRun).toBe(0);
  });

  it('takes anybody, because the door is not the gate — the idea is', () => {
    // No rating check anywhere. A legion hall will take a big company's money;
    // it being a mistake is the point, and the game never warns (§0).
    expect(homesOnOffer()).toHaveLength(RESIDENCY_HOMES.length);
  });
});

describe('these are not the touring rooms', () => {
  it('is its own list of buildings entirely', () => {
    const venueIds = new Set(VENUES.map((v) => v.id));
    for (const h of RESIDENCY_HOMES) expect(venueIds.has(h.id)).toBe(false);
  });

  it('is a smaller room than most of what you could tour', () => {
    // Expressed against the touring list rather than a hardcoded seat count,
    // because the homes were rescaled once already: what matters is that these
    // are small rooms *relative to the business*, not that they are under some
    // particular number.
    const median = [...VENUES].sort((a, b) => a.capacity - b.capacity)[Math.floor(VENUES.length / 2)]!;
    for (const h of RESIDENCY_HOMES) expect(h.capacity).toBeLessThanOrEqual(median.capacity);
  });

  it('rents for less a week than the cheapest room you could tour', () => {
    // Free venues (the backyard lot — nobody is charging rent on somebody's
    // yard) are not "a room you could tour" in the sense this test means;
    // they would zero out the comparison for every residency. The cheapest
    // *rentable* room is the real floor to compare against.
    const cheapest = Math.min(...VENUES.filter((v) => v.rentalCost > 0).map((v) => v.rentalCost));
    for (const h of RESIDENCY_HOMES) expect(h.rentPerWeek).toBeLessThanOrEqual(cheapest * 2.5);
  });

  it('puts every one of them in a town of its own', () => {
    const towns = new Set(RESIDENCY_HOMES.map((h) => h.town));
    expect(towns.size).toBe(RESIDENCY_HOMES.length);
  });
});

describe('you will never sell out', () => {
  it('holds fewer people in the town than the room has seats, everywhere', () => {
    // The defining fact of the arrangement. If this ever stops being true a
    // residency becomes a small touring room with cheaper rent.
    for (const h of RESIDENCY_HOMES) expect(h.localCrowd).toBeLessThan(h.capacity);
  });

  it('caps the house at the town rather than the building', () => {
    const ceiling = localCeiling(run(0), settings);
    expect(ceiling).toBe(home.localCrowd);
    expect(ceiling).toBeLessThan(home.capacity);
  });

  it('caps nothing at all for a company on the road', () => {
    expect(localCeiling(null, settings)).toBe(Infinity);
  });

  it('shrinks the town further as it tires', () => {
    expect(localCeiling(run(20), settings)).toBeLessThan(localCeiling(run(0), settings));
  });

  it('says what a room can really expect, seats and people both', () => {
    const line = expectedHouseLine(home);
    expect(line).toMatch(new RegExp(home.town));
    expect(line).toMatch(/will ever come/);
  });
});

describe('you cannot charge much', () => {
  it('will not pay what a decent card fetches on the road', () => {
    // The property, rather than a magic number: every town's ceiling sits
    // under what an ordinary touring show could ask, so a residency can never
    // price its way out of a small house.
    const onTheRoad = fairTicketPrice(60, settings);
    for (const h of RESIDENCY_HOMES) {
      expect(h.topTicket).toBeGreaterThan(0);
      expect(h.topTicket, `${h.town} asks more than the road`).toBeLessThan(onTheRoad);
    }
  });

  it('reports the ceiling of the town you are in and none at all on the road', () => {
    expect(localTopTicket(run(0))).toBe(home.topTicket);
    expect(localTopTicket(null)).toBeNull();
  });
});

describe('merch barely moves', () => {
  it('sells worse in every one of these rooms than on the road', () => {
    for (const h of RESIDENCY_HOMES) expect(h.merchMultiplier).toBeLessThan(1);
    expect(residencyMerchMultiplier(run(0))).toBeLessThan(1);
    expect(residencyMerchMultiplier(null)).toBe(1);
  });
});

describe('nobody gets over', () => {
  it('is worth a fraction of a night on the road', () => {
    expect(residencyExposure(run(0), settings)).toBeLessThan(0.5);
    expect(residencyExposure(null, settings)).toBe(1);
  });

  it('still counts for something — this is a slower road, not a dead end', () => {
    expect(residencyExposure(run(0), settings)).toBeGreaterThan(0);
  });

  it('says so plainly, naming the town', () => {
    expect(exposureLine(run(0))).toMatch(new RegExp(home.town));
    expect(exposureLine(null)).toBeNull();
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
      expect(saturationLine(run(shows), settings)).not.toMatch(/\d/);
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

describe('reading the deal while it runs', () => {
  it('says how long is left and how tired the town is', () => {
    expect(residencyStatus(run(2, 30), settings)).toMatch(/still to run/i);
    expect(residencyStatus(run(2, 5), settings)).toMatch(/weeks left/i);
    expect(residencyStatus(run(2, 1), settings)).toMatch(/last week/i);
  });
});
