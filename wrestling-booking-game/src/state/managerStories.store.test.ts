// The three manager stories, wired end to end: a signed manager can be
// poached same as a wrestler, a client-fired manager sometimes turns into a
// real rivalry, and a manager's growing book gets a name.

import { describe, expect, it, beforeEach } from 'vitest';
import { useGameStore } from './store';
import { defaultWorldSettings } from '../engine/world/settings';
import { generateWrestler } from '../engine/generate/wrestler';
import { createStandardContract } from '../engine/economy/contracts';
import { rngFromSeed } from '../engine/rng';
import type { PoachingOffer } from '../engine/world/poaching';
import type { Representation } from '../engine/career/representation';
import type { Wrestler } from '../engine/types';

function newGame() {
  useGameStore.getState().newGame({
    ...defaultWorldSettings(),
    seed: 'manager-stories-1',
    startingRosterSize: 10,
    ownerMandatesEnabled: false,
  });
}

function runWeek() {
  useGameStore.getState().resolveWeek();
  const s = useGameStore.getState();
  if (s.world?.pendingWeatherCall) s.answerWeatherCall('runIt');
}

/**
 * Add a fresh manager to the player's roster, signed, with no clients yet.
 * Fully rested by default (0 fatigue, full energy) so an unrelated test
 * doesn't accidentally trip the existing quiet-split loop — a test that
 * wants that has to ask for it explicitly.
 */
function addManager(over: Partial<Wrestler> = {}): Wrestler {
  const world = useGameStore.getState().world!;
  const base = generateWrestler(rngFromSeed(`manager-${over.id ?? 'x'}`), new Set());
  const contract = createStandardContract(base, world.settings, world.settings.startingYear);
  const manager: Wrestler = {
    ...base,
    id: over.id ?? 'test-manager',
    role: 'manager',
    promotionId: world.promotion.id,
    contract,
    fatigueDebt: 0,
    energy: 100,
    ...over,
  } as Wrestler;
  useGameStore.setState((s) => {
    s.world!.wrestlers[manager.id] = manager;
    if (!s.world!.promotion.rosterIds.includes(manager.id)) {
      s.world!.promotion.rosterIds.push(manager.id);
    }
  });
  return manager;
}

/**
 * Add a client to the player's roster, with a real contract so his weekly
 * rate isn't 0 — a rate of 0 makes managerWouldDrop's 'notEarningEnough'
 * fire regardless of cut, which isn't what any of these tests are after.
 * Low charisma by default so clientWouldWalk's 'outgrewHim' branch can't
 * fire on its own — a test that wants a real split forces it through the
 * manager's condition instead.
 */
function addClient(id: string): Wrestler {
  const world = useGameStore.getState().world!;
  const base = generateWrestler(rngFromSeed(id), new Set());
  const contract = createStandardContract(base, world.settings, world.settings.startingYear);
  // A fixed, comfortably-high rate rather than whatever the random archetype
  // rolled — a low roll here makes managerWouldDrop's 'notEarningEnough'
  // fire on its own, which isn't what these tests are about.
  contract.weeklyRate = 1000;
  const client: Wrestler = { ...base, id, role: 'wrestler', charisma: 10, contract } as Wrestler;
  useGameStore.setState((s) => {
    s.world!.wrestlers[id] = client;
    if (!s.world!.promotion.rosterIds.includes(id)) {
      s.world!.promotion.rosterIds.push(id);
    }
  });
  return client;
}

function rep(over: Partial<Representation> = {}): Representation {
  return { managerId: 'test-manager', clientId: 'test-client', cut: 0.15, signedWeek: 1, ...over };
}

beforeEach(newGame);

describe('a manager can be poached, same as a wrestler', () => {
  it('shows up as a real, answerable offer', () => {
    const manager = addManager({ id: 'mgr-a' });
    useGameStore.setState((s) => {
      s.world!.wrestlers[manager.id]!.contract!.weeksRemaining = 0;
    });
    const world = useGameStore.getState().world!;
    const offer: PoachingOffer = {
      id: 'mgr-offer-1',
      wrestlerId: manager.id,
      rivalPromotionId: world.rivals[0]!.id,
      offerPremium: 400,
      temptation: 0.9,
      openedWeek: world.week,
      resolvesWeek: world.week + 2,
      status: 'open',
    };
    useGameStore.setState((s) => {
      s.world!.approachOffers = [offer];
    });

    expect(useGameStore.getState().answerApproach(offer.id, { kind: 'promiseABiggerBook' }).ok).toBe(true);
    expect(useGameStore.getState().world!.approachOffers[0]!.temptation).toBeLessThan(offer.temptation);
  });

  it('takes the whole book with him, and tells every client', () => {
    const manager = addManager({ id: 'mgr-b' });
    addClient('client-b');
    useGameStore.setState((s) => {
      s.world!.wrestlers[manager.id]!.contract!.weeksRemaining = 0;
      s.world!.representations = [rep({ managerId: manager.id, clientId: 'client-b' })];
    });

    const world = useGameStore.getState().world!;
    const offer: PoachingOffer = {
      id: 'mgr-offer-2',
      wrestlerId: manager.id,
      rivalPromotionId: world.rivals[0]!.id,
      offerPremium: 400,
      temptation: 1,
      openedWeek: world.week,
      resolvesWeek: world.week,
      status: 'open',
    };
    useGameStore.setState((s) => {
      s.world!.approachOffers = [offer];
    });

    runWeek();

    const after = useGameStore.getState().world!;
    expect(after.promotion.rosterIds).not.toContain(manager.id);
    expect(after.representations.find((r) => r.managerId === manager.id)).toBeUndefined();
    expect(
      after.weeklyNews.some((n) => n.text.includes('poached') && n.text.includes('looking for new representation')),
    ).toBe(true);
  });
});

describe('a client firing his manager, sometimes for real', () => {
  it('turns into a real rivalry when the escalation chance is 1', () => {
    // Worn all the way down so his presence drops below repClientPatience —
    // the same condition that already makes clientWouldWalk fire quietly.
    const manager = addManager({ id: 'mgr-c', fatigueDebt: 100, energy: 0 });
    addClient('client-c');
    useGameStore.setState((s) => {
      s.world!.representations = [rep({ managerId: manager.id, clientId: 'client-c', cut: 0.3 })];
      s.world!.settings.managerFiringRivalryChance = 1;
      // Maxed out rather than left at the default — at the default weight,
      // full fatigue lands presence exactly on repClientPatience's boundary,
      // and a weekly recovery tick before this check runs can knock it to
      // the other side. This keeps the walk-out unambiguous.
      s.world!.settings.repWearPenalty = 1;
    });

    runWeek();

    const after = useGameStore.getState().world!;
    expect(after.representations).toHaveLength(0);
    const rivalry = after.rivalries.find(
      (r) => r.participantIds.includes(manager.id) && r.participantIds.includes('client-c'),
    );
    expect(rivalry).toBeDefined();
    expect(rivalry!.shootHeat).toBeGreaterThan(0);

    // Real enough to show up in Office's Feuds index, not only as a heat
    // badge — see engine/world/storyline.ts's isLive/everyoneWithAStoryline.
    const story = after.storylines.find(
      (s) => s.participantIds.includes(manager.id) && s.participantIds.includes('client-c'),
    );
    expect(story).toBeDefined();
    expect(story!.rivalryId).toBe(rivalry!.id);
    expect(story!.stage).not.toBe('blownOff');
    expect(story!.stage).not.toBe('fizzled');
    expect(story!.beats).toHaveLength(1);
    expect(story!.beats[0]!.kind).toBe('confrontation');
  });

  it('stays quiet when the escalation chance is 0', () => {
    const manager = addManager({ id: 'mgr-d', fatigueDebt: 100, energy: 0 });
    addClient('client-d');
    useGameStore.setState((s) => {
      s.world!.representations = [rep({ managerId: manager.id, clientId: 'client-d', cut: 0.3 })];
      s.world!.settings.managerFiringRivalryChance = 0;
      s.world!.settings.repWearPenalty = 1;
    });

    runWeek();

    const after = useGameStore.getState().world!;
    expect(after.representations).toHaveLength(0);
    const rivalry = after.rivalries.find(
      (r) => r.participantIds.includes(manager.id) && r.participantIds.includes('client-d'),
    );
    expect(rivalry).toBeUndefined();
    const story = after.storylines.find(
      (s) => s.participantIds.includes(manager.id) && s.participantIds.includes('client-d'),
    );
    expect(story).toBeUndefined();
  });
});

describe("a manager's client stable", () => {
  it('forms once the book crosses the threshold, and shows up on the manager', () => {
    const manager = addManager({ id: 'mgr-e' });
    addClient('client-e-0');
    addClient('client-e-1');
    useGameStore.setState((s) => {
      s.world!.settings.managerStableFormsAtClients = 2;
      s.world!.representations = [
        rep({ managerId: manager.id, clientId: 'client-e-0' }),
        rep({ managerId: manager.id, clientId: 'client-e-1' }),
      ];
    });

    runWeek();

    const after = useGameStore.getState().world!;
    const stable = after.managerStables.find((st) => st.managerId === manager.id);
    expect(stable).toBeDefined();
    expect(after.weeklyNews.some((n) => n.text.includes(stable!.name))).toBe(true);
  });

  it('dissolves once the book drops back under the threshold', () => {
    const manager = addManager({ id: 'mgr-f' });
    addClient('client-f-0');
    addClient('client-f-1');
    useGameStore.setState((s) => {
      s.world!.settings.managerStableFormsAtClients = 2;
      s.world!.representations = [
        rep({ managerId: manager.id, clientId: 'client-f-0' }),
        rep({ managerId: manager.id, clientId: 'client-f-1' }),
      ];
    });
    runWeek();
    expect(useGameStore.getState().world!.managerStables.some((st) => st.managerId === manager.id)).toBe(true);

    useGameStore.setState((s) => {
      s.world!.representations = s.world!.representations.filter((r) => r.clientId !== 'client-f-0');
    });
    runWeek();

    expect(useGameStore.getState().world!.managerStables.some((st) => st.managerId === manager.id)).toBe(false);
  });
});
