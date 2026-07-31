/**
 * DOM overlay — kept out of the canvas/WebGL entirely (docs/CLAUDE.md architecture).
 * Enough of it to see the environment announcement, the turn cycle, and the winner.
 */
export function createHud(el) {
  const envEl = document.createElement('div');
  envEl.className = 'hud-env';
  const statusEl = document.createElement('div');
  statusEl.className = 'hud-status';
  el.appendChild(envEl);
  el.appendChild(statusEl);

  return {
    // non-negotiable #2: the environment is announced before the level starts
    setEnvironment(env) {
      envEl.textContent = env ? `${env.name} — ${env.blurb}` : 'No environment';
    },
    setPhase(turn, phase) {
      statusEl.textContent = `turn ${turn} — ${phase}`;
    },
    setWinner(winner) {
      statusEl.textContent = winner.isPlayer ? 'you win' : 'you lose';
    }
  };
}
