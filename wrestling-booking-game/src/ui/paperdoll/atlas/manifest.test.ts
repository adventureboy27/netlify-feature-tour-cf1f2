// The typed manifest has to stay in lockstep with the JSON the sprite
// generator emits. If someone regenerates the atlas with different cells,
// this is what fails — rather than the game quietly drawing jeans where the
// tights used to be.

import { describe, it, expect } from 'vitest';
import atlas from './sheets/atlas.json';
import {
  FRAME_W,
  FRAME_H,
  FRAMES,
  DRAW_ORDER,
  SLOT_CELLS,
  cellIndex,
  cellOriginX,
  sheetWidth,
  type AtlasSlot,
} from './manifest';

describe('atlas manifest', () => {
  it('matches the generated atlas.json frame size and draw order', () => {
    expect(atlas.frame).toEqual({ w: FRAME_W, h: FRAME_H });
    expect(atlas.drawOrder).toEqual([...DRAW_ORDER]);
  });

  it('declares exactly the frames the generator emitted', () => {
    expect(Object.keys(atlas.frames).sort()).toEqual([...FRAMES].sort());
  });

  it.each([...FRAMES])('lists %s cells in the generator order, with matching counts', (frame) => {
    const generated = atlas.frames[frame] as Record<AtlasSlot, { cells: string[]; count: number; file: string }>;
    for (const slot of DRAW_ORDER) {
      expect(generated[slot].cells).toEqual([...SLOT_CELLS[slot]]);
      expect(generated[slot].count).toBe(SLOT_CELLS[slot].length);
      expect(generated[slot].file).toBe(`${frame}_${slot}.png`);
    }
  });

  it('every frame cuts the same cells, so a wrestler keeps their look whatever body they have', () => {
    // Eighteen bodies now — two genders, three builds, three heights. A
    // repackage must not silently change somebody's hair because they are
    // heavy rather than slim.
    const reference = atlas.frames.masc_average_average as Record<AtlasSlot, { cells: string[] }>;
    for (const frame of FRAMES) {
      const cut = atlas.frames[frame] as Record<AtlasSlot, { cells: string[] }>;
      for (const slot of DRAW_ORDER) {
        expect(cut[slot].cells, `${frame}/${slot}`).toEqual(reference[slot].cells);
      }
    }
  });

  it('covers every build and height the appearance vector can produce', () => {
    for (const gender of ['masc', 'fem']) {
      for (const build of ['slim', 'average', 'heavy']) {
        for (const height of ['short', 'average', 'tall']) {
          expect(FRAMES, `${gender}_${build}_${height}`).toContain(`${gender}_${build}_${height}`);
        }
      }
    }
    expect(FRAMES).toHaveLength(18);
  });

  it('locates cells at whole-frame offsets across the sheet', () => {
    expect(cellIndex('head', 'short')).toBe(0);
    expect(cellIndex('head', 'bald_beard')).toBe(7);
    expect(cellOriginX('head', 'mask')).toBe(6 * FRAME_W);
    expect(cellOriginX('lower', 'trunks')).toBe(0);
    expect(sheetWidth('feet')).toBe(5 * FRAME_W);
  });

  it('rejects a cell name the sheet does not contain', () => {
    // @ts-expect-error — the union is the point; this guards the runtime path.
    expect(() => cellIndex('upper', 'trenchcoat')).toThrow(/Unknown upper cell/);
  });
});
