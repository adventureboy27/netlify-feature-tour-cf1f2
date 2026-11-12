// The network demand, wired into the real weekly loop — see
// engine/world/networkDemand.ts for the pure logic, already covered by its
// own tests.

import { describe, expect, it, beforeEach } from 'vitest';
import { useGameStore } from './store';
import { defaultWorldSettings } from '../engine/world/settings';
import { BROADCASTERS } from '../data/broadcasters';

const TEST_ROSTER_SIZE = 24;
const deal = BROADCASTERS[0]!;

function freshSettings() {
  return {
    ...defaultWorldSettings(),
    seed: 'network-demand-store-test',
    startingRosterSize: TEST_ROSTER_SIZE,
    ownerMandatesEnabled: false,
  };
}

function newGame() {
  useGameStore.getState().newGame(freshSettings());
}

beforeEach(newGame);

function runWeek() {
  useGameStore.getState().resolveWeek();
  if (useGameStore.getState().world?.pendingWeatherCall) {
    useGameStore.getState().answerWeatherCall('runIt');
  }
}

/** Neither system this test doesn't care about interferes with the roll. */
function quietOtherStories() {
  useGameStore.setState((s) => {
    s.world!.settings.contractRaidChancePerWeek = 0;
    s.world!.settings.mergerChancePerWeek = 0;
    s.world!.settings.successionChancePerWeek = 0;
    s.world!.settings.networkRealignmentChancePerWeek = 0;
    s.world!.settings.ownerRivalryChancePerWeek = 0;
    s.world!.settings.rogueChancePerWeek = 0;
    s.world!.settings.scandalChancePerWeek = 0;
    s.world!.settings.breakawayChancePerWeek = 0;
    s.world!.settings.farewellTourChancePerWeek = 0;
    s.world!.settings.pricingWarChancePerWeek = 0;
  });
}

describe('the network demand', () => {
  it('never rolls without an active broadcast deal, however certain the roll', () => {
    quietOtherStories();
    useGameStore.setState((s) => {
      s.world!.broadcastDealId = null;
      s.world!.settings.networkDemandChancePerWeek = 1;
      s.world!.week = s.world!.settings.networkDemandEarliestWeek;
    });
    runWeek();
    expect(useGameStore.getState().world!.pendingNetworkDemand).toBeNull();
  });

  it('rolls a real demand off the actual roster once a deal is in force', () => {
    quietOtherStories();
    useGameStore.setState((s) => {
      s.world!.broadcastDealId = deal.id;
      s.world!.settings.networkDemandChancePerWeek = 1;
      s.world!.week = s.world!.settings.networkDemandEarliestWeek;
    });
    runWeek();

    const world = useGameStore.getState().world!;
    expect(world.pendingNetworkDemand).not.toBeNull();
    expect(world.pendingNetworkDemand!.dealId).toBe(deal.id);
    expect(world.wrestlers[world.pendingNetworkDemand!.targetId]).toBeDefined();
    expect(world.weeklyNews.some((n) => n.kind === 'broadcast' && n.week === world.week)).toBe(true);
  });

  it('complying pays a real bonus and clears the pending demand', () => {
    quietOtherStories();
    useGameStore.setState((s) => {
      s.world!.broadcastDealId = deal.id;
      s.world!.settings.networkDemandChancePerWeek = 1;
      s.world!.week = s.world!.settings.networkDemandEarliestWeek;
    });
    runWeek();
    const before = useGameStore.getState().world!.promotion.bankBalance;
    useGameStore.getState().answerNetworkDemand('comply');
    const world = useGameStore.getState().world!;
    expect(world.pendingNetworkDemand).toBeNull();
    expect(world.promotion.bankBalance).toBeGreaterThan(before);
  });

  it('decides itself as a refusal if left unanswered past the grace period', () => {
    quietOtherStories();
    useGameStore.setState((s) => {
      s.world!.broadcastDealId = deal.id;
      s.world!.settings.networkDemandChancePerWeek = 1;
      s.world!.week = s.world!.settings.networkDemandEarliestWeek;
    });
    runWeek();
    expect(useGameStore.getState().world!.pendingNetworkDemand).not.toBeNull();
    const before = useGameStore.getState().world!.promotion.bankBalance;

    useGameStore.setState((s) => {
      s.world!.settings.networkDemandChancePerWeek = 0;
      s.world!.week += s.world!.settings.networkDemandGraceWeeks;
    });
    runWeek();
    const world = useGameStore.getState().world!;
    expect(world.pendingNetworkDemand).toBeNull();
    // A silent refusal costs the same real money an explicit one does.
    expect(world.promotion.bankBalance).toBeLessThan(before);
  });

  it('repeated refusals eventually walk the deal, same grace a numeric breach gets', () => {
    quietOtherStories();
    useGameStore.setState((s) => {
      s.world!.broadcastDealId = deal.id;
      s.world!.settings.networkDemandChancePerWeek = 1;
      s.world!.week = s.world!.settings.networkDemandEarliestWeek;
    });

    let walked = false;
    let lostReasonName: string | undefined;
    for (let i = 0; i < 20; i++) {
      // Isolate this test to the demand's own breach clock — a show-free
      // test would otherwise also trip the deal's ordinary numeric demands
      // (e.g. shows-per-month) on the same schedule, and either reason
      // walking the deal would make this test pass for the wrong cause.
      useGameStore.setState((s) => {
        delete s.world!.breachWeeks[deal.id];
      });
      runWeek();
      const world = useGameStore.getState().world!;
      if (!world.broadcastDealId) break; // already walked on a prior iteration's refusal
      expect(world.pendingNetworkDemand).not.toBeNull();

      useGameStore.getState().answerNetworkDemand('refuse');
      // world.lastDealsLost is reset to [] at the top of every week's broadcast
      // pass, so it has to be read right here — before the next runWeek() wipes it.
      const after = useGameStore.getState().world!;
      if (!after.broadcastDealId) {
        walked = true;
        lostReasonName = after.lastDealsLost.find((d) => d.name === deal.name)?.name;
        break;
      }
    }

    expect(walked).toBe(true);
    expect(lostReasonName).toBe(deal.name);
  });
});
