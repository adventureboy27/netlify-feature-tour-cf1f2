// The wrestling business's own economy — a real boom-and-bust cycle sitting
// underneath everything a promotion does, separate from any one company's
// own fortunes. Company rating says how good this promotion is. This says
// how good a year it is to be in the business at all.
//
// A mean-reverting random walk (an Ornstein-Uhlenbeck process, the standard
// way to model a real economic cycle) rather than a fixed-period sine wave:
// it wanders, and how far it has wandered pulls it back, so an up-cycle or a
// down-cycle holds for a real stretch — months, sometimes the better part of
// a year — before reverting, without ever being on a predictable clock a
// player could set a watch by. World.economicClimate is the value, -1 (deep
// recession) to +1 (boom), 0 neutral.
//
// Read today by free-agent asking rates (see engine/world/freeAgents.ts's
// currentAskingRate) — asymmetrically, on purpose. A downturn is read by
// humility: a humble wrestler settles for real money less, a max-ego one
// does not move an inch. A boom is read by ego instead: everybody's price
// drifts up a little because the market genuinely got better, but a
// high-ego wrestler leverages a hot market hard and wants a bigger piece of
// it than the market alone would give them — stubborn on the way down,
// opportunistic on the way up.

import type { Rng } from '../rng';
import { clamp, gaussian } from '../rng';
import type { WorldSettings } from '../types';

/** One week's drift: pulled back toward neutral, then nudged by a fresh draw. */
export function tickEconomicClimate(current: number, rng: Rng, settings: WorldSettings): number {
  const reverted = current + (0 - current) * settings.economicClimateMeanReversion;
  const nudged = reverted + gaussian(rng, 0, settings.economicClimateVolatility);
  return clamp(nudged, -1, 1);
}

/**
 * A single week's move big enough to be a real outlier against the settings'
 * own week-to-week spread, not just an ordinary wobble. Reported separately
 * from the label crossing above — a run of small steps can cross a label
 * quietly, but a real one-week lurch is worth a warning on its own even if
 * it doesn't cross a line, and a label crossing that landed via a run of
 * small steps doesn't need one.
 */
export function isSharpEconomicMove(before: number, after: number, settings: WorldSettings): boolean {
  return Math.abs(after - before) >= settings.climateSharpMoveThreshold;
}

/** The recap-page warning for a real one-week lurch — reported as Breaking News, not folded into the ordinary feed. */
export function economicClimateSharpMoveLine(before: number, after: number): string {
  return after > before
    ? "The wider business just had a real jump — a one-week swing far bigger than the usual drift. Whatever's behind it, the whole market felt it at once."
    : "The wider business just took a real hit — a one-week drop far bigger than the usual drift. Whatever caused it, the whole market felt it at once.";
}

export type EconomicClimateLabel = 'Recession' | 'Downturn' | 'Steady' | 'Growing' | 'Boom';

/**
 * Words, not a number — same as everything else the player reads. Boundaries
 * are tuned against the settings' own stationary spread (see settings.ts's
 * comment on economicClimateVolatility): "Steady" is the common case, a mild
 * "Downturn"/"Growing" is a real minority of weeks, and "Recession"/"Boom"
 * are genuinely rare.
 */
export function economicClimateLabel(climate: number): EconomicClimateLabel {
  if (climate <= -0.35) return 'Recession';
  if (climate <= -0.12) return 'Downturn';
  if (climate < 0.12) return 'Steady';
  if (climate < 0.35) return 'Growing';
  return 'Boom';
}

/** One sentence for the wire, said only when the label actually changes — not every week's wobble. */
export function economicClimateShiftLine(label: EconomicClimateLabel): string {
  switch (label) {
    case 'Recession':
      return "The whole business has gone cold. Gates are down across the board, and everybody in the locker room knows it — this is not the year to ask for a raise.";
    case 'Downturn':
      return "Business has cooled off some. Nothing dramatic yet, but free agents are starting to feel it.";
    case 'Steady':
      return "The wider business has settled back to normal — no tailwind, no headwind, just an ordinary market.";
    case 'Growing':
      return "Business is picking up. Money's moving again, and anyone with real leverage can feel it.";
    case 'Boom':
      return "The whole business is red-hot right now. Every promotion in the country is spending, and free agents everywhere know exactly what that means for them.";
  }
}
