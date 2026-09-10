// Store-level integration for the Faction Destroyer story — see
// engine/world/factionDestroyer.ts and engine/sim/factionDestroyer.ts for the
// pure mechanics (each already covered by their own tests). This file covers
// the weekly-tick wiring in store.ts: the trigger, the countdown, the forced
// main-event insertion, the membership-lock guards, and post-match
// consequences — plus the one-time-per-save latch.

import { describe, expect, it, beforeEach } from 'vitest';
import { useGameStore } from './store';
import { defaultWorldSettings } from '../engine/world/settings';
import { groupOf } from '../engine/world/tagTeams';

const TEST_ROSTER_SIZE = 40;

function freshSettings(overrides: Partial<ReturnType<typeof defaultWorldSettings>> = {}) {
  return {
    ...defaultWorldSettings(),
    seed: 'faction-destroyer-store-test',
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
    groupImplosionChance: 0,
    // A catastrophe-tier weather roll cancels the whole show regardless of
    // venue (seasons.ts's rollWeather) — zeroed so a qualifying week's match
    // reliably resolves instead of vanishing into a cancelled card.
    weatherChancePerShow: 0,
    factionDestroyerCountdownWeeks: 3,
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

function wrestlerRoster(): string[] {
  const world = useGameStore.getState().world!;
  return world.promotion.rosterIds.filter(
    (id) => world.wrestlers[id]?.role === 'wrestler' && !groupOf(world.stables, id),
  );
}

// A group requires every member to share a gender (canFormGroup's
// 'differentDivisions' check) — pull straight from the biggest single-gender
// pool available so 8 unattached same-division wrestlers are guaranteed.
function samGenderPool(): string[] {
  const world = useGameStore.getState().world!;
  const pool = wrestlerRoster();
  const byGender = new Map<string, string[]>();
  for (const id of pool) {
    const gender = world.wrestlers[id]!.gender;
    byGender.set(gender, [...(byGender.get(gender) ?? []), id]);
  }
  return [...byGender.values()].sort((a, b) => b.length - a.length)[0] ?? [];
}

/** Forms two fresh 4-member factions from the player's own unattached roster. */
function formTwoFactions() {
  const pool = samGenderPool();
  const aMembers = pool.slice(0, 4);
  const bMembers = pool.slice(4, 8);
  const aResult = useGameStore.getState().formGroup(aMembers, 'Faction Alpha');
  const bResult = useGameStore.getState().formGroup(bMembers, 'Faction Bravo');
  expect(aResult.ok).toBe(true);
  expect(bResult.ok).toBe(true);

  const world = useGameStore.getState().world!;
  const a = world.stables.find((s) => s.memberIds.includes(aMembers[0]!))!;
  const b = world.stables.find((s) => s.memberIds.includes(bMembers[0]!))!;
  return { aId: a.id, bId: b.id, aName: a.name, bName: b.name, aMembers, bMembers };
}

/** Books a match for `memberId` against some outsider, in the given slot (main event by default). */
function bookMemberMatch(memberId: string, slot = 0) {
  const opponent = wrestlerRoster().find((id) => id !== memberId)!;
  useGameStore.getState().setSegmentParticipant(slot, memberId, 0);
  useGameStore.getState().setSegmentParticipant(slot, opponent, 1);
}

/**
 * Runs weeks until the Faction Destroyer match has just been force-inserted
 * into the current card's main-event slot, but not yet resolved.
 */
function driveToForcedCard(countdownWeeks: number) {
  newGame({ factionDestroyerCountdownWeeks: countdownWeeks });
  const factions = formTwoFactions();

  runWeek(); // the trigger check fires this week
  const triggered = useGameStore.getState().world!.factionDestroyer;
  expect(triggered).not.toBeNull();
  expect(triggered!.stableAId).toBe(factions.aId);
  expect(triggered!.stableBId).toBe(factions.bId);

  for (let i = 0; i < countdownWeeks; i++) {
    bookMemberMatch(factions.aMembers[0]!);
    runWeek();
  }
  expect(useGameStore.getState().world!.factionDestroyer!.matchScheduledForWeek).not.toBeNull();

  runWeek(); // advance to the week whose card creation hook inserts the match

  return factions;
}

describe('trigger and countdown', () => {
  beforeEach(() => newGame());

  it('locks onto the first two factions that ever coexist, and announces it', () => {
    const { aName, bName } = formTwoFactions();
    runWeek();

    const world = useGameStore.getState().world!;
    expect(world.factionDestroyer).not.toBeNull();
    expect(world.factionDestroyer!.weeksRemaining).toBe(world.settings.factionDestroyerCountdownWeeks);
    expect(world.factionDestroyer!.matchScheduledForWeek).toBeNull();
    expect(world.factionDestroyerHappened).toBe(true);
    expect(world.weeklyNews.some((n) => n.text.includes(aName) && n.text.includes(bName))).toBe(true);
  });

  it('a quiet week — no match for either faction — does not move the countdown', () => {
    newGame({ factionDestroyerCountdownWeeks: 3 });
    formTwoFactions();
    runWeek(); // trigger

    const before = useGameStore.getState().world!.factionDestroyer!.weeksRemaining;
    // Book only outsiders — nobody from either faction works this week.
    bookMemberMatch(wrestlerRoster()[0]!);
    runWeek();

    const after = useGameStore.getState().world!.factionDestroyer!.weeksRemaining;
    expect(after).toBe(before);
  });

  it('a week featuring a member of either faction ticks the countdown down by one', () => {
    newGame({ factionDestroyerCountdownWeeks: 3 });
    const factions = formTwoFactions();
    runWeek(); // trigger

    const before = useGameStore.getState().world!.factionDestroyer!.weeksRemaining;
    bookMemberMatch(factions.bMembers[0]!);
    runWeek();

    const after = useGameStore.getState().world!.factionDestroyer!.weeksRemaining;
    expect(after).toBe(before - 1);
  });

  it('force-inserts the match into the main-event slot once the countdown hits zero', () => {
    const factions = driveToForcedCard(1);

    const world = useGameStore.getState().world!;
    const mainEvent = world.currentCard[world.currentCard.length - 1]!;
    expect(mainEvent.systemForced).toBe('factionDestroyer');
    expect(mainEvent.stipulation).toBe('factionDestroyer');
    expect(mainEvent.participants.filter((p) => p.side === 0).map((p) => p.wrestlerId)).toEqual(
      expect.arrayContaining(factions.aMembers),
    );
    expect(mainEvent.participants.filter((p) => p.side === 1).map((p) => p.wrestlerId)).toEqual(
      expect.arrayContaining(factions.bMembers),
    );
  });

  it("freezes a locked faction member's contract clock so it cannot expire mid-countdown", () => {
    newGame({ factionDestroyerCountdownWeeks: 3 });
    const factions = formTwoFactions();
    runWeek(); // trigger — locks both factions

    const memberId = factions.aMembers[0]!;
    useGameStore.setState((s) => {
      s.world!.wrestlers[memberId]!.contract!.weeksRemaining = 1;
    });

    bookMemberMatch(factions.bMembers[0]!); // a quiet week for aMembers[0] specifically
    runWeek();
    runWeek();
    runWeek();

    const world = useGameStore.getState().world!;
    // Still on the roster, still under contract, still a member — the clock
    // simply never reached zero while the story had them locked.
    expect(world.wrestlers[memberId]!.promotionId).toBe(world.promotion.id);
    expect(world.wrestlers[memberId]!.contract).not.toBeNull();
    expect(world.wrestlers[memberId]!.contract!.weeksRemaining).toBe(1);
  });
});

describe('membership lock during the countdown', () => {
  it('refuses to remove a member from either locked faction', () => {
    newGame({ factionDestroyerCountdownWeeks: 3 });
    const factions = formTwoFactions();
    runWeek(); // trigger — locks both factions

    useGameStore.getState().kickFromGroup(factions.aId, factions.aMembers[0]!, 'immediate');

    const world = useGameStore.getState().world!;
    expect(world.stables.find((s) => s.id === factions.aId)!.memberIds).toContain(factions.aMembers[0]);
  });

  it('refuses to disband a locked faction outright', () => {
    newGame({ factionDestroyerCountdownWeeks: 3 });
    const factions = formTwoFactions();
    runWeek(); // trigger

    useGameStore.getState().disbandTagTeam(factions.bId);

    const world = useGameStore.getState().world!;
    expect(world.stables.find((s) => s.id === factions.bId)!.disbandedWeek).toBeNull();
  });

  it('leaves an unrelated group free to kick a member as normal', () => {
    newGame({ factionDestroyerCountdownWeeks: 3 });
    formTwoFactions();
    runWeek(); // trigger

    const outsiders = samGenderPool();
    const duo = useGameStore.getState().formGroup([outsiders[0]!, outsiders[1]!]);
    expect(duo.ok).toBe(true);
    const duoId = useGameStore.getState().world!.stables.find((s) => s.memberIds.includes(outsiders[0]!))!.id;

    useGameStore.getState().kickFromGroup(duoId, outsiders[0]!, 'immediate');

    const world = useGameStore.getState().world!;
    expect(world.stables.find((s) => s.id === duoId)!.disbandedWeek).not.toBeNull();
  });
});

describe('resolving the forced match', () => {
  it('releases the first two eliminated with the 90-day freeze, disbands the loser, and lifts the lock', () => {
    const factions = driveToForcedCard(1);

    runWeek(); // resolves the forced main event

    const world = useGameStore.getState().world!;
    expect(world.factionDestroyer).toBeNull();
    expect(world.factionDestroyerHappened).toBe(true);

    // Read who actually got released off the real elimination order rather
    // than scanning the original 8 for a null promotionId — a member added
    // mid-countdown could be among the first two eliminated (and so among
    // the released) without ever being in the original roster snapshot, and
    // the match's own violence (injuryMult 1.8, no-DQ) can separately injure
    // or retire somebody who was never eliminated at all. noCompeteWeeks is
    // the one signal only letThemGo ever sets.
    const show = world.showHistory[world.showHistory.length - 1]!;
    const fdSeg = show.segments.find((s) => s.stipulation === 'factionDestroyer')!;
    const order = fdSeg.result!.factionEliminationOrder!;
    expect(order.length).toBeGreaterThanOrEqual(2);
    const releasedIds = order.slice(0, 2);

    for (const id of releasedIds) {
      expect(world.wrestlers[id]!.promotionId).toBeNull();
      expect(world.wrestlers[id]!.noCompeteWeeks).toBeGreaterThan(0);
    }
    // Nobody eliminated third or later picked up the freeze — only the
    // first two.
    for (const id of order.slice(2)) {
      expect(world.wrestlers[id]!.noCompeteWeeks ?? 0).toBe(0);
    }

    const stableA = world.stables.find((s) => s.id === factions.aId)!;
    const stableB = world.stables.find((s) => s.id === factions.bId)!;
    const oneDisbanded = [stableA, stableB].filter((s) => s.disbandedWeek !== null);
    expect(oneDisbanded).toHaveLength(1);
    expect(
      world.weeklyNews.some((n) => n.text.includes(`${oneDisbanded[0]!.name} is finished`)),
    ).toBe(true);

    // The lock is gone — the survivor (whatever shape it ended up in) can be
    // kicked or disbanded through the ordinary channels again.
    const survivor = [stableA, stableB].find((s) => s.disbandedWeek === null);
    if (survivor && survivor.memberIds.length > 0) {
      useGameStore.getState().kickFromGroup(survivor.id, survivor.memberIds[0]!, 'immediate');
      const after = useGameStore.getState().world!.stables.find((s) => s.id === survivor.id)!;
      expect(after.memberIds).not.toContain(survivor.memberIds[0]);
    }
  });

  it('never fires a second time, even once a fresh pair of factions coexists', () => {
    driveToForcedCard(1);
    runWeek(); // resolve — factionDestroyer clears, factionDestroyerHappened stays true

    expect(useGameStore.getState().world!.factionDestroyer).toBeNull();
    expect(useGameStore.getState().world!.factionDestroyerHappened).toBe(true);

    const pool = samGenderPool();
    expect(pool.length).toBeGreaterThanOrEqual(8);
    const cResult = useGameStore.getState().formGroup(pool.slice(0, 4), 'Faction Charlie');
    const dResult = useGameStore.getState().formGroup(pool.slice(4, 8), 'Faction Delta');
    expect(cResult.ok).toBe(true);
    expect(dResult.ok).toBe(true);

    runWeek();
    runWeek();
    runWeek();

    expect(useGameStore.getState().world!.factionDestroyer).toBeNull();
  });
});
