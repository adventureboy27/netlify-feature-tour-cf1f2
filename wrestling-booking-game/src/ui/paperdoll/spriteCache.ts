// Sprite cache — draw each distinct (Appearance, gender) pair once to an
// offscreen canvas at the fixed internal resolution, then every PaperDoll
// instance blits from that cached bitmap instead of re-running the layer
// draw calls. This is what §2's performance budget means by "render
// sprites to cached canvases once and reuse the bitmaps" for the 60-bust
// roster grid.

import type { Appearance } from '../../engine/types';
import { drawPaperDoll, GRID_W, GRID_H } from './render';

const cache = new Map<string, HTMLCanvasElement>();

function cacheKey(appearance: Appearance, gender: 'm' | 'f'): string {
  // Stable because Appearance's field set is fixed — this isn't user input.
  return gender + JSON.stringify(appearance);
}

export function getSourceCanvas(appearance: Appearance, gender: 'm' | 'f'): HTMLCanvasElement {
  const key = cacheKey(appearance, gender);
  const cached = cache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = GRID_W;
  canvas.height = GRID_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  drawPaperDoll(ctx, appearance, gender);

  cache.set(key, canvas);
  return canvas;
}

/** Exposed for the editor, which redraws on every trait tweak and shouldn't leak cache entries. */
export function clearSpriteCache(): void {
  cache.clear();
}
