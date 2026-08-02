import { describe, expect, it } from 'vitest';
import { computeAttendance, computeTicketPrice, computeGate } from './attendance';

describe('computeAttendance', () => {
  it('never exceeds capacity', () => {
    const attendance = computeAttendance({
      territoryFollowing: 100,
      capacity: 2000,
      companyRating: 100,
      championPopularity: 100,
      segments: Array.from({ length: 10 }, () => ({ stars: 5, avgPopularity: 100 })),
    });
    expect(attendance).toBeLessThanOrEqual(2000);
  });

  it('increases with a stronger card', () => {
    const weak = computeAttendance({
      territoryFollowing: 50,
      capacity: 5000,
      companyRating: 50,
      championPopularity: 0,
      segments: [{ stars: 1, avgPopularity: 20 }],
    });
    const strong = computeAttendance({
      territoryFollowing: 50,
      capacity: 5000,
      companyRating: 50,
      championPopularity: 0,
      segments: [{ stars: 5, avgPopularity: 90 }],
    });
    expect(strong).toBeGreaterThan(weak);
  });

  it('is zero-ish with no reputation and an empty card', () => {
    const attendance = computeAttendance({
      territoryFollowing: 0,
      capacity: 5000,
      companyRating: 0,
      championPopularity: 0,
      segments: [],
    });
    expect(attendance).toBe(0);
  });
});

describe('computeTicketPrice', () => {
  it('matches the documented $10 full-TV / $14 full-PPV examples', () => {
    expect(computeTicketPrice(6, 4, 1)).toBe(10);
    expect(computeTicketPrice(10, 4, 1)).toBe(14);
  });
});

describe('computeGate', () => {
  it('multiplies attendance by ticket price and the territory revenue multiplier', () => {
    expect(computeGate(1000, 10, 1.2)).toBeCloseTo(12000, 5);
  });
});
