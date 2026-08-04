// Sheet loader — turns the shipped PNGs back into palette-index buffers.
//
// The sheets are indexed PNGs, but a browser will only ever hand us decoded
// RGBA; there is no API for reading a PNG's palette indices. So we decode
// once, at startup, and run the generator's DEFAULT_PALETTE backwards to
// recover the index each pixel was authored as. From then on the app holds
// what the generator actually meant: a Uint8Array of palette slots that any
// wrestler's color LUT can be applied to.
//
// The PNGs are inlined as data URIs at build time (`?inline`, ~11 KB total
// across all eight). Nothing here does I/O, which keeps the "fully offline,
// no network calls anywhere" rule true by construction rather than by
// service-worker configuration.

import mascHeadUrl from './sheets/masc_head.png?inline';
import mascUpperUrl from './sheets/masc_upper.png?inline';
import mascLowerUrl from './sheets/masc_lower.png?inline';
import mascFeetUrl from './sheets/masc_feet.png?inline';
import femHeadUrl from './sheets/fem_head.png?inline';
import femUpperUrl from './sheets/fem_upper.png?inline';
import femLowerUrl from './sheets/fem_lower.png?inline';
import femFeetUrl from './sheets/fem_feet.png?inline';

import { FRAME_H, FRAMES, DRAW_ORDER, sheetWidth, type AtlasFrame, type AtlasSlot } from './manifest';
import { SOURCE_PALETTE, PALETTE_SIZE } from './indexPalette';

const SHEET_URLS: Record<AtlasFrame, Record<AtlasSlot, string>> = {
  masc: { head: mascHeadUrl, upper: mascUpperUrl, lower: mascLowerUrl, feet: mascFeetUrl },
  fem: { head: femHeadUrl, upper: femUpperUrl, lower: femLowerUrl, feet: femFeetUrl },
};

export interface IndexedSheet {
  width: number;
  height: number;
  /** One palette index per pixel, row-major. */
  data: Uint8Array;
}

export type AtlasSheets = Record<AtlasFrame, Record<AtlasSlot, IndexedSheet>>;

// Exact RGB -> index. Every pixel in a correctly generated sheet hits this;
// the nearest-color fallback below only exists so a browser that decides to
// color-manage the PNGs degrades to the right sprite instead of a blank one.
const EXACT_LOOKUP = new Map<number, number>();
for (let index = 1; index < PALETTE_SIZE; index++) {
  const [r, g, b] = SOURCE_PALETTE[index]!;
  EXACT_LOOKUP.set((r << 16) | (g << 8) | b, index);
}

function nearestIndex(r: number, g: number, b: number): number {
  let best = 1;
  let bestDistance = Infinity;
  for (let index = 1; index < PALETTE_SIZE; index++) {
    const [pr, pg, pb] = SOURCE_PALETTE[index]!;
    const distance = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  }
  return best;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to decode a wrestler sprite sheet'));
    image.src = src;
  });
}

function toIndexedSheet(image: HTMLImageElement, expectedWidth: number): IndexedSheet {
  const width = image.naturalWidth || expectedWidth;
  const height = image.naturalHeight || FRAME_H;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas context unavailable');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0);

  const { data: rgba } = ctx.getImageData(0, 0, width, height);
  const data = new Uint8Array(width * height);
  for (let pixel = 0; pixel < data.length; pixel++) {
    const o = pixel * 4;
    if (rgba[o + 3]! < 128) continue; // index 0 — the sheets have no partial alpha
    const packed = (rgba[o]! << 16) | (rgba[o + 1]! << 8) | rgba[o + 2]!;
    data[pixel] = EXACT_LOOKUP.get(packed) ?? nearestIndex(rgba[o]!, rgba[o + 1]!, rgba[o + 2]!);
  }

  return { width, height, data };
}

let sheetsPromise: Promise<AtlasSheets> | null = null;
let loadedSheets: AtlasSheets | null = null;

/** Decode every sheet. Memoized — concurrent callers share one decode. */
export function loadAtlasSheets(): Promise<AtlasSheets> {
  if (sheetsPromise) return sheetsPromise;

  sheetsPromise = (async () => {
    const entries = FRAMES.flatMap((frame) => DRAW_ORDER.map((slot) => ({ frame, slot })));
    const decoded = await Promise.all(
      entries.map(async ({ frame, slot }) => toIndexedSheet(await loadImage(SHEET_URLS[frame][slot]), sheetWidth(slot))),
    );

    const sheets = {} as AtlasSheets;
    entries.forEach(({ frame, slot }, i) => {
      sheets[frame] ??= {} as Record<AtlasSlot, IndexedSheet>;
      sheets[frame][slot] = decoded[i]!;
    });

    loadedSheets = sheets;
    return sheets;
  })();

  return sheetsPromise;
}

/** Synchronous accessor for code that already knows the sheets are in. */
export function getLoadedAtlasSheets(): AtlasSheets | null {
  return loadedSheets;
}
