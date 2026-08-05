import { describe, it, expect } from 'vitest';
import {
  managerEffect,
  managerFit,
  refereeEffect,
  guestRefereeEffect,
  guestRefereeIsLegal,
  ringsideTotals,
} from './ringside';
import { MANAGERS, REFEREES, managerById, refereeById, cheapestReferee } from '../../data/ringsidePool';
import { defaultWorldSettings } from '../world/settings';
import { generateWrestler } from '../generate/wrestler';
import { rngFromSeed } from '../rng';
import type { Wrestler } from '../types';

const settings = defaultWorldSettings();
const w = (over: Partial<Wrestler> = {}): Wrestler => ({ ...generateWrestler(rngFromSeed('r'), new Set()), ...over });

const talker = w({ charisma: 95, popularity: 60 });
const monster = w({ charisma: 12, popularity: 60 });

describe('the manager pool', () => {
  it('offers a real spread of price and ability', () => {
    const fees = MANAGERS.map((m) => m.feePerShow);
    expect(MANAGERS.length).toBeGreaterThanOrEqual(10);
    expect(Math.max(...fees)).toBeGreaterThan(Math.min(...fees) * 3);
  });

  it('charges more for the better talkers', () => {
    const best = [...MANAGERS].sort((a, b) => b.micWork - a.micWork)[0]!;
    const worst = [...MANAGERS].sort((a, b) => a.micWork - b.micWork)[0]!;
    expect(best.feePerShow).toBeGreaterThan(worst.feePerShow);
  });

  it('finds managers by id', () => {
    expect(managerById('mgr-slick')).toBeDefined();
    expect(managerById('nope')).toBeUndefined();
  });
});

describe('what a manager is worth', () => {
  const slick = managerById('mgr-cornelius')!;

  it('always adds something to the match itself', () => {
    expect(managerEffect(slick, talker, settings).ratingBonus).toBeGreaterThan(0);
  });

  it('helps somebody who cannot talk far more than somebody who can', () => {
    // The whole design: a mouthpiece transforms a silent monster and is money
    // wasted on a great promo.
    const forMonster = managerEffect(slick, monster, settings).clientPopularityMultiplier;
    const forTalker = managerEffect(slick, talker, settings).clientPopularityMultiplier;
    expect(forMonster).toBeGreaterThan(forTalker);
    expect(forMonster).toBeGreaterThan(1);
  });

  it('carries a cost that is not money — the client builds less on their own', () => {
    expect(managerEffect(slick, monster, settings).selfMadePenalty).toBeGreaterThan(0);
  });

  it('makes a devious manager more likely to get involved in the finish', () => {
    const crook = managerById('mgr-slick')!;
    const straight = managerById('mgr-sarge')!;
    expect(managerEffect(crook, monster, settings).interferenceWeight).toBeGreaterThan(
      managerEffect(straight, monster, settings).interferenceWeight,
    );
  });

  it('says in words whether the pairing is worth it', () => {
    expect(managerFit(slick, monster, settings)).toBe('Exactly what they need');
    expect(managerFit(slick, talker, settings)).toBe('Wasted on them');
  });
});

describe('referees as characters', () => {
  it('ships a spread from unbuyable to entirely purchasable', () => {
    expect(REFEREES.length).toBeGreaterThanOrEqual(10);
    expect(Math.min(...REFEREES.map((r) => r.bendable))).toBeLessThan(15);
    expect(Math.max(...REFEREES.map((r) => r.bendable))).toBeGreaterThan(80);
  });

  it('makes a good official a small positive and a bad one a small negative', () => {
    const good = refereeById('ref-hollis')!;
    const bad = refereeById('ref-whitfield')!;
    expect(refereeEffect(good, settings).ratingBonus).toBeGreaterThan(0);
    expect(refereeEffect(bad, settings).ratingBonus).toBeLessThan(0);
  });

  it('produces more messy finishes with an incompetent official', () => {
    const good = refereeById('ref-hollis')!;
    const bad = refereeById('ref-tibbs')!;
    expect(refereeEffect(bad, settings).screwyFinishWeight).toBeGreaterThan(
      refereeEffect(good, settings).screwyFinishWeight,
    );
  });

  it('makes a bendable official the route to a bought finish', () => {
    const crooked = refereeById('ref-cade')!;
    const straight = refereeById('ref-hollis')!;
    expect(refereeEffect(crooked, settings).interferenceWeight).toBeGreaterThan(
      refereeEffect(straight, settings).interferenceWeight,
    );
    // And you pay for it — the crooked one is dearer than the honest one.
    expect(crooked.feePerShow).toBeGreaterThan(straight.feePerShow);
  });

  it('always leaves an official you can afford', () => {
    expect(cheapestReferee().feePerShow).toBeLessThan(250);
  });
});

describe('guest referees', () => {
  const star = w({ popularity: 92 });
  const nobody = w({ popularity: 20 });

  it('lifts the match by star power', () => {
    expect(guestRefereeEffect(star, settings).ratingBonus).toBeGreaterThan(
      guestRefereeEffect(nobody, settings).ratingBonus,
    );
  });

  it('costs you the clean finish — that is the trade', () => {
    const guest = guestRefereeEffect(star, settings);
    const professional = refereeEffect(refereeById('ref-hollis')!, settings);
    expect(guest.screwyFinishWeight).toBeGreaterThan(professional.screwyFinishWeight);
    expect(guest.interferenceWeight).toBeGreaterThan(professional.interferenceWeight);
  });

  it('will not let somebody referee a match they are wrestling in', () => {
    expect(guestRefereeIsLegal('a', ['a', 'b'])).toBe(false);
    expect(guestRefereeIsLegal('c', ['a', 'b'])).toBe(true);
  });
});

describe('everything at ringside together', () => {
  const manager = managerById('mgr-cornelius')!;
  const referee = refereeById('ref-hollis')!;
  const star = w({ popularity: 92 });

  it('bills for every person out there', () => {
    const totals = ringsideTotals({
      managers: [{ manager, client: monster }],
      referee,
      guestReferee: null,
      settings,
    });
    expect(totals.cost).toBe(manager.feePerShow + referee.feePerShow);
  });

  it('costs nothing when nobody is at ringside', () => {
    const totals = ringsideTotals({ managers: [], referee: null, guestReferee: null, settings });
    expect(totals.cost).toBe(0);
    expect(totals.ratingBonus).toBe(0);
    expect(totals.screwyFinishWeight).toBe(1);
  });

  it('replaces the assigned official with the guest rather than paying both', () => {
    const totals = ringsideTotals({ managers: [], referee, guestReferee: star, settings });
    // The guest is a wrestler on your roster, not a fee at ringside.
    expect(totals.cost).toBe(0);
    expect(totals.screwyFinishWeight).toBeGreaterThan(1);
  });

  it('stacks managers on both sides', () => {
    const two = ringsideTotals({
      managers: [
        { manager, client: monster },
        { manager: managerById('mgr-duchess')!, client: talker },
      ],
      referee: null,
      guestReferee: null,
      settings,
    });
    const one = ringsideTotals({ managers: [{ manager, client: monster }], referee: null, guestReferee: null, settings });
    expect(two.ratingBonus).toBeGreaterThan(one.ratingBonus);
    expect(two.cost).toBeGreaterThan(one.cost);
  });

  it('never lets ringside run away with the match rating', () => {
    const everyone = ringsideTotals({
      managers: MANAGERS.map((m) => ({ manager: m, client: monster })),
      referee: null,
      guestReferee: star,
      settings,
    });
    expect(everyone.ratingBonus).toBeLessThanOrEqual(20);
  });
});
