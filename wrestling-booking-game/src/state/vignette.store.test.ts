// The vignette package — a signing-time gamble to hype a brand-new face
// before their first-ever match. See engine/career/vignette.ts and the
// chooseSigningDebut/resolveWeek wiring in slices/rosterAndContracts.ts and
// store.ts.

import { describe, expect, it, beforeEach } from 'vitest';
import { useGameStore } from './store';
import { defaultWorldSettings } from '../engine/world/settings';

function newGame(overrides: Partial<ReturnType<typeof defaultWorldSettings>> = {}) {
  useGameStore.getState().newGame({
    ...defaultWorldSettings(),
    seed: 'vignette-test',
    startingRosterSize: 8,
    ownerMandatesEnabled: false,
    ...overrides,
  });
}

function pickRosterId(): string {
  return useGameStore.getState().world!.promotion.rosterIds[0]!;
}

function openChooseDebutTalk(wrestlerId: string) {
  useGameStore.setState((s) => {
    const world = s.world!;
    world.signingTalks.push({ wrestlerId, stage: 'chooseDebut', openedWeek: world.week });
  });
}

/** Resolve the week, answering a severe-weather call if one happens to come up — same as store.test.ts's helper. */
function runWeek() {
  useGameStore.getState().resolveWeek();
  if (useGameStore.getState().world?.pendingWeatherCall) {
    useGameStore.getState().answerWeatherCall('runIt');
  }
}

beforeEach(() => newGame());

describe('choosing how a new signee debuts', () => {
  it('does nothing when there is no live chooseDebut talk for them', () => {
    const id = pickRosterId();
    const before = useGameStore.getState().world!.promotion.bankBalance;
    useGameStore.getState().chooseSigningDebut(id, 'vignette');
    const world = useGameStore.getState().world!;
    expect(world.promotion.bankBalance).toBe(before);
    expect(world.wrestlers[id]!.vignette).toBeFalsy();
  });

  it('debuting them tonight announces it immediately and spends nothing', () => {
    const id = pickRosterId();
    openChooseDebutTalk(id);
    const before = useGameStore.getState().world!.promotion.bankBalance;

    useGameStore.getState().chooseSigningDebut(id, 'now');

    const world = useGameStore.getState().world!;
    const talk = world.signingTalks.find((t) => t.wrestlerId === id);
    expect(talk?.stage).toBe('offerPairing');
    expect(world.promotion.bankBalance).toBe(before);
    expect(world.wrestlers[id]!.vignette).toBeFalsy();
    expect(world.weeklyNews.some((n) => n.text.includes('debuts tonight'))).toBe(true);
    expect(world.pendingGimmickReactions.some((r) => r.kind === 'debut' && r.name === world.wrestlers[id]!.name)).toBe(
      true,
    );
  });

  it('running a vignette spends the cost up front and locks them out for the full campaign', () => {
    const id = pickRosterId();
    openChooseDebutTalk(id);
    const before = useGameStore.getState().world!.promotion.bankBalance;
    const { vignetteCost, vignetteWeeks } = useGameStore.getState().world!.settings;

    useGameStore.getState().chooseSigningDebut(id, 'vignette');

    const world = useGameStore.getState().world!;
    const wrestler = world.wrestlers[id]!;
    const talk = world.signingTalks.find((t) => t.wrestlerId === id);
    expect(world.promotion.bankBalance).toBe(before - vignetteCost);
    expect(wrestler.vignette).toEqual({ totalWeeks: vignetteWeeks, weeksRemaining: vignetteWeeks, startWeek: world.week });
    expect(talk?.stage).toBe('offerPairing');
    // Nobody outside the office knows this name yet — no debut announcement
    // and no gimmick-reaction queued until the campaign actually pays off.
    expect(world.weeklyNews.some((n) => n.text.includes('debuts tonight'))).toBe(false);
    expect(world.pendingGimmickReactions.some((r) => r.kind === 'debut')).toBe(false);
  });

  it('refuses the vignette outright when the company cannot afford it, and changes nothing', () => {
    const id = pickRosterId();
    openChooseDebutTalk(id);
    useGameStore.setState((s) => {
      s.world!.promotion.bankBalance = 0;
    });

    useGameStore.getState().chooseSigningDebut(id, 'vignette');

    const world = useGameStore.getState().world!;
    const talk = world.signingTalks.find((t) => t.wrestlerId === id);
    expect(world.promotion.bankBalance).toBe(0);
    expect(world.wrestlers[id]!.vignette).toBeFalsy();
    expect(talk?.stage).toBe('chooseDebut');
  });
});

describe('a vignette campaign resolving during a week', () => {
  it('ticks down without paying off while weeks remain', () => {
    const id = pickRosterId();
    const startWeek = useGameStore.getState().world!.week;
    useGameStore.setState((s) => {
      s.world!.wrestlers[id]!.vignette = { totalWeeks: 3, weeksRemaining: 3, startWeek };
    });

    runWeek();

    const wrestler = useGameStore.getState().world!.wrestlers[id]!;
    expect(wrestler.vignette).toEqual({ totalWeeks: 3, weeksRemaining: 2, startWeek });
  });

  it('pays off with a real, lasting boost when the odds are a lock', () => {
    newGame({ vignetteSuccessChance: 1, vignetteCharismaBonus: 0 });
    const id = pickRosterId();
    const before = useGameStore.getState().world!.wrestlers[id]!;
    const startWeek = useGameStore.getState().world!.week;
    const { popularity: popBefore, momentum: momentumBefore } = before;
    useGameStore.setState((s) => {
      s.world!.wrestlers[id]!.vignette = { totalWeeks: 3, weeksRemaining: 1, startWeek };
    });

    runWeek();

    const world = useGameStore.getState().world!;
    const wrestler = world.wrestlers[id]!;
    expect(wrestler.vignette).toBeFalsy();
    expect(wrestler.popularity).toBeGreaterThan(popBefore);
    expect(wrestler.momentum).toBeGreaterThanOrEqual(momentumBefore);
    expect(world.weeklyNews.some((n) => n.text.includes('debuts tonight') && n.text.includes('finally pay off'))).toBe(
      true,
    );
    expect(world.pendingGimmickReactions.some((r) => r.kind === 'debut' && r.name === wrestler.name)).toBe(true);
  });

  it('costs the wrestler nothing extra on a bust beyond the campaign never having happened', () => {
    newGame({ vignetteSuccessChance: 0, vignetteCharismaBonus: 0 });
    const id = pickRosterId();
    const before = useGameStore.getState().world!.wrestlers[id]!;
    const startWeek = useGameStore.getState().world!.week;
    const { popularity: popBefore, momentum: momentumBefore } = before;
    useGameStore.setState((s) => {
      s.world!.wrestlers[id]!.vignette = { totalWeeks: 3, weeksRemaining: 1, startWeek };
    });

    runWeek();

    const world = useGameStore.getState().world!;
    const wrestler = world.wrestlers[id]!;
    expect(wrestler.vignette).toBeFalsy();
    expect(wrestler.popularity).toBe(popBefore);
    expect(wrestler.momentum).toBe(momentumBefore);
    expect(world.weeklyNews.some((n) => n.text.includes('debuts tonight') && n.text.includes('Not much of one'))).toBe(
      true,
    );
  });
});
