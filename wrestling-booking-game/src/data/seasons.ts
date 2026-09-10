// The year — seasons, climates and the nights that come round every twelve
// months.
//
// Everything in this game is counted in weeks, so the year is 52 of them and
// week-of-year is the only clock this file needs. Season decides what the
// weather can do; climate decides which weather a town gets at all; and the
// holiday table is the handful of weeks where the audience turns out for the
// date rather than the card.
//
// The point of all three is the same: make one week different from the next
// without the player having done anything. A promotion that runs the same
// building with the same six matches should still have a year that has a
// shape to it.

// Season and Climate live in engine/types.ts with the rest of the world's
// vocabulary; a territory carries a climate, so the type has to be reachable
// from there without data/ and engine/ importing each other in a circle.
import type { Climate, Season } from '../engine/types';

export type { Climate, Season };

export const CLIMATE_LABELS: Record<Climate, string> = {
  northern: 'Hard winters, short summers',
  coastal: 'Wet, mild, and exposed to whatever comes off the water',
  plains: 'Open country. Nothing between the town and the sky',
  desert: 'Dry heat most of the year and cold the moment the sun goes',
  mountain: 'Weather that changes its mind on the way up the pass',
  temperate: 'Four seasons and none of them extreme',
};

/** 52 weeks, four seasons. Week 1 is the first week of January. */
export const WEEKS_PER_YEAR = 52;

export function seasonForWeekOfYear(weekOfYear: number): Season {
  const w = ((weekOfYear - 1) % WEEKS_PER_YEAR) + 1;
  if (w <= 9 || w >= 49) return 'winter';
  if (w <= 22) return 'spring';
  if (w <= 35) return 'summer';
  return 'autumn';
}

export const SEASON_LABELS: Record<Season, string> = {
  winter: 'Winter',
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
};

/**
 * A night the audience turns out for regardless of what is on it.
 *
 * `draw` is a straight multiplier on attendance and `merch` on the stand —
 * people spend differently at a holiday show. `mustName` marks the ones big
 * enough that running a nameless television taping over the top of them looks
 * like an oversight.
 */
export interface Holiday {
  id: string;
  /** Week of the year, 1-52. */
  week: number;
  name: string;
  blurb: string;
  draw: number;
  merch: number;
  mustName: boolean;
}

export const HOLIDAYS: Holiday[] = [
  {
    id: 'newYear',
    week: 1,
    name: "New Year's Night",
    blurb: 'Everybody has resolutions and nobody has anywhere else to be.',
    draw: 1.14,
    merch: 1.05,
    mustName: true,
  },
  {
    id: 'sweetheart',
    week: 7,
    name: 'The Sweetheart Special',
    blurb: 'Couples in the front row and a mixed tag nobody asked for.',
    draw: 1.08,
    merch: 1.1,
    mustName: false,
  },
  {
    id: 'springBreak',
    week: 13,
    name: 'Spring Break Brawl',
    blurb: 'The students are off and looking for something loud.',
    draw: 1.12,
    merch: 1.15,
    mustName: false,
  },
  {
    id: 'summerKickoff',
    week: 22,
    name: 'The Summer Kickoff',
    blurb: 'First warm weekend of the year. The whole town is out anyway.',
    draw: 1.16,
    merch: 1.1,
    mustName: true,
  },
  {
    id: 'independence',
    week: 27,
    name: 'Independence Night',
    blurb: 'Flags, fireworks, and a crowd that wants somebody to cheat.',
    draw: 1.2,
    merch: 1.2,
    mustName: true,
  },
  {
    id: 'lastGasp',
    week: 35,
    name: 'The Last Gasp of Summer',
    blurb: 'One more before everybody goes back to work.',
    draw: 1.1,
    merch: 1.05,
    mustName: false,
  },
  {
    id: 'hallows',
    week: 44,
    name: "All Hallows' Night",
    blurb: 'Masks in the crowd for once, instead of only in the ring.',
    draw: 1.18,
    merch: 1.25,
    mustName: true,
  },
  {
    id: 'harvest',
    week: 47,
    name: 'The Harvest Show',
    blurb: 'Families in town, everybody fed, nobody wants to talk to each other.',
    draw: 1.15,
    merch: 1.08,
    mustName: false,
  },
  {
    id: 'midwinter',
    week: 51,
    name: 'Midwinter Mayhem',
    blurb: 'The one they bring the kids to. Send them home happy.',
    draw: 1.22,
    merch: 1.3,
    mustName: true,
  },
];

export function holidayForWeekOfYear(weekOfYear: number): Holiday | null {
  const w = ((weekOfYear - 1) % WEEKS_PER_YEAR) + 1;
  return HOLIDAYS.find((h) => h.week === w) ?? null;
}
