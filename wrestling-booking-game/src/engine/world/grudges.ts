// What a company remembers about working with you.
//
// `coopAppetite` has always taken a resentment figure, and its own doc comment
// has always said that resentment comes "from poaching, from being beaten
// badly on a previous joint show". The first was real. The second was not:
// the store computed resentment from the standing gap alone, so a partner you
// buried nine-nil last November would sit down with you in May as though
// nothing had happened.
//
// That made the supershow a dice roll against a rating difference rather than
// a relationship. It also removed the only interesting decision in the whole
// arrangement — how much of the joint card to *give away* — because there was
// no cost to taking everything.
//
// So: a grudge is a number a rival carries about you, earned on a night you
// both worked, and it fades. The shape is deliberately asymmetric. Burying a
// partner earns a lot of resentment quickly; dealing straight earns goodwill
// back slowly. That asymmetry is the whole reason a booker has to think about
// the split before the night rather than after it.

import { clamp } from '../rng';
import type { Id, WorldSettings } from '../types';

export interface Grudge {
  promotionId: Id;
  /** 0-100. Fed into coopAppetite, and it fades week by week. */
  resentment: number;
  /** Why. Reported to the player, never carried silently. */
  reason: string;
  /** The week it was last added to, for the write-up. */
  since: number;
}

/**
 * How one-sided the night was, from the partner's side. 0 = they won
 * everything, 1 = they won nothing.
 *
 * A joint card with no decisive finishes is not a burial, so a night where
 * neither side won anything reads as even rather than as a massacre.
 */
export function burialShare(playerWins: number, partnerWins: number): number {
  const total = playerWins + partnerWins;
  if (total === 0) return 0.5;
  return playerWins / total;
}

export interface NightAsTheySawIt {
  playerWins: number;
  partnerWins: number;
  /** Quarter stars, as the rest of the game counts them. */
  showStars: number;
}

/**
 * What the night did to how they feel about you.
 *
 * Positive is resentment earned, negative is goodwill. The two halves:
 *
 *   - **The split.** Above the fair share it climbs steeply, so taking three
 *     quarters of a card is much worse than taking three fifths. Below it, a
 *     booker who put the other company over goes into the black.
 *   - **The show itself.** A flop annoys everybody a little, whoever won. It
 *     is deliberately the smaller term — nobody minds losing on a great night
 *     nearly as much as they mind being buried on a bad one.
 */
export function grudgeFromNight(night: NightAsTheySawIt, settings: WorldSettings): number {
  const share = burialShare(night.playerWins, night.partnerWins);
  const over = share - settings.grudgeFairShare;

  const fromSplit =
    over > 0
      ? (over / Math.max(1 - settings.grudgeFairShare, 0.01)) ** 2 * settings.grudgeBurialMax
      : (over / Math.max(settings.grudgeFairShare, 0.01)) * settings.grudgeGenerosityMax;

  const fromShow = Math.max(0, settings.grudgeFlopStars - night.showStars) * settings.grudgeFlopWeight;

  return fromSplit + fromShow;
}

/** Apply a night to the ledger, creating the grudge if there was not one. */
export function rememberNight(
  existing: Grudge | undefined,
  promotionId: Id,
  night: NightAsTheySawIt,
  week: number,
  settings: WorldSettings,
): Grudge | null {
  const change = grudgeFromNight(night, settings);
  const resentment = clamp((existing?.resentment ?? 0) + change, 0, 100);

  // Nothing left to carry. Dropped rather than kept at zero so the ledger does
  // not fill up with companies who have no opinion.
  if (resentment <= 0) return null;

  return {
    promotionId,
    resentment,
    reason: reasonFor(night, change, settings),
    since: week,
  };
}

/**
 * Add resentment for a specific wrong that is not a joint night — a secret
 * signing revealed, say — rather than one derived from `grudgeFromNight`.
 * Same merge-and-clamp rule as a night's own tally: negative overwrites
 * carry it toward zero, and it is dropped once nothing is left to carry.
 */
export function addGrudge(
  existing: Grudge | undefined,
  promotionId: Id,
  amount: number,
  reason: string,
  week: number,
): Grudge | null {
  const resentment = clamp((existing?.resentment ?? 0) + amount, 0, 100);
  if (resentment <= 0) return null;
  return { promotionId, resentment, reason, since: week };
}

function reasonFor(night: NightAsTheySawIt, change: number, settings: WorldSettings): string {
  const share = burialShare(night.playerWins, night.partnerWins);
  if (change <= 0) return 'You did right by them last time.';
  if (share >= settings.grudgeMassacreShare) return 'You buried them on their own joint card.';
  if (share > settings.grudgeFairShare) return 'They went home with the short end of the card.';
  return 'The show was a flop and everybody noticed.';
}

/** Grudges fade. Slowly enough that a burial costs you the next season. */
export function decayGrudge(grudge: Grudge, settings: WorldSettings): Grudge | null {
  const resentment = grudge.resentment - settings.grudgeDecayPerWeek;
  return resentment <= 0 ? null : { ...grudge, resentment };
}

/** A whole ledger, a week older. */
export function decayGrudges(grudges: readonly Grudge[], settings: WorldSettings): Grudge[] {
  return grudges.map((g) => decayGrudge(g, settings)).filter((g): g is Grudge => g !== null);
}

export function grudgeAgainst(grudges: readonly Grudge[], promotionId: Id): Grudge | undefined {
  return grudges.find((g) => g.promotionId === promotionId);
}

/** What a rival is carrying, in words. Null when they hold nothing. */
export function grudgeLine(grudge: Grudge | undefined, partnerName: string): string | null {
  if (!grudge) return null;
  return `${partnerName} has not forgotten. ${grudge.reason}`;
}
