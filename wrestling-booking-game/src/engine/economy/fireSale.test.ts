import { describe, it, expect } from 'vitest';
import { fireSaleEligible, fireSaleValue } from './fireSale';
import { newAssetCondition } from './showBudget';
import { defaultWorldSettings } from '../world/settings';
import { PRODUCTION_ASSETS, productionAssetById } from '../../data/production';

const settings = defaultWorldSettings();

describe('what is even for sale', () => {
  it('offers every ordinary piece of show-night gear', () => {
    for (const asset of PRODUCTION_ASSETS) {
      if (asset.id === 'trainingFacility') continue;
      expect(fireSaleEligible(asset)).toBe(true);
    }
  });

  it('keeps the training facility out of it — it is the school, not a rig', () => {
    const facility = productionAssetById('trainingFacility')!;
    expect(fireSaleEligible(facility)).toBe(false);
  });
});

describe('what it actually fetches', () => {
  it('is a hard fraction of cost when brand new', () => {
    const ring = productionAssetById('ringUpgrade')!;
    const fresh = newAssetCondition(ring.id);
    expect(fireSaleValue(ring, fresh, settings)).toBe(Math.round(ring.cost * settings.fireSaleValueFraction));
  });

  it('fetches less the more worn the asset already is', () => {
    const ring = productionAssetById('ringUpgrade')!;
    const fresh = newAssetCondition(ring.id);
    const worn = { ...fresh, condition: 40 };
    expect(fireSaleValue(ring, worn, settings)).toBeLessThan(fireSaleValue(ring, fresh, settings));
  });

  it('is worth nothing once the asset has already failed', () => {
    const ring = productionAssetById('ringUpgrade')!;
    const failed = { ...newAssetCondition(ring.id), condition: settings.assetFailureThreshold };
    expect(fireSaleValue(ring, failed, settings)).toBe(0);
  });

  it('is always a real loss against buying it new, never a wash', () => {
    for (const asset of PRODUCTION_ASSETS) {
      const fresh = newAssetCondition(asset.id);
      expect(fireSaleValue(asset, fresh, settings)).toBeLessThan(asset.cost);
    }
  });

  it('treats an untracked asset as if it were new', () => {
    const ring = productionAssetById('ringUpgrade')!;
    expect(fireSaleValue(ring, undefined, settings)).toBe(Math.round(ring.cost * settings.fireSaleValueFraction));
  });
});
