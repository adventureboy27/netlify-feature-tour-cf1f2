// Second careers — a wrestler taking the shirt or the suit, and coming back.
//
// The decision this module encodes: a role change is REVERSIBLE but never
// CASUAL. You can put your ageing brawler in a striped shirt and you can take
// him out of it again, but not this week and not because your official got
// hurt on Tuesday. He commits to a year.
//
// That year is the whole price, and it is deliberately not a stat penalty.
// A year not wrestling already costs a wrestler everything a year not
// wrestling costs: popularity decays, momentum goes, career status drifts,
// and they age. At 30 that is survivable. At 41 it is the year they do not
// get back. Charging them again with an invented malus would be billing the
// same cost twice.
//
// What they get for it is competence. A guest referee is a wrestler in a
// shirt for one night and is not expected to be any good; somebody who has
// done it every week for a year *is* good, and gets better the longer they do
// it — but never all the way. The cap is the point: a man who officiated his
// whole life is still better at officiating than a man who took it up at 40.
//
// Their real edge is the one thing a career official cannot buy. They can
// take a bump. A converted wrestler brings their own toughness into the role
// and gets hurt far less often than the man they replaced.

import { clamp } from '../rng';
import type { Referee, StaffRole, Wrestler, WorldSettings } from '../types';
import type { Manager } from '../sim/ringside';
import { yearsPro } from './status';

/** The jobs somebody can actually be moved into. */
export type TransitionRole = Extract<StaffRole, 'wrestler' | 'referee' | 'manager'>;

export const TRANSITION_ROLE_LABELS: Record<TransitionRole, string> = {
  wrestler: 'Active roster',
  referee: 'Referee',
  manager: 'Manager',
};

/**
 * Has this person ever changed jobs?
 *
 * `roleSinceWeek` is 0 for everybody who has only ever done the one thing —
 * the whole starting roster, and everybody generated since. Weeks are
 * 1-based, so 0 cannot mean "moved in week zero" and reads unambiguously as
 * "never moved".
 *
 * This matters because the lock is a cooldown on *changing*, not a tenure
 * requirement. Without it a new save locks its entire roster out of the
 * system for a year, which is exactly the bug this replaced.
 */
export function hasNeverChangedRole(wrestler: Wrestler): boolean {
  return wrestler.roleSinceWeek === 0;
}

/** Weeks somebody has been doing the job they are doing. */
export function weeksInRole(wrestler: Wrestler, week: number): number {
  return Math.max(0, week - wrestler.roleSinceWeek);
}

export interface TransitionCheck {
  ok: boolean;
  /** Why not, in the words the screen shows. Null when it is allowed. */
  reason: string | null;
  weeksLeft: number;
}

/**
 * Can this person change jobs right now?
 *
 * Everything that blocks it is a fact about them the player can already see —
 * the lock, an injury, being dead, being retired. No hidden rolls.
 */
export function canChangeRole(
  wrestler: Wrestler,
  to: TransitionRole,
  week: number,
  settings: WorldSettings,
): TransitionCheck {
  const no = (reason: string, weeksLeft = 0): TransitionCheck => ({ ok: false, reason, weeksLeft });

  if (wrestler.deceased) return no('They are gone.');
  if (wrestler.careerStatus === 'retired') return no('They have retired.');
  if (wrestler.role === to) return no(`Already ${TRANSITION_ROLE_LABELS[to].toLowerCase()}.`);
  if (wrestler.injury) return no('Not while they are hurt.');

  // Somebody who has never changed jobs owes nothing — they have been doing
  // this their whole career.
  if (hasNeverChangedRole(wrestler)) return { ok: true, reason: null, weeksLeft: 0 };

  const served = weeksInRole(wrestler, week);
  const owed = settings.roleTransitionLockWeeks - served;
  if (owed > 0) {
    // Said in weeks because the lock is the whole mechanic and the player has
    // to be able to plan against it. This is a rule, not a stat.
    return no(
      owed === 1 ? 'One more week in the job before they can move again.' : `${owed} more weeks in the job first.`,
      owed,
    );
  }

  return { ok: true, reason: null, weeksLeft: 0 };
}

/** How long until they are free to move, in words. */
export function lockLabel(wrestler: Wrestler, week: number, settings: WorldSettings): string {
  if (hasNeverChangedRole(wrestler)) return 'Free to move';
  const owed = settings.roleTransitionLockWeeks - weeksInRole(wrestler, week);
  if (owed <= 0) return 'Free to move';
  if (owed <= 4) return 'Free to move soon';
  if (owed <= 20) return 'Committed for now';
  return 'Just took the job';
}

/**
 * What a wrestler is worth as an official the day they take the shirt.
 *
 * Driven by time in the business rather than by how good a wrestler they
 * were. Knowing where to stand, when a match is going wrong and what a
 * cut-off looks like comes from twenty years of being in there; it does not
 * come from having a good dropkick, and a main eventer is no better placed to
 * count to three than the man he beat.
 */
export function convertedRefereeCompetence(
  wrestler: Wrestler,
  currentYear: number,
  settings: WorldSettings,
): number {
  // Capped at twenty-five years in, because the difference between a
  // twenty-five-year veteran and a thirty-year one is not what makes a
  // referee.
  const seasoned = Math.min(25, yearsPro(wrestler, currentYear));
  return clamp(
    Math.round(settings.convertedRefereeBaseCompetence + seasoned * settings.convertedRefereeExperienceWeight),
    20,
    settings.convertedRefereeCompetenceCap,
  );
}

/**
 * The officiating record for one of your wrestlers.
 *
 * Note what is NOT here: a contract. They are already on the roster and
 * already being paid a wrestler's wage — which is the trap in converting your
 * top guy, because that wage does not drop until his deal runs out.
 */
export function refereeFromWrestler(
  wrestler: Wrestler,
  currentYear: number,
  settings: WorldSettings,
): Referee {
  const competence = convertedRefereeCompetence(wrestler, currentYear, settings);
  return {
    id: `ref-of-${wrestler.id}`,
    name: wrestler.name,
    competence,
    // A wrestler's willingness to bend is their own character, not a price
    // list. Somebody with an attitude problem is somebody who can be got at.
    bendable: clamp(Math.round(50 - wrestler.attitude / 2.5), 0, 100),
    // The whole reason to convert one instead of signing a shirt.
    toughness: wrestler.toughness,
    age: wrestler.age,
    experience: yearsPro(wrestler, currentYear),
    blurb: 'One of the boys, in the shirt full time.',
    promotionId: wrestler.promotionId,
    contract: null,
    sharpness: 100,
    reputation: competence,
    matchesTonight: 0,
    careerMatches: 0,
    recentMatches: 0,
    recentMisses: 0,
    injury: wrestler.injury,
    weeksUnsigned: 0,
    wrestlerId: wrestler.id,
  };
}

/**
 * They learn the job by working it.
 *
 * Only converted wrestlers improve. The hand-written pool are who they are —
 * Earl Hollis has been doing this for thirty years and is not going to get
 * better at it — and this is the thing the year of commitment actually buys.
 */
export function learnOnTheJob(referee: Referee, settings: WorldSettings): void {
  if (!referee.wrestlerId) return;
  const before = referee.competence;
  referee.competence = Math.min(
    settings.convertedRefereeCompetenceCap,
    referee.competence + settings.convertedRefereeLearningRate,
  );
  // Reputation follows what he can do, or a man who has genuinely got better
  // stays stuck at the number he started at.
  referee.reputation = clamp(referee.reputation + (referee.competence - before), 0, 100);
}

/**
 * A wrestler as a mouthpiece.
 *
 * Managers are per-appearance hires from a standing pool, so a converted one
 * is a Manager record like any other — except that the fee is zero, because
 * he is already on the payroll. Their talking is their talking; what they add
 * at ringside is what they were as a presence.
 */
export function managerFromWrestler(wrestler: Wrestler): Manager {
  return {
    id: `mgr-of-${wrestler.id}`,
    name: wrestler.name,
    micWork: wrestler.charisma,
    // Somebody the crowd already knows is worth more standing there than a
    // stranger in a suit, whatever either of them can say.
    presence: clamp(Math.round(wrestler.popularity * 0.6 + wrestler.charisma * 0.4), 0, 100),
    deviousness: clamp(Math.round(50 - wrestler.alignment / 2), 0, 100),
    feePerShow: 0,
    blurb: 'One of your own, out there in a suit.',
    wrestlerId: wrestler.id,
  };
}

/** Everybody on the roster currently doing something other than wrestling. */
export function staffOf(roster: readonly Wrestler[], role: TransitionRole): Wrestler[] {
  return roster.filter((w) => w.role === role && !w.deceased && w.careerStatus !== 'retired');
}

/** Who can actually be booked in a match. Not the officials, not the suits. */
export function bookableRoster(roster: readonly Wrestler[]): Wrestler[] {
  return roster.filter((w) => w.role === 'wrestler');
}
