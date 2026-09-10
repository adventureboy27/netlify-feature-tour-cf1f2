// Odds as words — booking-game-design.md §13.
//
// Locked design decision: "Odds are shown as words, never percentages.
// 'Heavy favorite,' not 78%. Numbers turn booking into arithmetic." The
// engine computes probabilities to four decimal places and this is the only
// thing the UI is ever allowed to render from them.
//
// The bands are the §13 table verbatim. They start at 0.08 and end at 0.92
// because that is the hard clamp on win probability (WorldSettings
// oddsClampMin/Max) — no lever combination produces a certainty, so no band
// above "heavy favorite" is reachable and none is defined.

export type OddsLabel =
  | 'Long shot'
  | 'Underdog'
  | 'Slight edge against'
  | 'Dead even'
  | 'Slight edge'
  | 'Favored'
  | 'Heavy favorite';

// Upper bound of each band, inclusive. §13's table is written in hundredths,
// so a probability is compared at that precision.
const BANDS: [maxProbability: number, label: OddsLabel][] = [
  [0.2, 'Long shot'],
  [0.35, 'Underdog'],
  [0.46, 'Slight edge against'],
  [0.53, 'Dead even'],
  [0.64, 'Slight edge'],
  [0.79, 'Favored'],
  [1, 'Heavy favorite'],
];

/** The word for one side's win probability (0-1). */
export function oddsLabel(probability: number): OddsLabel {
  const hundredths = Math.round(probability * 100) / 100;
  for (const [max, label] of BANDS) {
    if (hundredths <= max) return label;
  }
  return 'Heavy favorite';
}

/**
 * How lopsided a match reads, ignoring which side is ahead. Used to sort or
 * flag a card without revealing a direction — a booker glancing at six
 * segments wants to see "three of these are squashes" at once.
 */
export function isCompetitive(probability: number): boolean {
  const label = oddsLabel(probability);
  return label === 'Dead even' || label === 'Slight edge' || label === 'Slight edge against';
}
