/**
 * DOM overlay — kept out of the canvas/WebGL entirely (docs/CLAUDE.md architecture).
 * M2 only needs enough of it to see the turn cycle and the winner while playtesting.
 */
export function createHud(el) {
  return {
    setPhase(turn, phase) {
      el.textContent = `turn ${turn} — ${phase}`;
    },
    setWinner(winner) {
      el.textContent = winner.isPlayer ? 'you win' : 'you lose';
    }
  };
}
