import { describe, it, expect } from 'vitest';
import {
  managerEffect,
  managerFit,
  refereeEffect,
  guestRefereeEffect,
  guestRefereeIsLegal,
  ringsideTotals,
  refereeAgenda,
  guestRefereeHealthCost,
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
    // The referee is not in here: they are billed once per show by the
    // caller, not once per match.
    expect(totals.cost).toBe(manager.feePerShow);
  });

  it('is neutral at ringside when nobody has been named', () => {
    // Not because it is free — because by bell time somebody is always
    // counting. The store drafts a wrestler, and the consequence of not
    // hiring an official is that person's agenda, not chaos.
    const totals = ringsideTotals({ managers: [], referee: null, guestReferee: null, settings });
    expect(totals.cost).toBe(0);
    expect(totals.hasOfficial).toBe(false);
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


describe('what a referee costs', () => {
  const settings = defaultWorldSettings();

  it('bills managers per appearance and referees not at all', () => {
    // A referee works the whole card for one night's pay, so the caller
    // totals them once per show. Billing them here charged one official six
    // times on a six-match card, which is what made hiring anybody absurd.
    const totals = ringsideTotals({
      managers: [{ manager: MANAGERS[0]!, client: w() }],
      referee: REFEREES[0]!,
      guestReferee: null,
      settings,
    });
    expect(totals.cost).toBe(MANAGERS[0]!.feePerShow);
  });

  it('is cheaper to hire an official than a mouthpiece', () => {
    expect(cheapestReferee().feePerShow).toBeLessThan(
      MANAGERS.reduce((cheap, m) => Math.min(cheap, m.feePerShow), Infinity),
    );
  });
});

describe('a wrestler in the shirt', () => {
  const settings = defaultWorldSettings();
  const face = (over: Partial<Wrestler> = {}) => w({ alignment: 60, ...over });
  const heel = (over: Partial<Wrestler> = {}) => w({ alignment: -60, ...over });

  const agendaFor = (guest: Wrestler, competitors: { wrestler: Wrestler; side: number }[], over = {}) =>
    refereeAgenda({ guest, competitors, rivalIds: [], friendIds: [], enemyIds: [], settings, ...over });

  it('can still count to three — they are partial, not incompetent', () => {
    const effect = guestRefereeEffect(w({ popularity: 70 }), settings);
    expect(effect.decisiveFinishWeight).toBe(1);
    expect(effect.injuryMultiplier).toBe(1);
    // What they bring is drama and a guarantee that something happens.
    expect(effect.ratingBonus).toBeGreaterThan(0);
    expect(effect.screwyFinishWeight).toBeGreaterThan(1);
    expect(effect.interferenceWeight).toBeGreaterThan(1);
  });

  it('leans hardest against somebody they have live heat with', () => {
    const enemy = face();
    const other = face();
    const agenda = agendaFor(w(), [{ wrestler: enemy, side: 0 }, { wrestler: other, side: 1 }], {
      rivalIds: [enemy.id],
    });
    expect(agenda.favoursSide).toBe(1);
    expect(agenda.shift).toBe(settings.guestRefereeGrudgeShift);
    expect(agenda.reason).toContain('unfinished business');
  });

  it('puts a grudge above a friendship', () => {
    const enemy = face();
    const friend = face();
    const agenda = agendaFor(w(), [{ wrestler: enemy, side: 0 }, { wrestler: friend, side: 1 }], {
      rivalIds: [enemy.id],
      friendIds: [friend.id],
    });
    // Both point the same way here, but the reason given is the grudge.
    expect(agenda.favoursSide).toBe(1);
    expect(agenda.shift).toBe(settings.guestRefereeGrudgeShift);
  });

  it('will not count a friend out', () => {
    const friend = face();
    const stranger = face();
    const agenda = agendaFor(w(), [{ wrestler: friend, side: 0 }, { wrestler: stranger, side: 1 }], {
      friendIds: [friend.id],
    });
    expect(agenda.favoursSide).toBe(0);
    expect(agenda.reason).toContain('not going to count');
  });

  it('falls back on character when there is no history at all', () => {
    const crooked = agendaFor(heel(), [{ wrestler: heel(), side: 0 }, { wrestler: face(), side: 1 }]);
    expect(crooked.favoursSide).toBe(0);
    expect(crooked.shift).toBe(settings.guestRefereeAlignmentShift);

    const straight = agendaFor(face(), [{ wrestler: heel(), side: 0 }, { wrestler: face(), side: 1 }]);
    expect(straight.favoursSide).toBe(1);
  });

  it('never leans hard enough to decide it on its own', () => {
    // The clamp is what keeps this stacking rather than scripting: even the
    // loudest agenda leaves the match in the sim's hands.
    const biggest = Math.max(
      settings.guestRefereeGrudgeShift,
      settings.guestRefereeBiasShift,
      settings.guestRefereeAlignmentShift,
    );
    const evenMatch = 0.5;
    expect(evenMatch + biggest / 100).toBeLessThan(settings.oddsClampMax);
  });

  it('costs the guest something for standing in there, and more in a bloodbath', () => {
    const calm = guestRefereeHealthCost(w({ toughness: 50 }), 0, settings);
    const brutal = guestRefereeHealthCost(w({ toughness: 50 }), 6, settings);
    expect(calm).toBeGreaterThan(0);
    expect(brutal).toBeGreaterThan(calm);
  });

  it('hurts a tough wrestler less than a fragile one', () => {
    expect(guestRefereeHealthCost(w({ toughness: 90 }), 3, settings)).toBeLessThan(
      guestRefereeHealthCost(w({ toughness: 20 }), 3, settings),
    );
  });

  it('annoys the room more when they were drafted than when they were booked', () => {
    expect(settings.draftedRefereeMoraleCost).toBeGreaterThan(settings.guestRefereeMoraleCost);
  });
});

describe('booked in the shirt versus handed the shirt', () => {
  const settings = defaultWorldSettings();
  const star = w({ popularity: 85 });

  it('pays the drama bonus only when it was booked', () => {
    // A guest referee is worth something because it was *announced*. Nobody
    // is excited that a spare body was drafted because the booker would not
    // pay for an official.
    const booked = ringsideTotals({ managers: [], referee: null, guestReferee: star, settings });
    const drafted = ringsideTotals({
      managers: [],
      referee: null,
      guestReferee: star,
      guestWasDrafted: true,
      settings,
    });
    expect(booked.ratingBonus).toBeGreaterThan(0);
    expect(drafted.ratingBonus).toBe(0);
  });

  it('still gets the bias and the mess either way', () => {
    const drafted = ringsideTotals({
      managers: [],
      referee: null,
      guestReferee: star,
      guestWasDrafted: true,
      settings,
    });
    expect(drafted.screwyFinishWeight).toBeGreaterThan(1);
    expect(drafted.interferenceWeight).toBeGreaterThan(1);
  });
});
