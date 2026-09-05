// An owner's niece or nephew, thrown onto the player's own roster.
//
// Somebody important around here wants a relative to be a wrestler — not
// just a wrestler, a champion — and the booker gets no say in it. They arrive
// with a real, absurd wage (a multiple of whatever the promotion's own
// biggest star already earns) and stats that justify none of it. They get
// ninety days to win any singles title. Miss it, and the deal doesn't end,
// it extends: a full year on the books at the same rate before the front
// office finally gives up on them.
//
// One exit door either way — free agency — but two very different stories
// get to it. Win a title at any point in that window and it's a real turn:
// a permanent stat bump on top of whatever this proves, and the existing
// weekly ego drift (career/ego.ts) organically reads their new popularity
// and title reign and grows them into a genuinely entitled champion over the
// following weeks — nothing here touches ego directly once they're signed.
// Whenever they eventually and naturally lose that belt (no special timer,
// that's just wrestling), they claim they meant to and walk. Never win
// anything at all, and a year of overpaying them was the whole cost.
//
// Player-only. Rivals use a separate, simplified economy and don't get one
// of these.

import type { Rng } from '../rng';
import { clamp, gaussian, randInt } from '../rng';
import type { Wrestler, WorldSettings } from '../types';
import { generateWrestler } from '../generate/wrestler';

export function eligibleForFamilyBusiness(
  week: number,
  alreadyActive: boolean,
  settings: WorldSettings,
): boolean {
  if (alreadyActive) return false;
  return week >= settings.familyBusinessEarliestWeek;
}

/**
 * A real bust, and entitled about it. Skill/agility/stamina/strength and
 * popularity all land near the floor — nobody has seen them do anything and
 * there's nothing here to see yet — while ego starts high on its own,
 * independent of anything they've earned. Everything else (name, age,
 * appearance, gender) comes from the ordinary generator; only the things
 * that make them a bust are overridden.
 */
export function generateFamilyBusinessSignee(
  rng: Rng,
  existingNames: Set<string>,
  currentYear: number,
  settings: WorldSettings,
): Wrestler {
  const person = generateWrestler(rng, existingNames, { settings, currentYear });
  const ceiling = settings.familyBusinessStatCeiling;
  // A low, slightly varied number under the ceiling — never a flat floor, so
  // two of these in the same save don't read as identical duds.
  const bust = () => clamp(Math.round(Math.abs(gaussian(rng, 0, ceiling * 0.4))), 5, ceiling);

  return {
    ...person,
    strength: bust(),
    skill: bust(),
    agility: bust(),
    stamina: bust(),
    popularity: bust(),
    careerHighPopularity: 0,
    ego: clamp(settings.familyBusinessStartingEgo + randInt(rng, -5, 5), 0, 100),
    debutYear: currentYear,
    careerStatus: 'rookie',
    cardStatus: 'prospect',
    promotionId: null,
    contract: null,
    momentum: 0,
    record: { wins: 0, losses: 0, draws: 0 },
    titleReigns: [],
    role: 'wrestler',
  };
}

/** Their weekly rate — always a real multiple of the biggest earner already on the books. */
export function familyBusinessWage(topEarnerRate: number, settings: WorldSettings): number {
  return Math.round((topEarnerRate * settings.familyBusinessWageMultiplier) / 25) * 25;
}

/** The stat jump on winning a title — flat, applied once, on top of whatever the title win already pays out. */
export function familyBusinessTitleWinSurge(
  settings: WorldSettings,
): { strength: number; skill: number; agility: number; stamina: number } {
  const bump = settings.familyBusinessStatBump;
  return { strength: bump, skill: bump, agility: bump, stamina: bump };
}

export function familyBusinessArrivesLine(name: string, weeklyRate: number): string {
  return (
    `Somebody who signs the checks around here has a niece or nephew who wants to be a wrestler — not just a ` +
    `wrestler, a champion. ${name} is on the roster as of tonight at ${Math.round(weeklyRate).toLocaleString()} ` +
    `a week, a figure that has nothing to do with anything ${name} has shown anybody yet. The word from upstairs ` +
    `is plain: any title will do, but a title is not optional.`
  );
}

export function familyBusinessExtendedLine(name: string): string {
  return (
    `Ninety days came and went and ${name} still hasn't won a thing. The front office isn't cutting them loose — ` +
    `not yet. The deal now runs a full year, same money, same demand, more time to make good on it.`
  );
}

export function familyBusinessWinsTitleLine(name: string, titleName: string): string {
  return (
    `${name} just won the ${titleName}. Whatever anybody thought of this signing when it happened, that's a real ` +
    `title around a real waist now, and ${name} is going to make sure nobody in the building forgets it.`
  );
}

export function familyBusinessGracefulExitLine(name: string, titleName: string): string {
  return (
    `${name} dropped the ${titleName} this week — and says it was the plan all along, time to move on to ` +
    `bigger things. Whether anybody believes that or not, ${name} is officially a free agent as of tonight.`
  );
}

export function familyBusinessBustExitLine(name: string): string {
  return (
    `A year on the books and ${name} never won a thing. The front office has finally had enough — ${name} is off ` +
    `the payroll and a free agent as of tonight, and whoever signs them next inherits the same problem for a lot ` +
    `less money.`
  );
}
