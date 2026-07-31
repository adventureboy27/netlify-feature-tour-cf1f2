/**
 * Level grammar (docs/DESIGN.md): a level is a seed. Everything else derives from it —
 * environment, power, surface, in that order, off the SAME rng stream that terrain
 * generation and CPU aim continue from afterward.
 *
 *   level(n, seed) -> { environment, power, surface, opponents, rng }
 *
 * The first HAND_AUTHORED.length levels are fixed — specific, deliberately chosen
 * combinations, not drawn. Everything after that is a weighted draw from a pool that grows
 * with `n`, per docs/BUILD-ORDER.md M9 ("weighted draws, unlock curve").
 */
import { getEnvironment, implemented as allEnvironments } from './environments.js';
import { getPower, implemented as allPowers } from './powers.js';
import { getSurface, surfaceIds } from './surfaces.js';
import { createRng } from '../core/rng.js';

const NO_POWER_CHANCE = 0.3; // "roughly 30% of levels have no power at all" — docs/DESIGN.md

// Roughly gentle -> chaotic. Editorial, not derived from any in-game number — severityCurve
// is pacing (how fast an environment worsens), not a danger rating, so it doesn't rank this
// on its own. "Early levels: mild environment, no power, oak. Introduce one system at a
// time" (docs/DESIGN.md) is exactly the judgment call this list encodes.
const ENV_PROGRESSION = [
  'closing', 'rot', 'flow', 'freeze', 'fault', 'ashfall', 'conveyor', 'pinball',
  'tide', 'sinkhole', 'split', 'rust', 'crumble', 'vice', 'sumo',
  'tilt', 'quicksand', 'windstorm', 'meteor', 'shatter', 'scorch', 'magnet',
  'roulette', 'carousel', 'grinder', 'blackout'
];

const POWER_PROGRESSION = [
  'cork', 'feather', 'lead', 'greased', 'blink', 'nitro', 'frost',
  'turbo', 'ghost', 'boomerang', 'siphon', 'english', 'magnetic', 'repulsor',
  'shield', 'anchor', 'sticky', 'drill', 'comet', 'hollow',
  'cannonball', 'molten', 'bomb', 'shockwave', 'rewind', 'splitshot'
];

// ~15 hand-authored, memorable levels — docs/BUILD-ORDER.md M9. Fixed env/power/surface;
// only terrain layout and CPU behaviour vary with the seed.
export const HAND_AUTHORED = [
  { env: 'closing', power: null, surface: 'oak' },
  { env: 'rot', power: null, surface: 'oak' },
  { env: 'flow', power: null, surface: 'oak' },
  { env: 'tide', power: null, surface: 'ice' },
  { env: 'sinkhole', power: 'cork', surface: 'oak' },
  { env: 'sumo', power: null, surface: 'granite' },
  { env: 'closing', power: 'turbo', surface: 'oak' }, // M7's own bar: "as stupid as it sounds"
  { env: 'freeze', power: null, surface: 'sand' },
  { env: 'magnet', power: 'ghost', surface: 'oak' },
  { env: 'roulette', power: null, surface: 'glass' },
  { env: 'vice', power: 'lead', surface: 'oak' },
  { env: 'windstorm', power: 'boomerang', surface: 'oak' },
  { env: 'quicksand', power: 'feather', surface: 'glass' },
  { env: 'carousel', power: null, surface: 'oak' },
  { env: 'grinder', power: 'shield', surface: 'granite' }
];

// One new entry unlocks roughly every 2 levels past the hand-authored run.
function unlockCount(list, n) {
  return Math.min(list.length, 4 + Math.floor(Math.max(0, n - HAND_AUTHORED.length) / 2));
}

export function level(n, seed) {
  const rng = createRng(seed);

  if (n < HAND_AUTHORED.length) {
    const picked = HAND_AUTHORED[n];
    return {
      environment: getEnvironment(picked.env),
      power: picked.power ? getPower(picked.power) : null,
      surface: getSurface(picked.surface),
      opponents: 4,
      rng
    };
  }

  const envPool = ENV_PROGRESSION.slice(0, unlockCount(ENV_PROGRESSION, n));
  const environment = getEnvironment(rng.pick(envPool));

  // soloOnly never gets a power (docs/DESIGN.md level grammar) — every power drawn here is
  // therefore automatically only ever paired with a non-soloOnly environment, which is what
  // `exclusive` (never paired with soloOnly) actually requires too.
  let power = null;
  if (!environment.soloOnly && rng.next() >= NO_POWER_CHANCE) {
    const powerPool = POWER_PROGRESSION.slice(0, unlockCount(POWER_PROGRESSION, n));
    power = getPower(rng.pick(powerPool));
  }

  const surface = getSurface(rng.pick(surfaceIds));

  return { environment, power, surface, opponents: 4, rng };
}

export const levelCount = HAND_AUTHORED.length;

// Every environment/power the grammar can ever draw — used by the smoke tests and, if
// nothing else, a sanity check that ENV_PROGRESSION/POWER_PROGRESSION don't typo an id.
export function validateProgression() {
  for (const id of ENV_PROGRESSION) if (!allEnvironments.some((e) => e.id === id)) throw new Error(`unknown environment id: ${id}`);
  for (const id of POWER_PROGRESSION) if (!allPowers.some((p) => p.id === id)) throw new Error(`unknown power id: ${id}`);
}
