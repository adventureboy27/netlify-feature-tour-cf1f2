import { describe, expect, it } from 'vitest';
import {
  canSignSecretly,
  canWalkOut,
  exposureChance,
  isFree,
  retentionChance,
  revealImpact,
  rollExposure,
  rollRetention,
  secretSigningAppeal,
  secretWeeklyCost,
  stage,
  stillSecret,
  weeksUntilFree,
  type SecretSigning,
} from './secretSigning';
import { defaultWorldSettings } from './settings';
import { createStandardContract } from '../economy/contracts';
import { generateWrestlers } from '../generate/wrestler';
import { rngFromSeed } from '../rng';
import type { Wrestler } from '../types';

const settings = defaultWorldSettings();

function person(over: Partial<Wrestler> = {}, seed = 'secret'): Wrestler {
  const [w] = generateWrestlers(rngFromSeed(seed), 1);
  const base: Wrestler = {
    ...w!,
    promotionId: 'rival-1',
    morale: 60,
    ego: 50,
    attitude: 60,
    popularity: 70,
  };
  return {
    ...base,
    contract: { ...createStandardContract(base, settings, 1990), weeksRemaining: 6 },
    ...over,
  };
}

/** A handshake, nothing signed. */
const handshake = (over: Partial<SecretSigning> = {}): SecretSigning => ({
  wrestlerId: 'w',
  wrestlerName: 'Somebody',
  fromPromotionId: 'rival-1',
  fromPromotionName: 'Atlas Pro',
  agreedWeek: 10,
  freeWeek: 16,
  weeklyRate: 900,
  signedWeek: null,
  blownWeek: null,
  ...over,
});

/** The same agreement, after his old deal lapsed and yours started. */
const signed = (over: Partial<SecretSigning> = {}): SecretSigning =>
  handshake({ signedWeek: 16, ...over });

describe('who can be approached', () => {
  it('is somebody whose deal with a competitor is nearly up', () => {
    expect(canSignSecretly(person(), 'player-promotion', settings)).toBe(true);
  });

  it('is nobody with real time left — you cannot pay a man to break a contract', () => {
    const locked = person({
      contract: { ...createStandardContract(person(), settings, 1990), weeksRemaining: 90 },
    });
    expect(canSignSecretly(locked, 'player-promotion', settings)).toBe(false);
  });

  it('is not your own roster — that is not a secret', () => {
    expect(canSignSecretly(person({ promotionId: 'player-promotion' }), 'player-promotion', settings)).toBe(
      false,
    );
  });

  it('is not a free agent — sign them the ordinary way', () => {
    expect(canSignSecretly(person({ promotionId: null }), 'player-promotion', settings)).toBe(false);
  });

  it('is not somebody with no deal at all to run out', () => {
    expect(canSignSecretly(person({ contract: null }), 'player-promotion', settings)).toBe(false);
  });

  it('is not the dead, the retired, or the office staff', () => {
    expect(canSignSecretly(person({ careerStatus: 'retired' }), 'player-promotion', settings)).toBe(false);
    expect(canSignSecretly(person({ role: 'referee' }), 'player-promotion', settings)).toBe(false);
  });
});

describe('what it costs', () => {
  it('is a premium, because you are bidding blind against the company he is at', () => {
    const w = person();
    expect(secretWeeklyCost(w, settings)).toBeGreaterThan(w.contract?.weeklyRate ?? 0);
    expect(settings.secretSigningPremium).toBeGreaterThan(1);
  });

  it('still quotes a price for somebody with no contract on record', () => {
    expect(secretWeeklyCost(person({ contract: null }), settings)).toBeGreaterThan(0);
  });
});

describe('who says yes', () => {
  const withWeeks = (weeks: number, over: Partial<Wrestler> = {}) =>
    person({ contract: { ...createStandardContract(person(), settings, 1990), weeksRemaining: weeks }, ...over });

  it('is likelier when they are miserable where they are', () => {
    expect(secretSigningAppeal(withWeeks(6, { morale: 10 }), settings)).toBeGreaterThan(
      secretSigningAppeal(withWeeks(6, { morale: 95 }), settings),
    );
  });

  it('is likelier when they fancy being the secret', () => {
    expect(secretSigningAppeal(withWeeks(6, { ego: 95 }), settings)).toBeGreaterThan(
      secretSigningAppeal(withWeeks(6, { ego: 10 }), settings),
    );
  });

  it('is harder the closer he is to free, because his own office is already in the room', () => {
    // This is the trade the whole thing turns on: shake early and he agrees
    // but you have months of exposure; shake late and there is barely anything
    // to keep quiet, but he is much likelier to say no.
    expect(secretSigningAppeal(withWeeks(12), settings)).toBeGreaterThan(
      secretSigningAppeal(withWeeks(1), settings),
    );
  });

  it('is never a certainty, so asking is a risk', () => {
    expect(secretSigningAppeal(withWeeks(13, { morale: 0, ego: 100 }), settings)).toBeLessThan(1);
  });
});

describe('nobody works for two companies', () => {
  it('starts as a handshake and nothing more', () => {
    expect(stage(handshake())).toBe('agreed');
    expect(canWalkOut(handshake())).toBe(false);
  });

  it('will not let him be walked out while their deal still has weeks on it', () => {
    expect(isFree(handshake(), 15)).toBe(false);
    expect(canWalkOut(handshake({ signedWeek: null }))).toBe(false);
  });

  it('becomes real only once the old one lapsed', () => {
    expect(isFree(handshake(), 16)).toBe(true);
    expect(stage(signed())).toBe('signed');
    expect(canWalkOut(signed())).toBe(true);
  });
});

describe('the wait, before his deal runs out', () => {
  it('is more dangerous against a big company that can act', () => {
    expect(retentionChance(person(), 90, settings)).toBeGreaterThan(
      retentionChance(person(), 10, settings),
    );
  });

  it('is more dangerous with a man who is happy where he is', () => {
    expect(retentionChance(person({ morale: 95 }), 50, settings)).toBeGreaterThan(
      retentionChance(person({ morale: 5 }), 50, settings),
    );
  });

  it('is more dangerous with a man who talks', () => {
    expect(retentionChance(person({ attitude: 5 }), 50, settings)).toBeGreaterThan(
      retentionChance(person({ attitude: 95 }), 50, settings),
    );
  });

  it('never becomes a certainty in any one week', () => {
    expect(retentionChance(person({ morale: 100, attitude: 0 }), 100, settings)).toBeLessThanOrEqual(
      settings.secretRetentionCap,
    );
  });

  it('does eventually cost you somebody if you shake hands months out', () => {
    const rng = rngFromSeed('retain');
    let taken = false;
    for (let i = 0; i < 20 && !taken; i++) {
      if (rollRetention(rng, handshake(), person(), 60, settings)) taken = true;
    }
    expect(taken).toBe(true);
  });

  it('cannot take somebody whose contract is already signed with you', () => {
    for (let i = 0; i < 100; i++) {
      expect(rollRetention(rngFromSeed(`s${i}`), signed(), person({ morale: 100 }), 100, settings)).toBe(
        false,
      );
    }
  });
});

describe('the gap, after his deal runs out', () => {
  it('is nothing at all while he is still under contract to them', () => {
    expect(exposureChance(handshake(), 14, settings)).toBe(0);
  });

  it('climbs steeply every week he is signed and not on television', () => {
    const first = exposureChance(signed(), 16, settings);
    const later = exposureChance(signed(), 20, settings);
    expect(later).toBeGreaterThan(first * 2);
  });

  it('is allowed to become near-certain, unlike his own office noticing', () => {
    expect(exposureChance(signed(), 200, settings)).toBeGreaterThan(0.8);
  });

  it('does not get out twice', () => {
    const blown = signed({ blownWeek: 18 });
    for (let i = 0; i < 100; i++) {
      expect(rollExposure(rngFromSeed(`x${i}`), blown, 60, settings)).toBe(false);
    }
    expect(stillSecret(blown)).toBe(false);
  });
});

describe('the moment', () => {
  it('is worth several times an ordinary debut the week his deal ran out', () => {
    expect(revealImpact(signed(), person({ popularity: 90 }), 16, settings)).toBeGreaterThan(2);
  });

  it('is worth far less once the sheets have placed him', () => {
    const clean = revealImpact(signed(), person(), 16, settings);
    const blown = revealImpact(signed({ blownWeek: 17 }), person(), 16, settings);
    expect(blown).toBeLessThan(clean * 0.5);
  });

  it('is bigger for a bigger name', () => {
    expect(revealImpact(signed(), person({ popularity: 95 }), 16, settings)).toBeGreaterThan(
      revealImpact(signed(), person({ popularity: 20 }), 16, settings),
    );
  });

  it('bleeds out fast — a month of sitting on it costs most of it', () => {
    // Rude was on the opposition's show the next night for a reason. This is
    // the sharpest decay in the game and it is meant to be.
    const sameWeek = revealImpact(signed(), person(), 16, settings);
    const monthLater = revealImpact(signed(), person(), 20, settings);
    expect(monthLater).toBeLessThan(sameWeek * 0.45);
  });

  it('is still worth something even at its worst', () => {
    expect(revealImpact(signed({ blownWeek: 17 }), person({ popularity: 10 }), 300, settings)).toBeGreaterThan(
      0,
    );
  });
});

describe('how long until he is free', () => {
  it('reads it off the deal he is actually on', () => {
    expect(weeksUntilFree(person())).toBe(6);
  });

  it('is nothing for somebody with no deal', () => {
    expect(weeksUntilFree(person({ contract: null }))).toBe(0);
  });
});
