// Appearance trait vector -> atlas cell selection + per-slot color ramps.
//
// Pure and DOM-free on purpose: this is the whole "which sprite am I" decision
// and it is the part worth unit-testing, so it lives away from anything that
// touches a canvas.
//
// The trait ranges in §7 are wider than the shape vocabulary the atlas
// currently cuts (24 hair styles onto 8 head cells, 16 tops onto 6, and so
// on). The mapping tables below are authored rather than a bare modulo so the
// resulting roster distribution is a decision, not an accident of arithmetic —
// see the counts noted on each table. Widening the vocabulary is generator
// work (tools/wrestler_atlas.py), and adding cells there only requires
// extending these tables here.

import type { Appearance } from '../../../engine/types';
import { SKIN_TONE_PALETTE, HAIR_COLOR_PALETTE, ATTIRE_PALETTE } from '../palette';
import type { AtlasFrame, AtlasSlot, CellSelection, HeadCell, UpperCell, LowerCell, FeetCell } from './manifest';
import { DRAW_ORDER } from './manifest';
import { hexToRgb, type Rgb, type SlotColors } from './indexPalette';

// hairStyle 0-23 (§7: "0-23, includes bald").
// short 7 · buzz 4 · long 5 · ponytail 3 · mohawk 2 · afro 2 · bald 1.
const HEAD_BY_HAIR_STYLE: readonly HeadCell[] = [
  'bald_beard', // 0 — the atlas's only hairless skull
  'short', 'short', 'buzz', 'long', 'ponytail', 'short', 'mohawk', 'long',
  'short', 'buzz', 'afro', 'long', 'ponytail', 'short', 'buzz', 'long',
  'mohawk', 'short', 'ponytail', 'afro', 'long', 'short', 'buzz',
];

// attireTop 0-15. bare 2 · singlet 4 · tank 3 · tee 3 · longsleeve 2 · vest 2.
const UPPER_BY_ATTIRE_TOP: readonly UpperCell[] = [
  'bare', 'singlet', 'tank', 'tee', 'longsleeve', 'vest', 'singlet', 'tank',
  'bare', 'tee', 'singlet', 'tank', 'vest', 'longsleeve', 'singlet', 'tee',
];

// attireBottom 0-15. trunks 4 · tights 4 · trunks_pads 3 · shorts 2 · jeans 2 · skirt 1.
const LOWER_BY_ATTIRE_BOTTOM: readonly LowerCell[] = [
  'trunks', 'trunks_pads', 'tights', 'shorts', 'trunks', 'jeans', 'tights', 'trunks_pads',
  'trunks', 'shorts', 'tights', 'skirt', 'trunks', 'trunks_pads', 'tights', 'jeans',
];

// boots 0-9. boots_mid 3 · boots_high 2 · boots_low 2 · sneakers 2 · barefoot 1.
// DESIGN: barefoot is deliberately the rarest — a flat modulo would have put
// a fifth of the roster in bare feet, which reads as unfinished art rather
// than as a gimmick choice.
const FEET_BY_BOOTS: readonly FeetCell[] = [
  'boots_mid', 'boots_high', 'boots_low', 'boots_mid', 'sneakers',
  'boots_high', 'boots_low', 'boots_mid', 'sneakers', 'barefoot',
];

const CELL_TABLES = {
  head: HEAD_BY_HAIR_STYLE,
  upper: UPPER_BY_ATTIRE_TOP,
  lower: LOWER_BY_ATTIRE_BOTTOM,
  feet: FEET_BY_BOOTS,
} as const;

/** Which Appearance field drives each slot's shape. The editor builds its pickers off this. */
export const SLOT_TRAIT: Record<AtlasSlot, 'hairStyle' | 'attireTop' | 'attireBottom' | 'boots'> = {
  head: 'hairStyle',
  upper: 'attireTop',
  lower: 'attireBottom',
  feet: 'boots',
};

/**
 * Inverse of the mapping tables: the lowest trait value that renders `cell`.
 * The editor picks cells by name and needs a trait value to write back, since
 * Appearance stays the single source of truth for a wrestler's look.
 *
 * Head is the exception — 'mask' has no hairStyle that reaches it, because a
 * mask is chosen with the separate `mask` trait.
 */
export function traitValueForCell<S extends AtlasSlot>(slot: S, cell: CellSelection[S]): number {
  const index = (CELL_TABLES[slot] as readonly string[]).indexOf(cell);
  if (index < 0) throw new Error(`No ${SLOT_TRAIT[slot]} value renders the ${slot} cell "${cell}"`);
  return index;
}

/** Wrap a trait into an authored table. Traits are engine-generated and in range; this is belt-and-braces. */
function pick<T>(table: readonly T[], trait: number): T {
  const size = table.length;
  const index = ((Math.trunc(trait) % size) + size) % size;
  return table[index]!;
}

function paletteRgb(palette: readonly string[], index: number): Rgb {
  return hexToRgb(pick(palette, index));
}

export function frameForGender(gender: 'm' | 'f'): AtlasFrame {
  return gender === 'f' ? 'fem' : 'masc';
}

export function selectCells(appearance: Appearance): CellSelection {
  return {
    // A mask replaces the hair layer outright (§7 layer 8: "hair suppressed if
    // mask != 0"), so it wins over whatever hairStyle says.
    head: appearance.mask > 0 ? 'mask' : pick(HEAD_BY_HAIR_STYLE, appearance.hairStyle),
    upper: pick(UPPER_BY_ATTIRE_TOP, appearance.attireTop),
    lower: pick(LOWER_BY_ATTIRE_BOTTOM, appearance.attireBottom),
    feet: pick(FEET_BY_BOOTS, appearance.boots),
  };
}

/**
 * Which color drives mat1/mat2 in each slot.
 *
 *   head   hair color   (or the primary, when the head is a mask — a mask is
 *                        attire, not hair) + accent piping
 *   upper  primary      + accent trim
 *   lower  secondary    + accent (waistband, knee pads)
 *   feet   primary      + accent (laces, boot trim)
 *
 * Boots taking the primary rather than the secondary is the classic wrestling
 * read: boots match the top, trunks are the odd color out.
 */
export function selectSlotColors(appearance: Appearance): Record<AtlasSlot, SlotColors> {
  const skin = paletteRgb(SKIN_TONE_PALETTE, appearance.skinTone);
  const primary = paletteRgb(ATTIRE_PALETTE, appearance.primaryColor);
  const secondary = paletteRgb(ATTIRE_PALETTE, appearance.secondaryColor);
  const accent = paletteRgb(ATTIRE_PALETTE, appearance.accentColor);
  const hair = paletteRgb(HAIR_COLOR_PALETTE, appearance.hairColor);

  return {
    head: { skin, mat1: appearance.mask > 0 ? primary : hair, mat2: accent },
    upper: { skin, mat1: primary, mat2: accent },
    lower: { skin, mat1: secondary, mat2: accent },
    feet: { skin, mat1: primary, mat2: accent },
  };
}

export interface SpriteSelection {
  frame: AtlasFrame;
  cells: CellSelection;
  slotColors: Record<AtlasSlot, SlotColors>;
}

export function selectSprite(appearance: Appearance, gender: 'm' | 'f'): SpriteSelection {
  return {
    frame: frameForGender(gender),
    cells: selectCells(appearance),
    slotColors: selectSlotColors(appearance),
  };
}

/**
 * Identity of a composited sprite. Two wrestlers with the same key composite
 * to byte-identical bitmaps, which is what makes the sprite cache correct —
 * and it keys on the *rendered* traits, so a roster grid reuses one bitmap
 * across wrestlers whose differences the atlas can't yet express.
 */
export function selectionKey(selection: SpriteSelection): string {
  const parts: string[] = [selection.frame];
  for (const slot of DRAW_ORDER) {
    const colors = selection.slotColors[slot];
    parts.push(`${selection.cells[slot]}:${colors.skin.join()}:${colors.mat1.join()}:${colors.mat2.join()}`);
  }
  return parts.join('|');
}
