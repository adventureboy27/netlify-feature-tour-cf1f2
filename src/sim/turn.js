/**
 * The turn state machine (docs/DESIGN.md): AIM -> LAUNCH -> ROLL -> SETTLE -> RESOLVE ->
 * DEGRADE -> AIM. The player drives AIM -> LAUNCH by calling `launch(vx, vy)`; everything
 * after that is automatic. Emits `phase` on every transition and `win` once a level ends.
 */
import { checkWin, resolveEliminations } from './rules.js';
import { assignRestColours } from './terrain.js';

const REST_EPS = 1e-3;
// A backstop, not a pacing target: with 676 environment x power combinations, some pairing
// of continuous forces (e.g. magnet + magnetic, both pulling marbles together) can settle
// into a state that never drops every marble below REST_EPS at once. Normal turns settle
// in single-digit seconds; this only ever fires on a pairing that wouldn't otherwise end.
const ROLL_TIMEOUT = 18;

export function createTurnMachine(world) {
  let phase = 'AIM';
  let rollStartTime = 0;
  const cpuAim = new Map(); // marble -> pending {vx, vy}, set for the whole AIM phase

  function setPhase(next) {
    phase = next;
    world.events.emit('phase', { phase, turn: world.turn });
  }

  // CPU marbles aim for open ground the instant AIM begins, same as the player would.
  // "Open ground" is still just "somewhere on the board" — dodging specific hazards is a
  // smarter CPU than this milestone needs.
  function beginAim() {
    cpuAim.clear();
    const margin = 0.1;
    for (const m of world.marbles) {
      if (!m.alive) continue;
      // "start of the turn" position, for anything that snaps a marble back (rewind)
      m.turnStartX = m.x;
      m.turnStartY = m.y;
      if (m.isPlayer) continue;
      const tx = world.rng.range(world.bounds.l + margin, world.bounds.r - margin);
      const ty = world.rng.range(world.bounds.t + margin, world.bounds.b - margin);
      const dx = tx - m.x;
      const dy = ty - m.y;
      const dist = Math.hypot(dx, dy) || 1;
      const speed = Math.min(world.maxSpeed, 0.15 + dist * 0.9);
      cpuAim.set(m, { vx: (dx / dist) * speed, vy: (dy / dist) * speed });
    }
    setPhase('AIM');
  }

  function launch(playerVx, playerVy) {
    if (phase !== 'AIM') return;
    // launchMul applies on top of the normal max-speed clamp, not before it — turbo is meant
    // to genuinely exceed what a flick can otherwise reach, not just make reaching it easier.
    for (const m of world.marbles) {
      if (!m.alive) continue;
      if (m.isPlayer) { m.vx = playerVx * m.launchMul; m.vy = playerVy * m.launchMul; }
      else { const a = cpuAim.get(m); if (a) { m.vx = a.vx * m.launchMul; m.vy = a.vy * m.launchMul; } }
      world.power?.onLaunch?.(m, world);
    }
    rollStartTime = world.time;
    setPhase('LAUNCH');
    setPhase('ROLL');
  }

  function allResting() {
    // a marble already condemned by terrain is frozen regardless of its stored velocity —
    // it's falling, not rolling, and RESOLVE (not ROLL) is what actually removes it
    return world.marbles.every(m => !m.alive || m.lethalCause || Math.hypot(m.vx, m.vy) < REST_EPS);
  }

  // Called once per physics tick from main.js, right after stepPhysics.
  function afterPhysicsStep() {
    if (phase !== 'ROLL') return;
    const timedOut = world.time - rollStartTime > ROLL_TIMEOUT;
    if (!allResting() && !timedOut) return;
    if (timedOut) {
      for (const m of world.marbles) { m.vx = 0; m.vy = 0; }
    }
    settle();
  }

  function settle() {
    setPhase('SETTLE');
    assignRestColours(world);           // colour is a place — assign before the environment
    for (const m of world.marbles) {
      if (m.alive) world.power?.onSettle?.(m, world);
    }
    world.environment?.onSettle?.(world); // sees the terrain-based deaths (like sinkhole would)
    resolve();
  }

  function resolve() {
    setPhase('RESOLVE');
    // win check FIRST, before any elimination — a win can never be taken back afterward
    let winner = checkWin(world);
    if (!winner) {
      resolveEliminations(world);
      winner = checkWin(world);
    }
    if (winner) {
      world.winner = winner;
      setPhase('GAME_OVER');
      world.events.emit('win', { winner });
      return;
    }
    degrade();
  }

  function degrade() {
    setPhase('DEGRADE');
    world.turn++;
    world.environment?.onTurnStart?.(world, world.turn);
    beginAim();
  }

  beginAim();

  return {
    get phase() { return phase; },
    launch,
    afterPhysicsStep
  };
}
