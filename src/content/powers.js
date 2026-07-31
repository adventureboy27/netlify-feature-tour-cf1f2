/**
 * Power registry — imports the definitions from data/, exposes them as one list plus a
 * lookup. Game code reads powers through here, never straight from data/.
 */
import {
  turbo, cannonball, molten, lead, cork, ghost,
  hollow, magnetic, repulsor, sticky, english, splitshot, greased, feather, nitro,
  rewind, bomb, anchor, blink, drill, frost, siphon, boomerang, shield, comet, shockwave,
  rest
} from '../data/powers.js';

export const powers = [
  turbo, cannonball, molten, lead, cork, ghost,
  hollow, magnetic, repulsor, sticky, english, splitshot, greased, feather, nitro,
  rewind, bomb, anchor, blink, drill, frost, siphon, boomerang, shield, comet, shockwave,
  ...rest
];

// All 26 have hooks/stats now (M8 finished the last 20) — `rest` stays as the landing spot
// for anything added later.
export const implemented = powers.slice(0, powers.length - rest.length);

export function getPower(id) {
  return powers.find((p) => p.id === id) ?? null;
}
