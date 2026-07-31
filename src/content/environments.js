/**
 * Environment registry — imports the definitions from data/, exposes them as one list plus
 * a lookup. Game code (main.js, eventually level grammar) reads environments through here,
 * never straight from data/.
 */
import { closing, sumo, roulette, rot, flow, sinkhole, tide, rest } from '../data/environments.js';

export const environments = [closing, sumo, roulette, rot, flow, sinkhole, tide, ...rest];

// Only these have hooks yet — the rest of `rest` is metadata waiting on M8.
export const implemented = [closing, sumo, roulette, rot, flow, sinkhole, tide];

export function getEnvironment(id) {
  return environments.find((e) => e.id === id) ?? null;
}
