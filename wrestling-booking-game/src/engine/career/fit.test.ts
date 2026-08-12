// The rule this file holds: the same wrestler is worth different things in
// different buildings, half of it for reasons you can read and half for
// reasons nobody can.

import { describe, expect, it } from 'vitest';
import { rngFromSeed } from '../rng';
import { defaultWorldSettings } from '../world/settings';
import { generateWrestler } from '../generate/wrestler';
import { computeAftermath } from '../sim/aftermath';
import { keenness } from '../economy/bidding';
import { PROMOTION_ARCHETYPES, styleProfileFor } from '../../data/promotionIdentity';
import type { Promotion, Wrestler } from '../types';
import { chemistry, fitLabel, fitsBetterThan, legibleFit, overnessIn, promotionFit } from './fit';

const settings = defaultWorldSettings();

function person(seed: string, over: Partial<Wrestler> = {}): Wrestler {
  return { ...generateWrestler(rngFromSeed(seed), new Set(), { currentYear: 2030 }), ...over };
}

function company(id: string, identity: Promotion['identity']): Promotion {
  return {
    id,
    name: id,
    identity,
    isPlayer: false,
    rating: 55,
    bankBalance: 2_000_000,
    rosterIds: [],
    titleIds: [],
    ownedTerritoryIds: [],
    homeTerritoryId: 't1',
    styleProfile: styleProfileFor(identity),
    bookingCredibility: 50,
    reputation: 50,
    hardcoreSaturation: 0,
    recentShowQuality: 50,
    weeksInTheRed: 0,
    closedWeek: null,
    ownerId: 'o',
    ownerPersonality: 'traditionalist',
    ppvCalendar: [],
  };
}

describe('the part nobody can explain', () => {
  it('is the same every time it is asked', () => {
    // A save reloaded six months later on a different browser has to produce
    // the same answer, so this is a hash and not a draw.
    for (const pair of [['w-1', 'p-1'], ['w-2', 'p-9'], ['someone', 'somewhere']] as const) {
      expect(chemistry(pair[0], pair[1])).toBe(chemistry(pair[0], pair[1]));
    }
  });

  it('is different for the same man in two buildings', () => {
    const here = chemistry('w-1', 'p-1');
    const there = chemistry('w-1', 'p-2');
    expect(here).not.toBeCloseTo(there, 2);
  });

  it('is different for two men in the same building', () => {
    expect(chemistry('w-1', 'p-1')).not.toBeCloseTo(chemistry('w-2', 'p-1'), 2);
  });

  it('uses the whole range and does not sit on one side of it', () => {
    // A signed-integer bug here would quietly bias every pairing in the game
    // toward one end and nothing would ever look obviously wrong.
    const draws = Array.from({ length: 4000 }, (_, i) => chemistry(`w-${i}`, `p-${i % 37}`));
    const mean = draws.reduce((a, b) => a + b, 0) / draws.length;
    expect(Math.abs(mean)).toBeLessThan(0.05);
    expect(Math.min(...draws)).toBeLessThan(-0.95);
    expect(Math.max(...draws)).toBeGreaterThan(0.95);
  });
});

describe('the part a booker can read', () => {
  it('rates a hardcore worker in a hardcore company over one in a technical company', () => {
    const bruiser = person('b', { style: 'hardcore', secondaryStyle: 'bruiser', skill: 40, charisma: 70 });
    expect(legibleFit(bruiser, 'hardcore', settings)).toBeGreaterThan(
      legibleFit(bruiser, 'technical', settings),
    );
  });

  it('rates the mat man the other way round', () => {
    const technician = person('t', { style: 'technical', secondaryStyle: 'submission', skill: 85, charisma: 40 });
    expect(legibleFit(technician, 'technical', settings)).toBeGreaterThan(
      legibleFit(technician, 'hardcore', settings),
    );
  });

  it('knows the difference between a company that sells wrestling and one that sells stars', () => {
    // Identical people apart from where their points are.
    const worker = person('w', { style: 'allRounder', secondaryStyle: undefined, skill: 90, charisma: 35 });
    const star = person('s', { style: 'allRounder', secondaryStyle: undefined, skill: 35, charisma: 90 });

    const workrateHouse = PROMOTION_ARCHETYPES.reduce((best, a) =>
      legibleFit(worker, a, settings) > legibleFit(worker, best, settings) ? a : best,
    );
    expect(legibleFit(worker, workrateHouse, settings)).toBeGreaterThan(
      legibleFit(star, workrateHouse, settings),
    );
  });

  it('does not read anything the player cannot see about the ceiling', () => {
    // The same man twice, differing only in what is really there. Fit is
    // about the room, not about how good he is.
    const base = person('same', { style: 'technical', skill: 70, charisma: 50 });
    const cannot: Wrestler = { ...base, talent: 20, hype: 20 };
    const can: Wrestler = { ...base, talent: 95, hype: 95 };
    expect(legibleFit(cannot, 'technical', settings)).toBe(legibleFit(can, 'technical', settings));
  });
});

describe('how over somebody can get here', () => {
  it('stays inside its stops however extreme the pairing', () => {
    for (let i = 0; i < 500; i++) {
      const w = person(`x-${i}`);
      const p = company(`p-${i}`, PROMOTION_ARCHETYPES[i % PROMOTION_ARCHETYPES.length]!);
      const fit = promotionFit(w, p, settings);
      expect(fit).toBeGreaterThanOrEqual(settings.fitFloor);
      expect(fit).toBeLessThanOrEqual(settings.fitCeiling);
    }
  });

  it('averages out to about one across the business', () => {
    // Otherwise this is not "fit", it is a global buff or nerf to everybody.
    const fits: number[] = [];
    for (let i = 0; i < 1500; i++) {
      const w = person(`m-${i}`);
      const p = company(`q-${i % 40}`, PROMOTION_ARCHETYPES[i % PROMOTION_ARCHETYPES.length]!);
      fits.push(promotionFit(w, p, settings));
    }
    const mean = fits.reduce((a, b) => a + b, 0) / fits.length;
    expect(Math.abs(mean - 1)).toBeLessThan(0.05);
  });

  it('makes somewhere the best place for somebody and somewhere the worst', () => {
    // The whole feature, stated once: for most people in the business there
    // is a real difference between the best room and the worst.
    let spreadEnough = 0;
    for (let i = 0; i < 300; i++) {
      const w = person(`s-${i}`);
      const fits = PROMOTION_ARCHETYPES.map((a, j) => promotionFit(w, company(`c-${j}`, a), settings));
      if (Math.max(...fits) - Math.min(...fits) >= 0.15) spreadEnough += 1;
    }
    // Measured: the spread between somebody's best room and their worst runs
    // 0.12 at the tenth percentile, 0.18 at the median and 0.26 at the
    // ninetieth — so a popularity-80 wrestler is worth about fourteen points
    // more in the right company than the wrong one, and twenty at the ends.
    expect(spreadEnough / 300).toBeGreaterThan(0.6);
  });

  it('turns an upper midcarder in one room into a main eventer in another', () => {
    const w = person('mover', { popularity: 80 });
    const fits = PROMOTION_ARCHETYPES.map((a, j) => ({ a, p: company(`h-${j}`, a) }));
    const best = fits.reduce((x, y) => (promotionFit(w, y.p, settings) > promotionFit(w, x.p, settings) ? y : x));
    const worst = fits.reduce((x, y) => (promotionFit(w, y.p, settings) < promotionFit(w, x.p, settings) ? y : x));
    expect(overnessIn(w, best.p, settings) - overnessIn(w, worst.p, settings)).toBeGreaterThan(10);
  });

  it('lets a rival see when somebody would suit them better', () => {
    const w = person('poach');
    const rooms = PROMOTION_ARCHETYPES.map((a, j) => company(`r-${j}`, a));
    const best = rooms.reduce((x, y) => (promotionFit(w, y, settings) > promotionFit(w, x, settings) ? y : x));
    const worst = rooms.reduce((x, y) => (promotionFit(w, y, settings) < promotionFit(w, x, settings) ? y : x));
    expect(fitsBetterThan(w, worst, best, settings)).toBe(true);
    expect(fitsBetterThan(w, best, worst, settings)).toBe(false);
  });
});

describe('what a match is worth, here', () => {
  function popularityFrom(w: Wrestler, promotion: Promotion | undefined, rating: number): number {
    const [change] = computeAftermath({
      participants: [w, person('other')],
      winnerIds: [w.id],
      finish: 'cleanPin',
      rating,
      stipulation: null,
      isMainEvent: false,
      promotion,
      settings,
    });
    return change!.popularity;
  }

  it('is worth more in a room that suits you than one that does not', () => {
    const w = person('worth', { popularity: 50, style: 'technical', secondaryStyle: 'submission', skill: 88, charisma: 40 });
    const suits = company('tech', 'technical');
    const does_not = company('death', 'hardcore');
    expect(popularityFrom(w, suits, 80)).toBeGreaterThan(popularityFrom(w, does_not, 80));
  });

  it('takes nothing off anybody the week they sign', () => {
    // Fit moves the target, not the number. A name is still a name on their
    // first night — they simply stop climbing short of what their work is
    // worth, or keep climbing past it.
    const star = person('star', { popularity: 88, skill: 40, charisma: 90, style: 'showman' });
    // The room he suits least, whatever that turns out to be — picked by
    // measurement rather than assumed, because the chemistry is not something
    // this test gets to choose either.
    const badRoom = PROMOTION_ARCHETYPES.map((a, j) => company(`bad-${j}`, a)).reduce((x, y) =>
      promotionFit(star, y, settings) < promotionFit(star, x, settings) ? y : x,
    );
    expect(promotionFit(star, badRoom, settings)).toBeLessThan(1);
    expect(star.popularity).toBe(88);
    // ...and the drift is downward from there, over months rather than weeks.
    expect(popularityFrom(star, badRoom, 60)).toBeLessThan(0);
    expect(popularityFrom(star, badRoom, 60)).toBeGreaterThan(-1);
  });

  it('does nothing at all when nobody said whose show it was', () => {
    const w = person('nobody', { popularity: 50 });
    expect(popularityFrom(w, undefined, 80)).toBe(popularityFrom(w, undefined, 80));
    // Same answer as fit switched off entirely.
    const off = computeAftermath({
      participants: [w, person('other')],
      winnerIds: [w.id],
      finish: 'cleanPin',
      rating: 80,
      stipulation: null,
      isMainEvent: false,
      promotion: company('x', 'technical'),
      settings: { ...settings, fitEnabled: false },
    });
    expect(off[0]!.popularity).toBe(popularityFrom(w, undefined, 80));
  });
});

describe('what the market can and cannot see', () => {
  it('makes companies want different people', () => {
    const brawler = person('br', { style: 'hardcore', secondaryStyle: 'bruiser', skill: 45, charisma: 75, popularity: 70 });
    const technician = person('tc', { style: 'technical', secondaryStyle: 'submission', skill: 88, charisma: 45, popularity: 70 });
    const deathmatch = company('dm', 'hardcore');
    const mat = company('mat', 'technical');

    expect(keenness(brawler, deathmatch, settings)).toBeGreaterThan(keenness(brawler, mat, settings));
    expect(keenness(technician, mat, settings)).toBeGreaterThan(keenness(technician, deathmatch, settings));
  });

  it('never lets a company bid on the chemistry', () => {
    // The room can watch a tape. It cannot know whether this particular man
    // happens to click in this particular building — which is what keeps a
    // correct-looking signing a bet rather than a checklist.
    const w = person('bet', { style: 'technical', skill: 80, charisma: 45, popularity: 70 });
    const a = company('a', 'technical');
    const b = company('b', 'technical');
    expect(chemistry(w.id, a.id)).not.toBeCloseTo(chemistry(w.id, b.id), 2);
    expect(keenness(w, a, settings)).toBe(keenness(w, b, settings));
  });
});

describe('what the sheet says about it', () => {
  it('speaks in words, never a number', () => {
    for (let i = 0; i < 200; i++) {
      const label = fitLabel(person(`l-${i}`), company(`z-${i % 9}`, PROMOTION_ARCHETYPES[i % PROMOTION_ARCHETYPES.length]!), settings);
      if (label) expect(label).not.toMatch(/\d/);
    }
  });

  it('says nothing at all about most people', () => {
    // Otherwise the one that matters is invisible.
    let silent = 0;
    for (let i = 0; i < 400; i++) {
      const label = fitLabel(person(`q-${i}`), company(`y-${i % 11}`, PROMOTION_ARCHETYPES[i % PROMOTION_ARCHETYPES.length]!), settings);
      if (label === null) silent += 1;
    }
    expect(silent / 400).toBeGreaterThan(0.3);
  });
});
