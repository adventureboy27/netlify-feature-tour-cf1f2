// Who got hurt, and what the write-up says about it.
//
// This module exists because of the rule in CLAUDE.md: nothing happens to a
// person off-screen. Before it, a wrestler could go on the shelf for fourteen
// weeks and the only evidence was an icon appearing on a roster card. The
// player had no idea which match did it or what gave out.
//
// So an injury is not a flag any more. It is a cause, a named body part, a
// sentence, and a number of weeks — produced together, so it is impossible to
// hurt somebody without also being able to say how.
//
// Referees and managers are in here for the same reason. They stand in the
// middle of the same fight; a system that could only hurt competitors was
// modelling the ring and not the room.

import type { Rng } from '../rng';
import { chance, pick } from '../rng';
import type { Injury, InjurySeverity, WorldSettings } from '../types';
import { causesFor, injuryCauseById, type CasualtyRole } from '../../data/casualties';

/** Somebody hurt, and the sentence that says so. */
export interface Casualty {
  personId: string;
  name: string;
  role: CasualtyRole;
  causeId: string;
  /** The line the write-up runs. Never empty. */
  text: string;
  weeks: number;
  severity: InjurySeverity;
}

function severityFor(weeks: number, settings: WorldSettings): InjurySeverity {
  if (weeks >= settings.injuryCareerThreateningWeeks) return 'careerThreatening';
  if (weeks >= settings.injurySevereWeeks) return 'severe';
  if (weeks >= settings.injuryModerateWeeks) return 'moderate';
  return 'minor';
}

export interface CasualtyContext {
  personId: string;
  name: string;
  role: CasualtyRole;
  violenceLevel: number;
  /** Scales how long it keeps them out and how likely it is at all. */
  injuryMultiplier: number;
  /** Tougher people are hurt less often and less badly. */
  toughness: number;
  settings: WorldSettings;
}

/**
 * Roll an injury for one person, or nothing.
 *
 * The odds differ by what they were doing: a competitor is in the match, a
 * referee is in the way, a manager is at ringside asking for it. A guest
 * referee is the worst of both — in the middle of it without a wrestler's
 * licence to defend themselves.
 */
export function rollCasualty(rng: Rng, ctx: CasualtyContext): Casualty | null {
  const s = ctx.settings;
  const base =
    ctx.role === 'competitor'
      ? s.casualtyChanceCompetitor
      : ctx.role === 'guestReferee'
        ? s.casualtyChanceGuestReferee
        : ctx.role === 'referee'
          ? s.casualtyChanceReferee
          : s.casualtyChanceManager;

  // Violence and bad blood raise it; being hard to hurt lowers it.
  const odds = base * ctx.injuryMultiplier * (1 - ctx.toughness / 200);
  if (!chance(rng, Math.min(s.casualtyChanceCap, odds))) return null;

  const options = causesFor(ctx.role, ctx.violenceLevel);
  if (options.length === 0) return null;
  const cause = pick(rng, options);

  // The listed weeks are a centre, not a verdict — the same injury keeps one
  // wrestler out a month and ends another one's year.
  const swing = 1 + (rng.next() - 0.5) * 2 * s.casualtyWeeksVariance;
  const weeks = Math.max(1, Math.round(cause.weeks * swing * ctx.injuryMultiplier));

  return {
    personId: ctx.personId,
    name: ctx.name,
    role: ctx.role,
    causeId: cause.id,
    text: pick(rng, cause.lines).replace(/\{name\}/g, ctx.name),
    weeks,
    severity: severityFor(weeks, s),
  };
}

/** Turn a casualty into the Injury record the rest of the game reads. */
export function injuryFrom(casualty: Casualty, week: number): Injury {
  return {
    severity: casualty.severity,
    // The label, not a generic "Injured" — this is what a roster card shows.
    description: injuryCauseById(casualty.causeId)?.label ?? 'Injured',
    sufferedWeek: week,
    totalWeeks: casualty.weeks,
    weeksRemaining: casualty.weeks,
    permanentStatLoss: {},
    earlyReturnWeeksUsed: 0,
  };
}

/**
 * The line for a finish that stopped because somebody could not continue.
 *
 * Kept separate from the roll because this one is not optional: an
 * injuryStoppage finish *must* be able to say who and why, or the finish is a
 * mystery.
 */
export function stoppageCasualty(rng: Rng, ctx: CasualtyContext): Casualty {
  const options = causesFor(ctx.role, ctx.violenceLevel);
  const cause = options.length > 0 ? pick(rng, options) : injuryCauseById('concussion')!;
  const swing = 1 + (rng.next() - 0.5) * 2 * ctx.settings.casualtyWeeksVariance;
  const weeks = Math.max(1, Math.round(cause.weeks * swing * ctx.injuryMultiplier));
  return {
    personId: ctx.personId,
    name: ctx.name,
    role: ctx.role,
    causeId: cause.id,
    text: pick(rng, cause.lines).replace(/\{name\}/g, ctx.name),
    weeks,
    severity: severityFor(weeks, ctx.settings),
  };
}

/** How long somebody is out, in words. Never a bare number of weeks. */
export function outFor(weeks: number, settings: WorldSettings): string {
  if (weeks >= settings.injuryCareerThreateningWeeks) return 'out indefinitely';
  if (weeks >= settings.injurySevereWeeks) return 'out for months';
  if (weeks >= settings.injuryModerateWeeks) return 'out for weeks';
  return 'should be back soon';
}
