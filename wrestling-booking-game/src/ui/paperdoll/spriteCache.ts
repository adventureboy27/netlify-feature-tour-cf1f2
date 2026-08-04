// Composite each distinct sprite once, then every <PaperDoll> blits from the
// cached bitmap. This is what §2's performance budget means by "render
// sprites to cached canvases once and reuse the bitmaps" — the roster grid
// draws 100 busts and must do 100 blits, not 100 composites.
//
// Keying on selectionKey rather than the raw Appearance is deliberate: two
// wrestlers whose trait vectors differ only in ways the atlas can't express
// composite to the same bitmap and should share one.

import type { Appearance } from '../../engine/types';
import type { AtlasSheets } from './atlas/sheets';
import { composeSpriteCanvas } from './atlas/compose';
import { selectSprite, selectionKey } from './atlas/traits';

// Big enough that a full roster screen never evicts; small enough that the
// editor's slider-dragging can't grow it without bound.
const MAX_ENTRIES = 512;

const cache = new Map<string, HTMLCanvasElement>();

export function getSourceCanvas(sheets: AtlasSheets, appearance: Appearance, gender: 'm' | 'f'): HTMLCanvasElement {
  const selection = selectSprite(appearance, gender);
  const key = selectionKey(selection);

  const cached = cache.get(key);
  if (cached) return cached;

  const canvas = composeSpriteCanvas(sheets, selection);
  if (cache.size >= MAX_ENTRIES) cache.clear();
  cache.set(key, canvas);
  return canvas;
}

export function clearSpriteCache(): void {
  cache.clear();
}
