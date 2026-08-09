# CLAUDE.md

Project brief for Claude Code. Keep this file in the repo root.

## What we're building

A phone-first, offline, browser-based **wrestling promotion management game**.
The player is a booker: they build show cards, sign and manage talent, run
storylines, and grow a promotion across simulated decades.

**The player never watches or plays a match.** The simulation decides every
outcome. Results arrive as a short highlight write-up.

## The spec

`booking-game-design.md` is the full specification. It is long — read §0 first
(the working agreement), then §1-3, then §23 (milestones). Consult the rest by
section as you build.

**Do not read the whole document into context at once.** Work from §0 plus the
sections relevant to the current milestone.

## Non-negotiables

- The sim always picks the winner. No scripted finishes, no re-sims.
- Odds shown as words ("heavy favorite"), never percentages.
- Stats shown as bars and trend arrows, never numbers.
- The game never warns the player before a bad decision.
- Show results appear all at once at the end of the night.
- **Nothing happens to a person off-screen.** Every injury, death, retirement,
  and departure is reported *and says how it happened* — which match, which
  spot, what gave out. The player must never discover a change by noticing a
  status icon on a roster card. If a system can hurt somebody, that system
  owes the write-up a sentence.
- Fully offline. No network calls anywhere.

## Architecture rules

- `src/engine/` is pure TypeScript. No React, no store, no DOM, no
  `Math.random()`, no `Date.now()`. Everything is `(state, settings, rng)`.
- No magic numbers in `engine/`. Constants live in `WorldSettings` or `data/`.
- Content (events, gimmicks, names, moves, territories) lives in `data/` as
  typed arrays so it can grow without touching logic.
- Tests cover the simulation, not the UI.
- Wrestler art is a generated indexed sprite atlas, not runtime-drawn shapes.
  `tools/wrestler_atlas.py` emits it; `src/ui/paperdoll/README.md` explains the
  pipeline, how to regenerate, and which traits the atlas can't express yet.
  This supersedes §7's opening "No image assets."

## Build order

M0 engine skeleton + balance harness → M1 pixel-art paper-dolls + editor →
M2 core playable loop → M3 consequences and locker room → M4 stack the deck →
M5 the world → M5.5 chaos → M6 territories and legacy.

Do not jump ahead. M2 must be playable before M3 starts.

## Commands

```
npm run dev        # Vite dev server
npm run sim        # Headless balance harness — run after every sim change
npm run test       # Unit tests
npm run build      # Production PWA build
npm run play       # Build, then fold it into one openable HTML file
```

`npm run play` writes `dist/wrestling-booker.html` — the whole game in a
single file, CSS and JS inlined, sprite atlas already data-URI'd by Vite.
Open it directly, no server; mail it to a phone and it works there too. The
game is offline-only by design, so nothing is lost in the folding.

## When the spec is ambiguous

Pick the option that produces a harder, more interesting decision for the
player. Leave a `// DESIGN:` comment explaining the choice. Don't stall.

If the spec contradicts itself, the later section wins — and flag it.
