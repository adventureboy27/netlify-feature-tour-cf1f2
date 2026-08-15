// Running The Crucible: seed the bracket, work it round by round, crown one.
//
// Every match goes through `simulateMatch`, the same function that decides the
// player's Tuesday night, because the point of an interpromotional tournament
// is that nobody's booker gets a vote. A company can enter its best and still
// watch them go out in round one to somebody they have never heard of.
//
// The bracket itself is `tournament/bracket.ts`, which already knew how to
// seed, bye and advance. Nothing here re-implements that; this walks it.

import type { Rng } from '../rng';
import type { Id, MatchRules, Tournament, Wrestler, WorldSettings, Promotion } from '../types';
import { simulateMatch, type SimParticipant } from '../sim/simulateMatch';
import {
  createTournament,
  bookableMatches,
  recordResult,
  roundName,
  totalRounds,
} from '../tournament/bracket';
import { cupPurse, cupStanding, CUP_NAME, type CupPurse, type CrownReign } from './cup';

/** One night, one bracket, straight singles matches all the way down. */
const CUP_RULES: MatchRules = {
  preset: 'singles',
  format: 'individuals',
  ruleStrictness: 'strict',
  aim: 'firstFall',
  falls: 'pinsAndSubs',
  timeLimit: 20,
  stoppage: 'referee',
  countOuts: 'normal',
  reward: 'none',
  pace: 'standard',
};

export interface CupBout {
  round: number;
  roundLabel: string;
  aId: Id;
  bId: Id;
  winnerId: Id;
  rating: number;
  /** Straight from the sim, so the write-up can say how it ended. */
  finish: string;
}

export interface CupResult {
  week: number;
  year: number;
  /** Companies that paid to be there. */
  entrantPromotionIds: Id[];
  slotsEach: number;
  bouts: CupBout[];
  purse: CupPurse;
  winnerId: Id;
  winnerName: string;
  winnerPromotionId: Id;
  winnerPromotionName: string;
  runnerUpId: Id | null;
  /** Rounds each entrant won, for the standing swing. */
  roundsWon: Record<Id, number>;
  rounds: number;
  reign: CrownReign;
  line: string;
}

export interface CupRunContext {
  /** Companies that bought in, and who each of them sent. */
  field: { promotion: Promotion; entrants: Wrestler[] }[];
  slotsEach: number;
  week: number;
  year: number;
  settings: WorldSettings;
}

/**
 * Work the tournament.
 *
 * Seeding is by popularity across the whole field, which is what stops the two
 * biggest names meeting in round one — `seedOrder` guarantees the top two
 * cannot meet before the final, and that is the property that makes a bracket
 * feel like a bracket rather than a raffle.
 */
export function runCup(rng: Rng, ctx: CupRunContext): CupResult | null {
  const everyone = ctx.field.flatMap((f) => f.entrants);
  if (everyone.length < 2) return null;

  const byId = new Map(everyone.map((w) => [w.id, w]));
  const promotionOf = new Map<Id, Promotion>();
  for (const { promotion, entrants } of ctx.field) {
    for (const w of entrants) promotionOf.set(w.id, promotion);
  }

  // Strongest first: the bracket seeds off this order.
  const seeded = [...everyone].sort((a, b) => b.popularity - a.popularity);

  let tournament: Tournament = createTournament({
    id: `cup-${ctx.year}`,
    name: `${CUP_NAME} ${ctx.year}`,
    entrantIds: seeded.map((w) => w.id),
    format: 'singleNight',
    reward: 'trophy',
    startWeek: ctx.week,
  });

  const bouts: CupBout[] = [];
  const roundsWon: Record<Id, number> = {};
  for (const w of everyone) roundsWon[w.id] = 0;

  // Walk it. `bookableMatches` hands back only the ties whose feeder matches
  // have resolved, so this drains the bracket a round at a time on its own.
  let guard = 0;
  while (guard++ < 64) {
    const ready = bookableMatches(tournament);
    if (ready.length === 0) break;

    for (const tie of ready) {
      const aId = tie.entrantA;
      const bId = tie.entrantB;
      if (!aId || !bId) continue;
      const a = byId.get(aId);
      const b = byId.get(bId);
      if (!a || !b) continue;

      const participants: SimParticipant[] = [
        { wrestlerId: a.id, side: 0 },
        { wrestlerId: b.id, side: 1 },
      ];

      const result = simulateMatch(rng, participants, byId, {
        rules: CUP_RULES,
        stipulation: null,
        requirementsMet: true,
        // It is the biggest night of the year and the crowd is on its feet.
        isPPV: true,
        matchLengthMinutes: ctx.settings.defaultMatchLength,
        settings: ctx.settings,
        hardcoreSaturation: 0,
        // No belts on this card, for the same reason as the joint shows.
        titles: [],
        isMainEvent: tie.round === totalRounds(tournament) - 1,
        isOpener: tie.round === 0,
      });

      const winnerId = result.winnerWrestlerIds[0] ?? aId;
      roundsWon[winnerId] = (roundsWon[winnerId] ?? 0) + 1;

      bouts.push({
        round: tie.round,
        roundLabel: roundName(tie.round, totalRounds(tournament)),
        aId,
        bId,
        winnerId,
        rating: result.rating,
        finish: result.finish,
      });

      tournament = recordResult(tournament, tie.id, winnerId);
    }
  }

  const final = bouts[bouts.length - 1];
  if (!final) return null;

  const winner = byId.get(final.winnerId);
  const company = promotionOf.get(final.winnerId);
  if (!winner || !company) return null;

  const purse = cupPurse(
    ctx.field.map((f) => f.promotion),
    ctx.settings,
  );

  const reign: CrownReign = {
    wrestlerId: winner.id,
    wrestlerName: winner.name,
    promotionId: company.id,
    promotionName: company.name,
    wonWeek: ctx.week,
    year: ctx.year,
  };

  return {
    week: ctx.week,
    year: ctx.year,
    entrantPromotionIds: ctx.field.map((f) => f.promotion.id),
    slotsEach: ctx.slotsEach,
    bouts,
    purse,
    winnerId: winner.id,
    winnerName: winner.name,
    winnerPromotionId: company.id,
    winnerPromotionName: company.name,
    runnerUpId: final.winnerId === final.aId ? final.bId : final.aId,
    roundsWon,
    rounds: totalRounds(tournament),
    reign,
    line: `${winner.name} won ${CUP_NAME} ${ctx.year} for ${company.name}.`,
  };
}

/** The standing swing every entrant takes home from how far they got. */
export function cupStandingFor(result: CupResult, wrestlerId: Id, settings: WorldSettings): number {
  return cupStanding(result.roundsWon[wrestlerId] ?? 0, result.rounds, settings);
}
