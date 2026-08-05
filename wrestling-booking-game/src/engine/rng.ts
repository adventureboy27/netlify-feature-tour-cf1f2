// Seeded RNG and dice helpers. Every simulation function takes an Rng
// instance explicitly — engine/ never calls Math.random(). See CLAUDE.md.

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /**
   * The generator's internal state, for saving a game mid-stream. Optional
   * so a test can still hand the engine a one-line fake Rng.
   */
  state?(): number;
}

/** mulberry32: fast, small-state, good-enough-for-a-game seeded PRNG. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return {
    state(): number {
      return a >>> 0;
    },
    next(): number {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** Derive a numeric seed from an arbitrary string (world seed -> RNG seed). */
export function seedFromString(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

export function rngFromSeed(seed: string): Rng {
  return mulberry32(seedFromString(seed));
}

/** Resume a saved generator exactly where it left off. */
export function rngFromState(state: number): Rng {
  return mulberry32(state);
}

/** Integer in [min, max], inclusive on both ends. */
export function randInt(rng: Rng, min: number, max: number): number {
  return Math.floor(rng.next() * (max - min + 1)) + min;
}

/** Float in [min, max). */
export function randFloat(rng: Rng, min: number, max: number): number {
  return rng.next() * (max - min) + min;
}

/** True with probability p (0-1). */
export function chance(rng: Rng, p: number): boolean {
  return rng.next() < p;
}

/** Normal distribution via Box-Muller, mean/stdev as given. */
export function gaussian(rng: Rng, mean: number, stdev: number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng.next();
  while (v === 0) v = rng.next();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean + z * stdev;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Pick a random element from a non-empty array. */
export function pick<T>(rng: Rng, arr: readonly T[]): T {
  if (arr.length === 0) throw new Error('pick() called on an empty array');
  return arr[randInt(rng, 0, arr.length - 1)] as T;
}

/** Weighted pick: entries are [item, weight] pairs, weights need not sum to 1. */
export function weightedPick<T>(rng: Rng, entries: readonly (readonly [T, number])[]): T {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  if (total <= 0) throw new Error('weightedPick() requires a positive total weight');
  let roll = rng.next() * total;
  for (const [item, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return item;
  }
  // Floating point fallback — return the last entry.
  return entries[entries.length - 1]![0];
}
