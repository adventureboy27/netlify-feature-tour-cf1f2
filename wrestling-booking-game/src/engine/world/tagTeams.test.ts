import { describe, it, expect } from 'vitest';
import {
  formTeams,
  teamIdFactory,
  availableTeams,
  teamOf,
  groupOf,
  recordTeamResult,
  disbandBrokenTeams,
  teamStrength,
  weeksTogether,
  teamName,
  kindForSize,
  canFormGroup,
  createPlayerGroup,
} from './tagTeams';
import { rngFromSeed } from '../rng';
import { generateWrestlers } from '../generate/wrestler';
import { TEAM_NAMES, WOMENS_TEAM_NAMES } from '../../data/teamNames';
import type { Stable, Wrestler } from '../types';

function roster(count: number, gender: 'm' | 'f' = 'm'): Wrestler[] {
  return generateWrestlers(rngFromSeed('teams'), count, { currentYear: 1985 }).map((w, i) => ({
    ...w,
    gender,
    popularity: 80 - i * 3,
    promotionId: 'p',
  }));
}

function build(people: Wrestler[], count = 3, taken = new Set<string>()) {
  return formTeams(rngFromSeed('form'), people, 'p', { taken, week: 1, count }, teamIdFactory('p'));
}

describe('forming teams', () => {
  it('makes named two-person teams and never uses somebody twice', () => {
    const teams = build(roster(16));
    expect(teams.length).toBeGreaterThan(0);
    const members = teams.flatMap((t) => t.memberIds);
    expect(new Set(members).size).toBe(members.length);
    for (const team of teams) {
      expect(team.memberIds).toHaveLength(2);
      expect(team.kind).toBe('tagTeam');
      expect(team.name.length).toBeGreaterThan(3);
      expect(team.record).toEqual({ wins: 0, losses: 0, draws: 0 });
    }
  });

  it('leaves most of the roster in the singles division', () => {
    const people = roster(20);
    const teams = build(people, 3);
    const inTeams = teams.flatMap((t) => t.memberIds).length;
    expect(inTeams).toBeLessThan(people.length / 2);
  });

  it('never pairs across the divisions', () => {
    const mixed = [...roster(8, 'm'), ...roster(8, 'f').map((w, i) => ({ ...w, id: `f-${i}` }))];
    for (const team of build(mixed, 6)) {
      const genders = team.memberIds.map((id) => mixed.find((w) => w.id === id)!.gender);
      expect(new Set(genders).size).toBe(1);
    }
  });

  it('takes women’s team names for a women’s team', () => {
    const name = teamName(rngFromSeed('n'), ...(roster(2, 'f') as [Wrestler, Wrestler]), new Set());
    expect(WOMENS_TEAM_NAMES).toContain(name);
  });

  it('falls back to the two surnames when the name pool is gone', () => {
    const [a, b] = roster(2);
    const name = teamName(rngFromSeed('n'), a!, b!, new Set(TEAM_NAMES));
    expect(name).toContain('&');
  });

  it('does not reuse a name another promotion already has', () => {
    const first = build(roster(16), 3);
    const second = build(roster(16), 3, new Set(first.map((t) => t.name)));
    for (const team of second) expect(first.map((t) => t.name)).not.toContain(team.name);
  });
});

describe('teams in the world', () => {
  it('only offers teams whose members can all work', () => {
    const people = roster(16);
    const teams = build(people);
    const ids = new Set(people.map((w) => w.id));
    const hurt = teams[0]!.memberIds[0]!;

    expect(availableTeams(teams, ids, () => true)).toHaveLength(teams.length);
    expect(availableTeams(teams, ids, (id) => id !== hurt)).toHaveLength(teams.length - 1);
  });

  it('only offers teams whose members are on this roster', () => {
    const people = roster(16);
    const teams = build(people);
    const withoutOne = new Set(people.map((w) => w.id).filter((id) => id !== teams[0]!.memberIds[1]));
    expect(availableTeams(teams, withoutOne, () => true)).toHaveLength(teams.length - 1);
  });

  it('finds the team somebody is in', () => {
    const teams = build(roster(16));
    expect(teamOf(teams, teams[0]!.memberIds[0]!)?.id).toBe(teams[0]!.id);
    expect(teamOf(teams, 'nobody')).toBeUndefined();
  });

  it('keeps a team record separate from the wrestlers’', () => {
    const team = build(roster(16))[0]!;
    recordTeamResult(team, 'win');
    recordTeamResult(team, 'win');
    recordTeamResult(team, 'loss');
    recordTeamResult(team, 'draw');
    expect(team.record).toEqual({ wins: 2, losses: 1, draws: 1 });
  });
});

describe('breaking up', () => {
  it('disbands a team when the pair is no longer together', () => {
    const teams = build(roster(16));
    const doomed = teams[0]!;
    const disbanded = disbandBrokenTeams(teams, 40, (ids) => !ids.includes(doomed.memberIds[0]!));

    expect(disbanded).toEqual([doomed.id]);
    expect(doomed.disbandedWeek).toBe(40);
    expect(availableTeams(teams, new Set(teams.flatMap((t) => t.memberIds)), () => true)).not.toContain(doomed);
  });

  it('does not disband a team twice', () => {
    const teams = build(roster(16));
    disbandBrokenTeams(teams, 40, () => false);
    expect(disbandBrokenTeams(teams, 50, () => false)).toHaveLength(0);
    expect(teams[0]!.disbandedWeek).toBe(40);
  });

  it('counts how long a partnership lasted', () => {
    const team: Stable = { ...build(roster(16))[0]!, formedWeek: 10 };
    expect(weeksTogether(team, 60)).toBe(50);
    expect(weeksTogether({ ...team, disbandedWeek: 30 }, 60)).toBe(20);
  });
});

describe('how good a team is', () => {
  it('rates a winning team above an identical losing one', () => {
    const people = roster(16);
    const [a, b] = build(people, 2);
    a!.record = { wins: 20, losses: 2, draws: 0 };
    b!.record = { wins: 2, losses: 20, draws: 0 };

    const membersOf = (team: Stable) => team.memberIds.map((id) => people.find((w) => w.id === id)!);
    // Same people either way, so the difference is entirely the record.
    const flat = membersOf(a!).map((w) => ({ ...w, popularity: 60, momentum: 50 }));
    expect(teamStrength(a!, flat, 0.5)).toBeGreaterThan(teamStrength(b!, flat, 0.5));
  });

  it('treats an unproven team as neither good nor bad', () => {
    const people = roster(16);
    const team = build(people, 1)[0]!;
    const members = team.memberIds.map((id) => people.find((w) => w.id === id)!);
    expect(teamStrength(team, members, 0.5)).toBeGreaterThan(0);
  });
});

describe('forming a player group of any size', () => {
  it('draws the team/faction line at four', () => {
    expect(kindForSize(2)).toBe('tagTeam');
    expect(kindForSize(3)).toBe('tagTeam');
    expect(kindForSize(4)).toBe('stable');
    expect(kindForSize(8)).toBe('stable');
  });

  it('refuses a single person — there is nobody to team with', () => {
    const [a] = roster(1);
    expect(canFormGroup([a], [], new Set([a!.id]), '').ok).toBe(false);
    expect(canFormGroup([a], [], new Set([a!.id]), '').problem).toBe('tooFewMembers');
  });

  it('refuses an empty pick', () => {
    expect(canFormGroup([], [], new Set(), '').problem).toBe('tooFewMembers');
  });

  it('allows a real trio once everybody is real, on the roster, and unattached', () => {
    const people = roster(3);
    const rosterIds = new Set(people.map((w) => w.id));
    expect(canFormGroup(people, [], rosterIds, 'The Trio').ok).toBe(true);
  });

  it('creates a tagTeam-kind act for two or three people and a stable-kind act for four or more', () => {
    const trio = roster(3);
    const group = createPlayerGroup(rngFromSeed('g'), trio, 5, 'grp-1', new Set(), 'The Trio');
    expect(group.kind).toBe('tagTeam');
    expect(group.memberIds).toEqual(trio.map((w) => w.id));
    expect(group.name).toBe('The Trio');

    const four = roster(4);
    const faction = createPlayerGroup(rngFromSeed('g'), four, 5, 'grp-2', new Set(), 'The Faction');
    expect(faction.kind).toBe('stable');
  });

  it('fronts the group with whoever is most popular', () => {
    const people = roster(4); // popularity descends by index in roster()
    const group = createPlayerGroup(rngFromSeed('g'), people, 5, 'grp-3', new Set(), 'Leaders');
    expect(group.leaderId).toBe(people[0]!.id);
  });

  it('auto-generates a name for a pair the same way createTeam does, but requires one for a bigger group to be chosen by the caller', () => {
    const pair = roster(2);
    const group = createPlayerGroup(rngFromSeed('g'), pair, 5, 'grp-4', new Set());
    expect(group.name.length).toBeGreaterThan(0);
  });

  it('groupOf finds a faction the same way it finds a team', () => {
    const four = roster(4);
    const stables = [createPlayerGroup(rngFromSeed('g'), four, 5, 'grp-5', new Set(), 'The Faction')];
    expect(groupOf(stables, four[0]!.id)?.id).toBe('grp-5');
  });
});
