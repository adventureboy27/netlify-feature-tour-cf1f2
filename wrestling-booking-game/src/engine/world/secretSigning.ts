// The signing nobody saw coming.
//
// The single most valuable thing a wrestling company ever did was put
// somebody on television that the audience was certain worked somewhere else.
// The whole trick is that it is not a signing announcement — it is a man
// walking down an aisle he has no business walking down, and nine thousand
// people working out what it means at the same moment.
//
// The trick is *timing*, not double-dealing. Nobody works for two companies
// at once; that is a contract violation and it would be over in a week. What
// actually happened is Rick Rude: he worked a Sunday pay-per-view on the last
// day of his deal, the ink went on with the competition within hours of it
// lapsing, and he was on the opposition's programme the following night. The
// contract was never broken. There was simply no gap between the old one
// ending and everybody finding out where he had gone.
//
// So this is a three-stage thing, and the interesting decision is when to
// start it:
//
//   THE HANDSHAKE. You reach an understanding with somebody whose deal is
//   running down. Nothing is signed, nothing is paid, and nothing exists that
//   anyone could point at. Somebody with time left on his deal is easier to
//   get an understanding from — a man two weeks from free is already sitting
//   in a room with his own company, hearing their number.
//
//   THE WAIT. Every week the handshake sits there is a week somebody could
//   mention it in a bar, and the moment his own office gets wind they simply
//   re-sign him. Shaking hands early buys you certainty of the agreement and
//   pays for it in weeks of exposure. That is the whole trade.
//
//   THE GAP. His deal lapses, yours starts, and he is yours in fact and
//   nowhere in public. This is the part that decays fast: a man missing from
//   his old company's shows is a man people ask about, and every week he is
//   not walked out is a week the answer gets easier to guess. Rude was on
//   Nitro the next night for a reason.

import type { Rng } from '../rng';
import { chance } from '../rng';
import type { Id, Wrestler, WorldSettings } from '../types';

/** Where an agreement has got to. */
export type SecretStage =
  /** Handshake only. He is still under contract to them and still working their shows. */
  | 'agreed'
  /** His deal lapsed, yours started, and nobody outside the office knows. */
  | 'signed';

export interface SecretSigning {
  wrestlerId: Id;
  wrestlerName: string;
  /** The company whose deal is running out, and who does not know. */
  fromPromotionId: Id;
  fromPromotionName: string;
  /** Week the understanding was reached. Nothing was signed and nothing paid. */
  agreedWeek: number;
  /**
   * The week their existing deal lapses — the first week anything can legally
   * happen. Fixed at the handshake, because that is what was shaken on.
   */
  freeWeek: number;
  /** What the deal pays once it actually starts. */
  weeklyRate: number;
  /**
   * Week the ink went on, which is the week the old deal ran out. Null while
   * it is still only a handshake.
   */
  signedWeek: number | null;
  /**
   * Set when word got out before you used it. Before the deal starts that
   * means his own office got wind; after it starts it means the sheets worked
   * out where he went. Either way it is no longer a surprise.
   */
  blownWeek: number | null;
}

/** How long until their current deal lapses. */
export function weeksUntilFree(wrestler: Wrestler): number {
  return Math.max(0, wrestler.contract?.weeksRemaining ?? 0);
}

/**
 * What the deal pays a week once it starts.
 *
 * A premium on their ordinary rate, and not because two companies are paying
 * them — because you are bidding against an incumbent whose number you cannot
 * see, in a conversation neither of you can admit to having. You overpay for
 * the privilege of being first. That premium is the whole reason this is not
 * simply better than signing somebody in the open.
 */
export function secretWeeklyCost(wrestler: Wrestler, settings: WorldSettings): number {
  const base = wrestler.contract?.weeklyRate ?? wrestler.popularity * settings.secretSigningRateFloor;
  return Math.round(base * settings.secretSigningPremium);
}

/**
 * Can this person be approached at all?
 *
 * Somebody on your own roster is not a secret and a free agent is not either
 * — sign them in the open. And somebody with a year left on his deal cannot
 * be had at any price, because there is nothing to shake hands *about*: he is
 * not going anywhere for a year and you cannot pay him to break a contract.
 * The window is the last stretch of a deal, which is the only time a man is
 * genuinely available and nobody has announced it yet.
 */
export function canSignSecretly(
  wrestler: Wrestler,
  playerPromotionId: Id,
  settings: WorldSettings,
): boolean {
  if (wrestler.deceased || wrestler.careerStatus === 'retired') return false;
  if (wrestler.role !== 'wrestler') return false;
  if (wrestler.promotionId === null) return false;
  if (wrestler.promotionId === playerPromotionId) return false;
  const left = weeksUntilFree(wrestler);
  return left > 0 && left <= settings.secretSigningWindowWeeks;
}

/**
 * How likely somebody is to shake on it.
 *
 * Money matters, but so does what they think of where they are: a wrestler
 * being wasted somewhere else is far easier to turn than a happy one, and
 * somebody with a big opinion of himself likes the idea of being the secret.
 *
 * And time matters, in the direction that makes the decision hard. The more
 * runway is left on his deal the freer he feels to agree to something —
 * nobody has made him an offer yet, so yours is the only one in the room. Get
 * to him with two weeks to go and he has already heard his own company's
 * number, which makes him a much harder yes and is precisely when holding the
 * secret would have been easiest. Early is safe to agree and dangerous to
 * hold; late is the reverse.
 */
export function secretSigningAppeal(wrestler: Wrestler, settings: WorldSettings): number {
  const unhappy = (100 - wrestler.morale) / 100;
  const ego = wrestler.ego / 100;
  const runway = Math.min(1, weeksUntilFree(wrestler) / settings.secretSigningWindowWeeks);
  return (
    unhappy * settings.secretSigningMoraleWeight +
    ego * settings.secretSigningEgoWeight +
    runway * settings.secretSigningRunwayWeight +
    settings.secretSigningBaseAppeal
  );
}

/** Where the agreement has got to this week. */
export function stage(signing: SecretSigning): SecretStage {
  return signing.signedWeek === null ? 'agreed' : 'signed';
}

/** Has the old deal lapsed, so the new one can start? */
export function isFree(signing: SecretSigning, currentWeek: number): boolean {
  return currentWeek >= signing.freeWeek;
}

/**
 * Odds this week that his own office gets wind and simply re-signs him.
 *
 * This is the cost of shaking hands early, and it is the only thing that can
 * take the agreement away — there is no contract to break, so all a rival has
 * to do is offer him a new one before the old one runs out. A big company
 * with money is far better at noticing and far better at fixing it, and a man
 * who is happy where he is takes the renewal without much thought.
 */
export function retentionChance(
  wrestler: Wrestler,
  rivalRating: number,
  settings: WorldSettings,
): number {
  const clout = Math.max(0, rivalRating) / 100;
  const settled = wrestler.morale / 100;
  const loose = (100 - wrestler.attitude) / 100;
  return Math.min(
    settings.secretRetentionCap,
    settings.secretRetentionBase +
      clout * settings.secretRetentionClout +
      settled * settings.secretRetentionMorale +
      loose * settings.secretRetentionTalk,
  );
}

export function rollRetention(
  rng: Rng,
  signing: SecretSigning,
  wrestler: Wrestler,
  rivalRating: number,
  settings: WorldSettings,
): boolean {
  if (stage(signing) !== 'agreed') return false;
  return chance(rng, retentionChance(wrestler, rivalRating, settings));
}

/**
 * Odds this week that the sheets work out where he went.
 *
 * Only runs once the deal has actually started, because that is when there is
 * something to notice: a man who is no longer on the shows he was on last
 * month. It climbs steeply, and it is allowed to reach near-certainty — sit
 * on a signed contract for two months and somebody will absolutely print it.
 */
export function exposureChance(
  signing: SecretSigning,
  currentWeek: number,
  settings: WorldSettings,
): number {
  if (stage(signing) !== 'signed') return 0;
  const since = Math.max(0, currentWeek - signing.freeWeek);
  return Math.min(
    settings.secretExposureCap,
    settings.secretExposureBase + since * settings.secretExposurePerWeek,
  );
}

export function rollExposure(
  rng: Rng,
  signing: SecretSigning,
  currentWeek: number,
  settings: WorldSettings,
): boolean {
  if (signing.blownWeek !== null) return false;
  return chance(rng, exposureChance(signing, currentWeek, settings));
}

/**
 * What the walkout is worth, as a multiplier on an ordinary debut.
 *
 * Everything about the moment is in this number, and the thing it is most
 * sensitive to is how quickly you used it. The night his old deal ran out is
 * worth the lot; a month later the room has had time to notice he stopped
 * appearing, work out why, and tell each other. It decays hard and it never
 * quite reaches zero, because a name is still a name.
 */
export function revealImpact(
  signing: SecretSigning,
  wrestler: Wrestler,
  currentWeek: number,
  settings: WorldSettings,
): number {
  const stature = wrestler.popularity / 100;
  const since = Math.max(0, currentWeek - signing.freeWeek);
  const freshness = 1 / (1 + since * settings.secretDebutDecayPerWeek);
  const surprise = signing.blownWeek === null ? 1 : settings.secretSigningBlownImpact;
  return settings.secretSigningBaseImpact * (0.4 + stature) * surprise * freshness;
}

/** Is it still a surprise? */
export function stillSecret(signing: SecretSigning): boolean {
  return signing.blownWeek === null;
}

/**
 * Can he be walked out tonight?
 *
 * Not while he is still under contract to them. That is the one hard rule the
 * whole thing rests on: no man works two shows.
 */
export function canWalkOut(signing: SecretSigning): boolean {
  return stage(signing) === 'signed';
}
