// The 16-slot index palette the sprite sheets are drawn in, and the machinery
// that turns a wrestler's color traits into a lookup table over it.
//
// The sheets are INDEXED art: every pixel is a palette slot, not a color.
// That is what keeps shape and color independent — one `trunks` cell serves
// every wrestler in the promotion, recolored per wrestler at composite time.
//
//   0      transparent
//   1-4    skin        highlight / base / shadow / deep shadow
//   5      outline
//   6-9    mat1        highlight / base / shadow / deep shadow
//   10-13  mat2        highlight / base / shadow / deep shadow
//   14     white       (eyes, teeth)
//   15     dark detail (pupils)
//
// mat1 is the slot's main material (hair, shirt, trunks, boots); mat2 is its
// trim (mask piping, knee pads, laces, waistband).

export const PALETTE_SIZE = 16;

export const INDEX = {
  transparent: 0,
  skin: 1, // ..4
  outline: 5,
  mat1: 6, // ..9
  mat2: 10, // ..13
  white: 14,
  darkDetail: 15,
} as const;

export type Rgb = readonly [number, number, number];

/**
 * The RGB values physically baked into the PNGs by the generator's
 * DEFAULT_PALETTE. The loader uses this to run the sheets *backwards* —
 * decoded RGBA back to palette indices — because browsers hand us pixels,
 * not indices. Changing these means regenerating the sheets.
 */
export const SOURCE_PALETTE: readonly Rgb[] = [
  [0, 0, 0], // 0 transparent (alpha 0; RGB is don't-care)
  [247, 203, 161],
  [224, 162, 116],
  [178, 114, 73],
  [132, 76, 46], // 1-4 skin
  [24, 15, 36], // 5 outline
  [102, 78, 102],
  [60, 42, 60],
  [38, 26, 40],
  [24, 16, 26], // 6-9 mat1
  [255, 253, 247],
  [230, 222, 208],
  [170, 160, 148],
  [120, 112, 104], // 10-13 mat2
  [244, 240, 230], // 14 white
  [36, 24, 44], // 15 dark detail
];

// Ink, not black — reads as a drawn outline on a dark UI without crushing to
// a single value once the alignment filter's contrast is applied on top.
export const OUTLINE_RGB: Rgb = [24, 15, 36];
export const WHITE_RGB: Rgb = [244, 240, 230];
export const DARK_DETAIL_RGB: Rgb = [36, 24, 44];

// Shadows are tinted toward the outline ink rather than toward pure black,
// which is what stops dark attire colors from muddying into one flat mass.
const SHADOW_TINT: Rgb = OUTLINE_RGB;

const clamp255 = (n: number) => (n < 0 ? 0 : n > 255 ? 255 : Math.round(n));

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    clamp255(a[0] + (b[0] - a[0]) * t),
    clamp255(a[1] + (b[1] - a[1]) * t),
    clamp255(a[2] + (b[2] - a[2]) * t),
  ];
}

function scale(c: Rgb, k: number): Rgb {
  return [clamp255(c[0] * k), clamp255(c[1] * k), clamp255(c[2] * k)];
}

export function hexToRgb(hex: string): Rgb {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16) || 0,
    parseInt(clean.slice(2, 4), 16) || 0,
    parseInt(clean.slice(4, 6), 16) || 0,
  ];
}

/** A four-tone cel-shading run: highlight, base, shadow, deep shadow. */
export type Ramp = readonly [Rgb, Rgb, Rgb, Rgb];

// Tuned against the generator's own DEFAULT_PALETTE ramps: a highlight that
// lifts toward white without blowing out, and two darkening steps far enough
// apart to read as hard 16-bit bands rather than a gradient.
const HIGHLIGHT_MIX = 0.28;
const SHADOW_SCALE = 0.72;
const SHADOW_TINT_MIX = 0.1;
const DEEP_SCALE = 0.46;
const DEEP_TINT_MIX = 0.18;

export function buildRamp(base: Rgb): Ramp {
  return [
    mix(base, [255, 255, 255], HIGHLIGHT_MIX),
    base,
    mix(scale(base, SHADOW_SCALE), SHADOW_TINT, SHADOW_TINT_MIX),
    mix(scale(base, DEEP_SCALE), SHADOW_TINT, DEEP_TINT_MIX),
  ];
}

export interface SlotColors {
  skin: Rgb;
  mat1: Rgb;
  mat2: Rgb;
}

/**
 * A wrestler's 16 palette slots as packed RGBA bytes, ready to be indexed
 * straight into an ImageData buffer. Index 0 is fully transparent.
 */
export type PaletteLut = Uint8ClampedArray;

export function buildPaletteLut(colors: SlotColors): PaletteLut {
  const lut = new Uint8ClampedArray(PALETTE_SIZE * 4);

  const write = (index: number, rgb: Rgb, alpha: number) => {
    const o = index * 4;
    lut[o] = rgb[0];
    lut[o + 1] = rgb[1];
    lut[o + 2] = rgb[2];
    lut[o + 3] = alpha;
  };

  write(INDEX.transparent, [0, 0, 0], 0);

  const skin = buildRamp(colors.skin);
  const mat1 = buildRamp(colors.mat1);
  const mat2 = buildRamp(colors.mat2);
  for (let tone = 0; tone < 4; tone++) {
    write(INDEX.skin + tone, skin[tone]!, 255);
    write(INDEX.mat1 + tone, mat1[tone]!, 255);
    write(INDEX.mat2 + tone, mat2[tone]!, 255);
  }

  write(INDEX.outline, OUTLINE_RGB, 255);
  write(INDEX.white, WHITE_RGB, 255);
  write(INDEX.darkDetail, DARK_DETAIL_RGB, 255);

  return lut;
}
