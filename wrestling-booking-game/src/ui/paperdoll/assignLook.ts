// Decides which pieces a wrestler with no uploaded photo wears, so the
// composited fallback isn't a coin flip on every render.
//
// Seeded off the wrestler's own id — the same "seed off the entity, never
// the shared world stream" rule this codebase already follows for RNG (see
// CLAUDE.md's "Traps" section) and the same hash PaperDoll.tsx's own
// placeholderColor already uses. A wrestler's look is therefore stable for
// life, and adding new assets to the library later never reshuffles anyone
// already assigned — it only ever widens the pool a *new* wrestler can land
// in.

import { BASE_BODY, BASE_DETAIL, HAIR_ASSETS, FACIAL_ASSETS, PROP_ASSETS, type PaperdollAsset } from './paperdollAssets';
import { SKIN_TONES } from './skinTones';
import { HAIR_COLORS } from './hairColors';
import { ACCENT_COLORS } from './accentColors';
import { GIMMICK_CATEGORY_PROP_KEYWORDS } from './gimmickPropTags';

export interface ComposedLook {
  baseUrl: string;
  skinColor: string;
  /** Anatomical linework over the tinted skin layer — see paperdollAssets.ts. Null if no such file exists yet. */
  baseDetailUrl: string | null;
  hair: PaperdollAsset | null;
  /** Only set when the hair file opted into `--tint`; otherwise it's drawn exactly as painted. */
  hairColor: string | null;
  facial: PaperdollAsset | null;
  facialColor: string | null;
  prop: PaperdollAsset | null;
  propColor: string | null;
}

export interface LookSubject {
  id: string;
  gender: 'm' | 'f';
  masked: boolean;
  /** Gimmick.category, if known — used only to prefer a themed prop. */
  gimmickCategory?: string;
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

function forGender(pool: readonly PaperdollAsset[], gender: 'm' | 'f'): PaperdollAsset[] {
  return pool.filter((a) => a.gender === gender || a.gender === 'both');
}

function pick<T>(rng: () => number, arr: readonly T[]): T | null {
  return arr.length === 0 ? null : arr[Math.floor(rng() * arr.length)]!;
}

const isMaskProp = (p: PaperdollAsset) => p.id.toLowerCase().includes('mask');

/**
 * Null when no base body exists yet for that gender — callers fall back to
 * the plain initials placeholder, same as today, so the game works with an
 * empty asset library and only gets richer as files are added.
 */
export function assignLook(subject: LookSubject): ComposedLook | null {
  const baseUrl = BASE_BODY[subject.gender];
  if (!baseUrl) return null;
  const baseDetailUrl = BASE_DETAIL[subject.gender] ?? null;

  const rng = mulberry32(hashString(subject.id));
  const skin = pick(rng, SKIN_TONES)!;
  // Drawn once and shared by hair and facial hair, so a redhead's beard
  // actually matches their hair rather than rolling independently.
  const hairColor = pick(rng, HAIR_COLORS)!;

  const propPool = forGender(PROP_ASSETS, subject.gender);

  // A required mask replaces hair and facial hair outright rather than
  // sitting on top of them — Gimmick.masked already makes this a mechanical
  // fact about the character (Wrestler.masked), not a look the RNG opts into.
  if (subject.masked) {
    const maskPool = propPool.filter(isMaskProp);
    const mask = pick(rng, maskPool);
    return {
      baseUrl,
      skinColor: skin.color,
      baseDetailUrl,
      hair: null,
      hairColor: null,
      facial: null,
      facialColor: null,
      prop: mask,
      propColor: mask?.tintable ? pick(rng, ACCENT_COLORS)!.color : null,
    };
  }

  const hair = pick(rng, forGender(HAIR_ASSETS, subject.gender));
  const facial = subject.gender === 'm' ? pick(rng, forGender(FACIAL_ASSETS, 'm')) : null;

  // A mask asset never lands on a wrestler who isn't supposed to be masked.
  const nonMaskProps = propPool.filter((p) => !isMaskProp(p));
  const keywords = subject.gimmickCategory ? GIMMICK_CATEGORY_PROP_KEYWORDS[subject.gimmickCategory] : undefined;
  const themed = keywords ? nonMaskProps.filter((p) => keywords.some((k) => p.id.includes(k))) : [];
  // Falls back to any untethed prop at a modest flat chance so not every
  // wrestler without a themed match is wearing an accessory — most people in
  // this game don't gimmick around a hat.
  const prop = themed.length > 0 ? pick(rng, themed) : rng() < 0.25 ? pick(rng, nonMaskProps) : null;

  return {
    baseUrl,
    skinColor: skin.color,
    baseDetailUrl,
    hair,
    hairColor: hair?.tintable ? hairColor.color : null,
    facial,
    facialColor: facial?.tintable ? hairColor.color : null,
    prop,
    propColor: prop?.tintable ? pick(rng, ACCENT_COLORS)!.color : null,
  };
}
