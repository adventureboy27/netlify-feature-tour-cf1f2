# TAW

A marble survival battle royale. Five marbles, one board, last one rolling wins.

You flick your marble in the direction you want it to go. All five launch at once. They roll
with real rolling resistance and settle. Then the board takes its turn, and the board is
always getting worse.

**Read `docs/DESIGN.md` before writing gameplay code.** It defines the loop, the environment
and power systems, and the rules that keep the game fair.

---

## Non-negotiables

These came out of prototyping. Breaking them makes the game worse; if you think one should
change, say so first rather than changing it.

1. **The environment kills. Powers only change how you move.**
   Elimination is always physical and always visible: you fell in a hole, you touched lava,
   you left the board, you drowned, you got crushed by the closing walls. There are no
   abstract eliminations like "nearest the wall is out."

2. **Everything is announced before the level starts.**
   The player sees the environment and the power before the first flick. No per-turn dice
   rolls that decide who dies. Uncertainty comes from physics, not from hidden rules.
   *Exception: `roulette`, see DESIGN.md.*

3. **A turn does not need a casualty.**
   Many turns kill nobody. Pressure comes from the board degrading, not from a forced body count.

4. **Last marble standing wins immediately.**
   The instant only one marble remains — for any reason, at any point — the level ends and
   that marble wins. Nothing that resolves afterward can take it back. This was a real bug
   in the prototype; do not reintroduce it.

5. **Nothing can empty the board.**
   If a resolution would eliminate every remaining marble, one survives. If the player is
   among them, it is the player.

6. **The player's marble is identified by a marker outside the ball** — a slowly rotating
   white ring with four orbiting pips. Never by its color, because its color changes.

7. **Physics is 2D. Rendering is 3D.** See "Architecture."

---

## Architecture

**Physics is a 2D top-down simulation.** Marbles are circles on a plane. This is not
negotiable for gameplay reasons: it must be deterministic, cheap, and easy to reason about
across 25 environments. Do not reach for a 3D physics engine.

**Rendering is three.js/WebGL** reading that 2D state and drawing it as real spheres on a
real surface with real lights. The renderer never owns state and never writes to it.

```
src/
  core/
    loop.js         fixed-timestep accumulator, 120 Hz physics, interpolated render
    rng.js          seeded PRNG (mulberry32). All randomness goes through this.
    world.js        the entire mutable game state, plain data
    events.js       tiny pub/sub used by audio and vfx to react without coupling
  sim/
    physics.js      integration, rolling resistance, walls, elastic collisions
    terrain.js      holes, lava, water, ramps, bumpers, gutters, ice patches
    turn.js         the turn state machine (see DESIGN.md)
    rules.js        elimination, win conditions, the non-negotiables above
  content/
    environments.js registry, imports from data/
    powers.js       registry, imports from data/
    surfaces.js     oak / ice / sand / glass / granite friction + audio profiles
    levels.js       level grammar: seed -> environment + power + surface + terrain
  data/
    environments.js the 25 environment definitions
    powers.js       the 26 power definitions
  render/
    scene.js        camera, lights, HDRI environment map
    marbles.js      instanced glass spheres, MeshPhysicalMaterial w/ transmission
    board.js        floor mesh, PBR material, rails, dynamic holes via alpha/geometry
    vfx.js          particles, shockwaves, lava churn, water surface
    hud.js          DOM overlay. Keep the HUD out of WebGL.
  audio/
    engine.js       Web Audio graph and the six buses
    beds.js         environment beds, rolling bed
    voices.js       power voices (turbo engine note, etc.)
    impacts.js      collision, rail, death sounds
```

---

## The hook system — read this before adding content

25 environments x 26 powers is 650 combinations. They stay tractable only because neither
one knows about the other. Both are plain objects implementing optional hooks. The
simulation calls the hooks; content never calls the simulation directly.

```js
// environment
{
  id, name, blurb,
  soloOnly: false,          // true = never paired with a power
  onLevelStart(world),      // build initial terrain
  onTurnStart(world, turn), // THE IMPORTANT ONE. this is where it gets worse.
  onStep(world, dt),        // continuous forces: magnet, wind, conveyor, carousel
  onSettle(world),          // terrain-based eliminations
  audio: { bed, stinger }
}

// power
{
  id, name, blurb,
  exclusive: false,         // true = never paired with an environment that is soloOnly
  stats: { launchMul, decelMul, wallE, ballE, mass, radius },  // all optional
  onLaunch(m, world),
  onStep(m, world, dt),
  onWallHit(m, world, force),
  onMarbleHit(m, other, world, force),
  onSettle(m, world),
  onDeath(m, world),        // return true to veto the death (Shield, Rewind)
  audio: { voice }
}
```

Rules for content authors:
- A hook mutates `world` or the marble it was handed. It never returns state.
- Every random draw uses `world.rng`, never `Math.random`. Levels must replay identically.
- An environment that adds terrain adds it to `world.terrain`; it does not kill directly.
  `sim/rules.js` owns all elimination.
- Powers must not kill. If a power ends a marble (Cannonball, Bomb), it applies a
  `lethal` flag and `rules.js` decides.

---

## Conventions

- Vanilla JS modules, no framework. Vite for dev and build.
- No TypeScript unless you convert the whole thing at once.
- Units: physics works in board-widths per second so everything scales with screen size.
- Fixed timestep 1/120s, max 5 substeps per frame, render interpolates between states.
- Comments explain *why*, not *what*.
- Every tunable number lives in `src/content/surfaces.js` or the content definition it
  belongs to. No magic numbers buried in `physics.js`.

## Current status

Nothing built yet. `docs/BUILD-ORDER.md` has the milestones in dependency order.
A working single-file prototype exists (canvas 2D, flick control, real rolling
resistance, five marbles, wood/ice/sand/glass surfaces, lava, pits, rail gaps,
six-layer audio started). Use it as the feel reference for tuning, not as a codebase.
