// Promos — §9.
//
// Charisma first, popularity second. That order is the whole reason the system
// exists: it is where a great talker who cannot work becomes worth his
// contract, and where a manager who can talk earns his fee speaking for a
// monster who cannot.
//
// A promo is also the only way to *start* a feud deliberately. Everywhere else
// in this game rivalries form because people kept being booked against each
// other; here the booker points at two men and says these two hate each other
// now, which is what a booker actually does.
//
// Effects come back as the same closed EventEffect set everything else uses,
// so the store already knows how to apply them and a promo can only do things
// the game can actually do.

import type { Rng } from '../rng';
import { clamp, pick } from '../rng';
import type { EventEffect } from '../events/types';
import type { Id, WorldSettings, Wrestler } from '../types';
import { PROMO_LINES, promoTopicById, type PromoTopicId } from '../../data/promoTopics';

export interface PromoContext {
  speaker: Wrestler;
  /** Who it is aimed at, for the topics that need somebody. */
  target?: Wrestler | null;
  /**
   * A manager speaking for the wrestler. When present the promo rates off the
   * *manager's* mic work while the popularity still goes to the wrestler —
   * the single most efficient way to get a great worker with no promo ability
   * over, and the reason paying a mouthpiece is a real decision.
   */
  mouthpieceCharisma?: number | null;
  topicId: PromoTopicId;
  /** Heat already on the feud, when there is one. */
  existingHeat: number;
  settings: WorldSettings;
}

export interface PromoResult {
  /** 0-100, the same scale a match rates on. */
  quality: number;
  /** The write-up line. */
  text: string;
  effects: EventEffect[];
}

/**
 * How good it was.
 *
 * Charisma dominates and popularity supports: somebody nobody knows can still
 * cut a great promo, and somebody everybody knows can still be terrible at it.
 */
export function promoQuality(ctx: PromoContext, rng: Rng): number {
  const s = ctx.settings;
  const voice = ctx.mouthpieceCharisma ?? ctx.speaker.charisma;
  const base = voice * s.promoCharismaWeight + ctx.speaker.popularity * s.promoPopularityWeight;

  // A hot feud makes anything said about it land harder.
  const heat = (ctx.existingHeat / 100) * s.promoHeatBonus;
  // Somebody who does not want to be there does not sell it.
  const morale = ((ctx.speaker.morale - 50) / 50) * s.promoMoraleSwing;
  const luck = (rng.next() - 0.5) * 2 * s.promoVariance;

  return clamp(base + heat + morale + luck, 0, 100);
}

function writeUp(quality: number, speakerName: string, rng: Rng): string {
  const band = PROMO_LINES.find((entry) => quality >= entry.minQuality) ?? PROMO_LINES[PROMO_LINES.length - 1]!;
  return pick(rng, band.lines).replace(/\{speaker\}/g, speakerName);
}

/**
 * What a promo did. Effects scale with how well it went — a promo that lost
 * the crowd does almost nothing, which is what makes casting it a decision
 * rather than a free heat button.
 */
export function resolvePromo(rng: Rng, ctx: PromoContext): PromoResult {
  const s = ctx.settings;
  const quality = promoQuality(ctx, rng);
  // Everything below scales on this. A 40 is half the promo an 80 is.
  const scale = quality / 100;
  const effects: EventEffect[] = [];
  const speaker = ctx.speaker.id;
  const target = ctx.target?.id;

  const heatBetween = (delta: number) => {
    if (!target) return;
    effects.push({ kind: 'crowdHeat', wrestlerIds: [speaker, target], delta: Math.round(delta * scale) });
  };

  switch (ctx.topicId) {
    case 'startFeud':
      heatBetween(s.promoStartFeudHeat);
      effects.push({ kind: 'momentum', wrestlerId: speaker, delta: Math.round(s.promoMomentum * scale) });
      break;
    case 'continueFeud':
      heatBetween(s.promoContinueFeudHeat);
      break;
    case 'challenge':
      heatBetween(s.promoChallengeHeat);
      effects.push({ kind: 'popularity', wrestlerId: speaker, delta: Math.round(s.promoPopularity * scale) });
      break;
    case 'hypeMatch':
      effects.push({ kind: 'popularity', wrestlerId: speaker, delta: Math.round(s.promoPopularity * scale) });
      effects.push({ kind: 'companyRating', delta: Math.round(s.promoCompanyLift * scale) });
      break;
    case 'advertise':
      // The territory effect is applied by the store, which owns the map.
      effects.push({ kind: 'companyRating', delta: Math.round(s.promoCompanyLift * scale) });
      break;
    case 'championshipAddress':
      effects.push({ kind: 'popularity', wrestlerId: speaker, delta: Math.round(s.promoPopularity * scale) });
      effects.push({ kind: 'momentum', wrestlerId: speaker, delta: Math.round(s.promoMomentum * scale) });
      break;
    case 'callOutLockerRoom':
      // The crowd loves it and the room does not. Deliberately the only topic
      // whose downside does not scale with how well it went — doing it badly
      // and doing it brilliantly both annoy the boys.
      effects.push({ kind: 'popularity', wrestlerId: speaker, delta: Math.round(s.promoCalloutPopularity * scale) });
      effects.push({ kind: 'rosterMorale', delta: -s.promoCalloutMorale });
      break;
    case 'debutOrReturn':
      effects.push({ kind: 'popularity', wrestlerId: speaker, delta: Math.round(s.promoDebutPopularity * scale) });
      effects.push({ kind: 'momentum', wrestlerId: speaker, delta: Math.round(s.promoMomentum * scale) });
      break;
    case 'retirementSpeech':
      effects.push({ kind: 'rosterMorale', delta: Math.round(s.promoFarewellMorale * scale) });
      effects.push({ kind: 'popularity', wrestlerId: speaker, delta: Math.round(s.promoPopularity * scale) });
      break;
    case 'invasionPromo':
      // The following it takes is applied by the store — see the map.
      effects.push({ kind: 'momentum', wrestlerId: speaker, delta: Math.round(s.promoMomentum * scale) });
      break;
  }

  return { quality, text: writeUp(quality, ctx.speaker.name, rng), effects };
}

/** Whether this topic can be cast as booked. */
export function promoIsValid(
  topicId: PromoTopicId,
  speaker: Wrestler | null,
  target: Wrestler | null,
  speakerHoldsTitle: boolean,
): boolean {
  const topic = promoTopicById(topicId);
  if (!topic || !speaker) return false;
  if (topic.needsTarget && (!target || target.id === speaker.id)) return false;
  if (topic.needsChampion && !speakerHoldsTitle) return false;
  return true;
}

/**
 * How much a promo moves the show rating.
 *
 * Deliberately smaller than a match. A card of ten promos is not a wrestling
 * show, and the rating should say so.
 */
export function promoShowContribution(quality: number, settings: WorldSettings): number {
  return (quality - settings.promoNeutralQuality) * settings.promoShowRatingWeight;
}

/** Talking is easier than wrestling, but it is not free — §9's extra energy cost. */
export function promoEnergyCost(alsoWrestling: boolean, settings: WorldSettings): number {
  return alsoWrestling ? settings.promoEnergyCostDoubleBooked : settings.promoEnergyCost;
}

export function speakerIds(ctx: PromoContext): Id[] {
  return [ctx.speaker.id, ...(ctx.target ? [ctx.target.id] : [])];
}
