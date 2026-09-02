// Breaking up a team or faction on purpose — kicking a member out, staged as
// an on-screen betrayal instead of a quiet roster edit.
//
// The booker can always just remove somebody (see tagTeams.ts's own
// disbanding). What this module adds is the staged option: the departing
// member gets left on the books, booked normally, and when their next match
// actually resolves the rest of the group — and their manager, if they have
// one under a real signed deal — turns on them. That moment is a decision
// for the booker, not a coin flip: mirrors confrontationCall.ts's letItHappen
// / breakItUp shape exactly, because it is the same kind of call — a
// physical consequence that already rolled, waiting on whether the office
// lets it stand.

import type { Id, Wrestler } from '../types';

/** Two to three of these is a team; four or more is a faction. Nothing else decides it. */
export function kindForSize(size: number): 'tagTeam' | 'stable' {
  return size >= 4 ? 'stable' : 'tagTeam';
}

/**
 * A breakup staged for the next time the departing member actually works.
 * Deliberately thin — who's available to do the turning is re-derived at
 * fire time (see availableAttackers), not frozen here, because a roster
 * changes in the weeks between staging a turn and it actually landing.
 */
export interface ScheduledGroupTurn {
  id: Id;
  stableId: Id;
  stableName: string;
  departingId: Id;
  departingName: string;
  scheduledWeek: number;
}

export interface GroupTurnCall {
  week: number;
  stableId: Id;
  stableName: string;
  departingId: Id;
  departingName: string;
  /** Whoever's actually around to throw the beating tonight. */
  attackerIds: Id[];
  attackerNames: string[];
  /** The departing member's real signed manager, if they have one and he's around too. */
  managerId: Id | null;
  managerName: string | null;
  /** Pre-rolled so the answer itself never has to draw — see rollBeatdownInjuryWeeks. */
  injuryWeeks: number;
}

export type GroupTurnCallChoiceId = 'letItHappen' | 'breakItUp';

export interface GroupTurnCallOption {
  id: GroupTurnCallChoiceId;
  label: string;
  gains: string;
  costs: string;
}

export const GROUP_TURN_CALL_OPTIONS: GroupTurnCallOption[] = [
  {
    id: 'letItHappen',
    label: 'Let it happen',
    gains: 'Real heat — the split means something now',
    costs: 'The beating sticks exactly as it landed',
  },
  {
    id: 'breakItUp',
    label: 'Pull them apart',
    gains: 'Nobody gets hurt tonight',
    costs: 'The room sees the office step in, and that has its own cost',
  },
];

export type GroupKickProblem = 'notInGroup' | 'alreadyDisbanded';

export const GROUP_KICK_PROBLEM_TEXT: Record<GroupKickProblem, string> = {
  notInGroup: 'They are not in this group',
  alreadyDisbanded: 'This group already split up',
};

export interface GroupKickCheck {
  ok: boolean;
  problem: GroupKickProblem | null;
}

/** Whether this member can be kicked from this group right now. */
export function canKickFromGroup(
  stable: { memberIds: readonly Id[]; disbandedWeek: number | null },
  memberId: Id,
): GroupKickCheck {
  if (stable.disbandedWeek !== null) return { ok: false, problem: 'alreadyDisbanded' };
  if (!stable.memberIds.includes(memberId)) return { ok: false, problem: 'notInGroup' };
  return { ok: true, problem: null };
}

/**
 * Who fronts the group once this member is gone. If they weren't the leader,
 * nothing changes; if they were, the most popular of who's left takes over.
 * Returns null only when nobody is left, which the caller should treat as a
 * full disband rather than call this at all.
 */
export function nextLeaderAfterKick(
  stable: { leaderId: Id | null },
  remainingMembers: readonly Wrestler[],
  departingId: Id,
): Id | null {
  if (stable.leaderId !== departingId) return stable.leaderId;
  if (remainingMembers.length === 0) return null;
  return remainingMembers.reduce((best, w) => (w.popularity > best.popularity ? w : best), remainingMembers[0]!).id;
}

/**
 * Who's actually around to do the turning tonight — the rest of the group,
 * minus the departing member, filtered by the same availability the game
 * already uses to decide who can be booked at all. Re-run at fire time on
 * purpose: staged does not mean frozen.
 */
export function availableAttackers(
  memberIds: readonly Id[],
  departingId: Id,
  wrestlers: Readonly<Record<Id, Wrestler>>,
  canWork: (w: Wrestler) => boolean,
): Wrestler[] {
  return memberIds
    .filter((id) => id !== departingId)
    .map((id) => wrestlers[id])
    .filter((w): w is Wrestler => Boolean(w) && canWork(w!));
}

/**
 * A manager is available to join the turn on the same physical terms as
 * anybody else at ringside — not deceased, not hurt, not on leave — but
 * `canWork`'s own role gate would always reject a manager (it requires
 * `role === 'wrestler'`), so this checks the same physical conditions
 * without that gate.
 */
export function managerAvailable(manager: Wrestler): boolean {
  if (manager.deceased || manager.careerStatus === 'retired') return false;
  if (manager.injury && !manager.clearedToWorkHurt) return false;
  if (manager.leave) return false;
  return true;
}

/** How long the beatdown's injury lasts, pre-rolled off an entity-seeded RNG. */
export function rollBeatdownInjuryWeeks(
  rng: { next(): number },
  min: number,
  max: number,
): number {
  return Math.floor(rng.next() * (max - min + 1)) + min;
}

export function buildGroupTurnCall(
  week: number,
  stableId: Id,
  stableName: string,
  departing: Wrestler,
  attackers: readonly Wrestler[],
  manager: Wrestler | null,
  injuryWeeks: number,
): GroupTurnCall {
  return {
    week,
    stableId,
    stableName,
    departingId: departing.id,
    departingName: departing.name,
    attackerIds: attackers.map((w) => w.id),
    attackerNames: attackers.map((w) => w.name),
    managerId: manager?.id ?? null,
    managerName: manager?.name ?? null,
    injuryWeeks,
  };
}
