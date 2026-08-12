// The schools.
//
// People leave the business — they retire, they get hurt, they die — and if
// nobody replaced them a save that ran twenty years would end with eleven
// wrestlers in the world and no free agents to sign. So the training schools
// keep turning people out.
//
// Not one-for-one. The population is allowed to breathe inside a range: a
// quiet year where three people retire and one graduate breaks in leaves the
// business slightly thinner, which is a real thing that happens to wrestling.
// The academy only opens the doors when the working population is genuinely
// short, and shuts them when it is full.

import type { Rng } from '../rng';
import { randInt } from '../rng';
import type { Appearance, Wrestler, WorldSettings } from '../types';
import { generateWrestlers, rollDebutAge } from '../generate/wrestler';
import type { FreeAgent } from './freeAgents';

/** Everyone still able to work — retired and deceased do not count. */
export function workingPopulation(wrestlers: readonly Wrestler[]): number {
  return wrestlers.filter((w) => !w.deceased && w.careerStatus !== 'retired' && w.role === 'wrestler').length;
}

/**
 * How many people the schools put out this year. Zero when the business is
 * full; a rush when it is empty; a trickle in between, so the population
 * wanders inside its range instead of being pinned to a number.
 */
export function graduateCount(rng: Rng, population: number, settings: WorldSettings): number {
  if (population >= settings.worldPopulationMax) return 0;

  const short = settings.worldPopulationMin - population;
  if (short > 0) return Math.min(settings.academyMaxGraduates, short + randInt(rng, 0, 1));

  // Inside the range: someone breaks in most years, nobody in a lean one.
  return randInt(rng, 0, 1);
}

export interface AcademyIntake {
  wrestlers: Wrestler[];
  freeAgents: FreeAgent[];
}

/**
 * A new class. They come out young, unsigned, and unknown — a graduate is
 * not a free agent bargain, they are a project.
 */
export function graduateClass(
  rng: Rng,
  count: number,
  currentYear: number,
  settings: WorldSettings,
  existingAppearances: Appearance[] = [],
  existingNames: ReadonlySet<string> = new Set(),
): AcademyIntake {
  if (count <= 0) return { wrestlers: [], freeAgents: [] };

  // Names have to be checked against the whole business, not just this class —
  // otherwise the schools keep turning out a second Blackout every few years.
  const wrestlers = generateWrestlers(rng, count, {
    currentYear,
    existingAppearances,
    existingNames: new Set(existingNames),
  }).map((w) => {
    // Whatever the generator rolled, somebody out of a school has not done
    // anything yet. Their age is their debut age, and the schools take late
    // starters too — the thirty-year-old who finally walked in is a real
    // graduating class member.
    const age = rollDebutAge(rng, settings.academyDebutAgeMax * 2);
    // ...and nobody has heard of them. The generator rolls popularity for a
    // working wrestler somewhere in the middle of a career, so without this a
    // school graduate could walk out of the door at 82 — as over as the world
    // champion, having never had a match. Scaled rather than clamped so the
    // spread survives (the promising one still comes out ahead of the rest),
    // and scaled rather than re-rolled so the seeded stream is untouched.
    const popularity = Math.round(w.popularity * settings.academyGraduatePopularity);
    return {
      ...w,
      age,
      popularity,
      careerHighPopularity: popularity,
      debutYear: currentYear,
      careerStatus: 'rookie' as const,
      cardStatus: 'prospect' as const,
      promotionId: null,
      contract: null,
      momentum: 0,
      record: { wins: 0, losses: 0, draws: 0 },
      titleReigns: [],
    };
  });

  const freeAgents: FreeAgent[] = wrestlers.map((w) => ({
    wrestlerId: w.id,
    reason: 'schoolGraduate' as const,
    // Cheap, because nobody has any idea whether they are any good.
    askingRate: settings.contractBaseWeeklyRate,
    weeksUnsigned: 0,
  }));

  return { wrestlers, freeAgents };
}
