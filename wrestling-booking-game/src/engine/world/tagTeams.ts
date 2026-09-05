// Tag teams.
//
// The tag belts existed before this and the AI booked tag matches, but there
// were no *teams* — every tag match was two people who happened to be put on
// the same side that week. That makes the tag division unrankable and the tag
// titles meaningless, since the champions were almost never the same two
// people twice.
//
// A team here is a `Stable` of kind 'tagTeam': a named, persistent pairing
// with its own win/loss record and its own colours. Every promotion is given a
// few at world creation and the AI books them intact, so a tag division has
// acts in it that can be ranked, feuded with, and remembered.

import type { Rng } from '../rng';
import { clamp } from '../rng';
import type { WorldSettings } from '../types';
import { pick } from '../rng';
import type { GroupGimmick, Id, Stable, Wrestler } from '../types';
import { TEAM_NAMES, WOMENS_TEAM_NAMES, surnamePair } from '../../data/teamNames';

export interface TeamFormationContext {
  /** Names already used anywhere in the world. */
  taken: ReadonlySet<string>;
  week: number;
  /** How many teams to try to form from this roster. */
  count: number;
}

/**
 * A name nobody else has. Falls back to the two surnames, which cannot
 * collide in practice and reads like a real commentary call.
 */
export function teamName(rng: Rng, a: Wrestler, b: Wrestler, taken: ReadonlySet<string>): string {
  const pool = (a.gender === 'f' && b.gender === 'f' ? WOMENS_TEAM_NAMES : TEAM_NAMES).filter((n) => !taken.has(n));
  if (pool.length > 0) return pick(rng, pool);
  return surnamePair(a.name, b.name);
}

/**
 * Pair a roster up into teams. Partners are drawn from adjacent standing —
 * a main eventer does not form a regular team with an opening-match jobber,
 * and if they did it would not be a team, it would be a favour.
 */
export function formTeams(
  rng: Rng,
  roster: readonly Wrestler[],
  promotionId: Id,
  ctx: TeamFormationContext,
  nextId: () => string,
): Stable[] {
  // Same gender only: an intergender tag team is a different thing and the
  // divisions are separate (§5 womensDivision).
  const byGender = new Map<string, Wrestler[]>();
  for (const w of roster) {
    const list = byGender.get(w.gender) ?? [];
    list.push(w);
    byGender.set(w.gender, list);
  }

  const teams: Stable[] = [];
  const used = new Set<Id>();
  const taken = new Set(ctx.taken);

  for (const [, group] of byGender) {
    const ranked = [...group].sort((a, b) => b.popularity - a.popularity);
    for (let i = 0; i + 1 < ranked.length && teams.length < ctx.count; i += 2) {
      const a = ranked[i]!;
      const b = ranked[i + 1]!;
      if (used.has(a.id) || used.has(b.id)) continue;
      // Not everybody teams up. A roster where every single person is in a tag
      // team has no singles division left.
      if (rng.next() > 0.5) continue;

      const name = teamName(rng, a, b, taken);
      taken.add(name);
      used.add(a.id);
      used.add(b.id);

      teams.push({
        id: nextId(),
        name,
        kind: 'tagTeam',
        memberIds: [a.id, b.id],
        leaderId: a.id,
        formedWeek: ctx.week,
        disbandedWeek: null,
        record: { wins: 0, losses: 0, draws: 0 },
      });
    }
  }

  // Which promotion they belong to is implied by their members, so nothing is
  // stored here — but the caller wants it deterministic, hence the id source.
  void promotionId;
  return teams;
}

/**
 * Whether these two can be put together, and why not if they cannot.
 *
 * The rules are the ones the divisions already imply — you cannot team
 * somebody who is not yours, somebody already in a team, or somebody from the
 * other division — plus the obvious one about not teaming a man with himself.
 * Everything else is allowed: a main eventer and a rookie is a bad idea, not
 * an illegal one, and the game does not stop you making bad decisions.
 */
export type TeamFormationProblem =
  | 'samePerson'
  | 'notOnYourRoster'
  | 'alreadyInATeam'
  | 'differentDivisions'
  | 'nameTaken'
  | 'tooFewMembers';

export const TEAM_PROBLEM_TEXT: Record<TeamFormationProblem, string> = {
  samePerson: 'Somebody cannot team with themselves',
  notOnYourRoster: 'They are not on your roster',
  alreadyInATeam: 'One of them is already in a team',
  differentDivisions: 'The divisions are separate',
  nameTaken: 'Another team already has that name',
  tooFewMembers: 'A team needs at least two people',
};

/** Two to three of these is a team; four or more is a faction. Nothing else decides it. */
export function kindForSize(size: number): 'tagTeam' | 'stable' {
  return size >= 4 ? 'stable' : 'tagTeam';
}

export interface TeamFormationCheck {
  ok: boolean;
  problem: TeamFormationProblem | null;
}

export function canFormTeam(
  a: Wrestler | undefined,
  b: Wrestler | undefined,
  stables: readonly Stable[],
  rosterIds: ReadonlySet<Id>,
  name?: string,
): TeamFormationCheck {
  const fail = (problem: TeamFormationProblem): TeamFormationCheck => ({ ok: false, problem });

  if (!a || !b) return fail('notOnYourRoster');
  if (a.id === b.id) return fail('samePerson');
  if (!rosterIds.has(a.id) || !rosterIds.has(b.id)) return fail('notOnYourRoster');
  if (a.gender !== b.gender) return fail('differentDivisions');
  if (teamOf(stables, a.id) || teamOf(stables, b.id)) return fail('alreadyInATeam');

  const wanted = name?.trim();
  if (wanted && stables.some((s) => s.disbandedWeek === null && s.name.toLowerCase() === wanted.toLowerCase())) {
    return fail('nameTaken');
  }

  return { ok: true, problem: null };
}

/** Put two people together. The caller has already checked they can be. */
export function createTeam(
  rng: Rng,
  a: Wrestler,
  b: Wrestler,
  week: number,
  id: Id,
  taken: ReadonlySet<string>,
  name?: string,
): Stable {
  return {
    id,
    name: name?.trim() || teamName(rng, a, b, taken),
    kind: 'tagTeam',
    memberIds: [a.id, b.id],
    // The more established of the two fronts it — same rule the generated
    // teams follow.
    leaderId: a.popularity >= b.popularity ? a.id : b.id,
    formedWeek: week,
    disbandedWeek: null,
    record: { wins: 0, losses: 0, draws: 0 },
  };
}

/** Live teams whose members are all on this roster and able to work. */
export function availableTeams(
  stables: readonly Stable[],
  rosterIds: ReadonlySet<Id>,
  canWork: (id: Id) => boolean,
): Stable[] {
  return stables.filter(
    (s) =>
      s.kind === 'tagTeam' &&
      s.disbandedWeek === null &&
      s.memberIds.length === 2 &&
      s.memberIds.every((id) => rosterIds.has(id) && canWork(id)),
  );
}

/** The team somebody is in, if any. */
export function teamOf(stables: readonly Stable[], wrestlerId: Id): Stable | undefined {
  return stables.find((s) => s.kind === 'tagTeam' && s.disbandedWeek === null && s.memberIds.includes(wrestlerId));
}

/** The team OR faction somebody is in, if any — `teamOf` widened to both kinds. */
export function groupOf(stables: readonly Stable[], wrestlerId: Id): Stable | undefined {
  return stables.find((s) => s.disbandedWeek === null && s.memberIds.includes(wrestlerId));
}

/**
 * `canFormTeam` generalized to any group size — the signing meeting's
 * GroupGimmick pairing needs to check a tag team (2) or a faction (3+) the
 * same way. Same rules as a two-person team: everybody on the roster,
 * everybody the same division, nobody already spoken for, the name is free.
 */
export function canFormGroup(
  members: readonly (Wrestler | undefined)[],
  stables: readonly Stable[],
  rosterIds: ReadonlySet<Id>,
  name: string,
): TeamFormationCheck {
  const fail = (problem: TeamFormationProblem): TeamFormationCheck => ({ ok: false, problem });

  if (members.length < 2) return fail('tooFewMembers');
  if (members.some((m) => !m)) return fail('notOnYourRoster');
  const real = members as Wrestler[];
  if (new Set(real.map((m) => m.id)).size !== real.length) return fail('samePerson');
  if (real.some((m) => !rosterIds.has(m.id))) return fail('notOnYourRoster');
  if (real.some((m) => m.gender !== real[0]!.gender)) return fail('differentDivisions');
  if (real.some((m) => groupOf(stables, m.id))) return fail('alreadyInATeam');

  const wanted = name.trim();
  if (wanted && stables.some((s) => s.disbandedWeek === null && s.name.toLowerCase() === wanted.toLowerCase())) {
    return fail('nameTaken');
  }

  return { ok: true, problem: null };
}

/**
 * Put a group together under a `GroupGimmick`'s shared identity — the
 * signing-meeting pairing. Unlike `createTeam`, the name and `kind` come
 * from the gimmick itself rather than being generated, and it covers both
 * a two-person team and a full faction with the same call. The caller has
 * already checked `canFormGroup`.
 */
export function formGroupGimmickStable(members: readonly Wrestler[], group: GroupGimmick, week: number, id: Id): Stable {
  const leader = members.reduce((best, w) => (w.popularity > best.popularity ? w : best), members[0]!);
  return {
    id,
    name: group.name,
    kind: group.kind,
    memberIds: members.map((w) => w.id),
    leaderId: leader.id,
    formedWeek: week,
    disbandedWeek: null,
    record: { wins: 0, losses: 0, draws: 0 },
  };
}

/**
 * `createTeam` generalized to any group size — the booker forming a team or
 * a faction from the existing roster, rather than the signing-meeting's
 * fixed-gimmick pairing. `kind` follows purely from how many people are in
 * it (`kindForSize`); a name is required by the caller for anything bigger
 * than a pair, since `teamName`'s pool is pair-flavored and has nothing
 * sensible to say about four people at once.
 */
export function createPlayerGroup(
  rng: Rng,
  members: readonly Wrestler[],
  week: number,
  id: Id,
  taken: ReadonlySet<string>,
  name?: string,
): Stable {
  const leader = members.reduce((best, w) => (w.popularity > best.popularity ? w : best), members[0]!);
  const wanted = name?.trim();
  const autoName =
    wanted || (members.length === 2 ? teamName(rng, members[0]!, members[1]!, taken) : surnamePair(members[0]!.name, members[1]!.name));
  return {
    id,
    name: autoName,
    kind: kindForSize(members.length),
    memberIds: members.map((w) => w.id),
    leaderId: leader.id,
    formedWeek: week,
    disbandedWeek: null,
    record: { wins: 0, losses: 0, draws: 0 },
  };
}

/** Record a tag result against the team, not just the two wrestlers. */
export function recordTeamResult(team: Stable, outcome: 'win' | 'loss' | 'draw'): void {
  if (outcome === 'win') team.record.wins += 1;
  else if (outcome === 'loss') team.record.losses += 1;
  else team.record.draws += 1;
}

/**
 * A team breaks up when one of them is gone — retired, dead, or signed
 * somewhere else. Returns the ids of teams that were disbanded.
 */
export function disbandBrokenTeams(
  stables: Stable[],
  week: number,
  stillTogether: (memberIds: readonly Id[]) => boolean,
): Id[] {
  const disbanded: Id[] = [];
  for (const team of stables) {
    if (team.kind !== 'tagTeam' || team.disbandedWeek !== null) continue;
    if (stillTogether(team.memberIds)) continue;
    team.disbandedWeek = week;
    disbanded.push(team.id);
  }
  return disbanded;
}

/**
 * How good a team is, 0-100. Their own record matters more than the sum of
 * the two people in it — that is what "they have chemistry" means mechanically.
 */
export function teamStrength(team: Stable, members: readonly Wrestler[], teamRecordWeight: number): number {
  if (members.length === 0) return 0;
  const popularity = members.reduce((sum, w) => sum + w.popularity, 0) / members.length;
  const momentum = members.reduce((sum, w) => sum + w.momentum, 0) / members.length;

  const fought = team.record.wins + team.record.losses + team.record.draws;
  const winPct = fought === 0 ? 0.5 : (team.record.wins + team.record.draws * 0.5) / fought;

  return popularity * (1 - teamRecordWeight) + winPct * 100 * teamRecordWeight * 0.5 + momentum * teamRecordWeight * 0.5;
}

/** How many weeks a partnership has lasted. Longevity is its own credential. */
export function weeksTogether(team: Stable, currentWeek: number): number {
  return Math.max(0, (team.disbandedWeek ?? currentWeek) - team.formedWeek);
}

/** Deterministic id source for teams created at world creation. */
export function teamIdFactory(prefix: string): () => string {
  let n = 0;
  return () => `${prefix}-team-${n++}`;
}



/**
 * How many teams a roster of this size should carry. A fixed count put six of
 * a fourteen-person company into tag teams while leaving a forty-person
 * company with the same three, so the tag division's depth had nothing to do
 * with the size of the company it belonged to.
 */
export function tagTeamCountFor(rosterSize: number, settings: WorldSettings): number {
  const wanted = Math.round(rosterSize / settings.wrestlersPerTagTeam);
  return clamp(wanted, settings.tagTeamsMin, settings.tagTeamsMax);
}
