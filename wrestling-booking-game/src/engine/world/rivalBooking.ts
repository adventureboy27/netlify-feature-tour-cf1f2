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
import { isSuspended } from '../career/discipline';
import { chance, clamp, randInt } from '../rng';
import type { FinishType, Id, MatchRules, Promotion, Segment, Stable, Title, Wrestler, WorldSettings } from '../types';
import { availableTeams } from './tagTeams';
import { simulateMatch, type SimParticipant } from '../sim/simulateMatch';
import { computeShowRating, ratingToStars, TV_SLOT_WEIGHTS } from '../economy/showRating';
import { computeAftermath, type AftermathChange } from '../sim/aftermath';
import { overexposurePenalty, staleGimmickPenalty, type BookingMemory } from '../sim/freshness';

/** Same key the crowd's memory uses, so the two agree on what a pairing is. */
function pairKeyFor(a: Id, b: Id): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * A rival's match in the shape the freshness module reads. Rival cards are
 * stored as sides of wrestlers rather than as Segments, and rather than
 * teaching freshness about a second shape the adapter lives here.
 */
function asSegment(match: BookedMatch): Segment {
  return {
    participants: match.sides.flatMap((members, side) =>
      members.map((w) => ({ wrestlerId: w.id, side, role: 'competitor' as const })),
    ),
  } as Segment;
}
import { houseStyleRatingBonus } from '../sim/houseStyle';
import { resolvePromo, promoShowContribution } from '../sim/promo';
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
  pace: 'standard',
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

/** A talking segment on a rival's show. */
export interface RivalPromo {
  speakerId: Id;
  targetId: Id | null;
  quality: number;
  text: string;
}

export interface RivalShow {
  promotionId: Id;
  week: number;
  matches: RivalMatch[];
  /**
   * What they said. Rival cards were matches and nothing else, which made
   * talking a thing only the player's company could do — and the whole point
   * of this module is that the AI books the way the player does and does not
   * get a different rulebook.
   */
  promos: RivalPromo[];
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
  /**
   * What this promotion's crowd has already been shown. Optional so callers
   * that do not care (tests, the first show of a save) can leave it out, but
   * without it the office books the same card every week — see below.
   */
  memory?: BookingMemory;
}

/**
 * Can this person work tonight? Injured and exhausted wrestlers sit, the same
 * as they would on the player's card.
 */
export function canWork(w: Wrestler, settings: WorldSettings, week?: number): boolean {
  // An injured wrestler sits, unless the booker has explicitly signed off on
  // them working hurt — which today only happens when a champion is sent out
  // to defend rather than vacate. See world/titleDefence.ts.
  if (w.injury && !w.clearedToWorkHurt) return false;
  if (w.deceased || w.careerStatus === 'retired') return false;
  // Somebody working as an official or a mouthpiece is not on the active
  // roster. Gating it here covers the office's card and every rival's, so
  // there is one answer to "can this person have a match" in the codebase.
  if (w.role !== 'wrestler') return false;
  // A suspended man is off every card, yours and everybody else's. Gated
  // here with the rest of it so there is still one answer in the codebase to
  // "can this person have a match" — see career/discipline.ts.
  if (week !== undefined && isSuspended(w.discipline, week)) return false;
  return w.health >= settings.rivalMinHealthToBook;
}

/**
 * Build the card. The AI books the way a competent, unimaginative booker
 * does: best against best on top, and the rest paired off down the sheet by
 * standing, so the card gets smaller as it goes down.
 *
 * "Unimaginative" used to mean *identical*. Sorting by standing and pairing
 * adjacent ranks produces exactly the same six matches every week, forever,
 * and since nothing charged for repetition that was free — for the office's
 * Fill the card and for all six rival promotions at once. The moment
 * overexposure started costing rating points, this booker walked its own
 * company into the ground in half a season.
 *
 * So the office now rests people and varies the card. It is still not
 * imaginative: it does not build stories or plan three weeks ahead. It just
 * knows not to run the same main event fifty-two times.
 */
export function bookRivalCard(rng: Rng, ctx: RivalBookingContext): RivalCard {
  const weeksSeen = (id: Id) => ctx.memory?.weeksSeen.get(id) ?? 0;
  const met = (a: Id, b: Id) => ctx.memory?.pairings.get(pairKeyFor(a, b)) ?? 0;

  // Standing decides the running order, minus how much the crowd has had of
  // you lately — so somebody who worked the last four weeks slides down the
  // sheet and somebody rested rises, and the card rotates without anybody
  // having to plan it.
  const roster = [...ctx.available].sort(
    (a, b) =>
      b.popularity +
      b.momentum * 0.3 -
      weeksSeen(b.id) * ctx.settings.bookerRestWeight -
      (a.popularity + a.momentum * 0.3 - weeksSeen(a.id) * ctx.settings.bookerRestWeight),
  );
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

  // Break up the reruns. Pairing by adjacent standing means the same two
  // names meet every week; swapping one side of a stale match with one side
  // of another keeps the running order intact while giving the crowd a
  // match-up it has not just sat through.
  for (let a = 0; a < matches.length; a++) {
    const staleness = (m: BookedMatch) =>
      Math.max(0, ...m.sides.flatMap((side) => side.flatMap((x) => m.sides.flatMap((other) =>
        other === side ? [] : other.map((y) => met(x.id, y.id))))));
    if (staleness(matches[a]!) <= ctx.settings.overexposureFreeMeetings) continue;
    for (let b = 0; b < matches.length; b++) {
      if (a === b) continue;
      const left = matches[a]!;
      const right = matches[b]!;
      // Only swap singles; a tag team is a unit and splitting it to freshen
      // the card would undo the whole reason teams exist.
      if (left.teamIds || right.teamIds) continue;
      if (left.sides[1]?.length !== 1 || right.sides[1]?.length !== 1) continue;
      const before = staleness(left) + staleness(right);
      const swapped: BookedMatch[] = [
        { ...left, sides: [left.sides[0]!, right.sides[1]!] },
        { ...right, sides: [right.sides[0]!, left.sides[1]!] },
      ];
      const after = staleness(swapped[0]!) + staleness(swapped[1]!);
      if (after < before) {
        matches[a] = swapped[0]!;
        matches[b] = swapped[1]!;
        break;
      }
    }
  }

  // Belts. A promotion that never defends its top title is not a promotion,
  // and one that defends something every week devalues everything. At most
  // one championship match a card, rolled per match so that a tag title
  // defence lands on the tag match rather than on the main event.
  let defences = 0;
  for (const match of matches) {
    if (defences >= ctx.settings.rivalMaxTitleDefencesPerCard) break;
    if (!chance(rng, ctx.settings.rivalTitleDefenceChance)) continue;

    const options = eligibleTitles(ctx.titles, {
      stipulationId: null,
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
      // Rivals pay for overexposure on the same terms the player does.
      // Charging only the player would quietly hand every AI company a rating
      // bonus for booking lazily, which is the opposite of the point. Their
      // memory is the weaker roster-derived one (see memoryFromRoster), so
      // this catches running the same people, not the same match.
      overexposurePenalty: ctx.memory ? overexposurePenalty(asSegment(booked), ctx.memory, ctx.settings) : 0,
      staleGimmickPenalty: staleGimmickPenalty(everyone, ctx.settings),
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
        promotion: ctx.promotion,
        settings: ctx.settings,
      }),
    });
    ratings.push(result.rating);
  });

  const slotWeights = TV_SLOT_WEIGHTS.slice(0, matches.length);
  // ...and somebody talks.
  //
  // The office's best mouth, aimed at a live feud when there is one — the
  // same obvious call the player's Fill the card makes, because the AI is
  // supposed to book the way the player books rather than to a private set
  // of rules. Without this, a talking segment was something only the player's
  // company had, which is a permanent advantage nobody earned.
  const promos: RivalPromo[] = [];
  const spoken = new Set<Id>();
  const mouths = [...ctx.available].sort((a, b) => b.charisma - a.charisma);
  for (let i = 0; i < ctx.settings.promoSlotsPerCard; i++) {
    const speaker = mouths.find((w) => !spoken.has(w.id));
    if (!speaker) break;
    spoken.add(speaker.id);

    const opponent = mouths.find((w) => w.id !== speaker.id) ?? null;
    const promo = resolvePromo(rng, {
      speaker,
      target: opponent,
      mouthpieceCharisma: null,
      topicId: opponent ? 'continueFeud' : 'callOutLockerRoom',
      existingHeat: 0,
      settings: ctx.settings,
    });
    promos.push({
      speakerId: speaker.id,
      targetId: opponent?.id ?? null,
      quality: promo.quality,
      text: promo.text,
    });
    // Talking counts toward the night, at the same weight it does on the
    // player's card — a card of ten promos is not a wrestling show anywhere.
    ratings.push(promoShowContribution(promo.quality, ctx.settings) * ctx.settings.promoAsMatchShare);
  }

  const showRating = clamp(computeShowRating(ratings, slotWeights), 0, 100);

  return {
    promotionId: ctx.promotion.id,
    week: ctx.week,
    matches,
    promos,
    showRating,
    showStars: ratingToStars(showRating),
  };
}
