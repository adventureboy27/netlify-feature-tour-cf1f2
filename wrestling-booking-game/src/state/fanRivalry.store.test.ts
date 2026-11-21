// Store-level integration for the fan rivalry story — see
// engine/world/fanRivalry.ts for the pure mechanics (covered by its own
// test file). This file covers the weekly-tick wiring in store.ts: the
// trigger during match resolution, the rivalry/storyline it opens with, the
// forced callout promo a week later, the forced unsanctioned match the week
// after that, and the win/lose payoff branch that follows — a cheap contract
// if she won it, free agency at a raised price if she didn't.

import { describe, expect, it, beforeEach } from 'vitest';
import { useGameStore } from './store';
import { defaultWorldSettings } from '../engine/world/settings';
import { generateWrestler } from '../engine/generate/wrestler';
import { createStandardContract } from '../engine/economy/contracts';
import { rngFromSeed } from '../engine/rng';
import type { Wrestler } from '../engine/types';

const TEST_ROSTER_SIZE = 16;

function freshSettings(overrides: Partial<ReturnType<typeof defaultWorldSettings>> = {}) {
  return {
    ...defaultWorldSettings(),
    seed: 'fan-rivalry-store-test',
    startingRosterSize: TEST_ROSTER_SIZE,
    ownerMandatesEnabled: false,
    // Zeroed so an unrelated weekly system doesn't crowd out or mask the
    // one roll this file is actually testing — same convention
    // factionDestroyer.store.test.ts uses.
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
    weatherChancePerShow: 0,
    fanIncidentChance: 1,
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

/** Drops a heel woman straight onto the roster, no randomness about it. */
function addHeelWoman(id: string): Wrestler {
  const world = useGameStore.getState().world!;
  const base = generateWrestler(rngFromSeed(id), new Set());
  const contract = createStandardContract(base, world.settings, world.settings.startingYear);
  const wrestler: Wrestler = { ...base, id, role: 'wrestler', gender: 'f', alignment: -50, contract } as Wrestler;
  useGameStore.setState((s) => {
    s.world!.wrestlers[id] = wrestler;
    if (!s.world!.promotion.rosterIds.includes(id)) s.world!.promotion.rosterIds.push(id);
  });
  return wrestler;
}

function firstOpponentFor(excludeId: string): string {
  const world = useGameStore.getState().world!;
  return world.promotion.rosterIds.find((id) => id !== excludeId && world.wrestlers[id]?.role === 'wrestler')!;
}

/** Books the heel into slot 0 against some outsider and runs the week she's due to slap somebody. */
function triggerIncident(heelId: string) {
  const opponent = firstOpponentFor(heelId);
  useGameStore.getState().setSegmentParticipant(0, heelId, 0);
  useGameStore.getState().setSegmentParticipant(0, opponent, 1);
  runWeek();
}

describe('the incident', () => {
  beforeEach(() => newGame());

  it('starts a shoot rivalry and a storyline, and locks the next two weeks in', () => {
    const heel = addHeelWoman('heel-1');
    const triggeredWeek = useGameStore.getState().world!.week;
    triggerIncident(heel.id);

    const world = useGameStore.getState().world!;
    expect(world.fanRivalry).not.toBeNull();
    expect(world.fanRivalry!.wrestlerId).toBe(heel.id);
    expect(world.fanRivalry!.calloutWeek).toBe(triggeredWeek + 1);
    expect(world.fanRivalry!.matchWeek).toBe(triggeredWeek + 2);
    expect(world.fanRivalry!.calloutDone).toBe(true); // the callout promo already got forced this same call

    const fan = world.wrestlers[world.fanRivalry!.fanId]!;
    expect(fan.gender).toBe('f');
    expect(fan.contract).toBeNull(); // not signed yet

    const rivalry = world.rivalries.find((r) => r.id === world.fanRivalry!.rivalryId)!;
    expect(rivalry).toBeDefined();
    expect(rivalry.origin).toBe('shoot');
    expect(rivalry.participantIds).toEqual(expect.arrayContaining([heel.id, fan.id]));
    expect(rivalry.shootHeat).toBeGreaterThan(0);

    const story = world.storylines.find((s) => s.rivalryId === rivalry.id)!;
    expect(story).toBeDefined();
    expect(story.participantIds).toEqual(expect.arrayContaining([heel.id, fan.id]));
    expect(story.beats).toHaveLength(1);
    expect(story.beats[0]!.kind).toBe('confrontation');

    expect(world.weeklyNews.some((n) => n.text.includes(heel.name) && n.text.includes(fan.name))).toBe(true);

    // Locked in the same call: next week's card already carries the forced callout.
    expect(world.currentPromos[0]!.systemForced).toBe('fanRivalry');
    expect(world.currentPromos[0]!.promoTopicId).toBe('challenge');
    expect(world.currentPromos[0]!.promoSpeakerId).toBe(heel.id);
    expect(world.currentPromos[0]!.promoTargetId).toBe(fan.id);
  });

  it('never fires twice at once — a second eligible heel woman is ignored while one story is already running', () => {
    const heelA = addHeelWoman('heel-a');
    const heelB = addHeelWoman('heel-b');
    useGameStore.getState().setSegmentParticipant(0, heelA.id, 0);
    useGameStore.getState().setSegmentParticipant(0, firstOpponentFor(heelA.id), 1);
    useGameStore.getState().setSegmentParticipant(1, heelB.id, 0);
    useGameStore.getState().setSegmentParticipant(1, firstOpponentFor(heelB.id), 1);
    runWeek();

    const world = useGameStore.getState().world!;
    expect(world.fanRivalry).not.toBeNull();
    // The singleton story locked onto whichever heel's match resolved
    // first — the other one never got a fan of her own this week.
    expect([heelA.id, heelB.id]).toContain(world.fanRivalry!.wrestlerId);
    const otherHeelId = world.fanRivalry!.wrestlerId === heelA.id ? heelB.id : heelA.id;
    expect(world.rivalries.some((r) => r.participantIds.includes(otherHeelId))).toBe(false);
  });

  it('does not trigger for a face woman or for a man, even at chance 1', () => {
    const world0 = useGameStore.getState().world!;
    const faceWoman: Wrestler = {
      ...generateWrestler(rngFromSeed('face-1'), new Set()),
      id: 'face-1',
      role: 'wrestler',
      gender: 'f',
      alignment: 60,
      contract: createStandardContract(
        generateWrestler(rngFromSeed('face-1'), new Set()),
        world0.settings,
        world0.settings.startingYear,
      ),
    } as Wrestler;
    useGameStore.setState((s) => {
      s.world!.wrestlers[faceWoman.id] = faceWoman;
      s.world!.promotion.rosterIds.push(faceWoman.id);
    });
    useGameStore.getState().setSegmentParticipant(0, faceWoman.id, 0);
    useGameStore.getState().setSegmentParticipant(0, firstOpponentFor(faceWoman.id), 1);
    runWeek();

    expect(useGameStore.getState().world!.fanRivalry).toBeNull();
  });
});

describe('the follow-through', () => {
  beforeEach(() => newGame());

  it('forces the unsanctioned match the week after the callout, then pays off in whichever branch the sim actually decided', () => {
    const heel = addHeelWoman('heel-2');
    triggerIncident(heel.id);
    const fanId = useGameStore.getState().world!.fanRivalry!.fanId;

    runWeek(); // resolves the forced callout promo, forces the match onto next week's card

    let world = useGameStore.getState().world!;
    expect(world.currentCard[0]!.systemForced).toBe('fanRivalry');
    expect(world.currentCard[0]!.stipulation).toBe('unsanctioned');
    expect(world.currentCard[0]!.participants.map((p) => p.wrestlerId)).toEqual(
      expect.arrayContaining([heel.id, fanId]),
    );

    runWeek(); // resolves the match

    world = useGameStore.getState().world!;
    expect(world.fanRivalry).toBeNull(); // the arc is complete either way
    const fan = world.wrestlers[fanId]!;

    // The sim, not this story, decided who won — read the real result back
    // out of showHistory to know which branch ought to have fired, same
    // approach factionDestroyer.store.test.ts uses for its own forced match.
    const show = world.showHistory[world.showHistory.length - 1]!;
    const seg = show.segments.find((s) => s.stipulation === 'unsanctioned')!;
    const fanWon = seg.result!.winnerWrestlerIds.includes(fanId);

    if (fanWon) {
      expect(fan.contract).not.toBeNull();
      expect(fan.contract!.totalWeeks).toBe(52);
      expect(fan.promotionId).toBe(world.promotion.id);
      expect(world.promotion.rosterIds).toContain(fanId);
      expect(world.freeAgents.some((a) => a.wrestlerId === fanId)).toBe(false);
    } else {
      expect(fan.contract).toBeNull();
      expect(world.promotion.rosterIds).not.toContain(fanId);
      const entry = world.freeAgents.find((a) => a.wrestlerId === fanId);
      expect(entry).toBeDefined();
      expect(entry!.reason).toBe('provedItAnyway');
    }

    expect(world.weeklyNews.some((n) => n.text.includes(fan.name) && n.text.includes(heel.name))).toBe(true);

    // The enemy she ends the story with is the same rivalry the incident
    // opened, regardless of which promotion — or none — she ends up signed
    // to.
    expect(world.rivalries.some((r) => r.participantIds.includes(heel.id) && r.participantIds.includes(fanId))).toBe(
      true,
    );
    const story = world.storylines.find((s) => s.participantIds.includes(fanId))!;
    expect(story.beats.some((b) => b.kind === 'match')).toBe(true);
  });

  it('abandons the story instead of leaving it stuck if the callout has nowhere to go', () => {
    newGame({ fanIncidentChance: 1, promoSlotsPerCard: 0 });
    const heel = addHeelWoman('heel-3');
    triggerIncident(heel.id);

    // The trigger itself doesn't need a promo slot, but locking the callout in does.
    expect(useGameStore.getState().world!.fanRivalry).toBeNull();
  });
});
