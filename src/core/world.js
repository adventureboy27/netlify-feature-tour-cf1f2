/**
 * The entire mutable game state, plain data. Nothing here is a class; hooks and physics
 * just read and write these fields directly.
 */
import { createRng } from './rng.js';

// oak, the default surface (docs/DESIGN.md surfaces table). M1 only needs oak.
export const OAK = { decel: 0.282, wallE: 0.70, viscous: 0.12 };

export function createWorld(seed) {
  return {
    seed,
    rng: createRng(seed),
    turn: 0,
    w: 1,              // board width is always 1 board-width by definition
    h: 1,              // updated by main.js to match the canvas aspect ratio
    bounds: { l: 0, r: 1, t: 0, b: 1 },
    maxSpeed: 0.95,     // board-widths/sec, docs/DESIGN.md
    surface: OAK,
    marbles: []
  };
}

export function setBoardHeight(world, h) {
  world.h = h;
  world.bounds.b = h;
}

export function addMarble(world, { x, y, r = 0.035 }) {
  const m = { x, y, px: x, py: y, vx: 0, vy: 0, r, alive: true };
  world.marbles.push(m);
  return m;
}
