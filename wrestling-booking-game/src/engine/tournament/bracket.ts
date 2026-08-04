// Tournaments — booking-game-design.md §9 (`tournamentsEnabled`).
//
// Two formats, and the difference between them is a real booking decision
// rather than a cosmetic one:
//
//   singleNight  the whole bracket on one card. An eight-man tournament is
//                seven matches and the winner works three of them in a night.
//                By the final they are running on fumes — nightFatigue below
//                is what makes a one-night tournament a genuine gamble on
//                whoever you wanted to win.
//
//   multiWeek    one round per show. Nobody gets tired, the bracket carries
//                the storyline for a month, and every week you have to fill
//                the rest of the card around fixtures you already committed
//                to.
//
// Everything here is pure and stateless: a Tournament goes in, a new
// Tournament comes out. The store owns persistence, the sim owns outcomes,
// and this file only knows the shape of a bracket.

import type { Id, Tournament, TournamentMatch, TournamentFormat, TournamentReward, WorldSettings } from '../types';

/** Smallest power of two that seats every entrant. */
export function bracketSize(entrantCount: number): number {
  let size = 1;
  while (size < entrantCount) size *= 2;
  return Math.max(size, 2);
}

/**
 * Standard tournament seed order for a bracket of `size`.
 *
 * Returns seed numbers in bracket-slot order, so slots (0,1) meet in round
 * one, (2,3) meet in round one, and their winners meet in round two. Built by
 * repeated reflection, which is what guarantees the top two seeds cannot meet
 * before the final — the property that makes a bracket feel fair.
 */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const mirror = order.length * 2 + 1;
    order = order.flatMap((seed) => [seed, mirror - seed]);
  }
  return order;
}

export interface CreateTournamentOptions {
  id: Id;
  name: string;
  /** Entrant ids, strongest first — the caller decides what "strongest" means. */
  entrantIds: Id[];
  format: TournamentFormat;
  reward: TournamentReward;
  startWeek: number;
}

/**
 * Build a seeded bracket. Entrants beyond the bracket's capacity are not
 * possible (the bracket grows to fit); empty slots become byes, and a bye
 * advances its opponent immediately rather than sitting as a fake match the
 * player has to book.
 */
export function createTournament(options: CreateTournamentOptions): Tournament {
  const { entrantIds } = options;
  if (entrantIds.length < 2) {
    throw new Error('A tournament needs at least two entrants');
  }

  const size = bracketSize(entrantIds.length);
  const order = seedOrder(size);
  const totalRounds = Math.log2(size);

  // Seed n (1-indexed) is entrantIds[n - 1]; seeds past the entrant list are byes.
  const slots: (Id | null)[] = order.map((seed) => entrantIds[seed - 1] ?? null);

  const rounds: TournamentMatch[][] = [];
  for (let round = 0; round < totalRounds; round++) {
    const matchCount = size / 2 ** (round + 1);
    rounds.push(
      Array.from({ length: matchCount }, (_, position) => ({
        id: `${options.id}-r${round}-m${position}`,
        round,
        position,
        entrantA: null,
        entrantB: null,
        winnerId: null,
        isBye: false,
      })),
    );
  }

  // Fill round one from the seeded slots.
  const firstRound = rounds[0]!;
  firstRound.forEach((match, position) => {
    match.entrantA = slots[position * 2] ?? null;
    match.entrantB = slots[position * 2 + 1] ?? null;
    // A slot facing nobody is a bye: the entrant walks through.
    if (match.entrantA && !match.entrantB) {
      match.isBye = true;
      match.winnerId = match.entrantA;
    } else if (!match.entrantA && match.entrantB) {
      match.isBye = true;
      match.winnerId = match.entrantB;
    }
  });

  const tournament: Tournament = {
    id: options.id,
    name: options.name,
    format: options.format,
    reward: options.reward,
    entrantIds: [...entrantIds],
    rounds,
    currentRound: 0,
    startWeek: options.startWeek,
    status: 'active',
    winnerId: null,
  };

  // Byes may already have settled round one entirely (a 2-entrant "bracket"
  // of one real match cannot, but a lopsided one can).
  return propagate(tournament);
}

/** Feed settled winners into the next round, and advance the round pointer. */
function propagate(tournament: Tournament): Tournament {
  const rounds = tournament.rounds.map((round) => round.map((m) => ({ ...m })));

  for (let round = 0; round < rounds.length - 1; round++) {
    const current = rounds[round]!;
    const next = rounds[round + 1]!;
    current.forEach((match, position) => {
      if (!match.winnerId) return;
      const target = next[Math.floor(position / 2)]!;
      if (position % 2 === 0) target.entrantA = match.winnerId;
      else target.entrantB = match.winnerId;
    });
  }

  // A round is done when every match in it has a winner.
  let currentRound = tournament.currentRound;
  while (currentRound < rounds.length && rounds[currentRound]!.every((m) => m.winnerId !== null)) {
    currentRound++;
  }

  const finalMatch = rounds[rounds.length - 1]![0]!;
  const complete = finalMatch.winnerId !== null;

  return {
    ...tournament,
    rounds,
    currentRound: Math.min(currentRound, rounds.length - 1),
    status: complete ? 'complete' : 'active',
    winnerId: finalMatch.winnerId,
  };
}

/**
 * Matches that can be booked right now: in the current round, both entrants
 * known, no winner yet. For a single-night tournament the caller books a
 * round, resolves it, then calls again for the next.
 */
export function bookableMatches(tournament: Tournament): TournamentMatch[] {
  if (tournament.status === 'complete') return [];
  const round = tournament.rounds[tournament.currentRound];
  if (!round) return [];
  return round.filter((m) => m.winnerId === null && m.entrantA !== null && m.entrantB !== null);
}

/** Record a result and cascade it through the bracket. */
export function recordResult(tournament: Tournament, matchId: Id, winnerId: Id): Tournament {
  const match = tournament.rounds.flat().find((m) => m.id === matchId);
  if (!match) throw new Error(`No such tournament match: ${matchId}`);
  if (match.entrantA !== winnerId && match.entrantB !== winnerId) {
    throw new Error(`${winnerId} is not in tournament match ${matchId}`);
  }

  const rounds = tournament.rounds.map((round) =>
    round.map((m) => (m.id === matchId ? { ...m, winnerId } : { ...m })),
  );
  return propagate({ ...tournament, rounds });
}

/** Every round is a named stage once you know how many there are. */
export function roundName(roundIndex: number, totalRounds: number): string {
  const fromEnd = totalRounds - 1 - roundIndex;
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return 'Semi-final';
  if (fromEnd === 2) return 'Quarter-final';
  return `Round ${roundIndex + 1}`;
}

export function totalRounds(tournament: Tournament): number {
  return tournament.rounds.length;
}

export function isFinal(tournament: Tournament, match: TournamentMatch): boolean {
  return match.round === tournament.rounds.length - 1;
}

// ---------------------------------------------------------------- fatigue

/**
 * How many matches a wrestler has already worked in this tournament tonight.
 * Meaningless for a multi-week bracket, which is the point: the format is
 * the difference between a fresh final and an exhausted one.
 */
export function matchesWorkedTonight(tournament: Tournament, wrestlerId: Id): number {
  if (tournament.format !== 'singleNight') return 0;
  return tournament.rounds
    .flat()
    .filter((m) => !m.isBye && m.winnerId !== null && (m.entrantA === wrestlerId || m.entrantB === wrestlerId)).length;
}

/**
 * Kayfabe multiplier for someone going out for their second or third match of
 * the night. This is the whole cost of a one-night tournament: the wrestler
 * you seeded to win gets progressively worse at winning, and the bracket does
 * not care who you had planned for the final.
 */
export function nightFatigueMultiplier(matchesAlreadyWorked: number, settings: WorldSettings): number {
  return Math.max(0.4, 1 - matchesAlreadyWorked * settings.tournamentNightFatiguePerMatch);
}

/** Health a wrestler has already burned tonight, on top of the matches themselves. */
export function nightHealthCost(matchesAlreadyWorked: number, settings: WorldSettings): number {
  return matchesAlreadyWorked * settings.tournamentNightHealthCostPerMatch;
}

/** Total matches a single-night bracket costs the card. */
export function matchCount(tournament: Tournament): number {
  return tournament.rounds.flat().filter((m) => !m.isBye).length;
}
