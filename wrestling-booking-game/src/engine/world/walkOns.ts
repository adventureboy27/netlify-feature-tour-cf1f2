// The other door into the business.
//
// The school takes people up to `academyMaxAge` and turns out something
// half-finished but *taught*: they can take a bump, they know the calls, they
// have been drilled. Everybody older who wants a shot comes in the other way —
// off the street, out of a gym, out of another sport, out of a bar — and they
// arrive rough.
//
// Rough, and occasionally not. The whole reason this exists rather than being
// a rarity slider on the school:
//
//   - Most walk-ons are worse than a graduate at everything that happens
//     between the ropes, and they will not get much better, because they are
//     thirty-six and the clock on their ceiling has largely run out.
//   - Some are only *unpolished*. A gem walks in at thirty-eight with a body,
//     a face and a voice, having never taken a bump in his life, and inside
//     two years he is your main event.
//   - And some of them cannot work at all and never will, but can talk. A
//     natural manager is a real career and this is where a lot of them come
//     from — somebody who found the business late, cannot go, and is the best
//     promo in the company.
//
// So the pool is not "the school, but worse". It is a different shape of
// gamble: lower floor, later ceiling, and a mouth you cannot teach.

import type { Rng } from '../rng';
import { chance, clamp, gaussian, randInt } from '../rng';
import type { Appearance, Wrestler, WorldSettings } from '../types';
import { generateWrestlers } from '../generate/wrestler';
import { rollStandoutTalent } from '../career/hype';
import type { FreeAgent } from './freeAgents';

export type WalkOnKind =
  /** Rough, late, and going to stay that way. Most of them. */
  | 'roughAndReady'
  /** Never trained a day and can plainly do it anyway. */
  | 'gem'
  /** Cannot work. Can talk. */
  | 'naturalTalker';

export interface WalkOnIntake {
  wrestlers: Wrestler[];
  freeAgents: FreeAgent[];
  /** What each one turned out to be, for the tests and the write-up. */
  kinds: Record<string, WalkOnKind>;
}

/** Which of the three somebody is. Weighted hard toward the ordinary. */
export function rollKind(rng: Rng, settings: WorldSettings): WalkOnKind {
  if (chance(rng, settings.walkOnGemChance)) return 'gem';
  if (chance(rng, settings.walkOnTalkerChance)) return 'naturalTalker';
  return 'roughAndReady';
}

/**
 * Turn a generated wrestler into somebody who walked in off the street.
 *
 * Everything in-ring is knocked down and the ceiling with it, because the
 * years to grow into it are the thing they do not have. What survives intact
 * is whatever they were born with — the face, the voice, the frame — which is
 * exactly why the gem and the talker are possible at all.
 */
export function asWalkOn(
  rng: Rng,
  person: Wrestler,
  kind: WalkOnKind,
  currentYear: number,
  settings: WorldSettings,
): Wrestler {
  const s = settings;
  const rough = (value: number, floor: number, scale: number) =>
    clamp(Math.round(floor + (value - floor) * scale), 5, 99);

  // Untrained. The ring skills are the ones a school would have given them.
  const craftScale = kind === 'gem' ? s.walkOnGemCraftScale : s.walkOnCraftScale;
  const skill = rough(person.skill, 5, craftScale);
  const agility = rough(person.agility, 5, craftScale);
  const stamina = rough(person.stamina, 8, craftScale);

  // A talker cannot go, and there is no pretending otherwise — but the mouth
  // is the whole reason to sign them.
  const talker = kind === 'naturalTalker';
  const charisma = talker
    ? clamp(Math.round(Math.max(person.charisma, s.walkOnTalkerCharismaFloor + randInt(rng, 0, 15))), 5, 99)
    : kind === 'gem'
      ? // A gem is not a good worker who turned up late, it is somebody the
        // whole business can see is going to be a star. Measured without this,
        // gems came out with a mediocre mouth and a ceiling identical to the
        // average graduate's, which is a decent hand rather than a gem.
        clamp(Math.round(Math.max(person.charisma, s.walkOnGemCharismaFloor + randInt(rng, 0, 12))), 5, 99)
      : person.charisma;

  // Hidden ceiling. A gem still has one worth chasing; everybody else is
  // roughly what you see, because they came to it too late to become anything
  // very different.
  // A gem is somebody the whole room can see it in. Whether it is actually
  // there is the same roll a phenom takes — a body and a voice and nothing
  // behind them is exactly what a bad draft pick looks like.
  const talent =
    kind === 'gem'
      ? rollStandoutTalent(rng, s.walkOnGemTalentFloor, s)
      : clamp(Math.round(person.talent * s.walkOnTalentScale), 5, 99);
  const hype =
    kind === 'gem'
      ? clamp(Math.round(Math.max(person.hype, s.walkOnGemTalentFloor + randInt(rng, 0, 9))), 5, 99)
      : clamp(Math.round(person.hype * s.walkOnTalentScale), 5, 99);

  const age = randInt(rng, s.academyMaxAge + 1, s.walkOnMaxAge);
  // The room above them follows what is really there, so a gem with nothing
  // behind the hype gets a gem's reputation and an ordinary ceiling.
  const ceilingRoom =
    kind === 'gem'
      ? s.walkOnGemCeilingRoom * clamp(talent / s.walkOnGemTalentFloor, 0.4, 1)
      : s.walkOnCeilingRoom;

  return {
    ...person,
    age,
    debutYear: currentYear,
    skill: talker ? rough(skill, 5, s.walkOnTalkerCraftScale) : skill,
    agility: talker ? rough(agility, 5, s.walkOnTalkerCraftScale) : agility,
    stamina,
    charisma,
    talent,
    hype,
    growthRate: 0.4 + (talent / 100) * 1.2,
    potentials: {
      strength: clamp(Math.round(person.strength + ceilingRoom), 5, 99),
      skill: clamp(Math.round(skill + ceilingRoom), 5, 99),
      agility: clamp(Math.round(agility + ceilingRoom), 5, 99),
      stamina: clamp(Math.round(stamina + ceilingRoom), 5, 99),
      charisma: clamp(Math.round(charisma + ceilingRoom), 5, 99),
    },
    // Nobody has seen them. Not even the small buzz a graduating class gets.
    popularity: clamp(Math.round(Math.abs(gaussian(rng, 0, s.walkOnPopularitySpread))), 0, 20),
    careerHighPopularity: 0,
    careerStatus: 'rookie',
    cardStatus: 'prospect',
    promotionId: null,
    contract: null,
    momentum: 0,
    record: { wins: 0, losses: 0, draws: 0 },
    titleReigns: [],
    // A natural talker is a manager who has not been told yet. The role is
    // still the booker's call — this only means the office would not blink.
    role: 'wrestler',
  };
}

/**
 * A batch of people who turned up asking for a look.
 *
 * Rolled alongside the graduating class, and deliberately smaller: a school
 * produces a year group, the street produces whoever walked in.
 */
export function walkOnIntake(
  rng: Rng,
  count: number,
  currentYear: number,
  settings: WorldSettings,
  existingAppearances: Appearance[] = [],
  existingNames: ReadonlySet<string> = new Set(),
): WalkOnIntake {
  if (count <= 0) return { wrestlers: [], freeAgents: [], kinds: {} };

  const kinds: Record<string, WalkOnKind> = {};
  const wrestlers = generateWrestlers(rng, count, {
    // Rolls what the business believes about them, as against what is true.
    settings,
    currentYear,
    existingAppearances,
    existingNames: new Set(existingNames),
  }).map((person) => {
    const kind = rollKind(rng, settings);
    const walkOn = asWalkOn(rng, person, kind, currentYear, settings);
    kinds[walkOn.id] = kind;
    return walkOn;
  });

  const freeAgents: FreeAgent[] = wrestlers.map((w) => ({
    wrestlerId: w.id,
    reason: 'walkOn' as const,
    // They are asking for a look, not for money.
    askingRate: settings.contractBaseWeeklyRate,
    // A walk-on will sign anything to get in the door.
    wantsWeeks: settings.contractLengthDefault,
    weeksUnsigned: 0,
  }));

  return { wrestlers, freeAgents, kinds };
}

/** How the paper mentions them, when it mentions them at all. */
export function walkOnLine(names: readonly string[]): string {
  if (names.length === 1) {
    return `${names[0]} turned up at the building this week asking for a look. Never been trained a day.`;
  }
  return `${names.length} of them turned up at the building this week asking for a look. None of them have ever been trained.`;
}
