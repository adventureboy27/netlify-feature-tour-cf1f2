/**
 * DOM overlay — kept out of the canvas/WebGL entirely (docs/CLAUDE.md architecture).
 * Enough of it to see the environment announcement, the turn cycle, and the winner.
 */
export function createHud(el) {
  const envEl = document.createElement('div');
  envEl.className = 'hud-env';
  const powerEl = document.createElement('div');
  powerEl.className = 'hud-power';
  const statusEl = document.createElement('div');
  statusEl.className = 'hud-status';
  el.appendChild(envEl);
  el.appendChild(powerEl);
  el.appendChild(statusEl);

  return {
    // non-negotiable #2: the environment (and power, if any) is announced before the
    // level starts
    setEnvironment(env) {
      envEl.textContent = env ? `${env.name} — ${env.blurb}` : 'No environment';
    },
    setPower(power) {
      powerEl.textContent = power ? `Power: ${power.name} — ${power.blurb}` : '';
    },
    setPhase(turn, phase) {
      statusEl.textContent = `turn ${turn} — ${phase}`;
    },
    setWinner(winner) {
      statusEl.textContent = winner.isPlayer ? 'you win' : 'you lose';
    }
  };
}
