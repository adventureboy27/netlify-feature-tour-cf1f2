import { describe, it, expect } from 'vitest';
import { buildRatingsChart, playerChartPosition, computeTvRatings } from './tvRatings';
import { NETWORK_SHOWS } from '../../data/networkShows';
import { defaultWorldSettings } from './settings';
import { rngFromSeed } from '../rng';

const settings = defaultWorldSettings();

function chart(playerShowRating: number, playerCompanyRating: number, seed = 'chart') {
  const rng = rngFromSeed(seed);
  const wrestling = computeTvRatings(
    [
      { promotionId: 'you', showRating: playerShowRating, companyRating: playerCompanyRating, broadcast: true },
      { promotionId: 'r1', showRating: 60, companyRating: 70, broadcast: true },
      { promotionId: 'r2', showRating: 45, companyRating: 40, broadcast: true },
    ],
    settings,
  );
  return buildRatingsChart({
    wrestling,
    playerPromotionId: 'you',
    promotionName: (id) => (id === 'you' ? 'Your Promotion' : `Rival ${id}`),
    networkShows: NETWORK_SHOWS,
    next: () => rng.next(),
  });
}

describe('the network shows', () => {
  it('are period-plausible inventions, not real programmes', () => {
    expect(NETWORK_SHOWS.length).toBeGreaterThanOrEqual(15);
    for (const show of NETWORK_SHOWS) {
      expect(show.name.length).toBeGreaterThan(0);
      expect(show.network.length).toBeGreaterThan(0);
      expect(show.baseRating).toBeGreaterThan(0);
      expect(show.volatility).toBeGreaterThanOrEqual(0);
    }
  });

  it('span the chart from a hit down to filler', () => {
    const ratings = NETWORK_SHOWS.map((s) => s.baseRating);
    expect(Math.max(...ratings)).toBeGreaterThan(18);
    expect(Math.min(...ratings)).toBeLessThan(5);
  });

  it('makes a news programme steadier than a movie of the week', () => {
    const news = NETWORK_SHOWS.find((s) => s.genre === 'news')!;
    const movie = NETWORK_SHOWS.find((s) => s.genre === 'movie')!;
    expect(movie.volatility).toBeGreaterThan(news.volatility);
  });
});

describe('the weekly chart', () => {
  it('carries every wrestling show and every network programme', () => {
    const rows = chart(70, 60);
    expect(rows).toHaveLength(3 + NETWORK_SHOWS.length);
    expect(rows.filter((r) => r.kind === 'yours')).toHaveLength(1);
    expect(rows.filter((r) => r.kind === 'rivalWrestling')).toHaveLength(2);
  });

  it('ranks strictly downward from number one', () => {
    const rows = chart(70, 60);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.rank).toBe(i + 1);
      expect(rows[i]!.rating).toBeLessThanOrEqual(rows[i - 1]!.rating);
    }
    expect(rows[0]!.rank).toBe(1);
  });

  it('puts wrestling among the rest of television, not in its own list', () => {
    const rows = chart(70, 60);
    const player = playerChartPosition(rows)!;
    // The point of the whole feature: you finish somewhere on television, and
    // there is network programming above and below you.
    expect(player.rank).toBeGreaterThan(1);
    expect(rows.slice(0, player.rank - 1).some((r) => r.kind === 'network')).toBe(true);
  });

  it('moves you up the chart when your show is better', () => {
    const bad = playerChartPosition(chart(10, 25))!;
    const good = playerChartPosition(chart(95, 95))!;
    expect(good.rank).toBeLessThan(bad.rank);
    expect(good.rating).toBeGreaterThan(bad.rating);
  });

  it('replays identically for the same week', () => {
    expect(chart(70, 60, 'same')).toEqual(chart(70, 60, 'same'));
  });

  it('moves the network shows week to week, so a finale can beat you', () => {
    const a = chart(70, 60, 'week-a').filter((r) => r.kind === 'network');
    const b = chart(70, 60, 'week-b').filter((r) => r.kind === 'network');
    const differs = a.some((row, i) => row.rating !== b[i]?.rating);
    expect(differs).toBe(true);
  });

  it('keeps the wobble centred, so a base rating is what a show usually does', () => {
    const show = NETWORK_SHOWS.find((s) => s.id === 'ns-oilbarons')!;
    let total = 0;
    const samples = 200;
    for (let i = 0; i < samples; i++) {
      const rows = chart(50, 50, `sample-${i}`);
      total += rows.find((r) => r.name === show.name)!.rating;
    }
    expect(total / samples).toBeCloseTo(show.baseRating, 0);
  });

  it('never produces a negative rating', () => {
    for (const row of chart(0, 0)) expect(row.rating).toBeGreaterThanOrEqual(0);
  });
});
