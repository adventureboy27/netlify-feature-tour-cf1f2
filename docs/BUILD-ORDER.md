# Build order

Each milestone is playable. Do not start one before the previous is playable.

## M1 — the roll (the whole game lives or dies here)
Vite project. Fixed-timestep loop, seeded RNG, 2D physics: one marble, flick to launch,
constant rolling resistance, wall bounce. Canvas 2D is fine for this milestone.
**Done when:** the roll feels like glass on wood. Tune `decel` before writing anything else.

## M2 — five marbles and a turn
Elastic collisions, CPU aiming, the turn state machine, win/lose, the non-negotiable rules
in `sim/rules.js`. Still canvas.
**Done when:** you can play a full level with no environment and it is already tense.

## M3 — terrain
`sim/terrain.js`: holes, lava, water, ramps, domes, bumpers, gutters, ice patches. Colour
patches and rest-colour assignment. Board generator from seed.
**Done when:** boards feel authored rather than random.

## M4 — the three-dimensional renderer
three.js scene, HDRI, PBR floor, glass marbles, real shadows, camera. The renderer reads
world state and owns nothing. Keep the canvas renderer behind a flag — it is a useful truth
check when the 3D looks wrong.
**Done when:** a still frame looks like a photograph of marbles.

## M5 — audio engine
Six buses. Rolling bed, impacts, deaths. No environment beds yet.
**Done when:** you can play with your eyes closed and know roughly what happened.

## M6 — environments
The hook system, then: `closing`, `rot`, `sumo`, `flow`, `sinkhole`, `tide`. Get six right
before writing twenty-six. Each needs an `onTurnStart` that visibly and audibly degrades.
**Done when:** the same seed with two different environments plays like two games.

## M7 — powers
`turbo`, `lead`, `cork`, `ghost`, `cannonball`, `molten` first.
**Done when:** turbo + closing is as stupid as it sounds.

## M8 — the rest of the content
Remaining environments and powers. This is where the hook system pays for itself: each one
should be a single file touching nothing else.

## M9 — level grammar and progression
Weighted draws, unlock curve, ~15 hand-authored seeds, level select.

## M10 — shipping
Mobile touch tuning, landscape lock, performance pass, save state, packaging.
