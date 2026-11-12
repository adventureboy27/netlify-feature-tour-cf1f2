// Composite strength ("kayfabe") — booking-game-design.md §11.1.

import type { Wrestler, MatchRules } from '../types';

export interface StatWeights {
  popularity: number;
  skill: number;
  strength: number;
  agility: number;
  stamina: number;
}

const BASE_WEIGHTS: StatWeights = { popularity: 0.35, skill: 0.25, strength: 0.15, agility: 0.15, stamina: 0.1 };

/** §11.1 "Rules reweight the composite before comparison" table. */
export function ruleAdjustedWeights(rules: MatchRules, isLadderOrHighSpot: boolean, isMultiMan: boolean): StatWeights {
  const w = { ...BASE_WEIGHTS };
  if (rules.timeLimit >= 30 || rules.aim === 'ironMan') {
    w.stamina *= 2.2;
    w.strength *= 0.6;
  }
  if (rules.timeLimit > 0 && rules.timeLimit <= 5) {
    w.strength *= 1.8;
    w.stamina *= 0.4;
  }
  if (rules.ruleStrictness === 'none') {
    w.strength *= 1.5;
    w.skill *= 0.7;
  }
  if (rules.aim === 'submissionOnly') {
    w.skill *= 2.0;
  }
  if (rules.aim === 'firstBlood') {
    w.strength *= 1.6;
    w.popularity *= 0.7;
  }
  if (rules.aim === 'escape') {
    w.agility *= 1.7;
    w.stamina *= 1.3;
    w.strength *= 0.8;
  }
  if (isLadderOrHighSpot) {
    w.agility *= 1.9;
  }
  if (isMultiMan) {
    w.popularity *= 1.4;
  }
  return w;
}

/** §11.1: kayfabe = weighted stat base * healthFactor * momentumFactor * ageFactor. */
export function kayfabeScore(wrestler: Wrestler, weights: StatWeights): number {
  const base =
    weights.popularity * wrestler.popularity +
    weights.skill * wrestler.skill +
    weights.strength * wrestler.strength +
    weights.agility * wrestler.agility +
    weights.stamina * wrestler.stamina;

  const healthFactor = 0.5 + 0.5 * (wrestler.health / 100);
  const momentumFactor = 0.9 + 0.2 * (wrestler.momentum / 100);
  const ageFactor = wrestler.age > 36 ? 1 - (wrestler.age - 36) * 0.012 : 1.0;

  return base * healthFactor * momentumFactor * ageFactor;
}
