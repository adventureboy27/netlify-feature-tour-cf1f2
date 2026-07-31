import { applyTerrainForces, resolveTerrainObstacles, checkHazards, decelOverrideAt } from './terrain.js';

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
 * it sees this tick's real positions, before terrain's own hazard check.
 */
export function stepPhysics(world, dt) {
  world.time += dt;
  const { wallE } = world.surface;

  applyTerrainForces(world, dt);

  for (const m of world.marbles) {
    if (!m.alive || m.lethalCause) continue;
    m.px = m.x;
    m.py = m.y;
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    const override = decelOverrideAt(world, m.x, m.y);
    const decel = override ? override.decel : world.surface.decel;
    const viscous = override ? override.viscous : world.surface.viscous;
    applyRollingResistance(m, decel, viscous, dt);
    if (world.rails !== false) bounceOffWalls(m, world, wallE);
  }

  resolveTerrainObstacles(world);
  resolveMarbleCollisions(world);
  world.environment?.onStep?.(world, dt);
  checkHazards(world);
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

function bounceOffWalls(m, world, wallE) {
  const { l, r, t, b } = world.bounds;
  let force = 0;
  if (m.x - m.r < l) { force = Math.abs(m.vx); m.x = l + m.r; m.vx = -m.vx * wallE; }
  else if (m.x + m.r > r) { force = Math.abs(m.vx); m.x = r - m.r; m.vx = -m.vx * wallE; }
  if (m.y - m.r < t) { force = Math.max(force, Math.abs(m.vy)); m.y = t + m.r; m.vy = -m.vy * wallE; }
  else if (m.y + m.r > b) { force = Math.max(force, Math.abs(m.vy)); m.y = b - m.r; m.vy = -m.vy * wallE; }
  if (force > 0) world.events.emit('impact', { kind: 'rail', force });
}

// Pairwise circle-circle elastic collision: separate overlap by inverse mass, then apply
// a restitution impulse along the contact normal. ballE = 0.94 by default (docs/DESIGN.md).
function resolveMarbleCollisions(world) {
  const marbles = world.marbles, ballE = world.ballE;
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

      const j2 = -(1 + ballE) * velAlongNormal / totalInv;
      const ix = j2 * nx;
      const iy = j2 * ny;
      a.vx -= ix * invA;
      a.vy -= iy * invA;
      b.vx += ix * invB;
      b.vy += iy * invB;

      world.events.emit('impact', { kind: 'marble', force: Math.abs(velAlongNormal) });
    }
  }
}
