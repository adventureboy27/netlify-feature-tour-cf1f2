import { describe, expect, it } from 'vitest';
import {
  canSignSecretly,
  leakChance,
  revealImpact,
  rollLeak,
  secretSigningAppeal,
  secretWeeklyCost,
  stillSecret,
  type SecretSigning,
} from './secretSigning';
import { defaultWorldSettings } from './settings';
import { generateWrestlers } from '../generate/wrestler';
import { rngFromSeed } from '../rng';
import type { Wrestler } from '../types';

const settings = defaultWorldSettings();

function person(over: Partial<Wrestler> = {}, seed = 'secret'): Wrestler {
  const [w] = generateWrestlers(rngFromSeed(seed), 1);
  return { ...w!, promotionId: 'rival-1', morale: 60, ego: 50, attitude: 60, popularity: 70, ...over };
}

const signing = (over: Partial<SecretSigning> = {}): SecretSigning => ({
  wrestlerId: 'w',
  wrestlerName: 'Somebody',
  fromPromotionId: 'rival-1',
  fromPromotionName: 'Atlas Pro',
  signedWeek: 10,
  weeklyRate: 900,
  leakedWeek: null,
  ...over,
});

describe('who can be taken', () => {
  it('is somebody who works for a competitor', () => {
    expect(canSignSecretly(person(), 'player-promotion')).toBe(true);
  });

  it('is not your own roster — that is not a secret', () => {
    expect(canSignSecretly(person({ promotionId: 'player-promotion' }), 'player-promotion')).toBe(false);
  });

  it('is not a free agent — sign them the ordinary way', () => {
    expect(canSignSecretly(person({ promotionId: null }), 'player-promotion')).toBe(false);
  });

  it('is not the dead, the retired, or the office staff', () => {
    expect(canSignSecretly(person({ careerStatus: 'retired' }), 'player-promotion')).toBe(false);
    expect(canSignSecretly(person({ role: 'referee' }), 'player-promotion')).toBe(false);
  });
});

describe('what it costs', () => {
  it('is a premium on their ordinary rate, because two companies are paying them', () => {
    const w = person();
    const cost = secretWeeklyCost(w, settings);
    expect(cost).toBeGreaterThan(w.contract?.weeklyRate ?? 0);
    expect(settings.secretSigningPremium).toBeGreaterThan(1);
  });

  it('still quotes a price for somebody with no contract on record', () => {
    expect(secretWeeklyCost(person({ contract: null }), settings)).toBeGreaterThan(0);
  });
});

describe('who says yes', () => {
  it('is likelier when they are miserable where they are', () => {
    expect(secretSigningAppeal(person({ morale: 10 }), settings)).toBeGreaterThan(
      secretSigningAppeal(person({ morale: 95 }), settings),
    );
  });

  it('is likelier when they fancy being the secret', () => {
    expect(secretSigningAppeal(person({ ego: 95 }), settings)).toBeGreaterThan(
      secretSigningAppeal(person({ ego: 10 }), settings),
    );
  });

  it('is never a certainty, so asking is a risk', () => {
    expect(secretSigningAppeal(person({ morale: 0, ego: 100 }), settings)).toBeLessThan(1);
  });
});

describe('keeping it quiet', () => {
  it('gets harder every week it is held', () => {
    const w = person();
    const early = leakChance(signing(), w, 11, settings);
    const late = leakChance(signing(), w, 40, settings);
    expect(late).toBeGreaterThan(early);
  });

  it('is harder with somebody who talks', () => {
    expect(leakChance(signing(), person({ attitude: 5 }), 20, settings)).toBeGreaterThan(
      leakChance(signing(), person({ attitude: 95 }), 20, settings),
    );
  });

  it('never becomes a certainty, however long you sit on it', () => {
    expect(leakChance(signing(), person({ attitude: 0 }), 500, settings)).toBeLessThanOrEqual(
      settings.secretSigningLeakCap,
    );
  });

  it('does not leak twice', () => {
    const blown = signing({ leakedWeek: 12 });
    for (let i = 0; i < 200; i++) {
      expect(rollLeak(rngFromSeed(`x${i}`), blown, person({ attitude: 0 }), 60, settings)).toBe(false);
    }
    expect(stillSecret(blown)).toBe(false);
  });

  it('does eventually get out if you sit on it forever', () => {
    const rng = rngFromSeed('leak');
    const w = person({ attitude: 30 });
    let leaked = false;
    for (let week = 11; week < 70 && !leaked; week++) {
      if (rollLeak(rng, signing(), w, week, settings)) leaked = true;
    }
    expect(leaked).toBe(true);
  });
});

describe('the moment', () => {
  it('is worth several times an ordinary debut when nobody saw it coming', () => {
    expect(revealImpact(signing(), person({ popularity: 90 }), 12, settings)).toBeGreaterThan(2);
  });

  it('is worth far less once the sheets have printed it', () => {
    const clean = revealImpact(signing(), person(), 12, settings);
    const blown = revealImpact(signing({ leakedWeek: 11 }), person(), 12, settings);
    expect(blown).toBeLessThan(clean * 0.5);
  });

  it('is bigger for a bigger name', () => {
    expect(revealImpact(signing(), person({ popularity: 95 }), 12, settings)).toBeGreaterThan(
      revealImpact(signing(), person({ popularity: 20 }), 12, settings),
    );
  });

  it('decays if you sit on it, because the room has time to guess', () => {
    const soon = revealImpact(signing(), person(), 12, settings);
    const ages = revealImpact(signing(), person(), 10 + settings.secretSigningStaleWeeks, settings);
    expect(ages).toBeLessThan(soon);
  });

  it('is still worth something even at its worst', () => {
    const worst = revealImpact(
      signing({ leakedWeek: 11 }),
      person({ popularity: 10 }),
      10 + settings.secretSigningStaleWeeks * 3,
      settings,
    );
    expect(worst).toBeGreaterThan(0);
  });
});
