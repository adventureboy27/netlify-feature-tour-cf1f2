import type { Pronouns } from '../career/pronouns';
// Things going stale.
//
// The game had no concept of this at all, which quietly broke two systems and
// one design goal.
//
// `overexposurePenalty` has been a term in the match rating formula since it
// was written — matchRating.ts's own header reserves it for "pair chemistry /
// overexposure from match history" — and nothing has ever passed a value, so
// it has always been zero. Running the identical main event fifty-two weeks
// running cost exactly nothing, which meant a twelve-person roster was
// strictly cheaper than a thirty-five-person one: same rating, less payroll.
// The deep roster the game asks you to build had no mechanical reason to
// exist.
//
// `gimmickFreshness` is declared on Wrestler as "0-100, decays ~0.8/week" and
// nothing decayed it. It sat at 100 forever, which made the repackage event
// — gated on `gimmickFreshness < 60` — literally unreachable, and left the
// whole repackage system with no mechanical payoff: you reset a number that
// was already at its maximum.
//
// Both are the same idea, so they live together here: a crowd gets numb to
// what it has already been shown.

import type { Id, Segment, Show, Wrestler, WorldSettings } from '../types';
import { clamp } from '../rng';

/**
 * What the crowd has been shown lately.
 *
 * Derived from show history on read rather than stored, so there is no new
 * save state, nothing to migrate, and nothing that can fall out of sync with
 * what actually happened.
 */
export interface BookingMemory {
  /** How many separate weeks each wrestler has appeared on. */
  weeksSeen: Map<Id, number>;
  /** How many times each cross-side pairing has been run. */
  pairings: Map<string, number>;
}

/** Stable key for an unordered pair. */
function pairKey(a: Id, b: Id): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Every pairing a segment puts in front of the crowd.
 *
 * Cross-side only: two men on the same team are not a match-up. Counting
 * pairs rather than the whole participant set is what makes this read the way
 * a fan does — A versus B, and then A and C against B and D, is still A
 * versus B for the third week running.
 */
export function pairingsIn(segment: Segment): string[] {
  const competitors = segment.participants.filter((p) => p.role === 'competitor');
  const keys: string[] = [];
  for (let i = 0; i < competitors.length; i++) {
    for (let j = i + 1; j < competitors.length; j++) {
      const a = competitors[i]!;
      const b = competitors[j]!;
      if (a.side !== b.side) keys.push(pairKey(a.wrestlerId, b.wrestlerId));
    }
  }
  return keys;
}

/** What the crowd remembers, looking back the settings' window. */
export function recallBookings(
  shows: readonly Show[],
  currentWeek: number,
  settings: WorldSettings,
): BookingMemory {
  const weeksSeen = new Map<Id, number>();
  const pairings = new Map<string, number>();
  const oldest = currentWeek - settings.overexposureLookbackWeeks;

  for (const show of shows) {
    if (show.week <= oldest || show.week > currentWeek) continue;
    const seenThisWeek = new Set<Id>();
    for (const segment of show.segments) {
      for (const key of pairingsIn(segment)) {
        pairings.set(key, (pairings.get(key) ?? 0) + 1);
      }
      for (const p of segment.participants) {
        if (p.role === 'competitor') seenThisWeek.add(p.wrestlerId);
      }
    }
    for (const id of seenThisWeek) weeksSeen.set(id, (weeksSeen.get(id) ?? 0) + 1);
  }

  return { weeksSeen, pairings };
}

/**
 * A crowd's memory built from the roster rather than from show history.
 *
 * Rival promotions do not keep a show history — only the current week's card
 * survives in world state — so their overexposure is read off
 * `consecutiveWeeksWorked`, which aftermath.ts maintains for everybody in the
 * business, player and rival alike.
 *
 * This is deliberately weaker than the player's memory: it knows how hard
 * somebody has been worked but not who they were worked against, so a rival
 * pays for running the same *people* every week and not for running the same
 * *match*. Closing that gap needs a per-rival show history, which is save
 * state this does not justify — the rotation is what stops rival companies
 * booking themselves into the ground, and this delivers that.
 */
export function memoryFromRoster(roster: readonly Wrestler[]): BookingMemory {
  const weeksSeen = new Map<Id, number>();
  for (const w of roster) weeksSeen.set(w.id, w.consecutiveWeeksWorked);
  return { weeksSeen, pairings: new Map() };
}

/**
 * How numb the crowd is to this particular match, in rating points.
 *
 * Two separate sins, because they are separately avoidable:
 *
 *   Repetition — this exact match-up keeps happening. Driven by the most
 *   repeated pairing in it, not the average, because one stale pair is enough
 *   to make the whole thing feel like a rerun.
 *
 *   Overexposure — these people are on every single week. A draw who never
 *   goes away stops being an event, which is the pressure that makes a deep
 *   roster worth its payroll.
 *
 * Returned positive; the rating formula subtracts it.
 */
export function overexposurePenalty(
  segment: Segment,
  memory: BookingMemory,
  settings: WorldSettings,
): number {
  const repeats = Math.max(0, ...pairingsIn(segment).map((key) => memory.pairings.get(key) ?? 0));
  // The first meeting is free — a rematch is only stale once it is a habit.
  const repetition = Math.min(
    settings.overexposureRepeatCap,
    Math.max(0, repeats - settings.overexposureFreeMeetings) * settings.overexposureRepeatPenalty,
  );

  const competitors = segment.participants.filter((p) => p.role === 'competitor');
  const overworked = competitors.map((p) =>
    Math.max(0, (memory.weeksSeen.get(p.wrestlerId) ?? 0) - settings.overexposureFreeWeeks),
  );
  const exposure = Math.min(
    settings.overexposureAppearanceCap,
    (overworked.length > 0 ? Math.max(...overworked) : 0) * settings.overexposureAppearancePenalty,
  );

  return repetition + exposure;
}

/**
 * What a worn-out act costs the match, in rating points.
 *
 * Its own term rather than folded into overexposure, because §11.5 requires
 * the player can see exactly why a match rated what it did and "their act has
 * gone stale" and "you have run this match too often" are different problems
 * with different fixes — one is a repackage, the other is a night off.
 *
 * Scaled off the least fresh person in the match: a tired gimmick in there
 * with a hot one still drags.
 */
export function staleGimmickPenalty(participants: readonly Wrestler[], settings: WorldSettings): number {
  if (participants.length === 0) return 0;
  const stalest = Math.min(...participants.map((w) => w.gimmickFreshness));
  if (stalest >= settings.staleGimmickThreshold) return 0;
  const depth = (settings.staleGimmickThreshold - stalest) / settings.staleGimmickThreshold;
  return depth * settings.staleGimmickPenaltyMax;
}

/**
 * What the crowd's current opinion — momentum, already tracked, already
 * reaction-driven via wins/losses/feuds — implies freshness should be
 * heading toward. Neutral momentum (no real reaction either way) implies a
 * low target on purpose: an act nobody has an opinion about does not get
 * to coast, it drifts toward "wearing thin" same as a genuinely disliked
 * one drifts toward ice cold. Only real heat, well above neutral, sustains
 * a number that reads as fresh.
 */
export function heatTarget(momentum: number, settings: WorldSettings): number {
  const delta = momentum - settings.gimmickHeatNeutralMomentum;
  return clamp(settings.gimmickHeatNeutralTarget + delta * settings.gimmickHeatMomentumScale, 0, 100);
}

/**
 * A week passes and the act's heat moves toward whatever the crowd
 * currently thinks of them.
 *
 * Not a flat clock — the old version decayed by exposure alone, which
 * meant a genuinely over character wore out at the identical rate as one
 * nobody cared for, and there was no way to actually earn heat back short
 * of a full repackage. Now: drift toward `heatTarget`, faster while
 * actually being worked (the crowd only updates its opinion when it's
 * watching), slower while idle. Being seen and genuinely loved can hold or
 * climb; being seen and merely tolerated still wears thin, same shape as
 * before.
 *
 * Mutates, matching generate/repackage.ts which resets the same field.
 */
export function ageGimmick(wrestler: Wrestler, worked: boolean, settings: WorldSettings): void {
  const target = heatTarget(wrestler.momentum, settings);
  const rate = worked ? settings.gimmickHeatWorkedDriftRate : settings.gimmickHeatIdleDriftRate;
  wrestler.gimmickFreshness = clamp(wrestler.gimmickFreshness + (target - wrestler.gimmickFreshness) * rate, 0, 100);
}

/** Whether an act has gone stale enough that the player should hear about it. */
export function isStale(wrestler: Wrestler, settings: WorldSettings): boolean {
  return wrestler.gimmickFreshness < settings.staleGimmickThreshold;
}

/** Genuinely ice cold — past "stale" and into forced-meeting territory. See weeksIceCold. */
export function isIceCold(wrestler: Wrestler, settings: WorldSettings): boolean {
  return wrestler.gimmickFreshness <= settings.iceColdThreshold;
}

/**
 * How worn the act is, in words.
 *
 * §0's rule about stats: bars and words, never numbers. This existed as a
 * boolean nothing read, which meant a gimmick could decay for a year, drag
 * every match the man was in, and never appear anywhere the player looks —
 * the penalty was live and the diagnosis was not.
 */
export type FreshnessLabel = 'Fresh' | 'Settled in' | 'Wearing thin' | 'Nobody is buying it';

export function freshnessLabel(wrestler: Wrestler, settings: WorldSettings): FreshnessLabel {
  const stale = settings.staleGimmickThreshold;
  if (wrestler.gimmickFreshness >= stale + (100 - stale) / 2) return 'Fresh';
  if (wrestler.gimmickFreshness >= stale) return 'Settled in';
  if (wrestler.gimmickFreshness >= stale / 2) return 'Wearing thin';
  return 'Nobody is buying it';
}

/**
 * The same read as `freshnessLabel`, as a fire-to-ice icon — the "long
 * line, 🔥 on one end and ❄️ on the other" the player asked for. A separate
 * function rather than folding the icon into `freshnessLabel` itself: the
 * label is read by `RosterScreen`'s existing tag, the icon is read by the
 * motivation-style icon row (see career/motivation.ts's MotivationSymbol
 * shape, which this deliberately matches) — two different surfaces, same
 * underlying number.
 */
export function heatIcon(wrestler: Wrestler, settings: WorldSettings): string {
  const f = wrestler.gimmickFreshness;
  if (f >= settings.staleGimmickThreshold + (100 - settings.staleGimmickThreshold) / 2) return '🔥';
  if (f >= settings.staleGimmickThreshold) return '🙂';
  if (f > settings.iceColdThreshold) return '🥶';
  return '❄️';
}

/** The week it tips over, said once, rather than a status nobody looks at. */
export function goneStaleLine(name: string, who: Pronouns): string {
  return `${name}'s act has flat-out stopped working. This crowd has seen it all before, and it is costing every match ${who.they} is in until somebody freshens it up or ${who.they} gets a real run off.`;
}

/** Said once, the week an act crosses into genuinely ice cold. */
export function goneIceColdLine(name: string, who: Pronouns): string {
  return `${name} is getting absolutely nothing back from this crowd — no heat, no heel heat, dead silence. Somebody at the top needs to sit ${who.them} down about it before it gets any worse.`;
}
