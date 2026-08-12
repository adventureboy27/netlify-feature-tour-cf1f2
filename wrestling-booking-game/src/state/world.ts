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
  Territory,
  OwnerMandate,
  Referee,
} from '../engine/types';
import type { HallOfFameEntry } from '../engine/career/hallOfFame';
import type { AwardWinner, YearRecord } from '../engine/career/awards';
import type { Incident } from '../engine/sim/incidents';
import type { SecretSigning } from '../engine/world/secretSigning';
import type { Storyline } from '../engine/world/storyline';
import { emptyYearRecord } from '../engine/career/awards';
import type { RivalShow } from '../engine/world/rivalBooking';
import type { AuctionLot, AuctionResult } from '../engine/world/auction';
import type { PublicationPositions } from '../engine/world/publication';
import type { Tweet } from '../engine/world/fanReaction';
import type { PoachingOffer } from '../engine/world/poaching';
import type { FreeAgent } from '../engine/world/freeAgents';
import { generateFreeAgentPool } from '../engine/world/freeAgents';
import { createRefereeContract, seedRefereePool } from '../engine/sim/referees';
import type { Manager } from '../engine/sim/ringside';
import type { WireItem } from '../engine/world/wire';
import type { MemoriamShow } from '../engine/world/seasons';
import type { WeatherCall } from '../engine/world/weatherCall';
import type { BiddingResult, BiddingWar } from '../engine/economy/bidding';
import type { WeatherCallOptionId } from '../data/weatherCalls';
import type { RatingResult, ChartRow } from '../engine/world/tvRatings';
import type { PendingEvent } from '../engine/events/types';
import type { EventHistory } from '../engine/events/scheduler';
import type { TamperingAttempt } from '../engine/world/tampering';
import { emptyEventHistory } from '../engine/events/scheduler';
import type { Rng } from '../engine/rng';
import { pick, randInt, rngFromSeed } from '../engine/rng';
import { assignCommentaryTeam } from '../engine/sim/commentary';
import { COMMENTARY_TEAMS } from '../data/commentators';
import { generateWrestlers } from '../engine/generate/wrestler';
import { createRivalry } from '../engine/sim/rivalry';
import { createStandardContract } from '../engine/economy/contracts';
import { createStartingTitles, awardTitle } from '../data/titles';
import { identityOf } from '../data/promotionIdentity';
import type { PromotionArchetype } from '../data/promotionIdentity';
import { seedRelationships } from '../engine/career/relationships';
import { formTeams, teamIdFactory, tagTeamCountFor } from '../engine/world/tagTeams';
import { bestFittingVenue } from '../data/venues';
import { computeDemand, fairTicketPrice, potentialAudience } from '../engine/economy/showBudget';
import { TERRITORIES, createTerritories } from '../data/territories';
import { OWNER_PROFILES } from '../data/owners';
import { ppvCalendarFor } from '../data/ppvNames';
import { DEFAULT_PACE } from '../data/pacing';
import type { AttendanceRecord } from '../engine/world/territories';
import type { AssetCondition } from '../engine/economy/showBudget';
import type { ContractDemand } from '../engine/career/ego';

export const SEGMENTS_PER_CARD = 6; // matches WorldSettings.segmentsPerTV default

/**
 * A hurt champion, waiting on a decision. Carries the names rather than only
 * the ids so the Office can read without looking anything up, and so the wire
 * item still makes sense after the person retires.
 */
export interface ChampionCall {
  titleId: Id;
  titleName: string;
  championIds: Id[];
  championName: string;
  /** What is wrong with them, in the injury's own words. */
  injuryText: string;
  outFor: string;
  raisedWeek: number;
  /** Team-held belts have exactly one option and it is to vacate. */
  teamHeld: boolean;
}

export interface World {
  version: number;
  settings: WorldSettings;
  week: number; // absolute week index since game start, starting at 1
  wrestlers: Record<Id, Wrestler>;
  promotion: Promotion;
  currentCard: Segment[];
  /** Talking slots, separate from the match card — §9. */
  currentPromos: Segment[];
  showHistory: Show[];
  rivalries: Rivalry[];
  /**
   * The arcs the booker is running, on top of those rivalries. See
   * engine/world/storyline.ts — a rivalry is heat between two people, a
   * storyline is the story being told through it.
   */
  storylines: Storyline[];
  tournaments: Tournament[];
  stables: Stable[];
  /** AI promotions competing for the same audience. */
  rivals: Promotion[];
  /**
   * Last week's sheet, kept so this week's can show which way people moved.
   * The current one is derived on read — only the comparison needs storing.
   */
  lastPublication: PublicationPositions | null;
  /** What the fans said about the last show. */
  lastFanReaction: { week: number; verdict: string; tweets: Tweet[] } | null;
  /** A fire sale awaiting your bid. Resolves whether or not you answer. */
  pendingAuction: PendingAuction | null;
  /** How the last fire sale went. Shown once. */
  lastAuction: { lot: AuctionLot; result: AuctionResult; wonByName: string } | null;
  /** What the other promotions ran this week. Replaced every week. */
  rivalShows: RivalShow[];
  /**
   * The things nobody booked, from everywhere in the business this week. The
   * player's own are also on the segment they happened in; this is the list
   * the newsfeed reads, so a turn on somebody else's show is news too.
   */
  lastIncidents: { promotionId: Id; promotionName: string; incident: Incident }[];
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
  /**
   * Set when somebody on the roster dies. The next show the promotion runs is
   * a tribute — the business does this whether or not the booker feels like
   * it, so it is applied rather than offered, and cleared once it has run.
   */
  pendingMemoriam: MemoriamShow | null;
  /**
   * A severe forecast waiting on a decision. The week does not resolve until
   * it is answered — this is the one thing in the game that stops the clock,
   * and it stops it because running the show *is* the decision.
   */
  pendingWeatherCall: WeatherCall | null;
  /**
   * A champion is hurt and the booker has not said what to do about the belt.
   * Unlike the weather this does not hold the week open — the show goes on —
   * but it does expire: leave it long enough and the company vacates the
   * title for you, and says so.
   */
  pendingChampionCall: ChampionCall | null;
  /**
   * The one auction the business runs in the open. Rare: it takes a real star
   * hitting the market, or a phenom out of the school, plus at least two other
   * companies with the money to enter. Resolves whether or not the booker
   * answers — the room does not wait.
   */
  pendingBiddingWar: BiddingWar | null;
  /** How the last one went, shown once and then cleared. */
  lastBiddingWar: { war: BiddingWar; result: BiddingResult } | null;
  /**
   * Deals the world cannot see. Either a handshake with somebody whose rival
   * contract is running out, or a signed contract that started the hour their
   * old one lapsed and that nobody has been told about yet.
   */
  secretSignings: SecretSigning[];
  /** What was decided, carried into the resolve that follows. */
  weatherChoice: WeatherCallOptionId | null;
  /** Weeks left on a signing ban from being caught tampering. */
  signingBanWeeks: number;
  /** Weeks dark from a tampering suspension. No shows, wages still due. */
  suspensionWeeks: number;
  /** How many times you have been caught tampering. Sanctions escalate. */
  tamperingOffenses: number;
  /** Everyone in the business who is not signed anywhere. */
  freeAgents: FreeAgent[];
  /**
   * Every official in the business, signed and unsigned. They are characters
   * with contracts now, so they live in the save like wrestlers do — see
   * engine/sim/referees.ts.
   */
  referees: Referee[];
  /**
   * The official who works the whole card unless a match names somebody else.
   * The boxing model: one man for the night, and the good one saved for the
   * matches that matter.
   */
  defaultRefereeId: Id | null;
  /**
   * Managers who are your own wrestlers rather than hires from the standing
   * pool. They cost nothing per night because they are already on the
   * payroll — see engine/career/transition.ts.
   */
  staffManagers: Manager[];
  /**
   * Wrestlers who have asked to be let go, awaiting an answer. They keep
   * working while they wait — and get unhappier every week they do.
   */
  releaseRequests: { wrestlerId: Id; openedWeek: number }[];
  /**
   * Everything that happened to anybody this week — deaths, retirements,
   * comebacks, team splits, rival signings, inductions, debuts. Cleared at
   * the top of every week and printed on the results page.
   *
   * The single answer to "was this reported?". See engine/world/wire.ts for
   * what was silently slipping through before it existed.
   */
  weeklyNews: WireItem[];
  /**
   * What has happened to people so far this year, accumulated week by week
   * and drained into the year-in-review each December.
   *
   * Deaths, retirements and comebacks used to be *rolled* once a year, which
   * meant fifty-one quiet weeks and one December where six people retired,
   * three died and every tag team split up on the same night. They roll
   * weekly now; this is what the annual digest reads instead.
   */
  /**
   * Companies that have turned a trade down recently, and when. They will not
   * take the call again for a while — otherwise the player just re-asks every
   * week until the dice land.
   */
  tradeRefusals: Record<Id, number>;
  /**
   * How numb the crowd is to each pace, keyed by pace id. Only the ones that
   * carry a cost ever climb — a sprint never gets old because it was never
   * the point.
   */
  paceSaturation: Record<string, number>;
  thisYear: {
    passings: Passing[];
    retirements: { wrestlerId: Id; reason: string }[];
    comebacks: { wrestlerId: Id; overId: Id | null }[];
  };
  /** Championships. A promotion's spine. */
  titles: Title[];
  /** The map. Twelve markets, each with its own memory of every promotion. */
  territories: Territory[];
  /** The biggest house each town has ever drawn, keyed by territory id. */
  attendanceRecords: Record<Id, AttendanceRecord>;
  /** Everyone who has died, oldest first. §19's memorial wall. */
  memoriam: Passing[];
  /** The hall of fame, in induction order. */
  hallOfFame: HallOfFameEntry[];
  /** The network, if anybody is carrying the show. */
  broadcastDealId: string | null;
  /** Sponsors currently on the banner. */
  sponsorIds: string[];
  /** A deal on the table, awaiting an answer. */
  pendingBroadcastOffer: string | null;
  pendingSponsorOffers: string[];
  /** How many weeks each paymaster has been looking at a broken condition. */
  breachWeeks: Record<string, number>;
  /** Weeks the company rating has been at or above its current tier's bar. */
  weeksAtRating: number;
  /** Paymasters who walked, shown once. */
  lastDealsLost: { name: string; reason: string }[];
  /** What the owner currently wants, and when they want it by. */
  mandate: OwnerMandate | null;
  /** How the last one went. Shown once, then cleared. */
  lastMandateOutcome: { description: string; met: boolean; verdict: string } | null;
  /** Failed mandates. Three and the run is over — §17, LOCKED. */
  mandateStrikes: number;
  /** Set when the owner fires you. Like `folded`, the save becomes a record. */
  fired: { week: number; reason: string } | null;
  /** The biggest house drawn since the current mandate was issued. */
  bestAttendanceThisMandate: number;
  /** What the turn of the year brought. Shown once, then it is history. */
  yearInReview: YearInReview | null;
  /**
   * The year so far, gathered as it happens. None of it can be rebuilt after
   * the fact — what somebody's popularity was last January is gone the moment
   * it changes — so unlike almost everything else here it is stored, not
   * derived.
   */
  yearRecord: YearRecord;
  /** Every award ever handed out, newest year last. */
  awardHistory: AwardWinner[];
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
  /** The awards night. Empty in a year that earned nothing. */
  awards: AwardWinner[];
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
    pace: DEFAULT_PACE,
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

/**
 * The promo slots, which sit alongside the card rather than inside it — §9 is
 * explicit that they do not consume match spots. Two a night by default.
 */
export function createEmptyPromoSlots(count: number): Segment[] {
  return Array.from({ length: count }, (_, i) => ({
    ...createEmptySegment(i),
    kind: 'promo' as const,
    promoTopicId: null,
    promoSpeakerId: null,
    promoTargetId: null,
    promoMouthpieceId: null,
    promoResult: null,
  }));
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
  // Everybody in the business comes from somewhere. Wrestler.homeTerritoryId
  // has been on the type since the beginning and was written as the literal
  // 'territory-unassigned' for every single person ever generated — see
  // engine/career/reach.ts, which is what finally reads it.
  const territoryIds = TERRITORIES.map((t) => t.id);

  const roster = generateWrestlers(rng, settings.startingRosterSize, {
    // Rolls what the business believes about them, as against what is true.
    settings,
    homeTerritoryIds: territoryIds,
    currentYear: settings.startingYear,
    // Built to a division split rather than rolled per head. Left to chance a
    // small roster regularly produced a two-woman division, which is one
    // match for a championship, repeated until somebody retires.
    divisionShare: settings.womensRosterShare,
    divisionFloor: settings.womensDivisionFloor,
  });
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

  const startingSetup = defaultShowSetup(settings);

  const promotion: Promotion = {
    id: 'player-promotion',
    name: settings.promotionName,
    identity: settings.promotionArchetype,
    ppvCalendar: ppvCalendarFor(settings.promotionArchetype, settings.ppvCalendarSize, 0),
    isPlayer: true,
    rating: settings.startingCompanyRating,
    bankBalance: settings.startingCash,
    rosterIds: roster.map((w) => w.id),
    titleIds: [],
    ownedTerritoryIds: [],
    homeTerritoryId: startingSetup.territoryId,
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
    // Who calls the matches. Drawn once and kept — see sim/commentary.ts.
    //
    // From its own stream, not the world's. Commentary is narration: it must
    // never move the simulation's random sequence, or adding a line of banter
    // would change who wins matches three years from now. Measured the hard
    // way — assigning this from `rng` shifted every seeded outcome in the
    // game and broke two unrelated tests.
    commentaryTeam: assignCommentaryTeam(
      rngFromSeed(`${settings.seed}-broadcast`),
      COMMENTARY_TEAMS,
      new Set(),
    ),
    ownerId: randomId(rng, 'owner'),
    // Who you work for, and therefore what you are going to be leaned on
    // about for the rest of the save.
    ownerPersonality: pick(rng, OWNER_PROFILES).id,
  };

  // The officials. Everybody starts unsigned except the one warm body you
  // inherited — competent enough to keep a match together, not good enough to
  // survive six of them in a night.
  const referees = seedRefereePool();
  const startingReferee = referees.find((r) => r.id === 'ref-poole');
  if (startingReferee) {
    startingReferee.promotionId = promotion.id;
    startingReferee.contract = createRefereeContract(startingReferee, settings, settings.startingYear);
  }

  const rivals = createRivalPromotions(rng, settings);

  // Every rival is staffed. A promotion with a name and no wrestlers cannot
  // run a show, and until they run shows they are scenery.
  for (const rival of rivals) {
    const size = rivalRosterSize(rival.rating, settings);
    const signed = generateWrestlers(rng, size, {
      // Rolls what the business believes about them, as against what is true.
      settings,
      homeTerritoryIds: territoryIds,
      currentYear: settings.startingYear,
      existingAppearances: Object.values(wrestlers).map((w) => w.appearance),
      existingNames: new Set(Object.values(wrestlers).map((w) => w.name.trim().toLowerCase())),
    });
    for (const w of signed) {
      w.promotionId = rival.id;
      w.contract = createStandardContract(w, settings, settings.startingYear);
      // Staggered, not uniform. Every rival deal being the same length means
      // nobody in the business is ever running down until one week when
      // everybody is at once — and a deal running down is the only thing that
      // makes a man quietly available. See world/secretSigning.ts.
      w.contract.weeksRemaining = randInt(
        rng,
        settings.rivalContractMinWeeks,
        settings.rivalContractMaxWeeks,
      );
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
      // Teams scale with the roster. A fixed three put six of a fourteen-person
      // company in tag teams and left a forty-person company with the same
      // three, so tag division depth had nothing to do with company size.
      {
        taken: takenTeamNames,
        week: 1,
        count: tagTeamCountFor(people.length, settings),
      },
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
    // The player's own lineup if they built one on the new-game screen,
    // otherwise the house style's suggestion. Rivals always take the
    // suggestion — see below.
    createStartingTitles(promotion.id, promotion.name, promotion.identity, settings.startingTitles),
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
    version: 5,
    settings,
    week: 1,
    wrestlers,
    promotion,
    currentCard: createEmptyCard(settings.segmentsPerTV),
    currentPromos: createEmptyPromoSlots(settings.promoSlotsPerCard),
    showHistory: [],
    rivalries: seedShootRivalries(roster),
    // Nothing is named at the start. The booker names what they build.
    storylines: [],
    tournaments: [],
    stables,
    rivals,
    rivalShows: [],
    lastIncidents: [],
    lastPublication: null,
    lastFanReaction: null,
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
    showSetup: startingSetup,
    weeksInTheRed: 0,
    folded: null,
    pendingMemoriam: null,
    pendingWeatherCall: null,
    pendingChampionCall: null,
    pendingBiddingWar: null,
    lastBiddingWar: null,
    secretSignings: [],
    weatherChoice: null,
    signingBanWeeks: 0,
    suspensionWeeks: 0,
    tamperingOffenses: 0,
    freeAgents: pool.freeAgents,
    referees,
    // You open with one official on the books, and a six-match card runs him
    // into the ground by the main event. That is deliberate: the first thing
    // the burnout system should teach is why one referee is not enough.
    defaultRefereeId: startingReferee?.id ?? null,
    staffManagers: [],
    releaseRequests: [],
    weeklyNews: [],
    tradeRefusals: {},
    paceSaturation: {},
    thisYear: { passings: [], retirements: [], comebacks: [] },
    titles: [...playerTitles, ...rivalTitles],
    // You are from somewhere. A promotion does not open in a town that has
    // never heard of it — the home territory starts with a real following and
    // everywhere else starts at nothing, which is the map the player has to
    // go and change.
    territories: createTerritories().map((t) =>
      t.id === startingSetup.territoryId
        ? { ...t, following: { [promotion.id]: settings.startingTerritoryFollowing } }
        : t,
    ),
    attendanceRecords: {},
    memoriam: [],
    hallOfFame: [],
    broadcastDealId: null,
    sponsorIds: [],
    pendingBroadcastOffer: null,
    pendingSponsorOffers: [],
    breachWeeks: {},
    weeksAtRating: 0,
    lastDealsLost: [],
    mandate: null,
    lastMandateOutcome: null,
    mandateStrikes: 0,
    fired: null,
    bestAttendanceThisMandate: 0,
    yearInReview: null,
    yearRecord: emptyYearRecord(settings.startingYear, Object.values(wrestlers)),
    awardHistory: [],
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
      // Offset so no two promotions run the same event on the same night.
      ppvCalendar: ppvCalendarFor(archetype, settings.ppvCalendarSize, i + 1),
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
      ownerPersonality: pick(rng, OWNER_PROFILES).id,
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
  // Home is the smallest market that can actually host the building this
  // promotion can rent. Starting somewhere too small for your own venue is a
  // guaranteed bankruptcy, and starting in the metro is a story the player
  // should have to earn.
  //
  // The room is chosen to FIT the opening draw, not to be the biggest one the
  // rating permits. Those are different questions, and answering the second
  // put a new promotion into a theatre it filled to 39% and bankrupted itself
  // in a month.
  const openingDemand = computeDemand(
    settings.startingCompanyRating,
    settings.startingCompanyRating,
    settings.startingCompanyRating,
    settings,
    settings.startingTerritoryFollowing,
  );
  const venue = bestFittingVenue(settings.startingCompanyRating, potentialAudience(openingDemand, settings));
  const home =
    [...TERRITORIES].sort((a, b) => a.capacity - b.capacity).find((t) => t.capacity >= venue.capacity) ??
    [...TERRITORIES].sort((a, b) => b.capacity - a.capacity)[0]!;
  return {
    venueId: venue.id,
    territoryId: home.id,
    // What the show is actually worth, rather than a hardcoded number. The
    // old default of 12 had drifted to 43% of fair, so a new promotion opened
    // by giving away more than half its gate — and since the room sold out
    // anyway, nothing in the game ever told the player.
    ticketPrice: Math.round(fairTicketPrice(openingDemand, settings)),
    extraIds: [],
  };
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
