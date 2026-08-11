// A wrestler's week, outside the ring.
//
// Nothing used to happen to anybody between shows. You were healthy or you
// were hurt, and only a match could change either — so the six days between
// cards were a blank. People get hurt in gyms and cars and bar fights, and
// people miss shows for reasons that have nothing to do with wrestling.
//
// The dice are weighted hard toward nothing at all, and within "something",
// hard toward the cheap end: a blown tyre is common, being jumped in the
// parking lot is rare, a car wreck is rarer still. Most weeks this function
// returns null for everybody on the roster.
//
// The interesting half is the no-show. A wrestler who does not make the
// building still has a match booked, so somebody has to go out there — and
// the office picks. That is a mystery opponent nobody planned, in a match
// nobody planned, which is exactly the kind of night that starts a feud.
//
// Everything here is reported. CLAUDE.md: nothing happens to a person
// off-screen, and every one of these says how.

import type { Rng } from '../rng';
import { chance, pick, randInt } from '../rng';
import { MISFORTUNES, type MisfortuneDefinition, type MisfortuneKind } from '../../data/misfortunes';
import type { Id, Injury, Wrestler, WorldSettings } from '../types';

export interface Misfortune {
  wrestlerId: Id;
  wrestlerName: string;
  definitionId: string;
  kind: MisfortuneKind;
  label: string;
  /** What happened, in words, with the name already in it. */
  text: string;
  /** Set for injuries and aggravations. */
  weeks: number | null;
  /** Somebody did this to them, and the write-up should wonder who. */
  attacked: boolean;
}

/** Weighted draw over whatever could have happened to this person. */
function drawDefinition(rng: Rng, candidates: MisfortuneDefinition[]): MisfortuneDefinition | null {
  const total = candidates.reduce((sum, d) => sum + d.weight, 0);
  if (total <= 0) return null;
  let roll = rng.next() * total;
  for (const definition of candidates) {
    roll -= definition.weight;
    if (roll <= 0) return definition;
  }
  return candidates[candidates.length - 1] ?? null;
}

/**
 * Does anything happen to this person this week?
 *
 * Two separate gates, because they are separate risks: somebody healthy might
 * have an accident, and somebody already hurt might make it worse. The second
 * is much likelier than the first, which is the honest shape of it — the
 * dangerous time for an injury is while you still have one.
 */
export function rollMisfortune(rng: Rng, wrestler: Wrestler, settings: WorldSettings): Misfortune | null {
  if (wrestler.deceased || wrestler.careerStatus === 'retired') return null;

  const hurt = Boolean(wrestler.injury);
  const odds = hurt ? settings.misfortuneChanceInjured : settings.misfortuneChanceHealthy;
  if (!chance(rng, odds)) return null;

  const candidates = MISFORTUNES.filter((m) => m.requires === (hurt ? 'injured' : 'healthy'));
  const definition = drawDefinition(rng, candidates);
  if (!definition) return null;

  const weeks = definition.weeks
    ? randInt(rng, definition.weeks[0], definition.weeks[1])
    : null;

  return {
    wrestlerId: wrestler.id,
    wrestlerName: wrestler.name,
    definitionId: definition.id,
    kind: definition.kind,
    label: definition.label,
    text: pick(rng, definition.lines).replace(/\{name\}/g, wrestler.name),
    weeks,
    attacked: Boolean(definition.impliesAttacker),
  };
}

/** The injury an out-of-the-ring misfortune leaves behind. */
export function injuryFromMisfortune(misfortune: Misfortune, week: number, existing: Injury | null): Injury {
  const weeks = misfortune.weeks ?? 1;
  // An aggravation adds to what was already wrong rather than replacing it —
  // that is what makes it a setback rather than a fresh start.
  const total = existing ? existing.weeksRemaining + weeks : weeks;
  return {
    severity: total >= 16 ? 'careerThreatening' : total >= 8 ? 'severe' : total >= 4 ? 'moderate' : 'minor',
    description: misfortune.label === 'Setback' ? `${existing?.description ?? 'The injury'}, worse` : misfortune.text,
    sufferedWeek: existing?.sufferedWeek ?? week,
    totalWeeks: total,
    weeksRemaining: total,
    permanentStatLoss: existing?.permanentStatLoss ?? {},
    earlyReturnWeeksUsed: existing?.earlyReturnWeeksUsed ?? 0,
  };
}

// ---------------------------------------------------------------------------
// The mystery opponent
// ---------------------------------------------------------------------------

export interface Replacement {
  /** Who did not make it. */
  absentId: Id;
  absentName: string;
  /** Who went out there instead. */
  replacementId: Id;
  replacementName: string;
}

/**
 * Who the office sends out when somebody does not turn up.
 *
 * Weighted toward people near the missing wrestler's level, because the match
 * still has to be worth watching, but deliberately not *only* the closest
 * match — the whole appeal of a mystery opponent is that it might be somebody
 * nobody expected. A wide draw with a strong pull toward the middle.
 *
 * Returns null when there is genuinely nobody, and the match comes off the
 * card instead.
 */
export function pickReplacement(
  rng: Rng,
  absent: Wrestler,
  candidates: readonly Wrestler[],
  settings: WorldSettings,
): Wrestler | null {
  if (candidates.length === 0) return null;

  const weighted = candidates.map((w) => {
    const gap = Math.abs(w.popularity - absent.popularity);
    // A floor keeps everybody in the hat: the unlikeliest name on the roster
    // is still possible, which is where the surprise comes from.
    const closeness = Math.max(settings.mysteryOpponentLongShotWeight, 100 - gap);
    return { w, weight: closeness };
  });

  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng.next() * total;
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) return entry.w;
  }
  return weighted[weighted.length - 1]!.w;
}

/** How the results page announces it. */
export function mysteryOpponentLine(replacement: Replacement, misfortune: Misfortune | null): string {
  const why = misfortune ? ` ${misfortune.text}` : '';
  return `${replacement.absentName} never made the building, so ${replacement.replacementName} went out there instead.${why}`;
}
