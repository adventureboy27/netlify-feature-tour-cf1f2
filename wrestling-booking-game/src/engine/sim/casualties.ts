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
  /** How bad it is, 0-100. The number severity is a label for. */
  grade: number;
  personId: string;
  name: string;
  role: CasualtyRole;
  causeId: string;
  /** The line the write-up runs. Never empty. */
  text: string;
  weeks: number;
  severity: InjurySeverity;
}

/**
 * Grade from a rolled length.
 *
 * The roll still produces weeks, because the injury causes are written in
 * weeks and that is the honest unit for "a torn hamstring". Grade is that
 * expressed on the scale everything else reads, and once it exists the weeks
 * are re-derived from it every week rather than counted down.
 */
export function gradeFromLength(weeks: number, settings: WorldSettings): number {
  return Math.max(1, Math.min(100, Math.round((weeks / settings.gradeWeeksAtWorst) * 100)));
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
  /** The stipulation this match is under, if any — gates hardware-specific causes. */
  stipulationId?: string | null;
}

/**
 * How long an injury keeps somebody out.
 *
 * `injuryMultiplier` carries everything that made the match dangerous —
 * stipulation, pace, bad blood, nobody at ringside to stop it, a blown spot, a
 * body that breaks easily — and it used to scale the *length* as hard as it
 * scaled the odds. Those compound: a hardcore match with a botch in it and a
 * fragile wrestler is about ten times, which turned a six-week injury into a
 * sixty-week one. That is where a measured save's worst injury of sixty-six
 * weeks came from, and why two in five injuries were eight weeks or longer.
 *
 * A dangerous match should make an injury much more *likely* and only somewhat
 * *worse*, so the length scales sub-linearly. The odds are left alone: that is
 * the honest place for danger to show up.
 */
function weeksOut(rng: Rng, cause: { weeks: number }, multiplier: number, settings: WorldSettings): number {
  const swing = 1 + (rng.next() - 0.5) * 2 * settings.casualtyWeeksVariance;
  const worse = Math.pow(Math.max(0.01, multiplier), settings.casualtyLengthExponent);

  // And once in a long while it is the bad one. Deliberately its own roll
  // rather than the far end of the multiplier: a career-threatening injury
  // should be a rare, awful thing that can happen to anybody in any match, not
  // something a booker can reliably manufacture by stacking a dangerous card —
  // and when the compounding above was capped, these stopped happening at all,
  // which is not what anybody wanted either.
  const catastrophic = chance(rng, settings.casualtyCatastrophicChance)
    ? settings.casualtyCatastrophicMultiplier
    : 1;

  return Math.max(1, Math.round(cause.weeks * swing * worse * catastrophic));
}

/**
 * How much unskilled hands raise the danger for a competitor, on top of
 * everything else already in `injuryMultiplier`.
 *
 * Compounds rather than averages: a green wrestler paired with a veteran is
 * still mostly safe, because the veteran is the one controlling the
 * exchange — real ring skill protects whoever you're in there with, not
 * just yourself. Two green wrestlers together is where it actually
 * multiplies, because neither one knows how to take care of the other.
 */
export function skillDangerMultiplier(
  personSkill: number,
  opponentSkills: readonly number[],
  settings: WorldSettings,
): number {
  if (opponentSkills.length === 0) return 1;
  const opponentAvg = opponentSkills.reduce((sum, s) => sum + s, 0) / opponentSkills.length;
  const personGap = 1 - Math.max(0, Math.min(100, personSkill)) / 100;
  const opponentGap = 1 - Math.max(0, Math.min(100, opponentAvg)) / 100;
  return 1 + personGap * opponentGap * settings.skillInjuryWeight;
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

  const options = causesFor(ctx.role, ctx.violenceLevel, ctx.stipulationId);
  if (options.length === 0) return null;
  const cause = pick(rng, options);

  // The listed weeks are a centre, not a verdict — the same injury keeps one
  // wrestler out a month and ends another one's year.
  const weeks = weeksOut(rng, cause, ctx.injuryMultiplier, s);
  const grade = gradeFromLength(weeks, s);

  return {
    grade,
    personId: ctx.personId,
    name: ctx.name,
    role: ctx.role,
    causeId: cause.id,
    text: pick(rng, cause.lines).replace(/\{name\}/g, ctx.name),
    weeks,
    severity: severityOf(grade, s),
  };
}


// ===========================================================================
// How bad it is, as a number
//
// Severity used to be a label inferred from how many weeks somebody was out,
// which made it a description of the injury rather than a property of it.
// Nothing could ask "how hurt is he *now*", so nothing could answer the
// questions that matter: is it safe to use him, is it getting better, what
// happens if we send him out on it.
//
// `grade` is that number, 0-100, and it is the thing that moves. Weeks out is
// an estimate derived from it and recomputed every week, so a man who is
// looking after himself comes back sooner than anyone said and a man who is
// not does not come back at all.
//
// The player never sees the number (§0). They see words and a bar.

/** Where the labels sit on the 0-100 scale. */
export function severityOf(grade: number, settings: WorldSettings): InjurySeverity {
  if (grade >= settings.gradeCareerThreatening) return 'careerThreatening';
  if (grade >= settings.gradeSevere) return 'severe';
  if (grade >= settings.gradeModerate) return 'moderate';
  return 'minor';
}

/**
 * How long this keeps somebody out, from how bad it is.
 *
 * Recomputed every week rather than counted down from a verdict, which is what
 * lets the same injury take one wrestler four weeks and another eight.
 */
export function weeksFromGrade(grade: number, settings: WorldSettings): number {
  if (grade <= 0) return 0;
  return Math.max(1, Math.round((grade / 100) * settings.gradeWeeksAtWorst));
}

/** Below this they can be booked again — still carrying it, but working. */
export function fitToWork(grade: number, settings: WorldSettings): boolean {
  return grade < settings.gradeFitToWork;
}

/**
 * What working on it does to the injury, per week, by what they are doing.
 *
 * Resting is the only thing that properly mends it. Training on it heals at a
 * fraction, because you are not looking after it. Wrestling on it makes it
 * slightly worse — deliberately slightly: the real cost of going out hurt is
 * not this drift, it is `workingHurtRisk` below, and a bleed big enough to
 * feel on its own would make the decision obvious rather than tempting.
 */
export function healPerWeek(
  doing: 'gym' | 'ring' | 'appearances' | 'rest' | 'wrestled',
  settings: WorldSettings,
): number {
  switch (doing) {
    case 'rest':
      return -settings.gradeHealResting;
    case 'appearances':
      return -settings.gradeHealResting * settings.gradeHealLightDutyShare;
    case 'gym':
    case 'ring':
      return -settings.gradeHealResting * settings.gradeHealTrainingShare;
    case 'wrestled':
      return settings.gradeWorsenPerMatch;
  }
}

/**
 * How much more likely a hurt wrestler is to be hurt again.
 *
 * There has always been a cost — `workingHurtRisk` in world/titleDefence.ts
 * applied a flat multiplier the moment a booker cleared somebody. What it
 * could not do is care *how hurt they were*, because nothing knew: severity
 * was a label inferred from a week count. Sending a man out on a knock and
 * sending him out on a torn knee carried exactly the same risk.
 *
 * Climbs steeply rather than linearly, so a knock is a small risk and a bad
 * injury is a genuinely reckless one.
 */
export function riskFromGrade(grade: number, settings: WorldSettings): number {
  if (grade <= 0) return 1;
  const share = Math.min(1, grade / 100);
  return 1 + Math.pow(share, settings.gradeRiskCurve) * settings.gradeRiskAtWorst;
}

/**
 * What a fresh injury does to somebody who was already carrying one.
 *
 * Never a replacement — that would let a bad knee be laundered by a light
 * knock. It stacks, so going out on something serious and getting hurt again
 * is how a severe injury becomes a career-threatening one.
 */
export function aggravate(existingGrade: number, freshGrade: number, settings: WorldSettings): number {
  return Math.min(100, Math.max(freshGrade, existingGrade + freshGrade * settings.gradeAggravationShare));
}

/** What the write-up says when somebody goes out on it and it gives way. */
export function aggravationLine(name: string, before: InjurySeverity, after: InjurySeverity): string {
  if (before === after) return `${name} went out there hurt, plain and simple, and came back a whole lot worse for it.`;
  return `${name} never should have been anywhere near that ring tonight. What was ${SEVERITY_WORDS[before]} is ${SEVERITY_WORDS[after]} now.`;
}

const SEVERITY_WORDS: Record<InjurySeverity, string> = {
  minor: 'a knock',
  moderate: 'a real problem',
  severe: 'serious',
  careerThreatening: 'the kind of thing that ends careers',
};

/** How hurt somebody is, in words. Never the number (§0). */
export function injuryWord(grade: number, settings: WorldSettings): string {
  if (grade <= 0) return 'Fit';
  if (grade < settings.gradeFitToWork) return 'Carrying a knock';
  if (grade < settings.gradeSevere) return 'Not right yet';
  if (grade < settings.gradeCareerThreatening) return 'Badly hurt';
  return 'In a bad way';
}

/** Turn a casualty into the Injury record the rest of the game reads. */
export function injuryFrom(casualty: Casualty, week: number): Injury {
  return {
    severity: casualty.severity,
    grade: casualty.grade,
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
  const options = causesFor(ctx.role, ctx.violenceLevel, ctx.stipulationId);
  const cause = options.length > 0 ? pick(rng, options) : injuryCauseById('concussion')!;
  const weeks = weeksOut(rng, cause, ctx.injuryMultiplier, ctx.settings);
  const grade = gradeFromLength(weeks, ctx.settings);
  return {
    grade,
    personId: ctx.personId,
    name: ctx.name,
    role: ctx.role,
    causeId: cause.id,
    text: pick(rng, cause.lines).replace(/\{name\}/g, ctx.name),
    weeks,
    severity: severityOf(grade, ctx.settings),
  };
}

/** How long somebody is out, in words. Never a bare number of weeks. */
export function outFor(weeks: number, settings: WorldSettings): string {
  if (weeks >= settings.injuryCareerThreateningWeeks) return 'out indefinitely';
  if (weeks >= settings.injurySevereWeeks) return 'out for months';
  if (weeks >= settings.injuryModerateWeeks) return 'out for weeks';
  // Every branch has to read correctly after "is", because that is how the
  // results page and the wire both say it. "X is should be back soon" shipped
  // for every short injury in the game until somebody read one out loud.
  return 'out for a week or two';
}
