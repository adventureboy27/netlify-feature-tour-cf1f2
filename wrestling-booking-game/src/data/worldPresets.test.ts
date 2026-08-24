import { describe, expect, it } from 'vitest';
import { WORLD_PRESET_INFO, presetInfo } from './worldPresets';
import { WORLD_PRESETS, worldSettingsFromPreset, defaultWorldSettings } from '../engine/world/settings';
import { bestFittingVenue, venueById } from './venues';
import { divisionSplit } from '../engine/generate/wrestler';
import { tagTeamCountFor } from '../engine/world/tagTeams';
import { computeDemand, potentialAudience, fairTicketPrice } from '../engine/economy/showBudget';
import { defaultShowSetup, createInitialWorld } from '../state/world';
import { askingRate } from '../engine/economy/contracts';
import { generateWrestlers } from '../engine/generate/wrestler';
import { generateFreeAgentPool } from '../engine/world/freeAgents';
import { rngFromSeed } from '../engine/rng';

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

// Backyard is a genuinely different shape of preset from the other four — a
// ten-person roster fails several of the assertions above outright (it is
// smaller than "a roster the reference genre would recognise" demands, and
// it opens in a venue none of the other four would ever be routed to). Per
// CLAUDE.md, that means re-expressing what's actually true of a deliberately
// tiny start in its own block, not lowering the bar the other four are held
// to. IDS above is left untouched on purpose.
describe('the backyard preset', () => {
  const s = worldSettingsFromPreset('backyard');

  it('hands the player almost nobody — two, signed, and split one and one', () => {
    // Nobody is handed a locker room here. Two arrive signed (enough for
    // crownOpeningChampions to have somebody to crown), and everybody else
    // the player described — the hopeful teenager, the fifty-something
    // doing this in the evenings, the washed-up one, the one nobody else
    // hires — lives in the free-agent pool, not on the payroll.
    expect(s.startingPlayerRosterSize).toBe(2);
    const women = divisionSplit(s.startingPlayerRosterSize!, s.womensRosterShare, s.womensDivisionFloor).filter(
      (g) => g === 'f',
    ).length;
    expect(women).toBe(1);
    expect(s.startingPlayerRosterSize! - women).toBe(1);
  });

  it('the free-agent pool, not the signed roster, is where the real cast lives', () => {
    // generateFreeAgentPool runs at its full, un-overridden size
    // (settings.freeAgentPoolSize) regardless of startingPlayerRosterSize —
    // this is the claim the old "ten wrestlers, five and five" test used to
    // make about the signed roster, re-expressed against what's actually
    // still true: a real, tag-capable, roughly even split, just in the pool
    // you hire from rather than the roster you're handed.
    const { wrestlers } = generateFreeAgentPool(rngFromSeed('backyard-pool-shape'), s);
    expect(wrestlers.length).toBe(s.freeAgentPoolSize);
    expect(wrestlers.length).toBeGreaterThanOrEqual(10);
    const women = wrestlers.filter((w) => w.gender === 'f').length;
    expect(women).toBeGreaterThanOrEqual(5);
    expect(wrestlers.length - women).toBeGreaterThanOrEqual(5);
    expect(tagTeamCountFor(wrestlers.length, s)).toBeGreaterThanOrEqual(3);
  });

  it('prices a manager off the same shrunk curve as everybody else', () => {
    // Found live, playing a fresh save: seedManagerTalent prices a
    // mouthpiece's wage off `feePerShow * managerTalentFeeToWage`, a flat,
    // per-show fee (data/ringsidePool.ts, $300-$1,400) that does not shrink
    // with the rest of this economy — left at the default 0.9, a top-tier
    // manager priced at $1,275/wk sat right next to $50/wk wrestlers.
    // managerTalentFeeToWage on the preset fixes it; this locks that a
    // manager in the pool never asks for wildly more than the most
    // expensive wrestler in it, not a specific number.
    const world = createInitialWorld(rngFromSeed(s.seed), s);
    const isManager = (fa: (typeof world.freeAgents)[number]) => world.wrestlers[fa.wrestlerId]?.role === 'manager';
    const managerAgents = world.freeAgents.filter(isManager);
    const wrestlerAgents = world.freeAgents.filter((fa) => !isManager(fa));
    expect(managerAgents.length).toBeGreaterThan(0);
    expect(wrestlerAgents.length).toBeGreaterThan(0);
    const maxWrestlerAsk = Math.max(...wrestlerAgents.map((fa) => fa.askingRate));
    for (const agent of managerAgents) {
      expect(agent.askingRate, agent.wrestlerId).toBeLessThanOrEqual(maxWrestlerAsk * 1.5);
    }
  });

  it('opens in the backyard, not wherever the algorithm would have picked', () => {
    const setup = defaultShowSetup(s);
    expect(setup.venueId).toBe('backyardRing');
    const venue = venueById(setup.venueId)!;
    expect(venue.capacity).toBeLessThan(bestFittingVenue(s.startingCompanyRating, 1).capacity);
  });

  it('is the lowest-cash, least-known, most-chaotic start of the five', () => {
    // Not a claim about how many weeks that cash actually lasts — CLAUDE.md
    // is explicit that balance claims like that get measured in a played
    // save (tools/probe.mjs), not baked into a unit test as a brittle
    // formula. This just locks the structural fact every other assertion in
    // this block depends on: backyard is genuinely the bottom of the ladder.
    const base = defaultWorldSettings();
    for (const other of ['territoryDays', 'standard', 'bigMoney', 'sinkOrSwim'] as const) {
      expect(s.startingCash, other).toBeLessThan(worldSettingsFromPreset(other).startingCash);
    }
    expect(s.startingCompanyRating).toBeLessThan(base.startingCompanyRating);
    expect(s.startingTerritoryFollowing).toBeLessThan(base.startingTerritoryFollowing);
  });

  it('pays a typical roster in pocket change, not a wage', () => {
    // Nobody here is making a living at this — see contractBaseWeeklyRate
    // and contractRateRange on the preset itself, and dayJobWageThreshold
    // in defaultWorldSettings. Checked against the *other* four presets'
    // own settings, not a hardcoded number, so this stays honest if either
    // curve is retuned later.
    const roster = generateWrestlers(rngFromSeed('backyard-pay-check'), 200);
    const backyardAsks = roster.map((wr) => askingRate(wr, s));
    const standardAsks = roster.map((wr) => askingRate(wr, worldSettingsFromPreset('standard')));
    const mean = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / xs.length;
    expect(mean(backyardAsks)).toBeLessThan(mean(standardAsks) / 4);

    // And the point of pricing it this low: most of a typical backyard
    // roster actually clears into day-job territory (see misfortune.ts's
    // rollDayJobAbsence), where a normal promotion's roster never would.
    const belowThreshold = backyardAsks.filter((ask) => ask < s.dayJobWageThreshold).length;
    expect(belowThreshold).toBeGreaterThan(roster.length * 0.5);
  });
});
