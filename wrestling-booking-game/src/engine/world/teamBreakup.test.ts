import { describe, it, expect } from 'vitest';
import {
  kindForSize,
  canKickFromGroup,
  nextLeaderAfterKick,
  availableAttackers,
  managerAvailable,
  rollBeatdownInjuryWeeks,
  buildGroupTurnCall,
} from './teamBreakup';
import { generateWrestlers } from '../generate/wrestler';
import { rngFromSeed } from '../rng';
import type { Wrestler } from '../types';

function roster(count: number): Wrestler[] {
  return generateWrestlers(rngFromSeed('breakup'), count, { currentYear: 1985 }).map((w, i) => ({
    ...w,
    id: `w-${i}`,
    popularity: 80 - i * 3,
    role: 'wrestler' as const,
  }));
}

describe('kindForSize', () => {
  it('mirrors tagTeams.ts — two or three is a team, four or more a faction', () => {
    expect(kindForSize(2)).toBe('tagTeam');
    expect(kindForSize(3)).toBe('tagTeam');
    expect(kindForSize(4)).toBe('stable');
  });
});

describe('canKickFromGroup', () => {
  it('refuses somebody who is not actually in the group', () => {
    const check = canKickFromGroup({ memberIds: ['a', 'b'], disbandedWeek: null }, 'c');
    expect(check.ok).toBe(false);
    expect(check.problem).toBe('notInGroup');
  });

  it('refuses a group that already split up', () => {
    const check = canKickFromGroup({ memberIds: ['a', 'b'], disbandedWeek: 10 }, 'a');
    expect(check.ok).toBe(false);
    expect(check.problem).toBe('alreadyDisbanded');
  });

  it('allows kicking a real member of a live group', () => {
    expect(canKickFromGroup({ memberIds: ['a', 'b'], disbandedWeek: null }, 'a').ok).toBe(true);
  });
});

describe('nextLeaderAfterKick', () => {
  it('leaves the leader alone when somebody else is departing', () => {
    const people = roster(3);
    expect(nextLeaderAfterKick({ leaderId: people[0]!.id }, [people[0]!, people[1]!], people[2]!.id)).toBe(
      people[0]!.id,
    );
  });

  it('promotes the most popular remaining member when the leader departs', () => {
    const people = roster(3); // popularity descends by index
    expect(nextLeaderAfterKick({ leaderId: people[0]!.id }, [people[1]!, people[2]!], people[0]!.id)).toBe(
      people[1]!.id,
    );
  });

  it('returns null when nobody is left', () => {
    const people = roster(1);
    expect(nextLeaderAfterKick({ leaderId: people[0]!.id }, [], people[0]!.id)).toBeNull();
  });
});

describe('availableAttackers', () => {
  it('excludes the departing member and anybody who cannot work', () => {
    const people = roster(4);
    const wrestlers = Object.fromEntries(people.map((w) => [w.id, w]));
    const canWork = (w: Wrestler) => w.id !== people[2]!.id;
    const attackers = availableAttackers(
      people.map((w) => w.id),
      people[0]!.id,
      wrestlers,
      canWork,
    );
    expect(attackers.map((w) => w.id)).toEqual([people[1]!.id, people[3]!.id]);
  });

  it('returns nothing when everybody left is unavailable', () => {
    const people = roster(2);
    const wrestlers = Object.fromEntries(people.map((w) => [w.id, w]));
    const attackers = availableAttackers(
      people.map((w) => w.id),
      people[0]!.id,
      wrestlers,
      () => false,
    );
    expect(attackers).toHaveLength(0);
  });
});

describe('managerAvailable', () => {
  const base = roster(1)[0]!;

  it('is available when healthy and not on leave', () => {
    expect(managerAvailable({ ...base, injury: null, leave: undefined, deceased: undefined })).toBe(true);
  });

  it('is unavailable when hurt and not cleared to work through it', () => {
    expect(
      managerAvailable({
        ...base,
        injury: { severity: 'moderate', grade: 50 } as Wrestler['injury'],
        clearedToWorkHurt: false,
      }),
    ).toBe(false);
  });

  it('is unavailable when deceased or retired', () => {
    expect(managerAvailable({ ...base, deceased: { wrestlerId: base.id, cause: 'age', age: 90, week: 1 } })).toBe(
      false,
    );
    expect(managerAvailable({ ...base, deceased: undefined, careerStatus: 'retired' })).toBe(false);
  });
});

describe('rollBeatdownInjuryWeeks', () => {
  it('never rolls outside the given range', () => {
    const rng = rngFromSeed('roll');
    for (let i = 0; i < 50; i++) {
      const weeks = rollBeatdownInjuryWeeks(rng, 1, 4);
      expect(weeks).toBeGreaterThanOrEqual(1);
      expect(weeks).toBeLessThanOrEqual(4);
    }
  });
});

describe('buildGroupTurnCall', () => {
  it('assembles the decision from the resolved parties', () => {
    const [departing, attackerA, attackerB, manager] = roster(4);
    const call = buildGroupTurnCall(12, 'stable-1', 'The Faction', departing!, [attackerA!, attackerB!], manager!, 3);
    expect(call).toEqual({
      week: 12,
      stableId: 'stable-1',
      stableName: 'The Faction',
      departingId: departing!.id,
      departingName: departing!.name,
      attackerIds: [attackerA!.id, attackerB!.id],
      attackerNames: [attackerA!.name, attackerB!.name],
      managerId: manager!.id,
      managerName: manager!.name,
      injuryWeeks: 3,
    });
  });

  it('leaves the manager fields null when there is none', () => {
    const [departing, attacker] = roster(2);
    const call = buildGroupTurnCall(1, 's', 'The Team', departing!, [attacker!], null, 2);
    expect(call.managerId).toBeNull();
    expect(call.managerName).toBeNull();
  });
});
