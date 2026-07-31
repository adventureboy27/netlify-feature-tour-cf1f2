import { applyTerrainForces, resolveTerrainObstacles, checkHazards, decelOverrideAt } from './terrain.js';
import { addMarble } from '../core/world.js';

/**
 * Integration, rolling resistance, wall bounce, elastic marble-marble collisions, and
 * terrain. One fixed tick (see core/loop.js) per call.
 *
 * Rolling resistance is a constant deceleration plus a small viscous term, NEVER exponential
 * decay — pure exponential decay never actually reaches zero and reads as air hockey, not a
 * marble rolling to a stop on wood. The constant term guarantees it stops in finite time.
 *
 * A marble with `lethalCause` already set is condemned but not yet eliminated (that's
 * sim/rules.js, at RESOLVE) — it freezes in place rather than continuing to move or collide.
 *
 * world.environment?.onStep runs continuous environment forces (magnet, wind, carousel) and
 * any per-tick hazard check an environment needs (sumo's disc boundary) — after movement so
 * it sees this tick's real positions, before terrain's own hazard check. world.power?.onStep
 * runs alongside it, per marble (turbo's engine voice tracks speed this way).
 */
export function stepPhysics(world, dt) {
  world.time += dt;
  const { wallE } = world.surface;
  const power = world.power;

  applyTerrainForces(world, dt);

  for (const m of world.marbles) {
    if (!m.alive || m.lethalCause) continue;
    m.px = m.x;
    m.py = m.y;
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    const override = decelOverrideAt(world, m.x, m.y);
    const decel = (override ? override.decel : world.surface.decel) * m.decelMul;
    const viscous = (override ? override.viscous : world.surface.viscous) * m.decelMul;
    applyRollingResistance(m, decel, viscous, dt);
    if (world.rails !== false) bounceOffWalls(m, world, wallE, power);
    power?.onStep?.(m, world, dt);
  }

  resolveTerrainObstacles(world);
  resolveMarbleCollisions(world);
  world.environment?.onStep?.(world, dt);
  checkHazards(world);
  processPendingSplit(world);
}

// splitshot flags a split (world.pendingSplit = m) rather than creating the clone itself —
// content mutates state, it doesn't call sim constructors (docs/CLAUDE.md hook rules). This
// is the one place that actually grows the roster.
function processPendingSplit(world) {
  const m = world.pendingSplit;
  if (!m) return;
  world.pendingSplit = null;
  m.r *= 0.6;
  m.mass *= 0.6;
  const clone = addMarble(world, {
    x: m.x + m.r * 2, y: m.y, isPlayer: m.isPlayer,
    r: m.r, mass: m.mass, decelMul: m.decelMul, launchMul: m.launchMul, wallE: m.wallE, ballE: m.ballE
  });
  clone.hasSplit = true;
  clone.vx = -m.vx * 0.6;
  clone.vy = -m.vy * 0.6 + 0.05;
  m.vx *= 0.6;
  m.vy *= 0.6;
}

function applyRollingResistance(m, decel, viscous, dt) {
  const speed = Math.hypot(m.vx, m.vy);
  if (speed <= 1e-4) { m.vx = 0; m.vy = 0; return; }
  const drop = (decel + viscous * speed) * dt;
  const newSpeed = Math.max(0, speed - drop);
  const scale = newSpeed / speed;
  m.vx *= scale;
  m.vy *= scale;
}

// m.wallE is the marble's own effective restitution (from a power's stats, e.g. cork), an
// override rather than a multiplier — null means "use the surface's own wallE."
function bounceOffWalls(m, world, wallE, power) {
  const effE = m.wallE ?? wallE;
  const { l, r, t, b } = world.bounds;
  let force = 0;
  if (m.x - m.r < l) { force = Math.abs(m.vx); m.x = l + m.r; m.vx = -m.vx * effE; }
  else if (m.x + m.r > r) { force = Math.abs(m.vx); m.x = r - m.r; m.vx = -m.vx * effE; }
  if (m.y - m.r < t) { force = Math.max(force, Math.abs(m.vy)); m.y = t + m.r; m.vy = -m.vy * effE; }
  else if (m.y + m.r > b) { force = Math.max(force, Math.abs(m.vy)); m.y = b - m.r; m.vy = -m.vy * effE; }
  if (force > 0) {
    world.events.emit('impact', { kind: 'rail', force, x: m.x, y: m.y });
    power?.onWallHit?.(m, world, force);
  }
}

// Pairwise circle-circle elastic collision: separate overlap by inverse mass, then apply
// a restitution impulse along the contact normal. ballE = 0.94 by default (docs/DESIGN.md),
// per-marble ballE (a power override, e.g. cork/greased) averaged when the two differ.
// ghost's `noCollide` skips this whole pass — by the time marbles overlap it's too late for
// a hook to un-happen a collision, so it has to be a pre-check, not a hook.
function resolveMarbleCollisions(world) {
  if (world.power?.noCollide) return;
  const marbles = world.marbles, ballE = world.ballE, power = world.power;
  for (let i = 0; i < marbles.length; i++) {
    const a = marbles[i];
    if (!a.alive || a.lethalCause) continue;
    for (let j = i + 1; j < marbles.length; j++) {
      const b = marbles[j];
      if (!b.alive || b.lethalCause) continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const minDist = a.r + b.r;
      if (dist === 0 || dist >= minDist) continue;

      const nx = dx / dist;
      const ny = dy / dist;
      const invA = 1 / a.mass;
      const invB = 1 / b.mass;
      const totalInv = invA + invB;

      const overlap = minDist - dist;
      a.x -= nx * overlap * (invA / totalInv);
      a.y -= ny * overlap * (invA / totalInv);
      b.x += nx * overlap * (invB / totalInv);
      b.y += ny * overlap * (invB / totalInv);

      const relVx = b.vx - a.vx;
      const relVy = b.vy - a.vy;
      const velAlongNormal = relVx * nx + relVy * ny;
      if (velAlongNormal > 0) continue; // already separating

      const effE = ((a.ballE ?? ballE) + (b.ballE ?? ballE)) / 2;
      const j2 = -(1 + effE) * velAlongNormal / totalInv;
      const ix = j2 * nx;
      const iy = j2 * ny;
      a.vx -= ix * invA;
      a.vy -= iy * invA;
      b.vx += ix * invB;
      b.vy += iy * invB;

      const force = Math.abs(velAlongNormal);
      world.events.emit('impact', { kind: 'marble', force, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      // each side gets a chance to react to what it hit — a mutual collision between two
      // marbles sharing the power (cannonball vs cannonball) fires it for both
      power?.onMarbleHit?.(a, b, world, force);
      power?.onMarbleHit?.(b, a, world, force);
    }
  }
}
