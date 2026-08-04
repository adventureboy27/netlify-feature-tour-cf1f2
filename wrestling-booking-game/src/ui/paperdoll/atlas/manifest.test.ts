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
  type AtlasFrame,
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

  it.each(FRAMES)('lists %s cells in the generator order, with matching counts', (frame: AtlasFrame) => {
    const generated = atlas.frames[frame] as Record<AtlasSlot, { cells: string[]; count: number; file: string }>;
    for (const slot of DRAW_ORDER) {
      expect(generated[slot].cells).toEqual([...SLOT_CELLS[slot]]);
      expect(generated[slot].count).toBe(SLOT_CELLS[slot].length);
      expect(generated[slot].file).toBe(`${frame}_${slot}.png`);
    }
  });

  it('both frames cut the same cells, so a wrestler keeps their look across frames', () => {
    const masc = atlas.frames.masc as Record<AtlasSlot, { cells: string[] }>;
    const fem = atlas.frames.fem as Record<AtlasSlot, { cells: string[] }>;
    for (const slot of DRAW_ORDER) {
      expect(fem[slot].cells).toEqual(masc[slot].cells);
    }
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
