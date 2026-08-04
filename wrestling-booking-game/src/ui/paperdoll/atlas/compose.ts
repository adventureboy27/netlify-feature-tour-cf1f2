// Composite one wrestler out of four atlas cells.
//
// Every cell shares the same 64x96 canvas and the same top-left origin, so
// this is a single pass over 6,144 pixels: walk the slots back to front and
// let the last non-transparent index win, resolving each slot's index through
// that slot's own color LUT on the way out.

import { FRAME_W, FRAME_H, DRAW_ORDER, cellOriginX } from './manifest';
import { buildPaletteLut } from './indexPalette';
import type { AtlasSheets } from './sheets';
import type { SpriteSelection } from './traits';

// §7 layer 1. Rasterized by hand rather than filled with ctx.ellipse because
// a canvas fill is antialiased, and a soft edge under a hard-edged sprite is
// exactly the smudge the pixel-art look is trying to avoid.
const SHADOW = { centerX: FRAME_W / 2, centerY: 93, radiusX: 15, radiusY: 2.4, alpha: 90 };

function paintShadow(pixels: Uint8ClampedArray): void {
  for (let y = Math.floor(SHADOW.centerY - SHADOW.radiusY); y <= Math.ceil(SHADOW.centerY + SHADOW.radiusY); y++) {
    if (y < 0 || y >= FRAME_H) continue;
    const dy = (y - SHADOW.centerY) / SHADOW.radiusY;
    for (let x = 0; x < FRAME_W; x++) {
      const dx = (x - SHADOW.centerX) / SHADOW.radiusX;
      if (dx * dx + dy * dy > 1) continue;
      const o = (y * FRAME_W + x) * 4;
      pixels[o] = 0;
      pixels[o + 1] = 0;
      pixels[o + 2] = 0;
      pixels[o + 3] = SHADOW.alpha;
    }
  }
}

/** Render a selection into RGBA pixels at the atlas's native 64x96. */
export function composeSpritePixels(sheets: AtlasSheets, selection: SpriteSelection): ImageData {
  const image = new ImageData(FRAME_W, FRAME_H);
  const pixels = image.data;
  paintShadow(pixels);

  for (const slot of DRAW_ORDER) {
    const sheet = sheets[selection.frame][slot];
    const lut = buildPaletteLut(selection.slotColors[slot]);
    const originX = cellOriginX(slot, selection.cells[slot]);

    for (let y = 0; y < FRAME_H; y++) {
      const sheetRow = y * sheet.width + originX;
      const frameRow = y * FRAME_W;
      for (let x = 0; x < FRAME_W; x++) {
        const index = sheet.data[sheetRow + x]!;
        if (index === 0) continue; // transparent in this cell — leave what's underneath
        const from = index * 4;
        const to = (frameRow + x) * 4;
        pixels[to] = lut[from]!;
        pixels[to + 1] = lut[from + 1]!;
        pixels[to + 2] = lut[from + 2]!;
        pixels[to + 3] = lut[from + 3]!;
      }
    }
  }

  return image;
}

/** Render a selection to an offscreen canvas ready to be blitted at any scale. */
export function composeSpriteCanvas(sheets: AtlasSheets, selection: SpriteSelection): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = FRAME_W;
  canvas.height = FRAME_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  ctx.putImageData(composeSpritePixels(sheets, selection), 0, 0);
  return canvas;
}
