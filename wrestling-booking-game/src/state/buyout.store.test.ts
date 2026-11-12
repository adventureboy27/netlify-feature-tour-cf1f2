// A rival's blind bulk offer, only while a loan is actually running.

import { describe, expect, it, beforeEach } from 'vitest';
import { useGameStore } from './store';
import { defaultWorldSettings } from '../engine/world/settings';
import { maybeOfferBuyout, expireStaleBuyoutOffer, answerBuyoutOffer } from './storeHelpers';
import { rngFromSeed } from '../engine/rng';

function newGame() {
  useGameStore.getState().newGame({
    ...defaultWorldSettings(),
    seed: 'buyout-1',
    startingRosterSize: 20,
    ownerMandatesEnabled: false,
  });
}

/** Puts an active loan on the books so the offer trigger is eligible at all. */
function withActiveLoan() {
  useGameStore.setState((s) => {
    s.world!.activeLoan = {
      attemptNumber: 1,
      tier: 'small',
      borrowed: 5000,
      totalOwed: 6500,
      weeklyPayment: 250,
      weeksRemaining: 20,
      startedWeek: s.world!.week,
    };
  });
}

/** Makes every rival flush, so an offer is never blocked on affordability. */
function flushRivals() {
  useGameStore.setState((s) => {
    for (const r of s.world!.rivals) r.bankBalance = 50_000_000;
  });
}

beforeEach(newGame);

describe('a rival smelling blood', () => {
  it('never offers while no loan is running', () => {
    flushRivals();
    useGameStore.setState((s) => {
      s.world!.settings.buyoutWeeklyChance = 1;
      maybeOfferBuyout(s.world!, rngFromSeed('t1'));
    });
    expect(useGameStore.getState().world!.pendingBuyoutOffer).toBeNull();
  });

  it('offers once a loan is running and the roll hits', () => {
    withActiveLoan();
    flushRivals();
    useGameStore.setState((s) => {
      s.world!.settings.buyoutWeeklyChance = 1;
      maybeOfferBuyout(s.world!, rngFromSeed('t2'));
    });
    const offer = useGameStore.getState().world!.pendingBuyoutOffer;
    expect(offer).not.toBeNull();
    expect(offer!.count).toBeGreaterThanOrEqual(1);
    expect(offer!.price).toBeGreaterThan(0);
  });

  it('never offers a second one while one is already pending', () => {
    withActiveLoan();
    flushRivals();
    useGameStore.setState((s) => {
      s.world!.settings.buyoutWeeklyChance = 1;
      s.world!.pendingBuyoutOffer = {
        openedWeek: s.world!.week,
        fromPromotionId: s.world!.rivals[0]!.id,
        fromPromotionName: s.world!.rivals[0]!.name,
        count: 3,
        price: 1000,
      };
      maybeOfferBuyout(s.world!, rngFromSeed('t3'));
    });
    expect(useGameStore.getState().world!.pendingBuyoutOffer!.count).toBe(3);
  });

  it('never offers when nobody can afford it', () => {
    withActiveLoan();
    useGameStore.setState((s) => {
      for (const r of s.world!.rivals) r.bankBalance = 0;
      s.world!.settings.buyoutWeeklyChance = 1;
      maybeOfferBuyout(s.world!, rngFromSeed('t4'));
    });
    expect(useGameStore.getState().world!.pendingBuyoutOffer).toBeNull();
  });
});

describe('a stale offer', () => {
  it('lapses after a week, same as everything else pending', () => {
    useGameStore.setState((s) => {
      s.world!.pendingBuyoutOffer = {
        openedWeek: s.world!.week,
        fromPromotionId: s.world!.rivals[0]!.id,
        fromPromotionName: s.world!.rivals[0]!.name,
        count: 3,
        price: 1000,
      };
      expireStaleBuyoutOffer(s.world!);
    });
    expect(useGameStore.getState().world!.pendingBuyoutOffer).not.toBeNull();

    useGameStore.setState((s) => {
      s.world!.week += 1;
      expireStaleBuyoutOffer(s.world!);
    });
    expect(useGameStore.getState().world!.pendingBuyoutOffer).toBeNull();
  });
});

describe('answering the offer', () => {
  function offered(count = 5, price = 50_000) {
    useGameStore.setState((s) => {
      s.world!.pendingBuyoutOffer = {
        openedWeek: s.world!.week,
        fromPromotionId: s.world!.rivals[0]!.id,
        fromPromotionName: s.world!.rivals[0]!.name,
        count,
        price,
      };
    });
  }

  it('turning it down changes nothing', () => {
    offered();
    const before = useGameStore.getState().world!;
    const rosterBefore = [...before.promotion.rosterIds];
    const bankBefore = before.promotion.bankBalance;

    useGameStore.setState((s) => answerBuyoutOffer(s.world!, rngFromSeed('decline'), false));

    const after = useGameStore.getState().world!;
    expect(after.pendingBuyoutOffer).toBeNull();
    expect(after.promotion.rosterIds).toEqual(rosterBefore);
    expect(after.promotion.bankBalance).toBe(bankBefore);
  });

  it('taking the deal pays the promotion and moves exactly the offered count to the buyer', () => {
    offered(5, 50_000);
    const rivalId = useGameStore.getState().world!.rivals[0]!.id;
    const bankBefore = useGameStore.getState().world!.promotion.bankBalance;
    const rosterSizeBefore = useGameStore.getState().world!.promotion.rosterIds.length;

    useGameStore.setState((s) => answerBuyoutOffer(s.world!, rngFromSeed('accept'), true));

    const world = useGameStore.getState().world!;
    expect(world.pendingBuyoutOffer).toBeNull();
    expect(world.promotion.bankBalance).toBe(bankBefore + 50_000);
    expect(world.promotion.rosterIds.length).toBe(rosterSizeBefore - 5);

    const rival = world.rivals.find((r) => r.id === rivalId)!;
    const movedCount = rival.rosterIds.filter((id) => !world.promotion.rosterIds.includes(id)).length;
    expect(movedCount).toBeGreaterThanOrEqual(5);
  });

  it('vacates a title the taken wrestler held, and does not silently keep the belt on a gone roster', () => {
    const before = useGameStore.getState().world!;
    const held = before.titles.find((t) => t.promotionId === before.promotion.id && !t.vacant);
    expect(held).toBeTruthy();

    // Every wrestler on the roster is taken, so the champion cannot be
    // spared — deterministic, not a matter of which way the shuffle lands.
    const rosterSize = before.promotion.rosterIds.length;
    offered(rosterSize, 10_000);

    useGameStore.setState((s) => answerBuyoutOffer(s.world!, rngFromSeed('accept-title'), true));

    const world = useGameStore.getState().world!;
    const title = world.titles.find((t) => t.id === held!.id)!;
    expect(title.vacant).toBe(true);
    expect(title.currentHolderIds).toHaveLength(0);
  });

  it('costs the rest of the room some morale', () => {
    const before = useGameStore.getState().world!;
    const moraleBefore = new Map(before.promotion.rosterIds.map((id) => [id, before.wrestlers[id]!.morale]));
    // Take all but one, so exactly one survivor is guaranteed and its
    // morale-before is known no matter which way the shuffle lands.
    offered(before.promotion.rosterIds.length - 1, 20_000);

    useGameStore.setState((s) => answerBuyoutOffer(s.world!, rngFromSeed('accept-morale'), true));

    const world = useGameStore.getState().world!;
    expect(world.promotion.rosterIds).toHaveLength(1);
    const survivorId = world.promotion.rosterIds[0]!;
    expect(world.wrestlers[survivorId]!.morale).toBeLessThan(moraleBefore.get(survivorId)!);
  });

  it('does nothing when there is no pending offer', () => {
    const before = useGameStore.getState().world!.promotion.bankBalance;
    useGameStore.setState((s) => answerBuyoutOffer(s.world!, rngFromSeed('nothing'), true));
    expect(useGameStore.getState().world!.promotion.bankBalance).toBe(before);
  });
});
