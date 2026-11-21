// setPromotionLogo / setOwnerPhoto — real uploaded images for the player's
// own promotion mark and its owner. See slices/tagTeamsAndIdentity.ts and
// ui/components/PromotionMark.tsx / ui/paperdoll/PaperDoll.tsx for how each
// is rendered once set.

import { describe, expect, it, beforeEach } from 'vitest';
import { useGameStore } from './store';
import { defaultWorldSettings } from '../engine/world/settings';

function newGame() {
  useGameStore.getState().newGame({
    ...defaultWorldSettings(),
    seed: 'promotion-photos-test',
    startingRosterSize: 6,
    ownerMandatesEnabled: false,
  });
}

beforeEach(newGame);

describe('setPromotionLogo', () => {
  it('sets the logo', () => {
    useGameStore.getState().setPromotionLogo('data:image/webp;base64,fake-logo');
    expect(useGameStore.getState().world!.promotion.logoDataUrl).toBe('data:image/webp;base64,fake-logo');
  });

  it('clears the logo when passed null', () => {
    useGameStore.getState().setPromotionLogo('data:image/webp;base64,fake-logo');
    expect(useGameStore.getState().world!.promotion.logoDataUrl).toBeDefined();

    useGameStore.getState().setPromotionLogo(null);
    expect(useGameStore.getState().world!.promotion.logoDataUrl).toBeUndefined();
  });

  it('is never locked, unlike setPromotionIdentity — a logo is cosmetic, not lineage-affecting', () => {
    // Run a show, which locks name/archetype changes for good.
    useGameStore.setState((s) => {
      s.world!.showHistory.push({ id: 'show-1' } as any);
    });
    useGameStore.getState().setPromotionLogo('data:image/webp;base64,fake-logo');
    expect(useGameStore.getState().world!.promotion.logoDataUrl).toBe('data:image/webp;base64,fake-logo');
  });
});

describe('setOwnerPhoto', () => {
  it('sets the owner photo', () => {
    useGameStore.getState().setOwnerPhoto('data:image/webp;base64,fake-owner');
    expect(useGameStore.getState().world!.promotion.ownerPhotoDataUrl).toBe('data:image/webp;base64,fake-owner');
  });

  it('clears the owner photo when passed null', () => {
    useGameStore.getState().setOwnerPhoto('data:image/webp;base64,fake-owner');
    expect(useGameStore.getState().world!.promotion.ownerPhotoDataUrl).toBeDefined();

    useGameStore.getState().setOwnerPhoto(null);
    expect(useGameStore.getState().world!.promotion.ownerPhotoDataUrl).toBeUndefined();
  });

  it('touches nothing else about the promotion', () => {
    const before = useGameStore.getState().world!.promotion;
    const nameBefore = before.name;
    const ratingBefore = before.rating;

    useGameStore.getState().setOwnerPhoto('data:image/webp;base64,fake-owner');

    const after = useGameStore.getState().world!.promotion;
    expect(after.name).toBe(nameBefore);
    expect(after.rating).toBe(ratingBefore);
  });
});
