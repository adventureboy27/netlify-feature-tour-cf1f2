// What a building does to a night.
//
// The properties worth locking are the ones that make the venue a decision
// rather than a seat count: the house's cut grows with the house, the room
// physically limits the rig, and there is a real price for having no roof.

import { describe, expect, it } from 'vitest';
import {
  houseTakeOfGate,
  houseTakeOfMerch,
  venueSettlement,
  productionInRoom,
  productionLeftOnTheTruck,
  roomFitLine,
  venueAtmosphereModifier,
  openAirWeather,
  venueFacilities,
  venueRigLine,
} from './venue';
import { PRODUCTION_LADDER, productionEffects, productionUpkeepPerShow } from './production';
import { VENUES, venueById } from '../../data/venues';
import { defaultWorldSettings } from '../world/settings';
import type { Venue } from '../types';

const settings = defaultWorldSettings();
const gym = venueById('schoolGym')!;
const arena = venueById('majorArena')!;
const fairground = venueById('countyFairground')!;
const wholeLadder = PRODUCTION_LADDER.map((r) => r.id);

describe('the landlord', () => {
  it('takes nothing in a hall that only wants the rent', () => {
    expect(houseTakeOfGate(40_000, gym)).toBe(0);
    expect(houseTakeOfMerch(9_000, gym)).toBe(0);
    expect(venueSettlement(40_000, 9_000, gym)).toBe(gym.rentalCost);
  });

  it('takes more the better you do, which is the point of a percentage', () => {
    const quiet = houseTakeOfGate(50_000, arena);
    const packed = houseTakeOfGate(400_000, arena);
    expect(packed).toBeGreaterThan(quiet * 7);
  });

  it('can take more than a small hall charges in rent outright', () => {
    // The reason a bigger room is not simply better once you can fill it.
    expect(houseTakeOfGate(300_000, arena)).toBeGreaterThan(gym.rentalCost * 50);
  });

  it('settles rent, load-in and both cuts as one number', () => {
    const total = venueSettlement(200_000, 30_000, arena);
    expect(total).toBe(
      arena.rentalCost + arena.loadIn + houseTakeOfGate(200_000, arena) + houseTakeOfMerch(30_000, arena),
    );
  });

  it('never hands money back on a night that took nothing', () => {
    expect(houseTakeOfGate(-5_000, arena)).toBe(0);
    expect(houseTakeOfMerch(-5_000, arena)).toBe(0);
  });
});

describe('what will physically go in the room', () => {
  it('loads the bottom of the ladder first, so the ring goes in before the screen', () => {
    const fitted = productionInRoom(wholeLadder, gym);
    expect(fitted[0]).toBe('matRopes');
    expect(fitted).not.toContain('screen');
  });

  it('leaves a company with a full rig most of it on the truck in a gym', () => {
    const stranded = productionLeftOnTheTruck(wholeLadder, gym);
    expect(stranded.length).toBeGreaterThan(wholeLadder.length / 2);
  });

  it('takes everything in the rooms at the top', () => {
    for (const id of ['sportsPalace', 'coliseum', 'domeStadium', 'openStadium']) {
      expect(productionLeftOnTheTruck(wholeLadder, venueById(id)!)).toEqual([]);
    }
  });

  it('never loads more than the room will hold', () => {
    const space = (ids: readonly string[]) =>
      ids.reduce((sum, id) => sum + (PRODUCTION_LADDER.find((r) => r.id === id)?.haulSpace ?? 0), 0);
    for (const venue of VENUES) {
      expect(space(productionInRoom(wholeLadder, venue))).toBeLessThanOrEqual(venue.productionCapacity);
    }
  });

  it('owns nothing, strands nothing', () => {
    expect(productionInRoom([], gym)).toEqual([]);
    expect(roomFitLine([], gym)).toBeNull();
  });

  it('names the biggest thing left on the truck, and does not list the rest', () => {
    // One clause, not a wall of text: every card on the venue page carries
    // this line and the reader has to be able to skim past it.
    const line = roomFitLine(wholeLadder, gym)!;
    expect(line).toMatch(/pyro rig/i);
    expect(line).not.toMatch(/\d/);
    expect(line.split(',').length).toBeLessThan(3);
  });

  it('names it alone when it is the only thing stranded', () => {
    // The coliseum takes everything, so take a room one rung short of it.
    const nearlyEverything = wholeLadder.slice(0, -1);
    const line = roomFitLine(wholeLadder, venueById('majorArena')!);
    expect(roomFitLine(nearlyEverything, venueById('majorArena')!)).toBeNull();
    expect(line).toBe('Your pyro rig will not fit in here.');
  });

  it('is quiet when the whole rig went in', () => {
    expect(roomFitLine(wholeLadder, venueById('coliseum')!)).toBeNull();
  });
});

describe('the room itself', () => {
  it('pays for a good room and charges for a bad one', () => {
    expect(venueAtmosphereModifier(venueById('bingoHall')!, settings)).toBeGreaterThan(0);
    expect(venueAtmosphereModifier(venueById('conventionHall')!, settings)).toBeLessThan(0);
  });

  it('lets a small hot room beat a big cold one on character alone', () => {
    // A bingo hall at 800 is a better room than a convention hall at 8,500,
    // and the game should be willing to say so.
    expect(venueAtmosphereModifier(venueById('bingoHall')!, settings)).toBeGreaterThan(
      venueAtmosphereModifier(venueById('conventionHall')!, settings),
    );
  });

  it('is worth less than the card — staging modifies a show, it cannot make one', () => {
    for (const venue of VENUES) {
      expect(Math.abs(venueAtmosphereModifier(venue, settings))).toBeLessThan(10);
    }
  });
});

describe('no roof', () => {
  it('leaves an indoor room exactly as the weather found it', () => {
    expect(openAirWeather(0.8, false, 'severe', venueById('civicArena')!, settings)).toEqual({
      draw: 0.8,
      cancelled: false,
    });
  });

  it('bites harder with nothing over the crowd', () => {
    const { draw } = openAirWeather(0.8, false, 'minor', fairground, settings);
    expect(draw).toBeLessThan(0.8);
  });

  it('takes the night off you outright once the weather is real', () => {
    expect(openAirWeather(0.6, false, 'notable', fairground, settings).cancelled).toBe(true);
    expect(openAirWeather(0.6, false, 'severe', fairground, settings).cancelled).toBe(true);
    expect(openAirWeather(0.6, false, 'catastrophe', fairground, settings).cancelled).toBe(true);
  });

  it('does not call off a field for a pretty sunset', () => {
    expect(openAirWeather(1, false, 'flavour', fairground, settings).cancelled).toBe(false);
  });

  it('leaves a fine night alone', () => {
    expect(openAirWeather(1, false, 'flavour', fairground, settings)).toEqual({ draw: 1, cancelled: false });
  });

  it('never empties the place completely — somebody always turns up', () => {
    const { draw } = openAirWeather(0, false, 'minor', fairground, settings);
    expect(draw).toBeGreaterThan(0);
  });

  it('cannot un-cancel a show that was already off', () => {
    expect(openAirWeather(1, true, null, fairground, settings).cancelled).toBe(true);
  });
});

describe('reading a room before you book it', () => {
  it('says what is unusual and stays quiet about what is not', () => {
    // A page where every room says the same three things teaches nobody
    // anything, so an ordinary hall has little to declare.
    expect(venueFacilities(venueById('unionHall')!, settings).length).toBeLessThan(3);
    expect(venueFacilities(venueById('casinoShowroom')!, settings).length).toBeGreaterThan(2);
  });

  it('warns nobody and states facts — §0', () => {
    for (const venue of VENUES) {
      for (const note of venueFacilities(venue, settings)) {
        expect(note).not.toMatch(/\d/);
        expect(note.toLowerCase()).not.toMatch(/should|careful|risk|beware|avoid/);
      }
    }
  });

  it('says the casino keeps the bar, because it does', () => {
    expect(venueFacilities(venueById('casinoShowroom')!, settings).join(' ')).toMatch(/bar is theirs/i);
  });

  it('says how much rig a room takes, in words', () => {
    expect(venueRigLine(gym)).toMatch(/very little/);
    expect(venueRigLine(venueById('coliseum')!)).toMatch(/whole/);
    for (const venue of VENUES) expect(venueRigLine(venue)).not.toMatch(/\d/);
  });
});

describe('every building in the game is a coherent one', () => {
  const field = (v: Venue, k: keyof Venue) => v[k] as number;

  it('never takes a share it does not have', () => {
    for (const v of VENUES) {
      expect(field(v, 'houseCut')).toBeGreaterThanOrEqual(0);
      expect(field(v, 'houseCut')).toBeLessThan(1);
      expect(field(v, 'merchCut')).toBeGreaterThanOrEqual(0);
      expect(field(v, 'merchCut')).toBeLessThan(1);
      expect(field(v, 'concessionsPerHead')).toBeGreaterThanOrEqual(0);
      expect(field(v, 'productionCapacity')).toBeGreaterThan(0);
      expect(field(v, 'loadIn')).toBeGreaterThanOrEqual(0);
    }
  });

  it('gives the smallest room enough space for the first thing you buy', () => {
    // Otherwise the opening purchase of the whole production ladder does
    // nothing on the night you make it.
    const first = PRODUCTION_LADDER[0]!;
    for (const v of VENUES) expect(v.productionCapacity).toBeGreaterThanOrEqual(first.haulSpace);
  });
});

describe('more gear is never worse gear', () => {
  // The sim is too noisy to read this off a running save — each week has a
  // different card — so it is asserted directly. Buying up the ladder must
  // never make a night worse in any room, and in a room too small to take the
  // new rung it must change precisely nothing.
  it('never lowers what a room delivers when you own more of the ladder', () => {
    for (const venue of VENUES) {
      let previous = -Infinity;
      for (let n = 0; n <= PRODUCTION_LADDER.length; n += 1) {
        const owned = PRODUCTION_LADDER.slice(0, n).map((r) => r.id);
        const fitted = productionInRoom(owned, venue);
        const rating = productionEffects(fitted).showRating;
        expect(rating, `${venue.name} at ${n} rungs`).toBeGreaterThanOrEqual(previous);
        previous = rating;
      }
    }
  });

  it('charges nothing extra for a rung the room cannot take', () => {
    const gymTakes = productionInRoom(['matRopes', 'ring', 'sound'], gym);
    expect(productionUpkeepPerShow(gymTakes)).toBe(
      productionUpkeepPerShow(productionInRoom(['matRopes'], gym)),
    );
  });
});
