import { describe, it, expect } from 'vitest';
import { ringCallFrom, resolveRingCall } from './ringCall';
import { defaultWorldSettings } from './settings';
import { rngFromSeed } from '../rng';

const settings = defaultWorldSettings();

describe('whether the ring even raises a warning', () => {
  it('says nothing about a ring in good shape', () => {
    expect(
      ringCallFrom(rngFromSeed('fine'), 10, 'town-1', 'Mill Valley', settings.ringCallConditionFloor + 20, settings),
    ).toBeNull();
  });

  it('can raise a real warning once the ring is worn past the floor', () => {
    let raised = false;
    for (let i = 0; i < 50 && !raised; i++) {
      const call = ringCallFrom(rngFromSeed(`worn-${i}`), 10, 'town-1', 'Mill Valley', settings.ringCallConditionFloor - 10, settings);
      if (call) raised = true;
    }
    expect(raised).toBe(true);
  });

  it('carries the town name into the warning', () => {
    let call = null;
    for (let i = 0; i < 50 && !call; i++) {
      call = ringCallFrom(rngFromSeed(`text-${i}`), 10, 'town-1', 'Mill Valley', 5, settings);
    }
    expect(call!.warning).toContain('Mill Valley');
  });
});

describe('what the call cost', () => {
  const baseCall = {
    week: 10,
    territoryId: 'town-1',
    territoryName: 'Mill Valley',
    warning: 'test warning',
    strength: 'likely' as const,
    willFail: true,
  };

  it('playing it safe never runs the show, and costs morale and merch', () => {
    const outcome = resolveRingCall(baseCall, 'playItSafe', rngFromSeed('safe'), settings);
    expect(outcome.ran).toBe(false);
    expect(outcome.moraleDelta).toBeLessThan(0);
    expect(outcome.merchShare).toBeLessThan(1);
    expect(outcome.injuryMultiplier).toBe(1);
  });

  it('going nuclear always runs the show, with real extra injury danger', () => {
    const outcome = resolveRingCall(baseCall, 'goNuclear', rngFromSeed('nuclear'), settings);
    expect(outcome.ran).toBe(true);
    expect(outcome.injuryMultiplier).toBeGreaterThan(1);
  });

  it('the rating swing on going nuclear can land either direction', () => {
    const swings = new Set<boolean>();
    for (let i = 0; i < 30; i++) {
      const outcome = resolveRingCall(baseCall, 'goNuclear', rngFromSeed(`swing-${i}`), settings);
      swings.add(outcome.ratingSwing >= 0);
    }
    // Never a guaranteed pop — some of these rolls have to land negative.
    expect(swings.has(true)).toBe(true);
    expect(swings.has(false)).toBe(true);
  });

  it('every outcome carries a real line for the wire', () => {
    expect(resolveRingCall(baseCall, 'playItSafe', rngFromSeed('l1'), settings).line.length).toBeGreaterThan(0);
    expect(resolveRingCall(baseCall, 'goNuclear', rngFromSeed('l2'), settings).line.length).toBeGreaterThan(0);
  });
});
