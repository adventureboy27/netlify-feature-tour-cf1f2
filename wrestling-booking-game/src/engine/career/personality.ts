// Who somebody actually is.
//
// The morale system asks the same questions of everybody: where were you on
// the card, did you go over, how long since your last match, is the company
// any good. Ask twenty-six people the same questions with the same weights and
// you get twenty-six versions of the same person, differing only in how far
// along the slide they are. That is what a played save looked like — a room
// that moved as one block, because nothing in it wanted different things.
//
// A trait is a small, permanent, *stated* answer to "what does this one care
// about". It does two things and no more:
//
//   1. Shifts where their morale settles when nothing is happening. Some
//      people are hard to make unhappy and some are hard to please, and that
//      is a fact about them rather than a verdict on the booking.
//   2. Re-weights the terms the morale system already computes. The man who
//      only wants the money does not care where he is on the card; the man who
//      wants to be famous cares about nothing else. Neither of them gets a new
//      arithmetic — they get the same arithmetic weighted their way.
//
// It deliberately cannot do a third thing: no trait applies morale directly.
// Everything still goes through weeklyMorale's reasons, so every point of
// movement still comes with the sentence that caused it. A trait that could
// quietly subtract morale would be exactly the off-screen change §0 forbids.
//
// Traits are drawn once, at generation, and never change. Somebody who has
// been miserable for two years is miserable about something; somebody who is
// Never Satisfied was always going to be.

import type { Id, Wrestler, WorldSettings } from '../types';

/**
 * The parts of a week a trait can care more or less about than average.
 *
 * These name the terms weeklyMorale already produces, so a weight of 1.8 on
 * `spotlight` means "this person feels the card position term almost twice as
 * hard", not "this person gets a bonus".
 */
export type MoraleLever =
  /** Where on the card: main event, booked high, stuck in the undercard. */
  | 'spotlight'
  /** Going over, taking the loss, being beaten by a nobody. */
  | 'winning'
  /** Weeks without a match. */
  | 'idle'
  /** Carrying a championship. */
  | 'gold'
  /** How good the night was. */
  | 'theShow'
  /** Who they were in there with — friends, enemies, the mood around them. */
  | 'theRoom'
  /** What they are being paid against what they think they are worth. */
  | 'money';

export type TraitId =
  | 'gratefulForTheWork'
  | 'inItForTheMoney'
  | 'neverSatisfied'
  | 'wantsTheSpotlight'
  | 'noTimeForTheOffice'
  | 'somebodyAtHome'
  | 'wantsMoreTimeOff'
  | 'madeOfGlass'
  | 'lockerRoomLeader'
  | 'poison';

export interface Trait {
  id: TraitId;
  /** What the roster card calls it. */
  name: string;
  /** One line, written for the booker: what this costs you and what it buys. */
  blurb: string;
  /** Relative draw weight. */
  weight: number;
  /** Never drawn alongside these. */
  excludes?: TraitId[];
  /**
   * Where their morale sits when nothing at all is happening, as a shift on
   * the company's set point. This is the "some people are just happy" term.
   */
  setPointShift?: number;
  /** How hard each part of the week lands. 1 is average; omitted is 1. */
  weighs?: Partial<Record<MoraleLever, number>>;
  /**
   * Turns the idle penalty upside down: time off is what they wanted, and
   * being booked every week is the grievance.
   */
  wantsRest?: boolean;
  /** Raises or lowers how often this body breaks. See sim/injury. */
  injuryProneness?: number;
  /**
   * How much of their own mood rubs off on the people they work with, as a
   * multiplier on the contagion the room already models.
   */
  spreadsMood?: number;
  /**
   * Multiplier on the chance a refused renewal demand ends in them walking.
   * See career/ego.ts — this is what makes a refusal read differently for a
   * loyal veteran than for somebody who was only ever here for the cheque.
   */
  walkRiskWeight?: number;
  /**
   * Multiplier on how easy a rival finds them to poach, applied to the whole
   * temptation score. Reserved for traits whose loyalty (or lack of it) is
   * not about any one term — a specific number like pay or a bad office gets
   * its own hook in world/poaching.ts instead of this.
   */
  temptationWeight?: number;
  /**
   * Shift on the morale threshold below which somebody asks for a release,
   * additive. Positive means readier to ask; negative means more reluctant.
   * See economy/termination.ts.
   */
  releaseThresholdShift?: number;
}

/** Everything about a person a trait needs to see. Structural, so no cycles. */
export interface TraitSubject {
  id: Id;
  morale: number;
  popularity: number;
  weeklyPay: number;
  /** What the market says they are worth right now. */
  worth: number;
  /** How many weeks running they have been booked. */
  weeksStraight: number;
  /** Times this body has broken down. */
  injuries: number;
  /** Set for `somebodyAtHome`: who, and whether they are at this company. */
  attached: { name: string; hereToo: boolean } | null;
  promotionName: string;
}

// ---------------------------------------------------------------- the pool

/**
 * The traits themselves.
 *
 * Written as people rather than as modifiers. Each one should be recognisable
 * from the locker room it came out of, and each one should change what the
 * *booker* does about that person — a trait nobody would book around is a
 * number with a name on it.
 */
export const TRAITS: readonly Trait[] = [
  {
    id: 'gratefulForTheWork',
    name: 'Grateful for the work',
    blurb: 'Wrestling for a living was the whole ambition. Does not need the belt and does not need the main event.',
    weight: 12,
    excludes: ['neverSatisfied', 'wantsTheSpotlight'],
    setPointShift: 12,
    weighs: { spotlight: 0.25, gold: 0.3, winning: 0.4 },
    // Loyal in every direction this session wires up: slow to walk over a
    // refused demand, hard for a rival to get, reluctant to ask for a release
    // at all.
    walkRiskWeight: 0.5,
    temptationWeight: 0.55,
    releaseThresholdShift: -14,
  },
  {
    id: 'inItForTheMoney',
    name: 'In it for the money',
    blurb: 'Will lose to anybody, anywhere, in any order, provided the cheque clears. Underpay them and none of the rest of it helps.',
    weight: 9,
    excludes: ['wantsTheSpotlight'],
    weighs: { winning: 0.15, spotlight: 0.4, gold: 0.4, money: 2.4 },
    // The `money` lever above is reused directly in career/ego.ts and
    // world/poaching.ts, so this trait does the same thing at the
    // negotiating table and to a rival's offer that it already does to
    // morale: the number is what moves them, nothing else does much.
    walkRiskWeight: 1.3,
  },
  {
    id: 'neverSatisfied',
    name: 'Never satisfied',
    blurb: 'Something is always wrong. Good weeks land lighter and bad weeks land harder, and it is not about you.',
    weight: 8,
    excludes: ['gratefulForTheWork'],
    setPointShift: -14,
    walkRiskWeight: 1.3,
    releaseThresholdShift: 8,
  },
  {
    id: 'wantsTheSpotlight',
    name: 'Wants the spotlight',
    blurb: 'Being on top is the point. Main event them or hear about it — but they are worth more up there than most.',
    weight: 10,
    excludes: ['gratefulForTheWork', 'inItForTheMoney'],
    weighs: { spotlight: 1.9, gold: 1.8, idle: 1.6, winning: 1.3 },
    walkRiskWeight: 1.3,
    releaseThresholdShift: 6,
  },
  {
    id: 'noTimeForTheOffice',
    name: 'No time for the office',
    blurb: 'Does not like management, will not be talked round, and nothing you book changes it. Everything else about them still works.',
    weight: 7,
    setPointShift: -9,
    walkRiskWeight: 1.2,
    releaseThresholdShift: 10,
  },
  {
    id: 'somebodyAtHome',
    name: 'Somebody at home',
    blurb: 'Their partner works somewhere else. Every week apart is a week they are thinking about the drive.',
    weight: 7,
  },
  {
    id: 'wantsMoreTimeOff',
    name: 'Wants more time off',
    blurb: 'The road is the problem, not the booking. Rest them and they are fine; run them every week and they are not.',
    weight: 8,
    wantsRest: true,
  },
  {
    id: 'madeOfGlass',
    name: 'Made of glass',
    blurb: 'Breaks more than most and knows it. The file itself is what wears them down.',
    weight: 7,
    injuryProneness: 1.45,
  },
  {
    id: 'lockerRoomLeader',
    name: 'Locker room leader',
    blurb: 'Whatever mood they are in goes round the room. Keep them happy and it is the cheapest thing you will ever buy.',
    weight: 6,
    excludes: ['poison'],
    spreadsMood: 2.2,
    weighs: { theRoom: 1.4 },
    // Invested in the room they hold together — a reason to stay that has
    // nothing to do with money or the card.
    walkRiskWeight: 0.85,
    releaseThresholdShift: -4,
  },
  {
    id: 'poison',
    name: 'Poison',
    blurb: 'Whatever mood they are in goes round the room, and it is usually a bad one. Worth what they draw, and no more.',
    weight: 5,
    excludes: ['lockerRoomLeader'],
    setPointShift: -6,
    spreadsMood: 2.2,
  },
];

const BY_ID = new Map(TRAITS.map((t) => [t.id, t]));

export function traitById(id: TraitId): Trait | undefined {
  return BY_ID.get(id);
}

/** The traits somebody actually has, in definition order so the card is stable. */
export function traitsOf(wrestler: Pick<Wrestler, 'traits'>): Trait[] {
  const held = new Set(wrestler.traits ?? []);
  return TRAITS.filter((t) => held.has(t.id));
}

export function hasTrait(wrestler: Pick<Wrestler, 'traits'>, id: TraitId): boolean {
  return (wrestler.traits ?? []).includes(id);
}

// ---------------------------------------------------------------- the maths

/**
 * How hard one part of the week lands on this person.
 *
 * Multiplicative across traits, so somebody who drew two traits that both care
 * about the spotlight cares about it more than either alone. Nothing here can
 * flip a sign: a trait changes how much a good week is worth, never whether it
 * was a good week.
 */
export function leverWeight(
  wrestler: Pick<Wrestler, 'traits'>,
  lever: MoraleLever,
  settings: WorldSettings,
): number {
  let weight = 1;
  for (const trait of traitsOf(wrestler)) {
    weight *= trait.weighs?.[lever] ?? 1;
  }
  return Math.min(weight, settings.traitLeverCap);
}

/** Where this person's morale settles before anything happens to them. */
export function setPointShift(wrestler: Pick<Wrestler, 'traits'>): number {
  return traitsOf(wrestler).reduce((sum, t) => sum + (t.setPointShift ?? 0), 0);
}

/** How much of their mood the room catches from them. */
export function moodSpread(wrestler: Pick<Wrestler, 'traits'>): number {
  return traitsOf(wrestler).reduce((most, t) => Math.max(most, t.spreadsMood ?? 1), 1);
}

/** How much more or less often this body breaks. */
export function injuryProneness(wrestler: Pick<Wrestler, 'traits'>): number {
  return traitsOf(wrestler).reduce((mul, t) => mul * (t.injuryProneness ?? 1), 1);
}

/** Would they rather be at home than on the card? */
export function wantsRest(wrestler: Pick<Wrestler, 'traits'>): boolean {
  return traitsOf(wrestler).some((t) => t.wantsRest);
}

/** How much a refused renewal demand actually costs you. See career/ego.ts. */
export function walkRiskWeight(wrestler: Pick<Wrestler, 'traits'>): number {
  return traitsOf(wrestler).reduce((mul, t) => mul * (t.walkRiskWeight ?? 1), 1);
}

/** How easy a rival finds them to poach, overall. See world/poaching.ts. */
export function temptationWeight(wrestler: Pick<Wrestler, 'traits'>): number {
  return traitsOf(wrestler).reduce((mul, t) => mul * (t.temptationWeight ?? 1), 1);
}

/** Shift on the ask-for-a-release threshold. See economy/termination.ts. */
export function releaseThresholdShift(wrestler: Pick<Wrestler, 'traits'>): number {
  return traitsOf(wrestler).reduce((sum, t) => sum + (t.releaseThresholdShift ?? 0), 0);
}

// ------------------------------------------------------------ their own week

export interface TraitReason {
  text: string;
  delta: number;
}

/**
 * What each trait has to say about this particular week.
 *
 * These are the reasons no lever can express — being underpaid, being run into
 * the ground, being a long way from somebody. Every one produces a sentence,
 * because a trait that moved the number silently would be the thing §0 exists
 * to prevent.
 */
export function traitReasons(
  wrestler: Pick<Wrestler, 'traits'>,
  subject: TraitSubject,
  settings: WorldSettings,
): TraitReason[] {
  const out: TraitReason[] = [];

  for (const trait of traitsOf(wrestler)) {
    switch (trait.id) {
      case 'inItForTheMoney': {
        // The only person in the game who reads their own contract every week.
        // Being paid under the market is the grievance; being paid over it is
        // the whole of the loyalty, and it is genuinely cheap to buy.
        if (subject.worth <= 0) break;
        const gap = (subject.weeklyPay - subject.worth) / subject.worth;
        if (gap <= -settings.traitPayGapNotices) {
          out.push({
            text: 'Being paid under what they are worth, and they know the number.',
            delta: -Math.min(settings.traitPayGapMax, -gap * settings.traitPayGapWeight),
          });
        } else if (gap >= settings.traitPayGapNotices) {
          out.push({
            text: 'Paid well over the odds, and perfectly happy about everything else.',
            delta: Math.min(settings.traitPayGapMax, gap * settings.traitPayGapWeight),
          });
        }
        break;
      }

      case 'noTimeForTheOffice': {
        out.push({
          text: `Does not like anybody in the ${subject.promotionName} office, and never has.`,
          delta: 0,
        });
        break;
      }

      case 'somebodyAtHome': {
        if (!subject.attached) break;
        if (subject.attached.hereToo) {
          out.push({
            text: `Working the same shows as ${subject.attached.name}, which is all they wanted.`,
            delta: settings.traitTogetherGain,
          });
        } else {
          out.push({
            text: `A long way from ${subject.attached.name} again this week.`,
            delta: -settings.traitApartCost,
          });
        }
        break;
      }

      case 'wantsMoreTimeOff': {
        const over = subject.weeksStraight - settings.traitRestWantedAfter;
        if (over > 0) {
          out.push({
            text: `${subject.weeksStraight} weeks straight on the road.`,
            delta: -Math.min(settings.traitRoadCostMax, over * settings.traitRoadCostPerWeek),
          });
        }
        break;
      }

      case 'madeOfGlass': {
        if (subject.injuries < settings.traitGlassNoticesAfter) break;
        out.push({
          text: 'Sick of the sight of the doctor, and it is starting to show.',
          delta: -Math.min(
            settings.traitGlassCostMax,
            (subject.injuries - settings.traitGlassNoticesAfter + 1) * settings.traitGlassCostEach,
          ),
        });
        break;
      }

      default:
        break;
    }
  }

  return out;
}

// ------------------------------------------------------------------ drawing

/**
 * Draw somebody's traits.
 *
 * Most people get one. A few get two, which is where the interesting ones come
 * from — Grateful For The Work and Made Of Glass is a different man from
 * either. Nobody gets three: at that point the card is a list of adjectives
 * rather than a person.
 *
 * Takes a `next` rather than an Rng so generation can seed it from the
 * wrestler's own id and not disturb the world's stream.
 */
export function drawTraits(next: () => number, settings: WorldSettings): TraitId[] {
  const drawn: TraitId[] = [];
  const wanted = next() < settings.traitSecondChance ? 2 : 1;

  for (let i = 0; i < wanted; i++) {
    const banned = new Set<TraitId>(drawn);
    for (const id of drawn) {
      for (const other of traitById(id)?.excludes ?? []) banned.add(other);
    }
    const pool = TRAITS.filter((t) => !banned.has(t.id));
    const total = pool.reduce((sum, t) => sum + t.weight, 0);
    if (total <= 0) break;

    let roll = next() * total;
    for (const trait of pool) {
      roll -= trait.weight;
      if (roll <= 0) {
        drawn.push(trait.id);
        break;
      }
    }
  }

  return drawn;
}

/**
 * What the roster card says about somebody, in one line.
 *
 * Names the traits and nothing else. What they *mean* is the blurb, shown when
 * the booker asks — the card is already dense and a paragraph per person on it
 * is a paragraph nobody reads.
 */
export function traitLine(wrestler: Pick<Wrestler, 'traits'>): string | null {
  const held = traitsOf(wrestler);
  if (held.length === 0) return null;
  return held.map((t) => t.name).join(' · ');
}
