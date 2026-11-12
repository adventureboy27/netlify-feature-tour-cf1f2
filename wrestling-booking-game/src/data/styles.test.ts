import { describe, expect, it } from 'vitest';
import { styleMeshScore, WRESTLING_STYLES, ALL_ROUNDER_MESH_SCORE } from './styles';

describe('styleMeshScore', () => {
  it('is symmetric for every pair of non-allRounder styles', () => {
    const styles = WRESTLING_STYLES.filter((s) => s !== 'allRounder');
    for (const a of styles) {
      for (const b of styles) {
        expect(styleMeshScore(a, b)).toBe(styleMeshScore(b, a));
      }
    }
  });

  it('stays within -12..12 for defined pairs', () => {
    const styles = WRESTLING_STYLES.filter((s) => s !== 'allRounder');
    for (const a of styles) {
      for (const b of styles) {
        const score = styleMeshScore(a, b);
        expect(score).toBeGreaterThanOrEqual(-12);
        expect(score).toBeLessThanOrEqual(12);
      }
    }
  });

  it('returns the flat score whenever allRounder is involved', () => {
    expect(styleMeshScore('allRounder', 'giant')).toBe(ALL_ROUNDER_MESH_SCORE);
    expect(styleMeshScore('bruiser', 'allRounder')).toBe(ALL_ROUNDER_MESH_SCORE);
  });

  it('matches the documented extremes from §3.5', () => {
    expect(styleMeshScore('giant', 'highFlyer')).toBe(12);
    expect(styleMeshScore('technical', 'submission')).toBe(12);
    expect(styleMeshScore('giant', 'giant')).toBe(-12);
    expect(styleMeshScore('submission', 'hardcore')).toBe(-10);
  });
});
