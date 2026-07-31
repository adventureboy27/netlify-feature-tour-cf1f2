# TAW — design bible

## The pitch

Five marbles. One board. The board is trying to kill all of you, and it announced how
before you started. Last marble rolling wins the level.

## The core loop

```
LEVEL START
  announce environment  ("The floor is rotting.")
  announce power        ("Every marble is turbo.")   [some levels: none]
  build terrain from seed
REPEAT
  AIM      player flicks. direction = swipe direction. power = swipe length.
  LAUNCH   all five fire simultaneously. CPU marbles aim for open, safe ground.
  ROLL     2-5 seconds. rolling resistance, wall bounces, elastic marble collisions.
  SETTLE   everything stops. marbles take the colour of the patch they rest on.
  RESOLVE  win check FIRST, then terrain eliminations.
  DEGRADE  the environment gets one step worse. stinger + visual change.
UNTIL one marble remains
```

State machine in `sim/turn.js`: `AIM -> LAUNCH -> ROLL -> SETTLE -> RESOLVE -> DEGRADE -> AIM`

**The win check happens at the top of RESOLVE, before any terrain resolution.** If one
marble remains, the level ends there. See non-negotiable #4 in CLAUDE.md.

## Why it's fair

The player cannot predict the outcome, but they can always understand it. Uncertainty comes
from three honest sources:

- **Physics.** You cannot perfectly judge where a rolling marble stops.
- **Four opponents launching at the same instant.** You do not know who hits whom.
- **A board degrading on a schedule you were told about.**

Never from a hidden rule. Never from a die roll that names a victim.

## Colour

Colour is not decoration and it is not health. **Colour is a place.** Patches on the floor
are coloured; a marble resting on one takes that colour. Elsewhere it is bare.

In most levels this is readable flavour — it tells you at a glance who is sitting where.
In `roulette` it becomes the entire game.

## The roulette exception

`roulette` is the one environment that eliminates by colour rather than terrain, and it is
built as a spectacle rather than a rule to track:

- One colour is condemned **before the level starts**. It is on screen the whole time.
- While marbles roll they strobe rapidly through every colour.
- As a marble slows, its strobe slows with it — the wheel losing momentum.
- When it stops it locks to the colour of the patch beneath it, with a chime.
- Then the condemned colour detonates.

`soloOnly: true`. No power runs alongside it.

## Level grammar

A level is a seed. Everything else derives from it.

```js
level(n, seed) -> {
  environment,      // weighted draw, harder ones unlock with n
  power,            // or null. roughly 30% of levels have no power.
  surface,          // oak | ice | sand | glass | granite
  terrain,          // patch layout, ramps, bumpers, gutters, starting hazards
  opponents: 4,
  severityCurve     // how fast the environment degrades
}
```

- If `environment.soloOnly`, `power` is null.
- If `power.exclusive`, draw the environment from the non-soloOnly set.
- Early levels: mild environment, no power, oak. Introduce one system at a time.
- Hand-author ~15 memorable levels as fixed seeds. Generate the rest.

## Terrain vocabulary

Boards must not be only coloured circles. Generators mix:

| feature | behaviour |
|---|---|
| colour patch | cosmetic; sets marble colour on rest |
| hole | lethal, permanent, ragged edge with fractures |
| lava pool | lethal at any speed, glows, can grow |
| water | lethal, advances as a line |
| ramp | smooth gradient that bends trajectory |
| dome | convex bump, deflects outward |
| gutter | channel that captures and guides a slow marble |
| bumper | sprung, high restitution, kicks hard |
| ice patch | local friction override |
| tar | holds a marble for one turn |
| pillar | solid obstacle to bank off |
| crater | funnels toward its centre |
| grate | you fall through only below a speed threshold |

## Surfaces

The surface *is* the physics. One table drives friction, restitution and sound.

| surface | decel (W/s²) | wall e | character |
|---|---|---|---|
| oak | 0.282 | 0.70 | the default. rolls true. warm thock. |
| ice | 0.170 | 0.90 | will not let you stop. high hiss. |
| sand | 0.700 | 0.30 | eats the shot. dead thud. leaves ruts. |
| glass | 0.205 | 0.88 | fast, slick, loud. |
| granite | 0.340 | 0.74 | slightly duller oak. |

Marble-on-marble restitution 0.94. Max launch speed 0.95 board-widths/sec.
Rolling resistance is **constant deceleration plus a small viscous term** — never
exponential decay. That was the bug that made the prototype feel like air hockey instead
of glass on wood.

## Audio architecture

Six simultaneous layers. This is what makes it feel alive rather than beepy.

1. **Environment bed** — evolves with severity. The Closing is audibly tighter by turn eight.
2. **Rolling bed** — filtered noise. Gain tracks total board speed, filter frequency tracks
   the fastest marble. Voiced per surface.
3. **Power voice** — tied to the *player's* marble so you hear yourself apart from the pack.
   Turbo's engine note pitches with your own speed.
4. **Impacts** — pitch and brightness scale with force. Separate voices for marble-on-marble,
   rail, bumper, ramp.
5. **Turn stinger** — each environment's "it just got worse" cue.
6. **Death** — distinct per cause: burned, drowned, fell, shattered, knocked out, crushed.

Buses: `master -> [bed, roll, voice, impact, ui]`, each with its own gain so mixing lives in
one place. Duck the beds about 4 dB during a death.

## Art direction

Real materials, one warm key light from upper left, cool fill. No flat vector look, no neon.
The board should look like an object that exists.

- Marbles: `MeshPhysicalMaterial`, `transmission: 1`, `ior: 1.52`, `thickness` ≈ radius,
  `roughness: 0.05`, `clearcoat: 1`. Cat's-eye as a small second mesh inside.
- Environment: HDRI for reflections. This sells glass more than anything else.
- Floors: PBR sets — albedo, normal, roughness. Never a flat colour.
- Shadows: real shadow maps, soft, plus contact darkening under each marble.
- Camera: fixed three-quarter top-down with slight perspective so rails have thickness.
  Gentle shake on impacts and degrade events.
