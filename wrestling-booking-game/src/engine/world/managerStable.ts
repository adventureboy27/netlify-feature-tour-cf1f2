// A manager's book, once it's grown into something with a name.
//
// Not a Stable — deliberately. Stable.memberIds is leaned on everywhere
// (bookableRoster, kickFromGroup, faction-destroyer eligibility, the booking
// screens) as "a unit the booker puts on a card together," and a manager's
// clients aren't that; they're a business he's built, each still booked and
// paid individually. So membership is never stored here at all — it's always
// bookOf(representations, managerId), read fresh, the same source of truth
// bookLine() already renders from. This is only ever a name and a moment.

import type { Id } from '../types';
import type { Rng } from '../rng';
import { pick } from '../rng';
import { MANAGER_STABLE_NAMES } from '../../data/managerStableNames';

export interface ManagerStable {
  managerId: Id;
  name: string;
  formedWeek: number;
}

export function nameManagerStable(rng: Rng, managerName: string): string {
  const template = pick(rng, MANAGER_STABLE_NAMES);
  return template.replace('{manager}', managerName);
}

export function formManagerStable(rng: Rng, managerId: Id, managerName: string, week: number): ManagerStable {
  return { managerId, name: nameManagerStable(rng, managerName), formedWeek: week };
}

export function dissolveManagerStable(stables: readonly ManagerStable[], managerId: Id): ManagerStable[] {
  return stables.filter((s) => s.managerId !== managerId);
}

export function stableOf(stables: readonly ManagerStable[], managerId: Id): ManagerStable | null {
  return stables.find((s) => s.managerId === managerId) ?? null;
}

export function managerStableLine(stable: ManagerStable, clientCount: number): string {
  return `${stable.name} is official now — ${clientCount} names on the book, and everybody knows whose.`;
}

export function managerStableDissolvedLine(stable: ManagerStable): string {
  return `${stable.name} isn't really a thing anymore. The book got too thin to call it one.`;
}
