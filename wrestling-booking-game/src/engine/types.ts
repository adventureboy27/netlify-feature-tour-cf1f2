// All shared engine interfaces, from booking-game-design.md §3 and referenced
// throughout the rest of the document. This file has zero runtime code and
// zero imports from ui/ or state/ — see CLAUDE.md "Architecture rules".
//
// Where the spec references a type without fully defining it (TitleReignRecord,
// Injury, SegmentResult, RefereeAssignment, Relationship, Territory,
// Stipulation, Gimmick, and the M5/M5.5/M4 systems), this file defines a
// reasonable shape and flags it with // DESIGN so it's easy to find and
// revisit once the milestone that needs it lands.

export type Id = string;

// ============================================================================
// §3.5 — Wrestling styles
// ============================================================================

export type WrestlingStyle =
  | 'bruiser'
  | 'technical'
  | 'highFlyer'
  | 'powerhouse'
  | 'striker'
  | 'luchador'
  | 'submission'
  | 'hardcore'
  | 'showman'
  | 'giant'
  | 'allRounder'
  | 'oldSchool';

// ============================================================================
// Archetypes (§3, table under "Archetypes")
// ============================================================================

export type Archetype =
  | 'powerhouse'
  | 'technician'
  | 'highFlyer'
  | 'brawler'
  | 'showman'
  | 'monster'
  | 'veteran'
  | 'rookie';

export interface ArchetypeDefinition {
  id: Archetype;
  name: string;
  statModifiers: {
    strength: number;
    skill: number;
    agility: number;
    stamina: number;
  };
  favoredStipulations: string[]; // Stipulation ids, matched against data/stipulations.ts
  notes: string;
}

// ============================================================================
// §3.6 — Card status
// ============================================================================

/**
 * Where a wrestler is in their *career*, as opposed to where they are on
 * this week's card (CardStatus, below). Derived from age, years pro,
 * popularity, career peak and title history — see engine/career/status.ts —
 * except `trainee`, `retired` and `hallOfFamer`, which are conferred.
 */
export type CareerStatus =
  | 'trainee'
  | 'rookie'
  | 'prospect'
  | 'midcarder'
  | 'journeyman'
  | 'enhancement'
  | 'gatekeeper'
  | 'upperCard'
  | 'mainEventer'
  | 'draw'
  | 'veteran'
  | 'fallenStar'
  | 'legend'
  | 'retired'
  | 'hallOfFamer';

export type CardStatus =
  | 'mainEventer'
  | 'upperMidcard'
  | 'midcard'
  | 'lowerCard'
  | 'enhancement'
  | 'prospect';

// ============================================================================
// §18 — Mood (distinct from morale)
// ============================================================================

export type Mood =
  | 'firedUp'
  | 'content'
  | 'restless'
  | 'frustrated'
  | 'grieving'
  | 'distracted'
  | 'bitter'
  | 'motivated';

// ============================================================================
// Staff roles (Wrestler.role)
// ============================================================================

export type StaffRole =
  | 'wrestler'
  | 'manager'
  | 'referee'
  | 'announcer'
  | 'roadAgent'
  | 'trainer'
  | 'owner';

// ============================================================================
// §3.2 — Weight classes
// ============================================================================

export type WeightClass =
  | 'open'
  | 'lightweight' // under 190 lbs
  | 'juniorHeavy' // 190 - 215
  | 'lightHeavy' // 215 - 240
  | 'heavyweight' // 240 - 275
  | 'superHeavy' // 275+
  | 'custom'; // booker-defined lbs range

export interface WeightClassRange {
  weightClass: WeightClass;
  minLbs: number | null;
  maxLbs: number | null;
}

// ============================================================================
// Shared small shapes
// ============================================================================

export interface WinLossRecord {
  wins: number;
  losses: number;
  draws: number;
}

// DESIGN: the spec references `record: Record;` on Team (§18) — `Record` isn't
// defined and collides with TS's built-in utility type. Treated as the same
// win/loss/draw shape used on Wrestler.
export type TeamRecord = WinLossRecord;

// DESIGN: TitleReignRecord is referenced by both Wrestler.titleReigns and
// Title.history (§3) but never defined. Modeled to support the full lineage
// requirements of §19 (won from / lost to / exact dates) and vacancy handling
// (§3.1).
export type TitleReignEndMethod =
  | 'lostMatch'
  | 'vacatedByBooker'
  | 'strippedForCause'
  | 'retired'
  | 'released'
  | 'contractExpired'
  | 'died'
  | 'longTermInjury';

export interface TitleReignRecord {
  titleId: Id;
  /**
   * Who was running the belt at the time. Snapshotted rather than read off
   * the title, because a championship can change hands *between promotions*
   * when a company folds and its assets are auctioned — and a reign that
   * happened in Gold Coast Wrestling did not retroactively happen in whoever
   * bought them out.
   */
  promotionId: Id;
  holderIds: Id[]; // multiple entries for tag/trios teams
  /**
   * How old each holder was on the day they won it, in the same order as
   * `holderIds`. Snapshotted for the same reason the promotion is: it is only
   * true at that moment, and reconstructing it later from a current age means
   * trusting that nothing about a career was ever irregular.
   */
  holderAges: number[];
  wonFromIds: Id[] | null; // null if won via tournament, award, or vacancy
  wonByMethod: 'match' | 'tournament' | 'awarded' | 'battleRoyal';
  startWeek: number;
  endWeek: number | null; // null while still holding
  endMethod: TitleReignEndMethod | null;
}

/** How somebody left. Kept sober — see engine/career/mortality.ts. */
export type DeathCause = 'illness' | 'accident' | 'heart' | 'theRoad' | 'age';

/** A death, for the memorial wall. */
export interface Passing {
  wrestlerId: Id;
  cause: DeathCause;
  age: number;
  week: number;
}

// DESIGN: Injury is referenced by Wrestler.injury but never defined. Severity
// tiers and permanent stat loss come from §12 ("Health, injury, momentum").
export type InjurySeverity = 'minor' | 'moderate' | 'severe' | 'careerThreatening';

export type PhysicalStatKey = 'strength' | 'skill' | 'agility' | 'stamina' | 'toughness';

export interface Injury {
  severity: InjurySeverity;
  description: string;
  sufferedWeek: number;
  totalWeeks: number;
  weeksRemaining: number;
  permanentStatLoss: Partial<Record<PhysicalStatKey, number>>;
  earlyReturnWeeksUsed: number; // 0-3, see §12 "Rehab and the early return"
}

// ============================================================================
// §3.4 — Gimmicks
// ============================================================================

export type AlignmentLean = 'face' | 'heel' | 'either';

/**
 * How a gimmick dresses, described in terms the engine understands rather
 * than in sprite-sheet indices — `data/` must not know what the atlas cuts.
 * engine/generate/gimmickLook.ts turns these into Appearance traits.
 */
export interface GimmickLook {
  masked?: 'required' | 'forbidden';
  /** The silhouette the gimmick wants. */
  attire?: 'flashy' | 'plain' | 'formal' | 'brawler' | 'athletic' | 'savage';
  /** The colours it wants. */
  palette?: 'bright' | 'dark' | 'monochrome' | 'gold' | 'blood' | 'earthy';
  /** Hair the gimmick implies, if any. */
  hair?: 'long' | 'short' | 'wild' | 'bald' | 'any';
}

export interface Gimmick {
  id: Id;
  name: string;
  alignmentLean: AlignmentLean;
  popularityCeiling: number; // 0-100
  growthRateMultiplier: number; // applied to popularity gains while fresh
  territoryFit: Partial<Record<Id, number>>; // territoryId -> affinity weight, -1..1
  merchMultiplier: number;
  /** Granting a gimmick change restyles the wrestler to match this (§20). */
  look?: GimmickLook;
}

// ============================================================================
// §18 — Tag teams, stables, factions
// ============================================================================

/**
 * A tag team or stable. Members wrestle in matching colours — the colours
 * live here, and engine/generate/gimmickLook.ts's `effectiveAppearance`
 * substitutes them over each member's own attire palette without destroying
 * it, so a wrestler who leaves the group goes back to looking like
 * themselves.
 */
export interface Stable {
  id: Id;
  name: string;
  kind: 'tagTeam' | 'stable';
  memberIds: Id[];
  leaderId: Id | null;
  /** Palette indices into ATTIRE_PALETTE — the group's colours. */
  colors: { primary: number; secondary: number; accent: number } | null;
  /** Members dress alike. Turn off for a loose alliance. */
  unifiedLook: boolean;
  formedWeek: number;
  disbandedWeek: number | null;
  record: WinLossRecord;
}

// ============================================================================
// §3.3 — Move sets and finishers
// ============================================================================

export type MoveStyle = 'power' | 'technical' | 'aerial' | 'strike' | 'brawl';

export type MoveType =
  | 'slam'
  | 'suplex'
  | 'submission'
  | 'strike'
  | 'aerial'
  | 'driver'
  | 'stunner'
  | 'powerbomb'
  | 'clothesline';

export interface Move {
  name: string;
  type: MoveType;
  damage: number;
  risk: number;
  crowdPop: number;
}

export interface MoveSet {
  finisher: Move;
  secondaryFinisher?: Move;
  signatures: Move[]; // 2-4 recognizable spots
  style: MoveStyle;
}

// ============================================================================
// §7 — Paper-doll appearance
// ============================================================================

export interface Appearance {
  skinTone: number; // 0-11
  build: number; // 0-5: slim, athletic, thick, heavy, massive, tall
  height: number; // 0-4
  hairStyle: number; // 0-23, includes bald
  hairColor: number; // 0-11
  facialHair: number; // 0-11
  faceShape: number; // 0-7
  eyes: number; // 0-7
  attireTop: number; // 0-15
  attireBottom: number; // 0-15
  boots: number; // 0-9
  mask: number; // 0-11, 0 = none
  accessory: number; // 0-15
  glasses: number; // 0-9, 0 = none
  shirt: number; // 0-15
  tattoos: number; // 0-11
  beltStyle: number;
  primaryColor: number; // 0-19
  secondaryColor: number; // 0-19
  accentColor: number; // 0-19
}

// ============================================================================
// §3 — Wrestler
// ============================================================================

export interface Wrestler {
  id: Id;
  name: string; // ring name
  nickname?: string;
  /**
   * Names they used to work under, oldest first. A repackage does not erase
   * a career: a title lineage naming somebody by a name they have not used
   * for ten years is the history, and the records screens need to be able to
   * say "then known as".
   */
  formerNames?: { name: string; untilWeek: number }[];

  // Core stats, 0-100
  popularity: number;
  strength: number;
  skill: number;
  agility: number;
  stamina: number;
  attitude: number;
  charisma: number; // "Mic Work" in the UI, §3.9
  talent: number; // 0-100, mostly hidden, §3.8
  coachability: number;
  toughness: number;

  // Hidden per-stat ceilings, §12.5. Never shown to the player.
  potentials: {
    strength: number;
    skill: number;
    agility: number;
    stamina: number;
    charisma: number;
  };
  growthRate: number; // 0.4 - 1.6, from talent, §3.8

  // Dynamic state
  health: number; // 0-100
  energy: number; // 0-100
  morale: number; // 0-100
  momentum: number; // 0-100
  cardStatus: CardStatus;
  careerStatus: CareerStatus;
  /** Week at which careerHighPopularity was set — used to date a decline. */
  careerHighWeek: number;
  /**
   * 0-100. Rises with titles, main events and getting over; falls with losses,
   * being left off cards, and time. Turns into money, clauses, and people who
   * will not do what they are told — see engine/career/ego.ts.
   */
  ego: number;
  crowdReaction: number; // -100..100, §3.7
  mood: Mood;
  alignment: number; // -100 (heel) .. +100 (face)

  // DESIGN: gimmick freshness (§3.4) and fatigue debt / consecutive weeks
  // (§12.5 "Fatigue and burnout") are per-wrestler dynamic state the spec
  // describes in prose but omits from the Wrestler interface. Added here.
  gimmickFreshness: number; // 0-100, decays ~0.8/week
  fatigueDebt: number; // 0-100
  consecutiveWeeksWorked: number;

  // Identity
  age: number;
  debutYear: number;
  gender: 'm' | 'f';
  weightLbs: number;
  weightTarget: number | null; // set while cutting/gaining, §3.2
  heightIn: number;
  archetype: Archetype;
  style: WrestlingStyle;
  secondaryStyle?: WrestlingStyle;
  gimmick: Gimmick;
  moveSet: MoveSet;
  isCreated: boolean;
  homeTerritoryId: Id;
  appearance: Appearance;

  // Employment
  promotionId: Id | null;
  contract: Contract | null;
  role: StaffRole;

  // History
  record: WinLossRecord;
  /**
   * Career extremes, kept as running marks because they cannot be
   * reconstructed later — a healed injury leaves no trace, and the age
   * somebody was in a match twenty years ago is gone once they age again.
   * Everything else on the records page is derived from titles and records;
   * this is the short list of things that genuinely have to be remembered.
   */
  career: CareerMarks;
  titleReigns: TitleReignRecord[];
  injury: Injury | null;
  careerHighPopularity: number;
  /** Set when they die. A wrestler with this set is never booked again. */
  deceased?: Passing;
  /** Set when they are inducted. §19's hall of fame. */
  hallOfFameWeek?: number;
}

/** The handful of things about a career that only the moment knows. */
export interface CareerMarks {
  /** Current run: positive for wins, negative for losses. */
  streak: number;
  bestWinStreak: number;
  worstLosingStreak: number;
  /** Weeks of the longest single spell on the shelf. */
  longestInjuryWeeks: number;
  /** How old they were the first and last time they worked a match. */
  youngestMatchAge: number | null;
  oldestMatchAge: number | null;
  /** The best and worst match they have ever been in, 0-100. */
  bestMatchRating: number | null;
  worstMatchRating: number | null;
  /** Total matches worked, anywhere. */
  matches: number;
}

// ============================================================================
// §14 — Venues and production
// ============================================================================

export interface Venue {
  id: Id;
  name: string;
  capacity: number;
  /** Rented per show. Never owned. */
  rentalCost: number;
  prestige: number; // 0-100, feeds show rating
  /** A real building will not rent to a promotion nobody has heard of. */
  minCompanyRating: number;
  blurb: string;
}

/** What a production purchase or a per-show extra actually does. */
export interface ProductionEffects {
  showRating?: number;
  attendanceMultiplier?: number;
  merchMultiplier?: number;
  tvRating?: number;
  /** Extra revenue per head, beyond the ticket. */
  revenuePerHead?: number;
  injuryReduction?: number; // 0-1
  incidentReduction?: number; // 0-1
  talentGrowth?: number;
  rosterMorale?: number;
  rosterFatigue?: number;
  reputation?: number;
}

/** Bought once, hauled to every show thereafter. */
export interface ProductionAsset {
  id: Id;
  name: string;
  cost: number;
  upkeepPerShow: number;
  blurb: string;
  effects: ProductionEffects;
  /** Some rigs need a building big enough to hang them in. */
  minVenueCapacity?: number;
}

/** Chosen and paid for fresh every show. */
export interface ShowExtra {
  id: Id;
  name: string;
  cost: number;
  blurb: string;
  /** Needs a one-time asset to be owned first — pyro charges need the rig. */
  requiresAsset?: Id;
  effects: ProductionEffects;
}

/** The production plan for one show. */
export interface ShowSetup {
  venueId: Id;
  /** Where you are running this week. */
  territoryId: Id;
  ticketPrice: number;
  extraIds: Id[];
}

// ============================================================================
// §9 — Tournaments
// ============================================================================

/**
 * `singleNight` runs the whole bracket on one card — the winner works three
 * matches in a night and is wrecked by the final. `multiWeek` runs one round
 * per show, so nobody tires but the bracket eats a fixture slot for a month.
 */
export type TournamentFormat = 'singleNight' | 'multiWeek';

export type TournamentReward = 'none' | 'trophy' | 'titleShot' | 'title' | 'contract';

export interface TournamentMatch {
  id: Id;
  round: number; // 0 = first round
  position: number; // index within the round
  entrantA: Id | null; // null until a prior round settles it
  entrantB: Id | null;
  winnerId: Id | null;
  isBye: boolean;
}

export interface Tournament {
  id: Id;
  name: string;
  format: TournamentFormat;
  reward: TournamentReward;
  entrantIds: Id[]; // seeded order, strongest first
  rounds: TournamentMatch[][];
  currentRound: number;
  startWeek: number;
  status: 'active' | 'complete';
  winnerId: Id | null;
}

// ============================================================================
// §3 — Contract
// ============================================================================

export type ContractType = 'fullTime' | 'partTime' | 'perAppearance' | 'developmental' | 'legends';

export type Clause =
  | 'ironClad'
  | 'noCompete'
  | 'titlePush'
  | 'creativeControl'
  | 'nepotism'
  | 'immediateStart'
  | 'incentive'
  | 'downside'
  | 'creativeFreedom'
  | 'payPerView'
  | 'healthInsurance'
  | 'guaranteedDates'
  | 'travelCovered'
  | 'merchandiseCut'
  | 'noHardcore'
  | 'noJobbing'
  | 'releaseClause'
  | 'partTime'
  | 'exclusivity'
  | 'trainerRole'
  | 'rematchClause';

export interface Contract {
  type: ContractType;
  weeklyRate: number;
  weeksRemaining: number;
  totalWeeks: number;
  clauses: Clause[];
  signedYear: number;
}

// ============================================================================
// §3.1 — Title
// ============================================================================

export type TitleTier =
  | 'world'
  | 'secondary'
  | 'tertiary'
  | 'tag'
  | 'trios'
  | 'hardcore'
  | 'television'
  | 'cruiserweight';

export type TitleDivision = 'mens' | 'womens' | 'open';

/**
 * What kind of company this is. Drives belt names, which styles draw here,
 * and how much violence the room will take. Table: data/promotionIdentity.ts.
 */
export type PromotionArchetype =
  | 'territory'
  | 'hardcore'
  | 'technical'
  | 'sportsEntertainment'
  | 'lucha'
  | 'oldSchool'
  | 'athletic';

export interface Title {
  id: Id;
  promotionId: Id;
  name: string;
  /** What this belt is for — the situation it exists to settle. */
  blurb: string;
  tier: TitleTier;
  division: TitleDivision; // LOCKED at creation, §3.1
  weightClass: WeightClass;
  lineageProtected: boolean; // cannot change hands in cross-promo matches
  vacant: boolean;
  prestige: number; // 0-100
  currentHolderIds: Id[];
  reignStartWeek: number;
  history: TitleReignRecord[];
  colorway: { strap: string; plate: string };
  /**
   * The stipulation this belt is traditionally defended under, if any. A
   * deathmatch title contested under normal rules is a disappointment, and
   * the crowd says so — see engine/economy/showRating.ts.
   */
  signatureStipulationId: Id | null;
}

// ============================================================================
// §9 — Stipulations
// ============================================================================

export interface Stipulation {
  id: Id;
  name: string;
  /** One line of what the match is, for the card builder. */
  blurb?: string;
  ratingBonus: number;
  violenceLevel: number; // 0-5, feeds hardcore saturation
  injuryMult: number;
  heatRequirement?: number;
  avgStatRequirement?: { stat: 'agility' | 'stamina' | 'skill'; min: number };
  minParticipants?: number;
  popGapRequirement?: number; // e.g. squash: pop gap >= 35
  archetypeFit: Archetype[];
  /**
   * Rules the stipulation carries by definition. A No-DQ match is not a
   * separate switch the player also has to remember to flip — picking the
   * stipulation *is* turning disqualifications off. Applied over the
   * segment's rules at sim time, never silently written back to the card.
   */
  impliedRules?: Partial<MatchRules>;
  /**
   * Multipliers on the finish roll (§11.3). A tables match has to end with
   * someone going through a table, so it leans hard on knockout and away
   * from a clean pin; a casket match is the same shape with a lid.
   */
  finishWeights?: Partial<Record<FinishType, number>>;
  /** Overrides the generic finish sentence in the highlight write-up. */
  finishFlavor?: Partial<Record<FinishType, string>>;
  /** Grudge stipulations are blowoffs — winning one resolves the rivalry (§12.5). */
  isBlowoff?: boolean;
  /**
   * Normally a championship does not change hands on a disqualification or a
   * count-out. In a match with no rules to break, that protection makes no
   * sense — there is nothing to be disqualified from.
   */
  titleChangesOnDQ?: boolean;
}

// ============================================================================
// §9 — Match rules
// ============================================================================

export interface MatchRules {
  preset:
    | 'singles'
    | 'tag'
    | 'sixMan'
    | 'triple'
    | 'fatal4'
    | 'battleRoyal'
    | 'handicap'
    | 'gauntlet'
    | 'tornado';
  format: 'individuals' | 'teams' | 'elimination';
  ruleStrictness: 'strict' | 'lenient' | 'none';
  aim: 'firstFall' | 'twoOfThree' | 'ironMan' | 'lastStanding' | 'firstBlood' | 'submissionOnly' | 'escape';
  falls: 'pinsAndSubs' | 'pinsOnly' | 'subsOnly' | 'knockout' | 'anyMeans';
  timeLimit: 0 | 5 | 10 | 15 | 20 | 30 | 60; // 0 = no limit
  stoppage: 'none' | 'referee' | 'doctor' | 'towel';
  countOuts: 'normal' | 'slow' | 'none';
  reward: 'none' | 'defendTitles' | 'titleShot' | 'contract' | 'stipulation';
}

// ============================================================================
// §10 — Stacking the deck
// ============================================================================

// DESIGN: RefereeAssignment is referenced by DeckStacking but never defined.
export interface RefereeAssignment {
  wrestlerId: Id;
  crooked: boolean;
  favoredSideIndex: number | null;
}

export interface RunIn {
  wrestlerId: Id;
  forSide: number;
  timing: 'early' | 'late' | 'finish';
  cost: number; // half the wrestler's appearance fee
}

export type MatchInstruction =
  | 'callItInTheRing'
  | 'protectTheChampion'
  | 'goAllOut'
  | 'keepItShort'
  | 'makeHimLookStrong'
  | 'giveHimTheRub';

export interface DeckStacking {
  favoredSideIndex: number | null;
  assignedReferee: RefereeAssignment | null;
  ringsideManagers: { wrestlerId: Id; forSide: number }[];
  plannedRunIn: RunIn | null;
  lumberjacks: Id[];
  preMatchAngle: 'none' | 'beatdown' | 'hype' | 'sneakAttack';
  instructions: MatchInstruction;
}

// ============================================================================
// §11 — Simulation results
// ============================================================================

export type FinishType =
  | 'cleanPin'
  | 'submission'
  | 'knockout'
  | 'rollup'
  | 'interference'
  | 'disqualification'
  | 'countOut'
  | 'timeLimitDraw'
  | 'doubleKO'
  | 'refereeStoppage'
  /** Somebody got hurt and it had to be stopped. Nobody goes home happy. */
  | 'injuryStoppage';

export interface RatingBreakdownEntry {
  label: string;
  value: number;
}

export type MatchBeatKind =
  | 'openingExchange'
  | 'control'
  | 'hopeSpot'
  | 'nearFall'
  | 'signature'
  | 'interference'
  | 'finish';

export interface MatchBeat {
  kind: MatchBeatKind;
  text: string;
  significant: boolean; // only significant beats render in the highlight, §11.5
}

// DESIGN: SegmentResult is referenced by Segment but never defined.
export interface SegmentResult {
  winnerSide: number | null; // null for a draw/no-contest
  winnerWrestlerIds: Id[];
  finish: FinishType;
  rating: number; // 0-100 internal
  stars: number; // 0.5-5.0, half-star granularity
  ratingBreakdown: RatingBreakdownEntry[];
  beats: MatchBeat[];
  titleChanged: boolean;
  injuries: { wrestlerId: Id; injury: Injury }[];
  /**
   * Something nobody booked. Read engine/sim/incidents.ts — it reacts to the
   * finish above, it never decides it.
   *
   * Typed structurally rather than importing Incident, because types.ts has
   * no imports by design.
   */
  incident?: {
    id: string;
    headline: string;
    involvedIds: Id[];
  } | null;
}

// ============================================================================
// §3 — Show / Segment
// ============================================================================

export type ShowType = 'tvTaping' | 'ppv' | 'houseShow' | 'charity';

export interface SegmentRole {
  wrestlerId: Id;
  side: number; // 0, 1, 2... for teams; -1 for non-competitors
  role: 'competitor' | 'manager' | 'referee' | 'announcer' | 'lumberjack';
}

export interface Segment {
  slot: number; // 0 = opener ... last = main event
  /** Managers at ringside, by side. */
  managerIds?: { managerId: Id; forSide: number }[];
  /** Assigned official from the referee pool. */
  refereeId?: Id | null;
  /** A wrestler in the shirt instead. Replaces refereeId when set. */
  guestRefereeId?: Id | null;
  kind: 'match' | 'promo' | 'interview' | 'angle';
  subjectId?: Id; // for interviews: who is being elevated
  participants: SegmentRole[];
  rules: MatchRules;
  stipulation: Id | null;
  titleIds: Id[];
  deckStacking: DeckStacking;
  result: SegmentResult | null;
}

export interface Show {
  id: Id;
  promotionId: Id;
  week: number; // absolute week index since game start
  type: ShowType;
  territoryId: Id;
  segments: Segment[]; // 6 for TV, 10 for PPV, 4 for house/charity
  attendance: number;
  ticketPrice: number;
  gate: number;
  payroll: number;
  showRating: number; // 0-100 internal
  showStars: number; // 0.5-5.0 displayed
  broadcast: boolean;
  /** Where it was staged, and what the staging cost and returned. */
  venueId: Id;
  venueCapacity: number;
  merch: number;
  otherRevenue: number;
  showCosts: number;
}

// ============================================================================
// §4 — Promotion / StyleProfile
// ============================================================================

export interface StyleProfile {
  preferredStyles: WrestlingStyle[];
  violenceTolerance: number; // 0-100
  workrateVsStarPower: number; // 0 = pure workrate, 100 = pure charisma
  divisionFocus: ('mens' | 'womens' | 'tag' | 'cruiser')[];
  promoHeavy: boolean;
}

export interface Promotion {
  id: Id;
  name: string;
  /**
   * The house style — what this company is known for, and where its belt
   * names come from. The table lives in data/promotionIdentity.ts.
   */
  identity: PromotionArchetype;
  isPlayer: boolean;
  rating: number; // 0-100, TV ratings ladder position
  bankBalance: number;
  rosterIds: Id[];
  titleIds: Id[];
  ownedTerritoryIds: Id[];
  homeTerritoryId: Id;
  styleProfile: StyleProfile;
  bookingCredibility: number; // 0-100, §13
  reputation: number; // 0-100, §19
  /** §11.4 weapons model: 0-100, accrues with booked violence and decays weekly. */
  hardcoreSaturation: number;
  /**
   * Running average of recent show ratings, 0-100. The main driver of how
   * many people turn up next week — put on shows and they come back.
   */
  recentShowQuality: number;
  /** Consecutive weeks under water. Past the grace period, they close. */
  weeksInTheRed: number;
  /** Set when the company closes. A closed company runs no shows. */
  closedWeek: number | null;
  ownerId: Id; // a Wrestler record with role 'owner'
  /** What the person signing the cheques is like. Biases what they demand. */
  ownerPersonality: OwnerPersonality;
}

// ============================================================================
// §4 — Territory
// ============================================================================

export type TerritoryPreferenceTag =
  | 'faces'
  | 'heels'
  | 'hardcore'
  | 'technical'
  | 'highFlying'
  | 'womensWrestling'
  | 'longMatches'
  | 'starPower';

export interface Territory {
  id: Id;
  name: string;
  capacity: number; // 2,000-18,000
  revenueMult: number; // 0.8-1.4
  preferenceWeights: Partial<Record<TerritoryPreferenceTag, number>>; // -1..1
  following: Partial<Record<Id, number>>; // promotionId -> 0-100
  ownerPromotionId: Id | null;
}

// ============================================================================
// §18 — Relationships
// ============================================================================

export type RelationshipType =
  | 'friend'
  | 'enemy'
  | 'mentor'
  | 'protege'
  | 'sibling'
  | 'parentChild'
  | 'married'
  | 'dating'
  | 'divorced'
  | 'exPartner';

export interface RelationshipEvent {
  week: number;
  description: string;
  strengthDelta: number;
}

export interface Relationship {
  aId: Id;
  bId: Id;
  type: RelationshipType;
  strength: number; // 0-100
  history: RelationshipEvent[];
}

// ============================================================================
// §18 — Teams and factions
// ============================================================================

export interface Team {
  id: Id;
  name: string;
  memberIds: Id[];
  type: 'tagTeam' | 'faction' | 'stable';
  chemistry: number;
  popularity: number;
  formedWeek: number;
  leaderId?: Id; // factions
  record: TeamRecord;
}

// ============================================================================
// §12.5 — Rivalry
// ============================================================================

/**
 * Where a rivalry came from, which is also what it costs.
 *
 * `worked` is the booked feud — the story the promotion is telling. The
 * participants are fine backstage. It draws money and nothing else.
 *
 * `shoot` is real animosity between two people who genuinely dislike each
 * other. §12.5 route 2 ("real-life relationships") and route 4 ("emergent
 * incidents") both produce these. It is not a story anyone chose, and the
 * booker's decision is whether to point a camera at it.
 */
export type RivalryOrigin = 'worked' | 'shoot';

export interface Rivalry {
  id: Id;
  participantIds: Id[];
  origin: RivalryOrigin;
  /**
   * Crowd heat, 0-100 — how much the audience cares. This is the number that
   * draws houses, gates grudge stipulations, and pays off at the blowoff.
   * Earned by reception, never by booking alone (§12.5).
   */
  heat: number;
  /**
   * Real animosity, 0-100 — invisible to the crowd. A shoot rivalry makes the
   * match itself better because the violence is real, and makes everything
   * around it worse: injuries, morale, and people who will not work together.
   * A worked feud stays at 0 unless something genuinely goes wrong.
   */
  shootHeat: number;
  startWeek: number;
  lastAdvancedWeek: number;
  matchesContested: number;
  blowoffBooked: boolean;
  /** Set when a decisive blowoff resolved it; a resolved rivalry stops drawing. */
  resolvedWeek: number | null;
}

// ============================================================================
// §5 — World settings
// ============================================================================

export type WomensDivisionMode = 'off' | 'separate' | 'intergender';
export type ClauseAvailability = 'all' | 'starsOnly' | 'none';

export interface WorldSettings {
  // Money and economy
  startingCash: number;
  startingCompanyRating: number;
  weeklyExpenseRate: number;
  expenseCapPctOfRevenue: number;
  ticketPriceBase: number;
  ticketPricePerSegment: number;
  salaryInflation: number;
  bankruptcyGraceWeeks: number;
  tvDealsEnabled: boolean;
  arenaTiersEnabled: boolean;

  // Roster and talent
  startingRosterSize: number;
  targetRosterSize: number;
  freeAgentPoolSize: number;
  talentQualityCurve: number; // -2..+2
  starDensity: number; // 0-1
  womensDivision: WomensDivisionMode;
  agingEnabled: boolean;
  deathsEnabled: boolean;
  retirementEnabled: boolean;
  regenerateTalent: boolean;

  // Contracts
  contractLengthMin: number;
  contractLengthMax: number;
  contractLengthDefault: number;
  allowedClauses: Clause[];
  clauseAvailability: ClauseAvailability;
  buyoutsEnabled: boolean;
  poachingAggression: number; // 0-2
  demandStrictness: number; // 0-2

  // Booking and simulation
  outcomeMode: 'simulated'; // LOCKED
  resimAllowed: false; // LOCKED
  warningsEnabled: false; // LOCKED
  oddsClampMin: number;
  oddsClampMax: number;
  simVariance: number;
  segmentsPerTV: number;
  segmentsPerPPV: number;
  broadcastWindowTV: number;
  broadcastWindowPPV: number;
  ratingLadderStepPerWeek: number;
  defaultMatchLength: number;
  houseShowsEnabled: boolean;
  tournamentsEnabled: boolean;
  promoSlotsPerCard: number;
  /** §11.4 hardcore saturation: added per point of a stipulation's violenceLevel. */
  hardcoreSaturationPerViolence: number;
  /** §11.4 hardcore saturation: points shed each week. */
  hardcoreSaturationDecayPerWeek: number;
  /** §11.4 jobberDrag: roster popularity percentile the opener is judged against. */
  slotExpectationPercentileMin: number;
  /** §11.4 jobberDrag: roster popularity percentile the main event is judged against. */
  slotExpectationPercentileMax: number;

  // Rivalries (§12.5)
  rivalryHeatDecayPerWeek: number;
  rivalryHeatFromMatch: number;
  rivalryHeatFromNonDecisiveFinish: number;
  /** Heat at or above this unlocks grudge stipulations. */
  rivalryGrudgeThreshold: number;
  /** Blowoff winner gains heat * this in popularity. */
  rivalryBlowoffPopularityFactor: number;
  /** Rating points a maxed-out crowd-heat rivalry adds to a match. */
  rivalryHeatRatingBonus: number;
  /** Real animosity fades far slower than crowd interest does. */
  shootHeatDecayPerWeek: number;
  /** Extra rating points a maxed-out shoot rivalry adds — real fights are compelling. */
  shootHeatRatingBonus: number;
  /** Injury multiplier at maximum shoot heat. */
  shootHeatInjuryMultAtMax: number;
  /** Morale lost per week by both parties at maximum shoot heat. */
  shootHeatMoralePerWeekAtMax: number;
  /** Fraction of shoot heat that converts to crowd heat when the booker leans in. */
  shootLeanInConversion: number;

  // Tournaments (§9)
  /** Kayfabe lost per match already worked on the same night, as a fraction. */
  tournamentNightFatiguePerMatch: number;
  /** Health cost per match already worked on the same night. */
  tournamentNightHealthCostPerMatch: number;
  /** Rating bonus for a tournament final — the crowd knows what it is watching. */
  tournamentFinalRatingBonus: number;

  // Career status thresholds (engine/career/status.ts)
  rookieYearsPro: number;
  journeymanYearsPro: number;
  veteranYearsPro: number;
  veteranAge: number;
  legendYearsPro: number;
  legendPeakPopularity: number;
  prospectTalent: number;
  enhancementPopularity: number;
  gatekeeperPopularity: number;
  upperCardPopularity: number;
  mainEventPopularity: number;
  /** Popularity fallen below career peak that marks someone a fallen star. */
  fallenStarDrop: number;

  // TV ratings (engine/world/tvRatings.ts)
  tvRatingBase: number;
  tvRatingCeiling: number;
  /** How much of a promotion's draw is tonight's show vs. its reputation, 0-1. */
  tvShowQualityWeight: number;

  // Tampering and poaching (engine/world/tampering.ts)
  tamperingBaseChance: number;
  /** Appeal a wrestler must have before a rival risks tampering with a live deal. */
  tamperingAppealThreshold: number;
  tamperingOfferPremiumMin: number;
  tamperingOfferPremiumRange: number;
  tamperingMoneyWeight: number;
  tamperingMoraleWeight: number;
  tamperingMomentumWeight: number;
  tamperingContractLengthResistance: number;
  tamperingAttitudeResistance: number;
  tamperingIronCladResistance: number;
  tamperingNoCompeteResistance: number;

  // Creative events (engine/events/scheduler.ts)
  /** Chance an event even considers firing in a given week. */
  eventWeeklyChance: number;
  /** Hard floor of quiet weeks between any two events. */
  eventGlobalGapWeeks: number;
  /** Quiet weeks between two events of the same category. */
  eventCategoryGapWeeks: number;
  /** Weight multiplier applied per previous firing of the same event. */
  eventRepeatDamping: number;
  /** Floor on damped weight, as a fraction of the original. */
  eventMinWeightFraction: number;

  // Contracts (engine/economy/contracts.ts)
  contractBaseWeeklyRate: number;
  contractRateRange: number;
  /** Exponent on value. >1 makes stars cost multiples of a midcarder. */
  contractRateCurve: number;
  contractDrawWeight: number;
  contractCraftWeight: number;
  /** A renewal never comes in below this multiple of the current rate. */
  contractRenewalFloor: number;
  /** Weeks of wages you must be able to cover before a signing is affordable. */
  contractAffordabilityWeeks: number;

  // Show production economics (engine/economy/showBudget.ts)
  travelCostPerHead: number;
  crewCostBase: number;
  crewCostPerSeat: number;
  ticketFairPriceBase: number;
  ticketFairPriceRange: number;
  ticketUnderpriceBonus: number;
  ticketOverpricePenalty: number;
  merchSpendPerHead: number;
  /** Audience at maximum demand — the ceiling on how many people exist for you. */
  demandAudienceScale: number;
  /** Curve exponent. Higher makes the gap between liked and beloved wider. */
  demandAudienceCurve: number;
  /** How much walk-up a prestigious building pulls on its own. */
  venuePrestigeDraw: number;
  /** How demand splits between standing, recent shows, and the roster. Should sum to 1. */
  demandFromCompanyRating: number;
  demandFromRecentShows: number;
  demandFromRoster: number;
  /** Weight of tonight's show in the running quality average. */
  recentShowQualityWeight: number;

  // Wear and tear on production gear (engine/economy/showBudget.ts)
  assetWearPerShow: number;
  /** At or below this condition the asset delivers nothing. */
  assetFailureThreshold: number;
  /** Repair cost as a fraction of the purchase price, per point of wear. */
  assetRepairCostFraction: number;
  /** Rating points a maximum-prestige building adds to the show. */
  venuePrestigeRatingWeight: number;
  /** Fill ratio at or above which the building reads as full. */
  venueFullThreshold: number;
  venueFullBonus: number;
  venueEmptyPenalty: number;

  // Answering a rival's offer (engine/world/poaching.ts)
  poachResponseMoneyEffect: number;
  poachResponseMoneyRaise: number;
  poachResponsePushEffect: number;
  poachResponseLegalEffect: number;
  /** Weeks an offer sits open before it resolves. */
  poachOfferWeeksToRespond: number;

  // The player tampering with someone else's talent — a deliberately bad bet
  playerTamperingSuccessScale: number;
  playerTamperingSuccessCap: number;
  playerTamperingCaughtBase: number;
  playerTamperingCaughtByFame: number;
  playerTamperingFineFraction: number;
  playerTamperingMinFine: number;
  playerTamperingReputationPenalty: number;
  playerTamperingBanWeeks: number;
  /** Weeks dark when a repeat offence draws a suspension. */
  playerTamperingSuspensionWeeks: number;
  /** Company rating stripped on expulsion — losing the TV slot. */
  playerTamperingExpulsionRatingLoss: number;
  /** How much harsher each subsequent offence is. */
  playerTamperingEscalation: number;

  // Ego and the cost of success (engine/career/ego.ts)
  egoFromStanding: number;
  egoFromHoldingTitle: number;
  egoFromCareerTitles: number;
  egoFromTopStatus: number;
  egoFromMomentum: number;
  /** How much a bad attitude inflates the target. */
  egoAttitudeSwing: number;
  egoRiseRate: number;
  /** Slower than the rise — success sticks in the memory longer than failure. */
  egoFallRate: number;
  /** Rate multiplier at maximum ego. */
  egoRateMultiplierMax: number;
  /** How many clauses they ask for at once. */
  egoMaxClauseAsks: number;
  egoWalkRiskMax: number;
  egoRosterFrictionMax: number;

  // Ongoing cost of agreed clauses
  clauseInsuranceRate: number;
  clauseTravelCost: number;
  clauseGuaranteedDatesRate: number;

  // Relationships (engine/career/relationships.ts)
  /** How many relationships to seed, per wrestler on the roster. */
  relationshipsPerWrestler: number;
  relationshipEnemyChance: number;
  relationshipAllyRatingBonus: number;
  relationshipAllyInjuryReduction: number;
  relationshipEnemyRatingBonus: number;
  relationshipEnemyInjuryIncrease: number;
  /** Enmity at or above this and they will not work together at all. */
  relationshipRefusalThreshold: number;

  // Free agents (engine/world/freeAgents.ts)
  /** Asking rate shed per week unsigned. */
  freeAgentRateDecayPerWeek: number;
  /** Floor on that discount. */
  freeAgentMaxDiscount: number;
  /** Weekly chance a desirable free agent is signed by somebody else. */
  freeAgentRivalSigningChance: number;

  // Ringside personnel (engine/sim/ringside.ts)
  managerRatingBonusMax: number;
  managerPopularityBoostMax: number;
  managerInterferenceWeight: number;
  /** How much leaning on a mouthpiece stunts what the client builds alone. */
  managerSelfMadePenalty: number;
  refereeRatingSwing: number;
  refereeScrewyFinishWeight: number;
  refereeBendableWeight: number;
  guestRefereeRatingBonus: number;
  guestRefereeScrewyFinishWeight: number;
  guestRefereeInterferenceWeight: number;

  // Chaos
  chaosLevel: number; // 0-3
  ownerMandatesEnabled: boolean;
  ownerPatience: number;

  /** How fast a belt's prestige chases the rating of its last defence. */
  titlePrestigeDrift: number;
  /** Momentum a new champion gets on winning a belt. */
  titleWinMomentum: number;
  /** Popularity a new champion gets on winning a belt. */
  titleWinPopularity: number;
  /** Extra prestige a match carries for each belt beyond the first. */
  titleForTitleBonus: number;

  // What a match does to the people in it (engine/sim/aftermath.ts).
  /** Momentum a win is worth. */
  momentumPerWin: number;
  /** Momentum a loss costs. */
  momentumPerLoss: number;
  /** Momentum a draw costs — much less than a loss. */
  momentumPerDraw: number;
  /** Popularity the winner takes on top of the match's own swing. */
  popularityPerWin: number;
  /**
   * How fast popularity converges on the quality of somebody's matches, per
   * match worked. Small: this is the slowest number in the game.
   */
  matchPopularityChase: number;
  /** Multiplier on everything for the main event. */
  mainEventAftermathMultiplier: number;
  /** Condition every match costs. */
  matchHealthCost: number;
  /** Extra condition cost per point of stipulation violence. */
  matchHealthCostPerViolence: number;
  matchEnergyCost: number;
  matchFatiguePerMatch: number;
  weeklyHealthRecovery: number;
  weeklyEnergyRecovery: number;
  weeklyFatigueRecovery: number;
  /** How fast momentum falls back to the middle of the card. */
  momentumDecayPerWeek: number;

  // Leaving the business, and coming back.
  /** Age at which retirement starts to be on somebody's mind. */
  retirementAgeSoft: number;
  /** Age nobody wrestles past. */
  retirementAgeHard: number;
  /** Years in the business before retiring is even possible. */
  retirementMinYearsPro: number;
  /** How much a broken-down body pushes somebody toward the door, 0-1. */
  retirementBodyWeight: number;
  /** Added to retirement pressure by a career-threatening injury. */
  retirementCareerEndingInjury: number;
  /** How much falling off their own peak pushes somebody out, 0-1. */
  retirementDeclineWeight: number;
  /** Subtracted from retirement pressure while they are still drawing. */
  retirementStillDrawingRelief: number;
  /** Annual chance of going at maximum pressure. */
  retirementChanceAtMaxPressure: number;
  /** Retirement pressure above which the roster card says so. */
  retirementUiThreshold: number;
  /** Shoot heat that makes a score worth coming back for. */
  comebackShootHeatThreshold: number;
  /** Annual comeback chance with a score to settle, at full shoot heat. */
  comebackChanceWithScore: number;
  /** Annual comeback chance with nothing but the itch. */
  comebackChanceForLove: number;
  /** Nobody comes back past this age. */
  comebackMaxAge: number;
  /** Condition a returning wrestler comes back at, at worst. */
  comebackStartingHealth: number;
  /** Momentum a comeback is worth — the crowd pops for it. */
  comebackMomentum: number;

  // Mortality. Sober, gentle in the working years, real over decades.
  deathBaseAge: number;
  deathBaseChance: number;
  deathAgeDoubling: number;
  deathHealthWeight: number;
  deathChanceCap: number;
  deathOldAge: number;

  // The fans. How many of them speak up, and how much they disagree.
  fanTweetsPerShow: number;
  /**
   * The smallest share of the feed that always dissents, either way. Nobody
   * is ever unanimous about wrestling and a feed that is reads as fake.
   */
  fanDissentFloor: number;
  /** How much of the feed is about a specific match rather than the show. */
  fanMatchTweetShare: number;
  fanTweetLikesScale: number;

  // End of year awards. Thresholds first — every award is allowed to go
  // unclaimed in a year that did not earn it — then what winning costs or
  // pays.
  /** How much a year's popularity movement counts next to standing. */
  awardMovementWeight: number;
  /** Nobody wins Wrestler of the Year from the bottom of the card. */
  awardWrestlerOfYearFloor: number;
  awardMatchOfYearFloor: number;
  awardWorstMatchCeiling: number;
  /** You have to have been down this far to be coming back. */
  awardComebackFromBelow: number;
  awardComebackGain: number;
  /** Too few matches and a year's movement means nothing. */
  awardMinMatches: number;
  awardImprovementGain: number;
  awardTeamMinWins: number;
  awardDownfallDrop: number;
  /** You have to have been this big for a bad year to be a story. */
  awardDisappointmentFloor: number;
  /**
   * And you have to have gone backwards by this much *relative to the rest of
   * the top of the card*. Judged absolutely, the award goes to whoever is
   * pinned against the popularity ceiling every year — somebody at 100 has
   * nowhere left to move, which reads as "stood still" and is not their
   * fault.
   */
  awardDisappointmentDrop: number;
  /** Wrestler and Downfall of the Year hit harder than the rest. */
  awardHeadlineScale: number;
  awardPopularityGain: number;
  awardPopularityLoss: number;
  awardMomentumGain: number;
  awardMomentumLoss: number;
  awardMoraleGain: number;
  awardMoraleLoss: number;

  // Incidents — the things nobody booked. See engine/sim/incidents.ts.
  /** Chance any one match produces one. Kept low on purpose. */
  incidentChance: number;
  incidentMainEventMultiplier: number;
  incidentTitleMultiplier: number;
  /** However the multipliers stack, no single match is a coin flip. */
  incidentChanceCap: number;
  /** How much of a feud a turn or a betrayal is worth on its own. */
  incidentTurnHeat: number;
  incidentTurnMomentum: number;
  incidentBetrayalMorale: number;
  /** Real animosity, from the incidents that generate it. */
  incidentShootHeat: number;
  /** Existing animosity a match needs before it can boil over. */
  incidentShootThreshold: number;
  incidentShootInjuryWeeks: number;
  /** What a shoot does to everybody who had to watch it. */
  incidentRosterUnease: number;
  /** A finish nobody could explain sells the rematch. */
  incidentControversyHeat: number;
  incidentCredibilityCost: number;
  incidentBeatdownHealth: number;
  /** Taking a beating buys sympathy. */
  incidentSympathyPopularity: number;
  incidentReturnHeat: number;
  incidentReturnMomentum: number;
  incidentReturnPopularity: number;
  /** How good a match has to be before it can make somebody. */
  incidentBreakoutRating: number;
  /** And how far below their opponent the winner had to be. */
  incidentBreakoutGap: number;
  incidentBreakoutPopularity: number;
  incidentCompanyLift: number;
  /** Years between them before a clean loss reads as passing the torch. */
  incidentTorchAgeGap: number;
  incidentGraciousMorale: number;
  incidentOvationRating: number;
  incidentOvationPopularity: number;
  incidentHijackRating: number;
  incidentHijackPopularity: number;

  // Rankings. Contenders are about form; the world list is about a career.
  rankMomentumWeight: number;
  rankFormWeight: number;
  rankPopularityWeight: number;
  contenderRankingSize: number;
  worldRankPopularityWeight: number;
  worldRankPeakWeight: number;
  worldRankReignsWeight: number;
  worldRankChampionWeeksWeight: number;
  worldRankFormWeight: number;
  rankReignsForFullCredit: number;
  rankChampionWeeksForFullCredit: number;
  worldRankingSize: number;
  /** How many wrestlers the weekly sheet ranks in each division. */
  publicationWrestlerListSize: number;
  /** How many tag teams it ranks in each division. */
  publicationTeamListSize: number;
  /** How much a team's own record counts toward its ranking, 0-1. */
  publicationTeamRecordWeight: number;
  /** Weeks together for full longevity credit. */
  publicationTeamLongevityWeeks: number;
  /** Points a long-running partnership is worth. */
  publicationTeamLongevityBonus: number;

  // The hall of fame. Hard to get into on purpose.
  /** Weight on career peak popularity, the biggest part of the case. */
  hofPeakWeight: number;
  hofReignsWeight: number;
  hofReignsForFullCredit: number;
  hofChampionWeeksWeight: number;
  hofChampionWeeksForFullCredit: number;
  hofLongevityWeight: number;
  hofYearsForFullCredit: number;
  /** Score a career has to reach to be inducted at all. */
  hofScoreThreshold: number;
  /** How many go in each year, at most. */
  hofInductionsPerYear: number;

  // The academy. Keeps the world populated as people leave it.
  /** Below this many working wrestlers, the schools start turning them out. */
  worldPopulationMin: number;
  /** Above this, nobody new breaks in. */
  worldPopulationMax: number;
  /** Most graduates in one intake. */
  academyMaxGraduates: number;
  /** Age range a graduate debuts at. */
  academyDebutAgeMin: number;
  academyDebutAgeMax: number;

  // Nicknames. Earned over years, never handed out at signing.
  /** Years in the business before anybody starts calling you something. */
  nicknameYearsPro: number;
  /** Popularity (now or at peak) needed before a nickname sticks. */
  nicknamePopularity: number;
  /** Popularity above which the grand nicknames become available. */
  nicknameMainEventPopularity: number;
  /** Chance a qualifying main eventer draws from the grand pool. */
  nicknameMainEventChance: number;
  /** Ego above which somebody is defined by their ego more than their work. */
  nicknameEgoThreshold: number;
  /** Weekly chance an eligible wrestler picks one up. */
  nicknameWeeklyChance: number;

  // Repackaging. What a ring name the player types is allowed to be.
  ringNameMinLength: number;
  ringNameMaxLength: number;

  // The lede on the results screen. See engine/world/newsfeed.ts.
  /** How many headlines the night opens with, at most. */
  newsLedeLength: number;
  newsGreatShowRating: number;
  newsPoorShowRating: number;

  // Territories — §16. The decay is the load-bearing number: it is what stops
  // the player finding one big market and running there forever.
  /** Following earned per star of show quality. */
  territoryFollowingPerStar: number;
  /** Following lost every week in every town you did not run. */
  territoryFollowingDecayPerWeek: number;
  /** What a town's taste is worth on the show rating, at a weight of 1. */
  territoryFitRatingWeight: number;
  /** Violence level at which a card counts as fully hardcore. */
  territoryHardcoreFullViolence: number;
  /** Booked minutes at which a match counts as a long one. */
  territoryLongMatchMinutes: number;
  /** Following the owner loses per star when somebody runs their town. */
  territoryInvasionDamagePerStar: number;
  /** Below this house, a show is not a claim on anything. */
  territoryClaimMinimumAttendance: number;
  /**
   * How far local following can swing demand either way. At 0.5, a town that
   * has never heard of you draws half what your rating says and a town you own
   * draws half again as much.
   */
  demandFromTerritoryFollowing: number;
  /**
   * What share of a town a rival fills at full following. They have no venue
   * and no ticket price, so their house is estimated rather than simulated —
   * inventing a second economy for them would be a second economy to keep
   * agreeing with the first.
   */
  rivalHouseShare: number;
  /** How over a new promotion already is in the town it comes from. */
  startingTerritoryFollowing: number;

  // Owner mandates — §17. LOCKED: three failures ends the run.
  ownerMandatesEveryWeeks: number;
  mandateWeeksToComply: number;
  mandateStrikesBeforeFiring: number;
  /** How far above the current rating the owner asks you to climb. */
  mandateRatingClimb: number;
  /** Share of the current wage bill they want it cut to. */
  mandatePayrollCut: number;
  /** Multiple of your best recent house they want you to beat. */
  mandateAttendanceClimb: number;
  /** Popularity a signing target has to be worth asking for. */
  mandateSignPopularity: number;
  /** And the ceiling below which somebody is expendable. */
  mandateReleasePopularity: number;
  mandatePushMaxAge: number;
  /** How far above where they are now the owner wants somebody taken. */
  mandatePushClimb: number;
  /** Share of the biggest reachable house an owner will ask you to fill. */
  mandateAttendanceCeiling: number;
  /** Saturation above which the owner starts complaining about garbage. */
  mandateHardcoreCeiling: number;
  mandateRewardCash: number;
  mandatePenaltyCash: number;
  mandateFailureRating: number;

  /** Rating points a match gains for fitting the promotion's house style. */
  houseStyleRatingWeight: number;
  /** Rating points a card loses for running past what this audience will take. */
  houseStyleViolencePenalty: number;

  // World
  /** What the player's company is called. Its belts are named from it. */
  promotionName: string;
  /** The player's house style. Changeable until the first show is run. */
  promotionArchetype: PromotionArchetype;
  rivalPromotionCount: number;
  /** Condition below which a rival rests somebody instead of booking them. */
  rivalMinHealthToBook: number;
  /** Per-match chance a rival puts a belt on it. */
  rivalTitleDefenceChance: number;
  /** Most championship matches a rival will run on one card. */
  rivalMaxTitleDefencesPerCard: number;
  /** Chance a rival's card includes a tag match. */
  rivalTagMatchChance: number;
  /** Weekly chance a rival's main event carries its signature stipulation. */
  rivalStipulationChance: number;
  /** How much a rival's booking credibility is worth in rating points. */
  rivalCredibilityRatingWeight: number;
  // What the other companies take in and pay out, and when they close.
  /** How steeply revenue rises with standing. */
  rivalRevenueCurve: number;
  /** Weekly revenue for a promotion at the very top of the ladder. */
  rivalRevenueScale: number;
  /** How much of their revenue depends on recent show quality, 0-1. */
  rivalRevenueFormWeight: number;
  rivalOverheadBase: number;
  rivalOverheadPerHead: number;
  /**
   * Weeks a rival can run at a loss before folding. Long on purpose: a company
   * should die from years of failure, not from one bad quarter.
   */
  rivalBankruptcyGraceWeeks: number;
  /** The business never drops below this many open companies. */
  minimumPromotions: number;
  /** Cash an investor puts into a company the business cannot afford to lose. */
  rivalBailoutCash: number;

  // The fire sale when a company closes.
  /** What a maximum-popularity wrestler adds to a package's appraisal. */
  auctionValuePerStar: number;
  /** What a maximum-prestige championship adds. */
  auctionValuePerTitle: number;
  /** Fraction of the appraisal a bid must clear to be valid at all. */
  auctionReserveFraction: number;
  auctionBaseAppetite: number;
  auctionStyleFitAppetite: number;
  auctionRosterRoomAppetite: number;
  auctionAmbitionAppetite: number;
  auctionBidVariance: number;
  /** Most of its bank any company will spend on one lot. */
  auctionMaxBankFraction: number;
  auctionLowballFraction: number;
  auctionFairFraction: number;
  auctionAggressiveFraction: number;

  /** How many tag teams each promotion is formed with. */
  tagTeamsPerPromotion: number;
  /** Roster size of the smallest rival promotion. */
  rivalRosterSizeMin: number;
  /** Roster size of a rival at the top of the ladder. */
  rivalRosterSizeMax: number;
  territoryCount: number;
  startingTerritories: number;
  startingYear: number;
  seed: string;
  rivalsCanGoBankrupt: boolean;
  secondGenerationEnabled: boolean;
  relationshipsEnabled: boolean;
  hallOfFameEnabled: boolean;
}

export type WorldPresetName = 'territoryDays' | 'standard' | 'bigMoney' | 'sinkOrSwim' | 'custom';

// ============================================================================
// §17 — Owner and mandates (types only; system lands in M5)
// ============================================================================

export type OwnerPersonality = 'traditionalist' | 'showman' | 'pennyPincher' | 'hardcore' | 'starChaser';

export type MandateType =
  | 'signWrestler'
  | 'releaseWrestler'
  | 'titleOnWrestler'
  | 'reachRating'
  | 'cutPayroll'
  | 'drawAttendance'
  | 'pushTalent'
  | 'expandTerritory'
  | 'reduceHardcore'
  | 'runShowInTerritory';

export interface OwnerMandate {
  id: Id;
  type: MandateType;
  description: string;
  targetId?: Id;
  targetValue?: number;
  deadlineWeek: number;
  fulfilled: boolean;
}

// ============================================================================
// §20 — Random events (types only; event engine lands in M5.5)
// ============================================================================

export type EventCategory =
  | 'healthInjury'
  | 'lockerRoom'
  | 'professionalism'
  | 'ambitionPolitics'
  | 'shocks'
  | 'lifeHappens';

export type EventTier = 'common' | 'uncommon' | 'rare' | 'oncePerSave';

// DESIGN: kept data-shaped (key/value) rather than functions, per the "data
// over code" rule in CLAUDE.md — the engine evaluates these against world
// state; data/events/*.ts stays free of imperative logic.
export interface EventTriggerCondition {
  key: string;
  value: unknown;
}

export interface EventEffect {
  key: string;
  value: unknown;
}

export interface EventResponseOption {
  label: string;
  effects: EventEffect[];
}

export interface GameEvent {
  id: Id;
  category: EventCategory;
  tier: EventTier;
  baseWeight: number;
  cooldownWeeks: number;
  perWrestlerCooldown?: number;
  triggerConditions: EventTriggerCondition[];
  textVariants: string[];
  responseOptions: EventResponseOption[];
}

export interface NewsItem {
  week: number;
  headline: string;
  body?: string;
  category: string;
}
