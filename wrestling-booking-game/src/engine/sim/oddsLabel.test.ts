import { describe, it, expect } from 'vitest';
import { oddsLabel, isCompetitive } from './oddsLabel';
import { defaultWorldSettings } from '../world/settings';

describe('oddsLabel', () => {
  it('matches every boundary in the §13 table', () => {
    expect(oddsLabel(0.08)).toBe('Long shot');
    expect(oddsLabel(0.2)).toBe('Long shot');
    expect(oddsLabel(0.21)).toBe('Underdog');
    expect(oddsLabel(0.35)).toBe('Underdog');
    expect(oddsLabel(0.36)).toBe('Slight edge against');
    expect(oddsLabel(0.46)).toBe('Slight edge against');
    expect(oddsLabel(0.47)).toBe('Dead even');
    expect(oddsLabel(0.53)).toBe('Dead even');
    expect(oddsLabel(0.54)).toBe('Slight edge');
    expect(oddsLabel(0.64)).toBe('Slight edge');
    expect(oddsLabel(0.65)).toBe('Favored');
    expect(oddsLabel(0.79)).toBe('Favored');
    expect(oddsLabel(0.8)).toBe('Heavy favorite');
    expect(oddsLabel(0.92)).toBe('Heavy favorite');
  });

  it('covers the whole clamped range, so no probability is unlabelled', () => {
    const { oddsClampMin, oddsClampMax } = defaultWorldSettings();
    for (let p = oddsClampMin; p <= oddsClampMax; p += 0.001) {
      expect(oddsLabel(p)).toBeTruthy();
    }
  });

  it('reads a match the same from both corners', () => {
    // A "long shot" on one side has to be a "heavy favorite" on the other,
    // or the card builder would contradict itself between two rows.
    const mirrored: [number, string, string][] = [
      [0.15, 'Long shot', 'Heavy favorite'],
      [0.3, 'Underdog', 'Favored'],
      [0.42, 'Slight edge against', 'Slight edge'],
      [0.5, 'Dead even', 'Dead even'],
    ];
    for (const [p, near, far] of mirrored) {
      expect(oddsLabel(p)).toBe(near);
      expect(oddsLabel(1 - p)).toBe(far);
    }
  });

  it('is monotonic — more probability never reads as worse odds', () => {
    const order = [
      'Long shot',
      'Underdog',
      'Slight edge against',
      'Dead even',
      'Slight edge',
      'Favored',
      'Heavy favorite',
    ];
    let previous = -1;
    for (let p = 0; p <= 1.0001; p += 0.005) {
      const rank = order.indexOf(oddsLabel(p));
      expect(rank).toBeGreaterThanOrEqual(previous);
      previous = rank;
    }
  });
});

describe('isCompetitive', () => {
  it('counts only the three bands either side of even', () => {
    expect(isCompetitive(0.5)).toBe(true);
    expect(isCompetitive(0.4)).toBe(true);
    expect(isCompetitive(0.6)).toBe(true);
    expect(isCompetitive(0.75)).toBe(false);
    expect(isCompetitive(0.15)).toBe(false);
  });
});
