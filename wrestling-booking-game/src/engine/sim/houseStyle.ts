// How well a match fits the company it is happening in.
//
// A promotion is known for something, and the people in the room turned up
// expecting it. Two mat wrestlers going twenty minutes is the best match of
// the night in a technical company and a bathroom break in a deathmatch one.
// This is the term that says so.
//
// Deliberately small — a few rating points either way. House style is a thumb
// on the scale, not a wall: you can absolutely build a hardcore promotion
// around a technician, it just costs you something every week until the crowd
// comes around.

import type { PromotionArchetype, WorldSettings, Wrestler } from '../types';
import { identityOf, styleFit } from '../../data/promotionIdentity';

/**
 * Rating points to add for a match that suits the house, or subtract for one
 * that does not. Averaged across everybody in the match, so one out-of-place
 * worker in a six-man is barely felt and a singles match between two of them
 * is felt fully.
 */
export function houseStyleRatingBonus(
  participants: readonly Pick<Wrestler, 'style' | 'secondaryStyle'>[],
  archetype: PromotionArchetype,
  settings: WorldSettings,
): number {
  if (participants.length === 0) return 0;
  const identity = identityOf(archetype);

  const total = participants.reduce((sum, w) => {
    const primary = styleFit(identity, w.style);
    // A second style they can work counts, but only half — it is not what
    // they are known for either.
    const secondary = w.secondaryStyle ? styleFit(identity, w.secondaryStyle) * 0.5 : 0;
    // Never let a good secondary erase a bad primary entirely.
    return sum + Math.max(primary, Math.min(primary + secondary, 1));
  }, 0);

  return (total / participants.length) * settings.houseStyleRatingWeight;
}

/**
 * How much violence tonight's card ran, measured against what this audience
 * will take. A deathmatch crowd shrugs at a street fight; an old-school one
 * writes letters. Returns rating points, negative when you went too far.
 */
export function violenceTolerancePenalty(
  violenceLevels: readonly number[],
  archetype: PromotionArchetype,
  settings: WorldSettings,
): number {
  if (violenceLevels.length === 0) return 0;
  const identity = identityOf(archetype);

  // Violence levels are 0-5 per segment; the card's average, put on 0-100 to
  // compare against the room's tolerance.
  const average = violenceLevels.reduce((a, b) => a + b, 0) / violenceLevels.length;
  const asPercent = (average / 5) * 100;
  const excess = asPercent - identity.violenceTolerance;
  if (excess <= 0) return 0;

  return -(excess / 100) * settings.houseStyleViolencePenalty;
}
