// "Make sure no three wrestlers look the same."
//
// The distinctness rule lives in the engine (generateDistinctAppearance) and
// works on trait vectors. This file checks the thing the player actually sees:
// take a population generated exactly the way a world generates one, composite
// every one of them, and count how many end up wearing the same face.
//
// It is a measurement test rather than a unit test, and it is deliberately
// slack about the exact numbers — the point is the shape of the distribution,
// not a fingerprint of one seed. What it will not tolerate is three people
// sharing a sprite, which is the promise being kept.

import { describe, expect, it } from 'vitest';
import { rngFromSeed } from '../../../engine/rng';
import { generateDistinctAppearance, RENDERED_APPEARANCE_KEYS, APPEARANCE_TRAIT_RANGES } from '../../../engine/generate/appearance';
import type { Appearance } from '../../../engine/types';
import { SHAPE_COMBOS, SHAPE_COMBOS_PER_FRAME, FRAMES } from './manifest';
import { frameFor, selectCells, selectSprite, selectionKey } from './traits';

/** A roster the way a world builds one: each face vetted against the ones before it. */
function population(seed: string, size: number): { appearance: Appearance; gender: 'm' | 'f' }[] {
  const rng = rngFromSeed(seed);
  const seen: Appearance[] = [];
  const out: { appearance: Appearance; gender: 'm' | 'f' }[] = [];
  for (let i = 0; i < size; i++) {
    // Roughly the split a generated world produces; the exact ratio does not
    // matter here, only that both frames are represented.
    const gender: 'm' | 'f' = i % 4 === 0 ? 'f' : 'm';
    const appearance = generateDistinctAppearance(rng, seen, gender);
    seen.push(appearance);
    out.push({ appearance, gender });
  }
  return out;
}

function crowding(keys: readonly string[]): { distinct: number; worst: number; sharedByThree: number } {
  const counts = new Map<string, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  const values = [...counts.values()];
  return {
    distinct: counts.size,
    worst: Math.max(...values),
    sharedByThree: values.filter((v) => v >= 3).length,
  };
}

describe('the atlas has room for a whole business', () => {
  it('cuts more silhouettes than any world will ever need', () => {
    // 14 heads x 7 beards x 6 face gear x 6 tops x 6 bottoms x 5 boots.
    expect(SHAPE_COMBOS_PER_FRAME).toBe(105_840);
    expect(SHAPE_COMBOS).toBe(SHAPE_COMBOS_PER_FRAME * FRAMES.length);
    expect(SHAPE_COMBOS).toBeGreaterThan(1_000_000);
  });

  it('draws every trait it claims to draw, and nothing it does not', () => {
    // The guard on RENDERED_APPEARANCE_KEYS. The engine's distinctness rule
    // trusts that list; this is what keeps it honest when the atlas grows.
    const base = population('rendered-keys', 1)[0]!.appearance;
    const baseline = selectionKey(selectSprite(base, 'm'));

    for (const trait of Object.keys(APPEARANCE_TRAIT_RANGES) as (keyof Appearance)[]) {
      let changesTheSprite = false;
      for (let value = 0; value <= APPEARANCE_TRAIT_RANGES[trait as keyof typeof APPEARANCE_TRAIT_RANGES]; value++) {
        if (selectionKey(selectSprite({ ...base, [trait]: value }, 'm')) !== baseline) {
          changesTheSprite = true;
          break;
        }
      }
      expect(
        RENDERED_APPEARANCE_KEYS.includes(trait),
        changesTheSprite
          ? `${trait} changes the sprite but is missing from RENDERED_APPEARANCE_KEYS`
          : `${trait} is listed as rendered but draws nothing`,
      ).toBe(changesTheSprite);
    }
  });
});

describe('nobody has a double', () => {
  // A full roster plus every rival promotion's, several times over. Bigger
  // than any save will hold.
  const SIZE = 2000;
  const people = population('lookalikes', SIZE);
  const shapes = people.map(({ appearance, gender }) => {
    const cells = selectCells(appearance, gender);
    return `${selectSprite(appearance, gender).frame}|${Object.values(cells).join()}`;
  });
  const sprites = people.map(({ appearance, gender }) => selectionKey(selectSprite(appearance, gender)));

  it('never puts three people in the same body', () => {
    const { worst, sharedByThree } = crowding(shapes);
    // Before the face and gear slots existed this was 200 silhouettes on three
    // or more people, and one of them on ten.
    expect(sharedByThree).toBe(0);
    expect(worst).toBeLessThanOrEqual(2);
  });

  it('never draws the same wrestler twice, once colour is counted', () => {
    const { distinct, worst } = crowding(sprites);
    expect(worst).toBe(1);
    expect(distinct).toBe(SIZE);
  });

  it('never draws a bearded woman, whatever the save says', () => {
    // Generation stopped rolling facial hair for women, but a v16 save, an
    // imported roster file and the editor's sliders can all still carry a
    // value. The renderer is the backstop.
    const { appearance } = population('bearded-lady', 1)[0]!;
    for (let facialHair = 0; facialHair <= APPEARANCE_TRAIT_RANGES.facialHair; facialHair++) {
      expect(selectCells({ ...appearance, facialHair }, 'f').face).toBe('clean');
    }
    // And the masc frame still uses the whole range, so this is a rule about
    // the frame rather than a dead slot.
    const reached = new Set<string>();
    for (let facialHair = 0; facialHair <= APPEARANCE_TRAIT_RANGES.facialHair; facialHair++) {
      reached.add(selectCells({ ...appearance, facialHair, mask: 0 }, 'm').face);
    }
    expect(reached.size).toBe(7);
  });

  it('still gives the women plenty to look like', () => {
    const women = population('women-only', 300).map(({ appearance }) => appearance);
    const keys = women.map((a) => [frameFor('f', a), ...Object.values(selectCells(a, 'f'))].join('|'));
    const { worst, sharedByThree } = crowding(keys);
    expect(sharedByThree).toBe(0);
    expect(worst).toBeLessThanOrEqual(2);
  });

  it('keeps a starting roster completely distinct', () => {
    const roster = population('one-company', 30);
    const keys = roster.map(({ appearance, gender }) =>
      [selectSprite(appearance, gender).frame, ...Object.values(selectCells(appearance, gender))].join('|'),
    );
    expect(new Set(keys).size).toBe(roster.length);
  });
});
