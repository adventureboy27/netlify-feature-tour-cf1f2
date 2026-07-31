/**
 * Power registry — imports the definitions from data/, exposes them as one list plus a
 * lookup. Game code reads powers through here, never straight from data/.
 */
import { turbo, cannonball, molten, lead, cork, ghost, rest } from '../data/powers.js';

export const powers = [turbo, cannonball, molten, lead, cork, ghost, ...rest];

// Only these have hooks/stats meant to be used yet — the rest of `rest` is metadata
// waiting on M8.
export const implemented = [turbo, cannonball, molten, lead, cork, ghost];

export function getPower(id) {
  return powers.find((p) => p.id === id) ?? null;
}
