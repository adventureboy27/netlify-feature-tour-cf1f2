import { describe, it, expect } from 'vitest';
import { computeAftermath, applyAftermath, restWeek } from './aftermath';
import { defaultWorldSettings } from '../world/settings';
import { rngFromSeed } from '../rng';
import { generateWrestlers } from '../generate/wrestler';
import { stipulationById } from '../../data/stipulations';
import type { Wrestler } from '../types';

const settings = defaultWorldSettings();

function pair(): [Wrestler, Wrestler] {
  const [a, b] = generateWrestlers(rngFromSeed('aftermath'), 2, { currentYear: 1985 });
  return [
    { ...a!, momentum: 50, popularity: 60, health: 100, energy: 100, careerHighPopularity: 60 },
    { ...b!, momentum: 50, popularity: 60, health: 100, energy: 100, careerHighPopularity: 60 },
  ];
}

function run(overrides: Partial<Parameters<typeof computeAftermath>[0]> = {}) {
  const [a, b] = pair();
  return computeAftermath({
    participants: [a, b],
    winnerIds: [a.id],
    finish: 'cleanPin',
    rating: 55,
    stipulation: null,
    isMainEvent: false,
    settings,
    ...overrides,
  });
}

describe('what a win is worth', () => {
  it('moves momentum up for the winner and down for the loser', () => {
    const [winner, loser] = run();
    expect(winner!.momentum).toBeGreaterThan(0);
    expect(loser!.momentum).toBeLessThan(0);
  });

  it('costs less to lose than it gains to win, but not much less', () => {
    const [winner, loser] = run();
    expect(Math.abs(loser!.momentum)).toBeLessThan(winner!.momentum);
    expect(Math.abs(loser!.momentum)).toBeGreaterThan(winner!.momentum * 0.5);
  });

  it('treats a draw as barely anything', () => {
    const [a, b] = run({ winnerIds: [], finish: 'timeLimitDraw' });
    expect(a!.outcome).toBe('draw');
    expect(Math.abs(a!.momentum)).toBeLessThan(settings.momentumPerLoss);
    expect(a!.momentum).toBe(b!.momentum);
  });

  it('amplifies everything in the main event', () => {
    const [normal] = run();
    const [main] = run({ isMainEvent: true });
    expect(main!.momentum).toBeGreaterThan(normal!.momentum);
  });
});

describe('what the match itself is worth', () => {
  it('makes both people when the match was great', () => {
    const [winner, loser] = run({ rating: 90 });
    expect(winner!.popularity).toBeGreaterThan(0);
    // The whole point of a strong loss: the beaten man still went up.
    expect(loser!.popularity).toBeGreaterThan(0);
  });

  it('costs both people when the match was a stinker', () => {
    const [winner, loser] = run({ rating: 15 });
    expect(loser!.popularity).toBeLessThan(0);
    expect(winner!.popularity).toBeLessThan(settings.popularityPerWin);
  });

  it('moves popularity slowly — a career is not made in one night', () => {
    const [winner] = run({ rating: 100, isMainEvent: true });
    expect(winner!.popularity).toBeLessThan(4);
  });
});

describe('the physical cost', () => {
  it('takes something out of everybody, win or lose', () => {
    const [winner, loser] = run();
    expect(winner!.health).toBeLessThan(0);
    expect(loser!.health).toBeLessThan(0);
  });

  it('costs more in a violent stipulation', () => {
    const [plain] = run();
    const [deathmatch] = run({ stipulation: stipulationById('flamingTables') ?? null });
    expect(deathmatch!.health).toBeLessThan(plain!.health);
  });
});

describe('applying it', () => {
  it('keeps a win/loss record', () => {
    const [a, b] = pair();
    const changes = computeAftermath({
      participants: [a, b],
      winnerIds: [a.id],
      finish: 'cleanPin',
      rating: 70,
      stipulation: null,
      isMainEvent: false,
      settings,
    });
    applyAftermath(a, changes[0]!, settings);
    applyAftermath(b, changes[1]!, settings);

    expect(a.record).toEqual({ wins: 1, losses: 0, draws: 0 });
    expect(b.record).toEqual({ wins: 0, losses: 1, draws: 0 });
    expect(a.consecutiveWeeksWorked).toBe(1);
  });

  it('tracks a new career high', () => {
    const [a, b] = pair();
    const [change] = computeAftermath({
      participants: [a, b],
      winnerIds: [a.id],
      finish: 'cleanPin',
      rating: 95,
      stipulation: null,
      isMainEvent: true,
      settings,
    });
    applyAftermath(a, change!, settings);
    expect(a.careerHighPopularity).toBe(a.popularity);
  });

  it('never pushes anybody outside 0-100', () => {
    const [a, b] = pair();
    a.momentum = 99;
    a.health = 2;
    const [change] = computeAftermath({
      participants: [a, b],
      winnerIds: [a.id],
      finish: 'cleanPin',
      rating: 95,
      stipulation: null,
      isMainEvent: true,
      settings,
    });
    applyAftermath(a, change!, settings);
    expect(a.momentum).toBeLessThanOrEqual(100);
    expect(a.health).toBeGreaterThanOrEqual(0);
  });
});

describe('the week off', () => {
  it('heals somebody who did not work', () => {
    const [a] = pair();
    a.health = 50;
    restWeek(a, false, settings);
    expect(a.health).toBeGreaterThan(50);
  });

  it('heals nobody who did work', () => {
    const [a] = pair();
    a.health = 50;
    restWeek(a, true, settings);
    expect(a.health).toBe(50);
  });

  it('bleeds momentum back toward the middle of the card, from either side', () => {
    const [hot] = pair();
    const [cold] = pair();
    hot.momentum = 95;
    cold.momentum = 10;
    restWeek(hot, false, settings);
    restWeek(cold, false, settings);
    expect(hot.momentum).toBeLessThan(95);
    expect(cold.momentum).toBeGreaterThan(10);
  });
});
