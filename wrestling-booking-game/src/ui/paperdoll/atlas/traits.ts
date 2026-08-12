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
import type {
  AtlasFrame,
  AtlasSlot,
  CellSelection,
  HeadCell,
  FaceCell,
  ExtraCell,
  UpperCell,
  LowerCell,
  FeetCell,
} from './manifest';
import { DRAW_ORDER } from './manifest';
import { hexToRgb, type Rgb, type SlotColors } from './indexPalette';

// hairStyle 0-23 (§7: "0-23, includes bald"), onto thirteen non-mask cells.
// Near enough one-to-one now, which is the point: the old table folded 23
// values onto 7 shapes, so any two men who rolled anywhere in the same bucket
// wore the same head. Every cell appears at least once; the commonest real
// haircuts (short, buzz) appear twice because most of a locker room is not
// wearing a mohawk.
const HEAD_BY_HAIR_STYLE: readonly HeadCell[] = [
  'bald', // 0 — §7 says the range includes bald, and this is it
  'short', 'buzz', 'flattop', 'long', 'ponytail', 'undercut', 'mohawk', 'bob',
  'short', 'buzz', 'afro', 'dreads', 'ponytail', 'bald_beard', 'wild', 'long',
  'mohawk', 'undercut', 'bob', 'afro', 'dreads', 'flattop', 'wild',
];

// facialHair 0-11 onto seven cells. Weighted toward clean and stubble because
// a roster where half the men have full beards looks like a costume shop.
// clean 4 · stubble 2 · goatee 2 · moustache 1 · chinstrap 1 · beard 1 · longbeard 1.
const FACE_BY_FACIAL_HAIR: readonly FaceCell[] = [
  'clean', 'stubble', 'goatee', 'clean', 'moustache', 'beard',
  'clean', 'chinstrap', 'stubble', 'goatee', 'clean', 'longbeard',
];

// accessory 0-15 onto six cells. Mostly nothing — an accessory on two thirds
// of the roster stops being a distinguishing mark and starts being the house
// style. This table is the one traitValueForCell reads, so every cell has to
// be reachable from it, eyewear included.
// none 9 · headband 2 · warpaint 2 · eyepatch 1 · shades 1 · glasses 1.
const EXTRA_BY_ACCESSORY: readonly ExtraCell[] = [
  'none', 'none', 'headband', 'none', 'warpaint', 'none', 'shades', 'none',
  'none', 'eyepatch', 'none', 'headband', 'none', 'glasses', 'warpaint', 'none',
];

// glasses 0-9, 0 = none. Overrides the accessory above when set, the same way
// `mask` overrides `hairStyle` — you cannot wear a headband over your eyes.
const EXTRA_BY_GLASSES: readonly ExtraCell[] = [
  'none', 'shades', 'glasses', 'shades', 'glasses', 'shades', 'glasses', 'shades', 'glasses', 'shades',
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
  face: FACE_BY_FACIAL_HAIR,
  extra: EXTRA_BY_ACCESSORY,
  upper: UPPER_BY_ATTIRE_TOP,
  lower: LOWER_BY_ATTIRE_BOTTOM,
  feet: FEET_BY_BOOTS,
} as const;

/** Which Appearance field drives each slot's shape. The editor builds its pickers off this. */
export const SLOT_TRAIT: Record<
  AtlasSlot,
  'hairStyle' | 'facialHair' | 'accessory' | 'attireTop' | 'attireBottom' | 'boots'
> = {
  head: 'hairStyle',
  face: 'facialHair',
  extra: 'accessory',
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
export function traitValueForCell(slot: AtlasSlot, cell: string): number {
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

/**
 * Which body a wrestler gets.
 *
 * `build` is 0-5 (slim, athletic, thick, heavy, massive, tall) and `height`
 * is 0-4; both have been generated, edited and saved since the beginning
 * while changing nothing at all about the sprite. Authored tables rather than
 * modulo arithmetic, like every other mapping in this file, so the
 * distribution is one somebody chose: "athletic" and "thick" both read as the
 * average frame because most of a roster should look like most of a roster,
 * and the ends of the scale are where the silhouette actually changes.
 */
const BUILD_TO_FRAME: readonly ('slim' | 'average' | 'heavy')[] = [
  'slim', // slim
  'average', // athletic
  'average', // thick
  'heavy', // heavy
  'heavy', // massive
  'slim', // tall — carried by the height axis, not the width one
];

const HEIGHT_TO_FRAME: readonly ('short' | 'average' | 'tall')[] = [
  'short',
  'short',
  'average',
  'tall',
  'tall',
];

export function frameFor(gender: 'm' | 'f', appearance: Appearance): AtlasFrame {
  const body = gender === 'f' ? 'fem' : 'masc';
  const build = BUILD_TO_FRAME[appearance.build] ?? 'average';
  const height = HEIGHT_TO_FRAME[appearance.height] ?? 'average';
  return `${body}_${build}_${height}` as AtlasFrame;
}

/** @deprecated Kept only so nothing calls the old gender-only shape by accident. */
export function frameForGender(gender: 'm' | 'f'): AtlasFrame {
  return gender === 'f' ? 'fem_average_average' : 'masc_average_average';
}

export function selectCells(appearance: Appearance): CellSelection {
  const masked = appearance.mask > 0;
  return {
    // A mask replaces the hair layer outright (§7 layer 8: "hair suppressed if
    // mask != 0"), so it wins over whatever hairStyle says.
    head: masked ? 'mask' : pick(HEAD_BY_HAIR_STYLE, appearance.hairStyle),
    // And a mask covers the jaw, so the beard under it goes with the hair.
    face: masked ? 'clean' : pick(FACE_BY_FACIAL_HAIR, appearance.facialHair),
    extra:
      appearance.glasses > 0
        ? pick(EXTRA_BY_GLASSES, appearance.glasses)
        : pick(EXTRA_BY_ACCESSORY, appearance.accessory),
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
 *   face   hair color   — a beard is hair
 *   extra  secondary    + accent (lens tint, patch, paint)
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
    // Facial hair is hair. Nothing else about the face slot is coloured, so
    // mat2 is along for the ride.
    face: { skin, mat1: hair, mat2: hair },
    // Shades, patches and warpaint are gear, so they take the accent — the
    // colour a wrestler's trim already uses — with the secondary behind it for
    // glasses rims.
    extra: { skin, mat1: secondary, mat2: accent },
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
    frame: frameFor(gender, appearance),
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
