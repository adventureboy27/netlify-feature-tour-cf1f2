// Second-generation wrestlers.
//
// `secondGenerationEnabled` has been in WorldSettings since the beginning and
// nothing has ever read it. This is the module that finally gives it a job —
// the same hole `homeTerritoryId` was in before reach.ts, and `facialHair`
// was in before the atlas grew a face slot.
//
// The point of a game that runs for thirty simulated years is that the years
// accumulate into something. A man you pushed in 1985 gets old, retires, goes
// into the hall, and dies; and then in 2007 somebody walks out of the school
// with his surname on the back of his jacket and the crowd makes a noise for
// a rookie they have never seen. That is the payoff, and it is not available
// to any game that only runs a season.
//
// ---------------------------------------------------------------------------
// The name is an asset with an expiry date
//
// The easy version of this feature is a straight bonus: second-gen wrestlers
// start more over and that is that. §0 says to pick the option that makes a
// harder decision, so the name works both ways here.
//
// A second-generation rookie debuts genuinely over — well beyond what a
// graduate has earned — and *most* over in the towns where their parent drew.
// They are useful from week one. But:
//
//   - The inherited share of that popularity is on a clock. If the booker has
//     not converted the name into real results by the time the patience runs
//     out, it bleeds away and the kid is left with whatever they actually
//     built. Use them as a jobber and you burn a name that took twenty years
//     to make.
//   - The name raises their morale expectation permanently. They believe they
//     should be treated the way their father was treated, and they are unhappy
//     in spots that would suit any other rookie fine.
//
// So the decision is real: here is somebody who can draw immediately, and a
// clock, and a locker-room problem if you get it wrong.

import type { Rng } from '../rng';
import { chance, clamp, gaussian, pick, randInt } from '../rng';
import { MASCULINE_FIRST_NAMES, FEMININE_FIRST_NAMES } from '../../data/names';
import type { Id, Lineage, Wrestler, WorldSettings } from '../types';

export interface LineageContext {
  currentYear: number;
  currentWeek: number;
}

// ---------------------------------------------------------------------------
// Who could have a kid in the business

/**
 * Somebody's career has to be over, big enough that the surname means
 * something, and long enough ago that a child of theirs would be old enough
 * to take a bump.
 *
 * "Over" is measured on `careerHighPopularity` rather than current popularity
 * on purpose: a retired man's popularity has been decaying for years, and the
 * name the fans remember is the one from his peak.
 */
export function couldHaveAChildInTheBusiness(
  parent: Wrestler,
  ctx: LineageContext,
  settings: WorldSettings,
): boolean {
  if (!settings.secondGenerationEnabled) return false;
  const finished = Boolean(parent.deceased) || parent.careerStatus === 'retired' || parent.careerStatus === 'hallOfFamer';
  if (!finished) return false;
  if (parent.careerHighPopularity < settings.secondGenMinParentPopularity) return false;
  // The gap is measured from the parent's own debut, which is the only date
  // on a wrestler that reliably sits a generation back.
  return ctx.currentYear - parent.debutYear >= settings.secondGenParentDebutedYearsAgo;
}

/** How many of somebody's children are already working. */
export function childrenOf(parentId: Id, everyone: readonly Wrestler[]): Wrestler[] {
  return everyone.filter((w) => w.lineage?.parentId === parentId);
}

/**
 * Everyone eligible to be named as a parent this year, best names first.
 *
 * Sorted by peak rather than shuffled so that when the roll comes up, the
 * business gets the child of somebody worth talking about. A second-generation
 * wrestler whose father nobody remembers is just a wrestler.
 */
export function eligibleParents(
  everyone: readonly Wrestler[],
  ctx: LineageContext,
  settings: WorldSettings,
): Wrestler[] {
  return everyone
    .filter((w) => couldHaveAChildInTheBusiness(w, ctx, settings))
    .filter((w) => childrenOf(w.id, everyone).length < settings.secondGenMaxChildren)
    .sort((a, b) => b.careerHighPopularity - a.careerHighPopularity);
}

// ---------------------------------------------------------------------------
// The name

/**
 * The part of a ring name a child would inherit.
 *
 * Two-word names hand over the surname, which is the ordinary case. A one-word
 * ring act — Blackout, Vandal — has no surname to give, and the wrestling
 * answer to that has always been the same one: the kid is Blackout Jr. Both
 * read as family, which is the whole job.
 */
export function familyNameOf(parentRingName: string): { surname: string | null; act: string } {
  const words = parentRingName.trim().split(/\s+/);
  if (words.length > 1) return { surname: words[words.length - 1]!, act: parentRingName.trim() };
  return { surname: null, act: words[0] ?? parentRingName.trim() };
}

const MAX_NAME_ATTEMPTS = 60;

/**
 * A ring name that says "family" out loud.
 *
 * This deliberately bypasses `isTooSimilar`, which rejects a shared surname
 * precisely *because* it makes two people sound related. That check is right
 * everywhere else and wrong here: sounding related is the feature. Exact
 * collisions are still refused, because two wrestlers cannot have the same
 * name.
 */
export function childName(
  rng: Rng,
  parent: Wrestler,
  gender: 'm' | 'f',
  existingNames: ReadonlySet<string>,
): string {
  const { surname, act } = familyNameOf(parent.name);
  const firstNames = gender === 'f' ? FEMININE_FIRST_NAMES : MASCULINE_FIRST_NAMES;

  if (surname) {
    for (let attempt = 0; attempt < MAX_NAME_ATTEMPTS; attempt++) {
      const candidate = `${pick(rng, firstNames)} ${surname}`;
      if (!existingNames.has(candidate.trim().toLowerCase())) return candidate;
    }
    // Every first name in the pool is already paired with this surname, which
    // takes a very crowded family. Fall through to the suffix form.
  }

  const suffixes = surname ? ['Jr.', 'II', 'III'] : ['Jr.', 'II'];
  for (const suffix of suffixes) {
    const candidate = `${act} ${suffix}`;
    if (!existingNames.has(candidate.trim().toLowerCase())) return candidate;
  }
  // Nothing left that reads as family; the caller keeps the generated name.
  return '';
}

// ---------------------------------------------------------------------------
// Making one

/** What the name is worth at debut, before anybody has seen them work. */
export function inheritedStanding(parent: Wrestler, settings: WorldSettings): number {
  const share = parent.careerHighPopularity * settings.secondGenInheritedShare;
  return clamp(Math.round(share), 0, settings.secondGenInheritedCap);
}

/**
 * Turn a fresh graduate into somebody's kid.
 *
 * Takes an already-generated wrestler rather than generating one, so a
 * second-generation rookie is a normal graduate in every respect the sim
 * cares about — same stat roll, same talent, same potential. What the parent
 * hands down is a name, a face, a crowd that already knows them, and a
 * standard they are measured against. Not ability. Nobody inherits a
 * dropkick.
 */
export function asSecondGeneration(
  rng: Rng,
  child: Wrestler,
  parent: Wrestler,
  ctx: LineageContext,
  existingNames: ReadonlySet<string>,
  settings: WorldSettings,
): Wrestler {
  const name = childName(rng, parent, child.gender, existingNames);
  const lineage: Lineage = {
    parentId: parent.id,
    parentName: parent.name,
    // Denormalised. The parent may be dead, may have been repackaged twice,
    // and the announcers still have to be able to say it.
    familyName: familyNameOf(parent.name).surname ?? parent.name,
    inheritedAt: ctx.currentWeek,
    inheritedStanding: inheritedStanding(parent, settings),
    provenBy: null,
  };

  const popularity = clamp(Math.max(child.popularity, lineage.inheritedStanding), 0, 100);
  return {
    ...child,
    name: name || child.name,
    lineage,
    popularity,
    careerHighPopularity: Math.max(child.careerHighPopularity, popularity),
    // The town that made the parent is the town that will care most.
    homeTerritoryId: parent.homeTerritoryId,
    // A little of the parent's presence carries — it is the one thing that
    // genuinely runs in families in this business, and it is the trait the
    // crowd reads first.
    charisma: clamp(
      Math.round(child.charisma + (parent.charisma - child.charisma) * settings.secondGenCharismaPull),
      5,
      99,
    ),
  };
}

/**
 * Where the name is already known.
 *
 * Seeds the child's regional popularity from the parent's strongholds, so the
 * kid is at their most over in the towns that watched their father, and a
 * stranger everywhere else. This is the piece that makes a second-generation
 * debut a booking decision rather than a stat bump: run him at home.
 */
export function inheritedTowns(
  parent: Wrestler,
  settings: WorldSettings,
): Partial<Record<Id, number>> {
  const towns: Partial<Record<Id, number>> = {};
  for (const [territoryId, standing] of Object.entries(parent.regionalPopularity ?? {})) {
    if (typeof standing !== 'number' || standing < settings.reachKnownHere) continue;
    towns[territoryId] = clamp(Math.round(standing * settings.secondGenTownShare), 0, 100);
  }
  return towns;
}

// ---------------------------------------------------------------------------
// Living up to it

/** Has the kid done enough to own the name outright? */
export function hasProvenIt(child: Wrestler, settings: WorldSettings): boolean {
  if (!child.lineage) return false;
  if (child.lineage.provenBy !== null) return true;
  const wins = child.record.wins;
  const matches = wins + child.record.losses + child.record.draws;
  if (matches < settings.secondGenProofMatches) return false;
  return (
    wins / Math.max(1, matches) >= settings.secondGenProofWinRate ||
    child.titleReigns.length > 0 ||
    child.popularity >= child.lineage.inheritedStanding + settings.secondGenProofPopularityGain
  );
}

/** Weeks left before the crowd stops giving them their father's ovation. */
export function patienceLeft(child: Wrestler, currentWeek: number, settings: WorldSettings): number {
  if (!child.lineage || child.lineage.provenBy !== null) return 0;
  const spent = currentWeek - child.lineage.inheritedAt;
  return Math.max(0, settings.secondGenPatienceWeeks - spent);
}

export type LineageVerdict =
  /** Still inside the grace the name buys. */
  | { kind: 'carried'; weeksLeft: number }
  /** They backed it up; the popularity is theirs now and stops bleeding. */
  | { kind: 'proven'; note: string }
  /** The clock ran out. The inherited share comes off, a slice at a time. */
  | { kind: 'fading'; loss: number; note: string }
  /** Nothing left to take back. */
  | { kind: 'spent' };

/**
 * The weekly read on a second-generation wrestler. Pure — the caller applies
 * the loss and stamps `provenBy`, the same shape every other career module in
 * here uses.
 */
export function weeklyLineage(
  child: Wrestler,
  currentWeek: number,
  settings: WorldSettings,
): LineageVerdict {
  const lineage = child.lineage;
  if (!lineage) return { kind: 'spent' };
  if (lineage.provenBy !== null) return { kind: 'spent' };

  if (hasProvenIt(child, settings)) {
    return {
      kind: 'proven',
      note: `${child.name} is not "${lineage.parentName}'s kid" any more — that is somebody the crowd turns up for on their own.`,
    };
  }

  const weeksLeft = patienceLeft(child, currentWeek, settings);
  if (weeksLeft > 0) return { kind: 'carried', weeksLeft };

  // Past patience and unproven: the borrowed popularity goes back, but never
  // below what a rookie of their record would have had anyway.
  const floor = settings.secondGenFadeFloor;
  if (child.popularity <= floor) return { kind: 'spent' };
  const loss = Math.min(settings.secondGenFadePerWeek, child.popularity - floor);
  return {
    kind: 'fading',
    loss,
    note: `The novelty of the ${lineage.familyName} name is wearing off. ${child.name} has not given anybody a reason to stay interested.`,
  };
}

/**
 * How much harder this person is to keep happy.
 *
 * Added to the morale expectation in career/morale.ts. Somebody who grew up
 * watching their father main-event does not think an opener is a fair week,
 * and the burden does not lift when the crowd's patience does — it is what
 * they believe they are owed, not what the fans think.
 */
export function nameBurden(child: Wrestler, settings: WorldSettings): number {
  if (!child.lineage) return 0;
  return settings.secondGenExpectationBurden;
}

// ---------------------------------------------------------------------------
// Saying it out loud

/** The line the paper runs when they debut. Nothing happens off-screen. */
export function debutLine(child: Wrestler, parent: Wrestler): string {
  const family = child.lineage?.familyName ?? parent.name;
  const gone = parent.deceased
    ? `the late ${parent.name}`
    : parent.careerStatus === 'hallOfFamer'
      ? `hall of famer ${parent.name}`
      : parent.name;
  return `${child.name} has come out of the school carrying a familiar surname — that is ${gone}'s kid, and the ${family} name is back in the business.`;
}

/** How the roster card labels them. */
export function lineageLabel(child: Wrestler): string | null {
  if (!child.lineage) return null;
  return `Second generation — ${child.lineage.parentName}'s kid`;
}

// ---------------------------------------------------------------------------
// Rolling for one

/**
 * Does this graduating class contain somebody's kid, and whose?
 *
 * Rolled per graduate rather than per class, so a big intake in a year full of
 * recently-retired stars is more likely to turn one up than a class of one.
 * Returns null when the world has nobody worth being descended from — which is
 * the normal state of a save in its first twenty years, and is the point.
 */
export function rollParent(
  rng: Rng,
  everyone: readonly Wrestler[],
  ctx: LineageContext,
  settings: WorldSettings,
): Wrestler | null {
  if (!settings.secondGenerationEnabled) return null;
  if (!chance(rng, settings.secondGenChancePerGraduate)) return null;

  const candidates = eligibleParents(everyone, ctx, settings);
  if (candidates.length === 0) return null;

  // Weighted toward the top of the list without being deterministic: the
  // biggest name available usually gets the nod, but the third-biggest turns
  // up often enough that a save does not feel like it is working down a queue.
  const depth = Math.min(candidates.length, settings.secondGenParentShortlist);
  const index = Math.min(depth - 1, Math.abs(Math.round(gaussian(rng, 0, depth / 2))));
  return candidates[index] ?? candidates[0] ?? null;
}

/** How old somebody debuting as a second-generation wrestler tends to be. */
export function debutAge(rng: Rng, settings: WorldSettings): number {
  // They grew up in it, so they start young — nobody discovers wrestling at
  // twenty-eight when their father did it for a living.
  return randInt(rng, settings.academyDebutAgeMin, settings.academyDebutAgeMin + 4);
}
