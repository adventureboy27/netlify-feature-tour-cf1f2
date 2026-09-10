import { describe, it, expect } from 'vitest';
import { releaseStigmaActive, releaseStigmaTerms } from './releaseStigma';
import { defaultWorldSettings } from '../world/settings';
import { generateWrestler } from '../generate/wrestler';
import { rngFromSeed } from '../rng';
import type { Wrestler } from '../types';

const settings = defaultWorldSettings();

function person(over: Partial<Wrestler> = {}): Wrestler {
  return { ...generateWrestler(rngFromSeed('stigma'), new Set()), ...over };
}

describe('whether the market is still holding it against them', () => {
  it('is active right after a release, and clears once the cooldown has run', () => {
    expect(releaseStigmaActive(0, settings)).toBe(true);
    expect(releaseStigmaActive(settings.releaseStigmaCooldownWeeks - 1, settings)).toBe(true);
    expect(releaseStigmaActive(settings.releaseStigmaCooldownWeeks, settings)).toBe(false);
  });

  it('is never active when switched off entirely', () => {
    const off = { ...settings, releaseStigmaEnabled: false };
    expect(releaseStigmaActive(0, off)).toBe(false);
  });
});

describe('what a wary free agent actually wants', () => {
  it('changes nothing while the stigma is not active', () => {
    const ordinary = person({ ego: 40 });
    const terms = releaseStigmaTerms(ordinary, 2000, false, settings);
    expect(terms.guaranteedPct).toBe(0);
    expect(terms.signingBonus).toBe(0);
  });

  it('demands a flat guaranteed floor from somebody who would not otherwise get one', () => {
    const ordinary = person({ ego: 40 });
    const terms = releaseStigmaTerms(ordinary, 2000, true, settings);
    expect(terms.guaranteedPct).toBe(settings.releaseStigmaGuaranteedPct);
    expect(terms.signingBonus).toBe(0);
  });

  it('demands cash up front instead, from somebody who already commands a guarantee off ego', () => {
    const star = person({ ego: 95 });
    const terms = releaseStigmaTerms(star, 2000, true, settings);
    expect(terms.guaranteedPct).toBe(1);
    expect(terms.signingBonus).toBe(Math.round(2000 * settings.releaseStigmaBonusWeeks));
  });

  it('never adds the stigma guaranteed floor on top of a guarantee ego already earned', () => {
    // A star's ego-driven guarantee is untouched by the stigma branch — the
    // stigma tax on a star is the bonus, not a second, stacked guarantee.
    for (const ego of [60, 75, 95]) {
      const withoutStigma = releaseStigmaTerms(person({ ego }), 1500, false, settings);
      const withStigma = releaseStigmaTerms(person({ ego }), 1500, true, settings);
      expect(withStigma.guaranteedPct).toBe(withoutStigma.guaranteedPct);
      expect(withStigma.signingBonus).toBeGreaterThan(0);
    }
  });
});
