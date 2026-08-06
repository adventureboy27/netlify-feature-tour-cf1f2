// The other bookers.
//
// A rival with a name and a rating is a number on a chart. A rival that books
// its own card every week, defends its own belts, makes its own stars and
// occasionally puts on a better show than you did is competition. This is the
// difference between the two.
//
// The AI booker is deliberately simple and deliberately *consistent* with how
// the player books: it picks a card from its roster, puts the belt on the main
// event some of the time, and then the same `simulateMatch` decides what
// happens. It does not cheat — a badly run promotion with a thin roster puts
// on bad shows, drops down the ratings and loses ground, exactly like yours
// would.
//
// What separates good AI promotions from bad ones is entirely their roster and
// their booking credibility, both of which the player can attack: sign their
// talent away and their shows get worse.

import type { Rng } from '../rng';
import { chance, clamp, randInt } from '../rng';
import type { FinishType, Id, MatchRules, Promotion, Stable, Title, Wrestler, WorldSettings } from '../types';
import { availableTeams } from './tagTeams';
import { simulateMatch, type SimParticipant } from '../sim/simulateMatch';
import { computeShowRating, ratingToStars, TV_SLOT_WEIGHTS } from '../economy/showRating';
import { computeAftermath, type AftermathChange } from '../sim/aftermath';
import { houseStyleRatingBonus } from '../sim/houseStyle';
import { resolveTitleOutcomes, eligibleTitles, matchTitlePrestige, type TitleOutcome } from '../sim/titleMatch';
import { identityOf } from '../../data/promotionIdentity';
import { stipulationById } from '../../data/stipulations';

/**
 * What a rival's undercard match is, mechanically: a straight singles match
 * under normal rules. The AI does not book gimmick rules it cannot reason
 * about; its variety comes from its signature stipulation, below.
 */
const RIVAL_MATCH_RULES: MatchRules = {
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

/** A match the AI has decided to run, before it is simulated. */
export interface BookedMatch {
  sides: [Wrestler[], Wrestler[]];
  titleIds?: Id[];
  /** Set when the two sides are established teams, by side. */
  teamIds?: [Id, Id];
}

/**
 * Two teams worth putting opposite each other: the strongest available, and
 * then the closest match for them. A tag match between the top team and the
 * worst one on the roster is not a match, it is a squash.
 */
function pickOpposingTeams(rng: Rng, teams: Stable[], roster: readonly Wrestler[]): [Stable?, Stable?] {
  const strength = (team: Stable) => {
    const members = team.memberIds.map((id) => roster.find((w) => w.id === id));
    const found = members.filter((w): w is Wrestler => Boolean(w));
    if (found.length === 0) return 0;
    return found.reduce((sum, w) => sum + w.popularity, 0) / found.length;
  };

  const ranked = [...teams].sort((a, b) => strength(b) - strength(a));
  const first = ranked[randInt(rng, 0, Math.min(1, ranked.length - 1))]!;
  const rest = ranked.filter((t) => t.id !== first.id);
  if (rest.length === 0) return [first, undefined];

  // Whoever is closest in standing.
  const opponent = rest.reduce((best, team) =>
    Math.abs(strength(team) - strength(first)) < Math.abs(strength(best) - strength(first)) ? team : best,
  );
  return [first, opponent];
}

export interface RivalCard {
  matches: BookedMatch[];
}

/** One match on a rival's card, already resolved. */
export interface RivalMatch {
  participantIds: Id[];
  sides: number[];
  winnerIds: Id[];
  /** How it ended. The incident system reads this; it never sets it. */
  finish: FinishType;
  rating: number;
  stars: number;
  titleIds: Id[];
  titleOutcomes: TitleOutcome[];
  aftermath: AftermathChange[];
  stipulationId: Id | null;
  /** The teams involved, by side, when this was a tag match. */
  teamIds?: [Id, Id];
  /** Which side won, so the caller can credit the right team. */
  winnerSide: number | null;
}

export interface RivalShow {
  promotionId: Id;
  week: number;
  matches: RivalMatch[];
  showRating: number;
  showStars: number;
}

export interface RivalBookingContext {
  promotion: Promotion;
  /** Their roster, already filtered to who can work. */
  available: Wrestler[];
  /** Every title in the world; only theirs will be used. */
  titles: readonly Title[];
  /** Every group in the world. Their intact tag teams get booked as teams. */
  stables?: readonly Stable[];
  week: number;
  settings: WorldSettings;
}

/**
 * Can this person work tonight? Injured and exhausted wrestlers sit, the same
 * as they would on the player's card.
 */
export function canWork(w: Wrestler, settings: WorldSettings): boolean {
  if (w.injury) return false;
  if (w.deceased || w.careerStatus === 'retired') return false;
  // Somebody working as an official or a mouthpiece is not on the active
  // roster. Gating it here covers the office's card and every rival's, so
  // there is one answer to "can this person have a match" in the codebase.
  if (w.role !== 'wrestler') return false;
  return w.health >= settings.rivalMinHealthToBook;
}

/**
 * Build the card. The AI books the way a competent, unimaginative booker
 * does: best against best on top, and the rest paired off down the sheet by
 * standing, so the card gets smaller as it goes down.
 */
export function bookRivalCard(rng: Rng, ctx: RivalBookingContext): RivalCard {
  const roster = [...ctx.available].sort((a, b) => b.popularity + b.momentum * 0.3 - (a.popularity + a.momentum * 0.3));
  const segments = Math.min(ctx.settings.segmentsPerTV, Math.floor(roster.length / 2));

  const matches: BookedMatch[] = [];
  const spoken = new Set<Id>();

  // The tag match, booked between two actual teams rather than four people
  // who happened to be adjacent on the sheet. This is what gives the tag
  // division a lineage: the same two names defend, week after week.
  const rosterIds = new Set(roster.map((w) => w.id));
  const healthy = new Set(ctx.available.map((w) => w.id));
  const teams = availableTeams(ctx.stables ?? [], rosterIds, (id) => healthy.has(id));

  if (teams.length >= 2 && segments >= 2 && chance(rng, ctx.settings.rivalTagMatchChance)) {
    const [teamA, teamB] = pickOpposingTeams(rng, teams, roster);
    if (teamA && teamB) {
      const membersOf = (team: Stable) => team.memberIds.map((id) => roster.find((w) => w.id === id)!).filter(Boolean);
      const sideA = membersOf(teamA);
      const sideB = membersOf(teamB);
      if (sideA.length === 2 && sideB.length === 2) {
        matches.push({ sides: [sideA, sideB], teamIds: [teamA.id, teamB.id] });
        for (const w of [...sideA, ...sideB]) spoken.add(w.id);
      }
    }
  }

  // Bottom of the card first: the least important people are paired off, and
  // the two biggest names left are saved for the main event.
  const singles = roster.filter((w) => !spoken.has(w.id));
  const mainEventers = singles.slice(0, 2);
  const undercard = singles.slice(2).reverse();

  let i = 0;
  while (i + 1 < undercard.length && matches.length < segments - 1) {
    matches.push({ sides: [[undercard[i]!], [undercard[i + 1]!]] });
    i += 2;
  }
  if (mainEventers.length === 2) matches.push({ sides: [[mainEventers[0]!], [mainEventers[1]!]] });

  // Belts. A promotion that never defends its top title is not a promotion,
  // and one that defends something every week devalues everything. At most
  // one championship match a card, rolled per match so that a tag title
  // defence lands on the tag match rather than on the main event.
  let defences = 0;
  for (const match of matches) {
    if (defences >= ctx.settings.rivalMaxTitleDefencesPerCard) break;
    if (!chance(rng, ctx.settings.rivalTitleDefenceChance)) continue;

    const options = eligibleTitles(ctx.titles, {
      participants: match.sides.flatMap((members, side) => members.map((wrestler) => ({ wrestler, side }))),
      promotionId: ctx.promotion.id,
    });
    // The most prestigious belt these people can contest.
    const belt = [...options].sort((x, y) => y.prestige - x.prestige)[0];
    if (!belt) continue;

    match.titleIds = [belt.id];
    defences += 1;
  }

  return { matches };
}

/** The stipulation this promotion reaches for, if any. Their identity picks it. */
function houseStipulation(rng: Rng, ctx: RivalBookingContext): Id | null {
  if (!chance(rng, ctx.settings.rivalStipulationChance)) return null;
  return identityOf(ctx.promotion.identity).signatureBelt.stipulationId;
}

/**
 * Run a rival's week. Same simulation the player's show uses, so a rival's
 * four-star main event is a four-star main event by the same standard.
 */
export function runRivalShow(rng: Rng, ctx: RivalBookingContext): RivalShow | null {
  const card = bookRivalCard(rng, ctx);
  if (card.matches.length === 0) return null;

  const byId = new Map(ctx.available.map((w) => [w.id, w]));
  const matches: RivalMatch[] = [];
  const ratings: (number | null)[] = [];

  card.matches.forEach((booked, slot) => {
    const isMainEvent = slot === card.matches.length - 1;
    const stipulationId = isMainEvent ? houseStipulation(rng, ctx) : null;
    const stipulation = stipulationId ? (stipulationById(stipulationId) ?? null) : null;

    const everyone = booked.sides.flat();
    const titleIds = booked.titleIds ?? [];
    const titles = titleIds
      .map((id) => ctx.titles.find((t) => t.id === id))
      .filter((t): t is Title => Boolean(t));

    const participants: SimParticipant[] = booked.sides.flatMap((members, side) =>
      members.map((w) => ({ wrestlerId: w.id, side })),
    );

    const result = simulateMatch(rng, participants, byId, {
      rules: RIVAL_MATCH_RULES,
      stipulation,
      requirementsMet: true,
      isPPV: false,
      matchLengthMinutes: ctx.settings.defaultMatchLength,
      settings: ctx.settings,
      hardcoreSaturation: ctx.promotion.hardcoreSaturation,
      titlePrestige: matchTitlePrestige(titles, ctx.settings),
      houseStyleFit: houseStyleRatingBonus(everyone, ctx.promotion.identity, ctx.settings),
      titles,
      isMainEvent,
      // A rival's booking credibility stands in for everything the player does
      // by hand — deck stacking, instructions, knowing who to put together.
      instructionModifier: (ctx.promotion.bookingCredibility - 50) * ctx.settings.rivalCredibilityRatingWeight,
    });

    const titleOutcomes = resolveTitleOutcomes({
      titles,
      winnerIds: result.winnerWrestlerIds,
      finish: result.finish,
      stipulation,
      matchRating: result.rating,
      settings: ctx.settings,
    });

    matches.push({
      participantIds: everyone.map((w) => w.id),
      sides: booked.sides.flatMap((members, side) => members.map(() => side)),
      winnerIds: result.winnerWrestlerIds,
      finish: result.finish,
      rating: result.rating,
      stars: result.stars,
      titleIds,
      titleOutcomes,
      stipulationId,
      teamIds: booked.teamIds,
      winnerSide: result.winnerSide,
      aftermath: computeAftermath({
        participants: everyone,
        winnerIds: result.winnerWrestlerIds,
        finish: result.finish,
        rating: result.rating,
        stipulation,
        isMainEvent,
        settings: ctx.settings,
      }),
    });
    ratings.push(result.rating);
  });

  const slotWeights = TV_SLOT_WEIGHTS.slice(0, matches.length);
  const showRating = clamp(computeShowRating(ratings, slotWeights), 0, 100);

  return {
    promotionId: ctx.promotion.id,
    week: ctx.week,
    matches,
    showRating,
    showStars: ratingToStars(showRating),
  };
}
