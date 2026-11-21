// Player-formed teams and factions, and breaking one up — quietly or staged
// as an on-screen turn. See engine/world/teamBreakup.ts for the pure
// mechanics (already covered by its own tests) and tagTeams.ts for
// formation. This file covers the store wiring: formGroup, kickFromGroup,
// and the resolveWeek fire hook + answerGroupTurnCall.

import { describe, expect, it, beforeEach } from 'vitest';
import { useGameStore } from './store';
import { commitTitleChange } from './storeHelpers';
import { defaultWorldSettings } from '../engine/world/settings';
import { groupOf } from '../engine/world/tagTeams';

const TEST_ROSTER_SIZE = 24;

function freshSettings(overrides: Partial<ReturnType<typeof defaultWorldSettings>> = {}) {
  return {
    ...defaultWorldSettings(),
    seed: 'group-turns-store-test',
    startingRosterSize: TEST_ROSTER_SIZE,
    ownerMandatesEnabled: false,
    mergerChancePerWeek: 0,
    successionChancePerWeek: 0,
    networkRealignmentChancePerWeek: 0,
    ownerRivalryChancePerWeek: 0,
    rogueChancePerWeek: 0,
    scandalChancePerWeek: 0,
    breakawayChancePerWeek: 0,
    farewellTourChancePerWeek: 0,
    pricingWarChancePerWeek: 0,
    paperworkLockoutChancePerWeek: 0,
    familyBusinessChancePerWeek: 0,
    breakfastBeltChancePerWeek: 0,
    moneyEventChancePerWeek: 0,
    ...overrides,
  };
}

function newGame(overrides: Partial<ReturnType<typeof defaultWorldSettings>> = {}) {
  useGameStore.getState().newGame(freshSettings(overrides));
}

function runWeek() {
  useGameStore.getState().resolveWeek();
  if (useGameStore.getState().world?.pendingWeatherCall) {
    useGameStore.getState().answerWeatherCall('runIt');
  }
}

// The AI seeds a handful of tag teams for every promotion, including the
// player's own, at world creation (see engine/world/tagTeams.ts's own
// formTeams). Unattached-only, so a test's own formGroup calls aren't
// silently rejected by picking somebody the world already teamed up.
function wrestlerRoster(): string[] {
  const world = useGameStore.getState().world!;
  return world.promotion.rosterIds.filter(
    (id) => world.wrestlers[id]?.role === 'wrestler' && !groupOf(world.stables, id),
  );
}

describe('forming a team or faction', () => {
  beforeEach(() => newGame());

  it('forms a duo, named for you', () => {
    const [a, b] = wrestlerRoster();
    const result = useGameStore.getState().formGroup([a!, b!]);
    expect(result.ok).toBe(true);

    const world = useGameStore.getState().world!;
    const group = world.stables.find((s) => s.memberIds.includes(a!) && s.disbandedWeek === null);
    expect(group).toBeDefined();
    expect(group!.kind).toBe('tagTeam');
    expect(group!.memberIds).toEqual(expect.arrayContaining([a, b]));
    expect(group!.name.length).toBeGreaterThan(0);
  });

  it('forms a trio as a tagTeam-kind act', () => {
    const [a, b, c] = wrestlerRoster();
    useGameStore.getState().formGroup([a!, b!, c!], 'The Trio');
    const world = useGameStore.getState().world!;
    const group = world.stables.find((s) => s.memberIds.includes(a!) && s.disbandedWeek === null);
    expect(group!.kind).toBe('tagTeam');
    expect(group!.name).toBe('The Trio');
  });

  it('forms a faction of four or more as stable-kind, and refuses one with no name', () => {
    const [a, b, c, d] = wrestlerRoster();
    const noName = useGameStore.getState().formGroup([a!, b!, c!, d!]);
    expect(noName.ok).toBe(false);

    const named = useGameStore.getState().formGroup([a!, b!, c!, d!], 'The Faction');
    expect(named.ok).toBe(true);
    const world = useGameStore.getState().world!;
    const group = world.stables.find((s) => s.memberIds.includes(a!) && s.disbandedWeek === null);
    expect(group!.kind).toBe('stable');
    expect(group!.memberIds).toHaveLength(4);
  });

  it('refuses somebody already spoken for', () => {
    const [a, b, c] = wrestlerRoster();
    useGameStore.getState().formGroup([a!, b!]);
    const result = useGameStore.getState().formGroup([a!, c!]);
    expect(result.ok).toBe(false);
  });
});

describe('kicking a member out immediately', () => {
  beforeEach(() => newGame());

  it('drops a team of two straight to disbanded', () => {
    const [a, b] = wrestlerRoster();
    useGameStore.getState().formGroup([a!, b!]);
    const groupId = useGameStore.getState().world!.stables.find((s) => s.memberIds.includes(a!))!.id;

    useGameStore.getState().kickFromGroup(groupId, a!, 'immediate');

    const world = useGameStore.getState().world!;
    expect(world.stables.find((s) => s.id === groupId)!.disbandedWeek).not.toBeNull();
  });

  it('shrinks a faction down to a team instead of dissolving it, when enough people are left', () => {
    const [a, b, c, d] = wrestlerRoster();
    useGameStore.getState().formGroup([a!, b!, c!, d!], 'The Faction');
    const groupId = useGameStore.getState().world!.stables.find((s) => s.memberIds.includes(a!))!.id;

    useGameStore.getState().kickFromGroup(groupId, a!, 'immediate');

    const world = useGameStore.getState().world!;
    const group = world.stables.find((s) => s.id === groupId)!;
    expect(group.disbandedWeek).toBeNull();
    expect(group.kind).toBe('tagTeam');
    expect(group.memberIds).toEqual(expect.arrayContaining([b, c, d]));
    expect(group.memberIds).not.toContain(a);
  });

  it('reassigns the leader when the leader is the one kicked', () => {
    const [a, b, c] = wrestlerRoster();
    useGameStore.getState().formGroup([a!, b!, c!], 'The Trio');
    const groupId = useGameStore.getState().world!.stables.find((s) => s.memberIds.includes(a!))!.id;
    useGameStore.setState((s) => {
      s.world!.stables.find((st) => st.id === groupId)!.leaderId = a!;
    });

    useGameStore.getState().kickFromGroup(groupId, a!, 'immediate');

    const world = useGameStore.getState().world!;
    const group = world.stables.find((st) => st.id === groupId)!;
    expect(group.leaderId).not.toBe(a);
    expect([b, c]).toContain(group.leaderId);
  });

  it('vacates a trios title when the group holding it disbands — the bug the vacate helper fixed', () => {
    const [a, b, c] = wrestlerRoster();
    useGameStore.getState().formGroup([a!, b!, c!], 'The Trio');
    const groupId = useGameStore.getState().world!.stables.find((s) => s.memberIds.includes(a!))!.id;

    let titleId = '';
    useGameStore.setState((s) => {
      const world = s.world!;
      const template = world.titles.find((t) => t.promotionId === world.promotion.id)!;
      const trioTitle = {
        ...template,
        id: 'trios-belt-test',
        name: 'Test Trios Championship',
        tier: 'trios' as const,
        vacant: true,
        currentHolderIds: [],
        history: [],
      };
      world.titles.push(trioTitle);
      world.promotion.titleIds.push(trioTitle.id);
      titleId = trioTitle.id;
      commitTitleChange(world, world.titles.length - 1, [a!, b!, c!]);
    });

    const beforeTitle = useGameStore.getState().world!.titles.find((t) => t.id === titleId)!;
    expect(beforeTitle.vacant).toBe(false);
    expect(beforeTitle.currentHolderIds).toEqual(expect.arrayContaining([a, b, c]));

    useGameStore.getState().disbandTagTeam(groupId);

    const afterTitle = useGameStore.getState().world!.titles.find((t) => t.id === titleId)!;
    expect(afterTitle.vacant).toBe(true);
    expect(afterTitle.currentHolderIds).toHaveLength(0);
  });
});

describe('staging a turn', () => {
  beforeEach(() => newGame());

  it('leaves the group intact and schedules the turn, without touching membership yet', () => {
    const [a, b, c] = wrestlerRoster();
    useGameStore.getState().formGroup([a!, b!, c!], 'The Trio');
    const groupId = useGameStore.getState().world!.stables.find((s) => s.memberIds.includes(a!))!.id;

    useGameStore.getState().kickFromGroup(groupId, a!, 'staged');

    const world = useGameStore.getState().world!;
    const group = world.stables.find((s) => s.id === groupId)!;
    expect(group.disbandedWeek).toBeNull();
    expect(group.memberIds).toHaveLength(3);
    expect(world.scheduledGroupTurns.some((t) => t.stableId === groupId && t.departingId === a)).toBe(true);
  });

  it('fires a pending call once the departing member is actually booked into a match, naming the real attackers', () => {
    const [a, b, c] = wrestlerRoster();
    useGameStore.getState().formGroup([a!, b!, c!], 'The Trio');
    const groupId = useGameStore.getState().world!.stables.find((s) => s.memberIds.includes(a!))!.id;
    useGameStore.getState().kickFromGroup(groupId, a!, 'staged');

    const opponent = wrestlerRoster().find((id) => ![a, b, c].includes(id))!;
    useGameStore.getState().setSegmentParticipant(0, a!, 0);
    useGameStore.getState().setSegmentParticipant(0, opponent, 1);
    runWeek();

    const world = useGameStore.getState().world!;
    const call = world.pendingGroupTurnCall;
    expect(call).not.toBeNull();
    expect(call!.stableId).toBe(groupId);
    expect(call!.departingId).toBe(a);
    expect([...call!.attackerIds].sort()).toEqual([b, c].sort());
    expect(call!.managerId).toBeNull();
    // The group itself has not split yet — that happens on the answer.
    expect(world.stables.find((s) => s.id === groupId)!.memberIds).toHaveLength(3);
  });

  it('stays scheduled rather than firing when nobody is left available to do the turning', () => {
    const [a, b, c] = wrestlerRoster();
    useGameStore.getState().formGroup([a!, b!, c!], 'The Trio');
    const groupId = useGameStore.getState().world!.stables.find((s) => s.memberIds.includes(a!))!.id;
    useGameStore.getState().kickFromGroup(groupId, a!, 'staged');

    useGameStore.setState((s) => {
      s.world!.wrestlers[b!]!.paperworkFrozen = true;
      s.world!.wrestlers[c!]!.paperworkFrozen = true;
    });

    const opponent = wrestlerRoster().find((id) => ![a, b, c].includes(id))!;
    useGameStore.getState().setSegmentParticipant(0, a!, 0);
    useGameStore.getState().setSegmentParticipant(0, opponent, 1);
    runWeek();

    const world = useGameStore.getState().world!;
    expect(world.pendingGroupTurnCall).toBeNull();
    expect(world.scheduledGroupTurns.some((t) => t.stableId === groupId && t.departingId === a)).toBe(true);
  });

  it('only pulls in a manager who actually, currently represents the departing member', () => {
    const [a, b, c] = wrestlerRoster();
    useGameStore.getState().formGroup([a!, b!, c!], 'The Trio');
    const groupId = useGameStore.getState().world!.stables.find((s) => s.memberIds.includes(a!))!.id;
    useGameStore.getState().kickFromGroup(groupId, a!, 'staged');

    const world0 = useGameStore.getState().world!;
    const managerId = world0.promotion.rosterIds.find((id) => world0.wrestlers[id]?.role === 'manager');
    // Not every generated roster has a manager on it — skip cleanly if not.
    if (!managerId) return;

    useGameStore.setState((s) => {
      s.world!.representations.push({ managerId, clientId: a!, cut: 0.2, signedWeek: 1 });
    });

    const opponent = wrestlerRoster().find((id) => ![a, b, c].includes(id))!;
    useGameStore.getState().setSegmentParticipant(0, a!, 0);
    useGameStore.getState().setSegmentParticipant(0, opponent, 1);
    runWeek();

    const call = useGameStore.getState().world!.pendingGroupTurnCall;
    expect(call!.managerId).toBe(managerId);
  });
});

describe('answering a group turn call', () => {
  beforeEach(() => newGame());

  function stageAndFire() {
    const [a, b, c] = wrestlerRoster();
    useGameStore.getState().formGroup([a!, b!, c!], 'The Trio');
    const groupId = useGameStore.getState().world!.stables.find((s) => s.memberIds.includes(a!))!.id;
    useGameStore.getState().kickFromGroup(groupId, a!, 'staged');

    const opponent = wrestlerRoster().find((id) => ![a, b, c].includes(id))!;
    useGameStore.getState().setSegmentParticipant(0, a!, 0);
    useGameStore.getState().setSegmentParticipant(0, opponent, 1);
    runWeek();

    return { groupId, departingId: a!, remaining: [b!, c!] };
  }

  it('letItHappen: hurts the departing member for real and opens a shoot rivalry', () => {
    const { groupId, departingId, remaining } = stageAndFire();
    const before = useGameStore.getState().world!.wrestlers[departingId]!;
    expect(before.injury).toBeNull();

    useGameStore.getState().answerGroupTurnCall('letItHappen');

    const world = useGameStore.getState().world!;
    expect(world.wrestlers[departingId]!.injury).toBeDefined();
    expect(world.stables.find((s) => s.id === groupId)!.memberIds).toEqual(expect.arrayContaining(remaining));
    expect(world.stables.find((s) => s.id === groupId)!.memberIds).not.toContain(departingId);
    const rivalry = world.rivalries.find((r) => r.participantIds.includes(departingId));
    expect(rivalry).toBeDefined();
    expect(rivalry!.origin).toBe('shoot');
    expect(rivalry!.shootHeat).toBeGreaterThan(0);
    expect(world.pendingGroupTurnCall).toBeNull();
    expect(world.scheduledGroupTurns.some((t) => t.departingId === departingId)).toBe(false);

    // Real enough to show up in Office's Feuds index, not only as a heat
    // badge — see engine/world/storyline.ts's isLive/everyoneWithAStoryline.
    const story = world.storylines.find((s) => s.participantIds.includes(departingId));
    expect(story).toBeDefined();
    expect(story!.rivalryId).toBe(rivalry!.id);
    expect(story!.stage).not.toBe('blownOff');
    expect(story!.stage).not.toBe('fizzled');
    expect(story!.beats).toHaveLength(1);
    expect(story!.beats[0]!.kind).toBe('interference');
  });

  it('breakItUp: nobody gets hurt, and the rivalry starts worked instead of shoot', () => {
    const { departingId } = stageAndFire();

    useGameStore.getState().answerGroupTurnCall('breakItUp');

    const world = useGameStore.getState().world!;
    expect(world.wrestlers[departingId]!.injury).toBeNull();
    const rivalry = world.rivalries.find((r) => r.participantIds.includes(departingId));
    expect(rivalry).toBeDefined();
    expect(rivalry!.origin).toBe('worked');
    expect(rivalry!.heat).toBeGreaterThan(0);
    expect(world.pendingGroupTurnCall).toBeNull();

    const story = world.storylines.find((s) => s.participantIds.includes(departingId));
    expect(story).toBeDefined();
    expect(story!.rivalryId).toBe(rivalry!.id);
    expect(story!.beats).toHaveLength(1);
    expect(story!.beats[0]!.kind).toBe('confrontation');
  });

  it('ends a real signed representation deal when the manager is part of the turn', () => {
    const [a, b, c] = wrestlerRoster();
    useGameStore.getState().formGroup([a!, b!, c!], 'The Trio');
    const groupId = useGameStore.getState().world!.stables.find((s) => s.memberIds.includes(a!))!.id;
    useGameStore.getState().kickFromGroup(groupId, a!, 'staged');

    const world0 = useGameStore.getState().world!;
    const managerId = world0.promotion.rosterIds.find((id) => world0.wrestlers[id]?.role === 'manager');
    if (!managerId) return;

    useGameStore.setState((s) => {
      s.world!.representations.push({ managerId, clientId: a!, cut: 0.2, signedWeek: 1 });
    });

    const opponent = wrestlerRoster().find((id) => ![a, b, c].includes(id))!;
    useGameStore.getState().setSegmentParticipant(0, a!, 0);
    useGameStore.getState().setSegmentParticipant(0, opponent, 1);
    runWeek();

    expect(useGameStore.getState().world!.pendingGroupTurnCall!.managerId).toBe(managerId);
    useGameStore.getState().answerGroupTurnCall('letItHappen');

    const world = useGameStore.getState().world!;
    expect(world.representations.some((r) => r.clientId === a && r.managerId === managerId)).toBe(false);
  });
});

describe('spontaneous implosions and betrayals', () => {
  // A group's weekly defection roll (faction.ts's defectionRisk, fired from
  // store.ts's own weekly tick — see the "what the group does to the people
  // in it" section) can now escalate into a real on-screen turn instead of
  // always being a quiet walkout. These force the underlying risk to its cap
  // (deterministic — no rng-seed guessing) and drive groupImplosionChance
  // directly to isolate the new branch from the roll it sits behind.
  function forcedDefectionSettings(overrides: Partial<ReturnType<typeof defaultWorldSettings>> = {}) {
    return {
      factionDefectionWeight: 10,
      factionDefectionCap: 1,
      factionChurnWeeks: 1,
      // Never let the group overshadow the company — that would zero the
      // risk out entirely ('running the place'/'out of control' standings).
      factionOvershadowMargin: 1000,
      ...overrides,
    };
  }

  function makeMiserable(id: string) {
    useGameStore.setState((s) => {
      const w = s.world!.wrestlers[id]!;
      w.morale = 0;
      w.ego = 100;
    });
  }

  it('escalates into a scheduled turn instead of a quiet walkout when it fires', () => {
    newGame(forcedDefectionSettings({ groupImplosionChance: 1 }));
    const [a, b, c] = wrestlerRoster();
    useGameStore.getState().formGroup([a!, b!, c!], 'The Trio');
    const groupId = useGameStore.getState().world!.stables.find((s) => s.memberIds.includes(a!))!.id;
    makeMiserable(a!);

    runWeek();

    const world = useGameStore.getState().world!;
    expect(world.scheduledGroupTurns.some((t) => t.stableId === groupId && t.departingId === a)).toBe(true);
    expect(world.stables.find((s) => s.id === groupId)!.memberIds).toContain(a);
  });

  it('falls back to the pre-existing quiet walkout when the escalation roll fails', () => {
    newGame(forcedDefectionSettings({ groupImplosionChance: 0 }));
    const [a, b, c] = wrestlerRoster();
    useGameStore.getState().formGroup([a!, b!, c!], 'The Trio');
    const groupId = useGameStore.getState().world!.stables.find((s) => s.memberIds.includes(a!))!.id;
    makeMiserable(a!);

    runWeek();

    const world = useGameStore.getState().world!;
    expect(world.scheduledGroupTurns.some((t) => t.stableId === groupId && t.departingId === a)).toBe(false);
    expect(world.stables.find((s) => s.id === groupId)!.memberIds).not.toContain(a);
    expect(world.weeklyNews.some((n) => n.text.includes('walked clean out'))).toBe(true);
  });

  it('lets a duo escalate into a real betrayal, which a quiet walkout could never do', () => {
    newGame(forcedDefectionSettings({ groupImplosionChance: 1 }));
    const [a, b] = wrestlerRoster();
    useGameStore.getState().formGroup([a!, b!]);
    const groupId = useGameStore.getState().world!.stables.find((s) => s.memberIds.includes(a!))!.id;
    makeMiserable(a!);

    runWeek();

    const world = useGameStore.getState().world!;
    expect(world.scheduledGroupTurns.some((t) => t.stableId === groupId && t.departingId === a)).toBe(true);
    expect(world.stables.find((s) => s.id === groupId)!.memberIds).toEqual([a, b]);
  });

  it('never lets a duo quietly dissolve on its own, even at full defection risk', () => {
    newGame(forcedDefectionSettings({ groupImplosionChance: 0 }));
    const [a, b] = wrestlerRoster();
    useGameStore.getState().formGroup([a!, b!]);
    const groupId = useGameStore.getState().world!.stables.find((s) => s.memberIds.includes(a!))!.id;
    makeMiserable(a!);

    runWeek();
    runWeek();
    runWeek();

    const world = useGameStore.getState().world!;
    expect(world.scheduledGroupTurns.some((t) => t.stableId === groupId)).toBe(false);
    const group = world.stables.find((s) => s.id === groupId)!;
    expect(group.disbandedWeek).toBeNull();
    expect(group.memberIds).toEqual([a, b]);
  });

  it('does not queue a second scheduled turn for a member who already has one pending', () => {
    newGame(forcedDefectionSettings({ groupImplosionChance: 1 }));
    const [a, b, c] = wrestlerRoster();
    useGameStore.getState().formGroup([a!, b!, c!], 'The Trio');
    const groupId = useGameStore.getState().world!.stables.find((s) => s.memberIds.includes(a!))!.id;
    makeMiserable(a!);

    runWeek();
    runWeek();

    const world = useGameStore.getState().world!;
    expect(world.scheduledGroupTurns.filter((t) => t.stableId === groupId && t.departingId === a)).toHaveLength(1);
  });

  it('fires an organically scheduled turn through the exact same pending-call pipeline as a staged one', () => {
    newGame(forcedDefectionSettings({ groupImplosionChance: 1 }));
    const [a, b, c] = wrestlerRoster();
    useGameStore.getState().formGroup([a!, b!, c!], 'The Trio');
    const groupId = useGameStore.getState().world!.stables.find((s) => s.memberIds.includes(a!))!.id;
    makeMiserable(a!);

    runWeek(); // schedules the turn, nobody booked yet — should stay pending

    const opponent = wrestlerRoster().find((id) => ![a, b, c].includes(id))!;
    useGameStore.getState().setSegmentParticipant(0, a!, 0);
    useGameStore.getState().setSegmentParticipant(0, opponent, 1);
    runWeek(); // the departing member is booked — the fire hook should pick it up

    const call = useGameStore.getState().world!.pendingGroupTurnCall;
    expect(call).not.toBeNull();
    expect(call!.stableId).toBe(groupId);
    expect(call!.departingId).toBe(a);
    expect([...call!.attackerIds].sort()).toEqual([b, c].sort());
  });
});
