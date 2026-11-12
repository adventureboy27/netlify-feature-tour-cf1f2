// Owner mandates — §17.
//
// LOCKED in the spec, and it is the reason this system is worth having: the
// owner can and will fire you. Three failed mandates ends the run. Everything
// else in this game is a slow economy the player can dig out of; this is the
// one thing that can end a save in a month, and knowing that is what makes the
// four-week clock feel like a clock.
//
// Two rules keep it fair rather than arbitrary:
//
//   1. A MANDATE MUST BE ACHIEVABLE WHEN IT IS ISSUED. Every generator checks
//      the world before it asks. Nobody is told to reach a company rating they
//      are already past, or to cut payroll they have already cut, or to sign
//      somebody who does not exist. An impossible demand is not pressure, it is
//      a bug with a countdown.
//
//   2. THE PLAYER IS TOLD THE TERMS, NEVER THE ODDS. The mandate says exactly
//      what is wanted and exactly when it is due. It does not say whether you
//      can do it — that is the same rule the rest of the game plays by.
//
// Progress is checked on read rather than tracked, because everything a
// mandate cares about is already somewhere in the world. Nothing here mutates.

import type { Rng } from '../rng';
import { pick, weightedPick } from '../rng';
import type {
  MandateType,
  OwnerMandate,
  OwnerPersonality,
  Promotion,
  Territory,
  Title,
  WorldSettings,
  Wrestler,
} from '../types';
import { MANDATE_TEXT, ownerProfile } from '../../data/owners';

/** Everything a mandate can be built from, or judged against. */
export interface MandateContext {
  week: number;
  promotion: Promotion;
  personality: OwnerPersonality;
  /** The promotion's own people. */
  roster: readonly Wrestler[];
  /** Everybody unsigned, for a "go and get them" mandate. */
  available: readonly Wrestler[];
  titles: readonly Title[];
  territories: readonly Territory[];
  /** Weekly wage bill as it stands. */
  payroll: number;
  /** Biggest house drawn since the mandate was issued. */
  bestAttendanceSince: number;
  /**
   * The most people this promotion could physically get through a door — the
   * biggest room it can rent in the biggest market it could run. An owner is
   * unreasonable, not delusional, and asking for more people than the buildings
   * hold is a bug with a countdown rather than pressure.
   */
  reachableHouse: number;
  settings: WorldSettings;
}

function fill(template: string, target: string | null, value: number | null): string {
  return template
    .replace(/\{target\}/g, target ?? 'somebody')
    .replace(/\{value\}/g, value === null ? 'a number' : Math.round(value).toLocaleString());
}

/**
 * Build one mandate of a given type, or null if the world cannot currently
 * support it — see rule 1 at the top.
 */
function buildMandate(type: MandateType, ctx: MandateContext, rng: Rng): OwnerMandate | null {
  const s = ctx.settings;
  const deadlineWeek = ctx.week + s.mandateWeeksToComply;
  const say = (target: string | null, value: number | null) =>
    fill(pick(rng, MANDATE_TEXT[type]), target, value);

  const base = { id: `mandate-${ctx.week}-${type}`, type, deadlineWeek, fulfilled: false };

  switch (type) {
    case 'signWrestler': {
      // Somebody worth having, who is actually going spare.
      const targets = ctx.available.filter((w) => w.popularity >= s.mandateSignPopularity);
      if (targets.length === 0) return null;
      const target = pick(rng, targets);
      return { ...base, targetId: target.id, description: say(target.name, null) };
    }
    case 'releaseWrestler': {
      // Never somebody the player has just built. The owner picks on the
      // bottom of the card, which is its own kind of insult.
      const targets = ctx.roster.filter((w) => w.popularity <= s.mandateReleasePopularity);
      if (targets.length === 0) return null;
      const target = pick(rng, targets);
      return { ...base, targetId: target.id, description: say(target.name, null) };
    }
    case 'titleOnWrestler': {
      const belts = ctx.titles.filter((t) => t.promotionId === ctx.promotion.id);
      const targets = ctx.roster.filter((w) => !belts.some((t) => t.currentHolderIds.includes(w.id)));
      if (belts.length === 0 || targets.length === 0) return null;
      const target = pick(rng, targets);
      return { ...base, targetId: target.id, description: say(target.name, null) };
    }
    case 'reachRating': {
      const value = Math.min(100, ctx.promotion.rating + s.mandateRatingClimb);
      if (value <= ctx.promotion.rating) return null;
      return { ...base, targetValue: value, description: say(null, value) };
    }
    case 'cutPayroll': {
      const value = Math.round(ctx.payroll * s.mandatePayrollCut);
      if (ctx.payroll <= 0) return null;
      return { ...base, targetValue: value, description: say(null, value) };
    }
    case 'drawAttendance': {
      // Beat your own best, but never past what the buildings hold.
      const wanted = Math.round(ctx.bestAttendanceSince * s.mandateAttendanceClimb);
      const value = Math.min(wanted, Math.floor(ctx.reachableHouse * s.mandateAttendanceCeiling));
      if (value <= 0 || value <= ctx.bestAttendanceSince) return null;
      return { ...base, targetValue: value, description: say(null, value) };
    }
    case 'pushTalent': {
      // Somebody young with room to grow, not the person already on top. The
      // target is where they are *now* plus a climb, not an absolute — telling
      // a booker to make a 20-popularity rookie a 60 draw inside a month is
      // not a mandate, it is a formality on the way to being fired.
      const targets = ctx.roster.filter((w) => w.age <= s.mandatePushMaxAge && w.popularity < 100);
      if (targets.length === 0) return null;
      const target = pick(rng, targets);
      const value = Math.min(100, Math.round(target.popularity + s.mandatePushClimb));
      if (value <= target.popularity) return null;
      return { ...base, targetId: target.id, targetValue: value, description: say(target.name, value) };
    }
    case 'expandTerritory': {
      const held = ctx.territories.filter((t) => t.ownerPromotionId === ctx.promotion.id).length;
      const value = held + 1;
      if (value > ctx.territories.length) return null;
      return { ...base, targetValue: value, description: say(null, value) };
    }
    case 'reduceHardcore': {
      if (ctx.promotion.hardcoreSaturation < s.mandateHardcoreCeiling) return null;
      return { ...base, targetValue: s.mandateHardcoreCeiling, description: say(null, null) };
    }
    case 'runShowInTerritory': {
      // Somewhere they are not already running. Being told to do what you are
      // already doing is not a mandate.
      const elsewhere = ctx.territories.filter((t) => t.id !== ctx.promotion.homeTerritoryId);
      if (elsewhere.length === 0) return null;
      const target = pick(rng, elsewhere);
      return { ...base, targetId: target.id, description: say(target.name, null) };
    }
  }
}

/**
 * The owner comes calling. Returns null if nothing they might have asked for
 * is currently possible, which is rare and is better than inventing something.
 */
export function issueMandate(rng: Rng, ctx: MandateContext): OwnerMandate | null {
  const weights = ownerProfile(ctx.personality).weights;
  const candidates = (Object.entries(weights) as [MandateType, number][]).filter(([, w]) => w > 0);
  if (candidates.length === 0) return null;

  // Try a weighted draw, then fall back through the rest — an owner who wants
  // a signing and cannot have one still wants something.
  const remaining = [...candidates];
  while (remaining.length > 0) {
    const type = weightedPick(
      rng,
      remaining.map(([t, w]) => [t, w] as const),
    );
    const mandate = buildMandate(type, ctx, rng);
    if (mandate) return mandate;
    const index = remaining.findIndex(([t]) => t === type);
    if (index >= 0) remaining.splice(index, 1);
  }
  return null;
}

/**
 * Has it been done? Read off the world every time rather than tracked, because
 * everything a mandate cares about is already stored somewhere and a second
 * copy is a second thing that can disagree.
 */
export function mandateMet(mandate: OwnerMandate, ctx: MandateContext): boolean {
  switch (mandate.type) {
    case 'signWrestler':
      return ctx.roster.some((w) => w.id === mandate.targetId);
    case 'releaseWrestler':
      return !ctx.roster.some((w) => w.id === mandate.targetId);
    case 'titleOnWrestler':
      return ctx.titles.some(
        (t) => t.promotionId === ctx.promotion.id && t.currentHolderIds.includes(mandate.targetId ?? ''),
      );
    case 'reachRating':
      return ctx.promotion.rating >= (mandate.targetValue ?? Infinity);
    case 'cutPayroll':
      return ctx.payroll <= (mandate.targetValue ?? -Infinity);
    case 'drawAttendance':
      return ctx.bestAttendanceSince >= (mandate.targetValue ?? Infinity);
    case 'pushTalent': {
      const target = ctx.roster.find((w) => w.id === mandate.targetId);
      return Boolean(target && target.popularity >= (mandate.targetValue ?? Infinity));
    }
    case 'expandTerritory':
      return (
        ctx.territories.filter((t) => t.ownerPromotionId === ctx.promotion.id).length >=
        (mandate.targetValue ?? Infinity)
      );
    case 'reduceHardcore':
      return ctx.promotion.hardcoreSaturation <= (mandate.targetValue ?? -Infinity);
    case 'runShowInTerritory':
      return ctx.promotion.homeTerritoryId === mandate.targetId;
  }
}

export function mandateExpired(deadlineWeek: number, week: number): boolean {
  return week >= deadlineWeek;
}

/** What happens when one lands, or does not. */
export interface MandateOutcome {
  met: boolean;
  /** What the owner said about it. */
  verdict: string;
  /** Cash either way — a bonus for delivering, a budget cut for not. */
  money: number;
  /** Company standing, for a failure the owner takes personally. */
  ratingDelta: number;
  /** Strikes are what end a run. Only a failure adds one. */
  strike: boolean;
}

export function resolveMandate(met: boolean, settings: WorldSettings): MandateOutcome {
  if (met) {
    return {
      met: true,
      verdict: 'Done. The owner will find something else to want by the end of the month.',
      money: settings.mandateRewardCash,
      ratingDelta: 0,
      strike: false,
    };
  }
  return {
    met: false,
    verdict: 'Not done. The owner has made a note of it, and they do not forget notes.',
    money: -settings.mandatePenaltyCash,
    ratingDelta: -settings.mandateFailureRating,
    strike: true,
  };
}

/** Three strikes and the run is over. */
export function isFired(strikes: number, settings: WorldSettings): boolean {
  return strikes >= settings.mandateStrikesBeforeFiring;
}

/** How much rope is left, in the owner's words. */
export function strikeWarning(strikes: number, settings: WorldSettings): string | null {
  const left = settings.mandateStrikesBeforeFiring - strikes;
  if (left <= 0) return 'You are finished here.';
  if (left === 1) return 'One more and you are gone. That is not a figure of speech.';
  if (left === 2) return 'The owner is watching you now.';
  return null;
}
