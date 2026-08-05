// Earning a nickname.
//
// Nobody debuts as The Franchise. A nickname arrives after a few years, once
// the crowd has decided what somebody is — and it comes from what actually
// defines them in the ring, not from a random table. The man with the mouth
// gets a mouth nickname; the man nobody can hurt gets a toughness one; the
// one drawing the house gets one of the big ones.
//
// Deliberately slow. Rolled weekly at a low chance so nicknames trickle in
// over a career instead of arriving on a schedule, and never handed out
// twice — two Franchises in one world is one too many.

import type { Rng } from '../rng';
import { pick } from '../rng';
import type { Wrestler, WorldSettings } from '../types';
import { yearsPro } from '../career/status';
import {
  MAIN_EVENT_NICKNAMES,
  NICKNAMES_BY_ARCHETYPE,
  NICKNAMES_BY_SOURCE,
  NICKNAMES_BY_STYLE,
  type NicknameSource,
} from '../../data/nicknames';

export interface NicknameContext {
  currentYear: number;
  settings: WorldSettings;
}

/**
 * Has this person been around long enough, and got over far enough, to be
 * called something? Both are required: a decade of curtain-jerking earns
 * nothing, and neither does a hot rookie six months in.
 */
export function hasEarnedNickname(w: Wrestler, ctx: NicknameContext): boolean {
  if (w.nickname) return false;
  if (yearsPro(w, ctx.currentYear) < ctx.settings.nicknameYearsPro) return false;
  return (
    w.popularity >= ctx.settings.nicknamePopularity ||
    w.careerHighPopularity >= ctx.settings.nicknamePopularity ||
    w.titleReigns.length > 0
  );
}

/**
 * What this wrestler is *for*, in the crowd's eyes. Whichever of their
 * defining qualities stands furthest above the rest wins; the thresholds are
 * relative so a roster of nobodies still produces distinguishable nicknames.
 */
export function nicknameSource(w: Wrestler, ctx: NicknameContext): NicknameSource {
  const candidates: [NicknameSource, number][] = [
    ['mic', w.charisma],
    ['power', w.strength],
    ['technique', w.skill],
    ['speed', w.agility],
    ['toughness', w.toughness],
    // Ego and alignment are not 0-100 stats in the same sense, so they are
    // scored against their own thresholds rather than compared raw.
    ['ego', w.ego >= ctx.settings.nicknameEgoThreshold ? w.ego : 0],
    ['heel', w.alignment <= -60 ? 60 + Math.abs(w.alignment) / 2 : 0],
    ['face', w.alignment >= 60 ? 60 + w.alignment / 2 : 0],
    ['veteran', yearsPro(w, ctx.currentYear) >= ctx.settings.veteranYearsPro ? 70 : 0],
  ];

  return candidates.reduce((best, current) => (current[1] > best[1] ? current : best))[0];
}

/**
 * Give this wrestler a nickname, or null if nothing is available. `taken` is
 * every nickname already in use anywhere in the world.
 */
export function generateNickname(
  rng: Rng,
  w: Wrestler,
  taken: ReadonlySet<string>,
  ctx: NicknameContext,
): string | null {
  const free = (pool: readonly string[]) => pool.filter((n) => !taken.has(n));

  // A genuine draw gets one of the big ones, most of the time — that is what
  // being the guy sounds like.
  if (w.popularity >= ctx.settings.nicknameMainEventPopularity) {
    const grand = free(MAIN_EVENT_NICKNAMES);
    if (grand.length > 0 && rng.next() < ctx.settings.nicknameMainEventChance) return pick(rng, grand);
  }

  // Otherwise: what defines them, then what they work like, then their
  // archetype as a last resort.
  const pools = [
    free(NICKNAMES_BY_SOURCE[nicknameSource(w, ctx)]),
    free(NICKNAMES_BY_STYLE[w.style] ?? []),
    free(NICKNAMES_BY_ARCHETYPE[w.archetype]),
  ];

  for (const pool of pools) {
    if (pool.length > 0) return pick(rng, pool);
  }
  return null;
}

/**
 * The weekly roll. Returns the nickname awarded, or null. Kept separate from
 * generateNickname so the "does it happen this week" chance is testable on
 * its own and the generator stays deterministic when called directly.
 */
export function rollForNickname(
  rng: Rng,
  w: Wrestler,
  taken: ReadonlySet<string>,
  ctx: NicknameContext,
): string | null {
  if (!hasEarnedNickname(w, ctx)) return null;
  if (rng.next() >= ctx.settings.nicknameWeeklyChance) return null;
  return generateNickname(rng, w, taken, ctx);
}

/** How the announcer says it. */
export function billedAs(w: Wrestler): string {
  return w.nickname ? `“${w.nickname}” ${w.name}` : w.name;
}
