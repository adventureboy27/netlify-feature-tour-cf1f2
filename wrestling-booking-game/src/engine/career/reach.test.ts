import { describe, expect, it } from 'vitest';
import {
  absenceDecay,
  cardDrawIn,
  homeAdvantage,
  isHometown,
  localStanding,
  popularityIn,
  reachLabel,
  reachOf,
  setLocal,
  strongholds,
  workingGain,
} from './reach';
import { defaultWorldSettings } from '../world/settings';
import { generateWrestlers } from '../generate/wrestler';
import { rngFromSeed } from '../rng';
import type { Wrestler } from '../types';

const settings = defaultWorldSettings();
const HOME = 'territory-home';
const AWAY = 'territory-away';

function person(over: Partial<Wrestler> = {}, seed = 'reach'): Wrestler {
  const [w] = generateWrestlers(rngFromSeed(seed), 1);
  return { ...w!, popularity: 50, homeTerritoryId: HOME, regionalPopularity: {}, ...over };
}

describe('a town they have never worked', () => {
  it('still knows the name, because word travels', () => {
    const w = person({ popularity: 80 });
    expect(localStanding(w, AWAY, settings)).toBeGreaterThan(0);
    expect(localStanding(w, AWAY, settings)).toBeLessThan(w.popularity);
  });

  it('knows a big name better than a small one', () => {
    expect(localStanding(person({ popularity: 90 }), AWAY, settings)).toBeGreaterThan(
      localStanding(person({ popularity: 20 }), AWAY, settings),
    );
  });

  it('gives a hometown a head start over anywhere else', () => {
    const w = person({ popularity: 40 });
    expect(isHometown(w, HOME)).toBe(true);
    expect(localStanding(w, HOME, settings)).toBeGreaterThan(localStanding(w, AWAY, settings));
  });
});

describe('what somebody is worth in a given town', () => {
  it('is better at home than their national number, and worse in a strange town', () => {
    const w = person({ popularity: 50 });
    expect(homeAdvantage(w, HOME, settings)).toBeGreaterThan(0);
    expect(homeAdvantage(w, AWAY, settings)).toBeLessThan(0);
  });

  it('lets a local hero out-draw a bigger name in his own building', () => {
    // The whole point of a territory. The local man is 25 points behind
    // nationally and still the better draw at home.
    const hero = person({ popularity: 45 }, 'hero');
    setLocal(hero, HOME, 95);
    const star = person({ popularity: 70, homeTerritoryId: 'territory-elsewhere' }, 'star');
    expect(popularityIn(hero, HOME, settings)).toBeGreaterThan(popularityIn(star, HOME, settings));
  });

  it('still lets the bigger name win everywhere the local man has not worked', () => {
    const hero = person({ popularity: 45 }, 'hero');
    setLocal(hero, HOME, 95);
    const star = person({ popularity: 70, homeTerritoryId: 'territory-elsewhere' }, 'star');
    expect(popularityIn(star, AWAY, settings)).toBeGreaterThan(popularityIn(hero, AWAY, settings));
  });

  it('never runs off the ends of the scale', () => {
    const huge = person({ popularity: 100 });
    setLocal(huge, HOME, 100);
    expect(popularityIn(huge, HOME, settings)).toBeLessThanOrEqual(100);
    const nobody = person({ popularity: 0 });
    expect(popularityIn(nobody, AWAY, settings)).toBeGreaterThanOrEqual(0);
  });
});

describe('working a town', () => {
  it('builds you there, and a good match builds you faster', () => {
    const w = person();
    expect(workingGain(w, AWAY, 90, settings)).toBeGreaterThan(workingGain(w, AWAY, 20, settings));
    expect(workingGain(w, AWAY, 20, settings)).toBeGreaterThan(0);
  });

  it('is worth more at home, from the same standing', () => {
    // Compared like for like. Measured across differing standings the home
    // bonus loses to the saturation term — which is correct, because you have
    // less room to grow somewhere you are already over — so the bonus has to
    // be isolated to be asserted at all.
    const home = person({}, 'h');
    const away = person({}, 'h');
    setLocal(home, HOME, 40);
    setLocal(away, AWAY, 40);
    expect(workingGain(home, HOME, 60, settings)).toBeGreaterThan(workingGain(away, AWAY, 60, settings));
  });

  it('has less left to give in a town somebody already owns', () => {
    const w = person({ popularity: 30 });
    setLocal(w, AWAY, 20);
    const early = workingGain(w, AWAY, 70, settings);
    setLocal(w, AWAY, 90);
    expect(workingGain(w, AWAY, 70, settings)).toBeLessThan(early);
  });

  it('moves the needle further in a town that has never seen you', () => {
    const fresh = person({ popularity: 30 }, 'fresh');
    const saturated = person({ popularity: 30 }, 'sat');
    setLocal(saturated, AWAY, 95);
    expect(workingGain(fresh, AWAY, 70, settings)).toBeGreaterThan(
      workingGain(saturated, AWAY, 70, settings),
    );
  });
});

describe('staying away', () => {
  it('costs you in a town you built and then abandoned', () => {
    const w = person({ popularity: 40 });
    setLocal(w, AWAY, 90);
    expect(absenceDecay(w, AWAY, settings)).toBeGreaterThan(0);
  });

  it('never takes you below what being famous carries', () => {
    // You cannot be forgotten somewhere while you are a name everywhere.
    const star = person({ popularity: 95 });
    const floor = star.popularity * settings.reachUnseenShare;
    setLocal(star, AWAY, floor);
    expect(absenceDecay(star, AWAY, settings)).toBe(0);
  });

  it('takes months rather than weeks — a town does not forget you overnight', () => {
    const w = person({ popularity: 20 });
    setLocal(w, AWAY, 90);
    let standing = 90;
    let weeks = 0;
    while (standing > w.popularity * settings.reachUnseenShare + 1 && weeks < 500) {
      setLocal(w, AWAY, standing);
      standing -= absenceDecay(w, AWAY, settings);
      weeks += 1;
    }
    expect(weeks).toBeGreaterThan(26);
  });
});

describe('how far a name carries', () => {
  it('calls a big enough name national wherever they have been', () => {
    expect(reachOf(person({ popularity: 90 }), settings)).toBe('national');
  });

  it('calls somebody over in a handful of towns a regional draw', () => {
    const w = person({ popularity: 40 });
    setLocal(w, 't1', 70);
    setLocal(w, 't2', 70);
    setLocal(w, 't3', 70);
    expect(reachOf(w, settings)).toBe('regional');
  });

  it('calls somebody over in one town a local draw', () => {
    const w = person({ popularity: 40 });
    setLocal(w, 't1', 70);
    expect(reachOf(w, settings)).toBe('local');
  });

  it('says plainly when nobody has seen them', () => {
    expect(reachOf(person({ popularity: 20 }), settings)).toBe('unknown');
  });

  it('says all four in words, never a number', () => {
    for (const reach of ['national', 'regional', 'local', 'unknown'] as const) {
      expect(reachLabel(reach)).not.toMatch(/\d/);
      expect(reachLabel(reach).length).toBeGreaterThan(8);
    }
  });

  it('lists the towns somebody actually owns, strongest first', () => {
    const w = person({ popularity: 30 });
    setLocal(w, 't1', 60);
    setLocal(w, 't2', 90);
    setLocal(w, 't3', 10);
    expect(strongholds(w, settings).map((s) => s.territoryId)).toEqual(['t2', 't1']);
  });
});

describe('what a card is worth in the town it is actually in', () => {
  it('reads higher at home than on the road, for the same card', () => {
    const cast = [person({}, 'a'), person({}, 'b'), person({}, 'c')].map((w) => ({
      ...w,
      homeTerritoryId: HOME,
    }));
    expect(cardDrawIn(cast, HOME, settings)).toBeGreaterThan(cardDrawIn(cast, AWAY, settings));
  });

  it('is nothing for a card with nobody on it', () => {
    expect(cardDrawIn([], HOME, settings)).toBe(0);
  });
});

describe('everybody comes from somewhere', () => {
  it('gives a generated roster real hometowns, spread across the map', () => {
    // The field existed from the beginning and held the string
    // 'territory-unassigned' for every wrestler ever made.
    const towns = ['t1', 't2', 't3', 't4', 't5'];
    const roster = generateWrestlers(rngFromSeed('towns'), 30, { homeTerritoryIds: towns });
    for (const w of roster) {
      expect(towns).toContain(w.homeTerritoryId);
      expect(w.regionalPopularity).toEqual({});
    }
    expect(new Set(roster.map((w) => w.homeTerritoryId)).size).toBeGreaterThan(1);
  });
});
