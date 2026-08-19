// The creative event engine — §20.
//
// Two rules govern the whole system, and both come from what makes an event
// library stay interesting past year five:
//
//   1. NOTHING FIRES TOO OFTEN. Every event carries its own cooldown, and
//      the engine enforces a global gap on top. An event the player has seen
//      three times in a season stops being a story and starts being weather.
//
//   2. EVERY EVENT IS A DECISION, AND EVERY OPTION COSTS SOMETHING. There is
//      no "OK" button and no free win. Each option lists what it gains and
//      what it costs, and the engine will not accept an option that only
//      gains — see assertEveryOptionHasATradeoff() in registry.ts, which is
//      run as a test over the whole library.
//
// Events never mutate state themselves. They return Effects; the store
// applies them. That keeps the library pure data plus small pure predicates,
// which is what lets it grow to the §0 target of 150+ without becoming a
// tangle.

import type { Id, Wrestler, Promotion, WorldSettings, CareerStatus } from '../types';

export type EventCategory =
  | 'lockerRoom' // morale, cliques, backstage friction
  | 'creative' // gimmicks, turns, character direction
  | 'business' // money, TV, sponsors, venues
  | 'rival' // other promotions, poaching
  | 'personal'; // injuries, life outside the ring, retirement

/** Who or what an event is about. Resolved when the event fires. */
export interface EventSubjects {
  primary?: Wrestler;
  secondary?: Wrestler;
  promotion: Promotion;
  rival?: Promotion;
}

/**
 * A change an option makes to the world. Deliberately a small closed set —
 * the store knows how to apply each one, and the event library can only
 * express things the store can actually do.
 */
export type EventEffect =
  | { kind: 'morale'; wrestlerId: Id; delta: number }
  | { kind: 'rosterMorale'; delta: number }
  | { kind: 'popularity'; wrestlerId: Id; delta: number }
  | { kind: 'momentum'; wrestlerId: Id; delta: number }
  | { kind: 'health'; wrestlerId: Id; delta: number }
  | { kind: 'money'; delta: number }
  | { kind: 'companyRating'; delta: number }
  | { kind: 'bookingCredibility'; delta: number }
  | { kind: 'reputation'; delta: number }
  | { kind: 'shootHeat'; wrestlerIds: Id[]; delta: number }
  | { kind: 'crowdHeat'; wrestlerIds: Id[]; delta: number }
  | { kind: 'gimmickChange'; wrestlerId: Id }
  | { kind: 'alignmentTurn'; wrestlerId: Id; toward: 'face' | 'heel' }
  | { kind: 'contractRate'; wrestlerId: Id; multiplier: number }
  | { kind: 'release'; wrestlerId: Id }
  | { kind: 'injury'; wrestlerId: Id; weeks: number }
  | { kind: 'formStable'; memberIds: Id[]; name: string }
  | { kind: 'disbandStable'; stableId: Id };

/**
 * One choice the player can make. `gains` and `costs` are the honest,
 * player-facing description of the trade — the game never hides that an
 * option has a downside, it just doesn't tell you how big it is (§0: "the
 * game never warns the player before a bad decision" is about *bad
 * bookings*, not about concealing what an option is).
 */
export interface EventOption {
  id: string;
  label: string;
  /** What you're hoping for. */
  gains: string;
  /** What it costs you. Required — an option with no cost is not a decision. */
  costs: string;
  /** Effects applied for certain. */
  effects: (subjects: EventSubjects, settings: WorldSettings) => EventEffect[];
  /**
   * Effects applied only if the gamble comes off, with the chance it does.
   * This is where an option's real risk lives: a certain small cost against
   * an uncertain large gain.
   */
  gamble?: {
    chance: (subjects: EventSubjects) => number;
    onSuccess: (subjects: EventSubjects, settings: WorldSettings) => EventEffect[];
    onFailure: (subjects: EventSubjects, settings: WorldSettings) => EventEffect[];
    /**
     * Route to a different follow-up node depending on the roll. Omit to
     * fall back to `next` (or terminate) regardless of the outcome — most
     * gambles still just end the conversation either way.
     */
    nextOnSuccess?: Id;
    nextOnFailure?: Id;
  };
  /**
   * Advance to this node instead of ending the conversation. Its effects
   * still apply immediately — a branch is "and then," not "instead of."
   * Omit to terminate here, as every option did before branching existed.
   */
  next?: Id;
}

/**
 * A follow-up beat in a branching event, reached only via `next` /
 * `nextOnSuccess` / `nextOnFailure` on an option — never fired directly by
 * the scheduler. `speaker` picks which resolved subject the dialogue screen
 * shows a portrait for; 'narrator' gets no portrait at all.
 */
export interface EventNode {
  id: Id;
  speaker: 'primary' | 'secondary' | 'narrator';
  /** Same convention as CreativeEvent.body: 1+ variants, picked at random. */
  body: string[];
  options: EventOption[];
}

export interface EventCondition {
  /** Minimum weeks into the save before this can fire at all. */
  minWeek?: number;
  /** Needs a wrestler matching this to be the subject. */
  primary?: (wrestler: Wrestler, status: CareerStatus) => boolean;
  /** Needs a second, different wrestler. */
  secondary?: (wrestler: Wrestler, status: CareerStatus) => boolean;
  /** Needs a rival promotion to exist. */
  needsRival?: boolean;
  /** Arbitrary gate on the promotion's state. */
  promotion?: (promotion: Promotion) => boolean;
}

export interface CreativeEvent {
  id: Id;
  category: EventCategory;
  /** Headline shown to the player. `{primary}` / `{secondary}` / `{rival}` are substituted. */
  title: string;
  /**
   * Who is actually saying `body`, for the conversation screen's portrait.
   * 'primary' — most single-subject events; the wrestler speaks in first
   * person and gets a portrait. 'narrator' — anything with two subjects (no
   * single mouth is doing the asking) or none at all (a sponsor, the
   * network, a rival's whole promotion): no portrait, third person.
   * 'secondary' exists for symmetry with EventNode but no root event uses it
   * yet — a follow-up node is the more natural place for the second person
   * in a two-subject event to get a turn.
   */
  speaker: 'primary' | 'secondary' | 'narrator';
  /**
   * 3-6 body variants, picked at random, so the same event reads differently
   * the second time it fires (§0 content budget). First person when
   * `speaker` is 'primary'/'secondary'; third person for 'narrator'.
   */
  body: string[];
  /** Relative likelihood among everything eligible this week. */
  weight: number;
  /** Weeks before this specific event may fire again. */
  cooldownWeeks: number;
  conditions: EventCondition;
  /** The root node's options. */
  options: EventOption[];
  /** Follow-up nodes a root (or another node's) option can branch into. */
  nodes?: Record<Id, EventNode>;
}

/**
 * A fired event, with its subjects resolved. Tracks which node is currently
 * showing and the scrollback of everything already said and chosen, so a
 * branching conversation can render as a continuous exchange rather than a
 * one-shot card.
 */
export interface PendingEvent {
  eventId: Id;
  week: number;
  title: string;
  body: string;
  /** Who's currently speaking `body` — the root event's, or the current node's. */
  speaker: 'primary' | 'secondary' | 'narrator';
  category: EventCategory;
  subjects: { primaryId?: Id; secondaryId?: Id; rivalId?: Id };
  options: { id: string; label: string; gains: string; costs: string }[];
  /** 'root' for the event's opening beat, otherwise an EventNode id. */
  currentNodeId: Id | 'root';
  /** Every node shown so far and what was picked there, oldest first. */
  history: { nodeId: Id | 'root'; body: string; choiceId: string; choiceLabel: string }[];
}
