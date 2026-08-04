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
export const FRAMES = ['masc', 'fem'] as const;
export type AtlasFrame = (typeof FRAMES)[number];

/**
 * Paint order, back to front. Every cell shares the same top-left origin and
 * the same 64x96 canvas, so compositing is "later slot wins on non-empty
 * pixels" — this is §7's layer order collapsed to the four slots the atlas
 * actually cuts.
 */
export const DRAW_ORDER = ['head', 'upper', 'lower', 'feet'] as const;
export type AtlasSlot = (typeof DRAW_ORDER)[number];

export const HEAD_CELLS = ['short', 'buzz', 'mohawk', 'long', 'ponytail', 'afro', 'mask', 'bald_beard'] as const;
export const UPPER_CELLS = ['bare', 'singlet', 'tank', 'tee', 'longsleeve', 'vest'] as const;
export const LOWER_CELLS = ['trunks', 'trunks_pads', 'tights', 'shorts', 'jeans', 'skirt'] as const;
export const FEET_CELLS = ['boots_mid', 'boots_high', 'boots_low', 'sneakers', 'barefoot'] as const;

export type HeadCell = (typeof HEAD_CELLS)[number];
export type UpperCell = (typeof UPPER_CELLS)[number];
export type LowerCell = (typeof LOWER_CELLS)[number];
export type FeetCell = (typeof FEET_CELLS)[number];

export const SLOT_CELLS = {
  head: HEAD_CELLS,
  upper: UPPER_CELLS,
  lower: LOWER_CELLS,
  feet: FEET_CELLS,
} as const;

export interface CellSelection {
  head: HeadCell;
  upper: UpperCell;
  lower: LowerCell;
  feet: FeetCell;
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

/** Distinct silhouettes the atlas can currently produce for one frame. */
export const SHAPE_COMBOS_PER_FRAME =
  HEAD_CELLS.length * UPPER_CELLS.length * LOWER_CELLS.length * FEET_CELLS.length;
