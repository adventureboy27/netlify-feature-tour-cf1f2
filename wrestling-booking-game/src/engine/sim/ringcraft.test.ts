// Ring intelligence.
//
// Two things the sim could not previously express, and the tests are written
// as those two things rather than as the arithmetic underneath:
//
//   Somebody who knows what they are doing can make a limited opponent look
//   like their best night. Before this, match quality was a mean, so a bad
//   worker dragged a good one down by exactly the same amount however good the
//   good one was — and there was never a reason to put your best technician
//   opposite the person who needed him.
//
//   And a match can go wrong for a reason. A blown spot is not somebody being
//   bad; it is somebody being lost.

import { describe, expect, it } from 'vitest';
import {
  carried,
  carryLine,
  carryStrength,
  likeabilityLabel,
  ringcraftLabel,
  rollBotch,
  type Worker,
} from './ringcraft';
import { defaultWorldSettings } from '../world/settings';
import { rngFromSeed } from '../rng';

const settings = defaultWorldSettings();

function worker(over: Partial<Worker> = {}): Worker {
  return { id: 'w1', name: 'Somebody', ringIQ: 50, skill: 50, stamina: 60, health: 100, ...over };
}

const GENERAL = worker({ id: 'bret', name: 'Bret', ringIQ: 95 });
const LIMITED = worker({ id: 'lump', name: 'Lump', ringIQ: 25 });
const ORDINARY = worker({ id: 'hand', name: 'Hand', ringIQ: 55 });

describe('who can carry anybody', () => {
  it('is nobody, for most of a roster', () => {
    expect(carryStrength(LIMITED, settings)).toBe(0);
    expect(carryStrength(ORDINARY, settings)).toBe(0);
  });

  it('is the people who can genuinely work, and it has a ceiling', () => {
    expect(carryStrength(GENERAL, settings)).toBeGreaterThan(0);
    expect(carryStrength(worker({ ringIQ: 100 }), settings)).toBeLessThanOrEqual(settings.carryMax);
  });
});

describe('carrying a match', () => {
  it('drags a limited opponent up toward the man who can work', () => {
    const out = carried([GENERAL, LIMITED], [80, 30], settings);
    expect(out.contributions[0]).toBe(80);
    expect(out.contributions[1]).toBeGreaterThan(30);
    expect(out.strongestId).toBe('bret');
  });

  it('is worth almost nothing between two people who can both go', () => {
    // The whole value is in the pairing. Two greats have nothing to carry.
    const mismatch = carried([GENERAL, LIMITED], [80, 30], settings);
    const evenly = carried([GENERAL, worker({ id: 'owen', ringIQ: 92 })], [80, 78], settings);
    expect(evenly.lift).toBeLessThan(mismatch.lift);
  });

  it('does nothing at all when nobody in it can work', () => {
    const out = carried([LIMITED, ORDINARY], [70, 20], settings);
    expect(out.contributions).toEqual([70, 20]);
    expect(out.lift).toBe(0);
    expect(out.strongestId).toBeNull();
  });

  it('picks the best worker, not the biggest contribution', () => {
    // The case it exists for: a technician opposite a star who cannot go. The
    // star's number is higher and the technician is the one holding it up.
    const out = carried([GENERAL, LIMITED], [40, 75], settings);
    expect(out.strongestId).toBe('bret');
    expect(out.contributions[0]).toBeGreaterThan(40);
    expect(out.contributions[1]).toBe(75);
  });

  it('keeps the order it was handed, so a caller can map straight back', () => {
    const out = carried([LIMITED, GENERAL], [30, 80], settings);
    expect(out.contributions[1]).toBe(80);
    expect(out.contributions[0]).toBeGreaterThan(30);
  });

  it('leaves a singles-shaped call with one worker alone', () => {
    expect(carried([GENERAL], [50], settings).contributions).toEqual([50]);
  });

  it('says so out loud when it was a real carry job', () => {
    expect(carryLine(GENERAL, LIMITED, 20, settings)).toContain('Bret');
    expect(carryLine(GENERAL, LIMITED, 20, settings)).toContain('Lump');
    // "Carried it slightly" is not a thing anybody says.
    expect(carryLine(GENERAL, LIMITED, 1, settings)).toBeNull();
  });
});

describe('blowing a spot', () => {
  /** How often, across many matches, with these people in there. */
  function rate(workers: Worker[], minutes = 15, runs = 600): number {
    let botches = 0;
    for (let i = 0; i < runs; i++) {
      if (rollBotch(rngFromSeed(`botch${i}`), workers, minutes, settings)) botches += 1;
    }
    return botches / runs;
  }

  it('happens to the people who get lost far more than to the people who do not', () => {
    expect(rate([LIMITED, LIMITED])).toBeGreaterThan(rate([GENERAL, GENERAL]) * 2);
  });

  it('happens more at the end of a long match than a short one', () => {
    expect(rate([ORDINARY, ORDINARY], 30)).toBeGreaterThan(rate([ORDINARY, ORDINARY], 6));
  });

  it('happens more to somebody working hurt and unfit', () => {
    const fresh = rate([worker({ ringIQ: 50, health: 100, stamina: 90 })]);
    const spent = rate([worker({ ringIQ: 50, health: 40, stamina: 25 })]);
    expect(spent).toBeGreaterThan(fresh);
  });

  it('is rare enough that a good card is not a comedy', () => {
    expect(rate([GENERAL, ORDINARY])).toBeLessThan(0.12);
  });

  it('names who blew it and says what the crowd saw', () => {
    // §0: a rating that dropped with no sentence behind it reads as the sim
    // glitching. Whoever lost their place is named.
    const found = Array.from({ length: 400 }, (_, i) =>
      rollBotch(rngFromSeed(`named${i}`), [LIMITED, GENERAL], 20, settings),
    ).find(Boolean);
    expect(found).toBeTruthy();
    expect(found!.text).toContain(found!.workerName);
    expect(found!.ratingCost).toBeGreaterThan(0);
  });

  it('blames the one most likely to be lost, not a random body', () => {
    const found = Array.from({ length: 400 }, (_, i) =>
      rollBotch(rngFromSeed(`blame${i}`), [LIMITED, GENERAL], 20, settings),
    ).filter(Boolean);
    expect(found.length).toBeGreaterThan(0);
    for (const botch of found) expect(botch!.workerId).toBe('lump');
  });

  it('hurts somebody sometimes, and costs more when it does', () => {
    const found = Array.from({ length: 900 }, (_, i) =>
      rollBotch(rngFromSeed(`hurt${i}`), [LIMITED], 25, settings),
    ).filter(Boolean);
    const nasty = found.filter((b) => b!.hurtSomebody);
    expect(nasty.length).toBeGreaterThan(0);
    expect(nasty.length).toBeLessThan(found.length);
    expect(nasty[0]!.ratingCost).toBeGreaterThan(settings.botchRatingCost);
  });

  it('never fires with nobody in the match', () => {
    expect(rollBotch(rngFromSeed('empty'), [], 15, settings)).toBeNull();
  });
});

describe('saying it in words', () => {
  it('never shows a number (§0)', () => {
    for (const iq of [5, 30, 50, 70, 90, 100]) {
      expect(ringcraftLabel({ ringIQ: iq }, settings)).not.toMatch(/\d/);
    }
    for (const liked of [5, 30, 50, 70, 90, 100]) {
      expect(likeabilityLabel({ likeability: liked }, settings)).not.toMatch(/\d/);
    }
  });

  it('runs top to bottom without a gap', () => {
    const said = [95, 65, 45, 10].map((iq) => ringcraftLabel({ ringIQ: iq }, settings));
    expect(new Set(said).size).toBe(4);
  });

  it('keeps the room’s opinion separate from the crowd’s', () => {
    // Charisma is the crowd. This is the car ride, and the wrestler the fans
    // adore who nobody will travel with is a real person.
    expect(likeabilityLabel({ likeability: 90 }, settings)).not.toMatch(/\b(he|him|his|she|her)\b/i);
    expect(likeabilityLabel({ likeability: 5 }, settings)).toContain('room');
  });
});
