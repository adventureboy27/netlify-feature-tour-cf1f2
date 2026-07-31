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
export const surfaces = {
  oak: {
    id: 'oak', name: 'Oak', decel: 0.282, wallE: 0.70, viscous: 0.12,
    character: 'the default. rolls true. warm thock.'
  },
  ice: {
    id: 'ice', name: 'Ice', decel: 0.170, wallE: 0.90, viscous: 0.05,
    character: 'will not let you stop. high hiss.'
  },
  sand: {
    id: 'sand', name: 'Sand', decel: 0.700, wallE: 0.30, viscous: 0.35,
    character: 'eats the shot. dead thud. leaves ruts.'
  },
  glass: {
    id: 'glass', name: 'Glass', decel: 0.205, wallE: 0.88, viscous: 0.08,
    character: 'fast, slick, loud.'
  },
  granite: {
    id: 'granite', name: 'Granite', decel: 0.340, wallE: 0.74, viscous: 0.14,
    character: 'slightly duller oak.'
  }
};

export const surfaceIds = Object.keys(surfaces);

export function getSurface(id) {
  return surfaces[id] ?? surfaces.oak;
}
