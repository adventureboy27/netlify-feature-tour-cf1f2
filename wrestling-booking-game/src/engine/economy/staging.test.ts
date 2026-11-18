import { describe, expect, it } from 'vitest';
import { stagingTonight } from './venue';
import { venueById } from '../../data/venues';
import { assetRequirementMet, productionAssetById } from '../../data/production';

describe('what is in the building tonight', () => {
  it('takes only the rungs the room has space for, bottom of the ladder up', () => {
    const gym = venueById('schoolGym')!;
    const arena = venueById('domeStadium')!;
    const owned = ['matRopes', 'ring', 'sound', 'lights', 'cameras', 'stage', 'screen', 'pyro'];
    const small = stagingTonight({ rungs: owned, assetsInRoom: [], extras: [], venue: gym });
    const big = stagingTonight({ rungs: owned, assetsInRoom: [], extras: [], venue: arena });
    expect(small.gear).toContain('matRopes');
    expect(small.gear).not.toContain('screen');
    expect(big.gear).toEqual(expect.arrayContaining(['ring', 'lights', 'screen']));
    expect(small.venueKind).toBe('hall');
  });

  it('fires no pyro from a rig left on the truck, charges or not', () => {
    const gym = venueById('schoolGym')!;
    expect(stagingTonight({ rungs: ['matRopes', 'pyro'], assetsInRoom: [], extras: ['pyroCharges'], venue: gym }).pyro).toBe(false);
    const arena = venueById('civicArena')!;
    expect(stagingTonight({ rungs: [], assetsInRoom: ['pyroRig'], extras: ['pyroCharges'], venue: arena }).pyro).toBe(true);
    expect(stagingTonight({ rungs: [], assetsInRoom: ['pyroRig'], extras: [], venue: arena }).pyro).toBe(false);
  });

  it('counts gear bought outright as the piece of the building it is', () => {
    const arena = venueById('civicArena')!;
    const staged = stagingTonight({ rungs: [], assetsInRoom: ['bigScreen', 'steelBarricades', 'ringUpgrade'], extras: ['security'], venue: arena });
    expect(staged.gear).toEqual(expect.arrayContaining(['screen', 'barricades', 'ring']));
    expect(staged.extras).toEqual(['security']);
  });

  it('puts the premium ring in the building as its own piece, and sells it only over a professional ring', () => {
    const arena = venueById('civicArena')!;
    expect(stagingTonight({ rungs: [], assetsInRoom: ['ringUpgrade', 'premiumRing'], extras: [], venue: arena }).gear).toEqual(expect.arrayContaining(['ring', 'premiumRing']));
    const premium = productionAssetById('premiumRing')!;
    expect(assetRequirementMet(premium, [], ['matRopes'])).toBe(false);
    expect(assetRequirementMet(premium, ['ringUpgrade'], [])).toBe(true);
    expect(assetRequirementMet(premium, [], ['matRopes', 'ring'])).toBe(true);
    // Everything without a requirement is always on sale.
    expect(assetRequirementMet(productionAssetById('soundSystem')!, [], [])).toBe(true);
  });

  it('sells the broadcast ring only over the premium ring', () => {
    const broadcast = productionAssetById('broadcastRing')!;
    expect(assetRequirementMet(broadcast, ['ringUpgrade'], ['ring'])).toBe(false);
    expect(assetRequirementMet(broadcast, ['ringUpgrade', 'premiumRing'], [])).toBe(true);
    const arena = venueById('civicArena')!;
    expect(stagingTonight({ rungs: [], assetsInRoom: ['broadcastRing'], extras: [], venue: arena }).gear).toContain('broadcastRing');
  });
});
