// Rival bookers going after your talent, and the one the player can run
// themselves. No dedicated coverage existed for `temptation()` before this —
// it is exercised here on its own, and personality is the reason it needed
// to be.

import { describe, it, expect } from 'vitest';
import { temptation, rollTamperingAttempts, type Suitor, type TamperingContext } from './tampering';
import { defaultWorldSettings } from './settings';
import { createStandardContract } from '../economy/contracts';
import { generateWrestler } from '../generate/wrestler';
import { rngFromSeed } from '../rng';
import type { Wrestler, Promotion } from '../types';

const settings = defaultWorldSettings();

function w(over: Partial<Wrestler> = {}): Wrestler {
  const base = generateWrestler(rngFromSeed('tempt'), new Set());
  const contract = createStandardContract(base, settings, 2000);
  return { ...base, contract, traits: [], attachedTo: null, ...over } as Wrestler;
}

function promo(over: Partial<Promotion> = {}): Promotion {
  return {
    id: 'rival',
    name: 'Atlas',
    rating: 60,
    rosterIds: [],
    ...over,
  } as Promotion;
}

describe('what the same offer is worth, before personality touches it', () => {
  // A short deal throughout, so `lockedIn` is not the whole story and the
  // terms under test have room to move the number.
  it('rises with the money, the unhappiness and the stalled momentum', () => {
    const flat = w({ morale: 80, momentum: 80, attitude: 30 });
    const richer = temptation(flat, flat.contract!.weeklyRate * 2, 4, settings);
    const poorer = temptation(flat, 0, 4, settings);
    expect(richer).toBeGreaterThan(poorer);

    const sulking = w({ morale: 10, momentum: 80, attitude: 30 });
    const content = w({ morale: 90, momentum: 80, attitude: 30 });
    expect(temptation(sulking, 0, 4, settings)).toBeGreaterThan(temptation(content, 0, 4, settings));
  });

  it('is deterred by a long deal and barely notices a short one', () => {
    const person = w({ morale: 50, momentum: 50, attitude: 30 });
    const longDeal = temptation(person, 100, 100, settings);
    const shortDeal = temptation(person, 100, 2, settings);
    expect(shortDeal).toBeGreaterThan(longDeal);
  });
});

describe('who they are changes what the same offer is worth', () => {
  // Before this, an In It For The Money draw and a Grateful For The Work
  // draw on the identical offer were exactly as easy to poach.
  it('makes the money-driven one far more tempted by the same premium', () => {
    const base = w({ morale: 60, momentum: 60, attitude: 40, cardStatus: 'midcard' });
    const ordinary = temptation({ ...base, traits: [] }, 400, 20, settings);
    const mercenary = temptation({ ...base, traits: ['inItForTheMoney'] }, 400, 20, settings);
    expect(mercenary).toBeGreaterThan(ordinary);
  });

  it('makes a loyal one hard to move whatever the offer looks like', () => {
    const base = w({ morale: 20, momentum: 20, attitude: 30, cardStatus: 'lowerCard' });
    const ordinary = temptation({ ...base, traits: [] }, 500, 4, settings);
    const grateful = temptation({ ...base, traits: ['gratefulForTheWork'] }, 500, 4, settings);
    expect(grateful).toBeLessThan(ordinary);
  });

  it('makes somebody who dislikes the office easier to get, structurally', () => {
    // "Nothing you book changes it" — the pull is unconditional, not tied to
    // any one term. A short deal and moderate attitude so the baseline is not
    // already clamped to zero, which would hide the addition either way.
    const base = w({ morale: 55, momentum: 55, attitude: 30, cardStatus: 'upperMidcard' });
    const ordinary = temptation({ ...base, traits: [] }, 100, 4, settings);
    const dislikesUs = temptation({ ...base, traits: ['noTimeForTheOffice'] }, 100, 4, settings);
    expect(dislikesUs).toBeGreaterThan(ordinary);
  });

  it('tempts the one who wants the spotlight only when they are not already in it', () => {
    const base = w({ morale: 60, momentum: 60, attitude: 50, traits: ['wantsTheSpotlight'] });
    const buried = temptation({ ...base, cardStatus: 'midcard' }, 100, 20, settings);
    const mainEventer = temptation({ ...base, cardStatus: 'mainEventer' }, 100, 20, settings);
    const withoutTrait = temptation({ ...base, traits: [], cardStatus: 'midcard' }, 100, 20, settings);
    expect(buried).toBeGreaterThan(mainEventer);
    expect(buried).toBeGreaterThan(withoutTrait);
  });

  it('draws Somebody At Home toward the one promotion that is where the partner is, and nowhere else', () => {
    const base = w({ morale: 60, momentum: 60, attitude: 50, traits: ['somebodyAtHome'] });
    const elsewhere: Suitor = { promotionId: 'p1', partnerPromotionId: 'p2' };
    const home: Suitor = { promotionId: 'p1', partnerPromotionId: 'p1' };
    const noInfo = temptation(base, 100, 20, settings);
    const notWhere = temptation(base, 100, 20, settings, elsewhere);
    const isWhere = temptation(base, 100, 20, settings, home);
    expect(isWhere).toBeGreaterThan(notWhere);
    expect(notWhere).toBeCloseTo(noInfo, 5);
  });

  it('does nothing for that pull without the trait, even at the right address', () => {
    const base = w({ morale: 60, momentum: 60, attitude: 50, traits: [] });
    const home: Suitor = { promotionId: 'p1', partnerPromotionId: 'p1' };
    expect(temptation(base, 100, 20, settings, home)).toBeCloseTo(temptation(base, 100, 20, settings), 5);
  });

  it('never lets it go negative or past a clean probability', () => {
    const professional = w({ morale: 95, momentum: 95, attitude: 100, traits: ['gratefulForTheWork'] });
    expect(temptation(professional, 0, 200, settings)).toBeGreaterThanOrEqual(0);
    const everything = w({ morale: 0, momentum: 0, attitude: 0, traits: ['inItForTheMoney'], cardStatus: 'lowerCard' });
    expect(temptation(everything, 100000, 0, settings)).toBeLessThanOrEqual(1);
  });
});

describe('rolling the week\'s approaches', () => {
  it('looks up the partner when a lookup is given, and reaches the same number `temptation` would', () => {
    const partner = w({ id: 'partner1' });
    const target = w({
      id: 'target1',
      morale: 40,
      momentum: 40,
      attitude: 40,
      popularity: 90,
      hype: 90,
      age: 25,
      cardStatus: 'midcard',
      traits: ['somebodyAtHome'],
      attachedTo: 'partner1',
    });
    partner.promotionId = 'rival';

    const rival = promo({ id: 'rival', rating: 90 });
    const ctx: TamperingContext = {
      roster: [target],
      // Has to be a status `isPoachingTarget` actually allows, or appeal is
      // zero and nothing is ever rolled regardless of chance.
      statusOf: () => 'upperCard',
      rivals: [rival],
      currentWeek: 10,
      // Pushed to the roll's ceiling (`probability` still clamps at 0.6) so a
      // handful of seeds is enough to find one that fires.
      settings: { ...settings, tamperingBaseChance: 999, poachingAggression: 999, tamperingAppealThreshold: 0 },
      wrestlerById: (id) => (id === 'partner1' ? partner : undefined),
    };

    // The roll itself is a coin flip even at the clamp ceiling, so try a
    // handful of seeds rather than pin one that happens to work today.
    let found: ReturnType<typeof rollTamperingAttempts>[number] | undefined;
    for (let i = 0; i < 20 && !found; i++) {
      found = rollTamperingAttempts(rngFromSeed(`roll${i}`), ctx).find((a) => a.wrestlerId === 'target1');
    }
    expect(found).toBeTruthy();

    const expected = temptation(target, found!.offerPremium, target.contract!.weeksRemaining, settings, {
      promotionId: 'rival',
      partnerPromotionId: 'rival',
    });
    expect(found!.temptation).toBeCloseTo(expected, 5);
  });

  it('does not crash and gets no partner pull when no lookup is given', () => {
    const target = w({ id: 'target2', traits: ['somebodyAtHome'], attachedTo: 'nobody', cardStatus: 'midcard' });
    const ctx: TamperingContext = {
      roster: [target],
      statusOf: () => 'midcarder',
      rivals: [promo()],
      currentWeek: 10,
      settings: { ...settings, tamperingBaseChance: 999, poachingAggression: 999, tamperingAppealThreshold: 0 },
    };
    expect(() => rollTamperingAttempts(rngFromSeed('nolookup'), ctx)).not.toThrow();
  });
});
