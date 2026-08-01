/**
 * The pool of recurring numbered opponents. Only 4 fill the non-player slots in any one
 * level, drawn from a much larger pool (docs/CLAUDE.md) so a given number is a recognizable
 * recurring character across games, not a fresh label every time. The player is never
 * numbered — non-negotiable #6 already gives them a marker (the ring) that never changes;
 * a number badge would be redundant at best.
 */
export const ROSTER_MIN = 2;
export const ROSTER_MAX = 41; // 40 possible opponents; 4 appear per level
export const OPPONENT_SLOTS = 4;

// Draws OPPONENT_SLOTS distinct numbers from the pool through world.rng, so which opponents
// show up is itself part of "a level is a seed" (docs/CLAUDE.md) — replaying a seed gets you
// the same four rivals, not just the same terrain.
export function drawOpponents(rng) {
  const pool = [];
  for (let n = ROSTER_MIN; n <= ROSTER_MAX; n++) pool.push(n);
  const picked = [];
  for (let i = 0; i < OPPONENT_SLOTS; i++) {
    const idx = Math.floor(rng.next() * pool.length);
    picked.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return picked;
}
