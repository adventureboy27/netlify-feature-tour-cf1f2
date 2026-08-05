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
import { pick, randInt } from '../rng';
import type { Id, Stable, Wrestler } from '../types';
import { TEAM_NAMES, WOMENS_TEAM_NAMES, surnamePair } from '../../data/teamNames';
import { stableColorsFrom } from '../generate/gimmickLook';

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
        colors: stableColorsFrom(a),
        // A thrown-together pairing does not dress alike; a real team does.
        unifiedLook: true,
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

/** A pairing the RNG can draw when a promotion needs one more team. */
export function randomPartner(rng: Rng, candidates: readonly Wrestler[]): Wrestler | undefined {
  if (candidates.length === 0) return undefined;
  return candidates[randInt(rng, 0, candidates.length - 1)];
}
