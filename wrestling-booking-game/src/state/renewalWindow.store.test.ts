// The renewal window — a real, booker-initiated conversation opened while
// there's still time on a deal — and the queued contract a renewal auction
// can produce, which only takes effect once the old deal actually runs out.
// See engine/economy/bidding.ts's 'renewalAuction' reason and
// state/world.ts's RenewalTalk.

import { describe, expect, it, beforeEach } from 'vitest';
import { useGameStore } from './store';
import { defaultWorldSettings } from '../engine/world/settings';
import { openBiddingWar, queueRenewalContract } from './storeHelpers';
import { rngFromSeed } from '../engine/rng';
import type { Bid } from '../engine/economy/bidding';

function newGame() {
  useGameStore.getState().newGame({
    ...defaultWorldSettings(),
    seed: 'renewal-window-1',
    startingRosterSize: 16,
    ownerMandatesEnabled: false,
  });
}

function runWeek() {
  useGameStore.getState().resolveWeek();
  const s = useGameStore.getState();
  if (s.world?.pendingWeatherCall) s.answerWeatherCall('runIt');
}

beforeEach(newGame);

/** Sets one roster member's contract to exactly `weeks` remaining. */
function setWeeksRemaining(id: string, weeks: number) {
  useGameStore.setState((s) => {
    const c = s.world!.wrestlers[id]!.contract;
    if (c) c.weeksRemaining = weeks;
  });
}

describe('the renewal window opening', () => {
  it('opens only at exactly renewalWindowWeeks left, not before and not after', () => {
    const id = useGameStore.getState().world!.promotion.rosterIds[0]!;
    const windowWeeks = useGameStore.getState().world!.settings.renewalWindowWeeks;

    setWeeksRemaining(id, windowWeeks + 2);
    runWeek();
    expect(useGameStore.getState().world!.renewalTalks.some((t) => t.wrestlerId === id)).toBe(false);

    runWeek();
    expect(useGameStore.getState().world!.renewalTalks.find((t) => t.wrestlerId === id)?.stage).toBe('askInterest');
  });

  it('never opens twice for the same still-open conversation', () => {
    const id = useGameStore.getState().world!.promotion.rosterIds[0]!;
    const windowWeeks = useGameStore.getState().world!.settings.renewalWindowWeeks;
    setWeeksRemaining(id, windowWeeks + 1);
    runWeek();
    expect(useGameStore.getState().world!.renewalTalks.filter((t) => t.wrestlerId === id).length).toBe(1);
  });
});

describe('answering it', () => {
  function openTalk(): string {
    const id = useGameStore.getState().world!.promotion.rosterIds[0]!;
    const windowWeeks = useGameStore.getState().world!.settings.renewalWindowWeeks;
    setWeeksRemaining(id, windowWeeks + 1);
    runWeek();
    return id;
  }

  it('a booker "no" closes it with no negotiation at all', () => {
    const id = openTalk();
    useGameStore.getState().answerRenewalInterest(id, false);
    const world = useGameStore.getState().world!;
    expect(world.renewalTalks.some((t) => t.wrestlerId === id)).toBe(false);
    expect(world.pendingRenewals.some((r) => r.wrestlerId === id)).toBe(false);
  });

  it('a booker "yes" advances to the wrestler\'s own choice', () => {
    const id = openTalk();
    useGameStore.getState().answerRenewalInterest(id, true);
    expect(useGameStore.getState().world!.renewalTalks.find((t) => t.wrestlerId === id)?.stage).toBe('askWrestler');
  });

  it('"leave" is a warm exit — no negotiation, same as a booker no', () => {
    const id = openTalk();
    useGameStore.getState().answerRenewalInterest(id, true);
    useGameStore.getState().answerRenewalWish(id, 'leave');
    const world = useGameStore.getState().world!;
    expect(world.renewalTalks.some((t) => t.wrestlerId === id)).toBe(false);
    expect(world.pendingRenewals.some((r) => r.wrestlerId === id)).toBe(false);
  });

  it('"stay" opens the same negotiation the game has always run at expiry', () => {
    const id = openTalk();
    useGameStore.getState().answerRenewalInterest(id, true);
    useGameStore.getState().answerRenewalWish(id, 'stay');
    const world = useGameStore.getState().world!;
    expect(world.renewalTalks.some((t) => t.wrestlerId === id)).toBe(false);
    const offer = world.pendingRenewals.find((r) => r.wrestlerId === id);
    expect(offer).toBeTruthy();
    expect(offer!.demand.weeklyRate).toBeGreaterThan(0);
  });

  it('"explore" can open a real bidding war under the renewal reason', () => {
    const id = openTalk();
    useGameStore.getState().answerRenewalInterest(id, true);
    useGameStore.setState((s) => {
      s.world!.settings.biddingMinRivals = 1;
    });
    useGameStore.getState().answerRenewalWish(id, 'explore');
    const world = useGameStore.getState().world!;
    expect(world.renewalTalks.some((t) => t.wrestlerId === id)).toBe(false);
    // Not guaranteed to open (depends on who's actually interested at this
    // seed), but if it did, it must be under the right reason and the
    // wrestler must still be exactly where they were.
    if (world.pendingBiddingWar) {
      expect(world.pendingBiddingWar.reason).toBe('renewalAuction');
      expect(world.pendingBiddingWar.wrestlerId).toBe(id);
    }
    expect(world.promotion.rosterIds).toContain(id);
  });
});

describe('the eligibility gate for a renewal auction', () => {
  it('bypasses the ordinary star-only gate, and needs only one rival, unlike a free agent star auction', () => {
    const id = useGameStore.getState().world!.promotion.rosterIds[0]!;
    useGameStore.setState((s) => {
      s.world!.settings.biddingMinRivals = 3; // would block an ordinary auction with only one rival interested
      s.world!.settings.biddingWantsThreshold = 0; // any rival "wants" anybody, deterministically
      const w = s.world!.wrestlers[id]!;
      w.popularity = 1; // nowhere near worthAnAuction's star threshold
      w.hype = 0;
      w.age = 60; // nowhere near the young-prospect threshold either
    });
    let opened = false;
    useGameStore.setState((s) => {
      opened = openBiddingWar(s.world!, rngFromSeed('renewal-elig'), s.world!.wrestlers[id]!, 'renewalAuction');
    });
    expect(opened).toBe(true);
    expect(useGameStore.getState().world!.pendingBiddingWar?.reason).toBe('renewalAuction');
  });
});

describe('a queued contract taking over at natural expiry', () => {
  function bid(over: Partial<Bid> = {}): Bid {
    return {
      promotionId: 'rival-x',
      promotionName: 'Rival X',
      weeklyRate: 9999,
      signingBonus: 0,
      weeks: 52,
      clauses: [],
      ...over,
    };
  }

  it('does nothing to the current deal until the old one actually runs out', () => {
    const id = useGameStore.getState().world!.promotion.rosterIds[0]!;
    const world = useGameStore.getState().world!;
    const rivalId = world.rivals[0]!.id;
    const before = { ...world.wrestlers[id]!.contract! };

    useGameStore.setState((s) => {
      queueRenewalContract(s.world!, s.world!.wrestlers[id]!, bid({ promotionId: rivalId }), rivalId);
    });

    const after = useGameStore.getState().world!;
    expect(after.wrestlers[id]!.queuedContract).toBeTruthy();
    expect(after.wrestlers[id]!.contract!.weeklyRate).toBe(before.weeklyRate);
    expect(after.promotion.rosterIds).toContain(id);
  });

  it('moves the wrestler to the winning rival the week the old deal runs out, not before', () => {
    const id = useGameStore.getState().world!.promotion.rosterIds[0]!;
    const rivalId = useGameStore.getState().world!.rivals[0]!.id;

    useGameStore.setState((s) => {
      queueRenewalContract(s.world!, s.world!.wrestlers[id]!, bid({ promotionId: rivalId, weeklyRate: 7777 }), rivalId);
      const c = s.world!.wrestlers[id]!.contract;
      if (c) c.weeksRemaining = 1;
    });
    runWeek();

    const world = useGameStore.getState().world!;
    expect(world.wrestlers[id]!.queuedContract).toBeFalsy();
    expect(world.wrestlers[id]!.promotionId).toBe(rivalId);
    expect(world.wrestlers[id]!.contract!.weeklyRate).toBe(7777);
    expect(world.promotion.rosterIds).not.toContain(id);
    expect(world.rivals.find((r) => r.id === rivalId)!.rosterIds).toContain(id);
    expect(world.weeklyNews.some((n) => n.kind === 'departure' && n.text.includes('won them on the open market'))).toBe(
      true,
    );
  });

  it('re-signs in place when the current employer is the one who wins their own auction', () => {
    const id = useGameStore.getState().world!.promotion.rosterIds[0]!;
    const playerId = useGameStore.getState().world!.promotion.id;

    useGameStore.setState((s) => {
      queueRenewalContract(s.world!, s.world!.wrestlers[id]!, bid({ promotionId: playerId, weeklyRate: 5555 }), playerId);
      const c = s.world!.wrestlers[id]!.contract;
      if (c) c.weeksRemaining = 1;
    });
    runWeek();

    const world = useGameStore.getState().world!;
    expect(world.wrestlers[id]!.queuedContract).toBeFalsy();
    expect(world.wrestlers[id]!.contract!.weeklyRate).toBe(5555);
    expect(world.promotion.rosterIds).toContain(id);
  });
});
