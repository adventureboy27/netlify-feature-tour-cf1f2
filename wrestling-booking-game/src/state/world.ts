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
import type { PublicationPositions } from '../engine/world/publication';
import type { GimmickReactionSubject, Tweet } from '../engine/world/fanReaction';
import type { PoachingOffer } from '../engine/world/poaching';
import type { FreeAgent } from '../engine/world/freeAgents';
import { generateFreeAgentPool } from '../engine/world/freeAgents';
import { createRefereeContract, seedRefereePool } from '../engine/sim/referees';
import type { Manager } from '../engine/sim/ringside';
import type { WireItem } from '../engine/world/wire';
import type { MemoriamShow } from '../engine/world/seasons';
import type { WeatherCall } from '../engine/world/weatherCall';
import type { RingCall, RingCallOptionId } from '../engine/world/ringCall';
import type { TruckCall, TruckCallOptionId } from '../engine/world/truckBreakdown';
import type { ContractRaidCall } from '../engine/world/contractRaid';
import type { NetworkDemandCall } from '../engine/world/networkDemand';
import type { FarewellTourCall } from '../engine/world/farewellTour';
import type { RivalPricing } from '../engine/world/pricing';
import { randomRivalPricingFor } from '../engine/world/pricing';
import type { NoShowCall, NoShowChoiceId } from '../engine/world/noShowCall';
import type { TitleMemorial } from '../engine/world/titleMemorial';
import type { RivalMove } from '../engine/world/rivalMove';
import type { ConfrontationCall } from '../engine/world/confrontationCall';
import type { BiddingResult, BiddingWar } from '../engine/economy/bidding';
import type { WeatherCallOptionId } from '../data/weatherCalls';
import type { RatingResult, ChartRow } from '../engine/world/tvRatings';
import type { PendingEvent } from '../engine/events/types';
import type { EventHistory } from '../engine/events/scheduler';
import { emptyEventHistory } from '../engine/events/scheduler';
import type { Rng } from '../engine/rng';
import { pick, randInt, rngFromSeed } from '../engine/rng';
import { assignCommentaryTeam } from '../engine/sim/commentary';
import { COMMENTARY_TEAMS } from '../data/commentators';
import { generateWrestlers } from '../engine/generate/wrestler';
import { createRivalry } from '../engine/sim/rivalry';
import { createStandardContract } from '../engine/economy/contracts';
import { hasTrait } from '../engine/career/personality';
import { createStartingTitles, awardTitle } from '../data/titles';
import { styleProfileFor, PROMOTION_ARCHETYPES } from '../data/promotionIdentity';
import type { PromotionArchetype } from '../data/promotionIdentity';
import { defaultFanTaste } from '../engine/world/fanTaste';
import { applyRosterEntry, type RosterEntry } from '../engine/world/roster-io';
import { seedRelationships } from '../engine/career/relationships';
import type { SupershowBooking, SupershowOffer, SupershowResult } from '../engine/world/supershowRun';
import type { CupResult } from '../engine/world/cupRun';
import type { WeeklyStatement } from '../engine/economy/statement';
import type { Residency } from '../engine/economy/residency';
import type { Grudge } from '../engine/world/grudges';
import type { CrownReign } from '../engine/world/cup';

/** What the promoters put in front of the booker each August. */
export interface CupInvitation {
  year: number;
  fee: number;
  /** Companies expected in, the player aside. */
  likelyField: number;
  slotsEach: number;
  estimatedPot: number;
  expiresWeek: number;
}
import { formTeams, teamIdFactory, tagTeamCountFor } from '../engine/world/tagTeams';
import { bestFittingVenue, venueById } from '../data/venues';
import { cardSizeTierById } from '../data/cardSize';
import { computeDemand, fairTicketPrice, potentialAudience } from '../engine/economy/showBudget';
import { TERRITORIES, createTerritories } from '../data/territories';
import { OWNER_PROFILES } from '../data/owners';
import { ppvCalendarFor } from '../data/ppvNames';
import { defaultSchedule, scheduleForRival, type ShowKind } from '../engine/world/schedule';
import type { ImpromptuShow } from '../engine/world/impromptu';
import { seedManagerTalent } from '../engine/world/managerTalent';
import type { Representation } from '../engine/career/representation';
import { MANAGERS } from '../data/ringsidePool';
import { DEFAULT_PACE } from '../data/pacing';
import type { AttendanceRecord } from '../engine/world/territories';
import type { AssetCondition } from '../engine/economy/showBudget';
import type { OwnedPropUnit } from '../engine/economy/matchProps';
import type { ActiveLoan } from '../engine/economy/loan';
import type { ContractDemand } from '../engine/career/ego';

export const SEGMENTS_PER_CARD = 6; // matches WorldSettings.segmentsPerTV default

/**
 * One promotion as the new-game screen built it, rather than as
 * `RIVAL_PROMOTIONS` would have rolled it.
 *
 * `roster: 'generate'` is a normal procedurally-rolled company, same as
 * every rival always has been. A `RosterEntry[]` is a company signed
 * straight off an imported file — every name in it gets a contract and a
 * spot, nothing held back to a free-agent pool the way a plain
 * `importRosterFile` would (see state/store.ts).
 */
export interface PromotionPlanSlot {
  name: string;
  /** Rolled randomly if omitted — nobody is asked to pick a house style for every company they type in. */
  archetype?: PromotionArchetype;
  roster: 'generate' | RosterEntry[];
}

export interface NewGamePlan {
  /** 1-7 promotions, in display order. */
  slots: PromotionPlanSlot[];
  /** Which slot the booker is playing as. Everyone else is a rival. */
  playerIndex: number;
}

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
  /**
   * Optional matches that never air. They don't consume a card spot and
   * don't move the TV rating, same principle as the promo slots above — see
   * engine/sim/darkMatch.ts.
   */
  currentDarkMatches: Segment[];
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
   * What each rival charges — ticket, merch, PPV — for the pricing dashboard
   * only. Randomised once per rival (engine/world/pricing.ts) and never read
   * by rivalEconomy.ts's actual revenue math, same as everything else about
   * a rival's books being a summary rather than a ledger. Keyed by rival id;
   * a folded rival's entry is simply never looked at again.
   */
  rivalPricing: Record<Id, RivalPricing>;
  /**
   * The billionaire pricing war — one conglomerate half pricing below cost
   * for a real stretch of weeks (engine/world/pricingWar.ts). Null when
   * nobody is running one; only one can run at a time.
   */
  pricingWar: { rivalId: Id; weeksRemaining: number } | null;
  /**
   * A hostile politician's licensing bill — roughly two-thirds of every
   * promotion's roster frozen at once, industry-wide (engine/world/
   * paperworkLockout.ts). Null when nobody is caught up in one; only one can
   * run at a time. Which wrestlers are frozen lives on each Wrestler's own
   * paperworkFrozen, since every frozen wrestler shares this one clock.
   */
  paperworkLockout: { weeksRemaining: number } | null;
  /**
   * Last week's sheet, kept so this week's can show which way people moved.
   * The current one is derived on read — only the comparison needs storing.
   */
  lastPublication: PublicationPositions | null;
  /** What the fans said about the last show. */
  lastFanReaction: { week: number; verdict: string; tweets: Tweet[] } | null;
  /**
   * A folded promotion's roster, waiting on the booker to pick through it.
   * Anybody they want and a rival wants too goes to the bidding-war module;
   * whoever is left when they're done goes to free agency.
   */
  pendingFoldPicks: PendingFoldPicks | null;
  /**
   * Fold pickups the booker has already chosen that are contested, waiting
   * their turn — only one bidding war can run at a time.
   */
  foldBidQueue: Id[];
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
  /**
   * Rival approaches sitting on the desk, awaiting your answer — you always
   * get one first. See engine/world/poaching.ts.
   */
  approachOffers: PoachingOffer[];
  /** One-time production purchases. They travel to every show. */
  ownedAssetIds: Id[];
  /** Rungs of the production ladder owned, in the order they were bought. */
  productionRungs: Id[];
  /** Which truck the operation runs on. Everything owned has to fit in it. */
  haulageId: Id;
  /**
   * Which data/cardSize.ts tier the player's TV show is booked at — a
   * replacement ladder like haulageId, not a stack like productionRungs.
   * Decoupled from the venue and from the production ladder on purpose; see
   * cardSizeFor. Rivals don't have one — they still read settings.segmentsPerTV
   * directly, unaffected by anything the player buys.
   */
  cardSizeTierId: Id;
  /** The books, newest last. One per week the company traded. */
  statements: WeeklyStatement[];
  /**
   * A season signed for one room, or null while the company tours. Cheaper
   * rent, no travel and no truck, and a town that tires of you.
   */
  residency: Residency | null;
  /**
   * What rival companies remember about working with you. Earned on joint
   * cards and faded week by week — see engine/world/grudges.ts.
   */
  grudges: Grudge[];
  /** How worn each owned asset is. Gear does not last forever. */
  assetConditions: AssetCondition[];
  /**
   * Literal match hardware — ladders, cages, tables — owned in individual,
   * separately-worn units. Distinct from ownedAssetIds/productionRungs,
   * which model house gear (a ring, a truck) as single-owned capital. See
   * engine/economy/matchProps.ts.
   */
  ownedPropUnits: OwnedPropUnit[];
  /** Contract renewals waiting on an answer, opened when a deal runs down. */
  pendingRenewals: RenewalOffer[];
  /** The renewal-window conversation, opened while there's still time on the deal. See RenewalTalk. */
  renewalTalks: RenewalTalk[];
  /** The "meet the booker" signing conversation, opened once per new signee. See SigningTalk. */
  signingTalks: SigningTalk[];
  /** The forced cold-meeting, opened once an act has been ice cold too long. See ColdMeeting. */
  coldMeetings: ColdMeeting[];
  /**
   * Gimmick decisions waiting for the crowd's reaction — a debut, a new
   * pairing, a relaunch — queued the moment the booker makes the call and
   * drained into the fan-tweet feed the next time the player's own show
   * actually runs. See engine/world/fanReaction.ts's GimmickReactionSubject.
   */
  pendingGimmickReactions: GimmickReactionSubject[];
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
   * How many loans this promotion has taken across the whole save. Never
   * resets — good behaviour earns back access (see
   * solventWeeksSinceLastLoan), not a clean record. See economy/loan.ts.
   */
  loansTaken: number;
  /**
   * Solvent weeks, loan-free, since the last loan was fully repaid — the
   * cooldown clock for the next offer. Any red week, or any week still
   * repaying, resets it to 0; only demonstrated recovery counts.
   */
  solventWeeksSinceLastLoan: number;
  /** A loan offer waiting on an answer. See economy/loan.ts. */
  pendingLoanOffer: PendingLoanOffer | null;
  /** The loan currently being paid off, if any. Auto-deducted every week; cannot be deferred. */
  activeLoan: ActiveLoan | null;
  /** A rival's blind bulk offer for a slice of the roster. See economy/buyout.ts. */
  pendingBuyoutOffer: PendingBuyoutOffer | null;
  /**
   * Solvent weeks since the last release, of any kind — same cooldown shape
   * as solventWeeksSinceLastLoan. Any red week, or any release, resets it to
   * 0; free agents stay wary of the promotion until it clears. See
   * economy/releaseStigma.ts.
   */
  solventWeeksSinceLastRelease: number;
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
   * A worn ring's warning, waiting on a decision — same shape as
   * pendingWeatherCall, and the same reason: the week does not resolve
   * until it's answered.
   */
  pendingRingCall: RingCall | null;
  /** The truck never arrived at all — same shape as pendingRingCall, an unrelated trigger. */
  pendingTruckCall: TruckCall | null;
  /**
   * A wrestler booked tonight simply never turns up, rolled by the
   * catastrophe system (engine/world/catastrophe.ts) rather than the
   * ordinary weekly misfortune roll — rare enough to be a real decision
   * instead of a silent swap. Same shape as the weather call: the week does
   * not resolve until it is answered.
   */
  pendingNoShowCall: NoShowCall | null;
  /** What was decided about the no-show, carried into the resolve that follows. */
  noShowChoice: NoShowChoiceId | null;
  /**
   * A champion is hurt and the booker has not said what to do about the belt.
   * Unlike the weather this does not hold the week open — the show goes on —
   * but it does expire: leave it long enough and the company vacates the
   * title for you, and says so.
   */
  pendingChampionCall: ChampionCall | null;
  /**
   * A rival's lawyers already found the holes and already signed the
   * wrestlers away — this is only the aftermath decision. Same shape as
   * pendingChampionCall: does not hold the week open, but does expire.
   */
  pendingContractRaid: ContractRaidCall | null;
  /**
   * A network you already signed with wants a say in who's on the card —
   * same non-blocking, expiring shape as pendingContractRaid. Only ever
   * rolled while broadcastDealId is set.
   */
  pendingNetworkDemand: NetworkDemandCall | null;
  /**
   * A legend's farewell tour offer — raised by the world-story registry,
   * resolved the same non-blocking, expiring way as pendingContractRaid.
   * Once ever, business-wide.
   */
  pendingFarewellTour: FarewellTourCall | null;
  /**
   * A champion died holding one of this promotion's belts. Unlike the
   * tribute show (applied automatically) this is a real decision — what
   * happens to the lineage — and it does not block the week either; the
   * booker answers it whenever they next visit the office.
   */
  pendingTitleMemorial: TitleMemorial | null;
  /**
   * A rival just signed somebody worth reacting to. Non-blocking, like the
   * champion call and the title memorial — the booker answers whenever they
   * next visit the office, or never, and nothing breaks either way.
   */
  pendingRivalMove: RivalMove | null;
  /**
   * A confrontation went physical tonight and the injury itself is waiting
   * on the booker — see confrontationCall.ts. The segment's own rating and
   * write-up already resolved; only the casualty is on hold, and only until
   * the booker's next office visit — nothing forces an answer.
   */
  pendingConfrontationCall: ConfrontationCall | null;
  /**
   * The one auction the business runs in the open. Rare: it takes a real star
   * hitting the market, or a phenom out of the school, plus at least two other
   * companies with the money to enter. Resolves whether or not the booker
   * answers — the room does not wait.
   */
  pendingBiddingWar: BiddingWar | null;
  /** A rival's standing offer to run a joint PPV (§16), waiting on an answer. */
  pendingSupershow: SupershowOffer | null;
  /**
   * A signed joint show with a card on the table (§16). Both offices strike
   * pairings out of it before the bell; theirs have already been struck by the
   * time the player sees it. Cleared when the night is worked.
   */
  pendingSupershowCard: SupershowBooking | null;
  /** The last joint show, kept so the results screen can report the night. */
  lastSupershow: SupershowResult | null;
  /** Week the booker last put a joint show to somebody. Stops him touting daily. */
  lastSupershowApproachWeek: number | null;
  /** Which calendar season last produced an offer, e.g. "2031-May". */
  lastSupershowSeason: string | null;
  /** The Crucible's invitation, waiting on the fee (§16-adjacent, see cup.ts). */
  pendingCupEntry: CupInvitation | null;
  lastCup: CupResult | null;
  /** Who carries the Iron Crown, until somebody takes it off them. */
  crown: CrownReign | null;
  /** Year of the last Crucible, so one year cannot run two. */
  lastCupYear: number | null;
  /** Every Crucible ever run, newest last. The permanent record. */
  cupHistory: CrownReign[];
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
  ringCallChoice: RingCallOptionId | null;
  truckCallChoice: TruckCallOptionId | null;
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
  /**
   * Shows that were not on the calendar — a memorial, a benefit night. Kept
   * on the world rather than on the promotion because they belong to a *week*
   * rather than to the pattern. See engine/world/impromptu.ts.
   */
  impromptuShows: ImpromptuShow[];
  /**
   * Who represents whom, and for what percentage. A manager earns from his
   * book rather than from a nightly fee — see engine/career/representation.ts.
   */
  representations: Representation[];
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
  /**
   * Whether the one-time billionaire merger (engine/world/merger.ts) has
   * already happened this save. Checked before every weekly roll so it can
   * never fire twice — see WorldSettings.mergerEarliestWeek.
   */
  mergerHappened: boolean;
  /** Rival promotion ids that have already been through succession (engine/world/succession.ts) — can happen once per rival, not once ever. */
  successionHappenedFor: Id[];
  /**
   * Generic per-story "already happened to this rival" tracking, keyed by
   * world-story id — the same shape as successionHappenedFor, generalized
   * rather than adding a new dedicated array field for every story that
   * only needs "once per rival." Absent key means nobody yet.
   */
  worldStoryHappenedFor: Record<string, Id[]>;
  /**
   * Stipulation ids the player has actually earned — see Stipulation.locked.
   * Empty on a fresh save; a locked stipulation never appears in the picker
   * until its id lands here (Arena Floor, from engine/world/truckBreakdown.ts).
   */
  unlockedStipulationIds: Id[];
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

/** A folded promotion's roster, open for the booker to pick through. */
export interface PendingFoldPicks {
  fromPromotionId: Id;
  fromPromotionName: string;
  wrestlerIds: Id[];
  openedWeek: number;
}

/** A loan offer waiting on an answer. See economy/loan.ts. */
export interface PendingLoanOffer {
  attemptNumber: number;
  openedWeek: number;
  /** The payroll the ceiling was sized against — fixed at the moment the offer opened. */
  payrollAtOffer: number;
}

/** A rival's blind bulk buyout offer waiting on an answer. See economy/buyout.ts. */
export interface PendingBuyoutOffer {
  openedWeek: number;
  fromPromotionId: Id;
  fromPromotionName: string;
  /** How many contracts, known up front. Who, not known until accepted. */
  count: number;
  price: number;
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
 * How many TV segments the player's own show has room for — read through the
 * owned data/cardSize.ts tier rather than the flat settings.segmentsPerTV
 * every other promotion still uses. PPV size is untouched by this ladder;
 * pass 'ppv' for the unmodified settings.segmentsPerPPV. Rivals never call
 * this — engine/world/rivalBooking.ts still reads settings.segmentsPerTV
 * directly, on purpose: nothing the player buys touches anyone else's show.
 */
export function cardSizeFor(kind: ShowKind, world: Pick<World, 'settings' | 'cardSizeTierId'>): number {
  if (kind === 'ppv') return world.settings.segmentsPerPPV;
  return cardSizeTierById(world.cardSizeTierId)?.slots ?? world.settings.segmentsPerTV;
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

/**
 * Optional matches that never air — see engine/sim/darkMatch.ts. Two a night
 * by default, same shape as the promo slots above: they sit alongside the
 * card rather than inside it.
 */
export function createEmptyDarkMatches(count: number): Segment[] {
  return Array.from({ length: count }, (_, i) => ({ ...createEmptySegment(i), dark: true }));
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

/**
 * One promotion, built from a new-game plan slot rather than from
 * `RIVAL_PROMOTIONS` and `settings.promotionName`/`promotionArchetype`.
 *
 * Used for every slot in a plan — the player's own included — which is why
 * `ctx.isPlayer` exists: everything else about the two is identical (the
 * whole point of the new flow is that a hand-named or imported company is
 * not a second-class citizen next to the one you would have generated
 * yourself).
 */
function buildPlannedPromotion(
  rng: Rng,
  settings: WorldSettings,
  slot: PromotionPlanSlot,
  ctx: {
    id: Id;
    isPlayer: boolean;
    /** Offsets the PPV calendar so no two promotions run the same night. */
    calendarOffset: number;
    ownerId: string;
    homeTerritoryId: Id;
    territoryIds: Id[];
    /** The whole business so far. Read for distinctness, and mutated with this promotion's roster. */
    wrestlers: Record<Id, Wrestler>;
  },
): Promotion {
  // Rolled randomly if the slot did not name one — nobody typing in eight
  // company names should also have to pick eight house styles.
  const archetype = slot.archetype ?? pick(rng, PROMOTION_ARCHETYPES);

  const existingNames = () => new Set(Object.values(ctx.wrestlers).map((w) => w.name.trim().toLowerCase()));

  let roster: Wrestler[];
  if (slot.roster === 'generate') {
    const size = ctx.isPlayer
      ? (settings.startingPlayerRosterSize ?? settings.startingRosterSize)
      : rivalRosterSize(settings.startingCompanyRating, settings);
    roster = generateWrestlers(rng, size, {
      settings,
      homeTerritoryIds: ctx.territoryIds,
      currentYear: settings.startingYear,
      divisionShare: settings.womensRosterShare,
      divisionFloor: settings.womensDivisionFloor,
      existingNames: existingNames(),
    });
  } else {
    // Generation runs first, exactly like a plain roster-file import — see
    // importRosterFile in state/store.ts — and the file overwrites what it
    // names. The difference here is where the result lands: straight onto
    // this promotion's roster with a signed contract, not the free-agent
    // pool. A name collision is dropped rather than crashing the whole
    // import; the UI checked for that before it ever got here, so it should
    // not happen, but a new-game screen has to survive a bad file (§0 —
    // nothing silently corrupts a save, and nothing throws either).
    const entries = slot.roster;
    const base = generateWrestlers(rng, entries.length, {
      settings,
      homeTerritoryIds: ctx.territoryIds,
      currentYear: settings.startingYear,
      existingNames: existingNames(),
    });
    const taken = existingNames();
    roster = [];
    entries.forEach((entry, i) => {
      const genBase = base[i];
      if (!genBase) return;
      if (taken.has(entry.name.trim().toLowerCase())) return;
      const wrestler = applyRosterEntry(genBase, entry);
      taken.add(wrestler.name.trim().toLowerCase());
      roster.push(wrestler);
    });
  }

  for (const w of roster) {
    w.promotionId = ctx.id;
    w.contract = createStandardContract(w, settings, settings.startingYear);
    // Staggered, not uniform — same reason as every other opening roster in
    // this file: a fixed term for the whole company means every deal in it
    // lapses in the same week, years from now, and the business quietly
    // empties itself in one turn nobody saw coming.
    w.contract.weeksRemaining = randInt(rng, settings.openingContractMinWeeks, settings.openingContractMaxWeeks);
    w.contract.totalWeeks = Math.max(w.contract.totalWeeks, w.contract.weeksRemaining);
    ctx.wrestlers[w.id] = w;
  }

  const calendar = ppvCalendarFor(archetype, settings.ppvCalendarSize, ctx.calendarOffset);

  return {
    id: ctx.id,
    name: slot.name,
    identity: archetype,
    ppvCalendar: calendar,
    schedule: ctx.isPlayer
      ? defaultSchedule(rng, slot.name, calendar, settings)
      : scheduleForRival(
          rng,
          { name: slot.name, rating: settings.startingCompanyRating, identity: archetype },
          calendar,
          settings,
        ),
    isPlayer: ctx.isPlayer,
    // Identical across every promotion, imported or generated, player or
    // rival — an explicit design call, not a default left unconsidered: a
    // hand-built world starts everybody on the same footing, and it is the
    // booking from week one that pulls a company ahead or behind.
    rating: settings.startingCompanyRating,
    bankBalance: settings.startingCash,
    rosterIds: roster.map((w) => w.id),
    titleIds: [],
    ownedTerritoryIds: [],
    homeTerritoryId: ctx.homeTerritoryId,
    styleProfile: styleProfileFor(archetype),
    bookingCredibility: 50,
    reputation: settings.startingCompanyRating,
    hardcoreSaturation: 0,
    fanTaste: defaultFanTaste(archetype),
    recentShowQuality: settings.startingCompanyRating,
    weeksInTheRed: 0,
    closedWeek: null,
    commentaryTeam: ctx.isPlayer
      ? assignCommentaryTeam(rngFromSeed(`${settings.seed}-broadcast`), COMMENTARY_TEAMS, new Set())
      : undefined,
    ownerId: ctx.ownerId,
    ownerPersonality: pick(rng, OWNER_PROFILES).id,
  };
}

export function createInitialWorld(rng: Rng, settings: WorldSettings, plan?: NewGamePlan): World {
  // Everybody in the business comes from somewhere. Wrestler.homeTerritoryId
  // has been on the type since the beginning and was written as the literal
  // 'territory-unassigned' for every single person ever generated — see
  // engine/career/reach.ts, which is what finally reads it.
  const territoryIds = TERRITORIES.map((t) => t.id);
  // Hoisted above the branch below: a plain settings->room lookup, needed by
  // both the procedural path (as the promotion's own home) and the planned
  // one (buildPlannedPromotion needs it for the player's ctx before the
  // promotion object exists).
  const startingSetup = defaultShowSetup(settings);

  const wrestlers: Record<Id, Wrestler> = {};
  let roster: Wrestler[];
  let promotion: Promotion;

  // Free agents, then managers built from them — factored out so both the
  // planned and procedural paths can run it at the exact point in the RNG
  // stream the procedural path always has, rather than duplicating it.
  // See the trap in CLAUDE.md: moving an rng-consuming step shifts every
  // seeded draw after it, and the procedural path's tests are pinned to the
  // sequence as it has always run — roster, then this, then the promotion.
  let pool!: ReturnType<typeof generateFreeAgentPool>;
  let managers!: ReturnType<typeof seedManagerTalent>;
  const buildSupportPool = (rosterSoFar: readonly Wrestler[]) => {
    // Everyone else in the business. Generated after the roster so the
    // distinctness check (§7) sees the signed talent first.
    pool = generateFreeAgentPool(
      rng,
      settings,
      new Set(rosterSoFar.map((w) => w.name.trim().toLowerCase())),
    );
    for (const agent of pool.wrestlers) wrestlers[agent.id] = agent;

    // Managers, as people. Free agents every one of them — a company that
    // wants a mouthpiece signs one the same as it signs anybody, and a rival
    // can get there first. Before this they were a static rental list with
    // no contract, no wage and nothing to poach. See engine/world/managerTalent.ts.
    const managerBodies = generateWrestlers(rng, MANAGERS.length, {
      settings,
      currentYear: settings.startingYear,
      existingNames: new Set(
        [...rosterSoFar, ...pool.wrestlers].map((w) => w.name.trim().toLowerCase()),
      ),
    });
    managers = seedManagerTalent(rng, MANAGERS, managerBodies, settings.startingYear, settings);
    for (const manager of managers.wrestlers) wrestlers[manager.id] = manager;
  };

  if (plan) {
    // The new-game screen built a plan — see PromotionPlanSlot. Every slot,
    // player included, goes through the same builder; nothing here is a
    // special case for "the player's own company."
    const playerSlot = plan.slots[plan.playerIndex];
    if (!playerSlot) throw new Error('New-game plan has no slot at playerIndex.');
    promotion = buildPlannedPromotion(rng, settings, playerSlot, {
      id: 'player-promotion',
      isPlayer: true,
      calendarOffset: 0,
      ownerId: randomId(rng, 'owner'),
      homeTerritoryId: startingSetup.territoryId,
      territoryIds,
      wrestlers,
    });
    roster = promotion.rosterIds.map((id) => wrestlers[id]!);
    buildSupportPool(roster);
  } else {
    // Always the player — the procedural path only ever runs for a single,
    // generated promotion (no plan means no rivals-at-creation slots).
    roster = generateWrestlers(rng, settings.startingPlayerRosterSize ?? settings.startingRosterSize, {
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
    for (const w of roster) {
      w.promotionId = 'player-promotion';
      // Every one of them is on a plain deal. Before this, contracts were null
      // across the board and payroll silently computed to zero.
      w.contract = createStandardContract(w, settings, settings.startingYear);
      // Staggered, exactly as the rivals' are below — and this is the half that
      // was missing. A fixed two-year term for the whole opening roster meant
      // twenty-six deals signed in week one all lapsed in week 105; a measured
      // save went from twenty-six people to nobody in that single week, with two
      // million in the bank and no booking decision that could have stopped it.
      w.contract.weeksRemaining = randInt(
        rng,
        settings.openingContractMinWeeks,
        settings.openingContractMaxWeeks,
      );
      w.contract.totalWeeks = Math.max(w.contract.totalWeeks, w.contract.weeksRemaining);
      wrestlers[w.id] = w;
    }
    buildSupportPool(roster);

    promotion = {
      id: 'player-promotion',
      name: settings.promotionName,
      identity: settings.promotionArchetype,
      ppvCalendar: ppvCalendarFor(settings.promotionArchetype, settings.ppvCalendarSize, 0),
      // Two nights a week and a monthly big one — the shape the business
      // settled on, so a player who never opens the schedule screen starts
      // somewhere deliberate rather than somewhere accidental.
      schedule: defaultSchedule(
        rng,
        settings.promotionName,
        ppvCalendarFor(settings.promotionArchetype, settings.ppvCalendarSize, 0),
        settings,
      ),
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
      fanTaste: defaultFanTaste(settings.promotionArchetype),
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
  }

  // The officials. Everybody starts unsigned except the one warm body you
  // inherited — competent enough to keep a match together, not good enough to
  // survive six of them in a night.
  const referees = seedRefereePool();
  const startingReferee = referees.find((r) => r.id === 'ref-poole');
  if (startingReferee) {
    startingReferee.promotionId = promotion.id;
    startingReferee.contract = createRefereeContract(startingReferee, settings, settings.startingYear);
  }

  let rivals: Promotion[];
  if (plan) {
    // Same builder as the player, once per slot that isn't theirs — the
    // whole point of the planned path is that a rival is not generated any
    // differently from how it would have been if the player had chosen it.
    rivals = plan.slots.flatMap((slot, i) => {
      if (i === plan.playerIndex) return [];
      return [
        buildPlannedPromotion(rng, settings, slot, {
          id: `rival-${i}`,
          isPlayer: false,
          calendarOffset: i + 1,
          ownerId: `owner-rival-${i}`,
          homeTerritoryId: 'territory-unassigned',
          territoryIds,
          wrestlers,
        }),
      ];
    });
  } else {
    rivals = createRivalPromotions(rng, settings);

    // Every rival is staffed. A promotion with a name and no wrestlers cannot
    // run a show, and until they run shows they are scenery.
    for (const rival of rivals) {
      const size = rivalRosterSize(rival.rating, settings);
      const signed = generateWrestlers(rng, size, {
        // Rolls what the business believes about them, as against what is true.
        settings,
        // Every company's roster is built to the split, not just yours.
        divisionShare: settings.womensRosterShare,
        divisionFloor: settings.womensDivisionFloor,
        homeTerritoryIds: territoryIds,
        currentYear: settings.startingYear,
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
          settings.openingContractMinWeeks,
          settings.openingContractMaxWeeks,
        );
        wrestlers[w.id] = w;
      }
      rival.rosterIds = signed.map((w) => w.id);
    }
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

  // Pair up everybody who drew Somebody At Home. The trait is about missing a
  // particular person, so it needs a particular person — and the pairing is
  // deliberately across companies, because a couple already on the same roster
  // is not a decision the booker has to make anything of. Signing one of them
  // is signing half of a problem, and the other half is somebody else's.
  const lonely = Object.values(wrestlers).filter((w) => hasTrait(w, 'somebodyAtHome') && !w.attachedTo);
  for (const person of lonely) {
    const match = lonely.find(
      (other) => other.id !== person.id && !other.attachedTo && other.promotionId !== person.promotionId,
    );
    if (!match) continue;
    person.attachedTo = match.id;
    match.attachedTo = person.id;
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

  // A tier the player owns from turn one, same shape as haulageId's
  // 'pickup' below — most presets open on the tier matching today's flat
  // segmentsPerTV (6, 'localCard'); backyard opens on the bottom rung
  // instead. See data/cardSize.ts.
  const cardSizeTierId = settings.startingCardSizeTierId ?? 'localCard';

  return {
    version: 5,
    settings,
    week: 1,
    wrestlers,
    promotion,
    currentCard: createEmptyCard(cardSizeTierById(cardSizeTierId)?.slots ?? settings.segmentsPerTV),
    currentPromos: createEmptyPromoSlots(settings.promoSlotsPerCard),
    currentDarkMatches: createEmptyDarkMatches(settings.darkMatchSlots),
    showHistory: [],
    rivalries: seedShootRivalries(roster),
    // Nothing is named at the start. The booker names what they build.
    storylines: [],
    tournaments: [],
    stables,
    rivals,
    rivalPricing: randomRivalPricingFor(rivals.map((r) => r.id), settings),
    pricingWar: null,
    paperworkLockout: null,
    rivalShows: [],
    lastIncidents: [],
    lastPublication: null,
    lastFanReaction: null,
    pendingFoldPicks: null,
    foldBidQueue: [],
    tvHistory: [],
    pendingEvent: null,
    lastEventOutcome: null,
    eventHistory: emptyEventHistory(),
    approachOffers: [],
    ownedAssetIds: [],
    // You start on a wooden mat, on a pickup and a rented trailer. Everything
    // on the ladder is somewhere above you — see economy/production.ts.
    productionRungs: [],
    haulageId: 'pickup',
    cardSizeTierId,
    statements: [],
    // Touring, until somebody signs for a room. See economy/residency.ts.
    residency: null,
    // Nobody has worked with you yet, so nobody has an opinion.
    grudges: [],
    assetConditions: [],
    // Nobody starts with a ladder, a cage, or a table — see engine/economy/matchProps.ts.
    ownedPropUnits: [],
    pendingRenewals: [],
    renewalTalks: [],
    signingTalks: [],
    coldMeetings: [],
    pendingGimmickReactions: [],
    showSetup: startingSetup,
    weeksInTheRed: 0,
    folded: null,
    loansTaken: 0,
    solventWeeksSinceLastLoan: 0,
    pendingLoanOffer: null,
    activeLoan: null,
    pendingBuyoutOffer: null,
    solventWeeksSinceLastRelease: 0,
    pendingMemoriam: null,
    pendingWeatherCall: null,
    pendingRingCall: null,
    pendingTruckCall: null,
    pendingNoShowCall: null,
    noShowChoice: null,
    pendingChampionCall: null,
    pendingContractRaid: null,
    pendingNetworkDemand: null,
    pendingFarewellTour: null,
    pendingTitleMemorial: null,
    pendingRivalMove: null,
    pendingConfrontationCall: null,
    pendingBiddingWar: null,
    pendingSupershow: null,
    pendingSupershowCard: null,
    lastSupershow: null,
    lastSupershowApproachWeek: null,
    lastSupershowSeason: null,
    pendingCupEntry: null,
    lastCup: null,
    crown: null,
    lastCupYear: null,
    cupHistory: [],
    lastBiddingWar: null,
    secretSignings: [],
    weatherChoice: null,
    ringCallChoice: null,
    truckCallChoice: null,
    freeAgents: [...pool.freeAgents, ...managers.freeAgents],
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
    impromptuShows: [],
    representations: [],
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
    mergerHappened: false,
    successionHappenedFor: [],
    worldStoryHappenedFor: {},
    unlockedStipulationIds: [],
    nextId: 1,
  };
}

// DESIGN: rival promotions are full Promotions with their own roster and
// booking in §19/M5. What the player actually feels week to week is simpler:
// somebody is opposite them on television, drawing an audience, and sending
// people to talk to their talent. These are those promotions with a rating
// and a name — enough for TV ratings to be a real contest and for a rival
// approach to have a source. Giving them rosters and letting them book is the next
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
      // A regional outfit cannot be on the road five nights a week and a
      // national one cannot afford not to be, so the pattern follows the
      // company rather than being rolled flat.
      schedule: scheduleForRival(
        rng,
        { name, rating, identity: archetype },
        ppvCalendarFor(archetype, settings.ppvCalendarSize, i + 1),
        settings,
      ),
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
      fanTaste: defaultFanTaste(archetype),
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

/**
 * The renewal-window conversation, opened by resolveWeek once
 * `renewalWindowWeeks` is left on a deal — one entry per wrestler, stepping
 * through its own two stages in place rather than two separate lists.
 * 'askInterest' is the booker deciding whether the promotion wants them
 * back at all; 'askWrestler' is what happens once the answer was yes. See
 * answerRenewalInterest / answerRenewalWish.
 */
export interface RenewalTalk {
  wrestlerId: Id;
  stage: 'askInterest' | 'askWrestler';
  openedWeek: number;
}

/**
 * The "meet the booker" signing conversation — same shape as `RenewalTalk`,
 * stepping through its own stages in place. Opened once a new signee lands
 * on the roster (`signFreeAgent`, a folded-roster pickup, or winning a
 * bidding war). Every generated wrestler already has *a* gimmick — this is
 * the booker actually deciding instead of living with the roll. See
 * chooseSigningGimmick / chooseSigningDebut / declineSigningPairing /
 * formSigningGroup.
 */
export interface SigningTalk {
  wrestlerId: Id;
  stage: 'pickGimmick' | 'chooseDebut' | 'offerPairing';
  openedWeek: number;
}

/**
 * The forced cold-meeting — an act has sat at or under `iceColdThreshold`
 * for `coldMeetingTriggerWeeks` running (`Wrestler.weeksIceCold`), and the
 * booker has to actually do something about it. 'decide' is the booker
 * choosing a direction; 'pickGimmick' only exists once "try a new
 * direction" was chosen — releasing ends the meeting immediately instead.
 * See answerColdMeeting / chooseColdMeetingGimmick.
 */
export interface ColdMeeting {
  wrestlerId: Id;
  stage: 'decide' | 'pickGimmick';
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
  // A preset can pin exactly where it opens instead of leaving it to the
  // algorithm below — the backyard start needs to open in a literal
  // backyard, which bestFittingVenue would never pick on its own (it is
  // indoor-only by design, and a yard is not indoors). Every other preset
  // leaves both unset and gets the derived pick, unchanged.
  const venue = (settings.startingVenueId && venueById(settings.startingVenueId)) ||
    bestFittingVenue(settings.startingCompanyRating, potentialAudience(openingDemand, settings));
  const home =
    (settings.startingTerritoryId ? TERRITORIES.find((t) => t.id === settings.startingTerritoryId) : undefined) ??
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
    // The two lines that pay for themselves in the room a startup begins in.
    // Anything dearer than this is a decision the booker gets to make.
    standIds: ['programmes', 'shirts'],
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
    // Read off the belt itself rather than special-cased per tier — every
    // title always has a concrete `holdersRequired` by the time it reaches
    // here (createStartingTitles fills it from the tier if nothing set it
    // explicitly), so this crowns a trios champion three-deep and a custom
    // four- or five-holder belt just as correctly as it always crowned a tag
    // team. Before this it only ever read the count for 'tag' (hardcoded to
    // 2) and defaulted every other tier to 1 — including 'trios', which
    // meant a Six-Man Tag preset opened with a single champion, not three.
    const holders =
      title.tier === 'tag'
        ? bestFor(() => true, title.holdersRequired)
        : title.division === 'womens'
          ? bestFor((w) => w.gender === 'f', title.holdersRequired)
          : bestFor((w) => w.gender === 'm', title.holdersRequired);

    if (holders.length === 0) return title;
    return awardTitle(
      title,
      holders.map((w) => w.id),
      1,
      holders.map((w) => w.age),
    );
  });
}
