/**
 * Damage — the third source of elimination alongside the environment (docs/CLAUDE.md
 * non-negotiable #1, amended). Always-on core simulation state, not content: it doesn't know
 * about environments or powers, and they don't know about it. A marble accrues damage from
 * impact force (wall hits, marble-on-marble hits), and damage in turn makes the marble handle
 * worse — drags harder, launches weaker, drifts off a straight line — before finally shattering
 * at full damage. Damage never carries between levels (every marble starts at 0, world.js).
 */

const DAMAGE_FORCE_FLOOR = 0.12;    // impacts below this are grazes — no damage, no chip wear
const DAMAGE_PER_FORCE = 0.05;      // fraction of the damage bar per unit of force above the floor
const DAMAGE_DRAG_MUL = 1.1;        // fully damaged: rolling resistance roughly doubles
const DAMAGE_LAUNCH_PENALTY = 0.4;  // fully damaged: launches at ~60% of the intended speed
const DAMAGE_DRIFT = 0.5;           // fully damaged: a rolling marble visibly wanders off-line

// Called wherever physics.js already computes an impact force (bounceOffWalls,
// resolveMarbleCollisions) — not routed through world.events, since this is core state
// mutation, not a reactive side effect like audio/vfx.
export function accrueDamage(m, world, force) {
  if (!m.alive || m.lethalCause || force < DAMAGE_FORCE_FLOOR) return;
  m.damage = Math.min(1, m.damage + (force - DAMAGE_FORCE_FLOOR) * DAMAGE_PER_FORCE);
  if (m.damage >= 1) m.lethalCause = 'shattered'; // sim/rules.js still owns the actual kill
}

export function dragMultiplier(m) {
  return 1 + m.damage * DAMAGE_DRAG_MUL;
}

export function launchMultiplier(m) {
  return 1 - m.damage * DAMAGE_LAUNCH_PENALTY;
}

// A small sideways nudge each physics tick, proportional to damage and current speed — a
// cracked marble doesn't roll straight. Deterministic: draws from world.rng, never
// Math.random, so a replayed seed reproduces the same wander.
export function applyDrift(m, world, dt) {
  if (m.damage <= 0) return;
  const speed = Math.hypot(m.vx, m.vy);
  if (speed < 1e-3) return;
  const nx = -m.vy / speed, ny = m.vx / speed; // perpendicular to current heading
  const wobble = (world.rng.next() - 0.5) * 2 * DAMAGE_DRIFT * m.damage * speed;
  m.vx += nx * wobble * dt;
  m.vy += ny * wobble * dt;
}
