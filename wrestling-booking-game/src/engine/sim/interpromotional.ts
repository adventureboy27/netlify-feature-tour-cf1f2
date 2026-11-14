// What a match does to the people in it, once the sim has decided it.
//
// Every match in the game goes through one set of rules: the stoppage rule,
// who gets hurt and how badly, and what the match does to each person's
// record and body. A joint show and the Crucible used to skip most of that,
// and it was a difference nobody could see in the game. These are the rules,
// in one place, for every night.
//
// Randomness is passed in by the caller. Callers seed it from the match
// itself, never from the shared weekly stream, so adding a night to the card
// does not reshuffle every roll after it (CLAUDE.md).

import type { Rng } from '../rng';
import type { Id, Wrestler, WorldSettings, MatchBeat, FinishType } from '../types';
import { rollCasualty, stoppageCasualty, injuryFrom, type Casualty } from './casualties';
import { workingHurtRisk } from '../world/titleDefence';
import { callTheMatch, type CommentaryLine, type CommentaryTeam } from './commentary';
import type { Injury } from '../types';

/**
 * The rule for a stoppage: the wrestler who could not go on is the one who
 * loses, and the opponent who was not hurt gets the win. A disqualification
 * is not a stoppage — it is a penalty on the one who broke the rules, and
 * the winner is decided by the match as booked.
 *
 * The sim decides the winner before the finish, so in practice this is the
 * loser of the match: the function exists so every caller reads the same
 * answer, and so a test can hold the rule to account.
 */
export function stoppageVictimOf(
  finish: FinishType,
  winnerIds: readonly Id[],
  participantIds: readonly Id[],
): Id | null {
  if (finish !== 'injuryStoppage') return null;
  return participantIds.find((id) => !winnerIds.includes(id)) ?? null;
}

export interface MatchCasualty {
  casualty: Casualty;
  injury: Injury;
}

/**
 * Who got hurt in a match, and how badly. The stoppage victim is always one
 * of the losers; everyone else in the match may pick up something in the
 * normal way. Somebody already hurt and not cleared to work does not wrestle
 * on and is not rolled again.
 */
export function rollMatchCasualties(
  rng: Rng,
  input: {
    finish: FinishType;
    winnerIds: readonly Id[];
    beats: readonly MatchBeat[];
    people: readonly Wrestler[];
    injuryMultiplier: number;
    week: number;
    settings: WorldSettings;
    stipulationId?: Id | null;
  },
): { casualties: MatchCasualty[]; stoppedIds: Id[] } {
  const casualties: MatchCasualty[] = [];
  const stoppedIds: Id[] = [];
  const victim = stoppageVictimOf(
    input.finish,
    input.winnerIds,
    input.people.map((p) => p.id),
  );
  if (victim) {
    const hurt = input.people.find((p) => p.id === victim);
    if (hurt && !hurt.injury) {
      const casualty = stoppageCasualty(rng, {
        personId: hurt.id,
        name: hurt.name,
        role: 'competitor',
        violenceLevel: 0,
        injuryMultiplier: input.injuryMultiplier,
        toughness: hurt.toughness,
        settings: input.settings,
        stipulationId: input.stipulationId ?? null,
      });
      casualties.push({ casualty, injury: injuryFrom(casualty, input.week) });
    }
    stoppedIds.push(victim);
  }
  for (const person of input.people) {
    if (stoppedIds.includes(person.id)) continue;
    if (person.injury && !person.clearedToWorkHurt) continue;
    const casualty = rollCasualty(rng, {
      personId: person.id,
      name: person.name,
      role: 'competitor',
      violenceLevel: 0,
      injuryMultiplier: input.injuryMultiplier * workingHurtRisk(person, input.settings),
      toughness: person.toughness,
      settings: input.settings,
    });
    if (casualty) casualties.push({ casualty, injury: injuryFrom(casualty, input.week) });
  }
  return { casualties, stoppedIds };
}

/** What a night's call needs from the match, once it has been played. */
export interface CalledMatch {
  sideA: Wrestler[];
  sideB: Wrestler[];
  winningSide: 'a' | 'b' | null;
  finish: FinishType;
  rating: number;
  beats: readonly MatchBeat[];
  injuries: readonly { name: string; text: string }[];
  isMainEvent: boolean;
  titleName: string | null;
  titleChanged: boolean;
}

/**
 * The call for a match on a night that is not on the player's card: the same
 * announcers, the same write-up, seeded from the match itself (never the
 * shared stream), so the call is the same every time the match is watched.
 * Returns the lines and leaves the match alone.
 */
export function callInterpromotional(
  rng: Rng,
  team: CommentaryTeam,
  match: CalledMatch,
  settings: WorldSettings,
  townName: string,
): CommentaryLine[] {
  return callTheMatch(rng, {
    team,
    sideA: match.sideA,
    sideB: match.sideB,
    winningSide: match.winningSide,
    managers: [],
    refereeName: null,
    guestRefereeName: null,
    refereeMiss: null,
    titles: [],
    championName: null,
    championWeeks: 0,
    titleChanged: match.titleChanged,
    stipulationName: match.titleName,
    shootHeat: 0,
    isMainEvent: match.isMainEvent,
    finish: match.finish,
    rating: match.rating,
    beats: match.beats,
    injuries: match.injuries,
    hurtComingIn: null,
    incidentText: null,
    crowd: 'hot',
    upset: false,
    formerChampionName: null,
    formerChampionTitle: null,
    otherBeltHolderName: null,
    otherBeltName: null,
    onATearName: null,
    onATearRun: 0,
    slumpingName: null,
    slumpingRun: 0,
    debutantName: null,
    secondGenName: null,
    secondGenParentName: null,
    oldHandName: null,
    oldHandYears: 0,
    timesMet: 0,
    feudWeeks: 0,
    feudMatches: 0,
    isBlowoff: false,
    townName,
    weatherLine: null,
    isPPV: match.isMainEvent,
    settings,
  });
}
