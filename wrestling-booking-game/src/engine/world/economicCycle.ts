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
// currentAskingRate) — the humbler a wrestler is, the more they read the
// room and adjust what they ask for; a wrestler who thinks they're the
// exception does not.

import type { Rng } from '../rng';
import { clamp, gaussian } from '../rng';
import type { WorldSettings } from '../types';

/** One week's drift: pulled back toward neutral, then nudged by a fresh draw. */
export function tickEconomicClimate(current: number, rng: Rng, settings: WorldSettings): number {
  const reverted = current + (0 - current) * settings.economicClimateMeanReversion;
  const nudged = reverted + gaussian(rng, 0, settings.economicClimateVolatility);
  return clamp(nudged, -1, 1);
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
      return 'The whole business has gone cold. Gates are down industry-wide, and everybody in the locker room knows it — this is not a good year to be asking for a raise.';
    case 'Downturn':
      return "Business has softened across the board. Nothing dramatic, but the free-agent market is starting to notice — and some of them are noticing right along with it.";
    case 'Steady':
      return 'The wider business has settled back to normal. No tailwind, no headwind — just an ordinary market again.';
    case 'Growing':
      return 'Business is picking up industry-wide. Money is moving again, and the ones with any leverage at all can feel it.';
    case 'Boom':
      return "The whole business is red-hot right now. Every promotion in the country is spending, and free agents everywhere know exactly what that means for them.";
  }
}
