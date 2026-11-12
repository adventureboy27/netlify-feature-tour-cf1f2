// A sponsor forces a horribly-named title onto the player's own promotion.
//
// The booker doesn't get a vote — a check that size buys a belt with the
// sponsor's own name welded onto it, no relationship at all to how this
// company names anything else it owns. A one-night tournament crowns the
// first champion the same night it's announced, and for about six months
// every match that puts it on the line costs everybody in it real morale —
// caught anywhere near "The Rise & Grind Breakfast Blend Championship" is
// its own kind of humiliation. The flip side: whoever's holding it while
// that attention is on it sees their own merch move, for real, every week.
// Once the window closes it's just a title like any other — still called
// the Breakfast Belt forever, but nobody's laughing at it out loud anymore.
//
// One-time, player-only. See World.breakfastBeltHappened.

import type { Rng } from '../rng';
import { shuffle } from '../rng';
import type { Id, MatchRules, Wrestler, WorldSettings } from '../types';
import { canWork } from './rivalBooking';
import { simulateMatch, type SimParticipant } from '../sim/simulateMatch';
import {
  createTournament,
  bookableMatches,
  recordResult,
  roundName,
  totalRounds,
  nightFatigueMultiplier,
  nightHealthCost,
} from '../tournament/bracket';

export const BREAKFAST_BELT_NAME = 'The Rise & Grind Breakfast Blend Championship';
export const BREAKFAST_BELT_NICKNAME = 'the Breakfast Belt';

const BELT_RULES: MatchRules = {
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

export function eligibleForBreakfastBelt(
  week: number,
  alreadyHappened: boolean,
  settings: WorldSettings,
): boolean {
  if (alreadyHappened) return false;
  return week >= settings.breakfastBeltEarliestWeek;
}

/** Who's actually eligible to be thrown into it, and how many the settings ask for. */
export function pickTournamentEntrants(
  rng: Rng,
  roster: readonly Wrestler[],
  settings: WorldSettings,
): Id[] {
  const eligible = roster.filter((w) => w.role === 'wrestler' && canWork(w, settings));
  return shuffle(rng, eligible)
    .slice(0, settings.breakfastBeltEntrantCount)
    .map((w) => w.id);
}

export interface BreakfastBeltBout {
  round: number;
  roundLabel: string;
  aId: Id;
  bId: Id;
  winnerId: Id;
  rating: number;
  finish: string;
}

export interface BreakfastBeltRunResult {
  winnerId: Id;
  bouts: BreakfastBeltBout[];
  wornOut: { wrestlerId: Id; cost: number }[];
}

/**
 * Work the bracket in one sitting — a trimmed sibling of cupRun.ts's runCup:
 * same night-fatigue treatment (a tired copy for the sim, the real cost
 * charged to the actual person once the bracket's done), none of the
 * cross-company purse/reign bookkeeping the Cup needs, since this only ever
 * runs inside a single promotion.
 */
export function runBreakfastBeltTournament(
  rng: Rng,
  entrantIds: Id[],
  byId: Map<Id, Wrestler>,
  settings: WorldSettings,
  week: number,
): BreakfastBeltRunResult | null {
  if (entrantIds.length < 2) return null;

  const seeded = [...entrantIds].sort(
    (a, b) => (byId.get(b)?.popularity ?? 0) - (byId.get(a)?.popularity ?? 0),
  );

  let tournament = createTournament({
    id: `breakfast-belt-${week}`,
    name: BREAKFAST_BELT_NAME,
    entrantIds: seeded,
    format: 'singleNight',
    reward: 'title',
    startWeek: week,
  });

  const bouts: BreakfastBeltBout[] = [];
  const workedTonight = new Map<Id, number>();

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

      const tired = (w: Wrestler): Wrestler => {
        const already = workedTonight.get(w.id) ?? 0;
        if (already === 0) return w;
        return { ...w, health: w.health * nightFatigueMultiplier(already, settings) };
      };
      const tonight = new Map(byId);
      tonight.set(a.id, tired(a));
      tonight.set(b.id, tired(b));

      const isFinalTie = tie.round === totalRounds(tournament) - 1;
      const result = simulateMatch(rng, participants, tonight, {
        rules: BELT_RULES,
        stipulation: null,
        requirementsMet: true,
        isPPV: false,
        matchLengthMinutes: settings.defaultMatchLength,
        settings,
        week,
        hardcoreSaturation: 0,
        titles: [],
        isMainEvent: isFinalTie,
        isOpener: tie.round === 0,
      });

      const winnerId = result.winnerWrestlerIds[0] ?? aId;
      workedTonight.set(aId, (workedTonight.get(aId) ?? 0) + 1);
      workedTonight.set(bId, (workedTonight.get(bId) ?? 0) + 1);

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

  const wornOut: { wrestlerId: Id; cost: number }[] = [];
  for (const [id, worked] of workedTonight) {
    const cost = nightHealthCost(Math.max(0, worked - 1), settings);
    if (cost > 0) wornOut.push({ wrestlerId: id, cost });
  }

  return { winnerId: final.winnerId, bouts, wornOut };
}

export function breakfastBeltAnnouncementLine(promotionName: string, championName: string): string {
  return (
    `The sponsorship renewal came with strings: ${promotionName} now runs ${BREAKFAST_BELT_NAME}, whether ` +
    `anybody backstage likes the name or not. A scramble one-night tournament settled the argument the ` +
    `only way this company settles anything — in the ring — and ${championName} is the first person on ` +
    `earth who can call themselves champion of ${BREAKFAST_BELT_NICKNAME}.`
  );
}

export function breakfastBeltMockeryFadesLine(): string {
  return (
    `Somewhere along the way, folks stopped rolling their eyes every time ${BREAKFAST_BELT_NICKNAME} showed ` +
    `up on a card — or at least stopped saying so where anybody could hear it. It's just a title now.`
  );
}
