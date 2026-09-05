// "Family Business," wired into the real weekly loop — see
// engine/world/familyBusiness.ts for the pure logic, already covered by its
// own tests. Player-only, so no rival roster needs setting up.

import { describe, expect, it, beforeEach } from 'vitest';
import { useGameStore } from './store';
import { defaultWorldSettings } from '../engine/world/settings';
import type { Wrestler } from '../engine/types';

const TEST_ROSTER_SIZE = 20;

function freshSettings(overrides: Partial<ReturnType<typeof defaultWorldSettings>> = {}) {
  return {
    ...defaultWorldSettings(),
    seed: 'family-business-store-test',
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

function signee(): Wrestler {
  const world = useGameStore.getState().world!;
  const found = world.promotion.rosterIds.map((id) => world.wrestlers[id]).find((w) => w?.familyBusiness);
  expect(found).toBeDefined();
  return found!;
}

describe('family business', () => {
  beforeEach(() => newGame());

  it('does nothing before its own week gate, however certain the roll', () => {
    useGameStore.setState((s) => {
      s.world!.settings.familyBusinessChancePerWeek = 1;
      s.world!.week = s.world!.settings.familyBusinessEarliestWeek - 2;
    });
    runWeek();
    const world = useGameStore.getState().world!;
    expect(world.promotion.rosterIds.some((id) => world.wrestlers[id]?.familyBusiness)).toBe(false);
  });

  it('signs a bust wrestler straight onto the roster at a real multiple of the top earner, no free-agent detour', () => {
    const before = useGameStore.getState().world!;
    const topEarnerBefore = before.promotion.rosterIds.reduce(
      (best, id) => Math.max(best, before.wrestlers[id]?.contract?.weeklyRate ?? 0),
      0,
    );

    useGameStore.setState((s) => {
      s.world!.settings.familyBusinessChancePerWeek = 1;
      s.world!.week = s.world!.settings.familyBusinessEarliestWeek;
    });
    runWeek();

    const w = signee();
    expect(w.contract).not.toBeNull();
    expect(w.contract!.weeklyRate).toBeGreaterThan(topEarnerBefore);
    expect(w.promotionId).toBe(useGameStore.getState().world!.promotion.id);

    const world = useGameStore.getState().world!;
    expect(world.freeAgents.some((a) => a.wrestlerId === w.id)).toBe(false);
    expect(world.weeklyNews.some((n) => n.kind === 'signing' && n.week === world.week && n.text.includes(w.name))).toBe(
      true,
    );
  });

  it('does not sign a second one while the first is still anywhere in their story', () => {
    useGameStore.setState((s) => {
      s.world!.settings.familyBusinessChancePerWeek = 1;
      s.world!.week = s.world!.settings.familyBusinessEarliestWeek;
    });
    runWeek();
    const firstId = signee().id;

    runWeek();
    const world = useGameStore.getState().world!;
    const everyone = world.promotion.rosterIds.map((id) => world.wrestlers[id]).filter((w) => w?.familyBusiness);
    expect(everyone).toHaveLength(1);
    expect(everyone[0]!.id).toBe(firstId);
  });

  it('extends the deadline exactly once when ninety days pass with no title, then releases them as a bust after the full year', () => {
    useGameStore.setState((s) => {
      s.world!.settings.familyBusinessChancePerWeek = 1;
      s.world!.week = s.world!.settings.familyBusinessEarliestWeek;
    });
    runWeek();
    const w = signee();
    const deadline = w.familyBusiness!.deadlineWeek;
    const signedWeek = w.familyBusiness!.signedWeek;

    useGameStore.setState((s) => {
      s.world!.settings.familyBusinessChancePerWeek = 0;
      s.world!.week = deadline - 1;
    });
    runWeek();

    const extended = signee();
    expect(extended.familyBusiness!.extended).toBe(true);
    const finalDeadline = signedWeek + useGameStore.getState().world!.settings.familyBusinessTotalWeeks;
    expect(extended.familyBusiness!.deadlineWeek).toBe(finalDeadline);
    let worldAfterExtension = useGameStore.getState().world!;
    expect(
      worldAfterExtension.weeklyNews.some(
        (n) => n.kind === 'talent' && n.week === worldAfterExtension.week && n.text.includes(w.name),
      ),
    ).toBe(true);

    useGameStore.setState((s) => {
      s.world!.week = finalDeadline - 1;
    });
    runWeek();

    const world = useGameStore.getState().world!;
    expect(world.promotion.rosterIds.includes(w.id)).toBe(false);
    expect(world.wrestlers[w.id]?.promotionId).toBeNull();
    expect(world.freeAgents.some((a) => a.wrestlerId === w.id)).toBe(true);
    expect(
      world.weeklyNews.some((n) => n.kind === 'departure' && n.week === world.week && n.text.includes(w.name)),
    ).toBe(true);
    // A bust exit — no stat bump, ever, since titleWonWeek never got set.
    expect(world.wrestlers[w.id]?.strength).toBeLessThanOrEqual(world.settings.familyBusinessStatCeiling);
  });

  it('winning any singles title applies the stat bump and keeps them on the roster — then losing it later releases them gracefully, the bump intact', () => {
    useGameStore.setState((s) => {
      s.world!.settings.familyBusinessChancePerWeek = 1;
      s.world!.week = s.world!.settings.familyBusinessEarliestWeek;
    });
    runWeek();
    const nephewId = signee().id;

    useGameStore.setState((s) => {
      s.world!.settings.familyBusinessChancePerWeek = 0;
    });

    const world = useGameStore.getState().world!;
    // division: 'open' specifically — eligibleTitles() excludes a
    // 'mens'/'womens' title from a match whose participants don't all match
    // that gender, and this test's nephew/opponent/challenger genders are
    // whatever the seed happens to generate. An open-division title sidesteps
    // that entirely rather than gambling on generated gender matching.
    const title = world.titles.find(
      (t) => t.promotionId === world.promotion.id && t.tier !== 'tag' && t.tier !== 'trios' && t.division === 'open',
    )!;
    expect(title).toBeDefined();
    const opponentId =
      title.currentHolderIds[0] ??
      world.promotion.rosterIds.find((id) => id !== nephewId && world.wrestlers[id]?.role === 'wrestler')!;

    // Jumping the week straight to the earliest-eligible week (rather than
    // playing every week in between) leaves every title's own, unrelated
    // defence clock stale — real neglect logic, nothing to do with this
    // story, but it means a title can arrive here already stripped vacant.
    // Restore it to a clean, known state before booking the title match.
    useGameStore.setState((s) => {
      const t = s.world!.titles.find((x) => x.id === title.id)!;
      t.vacant = false;
      t.currentHolderIds = [opponentId];
      t.lastDefendedWeek = s.world!.week;
    });

    // Stacks the odds hard in the nephew's favor — every trait the sim
    // might weigh, not just the four core stats, since the whole point is
    // to reliably reach the win branch rather than fight the real formula.
    // The sim still decides; this only sets up a heavy mismatch.
    useGameStore.setState((s) => {
      const champ = s.world!.wrestlers[nephewId]!;
      champ.strength = 95;
      champ.skill = 95;
      champ.agility = 95;
      champ.stamina = 95;
      champ.popularity = 95;
      champ.charisma = 95;
      champ.talent = 95;
      champ.hype = 95;
      champ.coachability = 95;
      champ.toughness = 95;
      champ.momentum = 95;
      champ.health = 100;
      champ.injury = null;
      const opponent = s.world!.wrestlers[opponentId]!;
      opponent.strength = 1;
      opponent.skill = 1;
      opponent.agility = 1;
      opponent.stamina = 1;
      opponent.popularity = 1;
      opponent.charisma = 1;
      opponent.talent = 1;
      opponent.hype = 1;
      opponent.momentum = 0;
      opponent.health = 100;
      opponent.injury = null;
    });

    let won = false;
    for (let attempt = 0; attempt < 15 && !won; attempt++) {
      useGameStore.getState().setSegmentParticipant(0, nephewId, 0);
      useGameStore.getState().setSegmentParticipant(0, opponentId, 1);
      useGameStore.getState().toggleSegmentTitle(0, title.id);
      runWeek();
      won = useGameStore.getState().world!.wrestlers[nephewId]?.familyBusiness?.titleWonWeek !== null;
    }
    expect(won).toBe(true);

    const champion = useGameStore.getState().world!.wrestlers[nephewId]!;
    expect(champion.strength).toBeGreaterThan(1);
    expect(champion.familyBusiness).toBeDefined();
    const worldAfterWin = useGameStore.getState().world!;
    expect(
      worldAfterWin.weeklyNews.some((n) => n.kind === 'title' && n.text.includes(champion.name) && n.text.includes(title.name)),
    ).toBe(true);
    const strengthAfterWin = champion.strength;

    // Now lose it to somebody else, with the champion (the signee) crushed
    // down instead — same lever, opposite direction.
    const challengerId = world.promotion.rosterIds.find(
      (id) => id !== nephewId && id !== opponentId && world.wrestlers[id]?.role === 'wrestler',
    )!;
    useGameStore.setState((s) => {
      // Deliberately leaves strength/skill/agility/stamina untouched — the
      // whole point of this half is to confirm the earlier stat bump
      // survives the release, so those four cannot be part of the handicap.
      // Everything else is fair game to crush.
      const champ = s.world!.wrestlers[nephewId]!;
      champ.popularity = 1;
      champ.charisma = 1;
      champ.talent = 1;
      champ.hype = 1;
      champ.momentum = 0;
      champ.health = 100;
      champ.injury = null;
      const challenger = s.world!.wrestlers[challengerId]!;
      challenger.strength = 95;
      challenger.skill = 95;
      challenger.agility = 95;
      challenger.stamina = 95;
      challenger.popularity = 95;
      challenger.charisma = 95;
      challenger.talent = 95;
      challenger.hype = 95;
      challenger.coachability = 95;
      challenger.toughness = 95;
      challenger.momentum = 95;
      challenger.health = 100;
      challenger.injury = null;
    });

    let lost = false;
    for (let attempt = 0; attempt < 15 && !lost; attempt++) {
      useGameStore.getState().setSegmentParticipant(0, nephewId, 0);
      useGameStore.getState().setSegmentParticipant(0, challengerId, 1);
      useGameStore.getState().toggleSegmentTitle(0, title.id);
      runWeek();
      lost = !useGameStore.getState().world!.promotion.rosterIds.includes(nephewId);
    }
    expect(lost).toBe(true);

    const finalWorld = useGameStore.getState().world!;
    expect(finalWorld.wrestlers[nephewId]?.promotionId).toBeNull();
    expect(finalWorld.freeAgents.some((a) => a.wrestlerId === nephewId)).toBe(true);
    expect(finalWorld.wrestlers[nephewId]?.strength).toBe(strengthAfterWin);
    expect(
      finalWorld.weeklyNews.some(
        (n) => n.kind === 'departure' && n.week === finalWorld.week && n.text.includes(champion.name),
      ),
    ).toBe(true);
  });
});
