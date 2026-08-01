/**
 * Surfaces — the table that drives friction, restitution, and (eventually) sound
 * (docs/DESIGN.md surfaces table). oak has been the hardcoded default since M1; this is
 * where the other four actually become selectable, and the single source of truth for oak
 * too now (core/world.js used to define its own copy).
 *
 * `decel`/`wallE` are from docs/DESIGN.md directly. `viscous` isn't in that table — it's an
 * M1 implementation detail (constant deceleration plus a SMALL viscous term, never pure
 * exponential decay) — so these are scaled to match each surface's character rather than
 * specified numbers: ice barely drags at all, sand's high friction gets a thick viscous term
 * to go with it.
 *
 * `character` is prose intent for audio/beds.js — a per-surface bias on the rolling bed's
 * tone, not a separate synthesis path.
 */
// Retuned from the original DESIGN.md numbers (kept in the comment below each entry) after
// playtesting found marbles were settling after 1-2 wall hits instead of actually rolling
// around — glass on a slick floor should ping-pong, not thud once and stop. Lower decel/
// viscous (more distance) plus higher wallE (bounces keep more of their energy) roughly
// triples full-power travel distance and wall-hit count on oak, more on the slicker surfaces
// — verified directly (src/content/surfaces.js has no test file; checked via sim/physics.js
// simulation, not just guessed) rather than just increasing numbers and hoping. Each
// surface's relative character is preserved: sand is still clearly the stickiest, ice still
// clearly the slickest, this just raises the floor on all of them.
export const surfaces = {
  oak: {
    id: 'oak', name: 'Oak', decel: 0.100, wallE: 0.90, viscous: 0.045, // was 0.282 / 0.70 / 0.12
    character: 'the default. rolls true. warm thock.'
  },
  ice: {
    id: 'ice', name: 'Ice', decel: 0.060, wallE: 0.96, viscous: 0.020, // was 0.170 / 0.90 / 0.05
    character: 'will not let you stop. high hiss.'
  },
  sand: {
    id: 'sand', name: 'Sand', decel: 0.350, wallE: 0.60, viscous: 0.16, // was 0.700 / 0.30 / 0.35
    character: 'eats the shot. dead thud. leaves ruts.'
  },
  glass: {
    id: 'glass', name: 'Glass', decel: 0.075, wallE: 0.95, viscous: 0.030, // was 0.205 / 0.88 / 0.08
    character: 'fast, slick, loud.'
  },
  granite: {
    id: 'granite', name: 'Granite', decel: 0.130, wallE: 0.90, viscous: 0.050, // was 0.340 / 0.74 / 0.14
    character: 'slightly duller oak.'
  }
};

export const surfaceIds = Object.keys(surfaces);

export function getSurface(id) {
  return surfaces[id] ?? surfaces.oak;
}
