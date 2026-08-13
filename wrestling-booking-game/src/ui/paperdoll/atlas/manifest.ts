// Typed mirror of sheets/atlas.json — the contract between the sprite
// generator (tools/wrestler_atlas.py) and the renderer.
//
// The JSON is the artifact the generator emits; this file is the typed view
// the app codes against. manifest.test.ts asserts the two agree, so a
// regenerated atlas with different cells fails the test suite instead of
// silently rendering the wrong body part.

export const FRAME_W = 64;
export const FRAME_H = 96;

/**
 * Body frames the atlas ships. Not a statement about the wrestler's gender —
 * it's which set of skeletal landmarks the sprite was drawn on (§7 keeps
 * gender as a separate Wrestler field).
 */
// Two genders x three builds x three heights. `build` and `height` used to
// be generated, edited, saved and counted by the distinctness check while
// changing nothing at all about the sprite — see the paperdoll README.
export const FRAMES = [
  'masc_slim_short',
  'masc_slim_average',
  'masc_slim_tall',
  'masc_average_short',
  'masc_average_average',
  'masc_average_tall',
  'masc_heavy_short',
  'masc_heavy_average',
  'masc_heavy_tall',
  'fem_slim_short',
  'fem_slim_average',
  'fem_slim_tall',
  'fem_average_short',
  'fem_average_average',
  'fem_average_tall',
  'fem_heavy_short',
  'fem_heavy_average',
  'fem_heavy_tall',
] as const;
export type AtlasFrame = (typeof FRAMES)[number];

/**
 * Paint order, back to front. Every cell shares the same top-left origin and
 * the same 64x96 canvas, so compositing is "later slot wins on non-empty
 * pixels" — this is §7's layer order collapsed to the four slots the atlas
 * actually cuts.
 *
 * The game is portrait-only: nothing below the shoulders is ever drawn. The
 * `lower` and `feet` slots used to exist and were measured to contribute
 * exactly zero pixels to the portrait window — 198 cells and 46 KB of PNG, 30%
 * of the atlas, serving one editor screen. They are gone. `upper` stays
 * because the shoulders and chest land at y 23-39, well inside the crop.
 */
export const DRAW_ORDER = ['head', 'face', 'extra', 'upper'] as const;
export type AtlasSlot = (typeof DRAW_ORDER)[number];

// Head, then the two layers that sit on top of it. At portrait size the head
// is nearly the whole sprite, so eight head cells meant a 24-man roster had
// three men wearing the same skull. `facialHair`, `glasses` and `accessory`
// were all generated, edited and saved from the beginning and drew nothing;
// `face` and `extra` are where they finally land.
export const HEAD_CELLS = [
  'short', 'buzz', 'mohawk', 'long', 'ponytail', 'afro', 'mask', 'bald_beard',
  'flattop', 'dreads', 'bald', 'undercut', 'wild', 'bob',
] as const;
export const FACE_CELLS = ['clean', 'stubble', 'moustache', 'goatee', 'chinstrap', 'beard', 'longbeard'] as const;
export const EXTRA_CELLS = ['none', 'shades', 'glasses', 'eyepatch', 'headband', 'warpaint'] as const;
export const UPPER_CELLS = ['bare', 'singlet', 'tank', 'tee', 'longsleeve', 'vest'] as const;

export type HeadCell = (typeof HEAD_CELLS)[number];
export type FaceCell = (typeof FACE_CELLS)[number];
export type ExtraCell = (typeof EXTRA_CELLS)[number];
export type UpperCell = (typeof UPPER_CELLS)[number];

export const SLOT_CELLS = {
  head: HEAD_CELLS,
  face: FACE_CELLS,
  extra: EXTRA_CELLS,
  upper: UPPER_CELLS,
} as const;

export interface CellSelection {
  head: HeadCell;
  face: FaceCell;
  extra: ExtraCell;
  upper: UpperCell;
}

/** Column index of a named cell within its sheet. Sheets are one row, N cells wide. */
export function cellIndex<S extends AtlasSlot>(slot: S, cell: CellSelection[S]): number {
  const index = (SLOT_CELLS[slot] as readonly string[]).indexOf(cell);
  if (index < 0) throw new Error(`Unknown ${slot} cell: ${cell}`);
  return index;
}

/** Pixel x-offset of a named cell within its sheet. */
export function cellOriginX<S extends AtlasSlot>(slot: S, cell: CellSelection[S]): number {
  return cellIndex(slot, cell) * FRAME_W;
}

export function sheetWidth(slot: AtlasSlot): number {
  return SLOT_CELLS[slot].length * FRAME_W;
}

/**
 * Distinct silhouettes the atlas can currently produce for one frame.
 *
 * Portrait-only cost this a factor of thirty — trunks and boots used to
 * multiply it by 6 x 5, and neither was ever visible. Shape alone no longer
 * carries the no-doubles promise on a world-sized population; colour does.
 * See lookalikes.test.ts, which measures both.
 */
export const SHAPE_COMBOS_PER_FRAME =
  HEAD_CELLS.length * FACE_CELLS.length * EXTRA_CELLS.length * UPPER_CELLS.length;

/** Distinct silhouettes across every body the atlas ships. */
export const SHAPE_COMBOS = SHAPE_COMBOS_PER_FRAME * FRAMES.length;
