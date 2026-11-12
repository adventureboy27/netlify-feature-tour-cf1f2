import { describe, expect, it } from 'vitest';
import { CARD_SIZE_TIERS, cardSizeTierById, nextCardSizeTier } from './cardSize';

describe('the card size ladder', () => {
  it('is ordered by slot count, smallest first', () => {
    for (let i = 1; i < CARD_SIZE_TIERS.length; i++) {
      expect(CARD_SIZE_TIERS[i]!.slots).toBeGreaterThan(CARD_SIZE_TIERS[i - 1]!.slots);
    }
  });

  it('charges more for a bigger card, and the bottom tier is free', () => {
    expect(CARD_SIZE_TIERS[0]!.cost).toBe(0);
    for (let i = 1; i < CARD_SIZE_TIERS.length; i++) {
      expect(CARD_SIZE_TIERS[i]!.cost).toBeGreaterThan(CARD_SIZE_TIERS[i - 1]!.cost);
    }
  });

  it('says something about every tier', () => {
    for (const tier of CARD_SIZE_TIERS) {
      expect(tier.blurb.length, tier.id).toBeGreaterThan(20);
    }
  });

  it('finds a tier by id', () => {
    expect(cardSizeTierById('backyardCard')?.slots).toBe(4);
    expect(cardSizeTierById('nonsense')).toBeUndefined();
  });

  it('moves up one rung at a time, and stops at the top', () => {
    expect(nextCardSizeTier('backyardCard')?.id).toBe('localCard');
    expect(nextCardSizeTier('localCard')?.id).toBe('regionalCard');
    expect(nextCardSizeTier(CARD_SIZE_TIERS[CARD_SIZE_TIERS.length - 1]!.id)).toBeNull();
  });

  it('falls back to the bottom tier for an id it does not know', () => {
    expect(nextCardSizeTier('nonsense')?.id).toBe(CARD_SIZE_TIERS[0]!.id);
  });
});
