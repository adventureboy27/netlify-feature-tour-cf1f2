import { describe, expect, it } from 'vitest';
import { WORLD_PRESET_INFO, presetInfo } from './worldPresets';
import { WORLD_PRESETS, worldSettingsFromPreset, defaultWorldSettings } from '../engine/world/settings';
import { bestFittingVenue, venueById } from './venues';
import { divisionSplit } from '../engine/generate/wrestler';
import { tagTeamCountFor } from '../engine/world/tagTeams';
import { computeDemand, potentialAudience, fairTicketPrice } from '../engine/economy/showBudget';

const IDS = ['territoryDays', 'standard', 'bigMoney', 'sinkOrSwim'] as const;

describe('the world presets', () => {
  it('describes every preset the engine defines, and no others', () => {
    expect(WORLD_PRESET_INFO.map((p) => p.id).sort()).toEqual(Object.keys(WORLD_PRESETS).sort());
  });

  it('says something about each one', () => {
    for (const p of WORLD_PRESET_INFO) {
      expect(p.label.length, p.id).toBeGreaterThan(0);
      expect(p.blurb.length, p.id).toBeGreaterThan(20);
      expect(p.theSqueeze.length, p.id).toBeGreaterThan(20);
    }
  });

  it('falls back rather than throwing on an id it does not know', () => {
    // @ts-expect-error deliberately wrong, to prove the screen cannot crash
    expect(presetInfo('nonsense').id).toBe('standard');
  });
});

describe('the presets actually differ', () => {
  // The bug this locks: for months every preset moved starting cash and roster
  // size and nothing else, so all four opened in the same building at the same
  // ticket price and played the same first show. Cash turns out to matter very
  // little once the doors are open — the opening position does.
  const opening = (id: (typeof IDS)[number]) => {
    const s = worldSettingsFromPreset(id);
    const demand = computeDemand(
      s.startingCompanyRating,
      s.startingCompanyRating,
      s.startingCompanyRating,
      s,
      s.startingTerritoryFollowing,
    );
    const audience = potentialAudience(demand, s);
    return {
      venue: bestFittingVenue(s.startingCompanyRating, audience),
      price: Math.round(fairTicketPrice(demand, s)),
      audience,
      roster: s.startingRosterSize,
      cash: s.startingCash,
    };
  };

  it('starts each one in a different building', () => {
    const venues = IDS.map((id) => opening(id).venue.id);
    // Two of the four legitimately share the armoury — they are different
    // promotions of a similar size — but they must not all be the same room.
    expect(new Set(venues).size).toBeGreaterThan(1);
    expect(venues[2]).not.toBe(venues[3]); // big money is not sink or swim
  });

  it('draws wildly different opening houses', () => {
    const big = opening('bigMoney').audience;
    const small = opening('sinkOrSwim').audience;
    expect(big).toBeGreaterThan(small * 4);
  });

  it('never opens anybody in a room they cannot come close to filling', () => {
    for (const id of IDS) {
      const o = opening(id);
      expect(o.audience, id).toBeGreaterThan(o.venue.capacity * 0.5);
    }
  });

  it('gives every start more than one night in the bank', () => {
    // A preset the player cannot win is not a preset. Twelve wrestlers on $8k
    // folded by week nine playing perfectly, and twenty-four on $12k folded by
    // week eight — in both cases the bank was worth roughly a single show.
    for (const id of IDS) {
      const s = worldSettingsFromPreset(id);
      const o = opening(id);
      const venue = venueById(o.venue.id)!;
      const oneNight = Math.min(o.audience, venue.capacity) * o.price;
      expect(s.startingCash, id).toBeGreaterThan(oneNight);
    }
  });

  it('staffs both divisions everywhere, and the tag ranks with them', () => {
    // A women's championship needs a division, not two wrestlers taking turns.
    // Rolled per head at 22%, a small roster produced a two-woman division in
    // four seeds out of five.
    for (const id of IDS) {
      const s = worldSettingsFromPreset(id);
      const women = divisionSplit(s.startingRosterSize, s.womensRosterShare, s.womensDivisionFloor).filter(
        (g) => g === 'f',
      ).length;
      expect(women, id).toBeGreaterThanOrEqual(s.womensDivisionFloor);
      expect(s.startingRosterSize - women, id).toBeGreaterThanOrEqual(s.womensDivisionFloor);
      // And enough teams to have a division rather than one pairing.
      expect(tagTeamCountFor(s.startingRosterSize, s), id).toBeGreaterThanOrEqual(3);
    }
  });

  it('carries a roster the reference genre would recognise', () => {
    // Five championships, two divisions and a tag ranking do not fit on
    // fourteen people. Wrestling Empire runs 30-35.
    for (const id of IDS) {
      const s = worldSettingsFromPreset(id);
      expect(s.startingRosterSize, id).toBeGreaterThanOrEqual(24);
    }
    expect(worldSettingsFromPreset('standard').startingRosterSize).toBeGreaterThanOrEqual(30);
  });

  it('leans on the owner rather than the bank where money cannot bite', () => {
    // A promotion drawing four thousand people prints money under any tuning
    // that leaves the small starts playable, so big money's squeeze is the
    // owner's patience instead.
    const big = worldSettingsFromPreset('bigMoney');
    const territory = worldSettingsFromPreset('territoryDays');
    const base = defaultWorldSettings();
    expect(big.mandateStrikesBeforeFiring).toBeLessThan(base.mandateStrikesBeforeFiring);
    expect(territory.mandateStrikesBeforeFiring).toBeGreaterThan(base.mandateStrikesBeforeFiring);
  });
});
