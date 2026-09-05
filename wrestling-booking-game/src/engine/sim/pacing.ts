// What calling a pace actually does to the match.
//
// Kept out of matchRating.ts because the pace touches three different things
// — the rating, what the match takes out of the people in it, and how likely
// somebody is to get hurt — and folding that into the rating formula would
// have hidden two thirds of it.
//
// The design rule this file enforces: no pace is strictly better than
// another. Sprint has a ceiling, slow build punishes a poor roster, all out
// costs bodies and gets stale. Standard is free and unremarkable. If any of
// them ever becomes the obvious answer every week, the lever has stopped
// being a decision and the numbers here are what to change.

import { clamp } from '../rng';
import type { Wrestler, WorldSettings } from '../types';
import { paceById, type PaceId } from '../../data/pacing';

export interface PaceContext {
  pace: PaceId;
  participants: readonly Wrestler[];
  isMainEvent: boolean;
  isOpener: boolean;
  /** How much the crowd has seen of this pace lately, 0-100. */
  saturation: number;
  settings: WorldSettings;
}

export interface PaceEffect {
  /** Added to the match rating. */
  ratingBonus: number;
  /** Hard ceiling this pace imposes on the rating. */
  ratingCeiling: number;
  healthCostMultiplier: number;
  energyCostMultiplier: number;
  injuryMultiplier: number;
  /** Added to the promotion's counter for this pace. */
  saturationAdded: number;
}

/** Mean ring skill of the people in the match — what slow build pays off on. */
function ringCraft(participants: readonly Wrestler[]): number {
  if (participants.length === 0) return 50;
  const total = participants.reduce((sum, p) => sum + (p.skill * 0.65 + p.stamina * 0.35), 0);
  return total / participants.length;
}

export function paceEffect(ctx: PaceContext): PaceEffect {
  const pace = paceById(ctx.pace);

  // Skill is measured against the middle of the scale, so a pace with a
  // skillWeight rewards the good and punishes the poor rather than handing
  // everybody a bonus of a different size.
  const craft = (ringCraft(ctx.participants) - 50) / 50;
  let ratingBonus = pace.ratingBonus + craft * pace.skillWeight;

  if (ctx.isMainEvent) ratingBonus -= pace.mainEventPenalty;
  if (ctx.isOpener) ratingBonus += pace.openerBonus;
  else ratingBonus -= pace.offSpotPenalty;

  // The crowd tires of the same thing. Only paces that carry a saturation
  // cost decay — a sprint never gets old because it was never the point.
  if (pace.saturationPerUse > 0) {
    ratingBonus -= (ctx.saturation / 100) * ctx.settings.paceSaturationPenalty;
  }

  return {
    ratingBonus,
    ratingCeiling: pace.ratingCeiling,
    healthCostMultiplier: pace.healthCostMultiplier,
    energyCostMultiplier: pace.energyCostMultiplier,
    injuryMultiplier: pace.injuryMultiplier,
    saturationAdded: pace.saturationPerUse,
  };
}

/**
 * Is this the right call for these people, in this spot?
 *
 * Words, never a number, and never a warning — the game does not stop the
 * player booking a sprint on top. It just tells them what the pace is worth
 * to the people they have picked, the same way manager fit does.
 */
export type PaceFit = 'Wrong call' | 'Questionable' | 'Fine' | 'Good call' | 'Exactly right';

export function paceFit(ctx: PaceContext): PaceFit {
  const effect = paceEffect(ctx);
  // Bands spread wide enough that the top one is rare. Tighter than this and
  // three different paces all read "Exactly right" on the same match, which
  // tells the player nothing.
  if (effect.ratingBonus <= -10) return 'Wrong call';
  if (effect.ratingBonus < -3) return 'Questionable';
  if (effect.ratingBonus < 4) return 'Fine';
  if (effect.ratingBonus < 13) return 'Good call';
  return 'Exactly right';
}

/** Saturation decays every week the player leaves a pace alone. */
export function decayPaceSaturation(saturation: number, settings: WorldSettings): number {
  return clamp(saturation - settings.paceSaturationDecayPerWeek, 0, 100);
}
