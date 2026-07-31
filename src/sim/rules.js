/**
 * Elimination and win conditions. This file alone decides who dies and who wins — content
 * hooks only flag intent (`marble.lethalCause`), they never set `alive = false` themselves.
 */

// Non-negotiable #4: the instant one marble remains, the level ends and it wins. Called at
// the top of RESOLVE, before eliminations are applied, and again after — nothing that
// resolves later can take a win back.
export function checkWin(world) {
  const alive = world.marbles.filter(m => m.alive);
  return alive.length === 1 ? alive[0] : null;
}

// Applies every pending lethalCause. Non-negotiable #5: a resolution can never empty the
// board — if it would, one marble is spared, and it's the player if the player is among
// the condemned.
export function resolveEliminations(world) {
  const dying = world.marbles.filter(m => m.alive && m.lethalCause);
  if (dying.length === 0) return;

  const aliveCount = world.marbles.filter(m => m.alive).length;

  // shield/rewind get first say — a power's onDeath can veto its own marble's death. The
  // never-empty-the-board rule below is the backstop for whatever's left after that, not a
  // substitute for it.
  const stillDying = [];
  for (const m of dying) {
    const vetoed = world.power?.onDeath?.(m, world);
    if (vetoed) m.lethalCause = null;
    else stillDying.push(m);
  }

  if (stillDying.length >= aliveCount) {
    const spared = stillDying.find(m => m.isPlayer) ?? stillDying[0];
    spared.lethalCause = null;
    stillDying.splice(stillDying.indexOf(spared), 1);
  }

  for (const m of stillDying) {
    m.alive = false;
    m.diedAtTurn = world.turn; // round-stats bookkeeping (content/stats.js), not gameplay
    world.events.emit('death', { marble: m, cause: m.lethalCause });
  }
}
