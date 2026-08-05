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
  Stable,
  ShowSetup,
  Title,
  Relationship,
  Passing,
} from '../engine/types';
import type { HallOfFameEntry } from '../engine/career/hallOfFame';
import type { RivalShow } from '../engine/world/rivalBooking';
import type { AuctionLot, AuctionResult } from '../engine/world/auction';
import type { Publication } from '../engine/world/publication';
import type { PoachingOffer } from '../engine/world/poaching';
import type { FreeAgent } from '../engine/world/freeAgents';
import { generateFreeAgentPool } from '../engine/world/freeAgents';
import type { RatingResult, ChartRow } from '../engine/world/tvRatings';
import type { PendingEvent } from '../engine/events/types';
import type { EventHistory } from '../engine/events/scheduler';
import type { TamperingAttempt } from '../engine/world/tampering';
import { emptyEventHistory } from '../engine/events/scheduler';
import type { Rng } from '../engine/rng';
import { generateWrestlers } from '../engine/generate/wrestler';
import { createRivalry } from '../engine/sim/rivalry';
import { createStandardContract } from '../engine/economy/contracts';
import { createStartingTitles, awardTitle } from '../data/titles';
import { identityOf } from '../data/promotionIdentity';
import type { PromotionArchetype } from '../data/promotionIdentity';
import { seedRelationships } from '../engine/career/relationships';
import { formTeams, teamIdFactory } from '../engine/world/tagTeams';
import { bestAvailableVenue } from '../data/venues';
import type { AssetCondition } from '../engine/economy/showBudget';
import type { ContractDemand } from '../engine/career/ego';

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
  stables: Stable[];
  /** AI promotions competing for the same audience. */
  rivals: Promotion[];
  /**
   * Last week's sheet, kept so this week's can show which way people moved.
   * The current one is derived on read — only the comparison needs storing.
   */
  lastPublication: Publication | null;
  /** A fire sale awaiting your bid. Resolves whether or not you answer. */
  pendingAuction: PendingAuction | null;
  /** How the last fire sale went. Shown once. */
  lastAuction: { lot: AuctionLot; result: AuctionResult; wonByName: string } | null;
  /** What the other promotions ran this week. Replaced every week. */
  rivalShows: RivalShow[];
  /** This week's TV ratings, player and rivals, newest first. */
  tvHistory: { week: number; results: RatingResult[] }[];
  /** The event awaiting a decision, if any. Blocks nothing — the player can ignore it. */
  pendingEvent: PendingEvent | null;
  /** Outcome of the last decision, shown once then cleared. */
  lastEventOutcome: { title: string; summary: string } | null;
  eventHistory: EventHistory;
  /** Rival offers currently on the table. */
  tamperingOffers: TamperingAttempt[];
  /** Rival offers awaiting your answer — you always get one first. */
  poachingOffers: PoachingOffer[];
  /** One-time production purchases. They travel to every show. */
  ownedAssetIds: Id[];
  /** How worn each owned asset is. Gear does not last forever. */
  assetConditions: AssetCondition[];
  /** Contract renewals waiting on an answer, opened when a deal runs down. */
  pendingRenewals: RenewalOffer[];
  /** How this week's show is being staged. */
  showSetup: ShowSetup;
  /**
   * How long the bank has been under water. Past the grace period the
   * promotion folds — see `folded`.
   */
  weeksInTheRed: number;
  /** Set when the promotion goes under. The save becomes a record, not a game. */
  folded: { week: number; reason: string } | null;
  /** Weeks left on a signing ban from being caught tampering. */
  signingBanWeeks: number;
  /** Weeks dark from a tampering suspension. No shows, wages still due. */
  suspensionWeeks: number;
  /** How many times you have been caught tampering. Sanctions escalate. */
  tamperingOffenses: number;
  /** Everyone in the business who is not signed anywhere. */
  freeAgents: FreeAgent[];
  /** Championships. A promotion's spine. */
  titles: Title[];
  /** Everyone who has died, oldest first. §19's memorial wall. */
  memoriam: Passing[];
  /** The hall of fame, in induction order. */
  hallOfFame: HallOfFameEntry[];
  /** What the turn of the year brought. Shown once, then it is history. */
  yearInReview: YearInReview | null;
  /** Who gets on with whom. */
  relationships: Relationship[];
  /** The week's television chart: wrestling plus the rest of the dial. */
  ratingsChart: { week: number; rows: ChartRow[] }[];
  /**
   * How many times each pair has been in a match together, keyed by their two
   * ids sorted and joined. §12.5 route 3: "two wrestlers meeting three times
   * in a short span organically generates a rivalry."
   */
  meetings: Record<string, number>;
  nextId: number;
}

/**
 * What happened when the calendar turned: who went, who came back, who died,
 * who broke in, and who went into the hall. Surfaced on the office screen —
 * a year passing should feel like something, not like a silent counter.
 */
export interface YearInReview {
  year: number;
  retirements: { wrestlerId: Id; reason: string }[];
  comebacks: { wrestlerId: Id; overId: Id | null }[];
  passings: Passing[];
  graduates: Id[];
  inductions: HallOfFameEntry[];
  vacatedTitleIds: Id[];
}

/** A lot on the table, with the week it has to be answered by. */
export interface PendingAuction {
  lot: AuctionLot;
  openedWeek: number;
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
    managerIds: [],
    // Nobody assigned means the cheapest official in the building takes it,
    // which is also what it looks like on screen.
    refereeId: null,
    guestRefereeId: null,
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
    // Every one of them is on a plain two-year deal. Before this, contracts
    // were null across the board and payroll silently computed to zero.
    w.contract = createStandardContract(w, settings, settings.startingYear);
    wrestlers[w.id] = w;
  }

  // Everyone else in the business. Generated after the roster so the
  // distinctness check (§7) sees the signed talent first.
  const pool = generateFreeAgentPool(
    rng,
    settings,
    roster.map((w) => w.appearance),
    new Set(roster.map((w) => w.name.trim().toLowerCase())),
  );
  for (const agent of pool.wrestlers) wrestlers[agent.id] = agent;

  const promotion: Promotion = {
    id: 'player-promotion',
    name: settings.promotionName,
    identity: settings.promotionArchetype,
    isPlayer: true,
    rating: settings.startingCompanyRating,
    bankBalance: settings.startingCash,
    rosterIds: roster.map((w) => w.id),
    titleIds: [],
    ownedTerritoryIds: [],
    homeTerritoryId: 'territory-unassigned',
    styleProfile: styleProfileFor(settings.promotionArchetype),
    bookingCredibility: 50,
    reputation: 50,
    hardcoreSaturation: 0,
    // A new promotion has no track record; its first show sets the bar.
    recentShowQuality: settings.startingCompanyRating,
    weeksInTheRed: 0,
    closedWeek: null,
    // DESIGN: a real Wrestler with role 'owner' is M5 (owner mandates); a
    // bare id placeholder is enough for M2, which never dereferences it.
    ownerId: randomId(rng, 'owner'),
  };

  const rivals = createRivalPromotions(rng, settings);

  // Every rival is staffed. A promotion with a name and no wrestlers cannot
  // run a show, and until they run shows they are scenery.
  for (const rival of rivals) {
    const size = rivalRosterSize(rival.rating, settings);
    const signed = generateWrestlers(rng, size, {
      currentYear: settings.startingYear,
      existingAppearances: Object.values(wrestlers).map((w) => w.appearance),
      existingNames: new Set(Object.values(wrestlers).map((w) => w.name.trim().toLowerCase())),
    });
    for (const w of signed) {
      w.promotionId = rival.id;
      w.contract = createStandardContract(w, settings, settings.startingYear);
      wrestlers[w.id] = w;
    }
    rival.rosterIds = signed.map((w) => w.id);
  }

  // Tag teams, for everybody. A tag division without named teams in it is
  // just two people who happened to be on the same side that week.
  const stables: Stable[] = [];
  const takenTeamNames = new Set<string>();
  const addTeams = (people: Wrestler[], promotionId: Id) => {
    const formed = formTeams(
      rng,
      people,
      promotionId,
      { taken: takenTeamNames, week: 1, count: settings.tagTeamsPerPromotion },
      teamIdFactory(promotionId),
    );
    for (const team of formed) takenTeamNames.add(team.name);
    stables.push(...formed);
  };
  addTeams(roster, promotion.id);
  for (const rival of rivals) {
    addTeams(rival.rosterIds.map((id) => wrestlers[id]!).filter(Boolean), rival.id);
  }

  const playerTitles = crownOpeningChampions(
    createStartingTitles(promotion.id, promotion.name, promotion.identity),
    roster,
  );
  promotion.titleIds = playerTitles.map((t) => t.id);

  // Rival belts exist and have champions from week one, so the world has a
  // full map of championships in it — you can see that Northern Combat League
  // crowns a Deathmatch Champion and Meridian Grappling does not, and who is
  // carrying each one.
  const rivalTitles = rivals.flatMap((rival) => {
    const belts = crownOpeningChampions(
      createStartingTitles(rival.id, rival.name, rival.identity),
      rival.rosterIds.map((id) => wrestlers[id]!).filter(Boolean),
    );
    rival.titleIds = belts.map((t) => t.id);
    return belts;
  });

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
    stables,
    rivals,
    rivalShows: [],
    lastPublication: null,
    pendingAuction: null,
    lastAuction: null,
    tvHistory: [],
    pendingEvent: null,
    lastEventOutcome: null,
    eventHistory: emptyEventHistory(),
    tamperingOffers: [],
    poachingOffers: [],
    ownedAssetIds: [],
    assetConditions: [],
    pendingRenewals: [],
    showSetup: defaultShowSetup(settings),
    weeksInTheRed: 0,
    folded: null,
    signingBanWeeks: 0,
    suspensionWeeks: 0,
    tamperingOffenses: 0,
    freeAgents: pool.freeAgents,
    titles: [...playerTitles, ...rivalTitles],
    memoriam: [],
    hallOfFame: [],
    yearInReview: null,
    relationships: seedRelationships(rng, roster, settings),
    ratingsChart: [],
    meetings: {},
    nextId: 1,
  };
}

// DESIGN: rival promotions are full Promotions with their own roster and
// booking in §19/M5. What the player actually feels week to week is simpler:
// somebody is opposite them on television, drawing an audience, and sending
// people to talk to their talent. These are those promotions with a rating
// and a name — enough for TV ratings to be a real contest and for tampering
// to have a source. Giving them rosters and letting them book is the next
// layer, and it slots in behind this same shape.
// Each rival is a *kind* of company, not just a name — which is what makes
// losing a wrestler to one feel different from losing them to another. The
// deathmatch outfit and the mat-wrestling outfit want different people.
export const RIVAL_PROMOTIONS: { name: string; archetype: PromotionArchetype }[] = [
  { name: 'Continental Championship Wrestling', archetype: 'oldSchool' },
  { name: 'Atlas Pro', archetype: 'athletic' },
  { name: 'Northern Combat League', archetype: 'hardcore' },
  { name: 'Gold Coast Wrestling', archetype: 'sportsEntertainment' },
  { name: 'Iron City Championship', archetype: 'territory' },
  { name: 'Federación Deportiva', archetype: 'lucha' },
  { name: 'Sunbelt Wrestling Alliance', archetype: 'territory' },
  { name: 'Meridian Grappling', archetype: 'technical' },
];

/**
 * How many wrestlers a rival carries. A national outfit has depth; a regional
 * one runs six-man cards with the same eight people every week, which is
 * exactly why its shows rate lower.
 */
export function rivalRosterSize(rating: number, settings: WorldSettings): number {
  const span = settings.rivalRosterSizeMax - settings.rivalRosterSizeMin;
  return Math.round(settings.rivalRosterSizeMin + (rating / 100) * span);
}

/** A promotion books what it is known for. */
export function styleProfileFor(archetype: PromotionArchetype): Promotion['styleProfile'] {
  const identity = identityOf(archetype);
  return {
    preferredStyles: [...identity.favouredStyles],
    violenceTolerance: identity.violenceTolerance,
    workrateVsStarPower: identity.workrateVsStarPower,
    divisionFocus: ['mens'],
    promoHeavy: identity.workrateVsStarPower < 40,
  };
}

function createRivalPromotions(rng: Rng, settings: WorldSettings): Promotion[] {
  // If the player took over one of these companies, it is not also out there
  // competing with them.
  const remaining = RIVAL_PROMOTIONS.filter((p) => p.name !== settings.promotionName);
  const rivals: Promotion[] = [];
  // Fixed up front: `remaining` shrinks as we splice from it, so re-reading
  // its length in the loop condition would quietly cut the field short.
  const count = Math.min(settings.rivalPromotionCount, remaining.length);

  for (let i = 0; i < count; i++) {
    const index = Math.floor(rng.next() * remaining.length);
    const { name, archetype } = remaining.splice(index, 1)[0]!;
    // A spread of sizes: one or two above the player, several below. Losing a
    // wrestler to the biggest promotion in the country should feel different
    // from losing one to a regional outfit.
    const rating = 25 + Math.floor(rng.next() * 60);

    rivals.push({
      id: `rival-${i}`,
      name,
      identity: archetype,
      isPlayer: false,
      rating,
      bankBalance: Math.round(rating * 4000),
      rosterIds: [],
      titleIds: [],
      ownedTerritoryIds: [],
      homeTerritoryId: 'territory-unassigned',
      styleProfile: styleProfileFor(archetype),
      bookingCredibility: 50,
      reputation: rating,
      hardcoreSaturation: 0,
      recentShowQuality: rating,
      weeksInTheRed: 0,
      closedWeek: null,
      ownerId: `owner-rival-${i}`,
    });
  }

  return rivals;
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

/** A contract that has run down, and what the wrestler is asking for. */
export interface RenewalOffer {
  wrestlerId: Id;
  demand: ContractDemand;
  openedWeek: number;
}

/** Opening staging: the cheapest room, a modest ticket, nothing extra. */
export function defaultShowSetup(settings: WorldSettings): ShowSetup {
  return { venueId: bestAvailableVenue(settings.startingCompanyRating).id, ticketPrice: 12, extraIds: [] };
}

// DESIGN: §5 has the player start a *new* promotion, which argues for vacant
// belts. But a promotion with no champions has no spine to book around and
// nothing for the roster screen to show, so the opening champions are crowned
// at creation — a new company naming its first title-holders is ordinary, and
// it means titles mean something from week one rather than from whenever the
// first tournament happens to land.
function crownOpeningChampions(titles: Title[], roster: readonly Wrestler[]): Title[] {
  const byPopularity = [...roster].sort((a, b) => b.popularity - a.popularity);
  const taken = new Set<Id>();

  const bestFor = (predicate: (w: Wrestler) => boolean, count = 1): Wrestler[] => {
    const picked: Wrestler[] = [];
    for (const w of byPopularity) {
      if (picked.length >= count) break;
      if (taken.has(w.id) || !predicate(w)) continue;
      picked.push(w);
      taken.add(w.id);
    }
    return picked;
  };

  return titles.map((title) => {
    const holders =
      title.tier === 'tag'
        ? bestFor(() => true, 2)
        : title.division === 'womens'
          ? bestFor((w) => w.gender === 'f')
          : bestFor((w) => w.gender === 'm');

    if (holders.length === 0) return title;
    return awardTitle(
      title,
      holders.map((w) => w.id),
      1,
      holders.map((w) => w.age),
    );
  });
}
