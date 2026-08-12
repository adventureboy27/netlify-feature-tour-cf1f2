// Sheet loader — turns the shipped PNGs back into palette-index buffers.
//
// The sheets are indexed PNGs, but a browser will only ever hand us decoded
// RGBA; there is no API for reading a PNG's palette indices. So we decode
// once, at startup, and run the generator's DEFAULT_PALETTE backwards to
// recover the index each pixel was authored as. From then on the app holds
// what the generator actually meant: a Uint8Array of palette slots that any
// wrestler's color LUT can be applied to.
//
// The PNGs are inlined as data URIs at build time (`?inline`), six slots
// across eighteen bodies. Nothing here does I/O, which keeps the "fully offline,
// no network calls anywhere" rule true by construction rather than by
// service-worker configuration.

import mascSlimShortHeadUrl from './sheets/masc_slim_short_head.png?inline';
import mascSlimShortFaceUrl from './sheets/masc_slim_short_face.png?inline';
import mascSlimShortExtraUrl from './sheets/masc_slim_short_extra.png?inline';
import mascSlimShortUpperUrl from './sheets/masc_slim_short_upper.png?inline';
import mascSlimShortLowerUrl from './sheets/masc_slim_short_lower.png?inline';
import mascSlimShortFeetUrl from './sheets/masc_slim_short_feet.png?inline';
import mascSlimAverageHeadUrl from './sheets/masc_slim_average_head.png?inline';
import mascSlimAverageFaceUrl from './sheets/masc_slim_average_face.png?inline';
import mascSlimAverageExtraUrl from './sheets/masc_slim_average_extra.png?inline';
import mascSlimAverageUpperUrl from './sheets/masc_slim_average_upper.png?inline';
import mascSlimAverageLowerUrl from './sheets/masc_slim_average_lower.png?inline';
import mascSlimAverageFeetUrl from './sheets/masc_slim_average_feet.png?inline';
import mascSlimTallHeadUrl from './sheets/masc_slim_tall_head.png?inline';
import mascSlimTallFaceUrl from './sheets/masc_slim_tall_face.png?inline';
import mascSlimTallExtraUrl from './sheets/masc_slim_tall_extra.png?inline';
import mascSlimTallUpperUrl from './sheets/masc_slim_tall_upper.png?inline';
import mascSlimTallLowerUrl from './sheets/masc_slim_tall_lower.png?inline';
import mascSlimTallFeetUrl from './sheets/masc_slim_tall_feet.png?inline';
import mascAverageShortHeadUrl from './sheets/masc_average_short_head.png?inline';
import mascAverageShortFaceUrl from './sheets/masc_average_short_face.png?inline';
import mascAverageShortExtraUrl from './sheets/masc_average_short_extra.png?inline';
import mascAverageShortUpperUrl from './sheets/masc_average_short_upper.png?inline';
import mascAverageShortLowerUrl from './sheets/masc_average_short_lower.png?inline';
import mascAverageShortFeetUrl from './sheets/masc_average_short_feet.png?inline';
import mascAverageAverageHeadUrl from './sheets/masc_average_average_head.png?inline';
import mascAverageAverageFaceUrl from './sheets/masc_average_average_face.png?inline';
import mascAverageAverageExtraUrl from './sheets/masc_average_average_extra.png?inline';
import mascAverageAverageUpperUrl from './sheets/masc_average_average_upper.png?inline';
import mascAverageAverageLowerUrl from './sheets/masc_average_average_lower.png?inline';
import mascAverageAverageFeetUrl from './sheets/masc_average_average_feet.png?inline';
import mascAverageTallHeadUrl from './sheets/masc_average_tall_head.png?inline';
import mascAverageTallFaceUrl from './sheets/masc_average_tall_face.png?inline';
import mascAverageTallExtraUrl from './sheets/masc_average_tall_extra.png?inline';
import mascAverageTallUpperUrl from './sheets/masc_average_tall_upper.png?inline';
import mascAverageTallLowerUrl from './sheets/masc_average_tall_lower.png?inline';
import mascAverageTallFeetUrl from './sheets/masc_average_tall_feet.png?inline';
import mascHeavyShortHeadUrl from './sheets/masc_heavy_short_head.png?inline';
import mascHeavyShortFaceUrl from './sheets/masc_heavy_short_face.png?inline';
import mascHeavyShortExtraUrl from './sheets/masc_heavy_short_extra.png?inline';
import mascHeavyShortUpperUrl from './sheets/masc_heavy_short_upper.png?inline';
import mascHeavyShortLowerUrl from './sheets/masc_heavy_short_lower.png?inline';
import mascHeavyShortFeetUrl from './sheets/masc_heavy_short_feet.png?inline';
import mascHeavyAverageHeadUrl from './sheets/masc_heavy_average_head.png?inline';
import mascHeavyAverageFaceUrl from './sheets/masc_heavy_average_face.png?inline';
import mascHeavyAverageExtraUrl from './sheets/masc_heavy_average_extra.png?inline';
import mascHeavyAverageUpperUrl from './sheets/masc_heavy_average_upper.png?inline';
import mascHeavyAverageLowerUrl from './sheets/masc_heavy_average_lower.png?inline';
import mascHeavyAverageFeetUrl from './sheets/masc_heavy_average_feet.png?inline';
import mascHeavyTallHeadUrl from './sheets/masc_heavy_tall_head.png?inline';
import mascHeavyTallFaceUrl from './sheets/masc_heavy_tall_face.png?inline';
import mascHeavyTallExtraUrl from './sheets/masc_heavy_tall_extra.png?inline';
import mascHeavyTallUpperUrl from './sheets/masc_heavy_tall_upper.png?inline';
import mascHeavyTallLowerUrl from './sheets/masc_heavy_tall_lower.png?inline';
import mascHeavyTallFeetUrl from './sheets/masc_heavy_tall_feet.png?inline';
import femSlimShortHeadUrl from './sheets/fem_slim_short_head.png?inline';
import femSlimShortFaceUrl from './sheets/fem_slim_short_face.png?inline';
import femSlimShortExtraUrl from './sheets/fem_slim_short_extra.png?inline';
import femSlimShortUpperUrl from './sheets/fem_slim_short_upper.png?inline';
import femSlimShortLowerUrl from './sheets/fem_slim_short_lower.png?inline';
import femSlimShortFeetUrl from './sheets/fem_slim_short_feet.png?inline';
import femSlimAverageHeadUrl from './sheets/fem_slim_average_head.png?inline';
import femSlimAverageFaceUrl from './sheets/fem_slim_average_face.png?inline';
import femSlimAverageExtraUrl from './sheets/fem_slim_average_extra.png?inline';
import femSlimAverageUpperUrl from './sheets/fem_slim_average_upper.png?inline';
import femSlimAverageLowerUrl from './sheets/fem_slim_average_lower.png?inline';
import femSlimAverageFeetUrl from './sheets/fem_slim_average_feet.png?inline';
import femSlimTallHeadUrl from './sheets/fem_slim_tall_head.png?inline';
import femSlimTallFaceUrl from './sheets/fem_slim_tall_face.png?inline';
import femSlimTallExtraUrl from './sheets/fem_slim_tall_extra.png?inline';
import femSlimTallUpperUrl from './sheets/fem_slim_tall_upper.png?inline';
import femSlimTallLowerUrl from './sheets/fem_slim_tall_lower.png?inline';
import femSlimTallFeetUrl from './sheets/fem_slim_tall_feet.png?inline';
import femAverageShortHeadUrl from './sheets/fem_average_short_head.png?inline';
import femAverageShortFaceUrl from './sheets/fem_average_short_face.png?inline';
import femAverageShortExtraUrl from './sheets/fem_average_short_extra.png?inline';
import femAverageShortUpperUrl from './sheets/fem_average_short_upper.png?inline';
import femAverageShortLowerUrl from './sheets/fem_average_short_lower.png?inline';
import femAverageShortFeetUrl from './sheets/fem_average_short_feet.png?inline';
import femAverageAverageHeadUrl from './sheets/fem_average_average_head.png?inline';
import femAverageAverageFaceUrl from './sheets/fem_average_average_face.png?inline';
import femAverageAverageExtraUrl from './sheets/fem_average_average_extra.png?inline';
import femAverageAverageUpperUrl from './sheets/fem_average_average_upper.png?inline';
import femAverageAverageLowerUrl from './sheets/fem_average_average_lower.png?inline';
import femAverageAverageFeetUrl from './sheets/fem_average_average_feet.png?inline';
import femAverageTallHeadUrl from './sheets/fem_average_tall_head.png?inline';
import femAverageTallFaceUrl from './sheets/fem_average_tall_face.png?inline';
import femAverageTallExtraUrl from './sheets/fem_average_tall_extra.png?inline';
import femAverageTallUpperUrl from './sheets/fem_average_tall_upper.png?inline';
import femAverageTallLowerUrl from './sheets/fem_average_tall_lower.png?inline';
import femAverageTallFeetUrl from './sheets/fem_average_tall_feet.png?inline';
import femHeavyShortHeadUrl from './sheets/fem_heavy_short_head.png?inline';
import femHeavyShortFaceUrl from './sheets/fem_heavy_short_face.png?inline';
import femHeavyShortExtraUrl from './sheets/fem_heavy_short_extra.png?inline';
import femHeavyShortUpperUrl from './sheets/fem_heavy_short_upper.png?inline';
import femHeavyShortLowerUrl from './sheets/fem_heavy_short_lower.png?inline';
import femHeavyShortFeetUrl from './sheets/fem_heavy_short_feet.png?inline';
import femHeavyAverageHeadUrl from './sheets/fem_heavy_average_head.png?inline';
import femHeavyAverageFaceUrl from './sheets/fem_heavy_average_face.png?inline';
import femHeavyAverageExtraUrl from './sheets/fem_heavy_average_extra.png?inline';
import femHeavyAverageUpperUrl from './sheets/fem_heavy_average_upper.png?inline';
import femHeavyAverageLowerUrl from './sheets/fem_heavy_average_lower.png?inline';
import femHeavyAverageFeetUrl from './sheets/fem_heavy_average_feet.png?inline';
import femHeavyTallHeadUrl from './sheets/fem_heavy_tall_head.png?inline';
import femHeavyTallFaceUrl from './sheets/fem_heavy_tall_face.png?inline';
import femHeavyTallExtraUrl from './sheets/fem_heavy_tall_extra.png?inline';
import femHeavyTallUpperUrl from './sheets/fem_heavy_tall_upper.png?inline';
import femHeavyTallLowerUrl from './sheets/fem_heavy_tall_lower.png?inline';
import femHeavyTallFeetUrl from './sheets/fem_heavy_tall_feet.png?inline';

import { FRAME_H, FRAMES, DRAW_ORDER, sheetWidth, type AtlasFrame, type AtlasSlot } from './manifest';
import { SOURCE_PALETTE, PALETTE_SIZE } from './indexPalette';

const SHEET_URLS: Record<AtlasFrame, Record<AtlasSlot, string>> = {
  masc_slim_short: { head: mascSlimShortHeadUrl, face: mascSlimShortFaceUrl, extra: mascSlimShortExtraUrl, upper: mascSlimShortUpperUrl, lower: mascSlimShortLowerUrl, feet: mascSlimShortFeetUrl },
  masc_slim_average: { head: mascSlimAverageHeadUrl, face: mascSlimAverageFaceUrl, extra: mascSlimAverageExtraUrl, upper: mascSlimAverageUpperUrl, lower: mascSlimAverageLowerUrl, feet: mascSlimAverageFeetUrl },
  masc_slim_tall: { head: mascSlimTallHeadUrl, face: mascSlimTallFaceUrl, extra: mascSlimTallExtraUrl, upper: mascSlimTallUpperUrl, lower: mascSlimTallLowerUrl, feet: mascSlimTallFeetUrl },
  masc_average_short: { head: mascAverageShortHeadUrl, face: mascAverageShortFaceUrl, extra: mascAverageShortExtraUrl, upper: mascAverageShortUpperUrl, lower: mascAverageShortLowerUrl, feet: mascAverageShortFeetUrl },
  masc_average_average: { head: mascAverageAverageHeadUrl, face: mascAverageAverageFaceUrl, extra: mascAverageAverageExtraUrl, upper: mascAverageAverageUpperUrl, lower: mascAverageAverageLowerUrl, feet: mascAverageAverageFeetUrl },
  masc_average_tall: { head: mascAverageTallHeadUrl, face: mascAverageTallFaceUrl, extra: mascAverageTallExtraUrl, upper: mascAverageTallUpperUrl, lower: mascAverageTallLowerUrl, feet: mascAverageTallFeetUrl },
  masc_heavy_short: { head: mascHeavyShortHeadUrl, face: mascHeavyShortFaceUrl, extra: mascHeavyShortExtraUrl, upper: mascHeavyShortUpperUrl, lower: mascHeavyShortLowerUrl, feet: mascHeavyShortFeetUrl },
  masc_heavy_average: { head: mascHeavyAverageHeadUrl, face: mascHeavyAverageFaceUrl, extra: mascHeavyAverageExtraUrl, upper: mascHeavyAverageUpperUrl, lower: mascHeavyAverageLowerUrl, feet: mascHeavyAverageFeetUrl },
  masc_heavy_tall: { head: mascHeavyTallHeadUrl, face: mascHeavyTallFaceUrl, extra: mascHeavyTallExtraUrl, upper: mascHeavyTallUpperUrl, lower: mascHeavyTallLowerUrl, feet: mascHeavyTallFeetUrl },
  fem_slim_short: { head: femSlimShortHeadUrl, face: femSlimShortFaceUrl, extra: femSlimShortExtraUrl, upper: femSlimShortUpperUrl, lower: femSlimShortLowerUrl, feet: femSlimShortFeetUrl },
  fem_slim_average: { head: femSlimAverageHeadUrl, face: femSlimAverageFaceUrl, extra: femSlimAverageExtraUrl, upper: femSlimAverageUpperUrl, lower: femSlimAverageLowerUrl, feet: femSlimAverageFeetUrl },
  fem_slim_tall: { head: femSlimTallHeadUrl, face: femSlimTallFaceUrl, extra: femSlimTallExtraUrl, upper: femSlimTallUpperUrl, lower: femSlimTallLowerUrl, feet: femSlimTallFeetUrl },
  fem_average_short: { head: femAverageShortHeadUrl, face: femAverageShortFaceUrl, extra: femAverageShortExtraUrl, upper: femAverageShortUpperUrl, lower: femAverageShortLowerUrl, feet: femAverageShortFeetUrl },
  fem_average_average: { head: femAverageAverageHeadUrl, face: femAverageAverageFaceUrl, extra: femAverageAverageExtraUrl, upper: femAverageAverageUpperUrl, lower: femAverageAverageLowerUrl, feet: femAverageAverageFeetUrl },
  fem_average_tall: { head: femAverageTallHeadUrl, face: femAverageTallFaceUrl, extra: femAverageTallExtraUrl, upper: femAverageTallUpperUrl, lower: femAverageTallLowerUrl, feet: femAverageTallFeetUrl },
  fem_heavy_short: { head: femHeavyShortHeadUrl, face: femHeavyShortFaceUrl, extra: femHeavyShortExtraUrl, upper: femHeavyShortUpperUrl, lower: femHeavyShortLowerUrl, feet: femHeavyShortFeetUrl },
  fem_heavy_average: { head: femHeavyAverageHeadUrl, face: femHeavyAverageFaceUrl, extra: femHeavyAverageExtraUrl, upper: femHeavyAverageUpperUrl, lower: femHeavyAverageLowerUrl, feet: femHeavyAverageFeetUrl },
  fem_heavy_tall: { head: femHeavyTallHeadUrl, face: femHeavyTallFaceUrl, extra: femHeavyTallExtraUrl, upper: femHeavyTallUpperUrl, lower: femHeavyTallLowerUrl, feet: femHeavyTallFeetUrl },
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
