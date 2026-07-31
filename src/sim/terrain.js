/**
 * Terrain: holes, lava, water, fissures, craters, ramps, domes, bumpers, gutters, ice
 * patches, colour patches, scorch marks — plus a seeded generator that scatters the
 * non-lethal ones across a board.
 *
 * `world.terrain` is a stateful store with a method per feature (`world.terrain.addHole(...)`,
 * `world.terrain.patchAt(x, y)`, etc.) — that's the calling convention the fully-implemented
 * exemplars in data/environments.js and data/powers.js (roulette, molten) already use. The
 * module-level functions below (`addHole(world, opts)`, etc.) are thin wrappers over those
 * methods so `import { addHole, ... } from '../sim/terrain.js'` — exactly what
 * data/environments.js imports — keeps working once M6 wires environments in.
 *
 * Lethal terrain never kills directly: it only ever sets `marble.lethalCause`. sim/rules.js
 * turns that into an actual elimination at RESOLVE.
 */

export function createTerrainStore() {
  return {
    holes: [], lavas: [], fissures: [], craters: [], ramps: [], domes: [],
    bumpers: [], gutters: [], icePatches: [], conveyors: [], colourPatches: [],
    scorches: [], water: null,

    addHole({ x, y, r }) { const f = { x, y, r }; this.holes.push(f); return f; },
    addLava({ x, y, r }) { const f = { x, y, r }; this.lavas.push(f); return f; },
    growLava(lava, amount) { lava.r += amount; },
    addBumper({ x, y, r, restitution = 1.3 }) {
      const f = { x, y, r, restitution }; this.bumpers.push(f); return f;
    },
    addIcePatch({ x, y, r, decel = 0.170, viscous = 0.07 }) {
      const f = { x, y, r, decel, viscous }; this.icePatches.push(f); return f;
    },
    addCrater({ x, y, r, strength = 0.6 }) {
      const f = { x, y, r, strength }; this.craters.push(f); return f;
    },
    setWaterLine({ edge = 'l', level = 0 }) { this.water = { edge, level }; },
    addFissure({ x1, y1, x2, y2, width = 0.02 }) {
      const f = { x1, y1, x2, y2, width }; this.fissures.push(f); return f;
    },
    addConveyor({ x, y, w, h, vx = 0, vy = 0 }) {
      const f = { x, y, w, h, vx, vy }; this.conveyors.push(f); return f;
    },
    addRamp({ x, y, r, dirX, dirY, strength = 0.5 }) {
      const len = Math.hypot(dirX, dirY) || 1;
      const f = { x, y, r, dirX: dirX / len, dirY: dirY / len, strength };
      this.ramps.push(f); return f;
    },
    addDome({ x, y, r }) { const f = { x, y, r }; this.domes.push(f); return f; },
    addGutter({ x, y, r, captureSpeed = 0.08 }) {
      const f = { x, y, r, captureSpeed }; this.gutters.push(f); return f;
    },
    addColourPatch({ x, y, r, colour }) {
      const f = { x, y, r, colour }; this.colourPatches.push(f); return f;
    },
    addScorch({ x, y, r, armsOnTurn, source }) {
      const f = { x, y, r, armsOnTurn, source }; this.scorches.push(f); return f;
    },
    patchAt(x, y) {
      for (const p of this.colourPatches) {
        if (Math.hypot(x - p.x, y - p.y) <= p.r) return p;
      }
      return null;
    }
  };
}

/* ------------------------------------------------------------------ */
/* Module-level wrappers — the exact names data/environments.js imports */
/* ------------------------------------------------------------------ */

export function addHole(world, opts) { return world.terrain.addHole(opts); }
export function addLava(world, opts) { return world.terrain.addLava(opts); }
export function growLava(lava, amount) { lava.r += amount; }

// bite is a fraction of the board width, applied to every side each call (docs/DESIGN.md:
// "4% of the original board per side per turn").
export function shrinkRails(world, bite) {
  const dx = bite * world.w;
  const dy = bite * world.w;
  world.bounds.l += dx; world.bounds.r -= dx;
  world.bounds.t += dy; world.bounds.b -= dy;
}

export function addBumper(world, opts) { return world.terrain.addBumper(opts); }
export function addIcePatch(world, opts) { return world.terrain.addIcePatch(opts); }
export function addCrater(world, opts) { return world.terrain.addCrater(opts); }
export function setWaterLine(world, opts) { return world.terrain.setWaterLine(opts); }
export function addFissure(world, opts) { return world.terrain.addFissure(opts); }
export function addConveyor(world, opts) { return world.terrain.addConveyor(opts); }

/* ------------------------------------------------------------------ */
/* Per-tick interactions, called from sim/physics.js                   */
/* ------------------------------------------------------------------ */

const CONVEYOR_ACCEL = 1.0;

export function applyTerrainForces(world, dt) {
  const t = world.terrain;
  for (const m of world.marbles) {
    if (!m.alive || m.lethalCause) continue;
    applyRamps(m, t.ramps, dt);
    applyCraters(m, t.craters, dt);
    applyConveyors(m, t.conveyors, dt);
    applyGutters(m, t.gutters, dt);
  }
}

function applyRamps(m, ramps, dt) {
  for (const r of ramps) {
    if (Math.hypot(m.x - r.x, m.y - r.y) > r.r) continue;
    m.vx += r.dirX * r.strength * dt;
    m.vy += r.dirY * r.strength * dt;
  }
}

function applyCraters(m, craters, dt) {
  for (const c of craters) {
    const dx = c.x - m.x, dy = c.y - m.y;
    const d = Math.hypot(dx, dy);
    if (d > c.r || d < 1e-6) continue;
    m.vx += (dx / d) * c.strength * dt;
    m.vy += (dy / d) * c.strength * dt;
  }
}

function applyConveyors(m, conveyors, dt) {
  for (const c of conveyors) {
    if (Math.abs(m.x - c.x) > c.w / 2 || Math.abs(m.y - c.y) > c.h / 2) continue;
    m.vx += c.vx * CONVEYOR_ACCEL * dt;
    m.vy += c.vy * CONVEYOR_ACCEL * dt;
  }
}

function applyGutters(m, gutters, dt) {
  for (const g of gutters) {
    const dx = g.x - m.x, dy = g.y - m.y;
    const d = Math.hypot(dx, dy);
    if (d > g.r || d < 1e-6) continue;
    const speed = Math.hypot(m.vx, m.vy);
    if (speed >= g.captureSpeed) continue;
    const pull = g.captureSpeed * 2 * dt;
    m.vx += (dx / d) * pull;
    m.vy += (dy / d) * pull;
  }
}

// Domes and bumpers are solid circular obstacles: same reflect-about-normal bounce as a
// wall, just against a circle. Domes use the surface's own wallE (a plain bump); bumpers
// carry their own restitution, usually > 1 — a real pinball kick.
export function resolveTerrainObstacles(world) {
  if (world.power?.passThroughTerrain) return;
  const { domes, bumpers } = world.terrain;
  const wallE = world.surface.wallE;
  for (const m of world.marbles) {
    if (!m.alive || m.lethalCause) continue;
    for (const d of domes) {
      const force = bounceOffObstacle(m, d, wallE);
      if (force > 0) world.events.emit('impact', { kind: 'dome', force, x: m.x, y: m.y });
    }
    for (const b of bumpers) {
      const force = bounceOffObstacle(m, b, b.restitution);
      if (force > 0) world.events.emit('impact', { kind: 'bumper', force, x: m.x, y: m.y });
    }
  }
}

// Returns the impact force (magnitude of incoming normal velocity), or 0 if there was no
// collision to report — lets callers emit an 'impact' event with a sensible force value.
function bounceOffObstacle(m, obstacle, restitution) {
  const dx = m.x - obstacle.x;
  const dy = m.y - obstacle.y;
  const dist = Math.hypot(dx, dy);
  const minDist = m.r + obstacle.r;
  if (dist === 0 || dist >= minDist) return 0;

  const nx = dx / dist, ny = dy / dist;
  const overlap = minDist - dist;
  m.x += nx * overlap;
  m.y += ny * overlap;

  const vn = m.vx * nx + m.vy * ny;
  if (vn >= 0) return 0; // already moving away
  m.vx -= (1 + restitution) * vn * nx;
  m.vy -= (1 + restitution) * vn * ny;
  return Math.abs(vn);
}

export function decelOverrideAt(world, x, y) {
  for (const p of world.terrain.icePatches) {
    if (Math.hypot(x - p.x, y - p.y) <= p.r) return { decel: p.decel, viscous: p.viscous };
  }
  return null;
}

// Flags lethalCause; never sets alive = false. sim/rules.js owns the actual elimination.
// A condemned marble is falling, not rolling — it freezes in place rather than sliding on.
export function checkHazards(world) {
  const t = world.terrain;
  for (const m of world.marbles) {
    if (!m.alive || m.lethalCause) continue;
    if (t.holes.some(h => Math.hypot(m.x - h.x, m.y - h.y) < h.r)) m.lethalCause = 'fell';
    else if (t.lavas.some(l => Math.hypot(m.x - l.x, m.y - l.y) < l.r)) m.lethalCause = 'burned';
    else if (t.fissures.some(f => distToSegment(m.x, m.y, f.x1, f.y1, f.x2, f.y2) < f.width / 2)) m.lethalCause = 'fell';
    else if (isSubmerged(world, m)) m.lethalCause = 'drowned';
    else if (t.scorches.some(s => world.turn >= s.armsOnTurn && Math.hypot(m.x - s.x, m.y - s.y) < s.r)) m.lethalCause = 'burned';

    if (m.lethalCause) { m.vx = 0; m.vy = 0; }
  }
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function isSubmerged(world, m) {
  const w = world.terrain.water;
  if (!w) return false;
  switch (w.edge) {
    case 'l': return m.x < world.bounds.l + w.level * world.w;
    case 'r': return m.x > world.bounds.r - w.level * world.w;
    case 't': return m.y < world.bounds.t + w.level * world.h;
    case 'b': return m.y > world.bounds.b - w.level * world.h;
    default: return false;
  }
}

// Colour is a place: a marble at rest takes the colour of the patch underneath it, or
// 'bare' if there isn't one. Called from turn.js at SETTLE.
export function assignRestColours(world) {
  for (const m of world.marbles) {
    if (!m.alive) continue;
    const patch = world.terrain.patchAt(m.x, m.y);
    m.colour = patch ? patch.colour : 'bare';
  }
}

/* ------------------------------------------------------------------ */
/* Board generator — the M3 deliverable: "boards feel authored,        */
/* not random." Scatters non-lethal terrain only; lethal terrain is    */
/* always environment-driven (non-negotiable #1), added in M6.         */
/* ------------------------------------------------------------------ */

export function generateTerrain(world, avoidPoints = []) {
  const margin = 0.08;
  const minSpacing = 0.12;
  const placed = avoidPoints.map(p => ({ x: p.x, y: p.y }));

  function place() {
    for (let attempt = 0; attempt < 30; attempt++) {
      const x = world.rng.range(world.bounds.l + margin, world.bounds.r - margin);
      const y = world.rng.range(world.bounds.t + margin, world.bounds.b - margin);
      if (placed.every(p => Math.hypot(x - p.x, y - p.y) >= minSpacing)) {
        placed.push({ x, y });
        return { x, y };
      }
    }
    return null;
  }

  for (let i = 0; i < 3; i++) {
    const spot = place();
    if (spot) world.terrain.addColourPatch({ ...spot, r: 0.05, colour: world.rng.pick(world.palette) });
  }
  for (let i = 0; i < 2; i++) {
    const spot = place();
    if (spot) world.terrain.addIcePatch({ ...spot, r: 0.06 });
  }
  for (let i = 0; i < 2; i++) {
    const spot = place();
    if (spot) world.terrain.addBumper({ ...spot, r: 0.025 });
  }
  {
    const spot = place();
    if (spot) {
      const angle = world.rng.range(0, Math.PI * 2);
      world.terrain.addRamp({ ...spot, r: 0.05, dirX: Math.cos(angle), dirY: Math.sin(angle), strength: 0.18 });
    }
  }
  {
    const spot = place();
    if (spot) world.terrain.addDome({ ...spot, r: 0.035 });
  }
  {
    const spot = place();
    if (spot) world.terrain.addGutter({ ...spot, r: 0.05 });
  }
}
