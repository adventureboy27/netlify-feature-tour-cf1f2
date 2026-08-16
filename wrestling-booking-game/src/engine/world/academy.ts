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
import { desiredContractWeeks } from '../economy/contracts';
import { chance, clamp, randInt } from '../rng';
import { rollStandoutTalent } from '../career/hype';
import type { Appearance, Id, Wrestler, WorldSettings } from '../types';
import { generateWrestlers, rollDebutAge } from '../generate/wrestler';
import type { FreeAgent } from './freeAgents';

/**
 * Everyone actually *working* — signed to somebody, alive, not retired.
 *
 * The unemployed used to count, and that was the bug underneath a decade of
 * quiet inflation: three promotions folded in year three, a hundred wrestlers
 * went into a pool with nobody left to hire them, and the school looked at a
 * headcount of two hundred and concluded the business was healthy. It kept
 * producing into a market that could not absorb anybody.
 *
 * Counting contracts instead makes the schools respond to demand, which is
 * the only number that means anything: the business is short-handed when
 * companies cannot fill their cards, not when there are bodies somewhere.
 */
export function workingPopulation(wrestlers: readonly Wrestler[]): number {
  return wrestlers.filter(
    (w) => !w.deceased && w.careerStatus !== 'retired' && w.role === 'wrestler' && w.promotionId !== null,
  ).length;
}

/**
 * How many people the schools put out this year. Zero when the business is
 * full; a rush when it is empty; a trickle in between, so the population
 * wanders inside its range instead of being pinned to a number.
 */
export function graduateCount(
  rng: Rng,
  population: number,
  settings: WorldSettings,
  /**
   * How many jobs the business actually has — every live company's target
   * roster size, added up. Omit and it falls back to the fixed band, which is
   * only right for a fixture.
   */
  capacity?: number,
): number {
  // The schools produce to fill *vacancies*.
  //
  // This used to be a fixed headcount band, and the band was measured against
  // everybody alive. Both halves were wrong and they were wrong in opposite
  // directions. Counting the unemployed meant a business with a hundred
  // wrestlers nobody could hire looked fully staffed; counting only the
  // employed against a fixed floor of 150 meant a business that had lost
  // three promotions looked desperately short and the school flooded a market
  // with no jobs in it. Measured: total population 198 -> 256 in four years,
  // with 147 of them unemployed.
  //
  // A shortage of *employers* cannot be fixed by making more wrestlers. So
  // the question the school asks is how many contracts the business has room
  // for, against how many it has written.
  if (capacity !== undefined) {
    const vacancies = capacity - population;
    if (vacancies <= 0) return 0;
    return Math.min(settings.academyMaxGraduates, Math.ceil(vacancies * settings.academyFillRate) + randInt(rng, 0, 1));
  }

  if (population >= settings.worldPopulationMax) return 0;
  const short = settings.worldPopulationMin - population;
  if (short > 0) return Math.min(settings.academyMaxGraduates, short + randInt(rng, 0, 1));
  return randInt(rng, 0, 1);
}

/** Every job the business has: each live company's target roster, added up. */
export function businessCapacity(
  companies: readonly { rating: number; closedWeek: number | null; rosterIds: readonly string[] }[],
  targetFor: (rating: number) => number,
): number {
  return companies
    .filter((c) => c.closedWeek === null)
    .reduce((sum, c) => sum + targetFor(c.rating), 0);
}

export interface AcademyIntake {
  wrestlers: Wrestler[];
  freeAgents: FreeAgent[];
  /**
   * The one in a class who came out ready, if there was one. Set only when a
   * phenom was rolled — see `asPhenom`. The caller turns this into a bidding
   * war; the academy's job stops at producing them.
   */
  phenomId: Id | null;
}

/**
 * The graduate who did not need the ten years.
 *
 * Ordinary school leavers are projects: real stats are a decade away and most
 * of them never get there. Once in a long while somebody walks out at
 * twenty-one already able to work, and the whole business finds out inside a
 * week. That is the entire justification for the bidding war existing on the
 * prospect side — an auction over a rookie only makes sense if the rookie is
 * genuinely not a rookie.
 *
 * Their *popularity* stays modest. Nobody has seen them wrestle. What they
 * have is buzz, and the reason every promotion wants them is the hidden
 * talent number, which is exactly the thing the player cannot read directly.
 */
export function asPhenom(rng: Rng, graduate: Wrestler, settings: WorldSettings): Wrestler {
  const s = settings;
  const lift = (current: number, floor: number) => clamp(Math.max(current, floor + randInt(rng, 0, 14)), 5, 96);
  // The room is certain. Whether the room is *right* is a separate roll, and
  // that is the whole of it: one phenom in five has nothing behind the hype
  // and turns into a bad draft pick. See career/hype.ts.
  const talent = rollStandoutTalent(rng, s.biddingPhenomTalentFloor, s);
  // How much of a phenom's promised ceiling is really there.
  const ceilingShare = clamp(talent / s.biddingPhenomTalentFloor, 0.55, 1);

  return {
    ...graduate,
    strength: lift(graduate.strength, s.biddingPhenomStatFloor),
    skill: lift(graduate.skill, s.biddingPhenomStatFloor),
    agility: lift(graduate.agility, s.biddingPhenomStatFloor),
    stamina: lift(graduate.stamina, s.biddingPhenomStatFloor),
    charisma: lift(graduate.charisma, s.biddingPhenomStatFloor - 10),
    talent,
    // ...but everybody says they are the next one, whatever is actually
    // there. This is the number the auction reads.
    hype: clamp(Math.max(graduate.hype, s.biddingPhenomTalentFloor + randInt(rng, 0, 8)), 5, 99),
    // Growth follows talent everywhere else in the game (§3.8); a phenom whose
    // ceiling was rolled for an ordinary graduate would stall in three years.
    growthRate: 0.4 + (talent / 100) * 1.2,
    // The ceiling follows the truth, not the noise. A bust who kept a
    // phenom's potentials would still become a phenom, which is not a bust —
    // it is a phenom who arrived late.
    potentials: {
      strength: clamp(Math.max(graduate.potentials.strength, 88 * ceilingShare), 5, 99),
      skill: clamp(Math.max(graduate.potentials.skill, 90 * ceilingShare), 5, 99),
      agility: clamp(Math.max(graduate.potentials.agility, 88 * ceilingShare), 5, 99),
      stamina: clamp(Math.max(graduate.potentials.stamina, 88 * ceilingShare), 5, 99),
      charisma: clamp(Math.max(graduate.potentials.charisma, 82 * ceilingShare), 5, 99),
    },
    popularity: s.biddingPhenomPopularity,
    careerHighPopularity: s.biddingPhenomPopularity,
    // Young, because that is the whole story. Somebody this good at thirty
    // would already be working somewhere.
    age: randInt(rng, s.academyDebutAgeMin, s.academyDebutAgeMin + 2),
    careerStatus: 'prospect',
  };
}

/**
 * A new class. They come out young, unsigned, and unknown — a graduate is
 * not a free agent bargain, they are a project.
 *
 * Young is now enforced rather than assumed: nobody over `academyMaxAge` is
 * a student. Everybody older who wants a shot is a walk-on, and walk-ons come
 * through the free agent pool rougher than this — see world/walkOns.ts.
 */
export function graduateClass(
  rng: Rng,
  count: number,
  currentYear: number,
  settings: WorldSettings,
  existingAppearances: Appearance[] = [],
  existingNames: ReadonlySet<string> = new Set(),
): AcademyIntake {
  if (count <= 0) return { wrestlers: [], freeAgents: [], phenomId: null };

  // Names have to be checked against the whole business, not just this class —
  // otherwise the schools keep turning out a second Blackout every few years.
  const wrestlers = generateWrestlers(rng, count, {
    // Rolls what the business believes about them, as against what is true.
    settings,
    currentYear,
    existingAppearances,
    existingNames: new Set(existingNames),
  }).map((w) => {
    // Whatever the generator rolled, somebody out of a school has not done
    // anything yet. Their age is their debut age, and the schools take late
    // starters too — the thirty-year-old who finally walked in is a real
    // graduating class member.
    // The school has a door policy. `rollDebutAge` will happily return a
    // thirty-nine-year-old late starter, and it is right to — plenty of people
    // come to this business late. What it is not is a *student*: past the cap
    // they come through the walk-on door instead, off the street and rough
    // with it. See world/walkOns.ts.
    // Clamped at both ends against the school's own policy. `rollDebutAge`
    // floors at MINIMUM_DEBUT_AGE, which is the age the *business* will let
    // somebody wrestle at — a year below the age this school will enrol them,
    // and enough to put an eighteen-year-old in a graduating class.
    const age = clamp(
      rollDebutAge(rng, settings.academyMaxAge),
      settings.academyDebutAgeMin,
      settings.academyMaxAge,
    );
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

  // Once in a long while, one of them is not a project. Rolled per class
  // rather than per graduate: two phenoms in one year would not be phenoms,
  // and a fourteen-strong class should not be fourteen times as likely to
  // produce one as a class of one.
  let phenomId: Id | null = null;
  const class_: Wrestler[] = wrestlers;
  if (settings.biddingEnabled && class_.length > 0 && chance(rng, settings.biddingPhenomChancePerClass)) {
    const index = randInt(rng, 0, class_.length - 1);
    const risen = asPhenom(rng, class_[index]!, settings);
    class_[index] = risen;
    phenomId = risen.id;
  }

  const freeAgents: FreeAgent[] = class_.map((w) => ({
    wrestlerId: w.id,
    reason: 'schoolGraduate' as const,
    // Cheap, because nobody has any idea whether they are any good. The
    // phenom is the exception and does not go through this door at all — the
    // caller pulls them out into an auction.
    askingRate: settings.contractBaseWeeklyRate,
    // Out of the school and desperate for a run: they sign for anything long.
    wantsWeeks: desiredContractWeeks(w, settings),
    weeksUnsigned: 0,
  }));

  return { wrestlers: class_, freeAgents, phenomId };
}
