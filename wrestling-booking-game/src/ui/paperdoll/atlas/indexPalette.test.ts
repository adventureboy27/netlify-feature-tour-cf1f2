import { describe, it, expect } from 'vitest';
import {
  PALETTE_SIZE,
  INDEX,
  SOURCE_PALETTE,
  OUTLINE_RGB,
  buildRamp,
  buildPaletteLut,
  hexToRgb,
  type Rgb,
} from './indexPalette';

const luminance = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function lutEntry(lut: Uint8ClampedArray, index: number): number[] {
  return [...lut.slice(index * 4, index * 4 + 4)];
}

describe('source palette', () => {
  it('has one entry per index slot', () => {
    expect(SOURCE_PALETTE).toHaveLength(PALETTE_SIZE);
  });

  it('gives every drawable index a distinct color, so the reverse lookup is unambiguous', () => {
    const packed = SOURCE_PALETTE.slice(1).map(([r, g, b]) => (r << 16) | (g << 8) | b);
    expect(new Set(packed).size).toBe(packed.length);
  });
});

describe('hexToRgb', () => {
  it('parses the palette hex strings the rest of the UI already uses', () => {
    expect(hexToRgb('#e63946')).toEqual([230, 57, 70]);
    expect(hexToRgb('ffffff')).toEqual([255, 255, 255]);
    expect(hexToRgb('#000000')).toEqual([0, 0, 0]);
  });
});

describe('buildRamp', () => {
  it('runs highlight -> base -> shadow -> deep shadow, darkening at every step', () => {
    const ramp = buildRamp([206, 40, 64]);
    const tones = ramp.map(luminance);
    expect(tones[0]!).toBeGreaterThan(tones[1]!);
    expect(tones[1]!).toBeGreaterThan(tones[2]!);
    expect(tones[2]!).toBeGreaterThan(tones[3]!);
  });

  it('keeps the base tone exactly as authored', () => {
    expect(buildRamp([206, 40, 64])[1]).toEqual([206, 40, 64]);
  });

  it('stays inside 0-255 for the extremes of the attire palette', () => {
    for (const base of [[0, 0, 0], [255, 255, 255], [248, 249, 250]] as Rgb[]) {
      for (const tone of buildRamp(base)) {
        for (const channel of tone) {
          expect(channel).toBeGreaterThanOrEqual(0);
          expect(channel).toBeLessThanOrEqual(255);
          expect(Number.isInteger(channel)).toBe(true);
        }
      }
    }
  });

  it('still separates tones on a near-black base, so dark attire does not go flat', () => {
    const ramp = buildRamp([33, 37, 41]);
    expect(luminance(ramp[0]!) - luminance(ramp[3]!)).toBeGreaterThan(20);
  });
});

describe('buildPaletteLut', () => {
  const lut = buildPaletteLut({ skin: [224, 162, 116], mat1: [206, 40, 64], mat2: [46, 98, 196] });

  it('emits RGBA for all sixteen slots', () => {
    expect(lut).toHaveLength(PALETTE_SIZE * 4);
  });

  it('leaves index 0 fully transparent', () => {
    expect(lutEntry(lut, INDEX.transparent)).toEqual([0, 0, 0, 0]);
  });

  it('makes every drawable index opaque', () => {
    for (let index = 1; index < PALETTE_SIZE; index++) {
      expect(lutEntry(lut, index)[3]).toBe(255);
    }
  });

  it('places each material ramp at its documented four-slot run', () => {
    expect(lutEntry(lut, INDEX.skin + 1).slice(0, 3)).toEqual([224, 162, 116]);
    expect(lutEntry(lut, INDEX.mat1 + 1).slice(0, 3)).toEqual([206, 40, 64]);
    expect(lutEntry(lut, INDEX.mat2 + 1).slice(0, 3)).toEqual([46, 98, 196]);
  });

  it('holds outline, white, and pupil ink fixed regardless of the wrestler colors', () => {
    const other = buildPaletteLut({ skin: [10, 20, 30], mat1: [200, 200, 10], mat2: [5, 250, 5] });
    for (const index of [INDEX.outline, INDEX.white, INDEX.darkDetail]) {
      expect(lutEntry(lut, index)).toEqual(lutEntry(other, index));
    }
    expect(lutEntry(lut, INDEX.outline).slice(0, 3)).toEqual([...OUTLINE_RGB]);
  });
});
