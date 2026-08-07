import { describe, it, expect } from 'vitest';
import {
  broadcastBreaches,
  sponsorBreaches,
  broadcastOffer,
  availableSponsors,
  weeklyBroadcastIncome,
  shouldWalk,
  type BusinessSnapshot,
  broadcastVerdict,
} from './broadcast';
import { BROADCASTERS, broadcasterById, bestBroadcasterFor } from '../../data/broadcasters';
import { SPONSORS, sponsorById, sponsorsConflict } from '../../data/sponsors';
import { defaultWorldSettings } from '../world/settings';

const settings = defaultWorldSettings();

function snapshot(over: Partial<BusinessSnapshot> = {}): BusinessSnapshot {
  return {
    // Comfortably above what any tier asks in the slot, so a snapshot is
    // "healthy" on every axis unless a test says otherwise.
    tvRating: 6,
    companyRating: 70,
    hardcoreSaturation: 30,
    averageAttendance: 3_000,
    topStarPopularity: 80,
    showsThisMonth: 4,
    ppvsThisQuarter: 3,
    ...over,
  };
}

describe('the networks', () => {
  it('climbs in fee and in what it asks of you', () => {
    for (let i = 1; i < BROADCASTERS.length; i++) {
      expect(BROADCASTERS[i]!.weeklyFee).toBeGreaterThan(BROADCASTERS[i - 1]!.weeklyFee);
      expect(BROADCASTERS[i]!.requiresRating).toBeGreaterThan(BROADCASTERS[i - 1]!.requiresRating);
      expect(BROADCASTERS[i]!.tier).toBeGreaterThan(BROADCASTERS[i - 1]!.tier);
    }
  });

  it('gives every tier a demand', () => {
    // A fee with no strings is a number going up, not a system.
    for (const b of BROADCASTERS) expect(b.demands.length).toBeGreaterThan(0);
  });

  it('offers the best deal a promotion qualifies for', () => {
    expect(bestBroadcasterFor(40)).toBeUndefined();
    expect(bestBroadcasterFor(56)?.id).toBe('localAccess');
    expect(bestBroadcasterFor(95)?.id).toBe('premiumGlobal');
  });

  it('will not talk until the rating has been held', () => {
    const short = settings.broadcastWeeksToQualify - 1;
    expect(broadcastOffer(90, short, null, settings)).toBeNull();
    expect(broadcastOffer(90, settings.broadcastWeeksToQualify, null, settings)).not.toBeNull();
  });

  it('never offers a worse deal than the one you have', () => {
    // Sitting on the national deal, a rating that only qualifies for regional
    // produces no offer at all.
    expect(broadcastOffer(70, 20, 'nationalNetwork', settings)).toBeNull();
    // But a rating that qualifies for better does.
    expect(broadcastOffer(95, 20, 'nationalNetwork', settings)?.id).toBe('premiumGlobal');
  });
});

describe('breaking a television deal', () => {
  const national = broadcasterById('nationalNetwork')!;

  it('is happy when the terms are being met', () => {
    expect(broadcastBreaches(national, snapshot({ companyRating: 80, hardcoreSaturation: 20 }))).toEqual([]);
  });

  it('notices a rating that has slipped', () => {
    const breaches = broadcastBreaches(national, snapshot({ companyRating: 60, hardcoreSaturation: 20 }));
    expect(breaches).toHaveLength(1);
    expect(breaches[0]!.actual).toBe(60);
    expect(breaches[0]!.wanted).toBe(75);
  });

  it('notices when the slot is not delivering, even from a well-regarded company', () => {
    // Standing and viewership are different things. A promotion can be
    // respected and still not be watched, and the network is buying the
    // second one.
    const breaches = broadcastBreaches(national, snapshot({ companyRating: 80, hardcoreSaturation: 20, tvRating: 1.1 }));
    expect(breaches).toHaveLength(1);
    expect(breaches[0]!.actual).toBe(1.1);
  });

  it('notices a card that has got too violent for them', () => {
    const breaches = broadcastBreaches(national, snapshot({ companyRating: 80, hardcoreSaturation: 90 }));
    expect(breaches).toHaveLength(1);
    expect(breaches[0]!.text).toContain('advertisers');
  });

  it('wants its pay-per-views', () => {
    const premium = broadcasterById('premiumGlobal')!;
    expect(broadcastBreaches(premium, snapshot({ companyRating: 90, ppvsThisQuarter: 0 })).length).toBe(1);
    expect(broadcastBreaches(premium, snapshot({ companyRating: 90, ppvsThisQuarter: 2 }))).toEqual([]);
  });

  it('walks only after the grace period', () => {
    expect(shouldWalk(settings.broadcastWeeksOfGrace - 1, settings)).toBe(false);
    expect(shouldWalk(settings.broadcastWeeksOfGrace, settings)).toBe(true);
  });
});

describe('sponsors', () => {
  it('cannot all be kept — that is the point', () => {
    const cereal = sponsorById('nationalBrand')!;
    const beer = sponsorById('beerBrand')!;
    expect(sponsorsConflict(cereal, beer)).toBe(true);
    expect(sponsorsConflict(beer, cereal)).toBe(true);
  });

  it('does not invent conflicts between compatible brands', () => {
    const local = sponsorById('localBusiness')!;
    const apparel = sponsorById('apparelBrand')!;
    expect(sponsorsConflict(local, apparel)).toBe(false);
  });

  it('keeps a signed sponsor off the offer list, along with anybody who clashes with them', () => {
    const offered = availableSponsors(85, ['nationalBrand'], snapshot({ hardcoreSaturation: 10 }), settings);
    expect(offered.map((s) => s.id)).not.toContain('nationalBrand');
    expect(offered.map((s) => s.id)).not.toContain('beerBrand');
  });

  it('will not sign to a condition you are already failing', () => {
    // The cereal brand wants violence under 25 and is looking at 90.
    const offered = availableSponsors(85, [], snapshot({ hardcoreSaturation: 90 }), settings);
    expect(offered.map((s) => s.id)).not.toContain('nationalBrand');
    expect(offered.map((s) => s.id)).toContain('beerBrand');
  });

  it('will not talk to a company too small for them', () => {
    const offered = availableSponsors(46, [], snapshot({ companyRating: 46 }), settings);
    expect(offered.map((s) => s.id)).toEqual(['localBusiness']);
  });

  it('leaves when a condition breaks', () => {
    const beer = sponsorById('beerBrand')!;
    expect(sponsorBreaches(beer, snapshot({ hardcoreSaturation: 50 }))).toEqual([]);
    expect(sponsorBreaches(beer, snapshot({ hardcoreSaturation: 5 })).length).toBe(1);

    const apparel = sponsorById('apparelBrand')!;
    expect(sponsorBreaches(apparel, snapshot({ topStarPopularity: 40 })).length).toBe(1);
  });

  it('stops offering once the banner is full', () => {
    const full = Array.from({ length: settings.maxSponsors }, (_, i) => SPONSORS[i]!.id);
    expect(availableSponsors(95, full, snapshot({ hardcoreSaturation: 30 }), settings)).toEqual([]);
  });

  it('rises in fee with what it demands of the promotion', () => {
    const local = sponsorById('localBusiness')!;
    const national = sponsorById('nationalBrand')!;
    expect(national.weeklyFee).toBeGreaterThan(local.weeklyFee);
    expect(national.conditions.length).toBeGreaterThan(local.conditions.length);
  });
});

describe('what it all pays', () => {
  it('adds the network to every sponsor, at the rating they signed you for', () => {
    const deal = broadcasterById('regionalCable')!;
    const signed = [sponsorById('localBusiness')!, sponsorById('apparelBrand')!];
    // Deliver exactly what they expected and the fee is exactly the fee.
    expect(weeklyBroadcastIncome(deal, signed, deal.expectedRating, settings)).toBe(
      deal.weeklyFee + signed[0]!.weeklyFee + signed[1]!.weeklyFee,
    );
  });

  it('pays more for a rating that beats the deal and less for one that misses', () => {
    // The whole reason this function takes a rating at all: the TV number
    // used to be a scoreboard with no money behind it.
    const deal = broadcasterById('nationalNetwork')!;
    const hot = weeklyBroadcastIncome(deal, [], deal.expectedRating * 1.5, settings);
    const par = weeklyBroadcastIncome(deal, [], deal.expectedRating, settings);
    const cold = weeklyBroadcastIncome(deal, [], deal.expectedRating * 0.4, settings);
    expect(hot).toBeGreaterThan(par);
    expect(cold).toBeLessThan(par);
  });

  it('bounds the swing either side, so one soft week is not ruin', () => {
    const deal = broadcasterById('premiumGlobal')!;
    const disaster = weeklyBroadcastIncome(deal, [], 0, settings);
    const phenomenon = weeklyBroadcastIncome(deal, [], 99, settings);
    expect(disaster).toBe(Math.round(deal.weeklyFee * (1 - settings.broadcastRatingDownside)));
    expect(phenomenon).toBe(Math.round(deal.weeklyFee * (1 + settings.broadcastRatingUpside)));
  });

  it('leaves sponsors flat — they are buying a banner, not a slot', () => {
    const signed = [sponsorById('localBusiness')!];
    expect(weeklyBroadcastIncome(null, signed, 0, settings)).toBe(signed[0]!.weeklyFee);
    expect(weeklyBroadcastIncome(null, signed, 12, settings)).toBe(signed[0]!.weeklyFee);
  });

  it('says how the deal is going, in words', () => {
    const deal = broadcasterById('nationalNetwork')!;
    expect(broadcastVerdict(deal, deal.expectedRating * 1.5)).toBe('Beating the deal');
    expect(broadcastVerdict(deal, deal.expectedRating)).toBe('Meeting the deal');
    expect(broadcastVerdict(deal, deal.expectedRating * 0.5)).toBe('Below the guarantee');
    expect(broadcastVerdict(null, 5)).toBeNull();
    expect(broadcastVerdict(deal, 3)).not.toMatch(/\d/);
  });

  it('gives every tier a rating it was signed to deliver', () => {
    for (let i = 1; i < BROADCASTERS.length; i++) {
      expect(BROADCASTERS[i]!.expectedRating).toBeGreaterThan(BROADCASTERS[i - 1]!.expectedRating);
    }
  });

  it('is nothing at all with no deals', () => {
    expect(weeklyBroadcastIncome(null, [], 0, settings)).toBe(0);
  });

  it('dwarfs the gate at every tier, which is why losing one hurts', () => {
    for (const b of BROADCASTERS) expect(b.weeklyFee).toBeGreaterThan(5_000);
    expect(SPONSORS.every((s) => s.weeklyFee > 0)).toBe(true);
  });
});
