// The map positions are hand-placed, so they are exactly the kind of data
// that drifts silently. These are the properties the drawn map depends on —
// each one of them was a bug first.

import { describe, expect, it } from 'vitest';
import { TERRITORIES } from './territories';
import { CIRCUITS } from './circuits';

const at = (id: string) => {
  const town = TERRITORIES.find((t) => t.id === id);
  if (!town) throw new Error(`no territory ${id}`);
  return town;
};

describe('every town has a place on the map', () => {
  it('is inside the drawn area, with room for its label', () => {
    for (const town of TERRITORIES) {
      expect(town.x, town.id).toBeGreaterThanOrEqual(8);
      expect(town.x, town.id).toBeLessThanOrEqual(92);
      expect(town.y, town.id).toBeGreaterThanOrEqual(8);
      // The label sits below the dot, so the bottom needs more clearance.
      expect(town.y, town.id).toBeLessThanOrEqual(90);
    }
  });

  it('does not stack two towns on top of each other', () => {
    for (let i = 0; i < TERRITORIES.length; i++) {
      for (let j = i + 1; j < TERRITORIES.length; j++) {
        const a = TERRITORIES[i]!;
        const b = TERRITORIES[j]!;
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        expect(distance, `${a.id} and ${b.id} are on top of each other`).toBeGreaterThan(12);
      }
    }
  });
});

describe('the map agrees with the weather', () => {
  // The map and the climate system describe the same place. If a northern
  // town is drawn in the south, the player is being told two different things
  // about Ironbelt City and one of them is wrong.
  it('puts northern towns north and desert towns south', () => {
    for (const town of TERRITORIES) {
      if (town.climate === 'northern') expect(town.y, town.id).toBeLessThan(40);
      if (town.climate === 'desert') expect(town.y, town.id).toBeGreaterThan(55);
    }
  });

  it('puts coastal towns on a coast', () => {
    for (const town of TERRITORIES.filter((t) => t.climate === 'coastal')) {
      const nearAnEdge = town.x <= 25 || town.x >= 75;
      expect(nearAnEdge, `${town.id} is coastal but inland at x=${town.x}`).toBe(true);
    }
  });

  it('keeps mountain and plains towns off the coasts', () => {
    for (const town of TERRITORIES.filter((t) => t.climate === 'mountain' || t.climate === 'plains')) {
      expect(town.x, town.id).toBeGreaterThan(18);
      expect(town.x, town.id).toBeLessThan(78);
    }
  });
});

describe('a circuit is a loop you could drive', () => {
  /** Twice the triangle area — zero when the three towns are in a line. */
  function spread(points: { x: number; y: number }[]): number {
    const [a, b, c] = points;
    if (!a || !b || !c) return 0;
    return Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y));
  }

  it('draws as a shape rather than a sliver', () => {
    // The bug this catches, twice: three towns nearly in a line make the
    // circuit polygon render as a double-thick line, so the loop stops
    // reading as a route and starts reading as a rendering error.
    for (const circuit of CIRCUITS) {
      const points = circuit.territoryIds.map(at);
      expect(spread(points), `${circuit.id} is drawn almost as a straight line`).toBeGreaterThan(300);
    }
  });

  it('keeps its towns close enough to be one road', () => {
    for (const circuit of CIRCUITS) {
      const points = circuit.territoryIds.map(at);
      for (const a of points) {
        const nearest = Math.min(
          ...points.filter((b) => b.id !== a.id).map((b) => Math.hypot(a.x - b.x, a.y - b.y)),
        );
        expect(nearest, `${a.id} is stranded away from the rest of ${circuit.id}`).toBeLessThan(45);
      }
    }
  });

  it('does not interleave one circuit through the middle of another', () => {
    // Each loop should own its patch of the map, or the drawn routes cross
    // and none of them is legible. Measured as: a circuit's centre is closer
    // to its own towns than to any other circuit's centre.
    const centres = CIRCUITS.map((circuit) => {
      const points = circuit.territoryIds.map(at);
      return {
        id: circuit.id,
        x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
        y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
        radius: Math.max(...points.map((p) => Math.hypot(p.x - points[0]!.x, p.y - points[0]!.y))),
      };
    });
    for (const town of TERRITORIES) {
      const own = CIRCUITS.find((c) => c.territoryIds.includes(town.id))!;
      const ownCentre = centres.find((c) => c.id === own.id)!;
      const ownDistance = Math.hypot(town.x - ownCentre.x, town.y - ownCentre.y);
      for (const other of centres.filter((c) => c.id !== own.id)) {
        const otherDistance = Math.hypot(town.x - other.x, town.y - other.y);
        expect(otherDistance, `${town.id} sits inside ${other.id}`).toBeGreaterThan(ownDistance * 0.8);
      }
    }
  });
});
