// The signing nobody knows about.
//
// The single most valuable thing a wrestling company ever did was put
// somebody on television that the audience was certain worked somewhere else.
// The whole trick is that it is not a signing announcement — it is a man
// walking down an aisle he has no business walking down, and nine thousand
// people working out what it means at the same moment.
//
// So a secret signing is not a contract offer. It is a contract the world
// cannot see: the wrestler stays on the rival's roster, keeps appearing on
// the rival's shows, and every dirtsheet in the business still has them
// listed there — until the week the booker chooses, when they walk out on
// somebody else's programme instead.
//
// Two things make it a decision rather than a free win:
//
//   It costs. Silence is expensive, and you are paying somebody who is
//   working for a competitor in the meantime.
//
//   It leaks. Every week you sit on it is another roll. A leak hands the
//   rival the chance to re-sign them or bury them, and turns the biggest
//   moment you had into a paragraph in a newsletter.
//
// Held too long it goes stale anyway: a secret everybody has guessed is not a
// secret, and the pop it was worth decays.

import type { Rng } from '../rng';
import { chance } from '../rng';
import type { Id, Wrestler, WorldSettings } from '../types';

export interface SecretSigning {
  wrestlerId: Id;
  wrestlerName: string;
  /** The company the world still thinks they work for. */
  fromPromotionId: Id;
  fromPromotionName: string;
  /** Week the ink went on, which is when the clock started. */
  signedWeek: number;
  /** What it costs weekly to keep somebody who is working somewhere else. */
  weeklyRate: number;
  /**
   * Set when it gets out before the booker used it. A blown secret can still
   * be revealed, it is just no longer a surprise.
   */
  leakedWeek: number | null;
}

/**
 * What it costs a week to hold somebody in secret.
 *
 * A premium on their ordinary rate, because they are being paid by two
 * companies and only one of them is getting anything for it. The premium is
 * the whole reason this is not simply better than signing somebody normally.
 */
export function secretWeeklyCost(wrestler: Wrestler, settings: WorldSettings): number {
  const base = wrestler.contract?.weeklyRate ?? wrestler.popularity * settings.secretSigningRateFloor;
  return Math.round(base * settings.secretSigningPremium);
}

/**
 * Can this person be approached at all?
 *
 * Somebody already on your roster is not a secret, and somebody with no
 * company is a free agent — sign them the ordinary way. The interesting case
 * is exactly the one the angle needs: a wrestler under contract somewhere
 * else, whom the audience associates with that somewhere else.
 */
export function canSignSecretly(wrestler: Wrestler, playerPromotionId: Id): boolean {
  if (wrestler.deceased || wrestler.careerStatus === 'retired') return false;
  if (wrestler.role !== 'wrestler') return false;
  if (wrestler.promotionId === null) return false;
  return wrestler.promotionId !== playerPromotionId;
}

/**
 * How likely somebody is to take it.
 *
 * Money matters, but so does what they think of where they are: a wrestler
 * being wasted somewhere else is far easier to turn than a happy one, and
 * somebody with a big opinion of himself likes the idea of being the secret.
 */
export function secretSigningAppeal(wrestler: Wrestler, settings: WorldSettings): number {
  const unhappy = (100 - wrestler.morale) / 100;
  const ego = wrestler.ego / 100;
  return (
    unhappy * settings.secretSigningMoraleWeight +
    ego * settings.secretSigningEgoWeight +
    settings.secretSigningBaseAppeal
  );
}

/**
 * Does it get out this week?
 *
 * The odds climb the longer it is held, because more people find out every
 * week it stays true — a secret with a date on it is a secret with a
 * deadline. Somebody with a bad attitude is a worse bet to keep quiet.
 */
export function leakChance(
  signing: SecretSigning,
  wrestler: Wrestler,
  currentWeek: number,
  settings: WorldSettings,
): number {
  const held = Math.max(0, currentWeek - signing.signedWeek);
  const loose = (100 - wrestler.attitude) / 100;
  return Math.min(
    settings.secretSigningLeakCap,
    settings.secretSigningLeakBase +
      held * settings.secretSigningLeakPerWeek +
      loose * settings.secretSigningLeakAttitude,
  );
}

export function rollLeak(
  rng: Rng,
  signing: SecretSigning,
  wrestler: Wrestler,
  currentWeek: number,
  settings: WorldSettings,
): boolean {
  if (signing.leakedWeek !== null) return false;
  return chance(rng, leakChance(signing, wrestler, currentWeek, settings));
}

/**
 * What the reveal is worth, as a multiplier on an ordinary debut.
 *
 * Everything about the moment is in this number. A big name the audience is
 * certain works elsewhere is worth several times a signing announcement; the
 * same reveal after the newsletter printed it is worth a fraction of that,
 * and a secret sat on for half a year is worth less again because the room
 * had time to guess.
 */
export function revealImpact(
  signing: SecretSigning,
  wrestler: Wrestler,
  currentWeek: number,
  settings: WorldSettings,
): number {
  const stature = wrestler.popularity / 100;
  const held = Math.max(0, currentWeek - signing.signedWeek);
  const staleness = Math.min(1, held / settings.secretSigningStaleWeeks);

  const surprise = signing.leakedWeek === null ? 1 : settings.secretSigningLeakedImpact;
  return (
    settings.secretSigningBaseImpact *
    (0.4 + stature) *
    surprise *
    (1 - staleness * settings.secretSigningStalePenalty)
  );
}

/** Is it still a surprise? */
export function stillSecret(signing: SecretSigning): boolean {
  return signing.leakedWeek === null;
}
