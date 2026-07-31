/**
 * mulberry32 — seeded PRNG. All randomness in TAW goes through this so levels replay
 * identically from a seed. Never use Math.random in sim/ or content/.
 */
export function createRng(seed) {
  let a = seed >>> 0;

  function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next,
    range(min, max) { return min + next() * (max - min); },
    pick(arr) { return arr[Math.floor(next() * arr.length)]; }
  };
}
