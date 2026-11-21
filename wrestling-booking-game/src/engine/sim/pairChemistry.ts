// Some pairings just work, and some never do.
//
// matchRating.ts has carried a `pairChemistryBonus` context field since the
// rating formula was written — its own header reserves the term for "pair
// chemistry / overexposure from match history" — and nothing has ever
// computed one. Every caller passes zero. That is the same shape of gap
// sim/freshness.ts closed for `overexposurePenalty`: a term the formula
// already reads, sitting dead.
//
// Two things feed it, layered:
//
//   Innate chemistry — a fact about the two of them, not a state. Rolled
//   once, off nothing but their own ids, and never touched again. Most
//   pairings land near neutral. A real minority land clearly good or clearly
//   bad, and no amount of booking moves a bad one — that is the point.
//
//   Shared history — what a pairing's own past, actually-blown-off stories
//   are worth tonight. Nothing told yet is worth nothing. Brought back too
//   soon after the last blow-off costs rating, worse the more times it has
//   already happened — trying to catch lightning in a bottle twice in a row.
//   Brought back after a real gap earns a spark scaled by how good that last
//   chapter was, fading a little with every additional revival, so the
//   tenth reunion of a legendary pairing reads as fine rather than as
//   special as the first. Ricky Steamboat and Ric Flair, not Ricky Steamboat
//   and Ric Flair every six weeks for a year.
//
// Legend status is the same shared history read a different way: a pairing
// that has told two genuinely great stories has earned something a single
// good match never does.

import { rngFromSeed, gaussian, clamp } from '../rng';
import type { Id, Segment, WorldSettings } from '../types';
import type { Storyline } from '../world/storyline';
import { pairingsIn } from './freshness';

/** One resolved chapter of a pairing's shared history. */
export interface PastBlowoff {
  week: number;
  quality: number;
}

/**
 * Every blow-off this exact pairing has already told, oldest first.
 *
 * Matches on the exact participant set, the same rule storylineBetween uses
 * for "these two are already in a story" — swap a tag partner out and it is
 * a different pairing, not a chapter of this one. Only blown-off arcs count:
 * a fizzled attempt never happened as far as the crowd's memory of these two
 * together goes, and `blowOffQuality` is what makes a blow-off countable —
 * a story that resolved before that field existed contributes nothing
 * rather than crashing.
 */
export function pastBlowoffs(
  storylines: readonly Storyline[],
  participantIds: readonly Id[],
): PastBlowoff[] {
  return storylines
    .filter(
      (s) =>
        s.stage === 'blownOff' &&
        s.blowOffQuality !== undefined &&
        s.participantIds.length === participantIds.length &&
        s.participantIds.every((id) => participantIds.includes(id)),
    )
    .map((s) => ({ week: s.resolvedWeek ?? s.lastAdvancedWeek, quality: s.blowOffQuality! }))
    .sort((a, b) => a.week - b.week);
}

/**
 * Whether these two just click, or just don't.
 *
 * Entity-seeded off the sorted pair of ids rather than drawn from the shared
 * stream — the same reasoning as every other per-entity roll in this
 * codebase (see the root CLAUDE.md's note on RNG order): this must never
 * shift an unrelated seeded roll, and it must come back the same way every
 * time the same two people are checked.
 */
export function innateChemistry(participantIds: readonly Id[], settings: WorldSettings): number {
  const key = [...participantIds].sort().join('|');
  const rng = rngFromSeed(`chemistry:${key}`);
  return clamp(
    gaussian(rng, settings.chemistryMean, settings.chemistrySpread),
    settings.chemistryFloor,
    settings.chemistryCeiling,
  );
}

/**
 * What a pairing's own shared history is worth tonight — the spark, or the
 * cost of reaching for it too soon.
 */
export function sharedHistoryBonus(
  history: readonly PastBlowoff[],
  currentWeek: number,
  settings: WorldSettings,
): number {
  if (history.length === 0) return 0;

  const mostRecent = history[history.length - 1]!;
  const weeksSince = currentWeek - mostRecent.week;
  const revivals = history.length;

  if (weeksSince < settings.rivalryRestWeeks) {
    const shortfall = (settings.rivalryRestWeeks - weeksSince) / settings.rivalryRestWeeks;
    return -shortfall * settings.rivalryTooSoonPenalty * (1 + (revivals - 1) * 0.3);
  }

  const best = Math.max(...history.map((h) => h.quality));
  const fade = 1 / (1 + (revivals - 1) * settings.rivalrySparkFadePerRevival);
  return best * settings.rivalrySparkWeight * fade;
}

/** Both terms folded into the one number the rating formula actually reads. */
export function pairChemistryBonus(
  participantIds: readonly Id[],
  storylines: readonly Storyline[],
  currentWeek: number,
  settings: WorldSettings,
): number {
  const history = pastBlowoffs(storylines, participantIds);
  return clamp(
    innateChemistry(participantIds, settings) + sharedHistoryBonus(history, currentWeek, settings),
    settings.chemistryBonusFloor,
    settings.chemistryBonusCeiling,
  );
}

/**
 * A whole segment's worth, averaged across every cross-side pairing it
 * actually puts in front of the crowd. A one-on-one match is exactly one
 * pairing; a battle royal is dozens of mostly-neutral ones, which is why
 * this term naturally matters most for the small matches it is meant to
 * describe without needing to special-case them.
 */
export function segmentPairChemistry(
  segment: Segment,
  storylines: readonly Storyline[],
  currentWeek: number,
  settings: WorldSettings,
): number {
  const keys = pairingsIn(segment);
  if (keys.length === 0) return 0;
  const total = keys.reduce((sum, key) => {
    const [a, b] = key.split('|') as [Id, Id];
    return sum + pairChemistryBonus([a, b], storylines, currentWeek, settings);
  }, 0);
  return total / keys.length;
}

/** How a pairing's own, fixed chemistry reads out loud — never the number itself. */
export function chemistryLabel(innate: number, settings: WorldSettings): string {
  const clickBar = settings.chemistryCeiling * 0.55;
  const dudBar = settings.chemistryFloor * 0.55;
  if (innate >= clickBar) return 'These two just click.';
  if (innate <= dudBar) return "This pairing has never worked, and running it back probably won't help.";
  return 'Nothing special either way — a perfectly ordinary pairing.';
}

export type LegendStatus = 'none' | 'notable' | 'allTime';

/**
 * What a pairing's shared history has actually earned.
 *
 * Two genuinely great nights together is an all-time rivalry. One great
 * night, or a couple of merely good ones, is a classic worth remembering.
 * Below that it is just a rivalry like any other, whatever the crowd made of
 * any one night in it.
 */
export function legendStatus(history: readonly PastBlowoff[], settings: WorldSettings): LegendStatus {
  const great = history.filter((h) => h.quality >= settings.storylineGreatBlowoff).length;
  const fair = history.filter((h) => h.quality >= settings.storylineFairBlowoff).length;
  if (great >= settings.allTimeRivalGreatBlowoffs) return 'allTime';
  if (great >= 1 || fair >= settings.classicRivalryFairBlowoffs) return 'notable';
  return 'none';
}

/** One pairing's whole shared history, grouped — the raw material for the All-Time Rivals and Classic Rivalries pages. */
export interface PairingHistory {
  participantIds: Id[];
  history: PastBlowoff[];
}

/** Every distinct pairing that has ever told at least one blown-off story. */
export function allPairingHistories(storylines: readonly Storyline[]): PairingHistory[] {
  const byKey = new Map<string, PairingHistory>();
  for (const s of storylines) {
    if (s.stage !== 'blownOff' || s.blowOffQuality === undefined) continue;
    const key = [...s.participantIds].sort().join('|');
    const entry = byKey.get(key) ?? { participantIds: [...s.participantIds].sort(), history: [] };
    entry.history.push({ week: s.resolvedWeek ?? s.lastAdvancedWeek, quality: s.blowOffQuality });
    byKey.set(key, entry);
  }
  for (const entry of byKey.values()) entry.history.sort((a, b) => a.week - b.week);
  return [...byKey.values()];
}
