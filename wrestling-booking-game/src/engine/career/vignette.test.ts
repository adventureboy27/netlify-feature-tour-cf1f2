import { describe, expect, it } from 'vitest';
import { newVignette, resolveVignette, tickVignette, vignetteProgressLine, vignetteWeekNumber } from './vignette';
import { defaultWorldSettings } from '../world/settings';
import type { Wrestler } from '../types';

const settings = defaultWorldSettings();

function wrestler(id: string, charisma: number): Wrestler {
  return { id, name: `Wrestler ${id}`, charisma } as Wrestler;
}

describe('starting and ticking a campaign', () => {
  it('starts full, stamped with the week it began', () => {
    const v = newVignette(settings, 40);
    expect(v.totalWeeks).toBe(settings.vignetteWeeks);
    expect(v.weeksRemaining).toBe(settings.vignetteWeeks);
    expect(v.startWeek).toBe(40);
  });

  it('counts down one week at a time and clears at zero', () => {
    let v = newVignette(settings, 1);
    for (let i = 0; i < v.totalWeeks - 1; i++) {
      const next = tickVignette(v);
      expect(next).not.toBeNull();
      v = next!;
    }
    expect(v.weeksRemaining).toBe(1);
    expect(tickVignette(v)).toBeNull();
  });

  it('never leaves the campaign running past its own length', () => {
    const v = newVignette({ ...settings, vignetteWeeks: 1 }, 5);
    expect(v.weeksRemaining).toBe(1);
    expect(tickVignette(v)).toBeNull();
  });
});

describe('the week number and the shape of the flavor line', () => {
  it('reads week 1 on the week it starts and the final week right before payoff', () => {
    let v = newVignette(settings, 1);
    expect(vignetteWeekNumber(v)).toBe(1);
    expect(vignetteProgressLine(v)).toMatch(/rumors just started/);

    for (let i = 1; i < v.totalWeeks; i++) {
      v = tickVignette(v)!;
      expect(vignetteWeekNumber(v)).toBe(i + 1);
    }
    expect(vignetteWeekNumber(v)).toBe(v.totalWeeks);
    expect(vignetteProgressLine(v)).toMatch(/one more week/i);
  });

  it('reads a distinct middle line for every week that is neither first nor last', () => {
    const v = newVignette({ ...settings, vignetteWeeks: 4 }, 1);
    const midway = tickVignette(v)!; // week 2 of 4
    expect(vignetteWeekNumber(midway)).toBe(2);
    expect(vignetteProgressLine(midway)).toMatch(/cannot stop talking/);
  });
});

describe('resolving the payoff', () => {
  it('is deterministic for the same wrestler and start week', () => {
    const w = wrestler('razor', 70);
    const v = newVignette(settings, 12);
    const first = resolveVignette(w, v, settings);
    const second = resolveVignette(w, v, settings);
    expect(second).toEqual(first);
  });

  it('changes with the week the campaign started, off the same wrestler', () => {
    const w = wrestler('razor', 70);
    const results = [1, 2, 3, 4, 5, 6, 7, 8].map((week) => resolveVignette(w, newVignette(settings, week), settings));
    // Not every seed has to differ, but they cannot all land the same way —
    // otherwise the roll is not actually keyed off the start week at all.
    const distinctOutcomes = new Set(results.map((r) => r.success)).size;
    expect(distinctOutcomes).toBeGreaterThan(1);
  });

  it('gives the wrestler nothing at all on a bust — the whole risk is real', () => {
    // A hopeless roll: no charisma bonus available, and a base chance of
    // zero, so success can never happen and the bust path is guaranteed.
    const hopeless = { ...settings, vignetteSuccessChance: 0, vignetteCharismaBonus: 0 };
    const w = wrestler('bust-case', 0);
    const payoff = resolveVignette(w, newVignette(hopeless, 3), hopeless);
    expect(payoff.success).toBe(false);
    expect(payoff.popularityDelta).toBe(0);
    expect(payoff.momentumDelta).toBe(0);
  });

  it('guarantees a real, positive payoff when the odds are a lock', () => {
    const surefire = { ...settings, vignetteSuccessChance: 1, vignetteCharismaBonus: 0 };
    const w = wrestler('sure-case', 0);
    const payoff = resolveVignette(w, newVignette(surefire, 3), surefire);
    expect(payoff.success).toBe(true);
    expect(payoff.popularityDelta).toBe(surefire.vignetteSuccessPopularity);
    expect(payoff.momentumDelta).toBe(surefire.vignetteSuccessMomentum);
  });

  it('charisma genuinely moves the odds — a big star catches more often than a nobody, across many rolls', () => {
    const tight = { ...settings, vignetteSuccessChance: 0.1, vignetteCharismaBonus: 0.6 };
    const star = wrestler('star', 100);
    const nobody = wrestler('nobody', 0);
    let starHits = 0;
    let nobodyHits = 0;
    for (let week = 0; week < 200; week++) {
      if (resolveVignette(star, newVignette(tight, week), tight).success) starHits++;
      if (resolveVignette(nobody, newVignette(tight, week), tight).success) nobodyHits++;
    }
    expect(starHits).toBeGreaterThan(nobodyHits);
  });
});
