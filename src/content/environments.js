/**
 * Environment registry — imports the definitions from data/, exposes them as one list plus
 * a lookup. Game code (main.js, eventually level grammar) reads environments through here,
 * never straight from data/.
 */
import {
  closing, sumo, roulette, rot, flow, sinkhole, tide,
  crumble, fault, freeze, ashfall, rust, split, magnet, tilt, scorch, carousel,
  pinball, shatter, grinder, blackout, quicksand, meteor, conveyor, windstorm, vice,
  rest
} from '../data/environments.js';

export const environments = [
  closing, sumo, roulette, rot, flow, sinkhole, tide,
  crumble, fault, freeze, ashfall, rust, split, magnet, tilt, scorch, carousel,
  pinball, shatter, grinder, blackout, quicksand, meteor, conveyor, windstorm, vice,
  ...rest
];

// All 26 have hooks now (M8 finished the last 19) — `rest` stays as the landing spot for
// anything added later.
export const implemented = environments.slice(0, environments.length - rest.length);

export function getEnvironment(id) {
  return environments.find((e) => e.id === id) ?? null;
}
