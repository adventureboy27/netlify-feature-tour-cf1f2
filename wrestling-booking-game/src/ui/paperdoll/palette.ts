// Color palettes for the pixel-art paper-doll system, §7.
// Every index range here matches the corresponding field on `Appearance` in
// engine/types.ts exactly, so every generated trait value is renderable.

// 12 entries (Appearance.skinTone: 0-11)
export const SKIN_TONE_PALETTE: string[] = [
  '#ffe0bd', '#ffcd94', '#eac086', '#d1a374', '#c68642', '#a9713a',
  '#8d5524', '#73431b', '#5c3317', '#4a2b1a', '#3a2214', '#2b1810',
];

// 12 entries (Appearance.hairColor / facial hair color: 0-11)
export const HAIR_COLOR_PALETTE: string[] = [
  '#0a0a0a', '#2c1b0e', '#4a2c17', '#6b3f21', '#8b5a2b', '#a8712f',
  '#c98a3d', '#e0b04f', '#f2d16b', '#c0c0c0', '#7a7a7a', '#e63946',
];

// 20 entries — shared by primaryColor / secondaryColor / accentColor (0-19).
export const ATTIRE_PALETTE: string[] = [
  '#e63946', '#f1a208', '#f4d35e', '#8ecae6', '#219ebc', '#023047',
  '#2a9d8f', '#588157', '#3a5a40', '#606c38', '#9d4edd', '#7209b7',
  '#c9184a', '#ff758f', '#ffb703', '#4361ee', '#b5179e', '#212529',
  '#f8f9fa', '#adb5bd',
];

export function skinToneColor(index: number): string {
  return SKIN_TONE_PALETTE[index] ?? SKIN_TONE_PALETTE[0]!;
}

export function hairColorValue(index: number): string {
  return HAIR_COLOR_PALETTE[index] ?? HAIR_COLOR_PALETTE[0]!;
}

export function attireColor(index: number): string {
  return ATTIRE_PALETTE[index] ?? ATTIRE_PALETTE[0]!;
}

// Near-black rather than pure #000 — reads as ink on a dark UI without
// crushing to a single value when the alignment filter's contrast/brightness
// gets applied on top.
export const OUTLINE_COLOR = '#160f12';

/**
 * Lighten (positive percent) or darken (negative percent) a hex color by
 * blending it toward white or black. Used for the two-tone "cel shading"
 * split that reads as Genesis/16-bit-era sprite shading — hard color bands,
 * not soft alpha gradients.
 */
export function shadeColor(hex: string, percent: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent) / 100;
  const mix = (channel: number) => Math.round((t - channel) * p + channel);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

// §7 "Requirements" — heel/face palette shift applied at the container
// level, not baked into the trait vector. Multiplies rendered RGB.
export type AlignmentBucket = 'face' | 'heel' | 'tween';

export function alignmentBucket(alignment: number): AlignmentBucket {
  if (alignment >= 15) return 'face';
  if (alignment <= -15) return 'heel';
  return 'tween';
}

// CSS filter strings — cheap, GPU-composited, and reversible, applied to the
// whole rendered sprite rather than any individual layer color.
export const ALIGNMENT_FILTER: Record<AlignmentBucket, string> = {
  face: 'saturate(1.15) hue-rotate(-4deg) brightness(1.03)',
  heel: 'saturate(0.85) hue-rotate(8deg) brightness(0.94) contrast(1.05)',
  tween: 'none',
};
