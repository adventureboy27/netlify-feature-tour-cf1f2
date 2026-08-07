import { describe, it, expect } from 'vitest';
import {
  computeShowCosts,
  computeAttendanceForShow,
  computeShowRevenue,
  attendanceRatingModifier,
  canAffordShow,
  sumEffect,
  fairTicketPrice,
  computeDemand,
  priceRatio,
  priceGoodwill,
  priceReaction,
  priceReactionLine,
} from './showBudget';
import { VENUES, venueById, availableVenues } from '../../data/venues';
import { PRODUCTION_ASSETS, SHOW_EXTRAS, availableExtras, productionAssetById, showExtraById } from '../../data/production';
import { defaultWorldSettings } from '../world/settings';
import { defaultShowSetup } from '../../state/world';

const settings = defaultWorldSettings();
const gym = venueById('schoolGym')!;
const arena = venueById('civicArena')!;

const costCtx = (over = {}) => ({
  venue: gym,
  ownedAssets: [],
  extras: [],
  rosterSize: 30,
  settings,
  ...over,
});

describe('venues', () => {
  it('gets bigger and dearer together', () => {
    for (let i = 1; i < VENUES.length; i++) {
      expect(VENUES[i]!.capacity).toBeGreaterThan(VENUES[i - 1]!.capacity);
      expect(VENUES[i]!.rentalCost).toBeGreaterThan(VENUES[i - 1]!.rentalCost);
      expect(VENUES[i]!.prestige).toBeGreaterThan(VENUES[i - 1]!.prestige);
    }
  });

  it('will not rent a real building to a promotion nobody has heard of', () => {
    const forNobody = availableVenues(0).map((v) => v.id);
    expect(forNobody).toContain('schoolGym');
    expect(forNobody).not.toContain('civicArena');
    expect(forNobody).not.toContain('domeStadium');

    expect(availableVenues(100).length).toBe(VENUES.length);
  });

  it('always leaves something you can run', () => {
    expect(availableVenues(0).length).toBeGreaterThan(0);
  });
});

describe('show costs', () => {
  it('charges rent, crew and travel even for an empty card', () => {
    const costs = computeShowCosts(costCtx());
    expect(costs.venueRent).toBe(gym.rentalCost);
    expect(costs.travel).toBeGreaterThan(0);
    expect(costs.crew).toBeGreaterThan(0);
    expect(costs.total).toBe(costs.venueRent + costs.assetUpkeep + costs.extras + costs.travel + costs.crew);
  });

  it('makes a bigger building cost more before anyone buys a ticket', () => {
    expect(computeShowCosts(costCtx({ venue: arena })).total).toBeGreaterThan(computeShowCosts(costCtx()).total);
  });

  it('charges upkeep on everything you own, every show', () => {
    const withGear = computeShowCosts(costCtx({ ownedAssets: PRODUCTION_ASSETS }));
    expect(withGear.assetUpkeep).toBe(PRODUCTION_ASSETS.reduce((s, a) => s + a.upkeepPerShow, 0));
    expect(withGear.total).toBeGreaterThan(computeShowCosts(costCtx()).total);
  });

  it('charges extras fresh every time', () => {
    const pyro = showExtraById('pyroCharges')!;
    expect(computeShowCosts(costCtx({ extras: [pyro] })).extras).toBe(pyro.cost);
  });

  it('makes a bigger roster cost more to move', () => {
    expect(computeShowCosts(costCtx({ rosterSize: 60 })).travel).toBeGreaterThan(
      computeShowCosts(costCtx({ rosterSize: 20 })).travel,
    );
  });

  it('knows when you cannot afford to open the doors', () => {
    const costs = computeShowCosts(costCtx({ venue: venueById('domeStadium')! }));
    expect(canAffordShow(75000, costs)).toBe(false);
    expect(canAffordShow(500000, costs)).toBe(true);
  });
});

describe('production purchases', () => {
  it('prices one-time gear far above what a new promotion has', () => {
    // The point is not the exact count of what you can afford — it is that
    // you cannot kit yourself out. Buying anything means committing most of
    // the bank, and the flagship gear is years away.
    const total = PRODUCTION_ASSETS.reduce((sum, a) => sum + a.cost, 0);
    expect(total).toBeGreaterThan(settings.startingCash * 10);

    const dearest = Math.max(...PRODUCTION_ASSETS.map((a) => a.cost));
    expect(dearest).toBeGreaterThan(settings.startingCash * 3);

    // Even the cheapest thing is a real chunk of the opening balance.
    const cheapest = Math.min(...PRODUCTION_ASSETS.map((a) => a.cost));
    expect(cheapest).toBeGreaterThan(settings.startingCash * 0.15);
  });

  it('gives everything an ongoing cost, so nothing is free once bought', () => {
    for (const asset of PRODUCTION_ASSETS) {
      expect(asset.upkeepPerShow, asset.id).toBeGreaterThan(0);
      expect(asset.cost, asset.id).toBeGreaterThan(0);
      expect(Object.keys(asset.effects).length, asset.id).toBeGreaterThan(0);
    }
  });

  it('locks pyro charges behind owning the rig', () => {
    expect(availableExtras([]).map((e) => e.id)).not.toContain('pyroCharges');
    expect(availableExtras(['pyroRig']).map((e) => e.id)).toContain('pyroCharges');
  });

  it('keeps the big screen a one-time purchase that travels', () => {
    const screen = productionAssetById('bigScreen')!;
    expect(screen.cost).toBeGreaterThan(50000);
    // It's an asset, not an extra — buying it once is the whole point.
    expect(SHOW_EXTRAS.map((e) => e.id)).not.toContain('bigScreen');
  });

  it('needs a building big enough for the big rigs', () => {
    expect(productionAssetById('bigScreen')!.minVenueCapacity).toBeGreaterThan(gym.capacity);
    expect(productionAssetById('soundSystem')!.minVenueCapacity).toBeUndefined();
  });
});

describe('sumEffect', () => {
  it('adds additive effects and multiplies multiplicative ones', () => {
    const sources = [{ effects: { showRating: 3, attendanceMultiplier: 1.1 } }, { effects: { showRating: 4, attendanceMultiplier: 1.2 } }];
    expect(sumEffect(sources, 'showRating')).toBe(7);
    expect(sumEffect(sources, 'attendanceMultiplier', 'multiply')).toBeCloseTo(1.32, 5);
  });

  it('treats a missing field as neutral', () => {
    expect(sumEffect([{ effects: {} }], 'showRating')).toBe(0);
    expect(sumEffect([{ effects: {} }], 'attendanceMultiplier', 'multiply')).toBe(1);
  });
});

describe('attendance', () => {
  // Demand 45 in a 6,000-seat room leaves headroom, so these tests measure
  // the model rather than the ceiling.
  const base = { venue: arena, ticketPrice: 20, demand: 45, attendanceMultiplier: 1, settings };

  it('never exceeds the building', () => {
    expect(computeAttendanceForShow({ ...base, demand: 100, ticketPrice: 1 })).toBeLessThanOrEqual(arena.capacity);
  });

  it('draws more for a card people want to see', () => {
    expect(computeAttendanceForShow({ ...base, demand: 80 })).toBeGreaterThan(computeAttendanceForShow({ ...base, demand: 30 }));
  });

  it('empties the building when you overcharge', () => {
    expect(computeAttendanceForShow({ ...base, ticketPrice: 90 })).toBeLessThan(computeAttendanceForShow({ ...base, ticketPrice: 20 }));
  });

  it('fills it when you undercharge — but only so far', () => {
    const cheap = computeAttendanceForShow({ ...base, ticketPrice: 2 });
    const fair = computeAttendanceForShow({ ...base, ticketPrice: 20 });
    expect(cheap).toBeGreaterThan(fair);
    // Giving tickets away does not conjure an audience that does not exist.
    expect(cheap).toBeLessThan(arena.capacity);
  });

  it('is the promotion\'s audience, not the building\'s — the venue does not create fans', () => {
    // The same card in a room ten times the size draws the same people. This
    // is what makes booking too big a room a real mistake rather than a free
    // upgrade.
    const inGym = computeAttendanceForShow({ ...base, venue: gym, demand: 20 });
    const inArena = computeAttendanceForShow({ ...base, venue: arena, demand: 20 });
    expect(inArena).toBeLessThan(gym.capacity * 3);
    expect(inGym).toBeLessThanOrEqual(gym.capacity);
  });

  it('lets advertising and production put people in seats', () => {
    expect(computeAttendanceForShow({ ...base, attendanceMultiplier: 1.3 })).toBeGreaterThan(
      computeAttendanceForShow(base),
    );
  });

  it('never goes negative on a disastrous show', () => {
    expect(computeAttendanceForShow({ ...base, demand: 0, ticketPrice: 500 })).toBeGreaterThanOrEqual(0);
  });
});

describe('revenue', () => {
  const base = {
    attendance: 1000,
    ticketPrice: 20,
    merchMultiplier: 1,
    gimmickMerchMultiplier: 1,
    merchCutShare: 0,
    revenuePerHead: 0,
    averagePopularity: 50,
    settings,
  };

  it('takes the gate at the door', () => {
    expect(computeShowRevenue(base).gate).toBe(20000);
  });

  it('sells more merchandise for a gimmick people buy shirts for', () => {
    // Every gimmick in data/ has carried a merchMultiplier since the file was
    // written and nothing read it. A luchador with a mask to sell moves more
    // than a corporate stooge in a suit.
    expect(computeShowRevenue({ ...base, gimmickMerchMultiplier: 1.3 }).merch).toBeGreaterThan(
      computeShowRevenue({ ...base, gimmickMerchMultiplier: 0.7 }).merch,
    );
  });

  it('hands over the slice owed to anybody with a merchandise cut', () => {
    // The clause has always been offered as "a slice off the top of every
    // shirt sold" and always cost exactly nothing.
    const keptAll = computeShowRevenue(base).merch;
    const shared = computeShowRevenue({ ...base, merchCutShare: 0.16 }).merch;
    expect(shared).toBeLessThan(keptAll);
    expect(shared).toBeCloseTo(keptAll * 0.84, -1);
  });

  it('never lets the cuts take more than the stand made', () => {
    expect(computeShowRevenue({ ...base, merchCutShare: 5 }).merch).toBeGreaterThanOrEqual(0);
  });

  it('sells more merchandise for a more popular roster', () => {
    expect(computeShowRevenue({ ...base, averagePopularity: 90 }).merch).toBeGreaterThan(
      computeShowRevenue({ ...base, averagePopularity: 20 }).merch,
    );
  });

  it('pays off the merchandise trailer', () => {
    const trailer = productionAssetById('merchTruck')!;
    expect(computeShowRevenue({ ...base, merchMultiplier: trailer.effects.merchMultiplier! }).merch).toBeGreaterThan(
      computeShowRevenue(base).merch,
    );
  });

  it('counts streaming and meet-and-greet revenue per head', () => {
    expect(computeShowRevenue({ ...base, revenuePerHead: 3 }).other).toBe(3000);
  });

  it('totals its parts', () => {
    const r = computeShowRevenue({ ...base, revenuePerHead: 2 });
    expect(r.total).toBe(r.gate + r.merch + r.other);
  });
});

describe('how full the building looked', () => {
  it('rewards a packed house', () => {
    expect(attendanceRatingModifier(5800, 6000, settings)).toBeGreaterThan(0);
  });

  it('punishes an arena with two thousand people in it', () => {
    expect(attendanceRatingModifier(2000, 6000, settings)).toBeLessThan(0);
  });

  it('rates a packed gym above a half-empty arena', () => {
    expect(attendanceRatingModifier(240, 250, settings)).toBeGreaterThan(attendanceRatingModifier(2500, 6000, settings));
  });
});

describe('the shape of the decision', () => {
  it('punishes booking a building you cannot fill', () => {
    // The same demand, in two buildings. The arena takes a bigger gate and
    // still loses money on the rent.
    const demand = 25;
    const ticketPrice = 18;

    const runIn = (venue: typeof gym) => {
      const attendance = computeAttendanceForShow({ venue, ticketPrice, demand, attendanceMultiplier: 1, settings });
      const revenue = computeShowRevenue({
        attendance,
        ticketPrice,
        merchMultiplier: 1,
        gimmickMerchMultiplier: 1,
        merchCutShare: 0,
        revenuePerHead: 0,
        averagePopularity: 50,
        settings,
      });
      const costs = computeShowCosts(costCtx({ venue }));
      return revenue.total - costs.total;
    };

    expect(runIn(gym)).toBeGreaterThan(runIn(arena));
  });

  it('rewards the arena once the demand is actually there', () => {
    const demand = 95;
    const ticketPrice = 28;
    const runIn = (venue: typeof gym) => {
      const attendance = computeAttendanceForShow({ venue, ticketPrice, demand, attendanceMultiplier: 1, settings });
      const revenue = computeShowRevenue({
        attendance,
        ticketPrice,
        merchMultiplier: 1,
        gimmickMerchMultiplier: 1,
        merchCutShare: 0,
        revenuePerHead: 0,
        averagePopularity: 70,
        settings,
      });
      const costs = computeShowCosts(costCtx({ venue }));
      return revenue.total - costs.total;
    };

    expect(runIn(arena)).toBeGreaterThan(runIn(gym));
  });
});

describe('the ticket price', () => {
  it('rises with demand, because a hot show is worth more', () => {
    expect(fairTicketPrice(90, settings)).toBeGreaterThan(fairTicketPrice(40, settings));
  });

  it('is what the opening show defaults to', () => {
    // The bug this locks: the default was a hardcoded 12 while fair was ~28,
    // so a new promotion opened by handing back more than half its gate. The
    // room sold out anyway, so no screen in the game ever showed the loss —
    // it just quietly folded around week thirteen.
    const openingDemand = computeDemand(
      settings.startingCompanyRating,
      settings.startingCompanyRating,
      settings.startingCompanyRating,
      settings,
      settings.startingTerritoryFollowing,
    );
    const setup = defaultShowSetup(settings);
    expect(setup.ticketPrice).toBe(Math.round(fairTicketPrice(openingDemand, settings)));
  });

  it('leaves the opening house short of a sell-out, so the room is a real choice', () => {
    const openingDemand = computeDemand(
      settings.startingCompanyRating,
      settings.startingCompanyRating,
      settings.startingCompanyRating,
      settings,
      settings.startingTerritoryFollowing,
    );
    const setup = defaultShowSetup(settings);
    const venue = venueById(setup.venueId)!;
    const attendance = computeAttendanceForShow({
      venue,
      ticketPrice: setup.ticketPrice,
      demand: openingDemand,
      attendanceMultiplier: 1,
      settings,
    });
    expect(attendance).toBeLessThan(venue.capacity);
    expect(attendance).toBeGreaterThan(venue.capacity * 0.5);
  });
});

describe('what greed costs', () => {
  const fairAt = (demand: number) => fairTicketPrice(demand, settings);

  it('charges nothing for a fair price', () => {
    expect(priceGoodwill(priceRatio(fairAt(60), 60, settings), settings)).toBe(0);
  });

  it('costs more the greedier you get', () => {
    const steep = priceGoodwill(1.4, settings);
    const gouge = priceGoodwill(2, settings);
    expect(steep).toBeLessThan(0);
    expect(gouge).toBeLessThan(steep);
  });

  it('outweighs a great card once the price is a real gouge', () => {
    // A four-star show earns four stars' worth of following. Doubling the
    // ticket has to take more than that back, or gouging is still free.
    const earned = 4 * settings.territoryFollowingPerStar;
    expect(earned + priceGoodwill(2, settings)).toBeLessThan(0);
  });

  it('bites on a sold-out night, which is the night it has to bite on', () => {
    // The bug: price only moved tonight's headcount, so once demand outran
    // the building — 28,000 wanting in, 15,000 seats — a moderate overcharge
    // still sold every seat and took 30% more at the door for nothing. An
    // outrageous price was always punished; it was the quietly greedy one
    // that was free, and it got freer the bigger the promotion grew.
    // Goodwill is computed from the price alone, so it lands anyway.
    const arena = venueById('majorArena')!;
    const demand = 93;
    const at = (price: number) =>
      computeAttendanceForShow({ venue: arena, ticketPrice: price, demand, attendanceMultiplier: 1, settings });
    const fair = fairAt(demand);
    expect(at(fair)).toBe(arena.capacity);
    expect(at(fair * 1.3)).toBe(arena.capacity); // still a sell-out tonight
    expect(priceGoodwill(1.3, settings)).toBeLessThan(0); // and still costs you
  });

  it('rewards a bargain, but only a little — people forget a deal', () => {
    const deal = priceGoodwill(0.5, settings);
    expect(deal).toBeGreaterThan(0);
    expect(deal).toBeLessThan(-priceGoodwill(1.5, settings));
  });

  it('is forgiven if you go back to pricing fairly', () => {
    // Harsh is fine; unrecoverable is not. One gouge costs a town roughly one
    // good show's worth of goodwill, so the way back is to put on a good show
    // and charge properly for it.
    const gouged = priceGoodwill(1.5, settings);
    const oneGoodNight = 4 * settings.territoryFollowingPerStar + priceGoodwill(1, settings);
    expect(oneGoodNight + gouged).toBeGreaterThan(0);
  });

  it('names what the town made of it', () => {
    expect(priceReaction(0.5, settings)).toBe('giveaway');
    expect(priceReaction(0.8, settings)).toBe('bargain');
    expect(priceReaction(1, settings)).toBe('fair');
    expect(priceReaction(1.25, settings)).toBe('steep');
    expect(priceReaction(1.8, settings)).toBe('gouge');
  });

  it('says so out loud, naming the town', () => {
    expect(priceReactionLine('gouge', 'Ironbelt City')).toContain('Ironbelt City');
    expect(priceReactionLine('gouge', 'Ironbelt City')).toMatch(/liberty/);
  });
});
