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

// DESIGN: 'announcer' was here and is gone. Nobody was ever generated as one
// and nothing ever paid one — it was a union member advertising a system that
// did not exist. Announcers stay in the game as an unseen voice in the match
// write-ups, which is all they were ever doing; if they are ever wanted as
// characters they come back with a generator and a wage behind them.
export type StaffRole = 'wrestler' | 'manager' | 'referee' | 'roadAgent' | 'trainer' | 'owner';

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
  /** Nobody put it on the line inside the window, so the company took it back. */
  | 'strippedUndefended'
  /** Ended by a unification match rather than an ordinary defence. */
  | 'unified'
  /** The match for it broke down mid-way when the gear it needed gave out — nobody won it. */
  | 'vacatedByEquipmentFailure'
  /** The championship itself was retired out from under them. */
  | 'titleRetired'
  | 'retired'
  | 'released'
  | 'contractExpired'
  | 'died'
  | 'longTermInjury'
  | 'promotionFolded'
  | 'soldOff';

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

/**
 * Whose kid somebody is. See engine/career/lineage.ts.
 *
 * `parentName` and `familyName` are denormalised on purpose: the parent may
 * be dead, may have been repackaged twice since, and the announcers and the
 * paper still have to be able to say the name the crowd remembers.
 */
export interface Lineage {
  parentId: Id;
  parentName: string;
  /** The surname the crowd hears. A one-word act hands down the whole act. */
  familyName: string;
  /** Week they debuted, which is when the crowd's patience starts running. */
  inheritedAt: number;
  /** How much of their opening popularity is borrowed rather than earned. */
  inheritedStanding: number;
  /**
   * Week they stopped being their father's kid and became themselves. Null
   * while the name is still doing the work.
   */
  provenBy: number | null;
}

// DESIGN: Injury is referenced by Wrestler.injury but never defined. Severity
// tiers and permanent stat loss come from §12 ("Health, injury, momentum").
export type InjurySeverity = 'minor' | 'moderate' | 'severe' | 'careerThreatening';

export type PhysicalStatKey = 'strength' | 'skill' | 'agility' | 'stamina' | 'toughness';

export interface InjuryRecord {
  what: string;
  severity: InjurySeverity;
  year: number;
  week: number;
  weeksOut: number;
  workedThroughIt: boolean;
}

export interface Injury {
  severity: InjurySeverity;
  /**
   * How bad it is right now, 0-100. The thing that actually moves: it heals
   * down each week by how they are being looked after, and a fresh injury on
   * top of it stacks rather than replacing it. `severity` is a label for this
   * and `weeksRemaining` is an estimate derived from it. See sim/casualties.ts.
   */
  grade: number;
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

export interface Gimmick {
  id: Id;
  name: string;
  /** Loose grouping for filtering the signing-meeting picker — not read by any sim logic. */
  category: string;
  alignmentLean: AlignmentLean;
  /** One line: what they are, played straight. Shown at the signing meeting. */
  concept: string;
  /** What they'd actually say on the mic. 1-3 lines. */
  promoLines: string[];
  /** What they carry to the ring, if anything — a hook for hardcore/No-DQ weapon flavor. */
  prop?: string;
  popularityCeiling: number; // 0-100
  growthRateMultiplier: number; // applied to popularity gains while fresh
  territoryFit: Partial<Record<Id, number>>; // territoryId -> affinity weight, -1..1
  merchMultiplier: number;
  /**
   * Mechanical, not cosmetic: whether this character wears a mask at all,
   * for the "Mask vs Mask" stipulation's eligibility check and its stakes —
   * see data/stipulations.ts. Most gimmicks don't care either way.
   */
  masked?: 'required' | 'forbidden';
}

// ============================================================================
// §18 — Tag teams, stables, factions
// ============================================================================

/** A tag team or stable. */
export interface Stable {
  id: Id;
  name: string;
  kind: 'tagTeam' | 'stable';
  memberIds: Id[];
  leaderId: Id | null;
  formedWeek: number;
  disbandedWeek: number | null;
  record: WinLossRecord;
}

/**
 * A shared identity for a tag team or stable, offered at the signing
 * meeting alongside solo `Gimmick`s — see data/groupGimmicks.ts. Deliberately
 * separate from `Gimmick`: a group identity has no popularity ceiling or
 * growth rate of its own, since those still belong to the individual
 * members wearing it.
 */
export interface GroupGimmick {
  id: Id;
  name: string;
  kind: 'tagTeam' | 'stable';
  alignmentLean: AlignmentLean;
  concept: string;
  promoLines: string[];
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
  /**
   * What the *business* thinks that ceiling is, 0-100.
   *
   * Correlated with `talent` and not equal to it. Every scouting read in the
   * game — market value, a rival's keenness, the prospect label, the sheet —
   * goes through this rather than the truth, which is what allows a promotion
   * to be wrong about somebody. See career/hype.ts.
   */
  hype: number;
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
  /**
   * Why their morale is where it is, in their words — the loudest thing the
   * last week did to them. Stored rather than derived because it is a fact
   * about a week that has already happened: what the crowd was asking for
   * last Monday cannot be recovered from this Monday's state. Null before
   * their first week. See career/morale.ts.
   */
  moraleNote: string | null;
  /** Which way it moved last week, for the trend arrow. */
  moraleLastDelta: number;
  /**
   * The full ranked list behind this week's headline, loudest first — the
   * same data `weeklyMorale` computed, just not discarded after the one-line
   * summary was picked. Optional: absent on a save from before this existed,
   * and an empty array is a legitimate "nothing worth naming happened" week.
   */
  moraleReasons?: { text: string; positive: boolean }[];
  momentum: number; // 0-100
  cardStatus: CardStatus;
  /**
   * What they did and where — lifetime and per company, plus money and time
   * served split by role. See engine/career/ledger.ts.
   *
   * Optional on the type so a wrestler built before this existed still reads;
   * everything that writes to it goes through `ledgerOf`, which fills one in.
   */
  ledger?: Ledger;
  /** Violations, fines and suspensions. See engine/career/discipline.ts. */
  discipline?: DisciplineRecord;
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
  gimmickFreshness: number; // 0-100, reaction-driven — see sim/freshness.ts's heatTarget
  /**
   * Consecutive weeks spent at or below settings.iceColdThreshold — the
   * clock for a forced booker meeting. Optional: absent and 0 mean the
   * same thing everywhere this is read. Resets the moment freshness climbs
   * back out of the cold band, or the moment a meeting actually happens.
   */
  weeksIceCold?: number;
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
  /**
   * Where they are from. Was on this type from the beginning, written once at
   * generation and read by absolutely nothing — see career/reach.ts, which is
   * the module that finally gives it a job.
   */
  homeTerritoryId: Id;
  /**
   * How over they are town by town, 0-100. Sparse: a town they have never
   * worked has no entry, and career/reach.ts falls back to a fraction of
   * their national profile rather than to zero, because word travels.
   */
  regionalPopularity: Partial<Record<Id, number>>;
  /**
   * A real photo the booker uploaded, as a data URI — resized/cropped
   * client-side before it ever lands here (see ui/paperdoll/photoUpload.ts).
   * Optional and absent for almost everyone: this replaced the generated
   * pixel-art sprite entirely rather than sitting alongside it, so anyone
   * without one just renders as an initials avatar. See ui/paperdoll/PaperDoll.tsx.
   */
  photoDataUrl?: string;
  /**
   * Wears a mask, as a fact about the character rather than a look — the
   * only thing this gates is the "Mask vs Mask" stipulation's eligibility
   * and its stakes. See data/stipulations.ts and Gimmick.masked.
   */
  masked: boolean;

  // Employment
  promotionId: Id | null;
  contract: Contract | null;
  /**
   * A renewal auction's winning bid, agreed while the current deal still had
   * time on it — see economy/bidding.ts's 'renewalAuction' reason. Win or
   * lose, the current employer keeps them on the current dates; this swaps
   * into `contract` automatically the week the old one actually runs out
   * (resolveWeek's expiry pass), never mid-deal. Optional: absent and
   * undefined mean the same thing as null everywhere this is read.
   */
  queuedContract?: { contract: Contract; promotionId: Id } | null;
  role: StaffRole;
  /**
   * When they took the job they are doing now.
   *
   * A role change is reversible but not casual: see career/transition.ts.
   * Without this you could put somebody in the shirt for one night because
   * your referee was hurt and have them wrestling again next week, which
   * makes the whole officials roster decorative.
   */
  roleSinceWeek: number;

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
  /**
   * The booker has signed off on this person working while hurt — the only
   * way an injured wrestler gets on a card at all. Set when a champion is
   * sent out to defend rather than vacate, and cleared the moment they heal
   * or get hurt worse. See engine/world/titleDefence.ts.
   */
  clearedToWorkHurt: boolean;
  careerHighPopularity: number;
  /**
   * Set when somebody comes out of retirement. They negotiate from a long way
   * back afterwards — see career/leverage.ts.
   */
  comebackWeek?: number | null;
  /**
   * Set the week somebody tells you he is not re-signing. He works out the
   * deal and then he is gone — see career/theBody.ts handsInNotice.
   */
  noticeGivenWeek?: number | null;
  /**
   * How this person regards his own future, 0-100. High takes the insurance
   * and the weeks off; low wants cash now and thinks he is indestructible.
   * Drives what he asks for in a deal and what he does when he is hurt.
   * See career/theBody.ts.
   */
  selfPreservation: number;
  /**
   * Who they are, drawn once and permanent. One or two of them. See
   * career/personality.ts — these decide what a person actually wants out of
   * the week, which is what stopped a locker room being twenty-six copies of
   * the same slightly unhappy man.
   */
  traits?: TraitId[];
  /**
   * What they are actually chasing, drawn once and permanent, one to a
   * handful. See career/motivation.ts — shown as its own icon row on the
   * roster card, separate from traits, because this answers "what would
   * satisfy this person" rather than "what kind of person are they."
   */
  motivators?: MotivatorId[];
  /**
   * Set only for `somebodyAtHome`: the wrestler they are with. Paired up
   * across companies, so the trait has somebody real to be away from.
   */
  attachedTo?: Id | null;
  /**
   * What they do with a week they are not booked for. `auto` (or unset) lets
   * the office decide per person, which is what stops this being thirty
   * questions a week. See career/assignment.ts.
   */
  assignment?: AssignmentChoice;
  /**
   * What they actually did last week, when it was not a match. §0: a stat that
   * moved wants a sentence saying why, and "he was in the gym" is that
   * sentence. Null on a week they wrestled.
   */
  doingThisWeek?: string | null;
  /**
   * Ring intelligence, 0-100. Not workrate — knowing what to do out there.
   * Decides whether a spot goes wrong, and how much of a bad opponent's match
   * this person can carry. See sim/ringcraft.ts.
   */
  ringIQ: number;
  /**
   * How much the locker room likes them, 0-100. Nothing to do with charisma,
   * which is the crowd. This is who people want to be in a car with.
   */
  likeability: number;
  /** Everything that has ever happened to this body, dated. */
  injuryHistory: InjuryRecord[];
  /**
   * Time off that is not an injury and must never read as one — today, the
   * paid month the company sends somebody home for after a man died in the
   * ring with him. See career/onOurWatch.ts.
   */
  leave?: Leave | null;
  /**
   * A hype campaign airing in place of an ordinary debut — three weeks of
   * paid-for mystery instead of just showing up. Set only at signing time,
   * and only for somebody who has never had a match here. See
   * career/vignette.ts; blocks booking the same way `leave` does.
   */
  vignette?: Vignette | null;
  /**
   * The politician's paperwork lockout has this person's license stuck in
   * review — cannot be booked, cannot be paid, and the contract clock does
   * not run against them either, until the whole industry-wide freeze lifts.
   * See engine/world/paperworkLockout.ts. Unlike vignette this is never
   * staggered per-wrestler: everyone frozen shares the one clock on
   * World.paperworkLockout, so a flat boolean is enough.
   */
  paperworkFrozen?: boolean;
  /**
   * A death the locker room lays at his door rather than the office's. While
   * it is fresh nobody will work with him. See career/onOurWatch.ts.
   */
  blamedFor?: BlamedFor | null;
  /** Set when they die. A wrestler with this set is never booked again. */
  deceased?: Passing;
  /** Set when they are inducted. §19's hall of fame. */
  hallOfFameWeek?: number;
  /** Set at generation for a second-generation wrestler, never afterwards. */
  lineage?: Lineage;
  /**
   * Companies they will not work for again, whatever the offer.
   *
   * Written at the moment the wrong is done — see the release request in the
   * store, which is the one place the game lets a booker keep somebody who
   * has asked to leave. A grudge is not a mood; it does not decay.
   */
  grudges?: Id[];
  /**
   * Weeks they are barred from signing anywhere, from a negotiated release.
   *
   * The thing the player trades for when somebody asks out: he walks away
   * from the money he was owed, you agree to let him go, and he cannot turn
   * up on a rival's show the following week. A contract that simply *expires*
   * carries none of this — that man is free the next day.
   */
  noCompeteWeeks?: number;
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

/** Roughly what kind of room it is, for grouping the list. */
export type VenueKind = 'hall' | 'club' | 'theatre' | 'arena' | 'stadium' | 'openAir';

export interface Venue {
  id: Id;
  name: string;
  kind: VenueKind;
  capacity: number;
  /** Rented per show. Never owned. */
  rentalCost: number;
  prestige: number; // 0-100, feeds show rating
  /** A real building will not rent to a promotion nobody has heard of. */
  minCompanyRating: number;
  blurb: string;

  /**
   * The building's share of the gate, on top of the rent. 0-1.
   *
   * The reason a big room does not simply become free money once you can fill
   * it: the better the house does, the more the house takes. A hall charges
   * rent and walks away; an arena is a partner you did not want.
   */
  houseCut: number;
  /**
   * What the promotion keeps at the bar and the tuck shop, per head.
   *
   * Wildly uneven, and deliberately so. A VFW hall hands you the bar takings
   * because the bar is why they rent to you; a casino keeps every cent of it
   * and a school keeps the tuck shop for the PTA.
   */
  concessionsPerHead: number;
  /** The house's cut of the merch table. 0-1. */
  merchCut: number;
  /**
   * How much of the production rig the room will physically take, in the same
   * haul units as the production ladder.
   *
   * A gym with a nine-foot ceiling cannot hang a lighting rig and has nowhere
   * to put a video wall, however much you paid for one. Gear that does not fit
   * stays on the truck — you neither get its benefit nor pay to run it.
   */
  productionCapacity: number;
  /**
   * The room's own character, added to the show rating whether it is full or
   * not. A bingo hall is hot at four hundred; a convention centre is a
   * carpeted box at eight thousand.
   */
  atmosphere: number;
  /** Flat cost of getting into an awkward building. Stairs, no dock, a pier. */
  loadIn: number;
  /** Open to the sky. Weather stops being a flavour note. */
  outdoor: boolean;
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
  /** false = never offered in a fire sale — the training facility is a school, not show-night gear. Omit for everything else. */
  fireSaleEligible?: boolean;
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
  /** Merch lines and concession stands being run tonight. See data/stands.ts. */
  standIds: Id[];
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

import type { PerkId } from '../data/perks';
// Type-only, so the cycle with world/schedule.ts (which needs Promotion and
// WorldSettings from here) is erased at compile time.
import type { PromotionSchedule } from './world/schedule';
import type { Ledger } from './career/ledger';
import type { DisciplineRecord } from './career/discipline';
import type { BlamedFor, DeathOnOurWatch, Leave } from './career/onOurWatch';
import type { Vignette } from './career/vignette';
import type { TraitId } from './career/personality';
import type { MotivatorId } from './career/motivation';
import type { AssignmentChoice } from './career/assignment';

export type ContractType = 'fullTime' | 'partTime' | 'perAppearance' | 'developmental' | 'legends';

/**
 * What is in a deal beyond the money.
 *
 * Every entry here is negotiated for, paid for, and enforced somewhere. Nine
 * more used to sit in this union — nepotism, immediateStart, creativeFreedom,
 * noHardcore, releaseClause, partTime, exclusivity, trainerRole and
 * rematchClause — which no ladder offered, no bid could include and no rule
 * ever read. noJobbing and titlePush went with them: both were offered and
 * paid for, and neither was ever enforced anywhere. They were removed rather than implemented: a clause list is a
 * promise about what the game models, and nine tenths of a promise is worse
 * than a shorter one.
 */
export type Clause =
  | 'ironClad'
  | 'noCompete'
  | 'creativeControl'
  | 'incentive'
  | 'downside'
  | 'payPerView'
  | 'healthInsurance'
  | 'guaranteedDates'
  | 'travelCovered'
  | 'merchandiseCut'
  | 'noTrade';

export interface Contract {
  /**
   * Paid every week whether they are booked or not. The other half of the
   * money is perAppearance — see economy/contracts.ts retainerShare.
   */
  /**
   * How much of the remaining term is guaranteed, 0-1.
   *
   * The single number the whole exit system turns on. Firing somebody costs
   * their weekly rate times the weeks left times this — so at 0 a release is
   * a handshake and free, and at 1 cutting your top guy eighteen months into
   * a two-year deal is ruinous.
   *
   * Most of the card gets nothing. Guaranteed money is what a draw asks for
   * instead of, or as well as, a higher rate, and it is the reason a long
   * contract is a risk to the promotion and not only to the wrestler.
   */
  guaranteedPct: number;
  type: ContractType;
  weeklyRate: number;
  /**
   * Paid only for a show they actually worked. Splitting pay this way is what
   * makes a deep roster affordable — see economy/contracts.ts splitRate.
   */
  perAppearance: number;
  weeksRemaining: number;
  totalWeeks: number;
  clauses: Clause[];
  /**
   * What is in the deal that is not money or rights — a jet, an apartment, a
   * door that shuts. See data/perks.ts. Optional because every contract
   * written before perks existed has none, and none is the correct reading.
   */
  perks?: PerkId[];
  signedYear: number;
}

// ============================================================================
// §10.2 — Officials
// ============================================================================

/**
 * A referee. A signed, contracted character — not a row in a lookup table.
 *
 * They have a name the crowd knows, a wage, a deal that runs out, a body that
 * gets tired across a card and hurt in a bad match, and a standing in the
 * business that the sheet ranks. What they do not have is creative control:
 * an official does not get to ask who goes over.
 *
 * The important number is `competence`, and the important state is
 * `sharpness`. A brilliant official working his sixth match of the night is
 * worse than a mediocre one working his first, which is the whole reason to
 * carry more than one.
 */
export interface Referee {
  id: Id;
  name: string;
  /** How reliably they see what happened and count it straight. */
  competence: number; // 0-100
  /** How easily they are bought. High means a crooked finish is available. */
  bendable: number; // 0-100
  /** Whether they can take a bump. Officials get hurt too. */
  toughness: number; // 0-100
  age: number;
  /** Years in the shirt. Feeds what they cost and how the sheet reads them. */
  experience: number;
  blurb: string;

  /** Who they work for. Null means available. */
  promotionId: Id | null;
  /** Referee deals never carry creative control. See economy/refereeContracts. */
  contract: Contract | null;

  /**
   * How fresh they are. Falls with every match they work and comes back
   * between shows. This is the burnout the player is managing when they save
   * their best official for the main event.
   */
  sharpness: number; // 0-100
  /** What the business thinks of them. Moves on clean nights and on misses. */
  reputation: number; // 0-100

  /** Matches worked tonight. Reset when the show ends. */
  matchesTonight: number;
  /** Career total, for the sheet and the record book. */
  careerMatches: number;
  /** Rolling window the ranking reads: matches worked and things missed. */
  recentMatches: number;
  recentMisses: number;

  injury: Injury | null;
  /** Weeks they have been sitting unsigned. Long enough and they come cheaper. */
  weeksUnsigned: number;
  /**
   * Set when this official is one of your wrestlers doing the job instead.
   *
   * They are the same person: the wage is already on the roster payroll, no
   * rival can sign them out of the pool, and hurting the official hurts the
   * wrestler. They learn the job as they work it, and they can take a bump
   * in a way a career official cannot — but they never get all the way good.
   */
  wrestlerId: Id | null;
}

/**
 * Something the official did not see, and the crowd did.
 *
 * A miss is never silent — CLAUDE.md's rule applies to officiating as much as
 * to injuries. If a bad referee costs somebody a match, the write-up says
 * which referee, what they missed, and who it cost.
 */
export interface RefereeMissRecord {
  refereeId: Id;
  refereeName: string;
  missId: string;
  /** The line the write-up runs. */
  text: string;
  /** The wrestler it went against, when it went against somebody. */
  victimId: Id | null;
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

/**
 * A belt before it exists — what the player is editing on the new-game screen.
 *
 * The archetype fills this in, and then the player can rename, re-divide,
 * remove or add. Pre-filled rather than blank on purpose: a page that opens
 * with "you have no championships" is a worse start than one that opens with
 * a sensible five you can immediately make yours.
 *
 * `prestige` is deliberately not on here. A belt's standing is earned by who
 * carries it and how long, and letting the player type 100 into their own
 * world title on day one would hand them a promotion's worth of credibility
 * for free. It comes from the tier instead — see PRESTIGE_BY_TIER.
 */
export interface TitleBlueprint {
  /** Everything after the promotion prefix, e.g. "Heavyweight Title". */
  suffix: string;
  blurb: string;
  tier: TitleTier;
  division: TitleDivision;
  weightClass: WeightClass;
  signatureStipulationId: Id | null;
  /** Only defendable under that stipulation, rather than merely suited to it. */
  stipulationRequired?: boolean;
  /** How many people carry it. Defaults to what the tier implies. */
  holdersRequired?: number;
  /** Strap and plate. Defaults to the tier's scheme. */
  colorway?: { strap: string; plate: string };
}


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
   * Set when the belt is retired. A retired championship keeps its whole
   * lineage — every reign, every change — but is not defended, does not run a
   * defence clock, and cannot be put on a card. Bringing it back is a real
   * thing promotions do, so this clears again on an unretire.
   */
  retiredWeek?: number | null;
  /**
   * Week it was last actually on the line. A belt nobody defends is a belt
   * the card is not being built toward, so the company eventually takes it
   * back — see engine/world/titleDefence.ts.
   */
  lastDefendedWeek: number;
  /**
   * Who holds the interim version while the real champion is hurt. Empty
   * almost always. While this is set the belt has two claimants and the only
   * match it can be in is the one that settles it.
   */
  interimHolderIds: Id[];
  /** When the interim was crowned, for the lineage. */
  interimSinceWeek: number | null;
  /**
   * The stipulation this belt is traditionally defended under, if any. A
   * deathmatch title contested under normal rules is a disappointment and the
   * crowd says so; defended the way it is meant to be, it rates better.
   * Applied in engine/sim/matchRating.ts via the 'Signature' term.
   */
  signatureStipulationId: Id | null;
  /**
   * Turns the tradition into a rule. A Battle Royal Trophy that can be won in
   * a singles match is not a Battle Royal Trophy — with this set the belt
   * cannot go on the line at all except under its signature stipulation.
   */
  stipulationRequired: boolean;
  /**
   * How many people hold it at once. Two for a tag championship, three for
   * trios, and any number the booker wants for anything else — a belt held by
   * four is a real thing a promotion can invent.
   *
   * Was derived from the tier, which meant "tag" was the only way to say
   * "two people" and a trios belt could never be anything else.
   */
  holdersRequired: number;
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
  /**
   * True for stipulations that lean on physical hardware to work — a ladder,
   * a cage, a table. Cheap gear makes these riskier than the stipulation's
   * flat injuryMult alone says; see simulateMatch.ts's hardwareGearRisk,
   * scaled by the same equipmentInjuryReduction a good ring/mat already
   * earns everyone else.
   */
  hardwareGearSensitive?: boolean;
  /**
   * Which data/matchProps.ts family this stipulation needs physically owned
   * to be booked for real — e.g. a Ladder Match needs a ladder. Undefined
   * means no physical prop is required. See stipulationRequirementsMet.
   */
  gearFamilyId?: Id;
  /** How many usable units of gearFamilyId are required. Defaults to 1 when gearFamilyId is set. */
  minGearUnits?: number;
  /**
   * How much harder this specific booking is on the gear it used tonight,
   * multiplying the tier's ordinary useWearPerMatch. Defaults to 1. A table
   * that's actually on fire does not come back from a Flaming Tables match
   * the way a plain Tables Match table does — same family, same tiers, a
   * much shorter life once the stipulation is the reason it broke.
   */
  gearWearMultiplier?: number;
  /**
   * True for a stipulation nobody starts a save with — earned by living
   * through the specific event that unlocks it (Arena Floor, from the truck
   * breaking down; see engine/world/truckBreakdown.ts). Hidden from the
   * picker unless World.unlockedStipulationIds contains this id.
   */
  locked?: boolean;
}

// ============================================================================
// §9 — Match rules
// ============================================================================

/**
 * How a match is worked. Defined here rather than in data/pacing.ts so the
 * dependency runs the usual way — content imports engine types, not the
 * reverse. The numbers behind each one live in data/pacing.ts.
 */
export type PaceId = 'sprint' | 'standard' | 'slowBuild' | 'allOut';

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
  /**
   * How the match is worked. See data/pacing.ts — no pace is strictly better
   * than another, which is the whole point of it being a lever.
   */
  pace: PaceId;
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
  | 'injuryStoppage'
  /** Steel Cage only: over the wall or out the door before anybody's shoulders hit the mat. */
  | 'escape'
  /**
   * The gear gave out mid-match — a ladder buckled, a cage panel came loose,
   * a table didn't break. Nobody wins this one. Only ever reachable when the
   * booked stipulation actually needs owned hardware; see gearFamilyId and
   * sim/gearFailure.ts.
   */
  | 'equipmentFailure';

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
  // A spot that went wrong. Its own kind rather than an ugly 'signature',
  // because the write-up and the incident system both need to tell the
  // difference between a move and a mistake. See sim/ringcraft.ts.
  | 'botch'
  // The entrance pyro caught somebody. Its own kind for the same reason
  // 'botch' is — the write-up needs to be able to tell "a spot went wrong"
  // from "the production gear went wrong". See sim/pyro.ts.
  | 'pyroBurn'
  // The match hardware itself gave out — a ladder, a cage, a table. Its own
  // kind for the same reason 'pyroBurn' is. See sim/gearFailure.ts.
  | 'gearFailure'
  // Battle royal only: one specific wrestler going over the top, put there by
  // another specific wrestler. Its own kind rather than reusing 'control' —
  // it carries real actor/target identity a plain control beat doesn't. See
  // sim/battleRoyal.ts.
  | 'elimination'
  | 'finish';

export interface MatchBeat {
  kind: MatchBeatKind;
  text: string;
  significant: boolean; // only significant beats render in the highlight, §11.5
  /**
   * Who did this, and who it was done to — real wrestler ids, not a guess.
   * Absent (or null) for a beat with no clean single actor/target (an
   * interference beat today, for instance — see docs/BACKLOG.md for what's
   * deliberately not covered yet). Consumers that need to reconstruct a
   * pose (see ui/screens/MatchViewerScreen.tsx) should treat a missing id as
   * "not decided," not "nobody."
   */
  actorId?: Id | null;
  targetId?: Id | null;
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
  /**
   * Everybody hurt in this match, with the sentence explaining how — see
   * CLAUDE.md: nothing happens to a person off-screen. Includes referees and
   * managers, who are not on the roster but are in the same fight.
   */
  injuries: { wrestlerId: Id; name: string; role: string; text: string; outFor: string }[];
  /**
   * What the official missed. Same rule as injuries: if a poor referee
   * changed the night, the night says so.
   */
  refereeMisses?: RefereeMissRecord[];
  /** Who counted this one, so the card can print a name beside every match. */
  officialName?: string | null;
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
  /**
   * The live call, two voices, for the player's own card only. Typed
   * structurally because types.ts has no imports by design — the real shape
   * is CommentaryLine in sim/commentary.ts. Absent on rival shows, which
   * still get the written highlight.
   */
  commentary?: { speaker: 'play' | 'colour'; name: string; text: string }[];
}

// ============================================================================
// §3 — Show / Segment
// ============================================================================

export type ShowType = 'tvTaping' | 'ppv' | 'houseShow' | 'charity';

export interface SegmentRole {
  wrestlerId: Id;
  side: number; // 0, 1, 2... for teams; -1 for non-competitors
  role: 'competitor' | 'manager' | 'referee' | 'lumberjack';
}

export interface Segment {
  slot: number; // 0 = opener ... last = main event
  /** Managers at ringside, by side. */
  managerIds?: { managerId: Id; forSide: number }[];
  /** Assigned official from the referee pool. */
  refereeId?: Id | null;
  /** A wrestler in the shirt instead. Replaces refereeId when set. */
  guestRefereeId?: Id | null;
  /**
   * 'interview' and 'angle' were declared with the segment type and never
   * checked anywhere; 'confrontation' is the one that got built. See
   * sim/confrontation.ts.
   */
  kind: 'match' | 'promo' | 'interview' | 'angle' | 'confrontation';
  /** Which confrontation, where, and who is in it. Set on 'confrontation'. */
  confrontationId?: Id | null;
  confrontationVenue?: 'ring' | 'backstage';
  /** The person opposite the speaker. Both of them talk. */
  confrontationOppositeId?: Id | null;
  /** The partner who takes the shot, or the person being fought over. */
  confrontationThirdId?: Id | null;
  /** How it went. Set when the show resolves. */
  confrontationResult?: {
    quality: number;
    text: string;
    twistLabel: string;
    wonByName: string | null;
  } | null;
  subjectId?: Id; // for interviews: who is being elevated
  /** What a promo slot is about. See data/promoTopics.ts. */
  promoTopicId?: string | null;
  /** Who is talking, and who they are talking about. */
  promoSpeakerId?: Id | null;
  promoTargetId?: Id | null;
  /** A manager doing the talking for them. The promo rates off *their* mic work. */
  promoMouthpieceId?: Id | null;
  /** How it went. Set when the show resolves. */
  promoResult?: { quality: number; text: string } | null;
  participants: SegmentRole[];
  rules: MatchRules;
  stipulation: Id | null;
  titleIds: Id[];
  deckStacking: DeckStacking;
  result: SegmentResult | null;
  /**
   * A match that never aired — see engine/sim/darkMatch.ts. Undefined (not
   * false) on every ordinary segment, so a schema dump or an old save reads
   * unambiguously as "broadcast" without needing a migration.
   */
  dark?: boolean;
  /**
   * Which owned match-prop units (ladders, a cage, tables) are assigned to
   * this segment tonight — see data/matchProps.ts and
   * engine/economy/matchProps.ts. Undefined/empty means none chosen, which
   * is what a hardware-sensitive stipulation booked with nothing assigned
   * looks like: no physical prop to break, so no equipment-failure risk.
   */
  gearUnitIds?: Id[];
}

/** What a town made of what it was charged. See economy/showBudget.ts. */
export type PriceReaction = 'giveaway' | 'bargain' | 'fair' | 'steep' | 'gouge';

export interface Show {
  id: Id;
  promotionId: Id;
  week: number; // absolute week index since game start
  type: ShowType;
  /** The signature event this was, when it was one. Null for television. */
  name?: string | null;
  territoryId: Id;
  segments: Segment[]; // 6 for TV, 10 for PPV, 4 for house/charity
  attendance: number;
  ticketPrice: number;
  gate: number;
  payroll: number;
  showRating: number; // 0-100 internal
  showStars: number; // 0.5-5.0 displayed
  /** Pay-per-view buys, and what they were worth. Zero on television. */
  buys?: number;
  buyRevenue?: number;
  broadcast: boolean;
  /**
   * Who did not make the building, and who the office sent out instead.
   * Reported on the results page — a wrestler cannot vanish off a card
   * without a sentence saying why.
   */
  standIns?: { absentName: string; replacementName: string; reason: string }[];
  /** Where it was staged, and what the staging cost and returned. */
  venueId: Id;
  venueCapacity: number;
  merch: number;
  otherRevenue: number;
  showCosts: number;
  /**
   * What the town made of what it was charged. Optional because it is a
   * player decision: rival promotions do not model a ticket price, so their
   * shows genuinely have no reaction rather than a defaulted one.
   */
  priceReaction?: PriceReaction;
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
  /**
   * Set on both halves of a billionaire merger (engine/world/merger.ts) — a
   * shared value identifying the pair. Absent for everybody else, including
   * the player, who can never be bought.
   */
  conglomerateId?: Id | null;
  styleProfile: StyleProfile;
  bookingCredibility: number; // 0-100, §13
  reputation: number; // 0-100, §19
  /** §11.4 weapons model: 0-100, accrues with booked violence and decays weekly. */
  hardcoreSaturation: number;
  /**
   * What this crowd has actually come to want, by wrestling style — 0-100
   * each, 50 neutral. Starts leaning toward the declared identity
   * (data/promotionIdentity.ts) and drifts weekly toward whatever the card
   * actually ran. See engine/world/fanTaste.ts.
   */
  fanTaste: Record<WrestlingStyle, number>;
  /**
   * Running average of recent show ratings, 0-100. The main driver of how
   * many people turn up next week — put on shows and they come back.
   */
  recentShowQuality: number;
  /** Consecutive weeks under water. Past the grace period, they close. */
  weeksInTheRed: number;
  /**
   * Real, carried debt from show costs that blew past §14's expense cap in a
   * previous week — see economy/payroll.ts's computeShowExpenseSplit. The
   * overflow used to be computed and thrown away, so a promotion that rented
   * a room too big for its draw paid the capped share and the rest simply
   * vanished — the one place the venue ladder's own "rent is a bet" design
   * had no teeth. It is folded back into next week's own show-cost total
   * before the cap is applied again, so it either gets paid down as room
   * opens up under the cap or keeps growing if the overspending continues.
   * Optional/old-save-safe, same pattern as paperworkFrozen — player-only,
   * rivals use a separate simplified economy.
   */
  deferredShowDebt?: number;
  /** Set when the company closes. A closed company runs no shows. */
  closedWeek: number | null;
  /**
   * Who calls this company's matches. Drawn once at world creation and kept,
   * because a promotion whose announcers changed every week would not sound
   * like a promotion. Structural for the same no-imports reason as above;
   * see sim/commentary.ts CommentaryTeam.
   */
  commentaryTeam?: { playByPlayName: string; colourName: string; leaning: 'heel' | 'face' | 'analyst' } | null;
  ownerId: Id; // a Wrestler record with role 'owner'
  /** What the person signing the cheques is like. Biases what they demand. */
  ownerPersonality: OwnerPersonality;
  /** A real uploaded photo of the owner. Absent for almost everyone — see ui/paperdoll/README.md's philosophy. */
  ownerPhotoDataUrl?: string;
  /** A real uploaded promotion logo. Absent means PromotionMark falls back to the generated badge. */
  logoDataUrl?: string;
  /**
   * The men this company killed. Kept because the business keeps it: it
   * prices the roster and the free-agent market for two years afterwards.
   * See career/onOurWatch.ts.
   */
  deathsOnOurWatch?: DeathOnOurWatch[];
  /** The signature events this promotion runs, in the order they come round. */
  ppvCalendar: string[];
  /**
   * What they run and how often — the named shows, the nights they run on,
   * and how often the big one comes round. See engine/world/schedule.ts.
   *
   * Optional on the type so a promotion built before this existed still reads;
   * everything that consumes it goes through `scheduleOf`, which supplies the
   * standard pattern when one is missing.
   */
  schedule?: PromotionSchedule;
}

/** What the sky does in a town. See data/seasons.ts. */
export type Climate = 'northern' | 'coastal' | 'plains' | 'desert' | 'mountain' | 'temperate';

/** The four seasons of a 52-week year. */
export type Season = 'winter' | 'spring' | 'summer' | 'autumn';

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
  /** What the sky does here. Gates which weather this town can get. */
  climate: Climate;
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
  /**
   * How many of that opening roster arrive already signed, for the player
   * specifically. Unset everywhere except backyard, which sets it well
   * below startingRosterSize: a promotion that cannot pay for a roster
   * should not be handed one — see state/world.ts's two roster-generation
   * paths and engine/world/freeAgents.ts's generateFreeAgentPool, which
   * still exists at its full size and is where the rest of the cast lives,
   * cheap and hireable, from turn one. Rivals are unaffected — they size
   * off rivalRosterSize(), not this field.
   */
  startingPlayerRosterSize?: number;
  targetRosterSize: number;
  freeAgentPoolSize: number;
  talentQualityCurve: number; // -2..+2
  starDensity: number; // 0-1
  womensDivision: WomensDivisionMode;
  /** Chance any weather at all is worth reporting on a given show. */
  weatherChancePerShow: number;
  /** Relative likelihood of each severity tier, before chaos bends the top. */
  weatherSeverityWeights: Record<'flavour' | 'minor' | 'notable' | 'severe' | 'catastrophe', number>;
  /** Multiplier on the dangerous tiers at chaosLevel 0. */
  weatherChaosDamping: number;
  /** ...and how much each level of chaos adds to it. */
  weatherChaosPerLevel: number;
  /** Share of the show's committed costs you still pay when it is called off. */
  cancelledShowCostShare: number;
  /** What a tribute show draws. */
  memoriamDrawBonus: number;

  // The call on bad weather. See engine/world/weatherCall.ts.
  /** Share of severe forecasts that come in as the confident kind. */
  forecastLikelyShare: number;
  /** ...and how often each kind is right. Never shown as a number. */
  forecastLikelyHitChance: number;
  forecastEvenHitChance: number;
  /** What you still owe on a show you called off yourself. */
  calledOffCostShare: number;
  /** Following lost for calling off a show the weather justified. */
  calledOffFollowing: number;
  /** ...and for calling off one it did not. */
  calledOffWronglyFollowing: number;
  /** Running into it and being right there with them is worth something. */
  ranThroughItFollowing: number;
  ranThroughItInjuryRisk: number;
  ranThroughItWear: number;
  /** What the house does when the storm turns and you ran anyway. */
  stormMissedDraw: number;
  /** Moving at a day's notice: a smaller room, a worse house, a bill. */
  movedShowDraw: number;
  movedShowScrambleCost: number;
  movedShowFollowing: number;
  /** Longest layoff from getting hurt travelling to a show, not in it. */
  weatherInjuryMaxWeeks: number;
  /** Target share of a generated roster that is women. */
  womensRosterShare: number;
  /** ...and the fewest a company will ever be built with. */
  womensDivisionFloor: number;
  /** One tag team per this many wrestlers. */
  wrestlersPerTagTeam: number;
  tagTeamsMin: number;
  tagTeamsMax: number;
  agingEnabled: boolean;
  deathsEnabled: boolean;
  retirementEnabled: boolean;
  regenerateTalent: boolean;

  // Contracts
  contractLengthMin: number;
  contractLengthMax: number;
  /** Where an ordinary wrestler sits between the shortest and longest deal. */
  contractWantBase: number;
  contractYouthAge: number;
  contractYouthWant: number;
  contractWantLostPerVeteranYear: number;
  contractComebackWant: number;
  contractLeverageNeutral: number;
  contractLeverageSwing: number;
  contractWantSpread: number;
  contractLengthDefault: number;
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
  /**
   * The two biggest single terms in computeMatchRating, and deliberately
   * sized against each other rather than picked in isolation: how much of a
   * match's rating comes from who the crowd already knows it is (fame) versus
   * what actually happens in the ring (skill, sold through carrying and
   * pacing). Popularity used to outweigh workrate outright (42 vs 24), which
   * meant an opener stacked with genuinely great, not-yet-over talent was
   * capped low by fame alone — a technically flawless lower-card match could
   * not out-rate a mediocre main event, whatever it did. Roughly swapped so
   * the two terms are co-equal at the top of the scale, which barely moves a
   * match where fame and skill already track together (most established
   * main eventers) and moves a great deal for one where they do not (a future
   * star nobody has gotten behind yet). See sim/matchRating.ts.
   */
  matchRatingPopularityWeight: number;
  matchRatingWorkrateWeight: number;
  segmentsPerTV: number;
  segmentsPerPPV: number;
  /**
   * Which data/cardSize.ts tier a new promotion opens on — an actual card
   * size, read through data/cardSize.ts's CardSizeTier.slots, in place of
   * segmentsPerTV for a television show (PPV size is untouched by this
   * ladder). Unset for every preset except backyard, which opens on the
   * bottom tier; every other preset keeps segmentsPerTV's current value by
   * opening on the tier whose slots equal it. See state/world.ts's
   * cardSizeFor.
   */
  startingCardSizeTierId?: Id;
  broadcastWindowTV: number;
  broadcastWindowPPV: number;
  ratingLadderStepPerWeek: number;
  /** How much slower the rating falls than it climbs. */
  ratingLadderFallMultiplier: number;
  /**
   * Share of the gap between current rating and target charged as an
   * additional fall, on top of (not stacked with — the larger wins) the flat
   * `ratingLadderFallMultiplier` fall. Lets a small, ordinary gap keep
   * correcting at roughly the old flat rate while a huge, sustained one (a
   * company coasting on a stale reputation through a real, prolonged
   * disaster) actually closes. See stepCompanyRatingTowardTarget.
   */
  ratingLadderFallProportional: number;
  /** Show stars -> target company rating, interpolated between anchors. */
  ratingLadderAnchors: [stars: number, target: number][];
  defaultMatchLength: number;
  houseShowsEnabled: boolean;
  tournamentsEnabled: boolean;
  promoSlotsPerCard: number;
  /** Optional matches that never air — see engine/sim/darkMatch.ts. */
  darkMatchSlots: number;
  /**
   * How much of the ordinary popularity swing from a match actually carries
   * when nobody outside the building saw it. Locker-room word of mouth and a
   * little, not a television audience's worth.
   */
  darkMatchPopularityShare: number;
  /** Merch per attendee per dark match run — sized against merchSpendPerHead. */
  darkMatchMerchPerHead: number;
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
  /** Backstage heat below which there is nothing worth running as an angle. */
  shootHeatWorthRunning: number;

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
  /** Share of asking price lost for each year past prime. */
  leverageLostPerYearPastPrime: number;
  /** What coming out of retirement does to a negotiating position. */
  comebackLeverage: number;
  /** How steeply still being able to work buys leverage back. */
  leverageCraftCurve: number;
  /** Nobody ever works for nothing. */
  leverageFloor: number;
  /** The in-ring level the business calls elite. */
  leverageEliteCraft: number;

  /** Entries before a body is described as a long history rather than listed. */
  /** What to assume about a wrestler with no self-preservation set. */
  /** Weeks out below which no injury call is raised. */
  injuryCallMinWeeks: number;
  /** How far out an unhappy wrestler says he is not re-signing. */
  noticeWeeks: number;
  noticeMoraleUnder: number;
  noticeLoyaltyWeight: number;
  noticeThreshold: number;
  /**
   * Weeks of contract left at which the renewal-window conversation opens —
   * a real, booker-initiated question, not an automatic demand at expiry.
   * Deliberately separate from noticeWeeks above: that is the wrestler's own
   * early warning that he is walking regardless; this is the booker's
   * chance to ask first. See World.renewalTalks and answerRenewalInterest.
   */
  renewalWindowWeeks: number;
  selfPreservationDefault: number;
  bodyLongHistoryCount: number;
  /** How much each past injury teaches somebody caution. */
  bodyHistoryTeachesCaution: number;
  /** How much a big opinion of oneself overrides good sense. */
  bodyEgoRecklessness: number;
  /** Share of the reckless who go the whole way and work through it. */
  bodyWorkThroughChance: number;
  /** Odds it goes wrong, coming back early and working through respectively. */
  bodyEarlyReturnBackfire: number;
  bodyWorkThroughBackfire: number;
  /** Share of the doctor's weeks actually taken on each path. */
  bodyEarlyWeeks: number;
  bodyWorkThroughWeeks: number;
  /** Multiplier on the weeks out when it does go wrong. */
  bodyBackfireWeeks: number;
  /** Permanent health cost of each ending. */
  bodyWorkThroughToll: number;
  bodyWorseToll: number;
  bodyCareerEndingToll: number;
  /** Odds a backfire ends a career, and odds the very worst night kills. */
  bodyCareerEndingChance: number;
  bodyDeathChance: number;
  /** How much longer the same injury takes past prime, per year. */
  /** How long the business holds a death on your show against you. */
  watchMemoryWeeks: number;
  /** The blanket morale hit across the whole roster when you cause one. */
  watchRoomMoraleCost: number;
  /** Most a free agent adds to his price to work for a company that killed somebody. */
  watchAskingPremiumMax: number;
  /** How careful a man has to be before he stops taking your calls entirely. */
  watchRefusalCare: number;
  /** Mandatory paid weeks off for anybody who was in the ring when it happened. */
  watchLeaveWeeks: number;
  /** Violence level at which a match is asking everything of the man working it. */
  watchViolenceForFullRisk: number;
  /** Disciplinary priors at which a man's file is fully against him. */
  watchPriorsForFullBlame: number;
  watchNegligenceFromDepth: number;
  watchNegligenceFromPriors: number;
  watchNegligenceFromCarelessness: number;
  /** What the office still carries when the room blames somebody else. */
  watchOfficeShareWhenBlamed: number;
  /** How long nobody will get in the ring with the man they blame. */
  watchShunWeeks: number;
  /** Weekly morale drag on everybody else while he is still on the books. */
  moraleBlamedInTheRoom: number;
  /** How long an unanswered release request keeps costing before he gives up. */
  releaseRequestPatienceWeeks: number;
  doctorAgePerYear: number;
  doctorConditionWeight: number;
  /** What moves somebody from wanting cash to wanting cover. */
  appetiteHistoryWeight: number;
  appetiteBadInjuryWeight: number;
  appetiteInsuranceAt: number;
  appetiteCashAt: number;
  appetiteCashEgoAt: number;
  /** How much longer a deal a frightened body wants. */
  securityPerInjury: number;
  securityPerBadInjury: number;
  securityFromCaution: number;
  securityMax: number;
  leverageStrongAt: number;
  leverageFairAt: number;
  leverageWeakAt: number;
  legendYearsPro: number;
  legendPeakPopularity: number;
  prospectTalent: number;
  enhancementPopularity: number;
  gatekeeperPopularity: number;
  upperCardPopularity: number;
  mainEventPopularity: number;
  /** Popularity fallen below career peak that marks someone a fallen star. */
  fallenStarDrop: number;

  // The read on a wrestler — career/scouting.ts. Thresholds for the one-line
  // pitch and catch shown wherever somebody is picked.
  scoutExhaustedFatigue: number;
  scoutWornDownHealth: number;
  scoutUnhappyMorale: number;
  scoutHotMomentum: number;
  scoutColdMomentum: number;
  scoutDrawPopularity: number;
  scoutKnownPopularity: number;
  scoutEliteCraft: number;
  scoutStrongCraft: number;
  scoutBigEgo: number;
  scoutBadAttitude: number;
  scoutOldAge: number;
  scoutProspectAge: number;

  // TV ratings (engine/world/tvRatings.ts)
  tvRatingBase: number;
  tvRatingCeiling: number;
  /** How much of a promotion's draw is tonight's show vs. its reputation, 0-1. */
  tvShowQualityWeight: number;

  // Rivals approaching your talent once a deal has run out (engine/world/poaching.ts)
  approachBaseChance: number;
  approachOfferPremiumMin: number;
  approachOfferPremiumRange: number;
  approachMoneyWeight: number;
  approachMoraleWeight: number;
  approachMomentumWeight: number;
  approachContractLengthResistance: number;
  approachAttitudeResistance: number;

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

  // Catastrophes (engine/world/catastrophe.ts) — weather/disaster calls and
  // no-shows, rolled once across the whole business and landed on a random
  // promotion (player or any rival), not the player every time.
  /** Chance, per week, that something catastrophic hits somebody's show at all. */
  catastropheWeeklyChance: number;
  /** Rating hit applied to a rival's own show the catastrophe lands on. */
  catastropheRivalRatingDip: number;
  /** Popularity a rival's free-agent signing needs to be worth a reaction (engine/world/rivalMove.ts). */
  rivalMoveReactionPopularity: number;
  /** Chance, per rival per week, that they launch a whole new championship. */
  rivalNewTitleWeeklyChance: number;

  // A nostalgic owner's pull toward a faded former star when picking who to
  // sign off the free-agent pool — see engine/world/nostalgia.ts.
  nostalgicBaseWeight: number;
  nostalgicCareerHighWeight: number;
  nostalgicDeclineWeight: number;
  nostalgicAgeWeight: number;
  nostalgicAgeFloor: number;

  // Contracts (engine/economy/contracts.ts)
  contractBaseWeeklyRate: number;
  contractRateRange: number;
  /** Exponent on value. >1 makes stars cost multiples of a midcarder. */
  contractRateCurve: number;
  /** Share of the asking price paid as a retainer, at zero popularity. */
  retainerShareBase: number;
  /** How much more of it a genuine draw gets guaranteed. */
  retainerShareRange: number;
  contractDrawWeight: number;
  contractCraftWeight: number;
  /** A renewal never comes in below this multiple of the current rate. */
  contractRenewalFloor: number;
  /** Weeks of wages you must be able to cover before a signing is affordable. */
  contractAffordabilityWeeks: number;
  /**
   * Weeks a negotiated release or a booker-initiated firing keeps somebody
   * off everybody's roster, including the promotion that let them go.
   * Ninety days, in a game that runs in weeks. Plain expiry carries none of
   * it — see economy/termination.ts's exitTerms.
   */
  noCompeteWeeks: number;
  /**
   * Ego at which somebody starts asking for guarantees, and at which they
   * demand the whole deal.
   *
   * Keyed to ego rather than to career status on purpose: status labels like
   * 'draw' are vanishingly rare (two people in a world of four hundred), so
   * guarantees keyed to them never happened at all. Ego is the thing the
   * player moves by pushing somebody — which makes guaranteed money the
   * price of having built a star, exactly like the rest of the clause ladder.
   */
  egoGuaranteedPartial: number;
  egoGuaranteedHalf: number;
  egoGuaranteedFull: number;
  guaranteedPctPartial: number;

  // Trades — engine/world/trades.ts.
  /**
   * How much better an incoming package has to be before a rival says yes.
   * Above 1 because nobody trades at par: the other side has to win.
   */
  tradeAcceptanceMargin: number;
  /** How heavily a wage commitment counts against what somebody is worth. */
  tradeContractBurdenWeight: number;
  /** Curve on popularity, so a genuine draw is worth several midcarders. */
  tradeValueCurve: number;
  tradeValueScale: number;
  /** Weeks a rival will not revisit a trade they just turned down. */
  tradeCooldownWeeks: number;
  /** Morale a wrestler loses for being moved on. */
  tradeMoraleCost: number;
  /** How much of a wage a rival will take on, as a share of what they clear. */
  tradeAffordabilityShare: number;
  /** Weekly chance an unhappy wrestler asks to be let go. */
  releaseRequestChance: number;
  /** Morale at or below which somebody starts thinking about asking out. */
  releaseRequestMorale: number;
  /** Refusing a release request costs this much morale, every week they sit. */
  releaseRefusedMoraleCost: number;

  // Show production economics (engine/economy/showBudget.ts)
  travelCostPerHead: number;
  crewCostBase: number;
  crewCostPerSeat: number;
  ticketFairPriceBase: number;
  ticketFairPriceRange: number;
  ticketUnderpriceBonus: number;
  ticketOverpricePenalty: number;
  /** How far over fair a price can go before the town takes it personally. */
  priceGougeForgiveness: number;
  /** Following burned per unit of gouge past the forgiveness band. */
  priceGougeGoodwillPenalty: number;
  /** Following earned for genuinely undercharging. Small — deals are cheap. */
  priceBargainGoodwillBonus: number;
  /** At or under this multiple of fair, the town knows it got in for nothing. */
  priceGiveawayRatio: number;
  /** Past this multiple of fair, "steep" becomes "a liberty". */
  priceGougeRatio: number;
  merchSpendPerHead: number;
  /** The regulars a town keeps however bad you get. A floor, not a bonus. */
  audienceLoyalCore: number;
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

  // Wear and tear on literal match hardware — ladders, cages, tables
  // (engine/economy/matchProps.ts). Same shape as the asset settings above,
  // applied per-unit instead of per-owned-type.
  /** At or below this condition a prop unit cannot be used at all. */
  propFailureThreshold: number;
  propRepairCostFraction: number;
  /** The one tunable the whole per-unit break-odds formula is built from — everything else is tier data or unit state. */
  propBreakChanceAtWorst: number;
  /** Converts a 0-1 aggregate break chance into a rollFinish weight comparable to a clean pin's. */
  equipmentFailureWeightScale: number;
  gearUnitsSpectacleBonusPerExtra: number;
  gearUnitsSpectacleBonusCurve: number;
  /** Rating points a maximum-prestige building adds to the show. */
  venuePrestigeRatingWeight: number;
  /** Fill ratio at or above which the building reads as full. */
  venueFullThreshold: number;
  venueFullBonus: number;
  venueEmptyPenalty: number;
  /** The room's own character, scaled into show-rating points. */
  venueAtmosphereWeight: number;
  /** Thresholds where the venue's facilities list changes its wording. */
  venueHeavyCut: number;
  venueGoodBar: number;
  venuePoorBar: number;
  venueGreatRoom: number;
  venuePoorRoom: number;
  venueHardLoadIn: number;
  /** How much harder weather bites with no roof over the crowd. */
  openAirWeatherMultiplier: number;
  /** The floor on an outdoor draw. Somebody always turns up. */
  openAirWorstDraw: number;

  /** How far a gimmick's merch pull swings a stall keyed to it. */
  standGimmickWeight: number;
  standWorstFit: number;
  standBestFit: number;
  standPrestigeSwing: number;
  /** Where a stand's break-even verdict changes wording, as a share of the room. */
  standEasySell: number;
  standFairSell: number;

  residencyShortWeeks: number;
  residencyLongWeeks: number;
  residencyShortDiscount: number;
  residencyLongDiscount: number;
  /** Weeks of rent the landlord wants before the first bell. */
  residencyDepositWeeks: number;
  /** How much of the town's appetite each show in the same room uses up. */
  residencySaturationPerShow: number;
  residencyWorstDraw: number;
  /** Share of the remaining term owed for walking away early. */
  residencyBreakShare: number;
  /**
   * How much a night in a residency counts towards getting anybody over.
   * Under one: the same crowd every week, and nobody else watching.
   */
  residencyExposure: number;
  /** What a small-town room is worth as an address. */
  residencyPrestige: number;
  /** Share of the touring office a resident company still pays for. */
  residencyOverheadShare: number;
  /** The bar is yours in these rooms. */
  residencyConcessionsPerHead: number;

  // Answering a rival's offer (engine/world/poaching.ts)
  /** Weeks an approach stays open before it resolves on its own. */
  poachOfferWeeks: number;
  poachResponseMoneyEffect: number;
  poachResponseMoneyRaise: number;
  poachResponsePushEffect: number;
  /** Weeks an offer sits open before it resolves. */
  poachOfferWeeksToRespond: number;

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
  /** Asks reserved for the appetite before neutral clauses fill the rest. */
  egoAppetiteAsks: number;
  egoMaxClauseAsks: number;
  egoWalkRiskMax: number;
  egoRosterFrictionMax: number;

  // Ongoing cost of agreed clauses
  /** Weeks to make good on a promised title run before they start souring. */
  clauseTitlePushWeeks: number;
  clauseTitlePushMoraleDrain: number;
  /** Weeks the wire keeps mentioning a title promise that has come due. */
  clauseTitlePushNoticeWeeks: number;
  /** What a loss costs somebody who was promised they would not take one. */
  clauseNoJobbingMoraleHit: number;
  clauseInsuranceRate: number;
  clauseTravelCost: number;
  clauseGuaranteedDatesRate: number;
  /**
   * Share of the night's merchandise owed to one wrestler with the clause.
   *
   * Deliberately steep: the clause sits high on the ego ladder, it is offered
   * as "a slice off the top of every shirt sold", and a slice that rounds to
   * nothing is not a cost.
   */
  clauseMerchandiseCut: number;

  // How the room feels about the booker — see career/morale.ts.
  /** Band thresholds for the mood face. Descending. */
  moodDelightedAbove: number;
  moodHappyAbove: number;
  moodContentAbove: number;
  moodRestlessAbove: number;
  moodUnhappyAbove: number;
  /** How much standing and ego each raise what somebody expects of a booking. */
  moraleExpectationStanding: number;
  moraleExpectationEgo: number;
  /** How hard card position pulls, against what they expected. */
  moralePositionWeight: number;
  /** The main event is always worth something, whoever you are. */
  moraleMainEventFloor: number;
  moraleWinGain: number;
  /** An ordinary loss. Small — losing is the job. */
  moraleRoutineLoss: number;
  /** How far below them the winner has to be before a loss is an insult. */
  moraleBadLossGap: number;
  moraleBadLossWeight: number;
  /**
   * Weeks off the card that cost nothing. A roster is always bigger than a
   * card; without this, depth itself would rot a locker room.
   */
  // --- who somebody is, and what they want out of a week ---
  /**
   * Ceiling on how far a trait can multiply one morale term. Two traits that
   * both care about the spotlight compound, and without a cap a rare pairing
   * would produce somebody the booking cannot move at all.
   */
  traitLeverCap: number;
  /** What the same idle weeks are worth to somebody who wanted the rest. */
  traitRestRelief: number;
  /**
   * Bounds on the shifted set point. A pairing of two gloomy traits at a
   * failing company must still leave somewhere above zero to settle toward,
   * and the happiest possible person at the best company is not immune to
   * being badly booked.
   */
  // --- ring intelligence and the locker room's opinion (sim/ringcraft.ts) ---
  /** Ring IQ below which somebody cannot carry anybody. Most of a roster. */
  carryRingIQFloor: number;
  /** Most of the gap a great worker can close on a poor opponent. */
  carryMax: number;
  /** How much lift before the write-up says somebody carried it. */
  carryWorthSaying: number;
  /** How much being worn down and being unfit add to botch risk. */
  botchFromCondition: number;
  botchFromStamina: number;
  /** A match of this length is the baseline; longer raises the odds. */
  botchReferenceMinutes: number;
  botchPerRiskPoint: number;
  botchMaxChance: number;
  /** Share of botches that hurt somebody. rules.ts still owns the injury. */
  botchInjuryShare: number;
  botchRatingCost: number;
  botchBadOneMultiplier: number;
  /** How much a botch that hurt somebody raises the injury roll. */
  botchInjuryMultiplier: number;
  // --- the entrance pyro (sim/pyro.ts) ---
  /** Base chance a fired-up show's pyro catches somebody, before equipment safety. */
  pyroBurnChance: number;
  /** Share of pyro burns that leave a real mark rather than just a scare. */
  pyroBurnInjuryShare: number;
  pyroBurnRatingCost: number;
  /** How much a pyro burn that left a mark raises the injury roll. */
  pyroBurnInjuryMultiplier: number;
  // --- the broadcast (sim/broadcast.ts) ---
  /** Base chance, once per show, the feed drops during one match, before equipment safety. */
  broadcastDropoutChance: number;
  /** Where the words for ring IQ change. */
  ringcraftGeneralAt: number;
  ringcraftSafeAt: number;
  ringcraftGreenAt: number;
  /** Where the words for how the room feels about somebody change. */
  likedBelovedAt: number;
  likedFineAt: number;
  likedAwkwardAt: number;
  // --- the weeks nobody is booked for (career/assignment.ts) ---
  /** At or below this condition the office sends somebody home regardless. */
  assignmentRestBelowHealth: number;
  /** Below this ring IQ the office puts somebody in the ring rather than the gym. */
  assignmentRingBelowIQ: number;
  /** Under this standing the office sends somebody out to be seen instead. */
  assignmentAppearancesBelowPop: number;
  /** ...but never a worn-out act. Spending one that is already spent is waste. */
  assignmentAppearancesNeedFreshness: number;
  /** Age at which improvement is fastest, and the age it has stopped. */
  assignmentAgePeak: number;
  assignmentAgeNoGain: number;
  /** Weekly movement per assignment, before talent, age and headroom. */
  assignmentGymGain: number;
  assignmentGymEnergyCost: number;
  assignmentRingGain: number;
  /** How much of a ring week also lands on workrate. */
  assignmentRingSkillShare: number;
  assignmentRingEnergyCost: number;
  assignmentAppearanceDraw: number;
  assignmentAppearanceFreshnessCost: number;
  assignmentAppearanceEnergyCost: number;
  assignmentAppearanceFee: number;
  assignmentRestHealth: number;
  assignmentRestEnergy: number;
  assignmentRestMorale: number;
  /** Extra for the two people a week at home is genuinely aimed at. */
  assignmentRestWantedBonus: number;
  assignmentRestGlassBonus: number;
  /**
   * The other half of the gym: a physical stat left untrained doesn't just
   * stand still. Out on appearances, or resting when nothing was actually
   * wrong, costs strength/agility/stamina instead of building them — see
   * `declineRate` in career/assignment.ts. Ramps from 0 at `assignmentAgePeak`
   * (a young body barely notices a week off) to full at this age (an old one
   * does), mirroring the growth curve rather than sharing it — a twenty-year
   * gap because growth stopping and decline starting are not the same event.
   */
  assignmentAgeDeclineMax: number;
  /** Weekly loss per stat at full decline rate and full room to fall. */
  assignmentNeglectLoss: number;
  /** A neglected stat drifts toward this, never past it. Washed up, not zero. */
  physicalStatFloor: number;
  moraleSetPointFloor: number;
  moraleSetPointCeiling: number;
  /** Chance somebody is drawn with a second trait rather than one. */
  traitSecondChance: number;
  // --- career/motivation.ts: what they are actually chasing, separate from
  // traits and drawn off its own stream so this system could be added
  // without rerolling a single wrestler already generated ---
  /** Chance a second motivator is drawn on top of the first. */
  motivatorSecondChance: number;
  /** Chance of a third, only rolled once the second has already landed. */
  motivatorThirdChance: number;
  /** How close to their career-best popularity before Fame-motivated notices either way. */
  fameMotivatorNotices: number;
  fameMotivatorWeight: number;
  /** How far gimmick freshness has to move off 50 before Creative-motivated notices. */
  creativeMotivatorNotices: number;
  creativeMotivatorWeight: number;
  /** How big an opponent-popularity gap before Competition-motivated notices. */
  competitionMotivatorNotices: number;
  competitionMotivatorWeight: number;
  /** How far off the market rate before an In It For The Money notices. */
  traitPayGapNotices: number;
  traitPayGapWeight: number;
  traitPayGapMax: number;
  /** What being on the same shows as their partner is worth, and being apart. */
  traitTogetherGain: number;
  traitApartCost: number;
  /** Weeks straight on the road before Wants More Time Off starts saying so. */
  traitRestWantedAfter: number;
  traitRoadCostPerWeek: number;
  traitRoadCostMax: number;
  /** Trips to the doctor before Made Of Glass starts to wear on them. */
  traitGlassNoticesAfter: number;
  traitGlassCostEach: number;
  traitGlassCostMax: number;
  // --- traits reaching outside morale: contracts, poaching, retirement,
  // release requests (career/ego.ts, world/poaching.ts, career/retirement.ts,
  // economy/termination.ts) ---
  /** How much No Time For The Office's baseline dislike adds to temptation. */
  traitOfficeDislikePull: number;
  /** How much being where a `somebodyAtHome` partner works adds to temptation. */
  traitPartnerPull: number;
  /** How much not being a main eventer adds to Wants The Spotlight's temptation. */
  traitSpotlightPull: number;
  /** How badly underpaid, against market worth, before In It For The Money asks out regardless of morale. */
  traitBadlyUnderpaidGap: number;
  /** Threshold bump for a `somebodyAtHome` wrestler whose partner is elsewhere. */
  traitApartReleaseThreshold: number;
  /** Retirement pressure relief for Grateful For The Work, and the push for Wants More Time Off. */
  retirementLoveOfTheGameRelief: number;
  retirementRoadWearyPush: number;
  moraleIdleGraceWeeks: number;
  /**
   * People per segment, for working out how long a fair wait for a match is at
   * a company of a given size. Two is the smallest a match can be, which makes
   * the rotation estimate the longest it can honestly be. See idleGrace().
   */
  moraleSpotsPerSegment: number;
  /** Per week beyond the grace period, and the ceiling on that. */
  moraleIdlePerWeek: number;
  moraleIdleCap: number;
  /** What even a nobody feels about being left off, before expectation. */
  moraleIdleFloor: number;
  moraleChampionGain: number;
  /** Being the thing the crowd was asking for. See world/fanDemand.ts. */
  moraleDemandDelivered: number;
  /** How strongly the mood of the people they worked with rubs off. */
  moraleContagionWeight: number;
  moraleAllyGain: number;
  moraleEnemyCost: number;
  /** The show rating everybody is neutral about, and how much it swings. */
  moraleShowNeutral: number;
  moraleShowWeight: number;
  /** Where morale settles at a company rated 0, and how far the top adds. */
  moraleSetPointBase: number;
  moraleSetPointRange: number;
  /** Pull per week toward that set point. */
  moraleSettleRate: number;
  /** Below this the settle is real but not worth a sentence. */
  moraleSettleReportable: number;
  /** Nothing here should move somebody more than this in one week. */
  moraleWeeklyCap: number;
  /**
   * Nobody's morale is ever applied below this. A hard 0 read as broken
   * rather than as "as bad as it gets" — the number that is not supposed to
   * move again — and it let sustained neglect grind somebody into a literal
   * floor of the whole scale with no room left to worsen or recover into.
   * Below `moodUnhappyAbove` (18), so "miserable" still exists as a real
   * band above it — this is the bottom of miserable, not an escape from it.
   */
  moraleFloor: number;

  // The live call — see sim/commentary.ts.
  /** Off means the results screen is the written highlight and nothing else. */
  commentaryEnabled: boolean;
  /** Hard ceiling on a call. It has to tell the whole story inside this. */
  commentaryMaxLines: number;
  /** Odds the colour man says something after any given beat. */
  commentaryColourChance: number;
  /** Odds the play-by-play man answers a provocative line. */
  commentaryComebackChance: number;
  /** Odds of a last word after the bell. */
  commentaryBanterChance: number;
  /** Shoot heat at which the call treats it as a fight rather than a match. */
  commentaryGrudgeHeat: number;
  /** Match ratings at which the call may call it great, or call it poor. */
  commentaryGreatMatch: number;
  commentaryPoorMatch: number;
  /** Weeks with a belt before the reign itself is worth talking about. */
  commentaryLongReignWeeks: number;
  /** At or under this age the colour man is allowed to call somebody green. */
  commentaryRookieAge: number;
  /** Pounds between the heaviest and lightest before size is a story. */
  commentarySizeGapLbs: number;
  /** Share of the building filled, last time out, at which the room is hot or flat. */
  commentaryHotHouseShare: number;
  commentaryFlatHouseShare: number;
  /** Win probability at or below which the winner counts as an upset. */
  commentaryUpsetProbability: number;
  /** Deviousness at which a manager is worth accusing of something. */
  commentaryDeviousManager: number;
  /** Win/loss streak length before a run of form is worth remarking on. */
  commentaryStreakRun: number;
  commentarySlumpRun: number;
  /** Meetings before two people count as having a history. */
  commentaryMetOftenTimes: number;
  /** Match rating below which "they have never met" is not worth saying. */
  commentaryFirstMeetingRating: number;
  /** Weeks a feud has to have run before the announcers recap it. */
  commentaryLongFeudWeeks: number;
  /** Draw multiplier below which the weather visibly cost the house. */
  commentaryWeatherDrawHit: number;
  /** Years in the business before the number itself is worth saying out loud. */
  commentaryLongCareerYears: number;

  // Storylines — see world/storyline.ts.
  /** Investment at which an arc stops being new, and at which it is ready. */
  storylineBuildingInvestment: number;
  storylineBoilingInvestment: number;
  /** Consecutive empty weeks before a story is dead. */
  storylineFizzleWeeks: number;
  /** Weeks idle before the board says they are forgetting it. */
  storylineColdWeeks: number;
  /** Weeks a boiling story can sit before the wait starts costing it. */
  storylineStaleAfterWeeks: number;
  storylineStalePerWeek: number;
  /** How the blow-off multiplier is made up: story told, match on the night, floor. */
  storylineToldWeight: number;
  storylineNightWeight: number;
  storylineBlowoffFloor: number;
  /** Multipliers at which the write-up calls a blow-off great or merely fair. */
  storylineGreatBlowoff: number;
  storylineFairBlowoff: number;
  /** Rivalry heat at which the office suggests naming it. */
  storylineSuggestHeat: number;
  /** What a blow-off's quality is worth to the people in it and the company. */
  storylinePayoffPopularity: number;
  storylinePayoffMomentum: number;
  storylinePayoffCompanyRating: number;
  /** What a story fizzling costs the company. Small, and entirely deserved. */
  storylineFizzleRating: number;

  // Pair chemistry and shared history — see sim/pairChemistry.ts.
  /** The innate roll's centre and spread. Most pairings land near the centre; a real minority land clearly good or clearly bad. */
  chemistryMean: number;
  chemistrySpread: number;
  /** Bounds on the innate roll alone, before shared history is added. */
  chemistryFloor: number;
  chemistryCeiling: number;
  /** Bounds on the combined bonus the rating formula actually reads. */
  chemistryBonusFloor: number;
  chemistryBonusCeiling: number;
  /** Weeks after a blow-off before revisiting the pairing stops being "too soon." */
  rivalryRestWeeks: number;
  /** How hard a too-soon revival costs, before scaling by how many times it has already happened. */
  rivalryTooSoonPenalty: number;
  /** How much of a well-earned revival's spark comes from the best past blow-off's quality. */
  rivalrySparkWeight: number;
  /** How much smaller each additional revival's spark gets — the tenth reunion reads as fine, not special. */
  rivalrySparkFadePerRevival: number;
  /** Great blow-offs a pairing needs to be called an All-Time Rivalry. */
  allTimeRivalGreatBlowoffs: number;
  /** Fair-or-better blow-offs (short of an all-time run) that still earn Hall of Fame Classic Rivalry status. */
  classicRivalryFairBlowoffs: number;

  // Vignette packages — see career/vignette.ts. A signing-time gamble: pay
  // up front, keep a brand-new face off the card for a real stretch, and
  // either walk in already over or walk in to a shrug.
  /** How many real weeks the campaign runs before it pays off — or doesn't. */
  vignetteWeeks: number;
  /** What it costs the company, paid the day the campaign starts. */
  vignetteCost: number;
  /** Base chance the hype actually catches, before charisma is added in. */
  vignetteSuccessChance: number;
  /** How much of the wrestler's own charisma (0-100) gets added to that base chance. */
  vignetteCharismaBonus: number;
  /** What a caught campaign is worth to the wrestler, for good. A bust is worth nothing at all — not a punishment, just the gamble not paying off. */
  vignetteSuccessPopularity: number;
  vignetteSuccessMomentum: number;

  // The mini profile's status pips — see ui/components/MiniStats.tsx.
  /** Energy at or below which tonight's tank reads as empty. */
  miniTiredEnergy: number;
  /** Fatigue debt at or above which somebody is worn rather than merely tired. */
  miniWornFatigue: number;

  // Where somebody is over — see career/reach.ts.
  /** Share of a wrestler's draw in a town that is national reputation. */
  reachNationalShare: number;
  /** What a town that has never seen them makes of their national profile. */
  reachUnseenShare: number;
  /** The head start a hometown gives, before anybody has worked there. */
  reachHometownHead: number;
  /** Local standing a night's work moves, at floor and per point of quality. */
  reachGainBase: number;
  reachGainPerQuality: number;
  /** Above this, a town is saturated and further nights add little. */
  reachLocalCeiling: number;
  /** Working at home is worth more, because it is home. */
  reachHometownGainBonus: number;
  /** What a week without a date in a town costs there. */
  reachDecayPerWeek: number;
  /** Popularity at which somebody is a name everywhere regardless of touring. */
  reachNationalPopularity: number;
  /** Local standing at which a town genuinely knows who somebody is. */
  reachKnownHere: number;
  /** Towns like that before somebody counts as a regional draw. */
  reachRegionalTowns: number;

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

  // §16 cross-promotional supershows.
  supershowAppetiteBase: number;
  supershowAppetiteStandingWeight: number;
  supershowAppetiteReputationWeight: number;
  supershowAppetiteResentmentWeight: number;
  supershowHostileResentment: number;
  /** An even split of a joint card, from the visiting company's side. */
  grudgeFairShare: number;
  /** Most resentment a single one-sided night can earn. */
  grudgeBurialMax: number;
  /** Most goodwill a single generous night can earn back. */
  grudgeGenerosityMax: number;
  /** At or under this many stars, the night annoys everybody a little. */
  grudgeFlopStars: number;
  grudgeFlopWeight: number;
  /** The share above which the write-up calls it a burial. */
  grudgeMassacreShare: number;
  grudgeDecayPerWeek: number;
  /** How much resentment a revealed secret signing adds, per point of its reveal impact — see engine/world/secretSigning.ts's revealImpact. */
  grudgeSecretSigningPerImpact: number;
  // §16.5 invasions — a rival with a real grudge sends somebody through the
  // curtain on their own initiative. Deliberately gated well behind
  // supershows: this is the kind of thing a save should not see in its
  // first year, only once a rivalry has actually had time to sour.
  /** No invasion before the world — and the grudges in it — have had this long to develop. */
  invasionEarliestWeek: number;
  /** A rival needs at least this much resentment on the books before they'll send someone. */
  invasionGrudgeThreshold: number;
  invasionHeat: number;
  invasionMomentum: number;
  invasionPopularity: number;
  /** How much resentment an invasion burns off the triggering rival's grudge — getting their moment lets off steam. */
  invasionCatharsis: number;
  // The billionaire merger — a one-time, late-game escalation. An outside
  // buyer acquires the two strongest surviving rivals, keeps them running as
  // separate shows under a shared brand, and makes them meaningfully harder
  // for everybody left, not just the player. Never reverses, never repeats.
  /** No merger before the business itself has had this long to produce two worth buying. */
  mergerEarliestWeek: number;
  /** Rolled once a week once eligible. Rare on purpose — this should read as a real surprise. */
  mergerChancePerWeek: number;
  /** Needs this many living rivals — two to buy, plus at least one company left over besides the player. */
  mergerMinLivingRivals: number;
  /** Immediate rating bump to both halves, the billionaire's backing showing up on screen. */
  mergerRatingBoost: number;
  /** Flat cash injection to both halves. */
  mergerBankInjection: number;
  /** Added straight onto the resentment term a supershow proposal is judged against, for anybody who isn't their own sibling. */
  mergerCrossPromotionResistance: number;
  /** Relative weight against other world stories eligible the same week — see data/worldStories.ts. */
  mergerStoryWeight: number;

  // Succession — a rival's founder dies or steps back. Lighter and more
  // common than the merger; can happen to more than one rival across a long
  // save, tracked per-promotion rather than once ever.
  successionEarliestWeek: number;
  successionChancePerWeek: number;
  successionStoryWeight: number;
  successionRatingBoostSharp: number;
  successionReputationBoostSharp: number;
  successionRatingDropWeak: number;
  successionReputationDropWeak: number;
  /** A weak or contested heir sheds staff who were loyal to the old regime — see engine/world/ownershipShakeup.ts. */
  shakeupReleaseMin: number;
  shakeupReleaseMax: number;

  // The ring gives out — a pre-show risk, foreshadowed by how worn the ring
  // actually is, resolved the same shape as a severe-weather call: a
  // warning, a real decision, an uncertain outcome.
  /** Floor below which a worn ring can even raise the warning at all. */
  ringCallConditionFloor: number;
  ringCallLikelyShare: number;
  ringCallLikelyFailChance: number;
  ringCallEvenFailChance: number;
  /** "Play it safe": no contest, refunded. */
  ringCallSafeMoraleDelta: number;
  ringCallSafeMerchShare: number;
  /** "Go nuclear": finished on the bare floor. */
  ringCallNuclearInjuryMultiplier: number;
  ringCallNuclearRatingSwing: number;

  // The truck breaks down — a separate, blunter logistics failure (bad luck
  // on the road, nothing to do with wear) that raises the same shape of
  // decision as the ring call: play it safe, or hold the show anyway on the
  // bare arena floor. See engine/world/truckBreakdown.ts.
  /** Rolled fresh each week, independent of ring condition. */
  truckBreakdownChancePerWeek: number;
  /** "Call it off": no contest, refunded. */
  truckBreakdownCancelMoraleDelta: number;
  truckBreakdownCancelMerchShare: number;
  /** "Hold it on the arena floor": no ring at all, for real. */
  truckBreakdownInjuryMultiplier: number;
  truckBreakdownRatingSwing: number;

  // A rival's lawyers find real holes in a run of your wrestlers' contracts
  // and sign them away outright — see engine/world/contractRaid.ts. The raid
  // itself lands immediately; what's left open is how the office responds.
  contractRaidEarliestWeek: number;
  contractRaidChancePerWeek: number;
  /** Never fires against a roster too thin to spare it. */
  contractRaidMinRoster: number;
  /** Weeks the aftermath decision stays open before it decides itself as doing nothing. */
  contractRaidGraceWeeks: number;
  contractRaidOverhaulCost: number;
  contractRaidOverhaulMorale: number;
  contractRaidRetaliateMorale: number;
  contractRaidRetaliateReputationCost: number;
  contractRaidRetaliateGrudge: number;
  contractRaidDoNothingMorale: number;

  // A network you already signed with wants a say in who's on the card —
  // see engine/world/networkDemand.ts. Only fires with an active broadcast
  // deal; refusing counts toward the same grace period (broadcastWeeksOfGrace)
  // a numeric ratings breach does, on its own key so it never entangles with
  // that clock.
  networkDemandEarliestWeek: number;
  networkDemandChancePerWeek: number;
  /** Never fires against a roster too thin to spare the ask. */
  networkDemandMinRoster: number;
  /** Chance a demand is "keep this one off the air" rather than "feature our favorite", when a roster member with a real discipline record exists to target. */
  networkDemandKeepOffAirShare: number;
  /** Weeks the dialogue stays open before an unanswered demand decides itself as a refusal. */
  networkDemandGraceWeeks: number;
  networkDemandComplyBonus: number;
  networkDemandRefuseCost: number;
  networkDemandFeatureResentment: number;
  networkDemandBenchedMorale: number;
  networkDemandStoodUpMorale: number;
  networkDemandRefuseRoomMorale: number;

  // Three more world-story registry entries — see data/worldStories.ts.
  // Each is rival-side only: real, but never a player decision.
  networkRealignmentEarliestWeek: number;
  networkRealignmentChancePerWeek: number;
  networkRealignmentRatingSwing: number;
  ownerRivalryEarliestWeek: number;
  ownerRivalryChancePerWeek: number;
  ownerRivalryRatingSwing: number;
  /** Once per rival — see World.worldStoryHappenedFor. */
  rogueEarliestWeek: number;
  rogueChancePerWeek: number;
  rogueRatingSwing: number;
  rogueViolenceBoost: number;

  // Scandal collapse — once per rival, real and immediate; the aftermath
  // reuses ownershipShakeup.ts's pickShakeupReleases for who quits in
  // disgust, the same shared sub-story succession's weak branch already
  // uses.
  scandalEarliestWeek: number;
  scandalChancePerWeek: number;
  scandalRatingDrop: number;
  scandalReputationDrop: number;

  // Breakaway promotion — a real chunk of an existing rival's own roster
  // walks out together and founds a brand-new company. Once per source
  // rival.
  breakawayEarliestWeek: number;
  breakawayChancePerWeek: number;
  breakawayMinRosterSize: number;
  breakawayRatingDropForOldRival: number;

  // A legend's farewell tour — once ever, business-wide, and the one major
  // story with a real player decision: host a stop for real money and a
  // real boost, or let it happen somewhere else.
  farewellTourEarliestWeek: number;
  farewellTourChancePerWeek: number;
  farewellTourGraceWeeks: number;
  farewellTourHostFee: number;
  farewellTourHostRatingGain: number;
  farewellTourHostReputationGain: number;
  farewellTourDeclineReputationCost: number;

  // What a rival charges — a ticket, a shirt, a pay-per-view buy. Randomised
  // once per rival (engine/world/pricing.ts's randomRivalPricing), each item
  // drawn independently so the three numbers for any one company never form
  // a pattern the player can learn. Display-only: this never feeds a rival's
  // actual revenue, which stays the standing/form summary rivalEconomy.ts
  // has always used.
  rivalTicketPriceMin: number;
  rivalTicketPriceMax: number;
  rivalMerchPriceMin: number;
  rivalMerchPriceMax: number;
  rivalPpvPriceMin: number;
  rivalPpvPriceMax: number;

  // The billionaire pricing war — one conglomerate half prices below cost for
  // a real stretch of weeks, then reverts. Only possible once the merger has
  // actually happened (see World.pricingWar, engine/world/pricingWar.ts).
  pricingWarEarliestWeek: number;
  pricingWarChancePerWeek: number;
  pricingWarDurationWeeks: number;
  /** Multiplied onto each of a rival's three prices while the war is active. */
  pricingWarSlashFraction: number;
  /** Immediate rating gain for the rival buying market share this way. */
  pricingWarRatingBoost: number;

  // A hostile politician's licensing bill leaves roughly two-thirds of every
  // promotion's roster with their paperwork stuck in review — industry-wide,
  // no pattern to who. See World.paperworkLockout, engine/world/paperworkLockout.ts.
  paperworkLockoutEarliestWeek: number;
  paperworkLockoutChancePerWeek: number;
  /** How long the freeze runs before it lifts on its own. */
  paperworkLockoutDurationWeeks: number;
  /** Share of each roster frozen, independently per wrestler — roughly two-thirds. */
  paperworkLockoutFreezeShare: number;

  supershowEagerAt: number;
  supershowCautiousAt: number;
  supershowPublicRefusalChance: number;
  supershowGatePerRatingPoint: number;
  supershowNoveltyMultiplier: number;
  supershowHostGateBonus: number;
  supershowAppearanceShare: number;
  supershowWinBonusMultiple: number;
  supershowLoserBonusShare: number;
  supershowPopularityMultiplier: number;
  supershowMoraleSwing: number;
  supershowTitlePrestigeSwing: number;
  supershowCompanyRatingSwing: number;
  supershowTerritorySwing: number;
  supershowRoutMargin: number;
  supershowMinPartnerShare: number;
  supershowMaxPartnerShare: number;
  supershowCautiousPremium: number;
  supershowSplitTolerance: number;
  supershowGuaranteeMin: number;
  supershowGuaranteeMax: number;
  supershowMinCard: number;
  supershowMaxCard: number;
  supershowRatingPerSegment: number;
  /** No joint show before the company has a shape worth partnering with. */
  supershowEarliestWeek: number;
  supershowOfferChancePerWeek: number;
  /** How long an offer stands before the partner moves on. */
  supershowOfferWeeks: number;
  /** Weeks the player must wait between putting joint shows to people. */
  supershowProposalCooldownWeeks: number;
  /**
   * Standing gap at which the other booker refuses to send his man out. §16:
   * "it will reject pairings where its champion is badly outmatched."
   */
  supershowOutmatchedGap: number;
  /** An eager partner puts up with a wider gap than a cautious one. */
  supershowEagerTolerance: number;
  /** How many spare pairings are drafted to backfill struck matches. */
  supershowStandbys: number;
  /** How hard a card short of the agreed size hits the gate. */
  supershowShortCardPenalty: number;
  supershowShortCardFloor: number;

  // The Crucible — annual interpromotional tournament.
  cupEntryFee: number;
  cupAffordabilityCushion: number;
  cupMinimumStanding: number;
  cupBracketTarget: number;
  cupGatePerRatingPoint: number;
  cupCrownPopularityBonus: number;
  cupNeutralRoundShare: number;
  cupStandingSwing: number;
  /** Companies needed before the Crucible runs at all. */
  cupMinimumField: number;
  /** How much each repeat Crucible win is worth against the one before it. */
  cupRepeatWinFalloff: number;
  cupWinnerPopularitySurge: number;
  cupWinnerSkillSurge: number;
  cupWinnerCharismaSurge: number;
  cupWinnerStaminaSurge: number;
  cupWinnerAttitudeSurge: number;
  cupWinnerMomentumSurge: number;
  /** Shared matches before two people can form a backstage tie at all. */
  tieFormMinMeetings: number;
  /** Chance per qualifying match that a tie actually forms. */
  tieFormChancePerMeeting: number;
  tieFormStartMin: number;
  tieFormStartMax: number;
  /** Age gap at which a new same-side tie is a mentorship rather than a friendship. */
  tieFormMentorAgeGap: number;

  // Free agents (engine/world/freeAgents.ts)
  /** Asking rate shed per week unsigned. */
  freeAgentRateDecayPerWeek: number;
  /** Floor on that discount. */
  freeAgentMaxDiscount: number;
  /** Weekly chance a desirable free agent is signed by somebody else. */
  freeAgentRivalSigningChance: number;

  // Ringside personnel (engine/sim/ringside.ts)
  managerRatingBonusMax: number;
  /** How much a manager can tilt his man's chances, and cost the other man's. */
  managerWinBonusMax: number;
  // --- A manager's cut, engine/career/representation.ts --------------------
  /** The range a manager asks for, driven by how hard he argues. */
  repCutMin: number;
  repCutMax: number;
  /** How much a good agent adds to what his client demands from you. */
  repRateLiftMax: number;
  /** How fast a growing book thins a manager out, and the floor under it. */
  repAttentionFalloff: number;
  repAttentionFloor: number;
  /** Attention below which he is doing nobody much good. */
  repStretchedAt: number;
  /** Popularity below which a percentage man will not bother. */
  repWorthCourting: number;
  /** Whether managers go looking for clients, and how often. */
  repCourtingEnabled: boolean;
  repCourtChancePerWeek: number;
  /** What a week of carrying a book costs the man carrying it. */
  repRoadCostPerClient: number;
  repRoadCostCurve: number;
  /** How much being worn out takes off what he brings, and the floor. */
  repWearPenalty: number;
  repWearFloor: number;
  /** Condition below which a manager stops taking on anybody new. */
  repTooTiredToCourt: number;
  /** Presence below which a client stops paying for an absentee. */
  repClientPatience: number;
  /** Charisma at which somebody no longer needs anybody talking for them. */
  repOutgrowsAt: number;
  /** Condition at which a manager starts letting people go. */
  repDropsWhenWornTo: number;
  /** Weekly cut below which a client is not worth the diary space. */
  repMinWorthKeeping: number;
  /** What a night on the road costs the person travelling to it. */
  travelOwnCostPerNight: number;

  // --- Discipline, engine/career/discipline.ts -----------------------------
  /** How many go on file before a fine, and before a suspension. */
  disciplineWarnUntil: number;
  disciplineFineUntil: number;
  /** A fine, in weeks of pay. */
  disciplineFineWeeks: number;
  /** How long a suspension runs, and how much each prior adds. */
  disciplineSuspensionWeeks: number;
  disciplineRepeatWeeks: number;
  /** Hurting somebody on purpose skips the ladder. */
  disciplineInjurySuspensionWeeks: number;
  disciplineInjuryFineWeeks: number;
  /** How much a file makes it likelier somebody does it again. */
  /** Shoot heat above which an injury reads as deliberate. */
  disciplineShootHeatBar: number;
  disciplineReoffendWeight: number;
  /** Seeding managers as signable people. See engine/world/managerTalent.ts. */
  managerTalentAgeMin: number;
  managerTalentAgeMax: number;
  managerTalentDebutAge: number;
  managerTalentPresenceShare: number;
  managerTalentRingScale: number;
  managerTalentFeeToWage: number;
  /** How much ring ability a bodyguard keeps that a mouthpiece does not. */
  managerTalentMuscleBonus: number;
  /** How often a brand new manager turns up, and how good a talker they are. */
  managerTalentArrivalChance: number;
  /** Strangers considered for the manager's job each year, before the arrival roll. */
  managerArrivalsConsideredPerYear: number;
  managerTalentMinMic: number;
  /** How often a crooked manager is caught, and how far talking gets him. */
  managerCaughtChanceMax: number;
  managerSlicknessMax: number;
  managerOpponentPenaltyMax: number;
  /** How often a manager actually pulls somebody's attention. */
  managerDistractionChance: number;
  /** How much better a mouthpiece has to be before the office hands over. */
  autoFillMouthpieceGap: number;
  /** How much of a match slot a promo is worth on a rival's card. */
  promoAsMatchShare: number;
  /** Extra heat for going after somebody who does not speak for himself. */
  promoJabHeat: number;
  /** How much of an injury roll a bodyguard can take off his client. */
  managerInjuryShieldMax: number;
  /** How often muscle gets somebody in the corridor, and what it costs them. */
  bodyguardBackstageChance: number;
  bodyguardBackstageDamage: number;
  /** Odds the corner's muscle uses its own mouthpiece's distraction. */
  bodyguardMuggingChance: number;
  bodyguardMuggingDamage: number;
  /** How many seconds one corner holds. */
  cornerSeats: number;
  productionShoestringRungs: number;
  productionTouringRungs: number;
  /** How many weekly statements the save keeps. */
  statementsKept: number;
  /** How many recent weeks the runway figure averages the burn over. */
  runwaySampleWeeks: number;
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
  /**
   * How much of the ordinary chase rate applies when the chase would pull
   * popularity down rather than up. Same shape as ratingLadderFallMultiplier
   * on the company's own rating: reputation is stickier going down. See the
   * note on popularityChase in sim/aftermath.ts for the measured reason.
   */
  matchPopularityChaseFallShare: number;
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
  /**
   * Floor under the age curve. Accidents happen to the young, but a
   * twenty-year-old should not die at a forty-five-year-old's rate.
   */
  deathYoungFloor: number;

  // Pacing — engine/sim/pacing.ts.
  /** How much a crowd tired of one pace takes off the match. */
  paceSaturationPenalty: number;
  paceSaturationDecayPerWeek: number;

  // What television actually pays — engine/economy/broadcast.ts.
  /**
   * How hard the fee swings with the rating delivered against the one the
   * network signed you expecting.
   */
  broadcastRatingSensitivity: number;
  /** Caps either side, so a hot week is a bonus and a cold one is not ruin. */
  broadcastRatingUpside: number;
  broadcastRatingDownside: number;
  deathOldAge: number;

  // The fans. How many of them speak up, and how much they disagree.
  fanTweetsPerShow: number;
  /**
   * The smallest share of the feed that always dissents, either way. Nobody
   * is ever unanimous about wrestling and a feed that is reads as fake.
   */
  /** Most fans who will ever repeat one true rumour. */
  rumourMaxVoices: number;
  /** Chance a made-up rumour gets a second voice, so counting is not a lie detector. */
  rumourFalseSecondVoice: number;
  /** Chance a true, obvious thing still only gets one person saying it. */
  rumourTrueGoesQuiet: number;
  /** How many whispers reach the feed in a week, true and false together. */
  rumoursPerWeek: number;
  /** Momentum at which the crowd starts saying somebody is the best thing here. */
  rumourOnFireMomentum: number;
  /** Backstage heat the front row can start to notice. */
  rumourBadBloodHeat: number;
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
  /** A blown spot or a pyro mishap that goes viral instead of just costing rating — real upside, alongside a real personal-embarrassment cost. */
  incidentViralPopularity: number;
  incidentViralCompanyLift: number;
  incidentViralEmbarrassmentMorale: number;

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
  /**
   * How hard a circuit's taste bends its ranking, in points of standing.
   *
   * Load-bearing rather than cosmetic, and it trades off two failures against
   * each other. Measured across four 189-wrestler worlds:
   *
   *   weight   distinct names in the 4 top-fives   shared of 10   top world names place on
   *   0        5                                   10             4.0 circuits
   *   20       11                                  5.3            3.8
   *   35       16                                  2.7            2.7
   *   60       17                                  1.1            1.5
   *
   * Too low and the four lists are one list in four coats. Too high and taste
   * swamps standing: the biggest name in the business stops appearing on
   * loops that have no strong opinion about him, which is the point at which
   * a ranking is no longer about who is a draw. circuits.test.ts holds both
   * ends, so neither failure can return quietly.
   */
  circuitTasteWeight: number;
  /**
   * Agility below this counts as no high-flying at all. Without a floor,
   * every ordinary wrestler scores a little bit spectacular and the tag stops
   * separating anybody.
   */
  circuitAgilityFloor: number;
  /** How many wrestlers each circuit list ranks. */
  circuitRankingSize: number;

  // Defending a championship — see world/titleDefence.ts.
  /** Weeks a belt can go unfought before the company strips it. */
  titleDefenceWindowWeeks: number;
  /** The same, for a television title, whose whole identity is defending often. */
  titleDefenceWindowTelevisionWeeks: number;
  /** Inside this many weeks the belt starts appearing on the watch list. */
  titleDefenceNoticeWeeks: number;
  /** Inside this many, it is the last call — defend it or lose it. */
  titleDefenceWarningWeeks: number;
  /** Weeks a hurt-champion decision can sit unanswered before the belt vacates itself. */
  championInjuryGraceWeeks: number;
  /** How much more likely a fresh injury is for somebody the booker sent out hurt. */
  workingHurtInjuryMultiplier: number;
  /** Rating points for defending a belt under the stipulation it is known for. */
  titleSignatureHonoured: number;
  /** Rating points lost for ignoring that tradition. Deliberately the larger. */
  titleSignatureIgnored: number;

  // Confrontations — see sim/confrontation.ts.
  /** How much a confrontation rates off talking rather than off standing. */
  confrontationCharismaWeight: number;
  confrontationPopularityWeight: number;
  /** Luck either way on the exchange, so a great talker still loses one. */
  confrontationLuck: number;
  /** Inside this margin nobody won it. */
  confrontationDeadHeat: number;
  /** How much the better of the two carries the segment, 0-1. */
  confrontationBestShare: number;
  /** Rating points a hot feud is worth to the segment. */
  confrontationHeatBonus: number;
  /** Rating points for doing it in front of a crowd instead of in a corridor. */
  confrontationRingBonus: number;
  /** Backstage moves a feud less, because nobody paid to see it. */
  confrontationBackstageHeatScale: number;
  /**
   * How much likelier a twist that turns it real is backstage. There is
   * nobody watching to keep it a performance.
   */
  confrontationBackstageShootBias: number;
  /** How hard a booked turn pushes an alignment. */
  confrontationTurnShift: number;
  /** What winning the exchange is worth, and what losing it costs. */
  confrontationWinMomentum: number;
  confrontationWinPopularity: number;
  confrontationLossMomentum: number;
  /** Talking is work. Both of them pay it. */
  confrontationEnergyCost: number;

  // Secret signings — see world/secretSigning.ts.
  /**
   * How close to the end of somebody's deal you can reach an understanding.
   * Outside this there is nothing to talk about: he is not going anywhere and
   * you cannot pay a man to break a contract.
   */
  secretSigningWindowWeeks: number;
  /** Multiple of their ordinary rate, for bidding blind against an incumbent. */
  secretSigningPremium: number;
  /** Fallback weekly rate per point of popularity, when they have no contract. */
  secretSigningRateFloor: number;
  /** How much being miserable where they are moves them. */
  secretSigningMoraleWeight: number;
  /** How much liking the idea of being the secret moves them. */
  secretSigningEgoWeight: number;
  /** How much easier it is to get a yes while nobody has made him an offer yet. */
  secretSigningRunwayWeight: number;
  secretSigningBaseAppeal: number;
  /** Odds a week that his own office gets wind and re-signs him first. */
  secretRetentionBase: number;
  /** A big company notices sooner and fixes it faster. */
  secretRetentionClout: number;
  /** A happy man signs the renewal in front of him. */
  secretRetentionMorale: number;
  /** A man who talks is a man whose office hears. */
  secretRetentionTalk: number;
  secretRetentionCap: number;
  /** Odds the sheets place him the first week his new deal is live, and the climb. */
  secretExposureBase: number;
  secretExposurePerWeek: number;
  secretExposureCap: number;
  /** Multiplier on an ordinary debut that a walkout the night he came free is worth. */
  secretSigningBaseImpact: number;
  /** What is left of it once the newsletter has printed it. */
  secretSigningBlownImpact: number;
  /** How fast the moment bleeds out for every week he sits at home unused. */
  secretDebutDecayPerWeek: number;
  /** Weeks of the new rate you must be able to cover before shaking on it. */
  secretSigningProofWeeks: number;
  /** What it costs when somebody turns you down and knows you asked. */
  secretSigningRefusalMorale: number;
  /** What a reveal's impact is worth, per point, to each thing it moves. */
  revealMomentumPerImpact: number;
  revealPopularityPerImpact: number;
  revealCompanyRatingPerImpact: number;
  revealRivalRatingPerImpact: number;

  // Factions — see world/faction.ts.
  factionDrawWeight: number;
  factionFormWeight: number;
  /** What each member past the second adds, and the ceiling on it. */
  factionSizeBonus: number;
  factionSizeBonusCap: number;
  /** How far past the company's own rating counts as running the place. */
  factionOvershadowMargin: number;
  factionEstablishedSize: number;
  factionOutOfControlSize: number;
  /** What makes somebody want in. */
  factionRecruitMoraleWeight: number;
  factionRecruitEgoWeight: number;
  factionRecruitOverlookedWeight: number;
  /** How hard the group pulls, by how well it is doing. */
  factionPullForming: number;
  factionPullEstablished: number;
  factionPullRunning: number;
  factionPullOutOfControl: number;
  /** What makes somebody want out, and the cap on it. */
  /** How often a group considers taking somebody on or losing somebody. */
  factionChurnWeeks: number;
  /** Nobody wants to be the eighth man in a stable. */
  factionMaxMembers: number;
  factionDefectionWeight: number;
  factionDefectionCap: number;
  /** What being in the group that runs the place does to an ego, per week. */
  factionEgoDriftRunning: number;
  factionEgoDriftOutOfControl: number;

  // What the audience is asking for — see world/fanDemand.ts.
  /** How over somebody must be before a match with them counts as a dream one. */
  demandDreamMatchPopularity: number;
  /** Talent-minus-position gap before the crowd calls somebody wasted. */
  demandWastedGap: number;
  /** Momentum at which they start asking why he has had no shot. */
  demandTitleShotMomentum: number;
  /** Crowd heat at which a feud is owed another match. */
  demandRematchHeat: number;
  /** Weeks on the show inside the window before they have had enough. */
  demandOverexposedWeeks: number;
  demandOverexposedHeatPerWeek: number;
  /** How over, and how underused, before they want somebody pushed. */
  demandPushPopularity: number;
  demandPushGap: number;
  /** How many things the board shows. A wishlist of forty is unread. */
  demandBoardSize: number;
  /**
   * Most of any one kind. Without this the loudest kind takes the whole
   * board — a roster of eight stars makes twenty-eight dream matches and
   * every one of them outscores everything else.
   */
  demandPerKindCap: number;
  /** Rating points a fully-demanded match is worth for giving it to them. */
  demandDeliveryRatingBonus: number;

  // A wrestler's week outside the ring — see world/misfortune.ts.
  /** Odds per healthy wrestler per week that something happens to them. */
  misfortuneChanceHealthy: number;
  /**
   * The same for somebody already hurt, and deliberately higher: the
   * dangerous time for an injury is while you still have one.
   */
  misfortuneChanceInjured: number;
  /**
   * Below this total weekly ask (retainer plus per-appearance, added
   * together), wrestling is not paying this person's bills — they still
   * have somewhere else to be. Ordinary promotion pay is comfortably above
   * this; it only bites for a roster genuinely working for the love of it.
   */
  dayJobWageThreshold: number;
  /**
   * Odds per week that a below-threshold wrestler's actual job wins out —
   * held late at the register, couldn't get the shift covered, and so on.
   * A separate gate from misfortuneChanceHealthy on purpose: this is not
   * bad luck, it is a standing fact about how they are being paid, and it
   * should read as a real, recurring cost of underpaying somebody rather
   * than competing with car trouble and food poisoning for a sliver of an
   * already-rare roll.
   */
  dayJobAbsenceChance: number;
  /**
   * Floor on how likely an unlikely replacement is. The office reaches for
   * somebody near the missing wrestler's level, but the whole appeal of a
   * mystery opponent is that it might be anybody, so nobody's weight is zero.
   */
  mysteryOpponentLongShotWeight: number;
  /**
   * The championships the player's company opens with.
   *
   * Omitted, the house style's suggested lineup is used — which is what every
   * rival gets. Set from the new-game screen, where the player can rename
   * them, change a division, drop one, or run eight.
   */
  startingTitles?: TitleBlueprint[];

  // Freshness — see sim/freshness.ts. Both of these existed as dead wiring:
  // the rating formula has always had an `overexposurePenalty` term nothing
  // filled, and Wrestler.gimmickFreshness was documented as decaying and
  // never did.
  /** How many weeks back the crowd remembers what it has been shown. */
  overexposureLookbackWeeks: number;
  /** Meetings inside that window before a match-up counts as a rerun. */
  overexposureFreeMeetings: number;
  /** Rating points lost per repeat beyond that. */
  overexposureRepeatPenalty: number;
  /** Most a match can lose to repetition alone. */
  overexposureRepeatCap: number;
  /** Weeks somebody can work inside the window before the crowd tires of them. */
  overexposureFreeWeeks: number;
  /** Rating points lost per week worked beyond that. */
  overexposureAppearancePenalty: number;
  /** Most a match can lose to overexposure alone. */
  overexposureAppearanceCap: number;
  // Heat — reaction-driven, not a flat clock. Freshness drifts toward a
  // target implied by the wrestler's own momentum (the crowd's current
  // opinion, already tracked): a genuinely hot act can hold or climb, a
  // merely-tolerated one settles low even while it keeps working, and a
  // hated one crashes. "No reaction" is itself a verdict, on purpose — see
  // the player's own framing: not everyone needs the best reaction, but
  // nobody gets to be background noise forever.
  /** Momentum this game calls "neutral" — the resting point drift is measured against. */
  gimmickHeatNeutralMomentum: number;
  /** Freshness a neutral (no real reaction either way) act settles toward. Below staleGimmickThreshold on purpose. */
  gimmickHeatNeutralTarget: number;
  /** How far the target moves per point of momentum above/below neutral. */
  gimmickHeatMomentumScale: number;
  /** Share of the gap to the target closed per week while actually worked — reaction only registers when the crowd is seeing them. */
  gimmickHeatWorkedDriftRate: number;
  /** Share of the gap closed per week while idle — slower; nothing new to react to. */
  gimmickHeatIdleDriftRate: number;
  /** Below this, an act reads as genuinely ice cold — see weeksIceCold / the forced cold-meeting. */
  iceColdThreshold: number;
  /** Consecutive weeks at or under iceColdThreshold before the booker is forced into a meeting. */
  coldMeetingTriggerWeeks: number;
  /** Below this an act reads as stale, and the repackage event can fire. */
  staleGimmickThreshold: number;
  /** Most a completely worn-out act can cost a match. */
  staleGimmickPenaltyMax: number;
  /**
   * How much the office values a rested act when it sorts the card, in
   * points of standing per week already worked. Zero books the same six
   * matches every week forever, which is what it used to do.
   */
  bookerRestWeight: number;
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
  /** Share of the business's vacancies the schools try to fill in a year. */
  academyFillRate: number;
  /** Age range a graduate debuts at. */
  /**
   * Share of a generated popularity a school graduate keeps. They have never
   * had a match; the roll behind them is for somebody mid-career.
   */
  academyGraduatePopularity: number;
  /**
   * The school's door policy. Nobody older is taken as a student; they come
   * through the walk-on door instead — see engine/world/walkOns.ts.
   */
  academyMaxAge: number;

  // --- New promotions, engine/world/newPromotions.ts -----------------------
  newPromotionsEnabled: boolean;
  /** The business never has more companies than this trading at once. */
  promotionCountMax: number;
  /** Unemployed wrestlers before anybody thinks there is money in it. */
  newPromotionUnemployedTrigger: number;
  /** How much more of a glut takes the chance from base to base+range. */
  newPromotionPressureRange: number;
  newPromotionChanceBase: number;
  newPromotionChanceRange: number;
  newPromotionRatingMin: number;
  newPromotionRatingMax: number;
  newPromotionCashMin: number;
  newPromotionCashMax: number;
  /** How many they open the doors with. */
  newPromotionRosterSize: number;

  // --- Walk-ons, engine/world/walkOns.ts -----------------------------------
  /** How many turn up in a year. Smaller than a graduating class. */
  walkOnsPerYearMin: number;
  walkOnsPerYearMax: number;
  /** The oldest somebody can be and still be asking for a look. */
  walkOnMaxAge: number;
  /** Chance somebody who walked in can plainly do it anyway. */
  walkOnGemChance: number;
  /** ...and chance they cannot go at all but can talk. */
  walkOnTalkerChance: number;
  /** How far untrained knocks the ring skills down, 0-1. */
  walkOnCraftScale: number;
  walkOnGemCraftScale: number;
  walkOnTalkerCraftScale: number;
  /** How much of a hidden ceiling survives coming to it late. */
  walkOnTalentScale: number;
  walkOnGemTalentFloor: number;
  walkOnGemCharismaFloor: number;
  walkOnTalkerCharismaFloor: number;
  /** Room above where they start, for the ones who can still grow. */
  walkOnCeilingRoom: number;
  walkOnGemCeilingRoom: number;
  /** Nobody has heard of them. This is the spread of "nobody". */
  walkOnPopularitySpread: number;
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
  /**
   * Star rating a show has to clear before it earns any following at all —
   * below it, following is lost, not just gained slower. Without this, home
   * following only ever climbed while a promotion kept returning (decay only
   * applies to towns you didn't run in), so it saturated permanently within a
   * couple of months and a long bad stretch had nothing left to erode: the
   * demand multiplier stayed pinned at its ceiling no matter how bad the
   * shows got. 3 matches ratingLadderAnchors' own midpoint — the same show
   * that's neutral for company rating is neutral here too.
   */
  territoryFollowingNeutralStars: number;
  /** Following earned per star of show quality above territoryFollowingNeutralStars. */
  territoryFollowingPerStar: number;
  /**
   * Following lost per star of show quality below territoryFollowingNeutralStars.
   *
   * Deliberately much gentler than the gain rate, not a mirror of it. Local
   * following also feeds back into demand (economy/showBudget.ts's
   * computeDemand), demand into attendance, and a thin house drags the next
   * show's own rating down (attendanceRatingModifier) — so a symmetric rate
   * closes a real feedback loop: a bad night costs following, which costs
   * demand, which empties the house further, which costs the following show
   * too. Tried at the same 4/star as the gain rate first and it span a save
   * into the ground inside 30 weeks with no way back, ratings in the 40s the
   * whole time — this is the number that lets a bad stretch cost you
   * something real without being able to feed itself.
   */
  territoryFollowingLossPerStar: number;
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
  /**
   * Pin the opening venue/territory instead of deriving them from
   * startingCompanyRating. Unset for every preset except the ones that
   * genuinely need to start somewhere specific — defaultShowSetup() falls
   * back to the algorithmic pick when either is absent, so this is
   * opt-in and changes nothing for a preset that doesn't set it.
   */
  startingVenueId?: Id;
  startingTerritoryId?: Id;

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

  /** How many signature events a promotion cycles through. */
  ppvCalendarSize: number;
  /**
   * Buys scale with how big the company is, steeply — nobody orders a
   * pay-per-view from a promotion they have not heard of.
   */
  ppvBuysScale: number;
  ppvBuysReachCurve: number;
  /** How much of the interest is the night itself... */
  ppvBuysFromQuality: number;
  ppvBuysQualityCurve: number;
  /** ...and how much is the feuds people paid in advance to see finish. */
  ppvBuysFromBuild: number;
  ppvBuyPrice: number;

  // Television and sponsorship — §14.
  /** Weeks a rating must be held before a network will talk. */
  broadcastWeeksToQualify: number;
  /** Weeks a paymaster tolerates a broken condition before walking. */
  broadcastWeeksOfGrace: number;
  /** How many sponsors will fit on a banner. Keeps it a choice. */
  maxSponsors: number;

  // Promos — §9. Charisma first, popularity second, and that order is the
  // point: it is where a great talker who cannot work earns his contract.
  promoCharismaWeight: number;
  promoPopularityWeight: number;
  promoHeatBonus: number;
  promoMoraleSwing: number;
  promoVariance: number;
  /** A promo at this quality neither helps nor hurts the show. */
  promoNeutralQuality: number;
  /** Deliberately smaller than a match — a card of promos is not a show. */
  promoShowRatingWeight: number;
  promoStartFeudHeat: number;
  promoContinueFeudHeat: number;
  promoChallengeHeat: number;
  promoPopularity: number;
  promoMomentum: number;
  promoCompanyLift: number;
  promoCalloutPopularity: number;
  /** Does not scale with quality. The boys mind either way. */
  promoCalloutMorale: number;
  promoDebutPopularity: number;
  promoFarewellMorale: number;
  /** Following a promo wins or takes in the town it was cut in. */
  promoFollowingGain: number;
  promoEnergyCost: number;
  promoEnergyCostDoubleBooked: number;

  // Running a match with nobody in the shirt — §10. Every one of these is
  // deliberately worse than the worst referee in the pool, or booking nobody
  // would be the correct play and the whole system would be decoration.
  // A wrestler in the shirt — §10. Never a worse referee, always a partial
  // one. The shifts are points of win probability, and the clamp still
  // applies, so no agenda produces a certainty.
  /** Leaning against somebody they have live heat with. The loudest reason. */
  guestRefereeGrudgeShift: number;
  /** Helping a friend, or spiting an enemy. */
  guestRefereeBiasShift: number;
  /** No history at all, so a heel helps the heel. */
  guestRefereeAlignmentShift: number;
  /** Health a guest loses for standing in the middle of it. */
  guestRefereeHealthCost: number;
  /** What the locker room thinks of being officiated by one of their own. */
  guestRefereeMoraleCost: number;
  /** Who the office drafts when the player names nobody: fee of the stand-in. */
  draftedRefereeMoraleCost: number;

  // Officials as signed characters — engine/sim/referees.ts. A referee is on
  // the payroll like everybody else, just a great deal cheaper, and the
  // things that make one worth paying for are all in here.
  /** Floor wage for anybody who owns a striped shirt. */
  refereeBaseWeeklyRate: number;
  /** Spread between the floor and the best official in the business. */
  refereeRateRange: number;
  /** Curve on that spread, so an elite official costs several times a warm body. */
  refereeRateCurve: number;
  /** Premium a crooked official charges. Doing what you are told is a service. */
  refereeBendablePremium: number;
  /** Standard length of a referee deal, in weeks. Shorter than a wrestler's. */
  refereeContractWeeks: number;
  /** Asking rate shed per week unsigned. */
  refereeRateDecayPerWeek: number;
  refereeMaxDiscount: number;
  /** Weekly chance an unsigned official is picked up by somebody else. */
  refereeRivalSigningChance: number;
  /** How many officials the pool tries to keep available. */
  refereePoolSize: number;

  /** Sharpness spent working one match. */
  refereeSharpnessPerMatch: number;
  /** Sharpness recovered per week between shows. */
  refereeSharpnessRecoveryPerWeek: number;
  /**
   * How much of an official's competence survives total exhaustion. At 0.55,
   * a burned-out ace still calls it better than a fresh incompetent — tired
   * is a penalty, not a personality transplant.
   */
  refereeSharpnessFloor: number;

  /** Chance a perfectly competent, fresh official misses something anyway. */
  refereeMissBaseChance: number;
  /** How much incompetence and fatigue add on top of that. */
  refereeMissIncompetenceWeight: number;
  /** However bad they are, a match is never guaranteed to fall apart. */
  refereeMissChanceCap: number;
  /** Rating a match loses for every visible blown call. */
  refereeMissRatingPenalty: number;
  /** Morale the wrestler on the wrong end of a miss loses. */
  refereeMissVictimMorale: number;
  /** Reputation an official loses per miss, and gains for a clean night. */
  refereeMissReputationCost: number;
  refereeCleanNightReputationGain: number;
  /**
   * How far above his own competence an official's reputation can climb on
   * clean nights alone. Small — the business finds you out.
   */
  refereeReputationCeiling: number;

  // Wrestlers changing jobs — engine/career/transition.ts.
  /**
   * How long somebody must stay in a role before changing again. Reversible,
   * but never casual — the price of the change is the year, not a penalty.
   */
  roleTransitionLockWeeks: number;
  /** Where a converted wrestler's officiating starts, before experience. */
  convertedRefereeBaseCompetence: number;
  /** How much a long ring career is worth to it. */
  convertedRefereeExperienceWeight: number;
  /** They learn the job by working it. Competence gained per match officiated. */
  convertedRefereeLearningRate: number;
  /**
   * However many years they put in, a converted wrestler never becomes the
   * best official in the business. Somebody who did it their whole life is
   * still better at it.
   */
  convertedRefereeCompetenceCap: number;

  // Casualties — who gets hurt, and how badly. See engine/sim/casualties.ts.
  // Everyone at ringside can be hurt, because everyone at ringside is in the
  // same fight.
  casualtyChanceCompetitor: number;
  casualtyChanceGuestReferee: number;
  casualtyChanceReferee: number;
  casualtyChanceManager: number;
  /** However violent it gets, nobody is certain to be hurt. */
  casualtyChanceCap: number;
  /**
   * How much unskilled hands raise the match's overall injuryMultiplier — see
   * simulateMatch.ts. Compounds across both participants rather than
   * averaging: one green wrestler paired with a veteran is still mostly
   * safe, but two green wrestlers together multiply the danger rather than
   * split the difference.
   */
  skillInjuryWeight: number;
  /** How far a given injury swings either side of its listed length. */
  casualtyWeeksVariance: number;
  /**
   * How hard a dangerous match scales an injury's *length*, as an exponent on
   * the same multiplier that scales its odds. Below 1 on purpose — see
   * weeksOut() in sim/casualties.ts.
   */
  casualtyLengthExponent: number;
  /** How often an injury is the bad one, independent of how rough the match was. */
  casualtyCatastrophicChance: number;
  casualtyCatastrophicMultiplier: number;
  /**
   * Extra injury risk a hardwareGearSensitive stipulation (ladder, cage,
   * tables) carries on the worst gear a promotion could own — a ladder
   * match run on the bottom of the production ladder should read as
   * visibly riskier than one run on the top of it. Scales down to nothing
   * as equipmentInjuryReduction climbs, same shape as everything else that
   * stacks toward safer but never certain.
   */
  hardwareGearRiskAtWorst: number;
  // --- how bad an injury is, as a number (sim/casualties.ts) ---
  /** Where the severity labels sit on the 0-100 grade scale. */
  gradeModerate: number;
  gradeSevere: number;
  gradeCareerThreatening: number;
  /** Under this they can be booked again, still carrying it. */
  gradeFitToWork: number;
  /** Weeks out at grade 100. The scale that converts between the two. */
  gradeWeeksAtWorst: number;
  /** Grade healed per week resting, and the fraction of that other weeks get. */
  gradeHealResting: number;
  gradeHealTrainingShare: number;
  gradeHealLightDutyShare: number;
  /** What a match on it adds. Small — the real cost is being hurt again. */
  gradeWorsenPerMatch: number;
  /** How steeply re-injury risk climbs with grade, and where it tops out. */
  gradeRiskCurve: number;
  gradeRiskAtWorst: number;
  /** How much of a fresh injury stacks onto one somebody already had. */
  gradeAggravationShare: number;
  /** Health taken off somebody who was hurt, on top of the time out. */
  casualtyHealthCost: number;
  injuryModerateWeeks: number;
  injurySevereWeeks: number;
  injuryCareerThreateningWeeks: number;

  /** Rating points a match gains for fitting the promotion's house style. */
  houseStyleRatingWeight: number;
  /** Rating points a card loses for running past what this audience will take. */
  houseStyleViolencePenalty: number;

  // Fan taste — engine/world/fanTaste.ts. What the crowd has actually come
  // to want, as distinct from the identity the booker declared at signing.
  /** The resting value for a style nobody has an opinion on either way, 0-100. */
  fanTasteNeutral: number;
  /** How far a single week's run-share can pull the week's *target* from neutral. */
  fanTasteShareScale: number;
  /** How fast actual taste chases that target per week — small, so it reads as a season-long drift. */
  fanTasteDriftRate: number;
  /** Rating points current taste can add or cost a match, on top of houseStyleFit. */
  fanTasteRatingWeight: number;
  /** How far from neutral a style has to sit before it is worth naming as loved or gone cold. */
  fanTasteNoticeGap: number;

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
  /** Share of rivalBankruptcyGraceWeeks at which a struggling rival starts releasing people to cut payroll. */
  rivalTrimEnabled: boolean;
  rivalTrimAtGraceShare: number;
  /** Rolled once a week per rival while eligible — a rival does not gut its own roster overnight. */
  rivalTrimWeeklyChance: number;

  // --- economy/loan.ts: the one real lifeline against the player's own
  // bankruptcy. Sized against the promotion's own payroll rather than a flat
  // figure, so it means the same thing whether it fires in week 8 or week
  // 800 — see the module doc comment for the full reasoning. ---
  loanEnabled: boolean;
  /** How many weeks in the red before the bank makes an offer at all — before bankruptcyGraceWeeks ends the save. */
  loanTriggerWeeksInTheRed: number;
  /** The ceiling is never smaller than this, so a tiny roster's payroll still buys a real offer. */
  loanMinimumCeiling: number;
  loanTierSmallFraction: number;
  loanTierMediumFraction: number;
  loanTierLargeFraction: number;
  /** Ceiling, in weeks of current payroll, for a first loan. */
  loanCeilingWeeks1st: number;
  loanCeilingWeeks2nd: number;
  loanCeilingWeeks3rd: number;
  /** Total repaid per dollar borrowed. 1.3 means 130% comes back. */
  loanRepaymentMultiple1st: number;
  loanRepaymentMultiple2nd: number;
  loanRepaymentMultiple3rd: number;
  /** Weeks the repayment is spread over. Fixed at signing, never adjusted. */
  loanRepaymentWeeks1st: number;
  loanRepaymentWeeks2nd: number;
  loanRepaymentWeeks3rd: number;
  /** Solvent weeks required, loan-free, before the next offer can appear. */
  loanCooldownWeeks1st: number;
  loanCooldownWeeks2nd: number;
  loanCooldownWeeks3rd: number;
  /** Added to World.mandateStrikes the moment that attempt's loan is taken. */
  loanMandateStrikes1st: number;
  loanMandateStrikes2nd: number;
  loanMandateStrikes3rd: number;

  // --- economy/buyout.ts: a rival's blind bulk offer for a slice of the
  // roster, only while an active loan means the promotion is genuinely
  // drowning. See the module doc comment for why the count is known but the
  // names are not, and why the price is never derived from who is taken. ---
  buyoutEnabled: boolean;
  /** Rolled once a week while an active loan is running. */
  buyoutWeeklyChance: number;
  buyoutCountFractionMin: number;
  buyoutCountFractionMax: number;
  buyoutCountMin: number;
  buyoutCountMax: number;
  /** The price is weekly payroll times a number in this range — never the value of who is actually taken. */
  buyoutPriceMultiplierMin: number;
  buyoutPriceMultiplierMax: number;
  /** What the rest of the roster feels, once, when several colleagues vanish at once to an unknown company. */
  buyoutTeammateMoraleDelta: number;

  // --- economy/releaseStigma.ts: free agents wary of a promotion that has
  // been visibly releasing people. Company reputation, not a person's own
  // disposition. Same cooldown shape as the loan above — see
  // World.solventWeeksSinceLastRelease. ---
  releaseStigmaEnabled: boolean;
  /** Consecutive solvent weeks since the last release before the wariness clears. */
  releaseStigmaCooldownWeeks: number;
  /** Flat guaranteedPct floor demanded by somebody who would not otherwise get one. */
  releaseStigmaGuaranteedPct: number;
  /** Weeks of weeklyRate demanded up front by somebody who already commands a guarantee off ego. */
  releaseStigmaBonusWeeks: number;

  // --- economy/fireSale.ts: selling owned production gear at a distress
  // discount. Only on the table while an active loan means the promotion is
  // genuinely struggling — the same gate buyout.ts uses. See
  // fireSaleEligible() for which owned assets are actually for sale. ---
  fireSaleEnabled: boolean;
  /** Sale value = asset cost * current condition effectiveness * this. Deliberately harsh — this is a fire sale, not a fair resale. */
  fireSaleValueFraction: number;

  /** How many tag teams each promotion is formed with. */
  tagTeamsPerPromotion: number;
  /** Roster size of the smallest rival promotion. */
  rivalRosterSizeMin: number;
  /** Roster size of a rival at the top of the ladder. */
  rivalRosterSizeMax: number;
  /**
   * Every opening roster in the world — the player's included — is dealt
   * contracts of staggered length rather than all the same one, so that at any
   * given week a handful of people are running down and the rest are not.
   *
   * The rivals had this from the start and the player did not, which was not a
   * cosmetic difference: twenty-six deals signed in week one on a fixed
   * two-year term all lapsed in week 105, and a measured save lost its entire
   * roster in a single week with two million in the bank. Nothing else in the
   * game can empty a company like that, and no amount of good booking could
   * have prevented it.
   */
  openingContractMinWeeks: number;
  openingContractMaxWeeks: number;
  territoryCount: number;
  startingTerritories: number;
  startingYear: number;
  seed: string;
  rivalsCanGoBankrupt: boolean;

  // --- What the business believes, engine/career/hype.ts -------------------
  /** How far a scouting read can be from the truth. Fat tails on purpose. */
  hypeNoise: number;
  /** Share of the certainties — phenoms, gems — with nothing behind them. */
  hypeBustChance: number;
  /** What a bust's real ceiling turns out to be. */
  hypeBustTalent: number;
  /** Gap at which somebody counts as over-rated, and under-rated. */
  hypeBustGap: number;
  hypeSleeperGap: number;
  /** How fast the market learns, by watching them work and by not. */
  hypeLearnWorked: number;
  hypeLearnIdle: number;
  /** Where "rated" starts, and where "the next one" starts. */
  hypeRatedAt: number;
  hypePhenomAt: number;

  // --- Shows nobody planned, engine/world/impromptu.ts ---------------------
  /** Weeks somebody has to have given a company for it to bury him. */
  memorialTenureWeeks: number;
  /** Share of a normal night's gate that an unplanned memorial draws. */
  memorialGateShare: number;
  /** What counts as having fully done right by the family, in money. */
  memorialGenerousGate: number;
  /** Goodwill a memorial buys for being run at all, before the cheque. */
  memorialGoodwillFloor: number;
  memorialReputation: number;
  memorialMorale: number;
  memorialFollowing: number;
  charityShowsEnabled: boolean;
  charityShowChance: number;
  charityReputation: number;
  charityMorale: number;
  charityFollowing: number;
  /** Staging a night that was not on the calendar. The building is real. */
  impromptuShowCost: number;

  // --- Records, engine/career/ledger.ts ------------------------------------
  /** How recently a manager must have worked somebody's corner to count them. */
  ledgerClientWindowWeeks: number;
  /** Weeks out that means the match had to be stopped rather than finished. */
  ledgerStoppageWeeks: number;

  // --- Where somebody sits on the card, engine/career/cardStatus.ts --------
  /** Standing (in this company) at which each band starts. */
  cardMainEventAt: number;
  cardUpperMidcardAt: number;
  cardMidcardAt: number;
  cardLowerCardAt: number;
  /** How far somebody has to fall before the office admits it. */
  cardFallCushion: number;
  /** Matches before anybody is anything but a prospect. */
  cardMinMatches: number;
  /** What catching fire takes — the Austin case. */
  cardBreakoutMomentum: number;
  cardBreakoutStanding: number;
  /** Momentum at which somebody reads as climbing, or as going backwards. */
  cardHotMomentum: number;
  cardColdMomentum: number;

  // --- Somebody's people, engine/career/circle.ts --------------------------
  /** Most friends, and most enemies, anybody keeps a place for. */
  circleMax: number;
  /** How strong a tie has to be to count as one at all. */
  circleFloor: number;
  /** Where "inseparable" and "real bad blood" start. */
  circleThickAt: number;
  /** What a week does to a tie: in the same match, on the same card, apart. */
  circleGainWorked: number;
  circleGainSharedCard: number;
  circleFadePerWeek: number;
  /** Below this a tie has lapsed and is dropped rather than kept at nothing. */
  circleLapseAt: number;
  /** Morale a death costs the person who had them first on their list. */
  circleGriefFriend: number;
  circleGriefEnemy: number;

  // --- The schedule, engine/world/schedule.ts ------------------------------
  /** Most nights a week anybody can run. */
  scheduleMaxShows: number;
  /** The shape the business settled on, and what every curve is centred on. */
  scheduleIdealShows: number;
  /** What a house show is worth against the televised one, and how it decays. */
  scheduleHouseShowRevenueShare: number;
  scheduleRevenueCurve: number;
  /** How much of a rest week a heavy pattern eats, and the floor under it. */
  /** How hard a house show is against a televised one. Shorter, lighter. */
  scheduleHouseShowIntensity: number;
  scheduleRecoveryLossPerShow: number;
  scheduleRecoveryFloor: number;
  /** Company ratings at which a rival can sustain each pay-per-view cadence. */
  scheduleMonthlyPPVRating: number;
  scheduleBiMonthlyPPVRating: number;

  // --- Where somebody gets over, engine/career/fit.ts ----------------------
  fitEnabled: boolean;
  /** How much of the legible half is what they work, and what the room buys. */
  fitStyleWeight: number;
  fitDrawWeight: number;
  /** How much of it nobody can explain. */
  fitChemistryWeight: number;
  /** How far fit moves the ceiling either way, and the hard stops. */
  fitSpread: number;
  fitFloor: number;
  fitCeiling: number;
  /** Difference in fit at which a rival can see somebody suits them better. */
  fitPoachingGap: number;
  /** Where the sheet starts saying so, in words. */
  fitLovedAt: number;
  fitSuitsAt: number;
  fitPoorAt: number;

  // --- Contract perks, engine/economy/perks.ts -----------------------------
  perksEnabled: boolean;
  /** How hard the room takes what somebody else was given. */
  perkResentmentScale: number;
  /** How much having perks of your own stops you minding anybody else's. */
  perkInsulation: number;

  // --- The bidding war, engine/economy/bidding.ts --------------------------
  biddingEnabled: boolean;
  /** Popularity that makes somebody worth an auction rather than a phone call. */
  biddingStarPopularity: number;
  /** ...or this much hidden talent, this young. The phenom's door. */
  biddingProspectTalent: number;
  biddingProspectAge: number;
  /** Chance a graduating class contains somebody who is obviously going to be a star. */
  biddingPhenomChancePerClass: number;
  /** How far above the ordinary tier a phenom's stats are rolled. */
  biddingPhenomStatFloor: number;
  biddingPhenomTalentFloor: number;
  /** Buzz a phenom debuts with. Nobody has seen them work; everybody has heard. */
  biddingPhenomPopularity: number;
  /** Fewer interested companies than this and it is a negotiation, not an auction. */
  biddingMinRivals: number;
  /** Weeks of payroll a company must keep covered to enter one. */
  biddingHeadroomWeeks: number;
  /** How far above a company's own rating somebody has to be to interest them. */
  biddingWantsThreshold: number;

  // What the business reckons somebody is worth — the anchor every bid in the
  // room starts from, so companies differ by strategy rather than by luck.
  /** Age past which a hidden ceiling is worth nothing: no time left to reach it. */
  biddingCeilingAge: number;
  /** Floor and range of the market multiple applied to the asking rate. */
  biddingValueFloor: number;
  biddingValueRange: number;
  /** How much a wrecked body knocks off the price. */
  biddingDamageDiscount: number;
  /** How far form moves it, either way. */
  biddingMomentumSwing: number;

  // Who somebody will and will not work for.
  /** Bad blood at or above this strength has no price. */
  biddingRefusalStrength: number;
  /** How far allies and enemies already on a roster move the price. */
  biddingWarmthPull: number;
  biddingChillPush: number;
  /** Below this, the room is neither warm nor cold and the price is the price. */
  biddingStanceDeadzone: number;
  biddingDiscountMax: number;
  biddingPremiumMax: number;
  /** Score weight of "a friend works there" as the stated reason it was won. */
  biddingWeightStanceHeadline: number;

  // The number their people announce before anybody bids.
  /** Multiple of their own valuation a wrestler with no ego at all would name. */
  biddingMinimumBase: number;
  /** ...and how much further a big opinion of themselves pushes it. */
  biddingMinimumEgoRange: number;
  /** Wobble on the announced number, so it cannot be computed exactly. */
  biddingMinimumNerve: number;
  /** How much of their own future a wrestler counts when valuing themselves. */
  biddingSelfRegardFuture: number;
  /** Rounds of offers. Only a wrestler can call for another, and only so often. */
  biddingMaxRounds: number;

  // How hungry a company already is, and how far it will occasionally go.
  /** Roster strength at which a company stops being desperate for a name. */
  biddingRosterFullAt: number;
  /** How many of a roster's best count toward "how good are they". */
  biddingRosterTopN: number;
  biddingKeennessHunger: number;
  /** ...and how much it cares whether he is the kind of wrestler it sells. */
  biddingKeennessFit: number;
  /** Chance a company decides this is the signing that defines its year. */
  biddingBigSwingChance: number;
  /** How far past their usual ceiling that takes them. */
  biddingBigSwingMultiple: number;

  // What a booker will risk. Nobody bids with money they do not have.
  biddingRunwayWeeksMin: number;
  biddingRunwayWeeksRange: number;

  // How somebody reads the length of a deal.
  /** How much having little to lose pulls them toward a long, safe contract. */
  biddingTermSecurityPull: number;
  /** ...and how much a big opinion of themselves pushes them the other way. */
  biddingTermEgoPush: number;

  // How keen a rival is, 0-1, and what that keenness buys.
  biddingKeennessBase: number;
  biddingKeennessLift: number;
  biddingKeennessUpside: number;
  biddingKeennessYouth: number;
  /** Age either side of which somebody counts as young or old, throughout. */
  biddingYouthPivot: number;
  biddingRivalMaxClauses: number;
  /** A signing bonus is quoted as this many weeks of rate. */
  biddingBonusWeeks: number;
  biddingMinWeeks: number;
  biddingMaxWeeks: number;
  /** Guarantee on a contract written from a winning bid without ironClad. */
  biddingBaseGuarantee: number;

  // What the wrestler weighs. These are the whole design of the feature.
  biddingWeightMoney: number;
  biddingWeightBonus: number;
  biddingWeightTerm: number;
  biddingWeightClauses: number;
  biddingWeightStanding: number;
  biddingWeightLoyalty: number;
  biddingWeightHome: number;
  /** Money stops helping past this multiple of the asking rate. */
  biddingMoneyCeiling: number;
  /** How many clauses' worth of appeal counts as a full sweetener package. */
  biddingClauseSaturation: number;
  /** Appeal of a clause with no specific reading. */
  biddingUnlistedClauseAppeal: number;
  /** Seeded noise on the final decision. Small — it breaks ties, not offers. */
  biddingGutFeeling: number;
  /** Score gap under which the result reads as having come down to one thing. */
  biddingCloseCall: number;

  // --- Second generation, engine/career/lineage.ts -------------------------
  secondGenerationEnabled: boolean;
  /** Peak popularity a parent needed for the surname to mean anything. */
  secondGenMinParentPopularity: number;
  /** How long ago the parent debuted before a child of theirs could be old enough. */
  secondGenParentDebutedYearsAgo: number;
  /** Nobody fields a whole dynasty at once. */
  secondGenMaxChildren: number;
  /** Chance each graduate turns out to be somebody's kid. */
  secondGenChancePerGraduate: number;
  /** How deep into the list of available names the draw reaches. */
  secondGenParentShortlist: number;
  /** Share of the parent's peak the name is worth at debut. */
  secondGenInheritedShare: number;
  /** ...and the ceiling on it, so a legend's kid is not a made main-eventer. */
  secondGenInheritedCap: number;
  /** Share of the parent's standing in each of their towns that carries over. */
  secondGenTownShare: number;
  /** How far the child's charisma is pulled toward the parent's. */
  secondGenCharismaPull: number;
  /** Chance each heritable appearance trait comes from the parent. */
  secondGenResemblance: number;
  /** How long the crowd gives them on the name alone. */
  secondGenPatienceWeeks: number;
  /** Matches before the record is worth reading. */
  secondGenProofMatches: number;
  /** Win rate that settles it. */
  secondGenProofWinRate: number;
  /** ...or this much popularity built on top of what they were handed. */
  secondGenProofPopularityGain: number;
  /** Popularity lost per week once the patience is gone and nothing was proven. */
  secondGenFadePerWeek: number;
  /** The fade never takes them below what any rookie would have had. */
  secondGenFadeFloor: number;
  /** Added to their morale expectation, permanently. The name is a standard. */
  secondGenExpectationBurden: number;
  relationshipsEnabled: boolean;
  hallOfFameEnabled: boolean;
}

export type WorldPresetName = 'territoryDays' | 'standard' | 'bigMoney' | 'sinkOrSwim' | 'backyard' | 'custom';

// ============================================================================
// §17 — Owner and mandates (types only; system lands in M5)
// ============================================================================

export type OwnerPersonality = 'traditionalist' | 'showman' | 'pennyPincher' | 'hardcore' | 'starChaser' | 'nostalgic';

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
