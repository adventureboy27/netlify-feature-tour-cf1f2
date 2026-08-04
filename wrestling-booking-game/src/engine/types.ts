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
  holderIds: Id[]; // multiple entries for tag/trios teams
  wonFromIds: Id[] | null; // null if won via tournament, award, or vacancy
  wonByMethod: 'match' | 'tournament' | 'awarded' | 'battleRoyal';
  startWeek: number;
  endWeek: number | null; // null while still holding
  endMethod: TitleReignEndMethod | null;
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
  titleReigns: TitleReignRecord[];
  injury: Injury | null;
  careerHighPopularity: number;
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

export interface Title {
  id: Id;
  promotionId: Id;
  name: string;
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
  | 'refereeStoppage';

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
  ownerId: Id; // a Wrestler record with role 'owner'
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

  // Chaos
  chaosLevel: number; // 0-3
  ownerMandatesEnabled: boolean;
  ownerPatience: number;

  // World
  rivalPromotionCount: number;
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
