// How a match is allowed to be fought, read off its stipulation, its rules
// and the way it ended — in one place, so the staging has a single thing to
// obey and nothing else has to know what a "last man standing" is.
//
// The simulation has already applied all of this to decide the result. This
// is the same rulebook applied to the picture: a submission match never
// shows a pin attempt, a cage match never goes to the floor, a battle royal
// ends over the top rope and not with a three-count.

import { stipulationById } from '../../data/stipulations';
import type { FinishType, MatchRules, Segment } from '../../engine/types';

export interface Conduct {
  /** Everybody is in the ring at once: a battle royal, a three- or four-way, a tornado tag. */
  allIn: boolean;
  /** Partners wait on the apron and tag. */
  tags: boolean;
  /** The fight may go to the floor. */
  outside: boolean;
  /** Chairs are legal. */
  weapons: boolean;
  /** Going over the top rope puts you out. */
  overTheTop: boolean;
  cage: boolean;
  blindfold: boolean;
  /** More than one fall decides it: two out of three, or an iron man match. */
  multiFall: boolean;
  /** A pin counts wherever it happens, the floor included. */
  fallsAnywhere: boolean;
  /**
   * What a near fall is in this match: a cover and a two-count; a hold
   * somebody fights out of; a referee's count over somebody who beats it;
   * or, in a battle royal, hanging over the top rope and not going.
   */
  nearFall: 'cover' | 'hold' | 'count' | 'teeter';
  /** How somebody leaves a match that eliminates people. */
  elimination: 'overTop' | 'fall';
  /** What the last thing that happens looks like. */
  finish: 'pin' | 'submission' | 'knockout' | 'count10' | 'overTop' | 'escape' | 'climb' | 'table' | 'flamingTable' | 'casket' | 'countOut' | 'dq' | 'draw' | 'doubleKO' | 'blood';
}

/** An ordinary one-fall match. */
export const STANDARD: Conduct = {
  allIn: false,
  tags: false,
  outside: false,
  weapons: false,
  overTheTop: false,
  cage: false,
  blindfold: false,
  multiFall: false,
  fallsAnywhere: false,
  nearFall: 'cover',
  elimination: 'fall',
  finish: 'pin',
};

function finishOf(finish: FinishType, stipulation: string | null, rules: MatchRules, battleRoyal: boolean): Conduct['finish'] {
  if (finish === 'timeLimitDraw' || finish === 'equipmentFailure') return 'draw';
  if (finish === 'doubleKO') return 'doubleKO';
  if (battleRoyal) return 'overTop';
  if (finish === 'disqualification') return 'dq';
  if (finish === 'countOut') return 'countOut';
  if (finish === 'escape') return 'escape';
  if (finish === 'submission') return 'submission';
  // Somebody won it, by some decisive means. What that looks like is the
  // stipulation's business: a ladder match ends up the ladder however the
  // result was recorded, a tables match through a table.
  if (stipulation === 'ladder') return 'climb';
  if (stipulation === 'tables') return 'table';
  if (stipulation === 'flamingTables') return 'flamingTable';
  if (stipulation === 'casket') return 'casket';
  if (rules.aim === 'lastStanding') return 'count10';
  if (rules.aim === 'firstBlood') return 'blood';
  if (finish === 'cleanPin' || finish === 'rollup' || finish === 'interference' || finish === 'lastFactionStanding') return rules.falls === 'knockout' || rules.falls === 'subsOnly' ? 'knockout' : 'pin';
  return 'knockout';
}

export function conductOf(segment: Pick<Segment, 'stipulation' | 'rules'>, finish: FinishType, sideSizes: readonly [number, number]): Conduct {
  const stipulation = segment.stipulation ?? null;
  // What the stipulation implies wins over what the card says, exactly as
  // it does when the match is simulated.
  const rules: MatchRules = { ...segment.rules, ...(stipulation ? stipulationById(stipulation)?.impliedRules : undefined) };
  const biggest = Math.max(...sideSizes);
  const battleRoyal = stipulation === 'battleRoyal' || rules.preset === 'battleRoyal';
  // The viewer's two "sides" are the winners and everybody else, so a
  // three-way shows up as 1 v 2: it is the preset and format that say
  // whether those two are a team or just two more opponents.
  const allIn = battleRoyal || rules.preset === 'triple' || rules.preset === 'fatal4' || rules.preset === 'tornado' || biggest > 4 || (rules.format === 'individuals' && biggest > 1);
  const cage = stipulation === 'steelCage';
  const weapons = rules.ruleStrictness === 'none';
  const knockoutOnly = rules.falls === 'knockout' || rules.aim === 'lastStanding';
  return {
    allIn,
    tags: !allIn && biggest > 1,
    // Nowhere to go in a cage; a ladder match stays where the ladder is; and
    // in a battle royal the floor is where you go when you have lost.
    outside: !battleRoyal && !cage && stipulation !== 'ladder' && (rules.countOuts === 'none' || stipulation === 'arenaFloor' || stipulation === 'fallsCountAnywhere'),
    weapons,
    overTheTop: battleRoyal,
    cage,
    blindfold: stipulation === 'blindfoldMatch',
    multiFall: rules.aim === 'twoOfThree' || rules.aim === 'ironMan',
    fallsAnywhere: stipulation === 'fallsCountAnywhere',
    nearFall: battleRoyal ? 'teeter' : knockoutOnly ? 'count' : rules.falls === 'subsOnly' || rules.aim === 'submissionOnly' ? 'hold' : 'cover',
    elimination: battleRoyal ? 'overTop' : 'fall',
    finish: finishOf(finish, stipulation, rules, battleRoyal),
  };
}
