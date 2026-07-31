# TAW

Marble survival battle royale. Five marbles, one board, last one rolling wins.

## Drop this into Claude Code

```bash
cd taw-project
claude
```

Claude Code reads `CLAUDE.md` automatically. Then:

> Read CLAUDE.md and docs/. Start milestone M1 from docs/BUILD-ORDER.md.
> Scaffold the Vite project and build the roll: one marble, flick to launch,
> constant rolling resistance, wall bounce, canvas 2D. Nothing else yet.

Do M1 and M2 before touching three.js. The roll is the whole game.

## What's here

| file | what it is |
|---|---|
| `CLAUDE.md` | project context, auto-loaded. non-negotiable rules and architecture. |
| `docs/DESIGN.md` | the design bible. loop, colour, surfaces, audio, art direction. |
| `docs/BUILD-ORDER.md` | ten milestones in dependency order. |
| `docs/ASSETS.md` | CC0 sources for HDRIs, PBR textures, audio, fonts. |
| `src/data/environments.js` | 26 environments. 3 fully implemented as patterns. |
| `src/data/powers.js` | 26 powers. 3 fully implemented as patterns. |

26 × 26 = 676 combinations, plus the no-power levels.

## Before you start

Keep the canvas prototype open next to you. It has the roll feel, the flick control,
the surface friction table and the six-layer audio start. It is the reference for
"does this feel right", not the codebase.
