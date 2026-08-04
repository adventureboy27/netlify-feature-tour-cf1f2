// The mutable game-state shape and its initial-world constructor.
// This is the one place besides the Zustand store itself that's allowed to
// know about a specific game session — engine/ stays pure and never
// imports from here (CLAUDE.md architecture rules).
//
// DESIGN (M2 scope): §22's full save shape has promotions[], titles[],
// territories[], rivalries[] — all systems that land in M3+. World here
// carries only what M2's milestone needs: a single player promotion, the
// active roster, and one card per week. Growing this into the full shape
// happens incrementally as each system's milestone lands, not up front.
//
// DESIGN (M2 scope): §8's weekly loop is a house show + a TV taping (PPV
// once a month). Building that whole schedule before there's even a
// single playable show is exactly the kind of jumping-ahead CLAUDE.md
// warns against ("M2 must be playable before M3 starts"). M2 books one TV
// taping per week; the house-show/PPV-month schedule is a straightforward
// extension of the same card-building code once the core loop is proven.

import type {
  Id,
  Wrestler,
  Promotion,
  Segment,
  MatchRules,
  DeckStacking,
  Show,
  WorldSettings,
  Rivalry,
  Tournament,
} from '../engine/types';
import type { Rng } from '../engine/rng';
import { generateWrestlers } from '../engine/generate/wrestler';
import { createRivalry } from '../engine/sim/rivalry';

export const SEGMENTS_PER_CARD = 6; // matches WorldSettings.segmentsPerTV default

export interface World {
  version: number;
  settings: WorldSettings;
  week: number; // absolute week index since game start, starting at 1
  wrestlers: Record<Id, Wrestler>;
  promotion: Promotion;
  currentCard: Segment[];
  showHistory: Show[];
  rivalries: Rivalry[];
  tournaments: Tournament[];
  /**
   * How many times each pair has been in a match together, keyed by their two
   * ids sorted and joined. §12.5 route 3: "two wrestlers meeting three times
   * in a short span organically generates a rivalry."
   */
  meetings: Record<string, number>;
  nextId: number;
}

/** Stable key for a pair of wrestlers, order-independent. */
export function pairKey(a: Id, b: Id): string {
  return [a, b].sort().join('~');
}

export function defaultMatchRules(): MatchRules {
  return {
    preset: 'singles',
    format: 'individuals',
    ruleStrictness: 'lenient',
    aim: 'firstFall',
    falls: 'pinsAndSubs',
    timeLimit: 15,
    stoppage: 'referee',
    countOuts: 'normal',
    reward: 'none',
  };
}

export function defaultDeckStacking(): DeckStacking {
  // Every field here is a real M4 system (§10) — defaults are neutral
  // (no stacking at all) until that milestone wires up the Match Setup
  // "Stack the Deck" tab.
  return {
    favoredSideIndex: null,
    assignedReferee: null,
    ringsideManagers: [],
    plannedRunIn: null,
    lumberjacks: [],
    preMatchAngle: 'none',
    instructions: 'callItInTheRing',
  };
}

export function createEmptySegment(slot: number): Segment {
  return {
    slot,
    kind: 'match',
    participants: [],
    rules: defaultMatchRules(),
    stipulation: null,
    titleIds: [],
    deckStacking: defaultDeckStacking(),
    result: null,
  };
}

export function createEmptyCard(segmentCount = SEGMENTS_PER_CARD): Segment[] {
  return Array.from({ length: segmentCount }, (_, i) => createEmptySegment(i));
}

function randomId(rng: Rng, prefix: string): string {
  let hex = '';
  for (let i = 0; i < 12; i++) hex += Math.floor(pseudoRandInt(rng, 16)).toString(16);
  return `${prefix}-${hex}`;
}

// Local, tiny — avoids pulling in engine/rng's randInt just for id hex digits here.
function pseudoRandInt(rng: Rng, max: number): number {
  return Math.floor(rng.next() * max);
}

export function createInitialWorld(rng: Rng, settings: WorldSettings): World {
  const roster = generateWrestlers(rng, settings.startingRosterSize, { currentYear: settings.startingYear });
  const wrestlers: Record<Id, Wrestler> = {};
  for (const w of roster) {
    w.promotionId = 'player-promotion';
    wrestlers[w.id] = w;
  }

  const promotion: Promotion = {
    id: 'player-promotion',
    name: 'Your Promotion',
    isPlayer: true,
    rating: settings.startingCompanyRating,
    bankBalance: settings.startingCash,
    rosterIds: roster.map((w) => w.id),
    titleIds: [],
    ownedTerritoryIds: [],
    homeTerritoryId: 'territory-unassigned',
    styleProfile: {
      preferredStyles: [],
      violenceTolerance: 50,
      workrateVsStarPower: 50,
      divisionFocus: ['mens'],
      promoHeavy: false,
    },
    bookingCredibility: 50,
    reputation: 50,
    hardcoreSaturation: 0,
    // DESIGN: a real Wrestler with role 'owner' is M5 (owner mandates); a
    // bare id placeholder is enough for M2, which never dereferences it.
    ownerId: randomId(rng, 'owner'),
  };

  return {
    version: 1,
    settings,
    week: 1,
    wrestlers,
    promotion,
    currentCard: createEmptyCard(settings.segmentsPerTV),
    showHistory: [],
    rivalries: seedShootRivalries(roster),
    tournaments: [],
    meetings: {},
    nextId: 1,
  };
}

// DESIGN: §12.5 route 2 says shoot rivalries arrive from real-life
// relationships and backstage incidents — which is the random event engine,
// M5.5. Rather than ship the mechanic dead until then, the world opens with
// two pairs who already can't stand each other, drawn from the worst
// attitudes on the roster. The booker didn't ask for these and didn't cause
// them, which is exactly how a shoot is supposed to feel. When the event
// engine lands it becomes another source feeding the same list.
const OPENING_SHOOT_RIVALRIES = 2;
const OPENING_SHOOT_HEAT = 55;

function seedShootRivalries(roster: Wrestler[]): Rivalry[] {
  const worstAttitudes = [...roster].sort((a, b) => a.attitude - b.attitude);
  const rivalries: Rivalry[] = [];

  for (let i = 0; i < OPENING_SHOOT_RIVALRIES; i++) {
    const a = worstAttitudes[i * 2];
    const b = worstAttitudes[i * 2 + 1];
    if (!a || !b) break;
    rivalries.push(createRivalry(`rivalry-shoot-${i}`, [a.id, b.id], 'shoot', 1, OPENING_SHOOT_HEAT));
  }

  return rivalries;
}
