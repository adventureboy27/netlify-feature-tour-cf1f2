import { describe, it, expect } from 'vitest';
import {
  followingOf,
  followingGain,
  followingDecay,
  territoryFit,
  isInvasion,
  invasionDamage,
  claimsTerritory,
  readCardTraits,
  venueFitsTerritory,
  strongestTerritory,
  type CardTraits,
} from './territories';
import { TERRITORIES, createTerritories, territoryDefinitionById } from '../../data/territories';
import { defaultWorldSettings } from './settings';
import type { Territory, Wrestler } from '../types';

const settings = defaultWorldSettings();

let nextId = 0;
function person(over: Partial<Wrestler> = {}): Wrestler {
  nextId += 1;
  return {
    id: `w${nextId}`,
    name: `Wrestler ${nextId}`,
    alignment: 50,
    popularity: 50,
    gender: 'm',
    style: 'bruiser',
    ...over,
  } as unknown as Wrestler;
}

function town(over: Partial<Territory> = {}): Territory {
  return {
    id: 't1',
    name: 'Somewhere',
    capacity: 5000,
    revenueMult: 1,
    preferenceWeights: {},
    following: {},
    ownerPromotionId: null,
  climate: 'temperate',
    ...over,
  };
}

const noTraits: CardTraits = {
  faces: 0,
  heels: 0,
  hardcore: 0,
  technical: 0,
  highFlying: 0,
  womensWrestling: 0,
  longMatches: 0,
  starPower: 0,
};

describe('the map', () => {
  it('is twelve territories', () => {
    expect(TERRITORIES).toHaveLength(12);
  });

  it('has no duplicate ids or names', () => {
    expect(new Set(TERRITORIES.map((t) => t.id)).size).toBe(12);
    expect(new Set(TERRITORIES.map((t) => t.name)).size).toBe(12);
  });

  it('keeps every territory inside the ranges the spec sets', () => {
    for (const t of TERRITORIES) {
      expect(t.capacity).toBeGreaterThanOrEqual(2000);
      expect(t.capacity).toBeLessThanOrEqual(52000);
      expect(t.revenueMult).toBeGreaterThanOrEqual(0.8);
      expect(t.revenueMult).toBeLessThanOrEqual(1.4);
      for (const weight of Object.values(t.preferenceWeights)) {
        expect(weight).toBeGreaterThanOrEqual(-1);
        expect(weight).toBeLessThanOrEqual(1);
      }
    }
  });

  it('gives every town an opinion — something it loves and something it will not sit through', () => {
    // A territory that likes everything a little is one the player never
    // thinks about, which is the whole point of the system.
    for (const t of TERRITORIES) {
      const weights = Object.values(t.preferenceWeights);
      expect(weights.some((w) => w > 0)).toBe(true);
      expect(weights.some((w) => w < 0)).toBe(true);
    }
  });

  it('starts a save with nobody over anywhere and nobody owning anything', () => {
    const map = createTerritories();
    expect(map).toHaveLength(12);
    for (const t of map) {
      expect(t.ownerPromotionId).toBeNull();
      expect(followingOf(t, 'player')).toBe(0);
    }
  });

  it('is findable by id', () => {
    expect(territoryDefinitionById('ironbeltCity')?.name).toBe('Ironbelt City');
    expect(territoryDefinitionById('nowhere')).toBeUndefined();
  });
});

describe('following', () => {
  it('is earned by the show, not by showing up', () => {
    expect(followingGain(5, settings)).toBeGreaterThan(followingGain(1, settings));
  });

  it('pivots on the neutral line: nothing moves at it, and a real disaster costs you standing there', () => {
    // Without this, a promotion parked in its home town forever only ever
    // gained following (decay only bites towns you did NOT run in that
    // week), so it saturated permanently and a bad stretch had nothing left
    // to erode — the demand multiplier stayed pinned at its ceiling no
    // matter how the shows actually went. A below-neutral show has to lose
    // ground for that link to mean anything.
    expect(followingGain(settings.territoryFollowingNeutralStars, settings)).toBe(0);
    expect(followingGain(0, settings)).toBeLessThan(0);
    expect(followingGain(5, settings)).toBeGreaterThan(0);
  });

  it('drains every week you are not there', () => {
    expect(followingDecay(settings)).toBeGreaterThan(0);
  });

  it('a great night is worth several weeks away; a bad one is worth none at all', () => {
    expect(followingGain(5, settings)).toBeGreaterThan(followingDecay(settings) * 4);
    expect(followingGain(1, settings)).toBeLessThan(followingDecay(settings) * 2);
  });
});

describe('what a town wants', () => {
  it('rewards a card that gives them what they came for', () => {
    const hardcoreTown = town({ preferenceWeights: { hardcore: 0.8 } });
    const fit = territoryFit(hardcoreTown, { ...noTraits, hardcore: 1 }, settings);
    expect(fit).toBeGreaterThan(0);
  });

  it('punishes a card that gives them what they do not want', () => {
    const hatesHardcore = town({ preferenceWeights: { hardcore: -0.8 } });
    expect(territoryFit(hatesHardcore, { ...noTraits, hardcore: 1 }, settings)).toBeLessThan(0);
  });

  it('is neutral about a card that simply does not engage their taste', () => {
    const opinionated = town({ preferenceWeights: { hardcore: 0.8, technical: -0.5 } });
    expect(territoryFit(opinionated, noTraits, settings)).toBe(0);
  });

  it('makes the same card play differently in two towns', () => {
    const traits = { ...noTraits, hardcore: 1, technical: 0 };
    const parish = town({ preferenceWeights: { hardcore: 0.8, technical: -0.4 } });
    const oldSchool = town({ preferenceWeights: { technical: 0.7, hardcore: -0.6 } });
    expect(territoryFit(parish, traits, settings)).toBeGreaterThan(territoryFit(oldSchool, traits, settings));
  });

  it('nets out a card that gives them one thing they love and one they hate', () => {
    const mixed = town({ preferenceWeights: { hardcore: 0.5, technical: -0.5 } });
    expect(territoryFit(mixed, { ...noTraits, hardcore: 1, technical: 1 }, settings)).toBe(0);
  });
});

describe('reading a card', () => {
  it('reads what was booked, not what the promotion calls itself', () => {
    const traits = readCardTraits(
      [
        { participants: [person({ style: 'technical' }), person({ style: 'submission' })], violenceLevel: 0, lengthMinutes: 25 },
        { participants: [person({ style: 'oldSchool' }), person({ style: 'technical' })], violenceLevel: 0, lengthMinutes: 25 },
      ],
      settings,
    );
    expect(traits.technical).toBe(1);
    expect(traits.hardcore).toBe(0);
    expect(traits.longMatches).toBe(1);
  });

  it('measures the women s share of the card', () => {
    const traits = readCardTraits(
      [{ participants: [person({ gender: 'f' }), person({ gender: 'f' }), person(), person()], violenceLevel: 0, lengthMinutes: 10 }],
      settings,
    );
    expect(traits.womensWrestling).toBe(0.5);
  });

  it('takes star power from the biggest name on the show', () => {
    const traits = readCardTraits(
      [{ participants: [person({ popularity: 20 }), person({ popularity: 90 })], violenceLevel: 0, lengthMinutes: 10 }],
      settings,
    );
    expect(traits.starPower).toBeCloseTo(0.9);
  });

  it('copes with an empty card', () => {
    expect(readCardTraits([], settings).starPower).toBe(0);
    expect(readCardTraits([{ participants: [], violenceLevel: 0, lengthMinutes: 0 }], settings).starPower).toBe(0);
  });
});

describe('who holds a town', () => {
  it('is nobody, until somebody draws a real house', () => {
    expect(claimsTerritory(undefined, settings.territoryClaimMinimumAttendance - 1, settings)).toBe(false);
    expect(claimsTerritory(undefined, settings.territoryClaimMinimumAttendance, settings)).toBe(true);
  });

  it('changes hands only by beating the record that holds it', () => {
    const record = { territoryId: 't1', promotionId: 'rival', attendance: 4000, week: 10 };
    expect(claimsTerritory(record, 3999, settings)).toBe(false);
    expect(claimsTerritory(record, 4000, settings)).toBe(false);
    expect(claimsTerritory(record, 4001, settings)).toBe(true);
  });

  it('knows an invasion from a home game', () => {
    expect(isInvasion(town({ ownerPromotionId: 'rival' }), 'player')).toBe(true);
    expect(isInvasion(town({ ownerPromotionId: 'player' }), 'player')).toBe(false);
    expect(isInvasion(town({ ownerPromotionId: null }), 'player')).toBe(false);
  });

  it('makes an invasion cost the holder something', () => {
    expect(invasionDamage(4, settings)).toBeGreaterThan(invasionDamage(1, settings));
  });
});

describe('picking somewhere to run', () => {
  it('will not put a stadium in a village', () => {
    expect(venueFitsTerritory(18000, 2400)).toBe(false);
    expect(venueFitsTerritory(900, 2400)).toBe(true);
  });

  it('finds where a promotion is most over', () => {
    const map = [
      town({ id: 'a', following: { player: 10 } }),
      town({ id: 'b', following: { player: 60 } }),
      town({ id: 'c', following: { player: 40, rival: 90 } }),
    ];
    expect(strongestTerritory(map, 'player')?.id).toBe('b');
    expect(strongestTerritory(map, 'rival')?.id).toBe('c');
  });
});
