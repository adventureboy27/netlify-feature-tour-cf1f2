/**
 * The entire mutable game state, plain data. Nothing here is a class; hooks and physics
 * just read and write these fields directly.
 */
import { createRng } from './rng.js';
import { createEvents } from './events.js';
import { createTerrainStore } from '../sim/terrain.js';

// oak, the default surface (docs/DESIGN.md surfaces table). M1 only needs oak.
export const OAK = { decel: 0.282, wallE: 0.70, viscous: 0.12 };

// colour is a place, not decoration or health (docs/DESIGN.md) — the set of colours a
// patch can be, and that roulette condemns one of.
export const PALETTE = ['crimson', 'gold', 'teal', 'violet'];

export function createWorld(seed) {
  return {
    seed,
    rng: createRng(seed),
    events: createEvents(),
    time: 0,
    turn: 0,
    w: 1,              // board width is always 1 board-width by definition
    h: 1,              // updated by main.js to match the canvas aspect ratio
    bounds: { l: 0, r: 1, t: 0, b: 1 },
    rails: true,        // an environment (sumo) can turn these off entirely
    disc: null,         // set by environments that replace the rectangle with a circle
    maxSpeed: 0.95,     // board-widths/sec, docs/DESIGN.md
    ballE: 0.94,        // marble-on-marble restitution, docs/DESIGN.md
    surface: OAK,
    palette: PALETTE,
    terrain: createTerrainStore(),
    environment: null,
    marbles: [],
    winner: null
  };
}

export function setBoardHeight(world, h) {
  world.h = h;
  world.bounds.b = h;
}

export function addMarble(world, { x, y, r = 0.035, isPlayer = false }) {
  const m = {
    x, y, px: x, py: y, vx: 0, vy: 0, r,
    mass: 1, alive: true, isPlayer, lethalCause: null, colour: 'bare'
  };
  world.marbles.push(m);
  return m;
}
