import { describe, it, expect } from 'vitest';
import type { Appearance } from '../../../engine/types';
import { generateAppearance, APPEARANCE_TRAIT_RANGES } from '../../../engine/generate/appearance';
import { rngFromSeed } from '../../../engine/rng';
import { SKIN_TONE_PALETTE, HAIR_COLOR_PALETTE, ATTIRE_PALETTE } from '../palette';
import { hexToRgb } from './indexPalette';
import { DRAW_ORDER, FRAMES, SLOT_CELLS } from './manifest';
import { frameFor, selectCells, selectSlotColors, selectSprite, selectionKey } from './traits';

const BASE: Appearance = {
  skinTone: 2,
  build: 1,
  height: 2,
  hairStyle: 1,
  hairColor: 3,
  facialHair: 0,
  faceShape: 0,
  eyes: 0,
  attireTop: 1,
  attireBottom: 0,
  boots: 0,
  mask: 0,
  accessory: 0,
  glasses: 0,
  shirt: 0,
  tattoos: 0,
  beltStyle: 0,
  primaryColor: 0,
  secondaryColor: 4,
  accentColor: 18,
};

const appearance = (overrides: Partial<Appearance>): Appearance => ({ ...BASE, ...overrides });

describe('frameFor', () => {
  it('picks the body from gender, build and height together', () => {
    expect(frameFor('m', appearance({ build: 1, height: 2 }))).toBe('masc_average_average');
    expect(frameFor('f', appearance({ build: 1, height: 2 }))).toBe('fem_average_average');
  });

  it('gives the ends of the build scale a different silhouette', () => {
    // build and height were generated, edited, saved and counted by the §7
    // distinctness check while changing nothing about the sprite at all.
    expect(frameFor('m', appearance({ build: 0, height: 2 }))).toBe('masc_slim_average');
    expect(frameFor('m', appearance({ build: 4, height: 2 }))).toBe('masc_heavy_average');
  });

  it('gives the ends of the height scale a different silhouette', () => {
    expect(frameFor('m', appearance({ build: 1, height: 0 }))).toBe('masc_average_short');
    expect(frameFor('m', appearance({ build: 1, height: 4 }))).toBe('masc_average_tall');
  });

  it('never asks the atlas for a body it does not have', () => {
    for (let build = 0; build <= 5; build++) {
      for (let height = 0; height <= 4; height++) {
        for (const gender of ['m', 'f'] as const) {
          expect(FRAMES, `${gender}/${build}/${height}`).toContain(
            frameFor(gender, appearance({ build, height })),
          );
        }
      }
    }
  });

  it('falls back to the average body rather than throwing on a value off the end', () => {
    expect(frameFor('m', appearance({ build: 99, height: 99 }))).toBe('masc_average_average');
  });
});

describe('selectCells', () => {
  it('maps every documented trait value to a real cell', () => {
    // The trait space §7 documents is wider than the atlas cuts; the point of
    // the mapping tables is that no value in range can fall off the end.
    for (let hairStyle = 0; hairStyle <= APPEARANCE_TRAIT_RANGES.hairStyle; hairStyle++) {
      expect(SLOT_CELLS.head).toContain(selectCells(appearance({ hairStyle })).head);
    }
    for (let attireTop = 0; attireTop <= APPEARANCE_TRAIT_RANGES.attireTop; attireTop++) {
      expect(SLOT_CELLS.upper).toContain(selectCells(appearance({ attireTop })).upper);
    }
    for (let attireBottom = 0; attireBottom <= APPEARANCE_TRAIT_RANGES.attireBottom; attireBottom++) {
      expect(SLOT_CELLS.lower).toContain(selectCells(appearance({ attireBottom })).lower);
    }
    for (let boots = 0; boots <= APPEARANCE_TRAIT_RANGES.boots; boots++) {
      expect(SLOT_CELLS.feet).toContain(selectCells(appearance({ boots })).feet);
    }
    for (let facialHair = 0; facialHair <= APPEARANCE_TRAIT_RANGES.facialHair; facialHair++) {
      expect(SLOT_CELLS.face).toContain(selectCells(appearance({ facialHair })).face);
    }
    for (let accessory = 0; accessory <= APPEARANCE_TRAIT_RANGES.accessory; accessory++) {
      expect(SLOT_CELLS.extra).toContain(selectCells(appearance({ accessory })).extra);
    }
    for (let glasses = 0; glasses <= APPEARANCE_TRAIT_RANGES.glasses; glasses++) {
      expect(SLOT_CELLS.extra).toContain(selectCells(appearance({ glasses })).extra);
    }
  });

  it('reaches every cell the atlas ships — no dead art', () => {
    const reached: Record<string, Set<string>> = {
      head: new Set(),
      face: new Set(),
      extra: new Set(),
      upper: new Set(),
      lower: new Set(),
      feet: new Set(),
    };
    for (let hairStyle = 0; hairStyle <= APPEARANCE_TRAIT_RANGES.hairStyle; hairStyle++) {
      reached.head!.add(selectCells(appearance({ hairStyle })).head);
    }
    reached.head!.add(selectCells(appearance({ mask: 1 })).head);
    for (let attireTop = 0; attireTop <= APPEARANCE_TRAIT_RANGES.attireTop; attireTop++) {
      reached.upper!.add(selectCells(appearance({ attireTop })).upper);
    }
    for (let attireBottom = 0; attireBottom <= APPEARANCE_TRAIT_RANGES.attireBottom; attireBottom++) {
      reached.lower!.add(selectCells(appearance({ attireBottom })).lower);
    }
    for (let boots = 0; boots <= APPEARANCE_TRAIT_RANGES.boots; boots++) {
      reached.feet!.add(selectCells(appearance({ boots })).feet);
    }
    for (let facialHair = 0; facialHair <= APPEARANCE_TRAIT_RANGES.facialHair; facialHair++) {
      reached.face!.add(selectCells(appearance({ facialHair })).face);
    }
    for (let accessory = 0; accessory <= APPEARANCE_TRAIT_RANGES.accessory; accessory++) {
      reached.extra!.add(selectCells(appearance({ accessory })).extra);
    }
    for (const slot of DRAW_ORDER) {
      expect([...reached[slot]!].sort()).toEqual([...SLOT_CELLS[slot]].sort());
    }
  });

  it('lets a mask override the hair layer entirely (§7 layer 8)', () => {
    for (let hairStyle = 0; hairStyle <= APPEARANCE_TRAIT_RANGES.hairStyle; hairStyle++) {
      expect(selectCells(appearance({ hairStyle, mask: 1 })).head).toBe('mask');
    }
    expect(selectCells(appearance({ hairStyle: 4, mask: 0 })).head).not.toBe('mask');
  });

  it('draws hairStyle 0 as the bald skull', () => {
    expect(selectCells(appearance({ hairStyle: 0 })).head).toBe('bald');
  });

  it('shaves a masked wrestler — the mask covers the jaw', () => {
    for (let facialHair = 0; facialHair <= APPEARANCE_TRAIT_RANGES.facialHair; facialHair++) {
      expect(selectCells(appearance({ facialHair, mask: 1 })).face).toBe('clean');
    }
  });

  it('lets glasses override an accessory, and nothing else', () => {
    // Somebody wearing a headband and shades wears the shades: you cannot put
    // a headband over your eyes.
    const withBoth = selectCells(appearance({ accessory: 2, glasses: 1 }));
    expect(withBoth.extra).toBe('shades');
    expect(selectCells(appearance({ accessory: 2, glasses: 0 })).extra).toBe('headband');
  });

  it('keeps barefoot rare — one boots value in ten, not one in five', () => {
    const barefoot = Array.from({ length: APPEARANCE_TRAIT_RANGES.boots + 1 }, (_, boots) =>
      selectCells(appearance({ boots })).feet,
    ).filter((cell) => cell === 'barefoot');
    expect(barefoot).toHaveLength(1);
  });

  it('is deterministic', () => {
    const traits = appearance({ hairStyle: 11, attireTop: 9, attireBottom: 7, boots: 4 });
    expect(selectCells(traits)).toEqual(selectCells({ ...traits }));
  });
});

describe('selectSlotColors', () => {
  it('routes each color trait to the slot it dresses', () => {
    const colors = selectSlotColors(BASE);
    expect(colors.head.mat1).toEqual(hexToRgb(HAIR_COLOR_PALETTE[BASE.hairColor]!));
    expect(colors.upper.mat1).toEqual(hexToRgb(ATTIRE_PALETTE[BASE.primaryColor]!));
    expect(colors.lower.mat1).toEqual(hexToRgb(ATTIRE_PALETTE[BASE.secondaryColor]!));
    expect(colors.feet.mat1).toEqual(hexToRgb(ATTIRE_PALETTE[BASE.primaryColor]!));
    // Facial hair is hair, all the way down — it is the one slot that carries
    // no attire colour at all.
    expect(colors.face.mat1).toEqual(hexToRgb(HAIR_COLOR_PALETTE[BASE.hairColor]!));
    expect(colors.face.mat2).toEqual(hexToRgb(HAIR_COLOR_PALETTE[BASE.hairColor]!));
    for (const slot of DRAW_ORDER.filter((s) => s !== 'face')) {
      expect(colors[slot].mat2).toEqual(hexToRgb(ATTIRE_PALETTE[BASE.accentColor]!));
      expect(colors[slot].skin).toEqual(hexToRgb(SKIN_TONE_PALETTE[BASE.skinTone]!));
    }
  });

  it('colors a mask as attire rather than as hair', () => {
    const masked = selectSlotColors(appearance({ mask: 3 }));
    expect(masked.head.mat1).toEqual(hexToRgb(ATTIRE_PALETTE[BASE.primaryColor]!));
    expect(masked.head.mat1).not.toEqual(hexToRgb(HAIR_COLOR_PALETTE[BASE.hairColor]!));
  });
});

describe('selectionKey', () => {
  it('separates wrestlers who differ in a rendered trait', () => {
    const key = (traits: Appearance) => selectionKey(selectSprite(traits, 'm'));
    expect(key(BASE)).not.toBe(key(appearance({ attireBottom: 5 })));
    expect(key(BASE)).not.toBe(key(appearance({ primaryColor: 7 })));
    expect(key(BASE)).not.toBe(key(appearance({ skinTone: 9 })));
    expect(key(BASE)).not.toBe(selectionKey(selectSprite(BASE, 'f')));
  });

  it('shares one cached sprite between wrestlers the atlas renders identically', () => {
    // beltStyle is not part of the body sprite (§7 layer 11 is drawn by the
    // caller that knows title state), so it must not fragment the cache.
    expect(selectionKey(selectSprite(BASE, 'm'))).toBe(selectionKey(selectSprite(appearance({ beltStyle: 4 }), 'm')));
  });

  it('holds up across a generated roster', () => {
    const rng = rngFromSeed('selection-key');
    for (let i = 0; i < 200; i++) {
      const traits = generateAppearance(rng);
      const selection = selectSprite(traits, i % 2 === 0 ? 'm' : 'f');
      expect(selectionKey(selection)).toBe(selectionKey(selectSprite(traits, i % 2 === 0 ? 'm' : 'f')));
      for (const slot of DRAW_ORDER) {
        expect(SLOT_CELLS[slot]).toContain(selection.cells[slot]);
      }
    }
  });
});
