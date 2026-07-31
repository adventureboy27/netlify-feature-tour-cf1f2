/**
 * Integration, rolling resistance, wall bounce. One fixed tick (see core/loop.js) per call.
 *
 * Rolling resistance is a constant deceleration plus a small viscous term, NEVER exponential
 * decay — pure exponential decay never actually reaches zero and reads as air hockey, not a
 * marble rolling to a stop on wood. The constant term guarantees it stops in finite time.
 */
export function stepPhysics(world, dt) {
  const { decel, wallE, viscous } = world.surface;
  for (const m of world.marbles) {
    if (!m.alive) continue;
    m.px = m.x;
    m.py = m.y;
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    applyRollingResistance(m, decel, viscous, dt);
    bounceOffWalls(m, world.bounds, wallE);
  }
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

function bounceOffWalls(m, bounds, wallE) {
  const { l, r, t, b } = bounds;
  if (m.x - m.r < l) { m.x = l + m.r; m.vx = -m.vx * wallE; }
  else if (m.x + m.r > r) { m.x = r - m.r; m.vx = -m.vx * wallE; }
  if (m.y - m.r < t) { m.y = t + m.r; m.vy = -m.vy * wallE; }
  else if (m.y + m.r > b) { m.y = b - m.r; m.vy = -m.vy * wallE; }
}
