// Somebody has been talking to your talent, and now you can answer.
//
// This used to regenerate offers wholesale every week and nothing could be
// done about them — a rival courted your champion for a fortnight and then
// the approach simply evaporated.

import { describe, expect, it, beforeEach } from 'vitest';
import { useGameStore } from './store';
import { defaultWorldSettings } from '../engine/world/settings';
import type { PoachingOffer } from '../engine/world/poaching';

function newGame() {
  useGameStore.getState().newGame({
    ...defaultWorldSettings(),
    seed: 'poach-store-2',
    startingRosterSize: 14,
    ownerMandatesEnabled: false,
  });
}

/** Put an approach on the desk rather than waiting for one to be rolled. */
function courted(over: Partial<PoachingOffer> = {}) {
  const world = useGameStore.getState().world!;
  const wrestlerId = world.promotion.rosterIds[0]!;
  const offer: PoachingOffer = {
    id: 'offer-1',
    wrestlerId,
    rivalPromotionId: world.rivals[0]!.id,
    offerPremium: 300,
    temptation: 0.9,
    openedWeek: world.week,
    resolvesWeek: world.week + 2,
    status: 'open',
    ...over,
  };
  useGameStore.setState((s) => {
    s.world!.approachOffers = [offer];
  });
  return offer;
}

function runWeek() {
  useGameStore.getState().resolveWeek();
  const s = useGameStore.getState();
  if (s.world?.pendingWeatherCall) s.answerWeatherCall('runIt');
}

beforeEach(newGame);

describe('answering an approach', () => {
  it('costs money and the rest of the room hears about it', () => {
    const offer = courted();
    const before = useGameStore.getState().world!;
    const rate = before.wrestlers[offer.wrestlerId]!.contract!.weeklyRate;
    const mate = before.promotion.rosterIds.find((id) => id !== offer.wrestlerId)!;
    const mateMorale = before.wrestlers[mate]!.morale;

    expect(useGameStore.getState().answerApproach(offer.id, { kind: 'matchMoney' }).ok).toBe(true);

    const after = useGameStore.getState().world!;
    expect(after.wrestlers[offer.wrestlerId]!.contract!.weeklyRate).toBeGreaterThan(rate);
    expect(after.wrestlers[mate]!.morale).toBeLessThan(mateMorale);
    // And it made him less likely to go, which is the point of paying.
    expect(after.approachOffers[0]!.temptation).toBeLessThan(offer.temptation);
  });

  it('says what the office did, whatever it did', () => {
    // §0: the room and the paper both find out. Even "let it ride" is an
    // answer and reads as one.
    const offer = courted();
    useGameStore.getState().answerApproach(offer.id, { kind: 'doNothing' });
    const news = useGameStore.getState().world!.weeklyNews;
    expect(news.some((n) => n.text.includes('let it ride'))).toBe(true);
  });
});

describe('an approach nobody answers', () => {
  it('settles itself, and can take the man', () => {
    // Temptation pinned at certainty, so this is about the wiring rather than
    // the odds — the odds live in poaching.test.ts.
    const offer = courted({ temptation: 1, resolvesWeek: useGameStore.getState().world!.week });
    const rivalId = offer.rivalPromotionId;
    runWeek();

    const world = useGameStore.getState().world!;
    expect(world.promotion.rosterIds).not.toContain(offer.wrestlerId);
    expect(world.rivals.find((r) => r.id === rivalId)!.rosterIds).toContain(offer.wrestlerId);
    expect(world.weeklyNews.some((n) => n.text.includes('never answered'))).toBe(true);
    expect(world.approachOffers).toHaveLength(0);
  });

  it('keeps him when he was never really going', () => {
    const offer = courted({ temptation: 0, resolvesWeek: useGameStore.getState().world!.week });
    runWeek();
    const world = useGameStore.getState().world!;
    expect(world.promotion.rosterIds).toContain(offer.wrestlerId);
    expect(world.weeklyNews.some((n) => n.text.includes('he stayed'))).toBe(true);
  });

  it('does not evaporate before its date', () => {
    // The old behaviour: offers were rebuilt every week, so a rival courted
    // your champion for a fortnight and then the approach simply vanished.
    courted({ resolvesWeek: useGameStore.getState().world!.week + 5 });
    runWeek();
    expect(useGameStore.getState().world!.approachOffers.some((o) => o.id === 'offer-1')).toBe(true);
  });
});
