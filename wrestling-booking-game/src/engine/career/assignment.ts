// What somebody does with the week you did not book them for.
//
// A roster is always bigger than a card, so most of the company is not
// wrestling on any given week — and until now that meant precisely nothing
// happened to them. They were paid, they got a bit unhappier about being
// overlooked, and that was the whole of it. `potentials` and `growthRate` have
// been on Wrestler since the first commit and *nothing has ever read them*:
// nobody in this game has ever improved at anything.
//
// So the weeks off are where a roster is actually built. Four things somebody
// can be doing:
//
//   The gym       — the physical stats, toward whatever ceiling they have.
//   The ring      — ring intelligence, which is the one that cannot be bought.
//   Appearances   — signings and spots, which sell them to people who have not
//                   seen a show. Costs freshness: the act wears either way.
//   Rest          — the body and the head. The only one that helps somebody
//                   who is hurt, and the only one that helps a mood.
//
// The point is that they trade against each other. Everything except rest
// costs some condition, so a booker who has everybody in the gym all year has
// a roster that is stronger, more tired and closer to breaking. And none of it
// is free of the thing it is competing with: a week in the ring is a week not
// spent getting over.
//
// ---------------------------------------------------------------------------
// Nobody wants to answer this thirty times
//
// The default is `auto`, and auto is not "do nothing" — it is the assistant
// making the obvious call per person: send the hurt to rest, send the green to
// the ring, send everybody else to the gym. A booker who never opens this
// screen still gets a roster that develops. Pinning somebody is for when you
// disagree, which is the only time a choice is worth making.

import { clamp } from '../rng';
import { hasTrait } from './personality';
import type { Wrestler, WorldSettings } from '../types';

export type AssignmentId = 'gym' | 'ring' | 'appearances' | 'rest';
/** What is stored on a person: a pin, or `auto` to let the assistant decide. */
export type AssignmentChoice = AssignmentId | 'auto';

export interface AssignmentKind {
  id: AssignmentId;
  name: string;
  /** What it does, written for the booker. */
  blurb: string;
}

export const ASSIGNMENTS: readonly AssignmentKind[] = [
  {
    id: 'gym',
    name: 'In the gym',
    blurb: 'Strength, speed and wind, toward whatever ceiling they have. Tiring.',
  },
  {
    id: 'ring',
    name: 'Working the ring',
    blurb: 'Time in an empty building learning what to do out there. The slowest thing to fix and the only way to fix it.',
  },
  {
    id: 'appearances',
    name: 'Out on appearances',
    blurb: 'Signings, mall spots, local radio. Sells them to people who have never seen a show — and wears the act out faster.',
  },
  {
    id: 'rest',
    name: 'Resting',
    blurb: 'The only thing that helps a hurt body or a bad head. Nothing improves.',
  },
];

const BY_ID = new Map(ASSIGNMENTS.map((a) => [a.id, a]));

export function assignmentById(id: AssignmentId): AssignmentKind | undefined {
  return BY_ID.get(id);
}

// ------------------------------------------------------------ the assistant

/**
 * What the office would put somebody on, left to itself.
 *
 * Deliberately simple and deliberately stated in that order, because a booker
 * has to be able to predict it without opening anything. Hurt or worn out
 * rests. Somebody who gets lost out there goes to the ring, whatever else is
 * true about them, because that is the thing that limits every match they will
 * ever have. Everybody else builds.
 */
export function autoAssignment(wrestler: Wrestler, settings: WorldSettings): AssignmentId {
  // Hurt, or worn down past what a week of work is reasonable on. The
  // threshold is measured rather than picked: median health across a working
  // roster is 52 and the tenth percentile is 41, so anything near the median
  // sends most of the company home most weeks — which is what the first
  // version did, and it meant the office never developed anybody.
  if (wrestler.injury) return 'rest';
  if (wrestler.health <= settings.assignmentRestBelowHealth) return 'rest';
  // Wants More Time Off deliberately gets no override here, though it had one
  // and it was wrong twice over. It double-dipped — the trait already takes
  // more morale from a week at home and already charges the road when they are
  // worked — and it swamped everything else: measured over two years it was
  // the second largest reason anybody was resting, ahead of being worn out.
  // Looking after that person is a decision for the booker to make on the
  // panel, which is the whole point of the panel.
  //
  // The thing that limits every match they will ever have.
  if (wrestler.ringIQ < settings.assignmentRingBelowIQ) return 'ring';
  // Nobody has heard of them, and there is still an act left to spend. A deep
  // undercard otherwise just fades: popularity drifts down and a wrestler who
  // is never booked has nothing at all pushing back on it.
  if (
    wrestler.popularity < settings.assignmentAppearancesBelowPop &&
    wrestler.gimmickFreshness > settings.assignmentAppearancesNeedFreshness
  ) {
    return 'appearances';
  }
  return 'gym';
}

/** What they are actually doing this week, pin or assistant. */
export function assignmentOf(wrestler: Wrestler, settings: WorldSettings): AssignmentId {
  const pinned = wrestler.assignment;
  if (!pinned || pinned === 'auto') return autoAssignment(wrestler, settings);
  return pinned;
}

// --------------------------------------------------------------- the effects

export interface WeekOff {
  /** Stat movements, already bounded by potential. Apply and forget. */
  strength: number;
  skill: number;
  agility: number;
  stamina: number;
  ringIQ: number;
  popularity: number;
  health: number;
  energy: number;
  morale: number;
  /** How much more worn the act is. Negative would be a repackage, not a week. */
  freshnessCost: number;
  /** Appearance money, gross. Small — this is a signing table, not a tour. */
  earned: number;
  /** What the roster card says they did, when it is worth saying. */
  note: string | null;
}

function empty(): WeekOff {
  return {
    strength: 0,
    skill: 0,
    agility: 0,
    stamina: 0,
    ringIQ: 0,
    popularity: 0,
    health: 0,
    energy: 0,
    morale: 0,
    freshnessCost: 0,
    earned: 0,
    note: null,
  };
}

/**
 * How fast this person improves at all.
 *
 * `growthRate` is the talent half and has never been read by anything. Age is
 * the other half and matters more: a twenty-two-year-old in the gym is a
 * different proposition from a thirty-eight-year-old in the same gym, and a
 * system where they improved alike would make every veteran roster as good as
 * a young one given enough weeks.
 */
export function learningRate(wrestler: Wrestler, settings: WorldSettings): number {
  const talent = wrestler.growthRate ?? 1;
  const young = clamp(
    (settings.assignmentAgeNoGain - wrestler.age) /
      Math.max(1, settings.assignmentAgeNoGain - settings.assignmentAgePeak),
    0,
    1,
  );
  return talent * young;
}

/** How much room is left before their ceiling. Nothing grows past its potential. */
function headroom(current: number, ceiling: number): number {
  return Math.max(0, ceiling - current) / 100;
}

/**
 * One week not on a card.
 *
 * Everything here is small on purpose. A week is a week: the numbers only mean
 * something over a season, which is the horizon a booker developing somebody
 * is actually working on. Anything big enough to feel in a fortnight would
 * make the card irrelevant and the gym the whole game.
 */
export function weekOff(
  wrestler: Wrestler,
  doing: AssignmentId,
  settings: WorldSettings,
): WeekOff {
  const out = empty();
  const rate = learningRate(wrestler, settings);
  const caps = wrestler.potentials;

  switch (doing) {
    case 'gym': {
      const step = settings.assignmentGymGain * rate;
      out.strength = step * headroom(wrestler.strength, caps?.strength ?? 100);
      out.agility = step * headroom(wrestler.agility, caps?.agility ?? 100);
      out.stamina = step * headroom(wrestler.stamina, caps?.stamina ?? 100);
      // Training is training. It is not a rest week.
      out.energy = -settings.assignmentGymEnergyCost;
      out.note = 'In the gym all week.';
      break;
    }

    case 'ring': {
      // Ring IQ has no `potentials` entry and deliberately no ceiling from
      // one: knowing what to do out there is learned rather than gifted, which
      // is the whole reason it is not `skill`. It slows down near the top
      // instead, because the last ten points are the hard ones.
      const step = settings.assignmentRingGain * rate;
      out.ringIQ = step * headroom(wrestler.ringIQ, 100);
      out.skill = settings.assignmentRingSkillShare * step * headroom(wrestler.skill, caps?.skill ?? 100);
      out.energy = -settings.assignmentRingEnergyCost;
      out.note = 'Working the empty building.';
      break;
    }

    case 'appearances': {
      // Sells them to people who have not seen a show. The cost is that the
      // act is being spent either way — an appearance is exposure, and
      // exposure is exactly what wears a gimmick out. See sim/freshness.ts.
      out.popularity = settings.assignmentAppearanceDraw * (wrestler.charisma / 100 + 0.4);
      out.freshnessCost = settings.assignmentAppearanceFreshnessCost;
      out.energy = -settings.assignmentAppearanceEnergyCost;
      out.earned = Math.round(settings.assignmentAppearanceFee * (wrestler.popularity / 100));
      out.note = 'Out signing photographs.';
      break;
    }

    case 'rest': {
      out.health = settings.assignmentRestHealth;
      out.energy = settings.assignmentRestEnergy;
      out.morale = settings.assignmentRestMorale;
      // The one who wanted the road to stop gets more out of it than anybody.
      if (hasTrait(wrestler, 'wantsMoreTimeOff')) out.morale += settings.assignmentRestWantedBonus;
      // And a body that keeps breaking mends better when it is left alone.
      if (hasTrait(wrestler, 'madeOfGlass')) out.health += settings.assignmentRestGlassBonus;
      out.note = 'Sent home for the week.';
      break;
    }
  }

  return out;
}

/**
 * What the card says they are doing, and whether the booker chose it.
 *
 * Says "the office decided" out loud on an auto pick. A screen that showed a
 * choice without saying whose it was would have the player believing they had
 * pinned thirty people they never touched.
 */
export function assignmentLine(wrestler: Wrestler, settings: WorldSettings): string {
  const doing = assignmentOf(wrestler, settings);
  const kind = assignmentById(doing)!;
  const pinned = wrestler.assignment && wrestler.assignment !== 'auto';
  return pinned ? kind.name : `${kind.name} · office`;
}
