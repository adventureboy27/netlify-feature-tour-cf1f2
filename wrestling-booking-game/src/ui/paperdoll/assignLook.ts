// Decides which pieces a wrestler with no uploaded photo wears, so the
// composited fallback isn't a coin flip on every render.
//
// Two seeded streams, never the shared world one (see CLAUDE.md's "Traps"):
//
// - the BODY stream is seeded off the wrestler's id alone — skin, face,
//   hair, hair color, beard. Stable for life.
// - the GEAR stream is seeded off the id AND the current gimmick — clothing,
//   headwear, accessories, makeup, the logo on the shirt. A repackage is a
//   visible makeover of the same recognisable person.

import {
  BASE_BODY,
  BASE_DETAIL,
  FACE_ASSETS,
  HAIR_ASSETS,
  FACIAL_ASSETS,
  PROP_ASSETS,
  ACC_ASSETS,
  PAINT_ASSETS,
  NECK_ASSETS,
  LOGO_ASSETS,
  TOP_ASSETS,
  OUTER_ASSETS,
  WAISTBAND_ASSETS,
  type PaperdollAsset,
} from './paperdollAssets';
import { SKIN_TONES } from './skinTones';
import { HAIR_COLORS } from './hairColors';
import { ACCENT_COLORS } from './accentColors';
import { GIMMICK_CATEGORY_PROP_KEYWORDS, GOOFY_IDS } from './gimmickPropTags';

/** One assigned piece: the file, and the color to cut it in (null = drawn as painted). */
export interface Worn {
  asset: PaperdollAsset;
  color: string | null;
}

export interface ComposedLook {
  baseUrl: string;
  skinColor: string;
  /** Anatomical linework over the tinted skin layer. Null if no such file exists yet. */
  baseDetailUrl: string | null;
  /** Facial features. Drawn as painted. */
  face: PaperdollAsset | null;
  hair: Worn | null;
  facial: Worn | null;
  /** Torso garment — always for women, about a third of the time for men. */
  top: Worn | null;
  /** A chest graphic on the top. Never set without one. */
  logo: Worn | null;
  /** Worn over the top, or over bare skin. */
  outer: Worn | null;
  /** Sits right at the bottom crop edge — see assets/README.md. */
  waistband: Worn | null;
  /** Face makeup, under the features. */
  paint: Worn | null;
  /** Glasses, an eye patch, a bandana over the mouth. */
  acc: Worn | null;
  /** Tie, chain, towel. */
  neck: Worn | null;
  /** Headwear, or a full mask. */
  prop: Worn | null;
}

export interface LookSubject {
  id: string;
  gender: 'm' | 'f';
  masked: boolean;
  /** Gimmick.category, if known — used to prefer themed pieces. */
  gimmickCategory?: string;
  /** Gimmick.id, if known — reseeds the gear, so a new gimmick is a new outfit. */
  gimmickId?: string;
}

/**
 * The look inputs off anything wrestler-shaped. Undefined for somebody with
 * no recorded gender (an owner, a commentator), which leaves them on the
 * initials placeholder.
 */
export function lookSubjectOf(person: {
  id: string;
  gender?: 'm' | 'f';
  masked?: boolean;
  gimmick?: { id?: string; category?: string };
}): LookSubject | undefined {
  if (!person.gender) return undefined;
  return {
    id: person.id,
    gender: person.gender,
    masked: person.masked ?? false,
    gimmickCategory: person.gimmick?.category,
    gimmickId: person.gimmick?.id,
  };
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;

function pick<T>(rng: Rng, arr: readonly T[]): T | null {
  return arr.length === 0 ? null : arr[Math.floor(rng() * arr.length)]!;
}

const isMaskProp = (p: PaperdollAsset) => p.id.toLowerCase().includes('mask');
const isGoofy = (p: PaperdollAsset) => GOOFY_IDS.includes(p.id);

// How often a goofy piece survives into a random (un-themed) draw.
const GOOFY_KEEP = 0.2;

// Flat odds of an un-themed piece per slot. Deliberately low and
// independent: most people wear nothing on their head, and somebody wearing
// a hat, glasses, makeup AND a chain should be a rare sight.
const ODDS = { top: 0.35, outer: 0.15, waistband: 0.9, logo: 0.55, prop: 0.2, acc: 0.13, paint: 0.1, neck: 0.1 };
// How often a gimmick that has a themed piece for a slot actually wears it.
// Headwear is the signature item; the rest are supporting touches.
const THEMED = { logo: 0.5, prop: 0.55, acc: 0.3, paint: 0.3, neck: 0.3 };

/**
 * Null when no base body exists yet for that gender — callers fall back to
 * the plain initials placeholder, so the game works with an empty asset
 * library and only gets richer as files are added.
 */
export function assignLook(subject: LookSubject): ComposedLook | null {
  const baseUrl = BASE_BODY[subject.gender];
  if (!baseUrl) return null;

  const of = (pool: readonly PaperdollAsset[]) => pool.filter((a) => a.gender === subject.gender || a.gender === 'both');

  const body = mulberry32(hashString(subject.id));
  const gear = mulberry32(hashString(`${subject.id}:gear:${subject.gimmickId ?? ''}`));
  const accent = (rng: Rng, not?: string | null) => pick(rng, ACCENT_COLORS.filter((c) => c.color !== not))!.color;
  const worn = (asset: PaperdollAsset | null, color: () => string): Worn | null =>
    asset ? { asset, color: asset.tintable ? color() : null } : null;

  // ---- body: stable for life -------------------------------------------
  const skin = pick(body, SKIN_TONES)!;
  // Drawn once and shared, so a redhead's beard matches their hair.
  const hairColor = pick(body, HAIR_COLORS)!.color;
  const face = pick(body, of(FACE_ASSETS));
  const man = subject.gender === 'm';
  // Bald and clean-shaven are looks too. Goofy cuts are held back the same
  // way goofy hats are.
  const bald = man && body() < 0.12;
  const hairPool = of(HAIR_ASSETS);
  const seriousHair = hairPool.filter((h) => !isGoofy(h));
  const hairAsset = bald ? null : pick(body, body() < GOOFY_KEEP || seriousHair.length === 0 ? hairPool : seriousHair);
  const facialAsset = man && body() < 0.55 ? pick(body, of(FACIAL_ASSETS)) : null;

  // ---- gear: follows the gimmick ---------------------------------------
  const keywords = subject.gimmickCategory ? (GIMMICK_CATEGORY_PROP_KEYWORDS[subject.gimmickCategory] ?? []) : [];
  /** A themed piece if the gimmick asks for one, otherwise an occasional random one. */
  const slot = (pool: readonly PaperdollAsset[], kind: keyof typeof THEMED): PaperdollAsset | null => {
    const themed = pool.filter((p) => keywords.some((k) => p.id.includes(k)));
    if (themed.length > 0 && gear() < THEMED[kind]) return pick(gear, themed);
    if (gear() >= ODDS[kind]) return null;
    const serious = pool.filter((p) => !isGoofy(p));
    return pick(gear, gear() < GOOFY_KEEP || serious.length === 0 ? pool : serious);
  };

  // DESIGN: women always get a top. The base body is drawn bare, and a
  // bare-chested portrait is right for most of the men's roster and wrong
  // for the entire women's one.
  const top = worn(gear() < (man ? ODDS.top : 1) ? pick(gear, of(TOP_ASSETS)) : null, () => accent(gear));
  // A one-strap singlet leaves the chest centre bare; a logo there would
  // sit half on skin.
  const logoOk = top && !top.asset.id.includes('onestrap');
  const logo = logoOk ? worn(slot(of(LOGO_ASSETS), 'logo'), () => accent(gear, top.color)) : null;
  const outer = worn(gear() < ODDS.outer ? pick(gear, of(OUTER_ASSETS)) : null, () => accent(gear));
  const waistband = worn(gear() < ODDS.waistband ? pick(gear, of(WAISTBAND_ASSETS)) : null, () => accent(gear));
  const neck = worn(slot(of(NECK_ASSETS), 'neck'), () => accent(gear));

  const props = of(PROP_ASSETS);
  const shared = { baseUrl, skinColor: skin.color, baseDetailUrl: BASE_DETAIL[subject.gender] ?? null, face, top, logo, outer, waistband, neck };

  // A required mask replaces hair, beard, makeup and anything else on the
  // face outright — Gimmick.masked makes it a mechanical fact about the
  // character (Wrestler.masked), not a look the RNG opts into.
  if (subject.masked) {
    const mask = worn(pick(gear, props.filter(isMaskProp)), () => accent(gear));
    return { ...shared, hair: null, facial: null, paint: null, acc: null, prop: mask };
  }

  // A mask asset never lands on a wrestler who isn't supposed to be masked.
  const prop = worn(slot(props.filter((p) => !isMaskProp(p)), 'prop'), () => accent(gear));
  const acc = worn(slot(of(ACC_ASSETS), 'acc'), () => accent(gear));
  const paint = worn(slot(of(PAINT_ASSETS), 'paint'), () => accent(gear));

  return {
    ...shared,
    hair: worn(hairAsset, () => hairColor),
    facial: worn(facialAsset, () => hairColor),
    paint,
    acc,
    prop,
  };
}
