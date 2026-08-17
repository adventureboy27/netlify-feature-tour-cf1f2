// Somebody has been talking to your talent, and now you can answer.
//
// Both halves of this were dead: offers were regenerated wholesale every week
// and nothing could be done about them, and the player could not go after
// anybody else's man at all.

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
    kind: 'tampering',
    offerPremium: 300,
    temptation: 0.9,
    openedWeek: world.week,
    resolvesWeek: world.week + 2,
    status: 'open',
    ...over,
  };
  useGameStore.setState((s) => {
    s.world!.tamperingOffers = [offer];
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
    expect(after.tamperingOffers[0]!.temptation).toBeLessThan(offer.temptation);
  });

  it('will not let you wave a contract at a man whose deal is running out', () => {
    const offer = courted({ kind: 'approach' });
    const result = useGameStore.getState().answerApproach(offer.id, { kind: 'legalThreat' });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('no paper');
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
    expect(world.tamperingOffers).toHaveLength(0);
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
    expect(useGameStore.getState().world!.tamperingOffers.some((o) => o.id === 'offer-1')).toBe(true);
  });
});

describe('going after somebody else', () => {
  it('refuses anybody who is not under contract elsewhere', () => {
    const world = useGameStore.getState().world!;
    const ours = world.promotion.rosterIds[0]!;
    expect(useGameStore.getState().tamperWith(ours, 500).ok).toBe(false);
  });

  it('is a bad bet, and being caught escalates', () => {
    // Deliberately a bad bet — the module says so and the shape should hold.
    // Twenty-five attempts on other people's talent, and what matters is that
    // getting caught costs something real rather than that anybody signs.
    const world = useGameStore.getState().world!;
    const theirs = world.rivals
      .flatMap((r) => r.rosterIds)
      .map((id) => world.wrestlers[id]!)
      .filter((w) => w?.contract)
      .slice(0, 25);

    for (const target of theirs) useGameStore.getState().tamperWith(target.id, 400);

    const after = useGameStore.getState().world!;
    expect(after.tamperingOffenses).toBeGreaterThan(0);
    expect(after.signingBanWeeks).toBeGreaterThan(0);
    // And it is on the wire, because §0 does not have an exception for the
    // things the booker would rather nobody knew about.
    expect(after.weeklyNews.some((n) => n.kind === 'signing')).toBe(true);
  });
});
