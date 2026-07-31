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

// `rng` lets a caller (content/levels.js) pass in an RNG that's already drawn from — the
// level grammar picks environment/power/surface off the front of the same seeded stream
// that terrain generation and CPU aim continue from, so "a level is a seed" holds for
// everything, not just the terrain.
export function createWorld(seed, { rng } = {}) {
  return {
    seed,
    rng: rng ?? createRng(seed),
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
    power: null,
    marbles: [],
    winner: null
  };
}

export function setBoardHeight(world, h) {
  world.h = h;
  world.bounds.b = h;
}

// mass/decelMul/launchMul/wallE/ballE come from the active power's `stats`, resolved once
// by main.js at level start — see content/powers.js. wallE/ballE are `null` (not 1) by
// default because they're effective-value overrides, not multipliers: null means "fall back
// to the surface's / world's own default," where 1 would mean "force it to exactly 1.0."
export function addMarble(world, {
  x, y, r = 0.035, isPlayer = false, number = null,
  mass = 1, decelMul = 1, launchMul = 1, wallE = null, ballE = null
}) {
  const m = {
    x, y, px: x, py: y, vx: 0, vy: 0, r,
    mass, alive: true, isPlayer, number, lethalCause: null, diedAtTurn: null, colour: 'bare',
    decelMul, launchMul, wallE, ballE,
    // damage is core sim state, not content (sim/damage.js) — always present, always starts
    // clean, since a level recreates every marble from scratch (docs/CLAUDE.md: damage does
    // not carry between levels)
    damage: 0, topSpeed: 0
  };
  world.marbles.push(m);
  return m;
}
