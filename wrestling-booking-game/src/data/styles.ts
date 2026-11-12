// Wrestling styles and the 12x12 mesh matrix, booking-game-design.md §3.5.

import type { WrestlingStyle } from '../engine/types';

export const WRESTLING_STYLES: WrestlingStyle[] = [
  'bruiser',
  'technical',
  'highFlyer',
  'powerhouse',
  'striker',
  'luchador',
  'submission',
  'hardcore',
  'showman',
  'giant',
  'allRounder',
  'oldSchool',
];

/** A style's raw id, in words, for prose that has to read as a sentence rather than a tag. */
export const STYLE_LABEL: Record<WrestlingStyle, string> = {
  bruiser: 'bruiser',
  technical: 'technical',
  highFlyer: 'high-flying',
  powerhouse: 'powerhouse',
  striker: 'striker',
  luchador: 'lucha',
  submission: 'submission',
  hardcore: 'hardcore',
  showman: 'showman',
  giant: 'giant',
  allRounder: 'all-round',
  oldSchool: 'old-school',
};

// The matrix as given in §3.5 only covers 11 of the 12 styles — 'allRounder'
// is deliberately excluded there ("adaptable, no strong preference").
// DESIGN: allRounder meshes at a flat, moderately positive score against
// everyone rather than via the matrix, matching its description.
export const ALL_ROUNDER_MESH_SCORE = 5;

type MeshedStyle = Exclude<WrestlingStyle, 'allRounder'>;

const MESH_ORDER: MeshedStyle[] = [
  'bruiser',
  'technical',
  'highFlyer',
  'powerhouse',
  'striker',
  'luchador',
  'submission',
  'hardcore',
  'showman',
  'giant',
  'oldSchool',
];

// prettier-ignore
const MESH_TABLE: number[][] = [
  /* bruiser    */ [  4,  6,  7,  5,  9,  2,  5,  8,  1,  6,  8 ],
  /* technical  */ [  6, 11,  6,  3,  5,  5, 12, -8,  1, -4,  9 ],
  /* highFlyer  */ [  7,  6,  8, 11,  6, 10,  2,  4,  3, 12,  4 ],
  /* powerhouse */ [  5,  3, 11, -6,  4,  9,  2,  5,  3, -9,  6 ],
  /* striker    */ [  9,  5,  6,  4,  7,  4,  8,  3,  0,  5,  5 ],
  /* luchador   */ [  2,  5, 10,  9,  4,  9,  1, -2,  4, 10,  1 ],
  /* submission */ [  5, 12,  2,  2,  8,  1, -3,-10, -2, -3,  8 ],
  /* hardcore   */ [  8, -8,  4,  5,  3, -2,-10,  6,  2,  4,  1 ],
  /* showman    */ [  1,  1,  3,  3,  0,  4, -2,  2, -5,  2,  5 ],
  /* giant      */ [  6, -4, 12, -9,  5, 10, -3,  4,  2,-12,  5 ],
  /* oldSchool  */ [  8,  9,  4,  6,  5,  1,  8,  1,  5,  5,  7 ],
];

/** Pairwise mesh score, -12 to +12 (or ALL_ROUNDER_MESH_SCORE if either side is an all-rounder). */
export function styleMeshScore(a: WrestlingStyle, b: WrestlingStyle): number {
  if (a === 'allRounder' || b === 'allRounder') return ALL_ROUNDER_MESH_SCORE;
  const i = MESH_ORDER.indexOf(a as MeshedStyle);
  const j = MESH_ORDER.indexOf(b as MeshedStyle);
  const row = MESH_TABLE[i];
  if (!row) throw new Error(`Unknown style in mesh table: ${a}`);
  const value = row[j];
  if (value === undefined) throw new Error(`Unknown style in mesh table: ${b}`);
  return value;
}
