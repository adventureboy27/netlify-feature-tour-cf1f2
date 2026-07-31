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
  const opponentsEl = document.createElement('div');
  opponentsEl.className = 'hud-opponents';
  el.appendChild(envEl);
  el.appendChild(powerEl);
  el.appendChild(opponentsEl);
  el.appendChild(statusEl);

  // launcher charge meter — a DOM bar, not drawn in WebGL/canvas2d, same "HUD stays out of
  // the scene" rule as everything else in this file. Hidden except while actively charging.
  const chargeBar = document.createElement('div');
  chargeBar.className = 'hud-charge-bar';
  const chargeFill = document.createElement('div');
  chargeFill.className = 'hud-charge-fill';
  chargeBar.appendChild(chargeFill);
  chargeBar.style.display = 'none';
  el.appendChild(chargeBar);

  const overheatEl = document.createElement('div');
  overheatEl.className = 'hud-overheat';
  overheatEl.textContent = 'LAUNCHER OVERHEATED';
  overheatEl.style.display = 'none';
  el.appendChild(overheatEl);
  let overheatTimer = null;

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
      statusEl.textContent = winner.isPlayer ? 'you win' : `you lose — marble #${winner.number} wins`;
    },
    setOpponents(numbers) {
      opponentsEl.textContent = `Opponents: ${numbers.map((n) => `#${n}`).join('  ')}`;
    },
    // fraction null/undefined hides the bar (not charging); 0..1 while held; overheating
    // switches the fill colour so the last stretch before the flip reads as dangerous.
    setCharge(fraction, overheating) {
      if (fraction == null) { chargeBar.style.display = 'none'; return; }
      chargeBar.style.display = 'block';
      chargeFill.style.width = `${Math.min(1, fraction) * 100}%`;
      chargeFill.classList.toggle('hud-charge-fill--hot', overheating);
    },
    flashOverheat() {
      overheatEl.style.display = 'block';
      clearTimeout(overheatTimer);
      overheatTimer = setTimeout(() => { overheatEl.style.display = 'none'; }, 900);
    }
  };
}
