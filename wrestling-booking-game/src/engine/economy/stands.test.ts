// The merch table and the concession stand.
//
// The one property that carries this whole system: a stand is a fixed cost
// against a per-head return, so every line has a crowd below which it loses
// money. If that ever stops being true the decision evaporates and the right
// answer becomes "stock everything".

import { describe, expect, it } from 'vitest';
import {
  standFit,
  standAvailable,
  standBlockedNote,
  standTakings,
  nightAtTheTables,
  breakEvenCrowd,
  standVerdict,
  standsOnOffer,
  prunedStands,
  MERCH_LINES,
  CONCESSIONS,
  ALL_STANDS,
  standById,
  type StandContext,
} from './stands';
import { defaultWorldSettings } from '../world/settings';
import { venueById } from '../../data/venues';

const settings = defaultWorldSettings();

const ctx = (over: Partial<StandContext> = {}): StandContext => ({
  gimmickMerchMultiplier: 1,
  prestige: 40,
  identity: 'territory',
  venue: venueById('nationalGuardArmory')!,
  rigInRoom: [],
  settings,
  ...over,
});

describe('a stand is a bet on the door', () => {
  it('loses money in front of nobody and makes it in front of a full house', () => {
    for (const stand of ALL_STANDS) {
      expect(standTakings(stand, 0, ctx()).net).toBeLessThan(0);
      expect(standTakings(stand, 50_000, ctx({ prestige: 100 })).net).toBeGreaterThan(0);
    }
  });

  it('has a crowd it needs, and the dear stock needs a bigger one', () => {
    const shirts = breakEvenCrowd(standById('shirts')!, ctx());
    const belts = breakEvenCrowd(standById('replicaBelts')!, ctx());
    expect(shirts).toBeGreaterThan(0);
    expect(belts).toBeGreaterThan(shirts * 3);
  });

  it('breaks even where it says it does', () => {
    for (const stand of ALL_STANDS) {
      const c = ctx({ venue: venueById('vfwHall')! });
      const need = breakEvenCrowd(stand, c);
      expect(standTakings(stand, need, c).net).toBeGreaterThanOrEqual(0);
      if (need > 1) expect(standTakings(stand, need - 1, c).net).toBeLessThan(0);
    }
  });
});

describe('fit — why the answer is not just the dearest thing', () => {
  it('sells masks to a lucha card and barely any to a card of brawlers', () => {
    const masks = standById('masks')!;
    const lucha = standTakings(masks, 1_000, ctx({ gimmickMerchMultiplier: 1.4 })).gross;
    const brawlers = standTakings(masks, 1_000, ctx({ gimmickMerchMultiplier: 0.9 })).gross;
    expect(lucha).toBeGreaterThan(brawlers * 1.5);
  });

  it('will not sell plush toys to a deathmatch crowd', () => {
    const plush = standById('plush')!;
    expect(standFit(plush.fit, ctx({ identity: 'hardcore' }))).toBeLessThan(
      standFit(plush.fit, ctx({ identity: 'sportsEntertainment' })),
    );
  });

  it('sells kendo sticks to precisely one kind of promotion', () => {
    const sticks = standById('weaponsMerch')!;
    expect(standFit(sticks.fit, ctx({ identity: 'hardcore' }))).toBeGreaterThan(1);
    expect(standFit(sticks.fit, ctx({ identity: 'technical' }))).toBeLessThan(1);
  });

  it('will not sell a replica belt for a promotion nobody has heard of', () => {
    const belts = standById('replicaBelts')!;
    expect(breakEvenCrowd(belts, ctx({ prestige: 5 }))).toBeGreaterThan(
      breakEvenCrowd(belts, ctx({ prestige: 95 })) * 2,
    );
  });

  it('sells a programme to anybody, which is why it is on every card', () => {
    const programmes = standById('programmes')!;
    for (const identity of ['hardcore', 'lucha', 'technical', 'sportsEntertainment'] as const) {
      expect(standFit(programmes.fit, ctx({ identity }))).toBe(1);
    }
  });
});

describe('what the building will let you run', () => {
  it('keeps its own bar where the bar is theirs', () => {
    const casino = ctx({ venue: venueById('casinoShowroom')! });
    for (const stand of CONCESSIONS) {
      expect(standAvailable(stand, casino)).toBe(false);
      expect(standBlockedNote(stand, casino)).toMatch(/own bar/i);
    }
  });

  it('lets you run the bar in a hall that hands it over', () => {
    const hall = ctx({ venue: venueById('vfwHall')! });
    expect(standAvailable(standById('fullBar')!, hall)).toBe(true);
  });

  it('will not park food trucks indoors', () => {
    expect(standAvailable(standById('foodTrucks')!, ctx({ venue: venueById('vfwHall')! }))).toBe(false);
    expect(standAvailable(standById('foodTrucks')!, ctx({ venue: venueById('countyFairground')! }))).toBe(true);
  });

  it('will not sell a recording of a show nobody filmed', () => {
    const tapes = standById('tapes')!;
    expect(standAvailable(tapes, ctx())).toBe(false);
    expect(standAvailable(tapes, ctx({ rigInRoom: ['matRopes', 'cameras'] }))).toBe(true);
  });

  it('never charges for a stand it would not let you run', () => {
    // The bug this locks: booking a bar, then moving to a casino, and paying
    // for a bar that never opened.
    const casino = ctx({ venue: venueById('casinoShowroom')! });
    const night = nightAtTheTables(['shirts', 'fullBar', 'foodTrucks'], 1_500, casino);
    expect(night.lines.map((l) => l.standId)).toEqual(['shirts']);
    expect(night.concessionsGross).toBe(0);
  });

  it('prunes what a changed room will no longer take', () => {
    const casino = ctx({ venue: venueById('casinoShowroom')! });
    expect(prunedStands(['shirts', 'fullBar', 'nonsense'], casino)).toEqual(['shirts']);
  });
});

describe('the night, added up', () => {
  it('keeps merch and the bar apart, because they are taxed differently', () => {
    const hall = ctx({ venue: venueById('vfwHall')! });
    const night = nightAtTheTables(['shirts', 'programmes', 'fullBar'], 400, hall);
    expect(night.merchGross).toBeGreaterThan(0);
    expect(night.concessionsGross).toBeGreaterThan(0);
    expect(night.cost).toBe(
      standById('shirts')!.costPerShow + standById('programmes')!.costPerShow + standById('fullBar')!.costPerShow,
    );
  });

  it('costs the stock whether anybody came or not', () => {
    const night = nightAtTheTables(['shirts', 'programmes'], 0, ctx());
    expect(night.cost).toBeGreaterThan(0);
    expect(night.merchGross).toBe(0);
  });

  it('runs nothing, costs nothing', () => {
    const night = nightAtTheTables([], 5_000, ctx());
    expect(night).toEqual({ merchGross: 0, concessionsGross: 0, cost: 0, lines: [] });
  });
});

describe('reading the table before you stock it', () => {
  it('says where a line stands against the room, in words', () => {
    // Worth reading closely: in a 250-seat gym even a programme wants a decent
    // house, and replica belts want more people than the building holds. That
    // is the intended texture of starting small, not a balance accident.
    const gym = ctx({ venue: venueById('schoolGym')! });
    expect(standVerdict(standById('replicaBelts')!, gym)).toMatch(/more stock than this building/i);
    expect(standVerdict(standById('programmes')!, gym)).toMatch(/decent house/i);

    // The same programme in a room four times the size sells to anybody.
    const armory = ctx({ venue: venueById('nationalGuardArmory')! });
    expect(standVerdict(standById('programmes')!, armory)).toMatch(/almost anybody/i);
  });

  it('never prints a figure and never gives advice — §0', () => {
    for (const stand of ALL_STANDS) {
      for (const venue of ['schoolGym', 'nationalGuardArmory', 'coliseum']) {
        const verdict = standVerdict(stand, ctx({ venue: venueById(venue)! }));
        expect(verdict).not.toMatch(/\d/);
        expect(verdict.toLowerCase()).not.toMatch(/should|do not|avoid|careful/);
      }
    }
  });

  it('offers every line and says which ones this room refuses', () => {
    const offered = standsOnOffer(ctx({ venue: venueById('casinoShowroom')! }));
    expect(offered.length).toBe(MERCH_LINES.length + CONCESSIONS.length);
    expect(offered.filter((o) => o.blocked !== null).length).toBeGreaterThan(0);
  });
});
