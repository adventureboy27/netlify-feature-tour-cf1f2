// Sprite cache — draw each distinct Appearance once to an offscreen canvas
// at the fixed internal resolution, then every PaperDoll instance blits from
// that cached bitmap instead of re-running the layer draw calls. This is
// what §2's performance budget means by "render sprites to cached canvases
// once and reuse the bitmaps" for the 60-bust roster grid.

import type { Appearance } from '../../engine/types';
import { drawPaperDoll, GRID_W, GRID_H } from './render';

const cache = new Map<string, HTMLCanvasElement>();

function appearanceKey(appearance: Appearance): string {
  // Stable because Appearance's field set is fixed — this isn't user input.
  return JSON.stringify(appearance);
}

export function getSourceCanvas(appearance: Appearance): HTMLCanvasElement {
  const key = appearanceKey(appearance);
  const cached = cache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = GRID_W;
  canvas.height = GRID_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  drawPaperDoll(ctx, appearance);

  cache.set(key, canvas);
  return canvas;
}

/** Exposed for the editor, which redraws on every trait tweak and shouldn't leak cache entries. */
export function clearSpriteCache(): void {
  cache.clear();
}
