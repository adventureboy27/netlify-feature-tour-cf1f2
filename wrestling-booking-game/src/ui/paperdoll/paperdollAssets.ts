// The asset library, read straight off the filesystem — dropping a correctly
// named file into assets/hair, assets/facial or assets/prop is the entire
// way to add one. Nothing here needs editing when a new file shows up; Vite's
// glob re-runs at build/dev time and picks it up.
//
// Naming, enforced by the parse below rather than documented and hoped for:
//   assets/base/m.png / assets/base/f.png            — exactly one each, tinted to skin tone
//   assets/base/m-detail.png / f-detail.png          — optional, NEVER tinted (see below)
//   assets/hair/<m|f|both>-<id>.png                  — e.g. m-buzzcut.png
//   assets/facial/<m|f|both>-<id>.png                — e.g. m-goatee.png
//   assets/prop/<m|f|both>-<id>.png                  — e.g. both-military-cap.png
//   assets/top/<m|f|both>-<id>.png                   — e.g. m-tshirt.png (torso garment)
//   assets/outer/<m|f|both>-<id>.png                 — e.g. m-vest.png (worn over a top)
//   assets/waistband/<m|f|both>-<id>.png              — e.g. both-trunks-band.png
// Any format works (png, svg, webp, jpg) as long as every layer for a given
// wrestler shares the same square canvas and head position — see
// ui/paperdoll/assets/README.md for the exact spec. A file that doesn't
// match the pattern is silently skipped rather than crashing the app; a
// typo'd filename just means one fewer option in the pool, not a build error.
//
// A `--tint` suffix before the extension (e.g. m-buzzcut--tint.png,
// both-bandana--tint.png) opts that one file into being recolored in code —
// hair/facial get a color drawn from hairColors.ts, props from
// accentColors.ts — the same trick skin tone always uses on the base body.
// Without the marker, a file is drawn exactly as painted, every time. This
// is the whole answer to "can I recolor something before it goes on the
// bust": paint the shape once, add --tint to the filename, done — no code
// change, same as adding any other asset.
//
// base/m-detail.png (and f-detail.png) is a special optional file: anatomical
// definition — muscle striations, chest/pec lines, a bust curve — drawn as
// dark linework on an otherwise fully transparent layer, composited directly
// on top of the tinted skin layer. It is never tinted, by design: it has to
// sit on top of whatever skin tone got assigned, and a masked flat recolor
// would either wash it out or clash with the color beneath it. Painting
// muscle definition as shaded color on the base body itself doesn't work
// here — the base's own tintable fill is a full-alpha flat mask, so anything
// painted into it gets discarded in favor of the assigned skin color, shading
// included. The detail overlay is the way to keep that definition anyway:
// it lives on its own layer specifically so it never needs recoloring.

export type AssetGender = 'm' | 'f' | 'both';

export interface PaperdollAsset {
  id: string;
  gender: AssetGender;
  url: string;
  tintable: boolean;
  /**
   * Drawn on the oversized canvas (a `--xl` marker in the filename): the
   * usual 512 square plus a 64 margin each side and 128 on top, so a tall
   * hat or big hair is not cut off at the canvas edge.
   */
  xl: boolean;
}

// Vite statically analyzes this call, so each options object must be a
// literal right here — a shared constant reference fails to parse.
const BASE_FILES = import.meta.glob('./assets/base/*.{png,svg,webp,jpg,jpeg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const FACE_FILES = import.meta.glob('./assets/face/*.{png,svg,webp,jpg,jpeg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const HAIR_FILES = import.meta.glob('./assets/hair/*.{png,svg,webp,jpg,jpeg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const FACIAL_FILES = import.meta.glob('./assets/facial/*.{png,svg,webp,jpg,jpeg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const PROP_FILES = import.meta.glob('./assets/prop/*.{png,svg,webp,jpg,jpeg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const ACC_FILES = import.meta.glob('./assets/acc/*.{png,svg,webp,jpg,jpeg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const PAINT_FILES = import.meta.glob('./assets/paint/*.{png,svg,webp,jpg,jpeg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const NECK_FILES = import.meta.glob('./assets/neck/*.{png,svg,webp,jpg,jpeg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const LOGO_FILES = import.meta.glob('./assets/logo/*.{png,svg,webp,jpg,jpeg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const TOP_FILES = import.meta.glob('./assets/top/*.{png,svg,webp,jpg,jpeg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const OUTER_FILES = import.meta.glob('./assets/outer/*.{png,svg,webp,jpg,jpeg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const WAISTBAND_FILES = import.meta.glob('./assets/waistband/*.{png,svg,webp,jpg,jpeg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

function basename(path: string): string {
  const file = path.split('/').pop() ?? path;
  return file.replace(/\.[a-z0-9]+$/i, '');
}

const TINT_SUFFIX = '--tint';
// Always before --tint when both are present: `m-top-hat--xl--tint.svg`.
const XL_SUFFIX = '--xl';

function parseGendered(files: Record<string, string>): PaperdollAsset[] {
  const out: PaperdollAsset[] = [];
  for (const [path, url] of Object.entries(files)) {
    const match = basename(path).match(/^(m|f|both)-(.+)$/);
    if (!match) continue;
    const rawId = match[2]!;
    const tintable = rawId.endsWith(TINT_SUFFIX);
    const untinted = tintable ? rawId.slice(0, -TINT_SUFFIX.length) : rawId;
    const xl = untinted.endsWith(XL_SUFFIX);
    const id = xl ? untinted.slice(0, -XL_SUFFIX.length) : untinted;
    out.push({ id, gender: match[1] as AssetGender, url, tintable, xl });
  }
  return out;
}

export const BASE_BODY: Partial<Record<'m' | 'f', string>> = (() => {
  const out: Partial<Record<'m' | 'f', string>> = {};
  for (const [path, url] of Object.entries(BASE_FILES)) {
    const name = basename(path);
    if (name === 'm' || name === 'f') out[name] = url;
  }
  return out;
})();

export const BASE_DETAIL: Partial<Record<'m' | 'f', string>> = (() => {
  const out: Partial<Record<'m' | 'f', string>> = {};
  for (const [path, url] of Object.entries(BASE_FILES)) {
    const name = basename(path);
    if (name === 'm-detail' || name === 'f-detail') out[name.slice(0, 1) as 'm' | 'f'] = url;
  }
  return out;
})();

/** Eyes, brows, nose, mouth — never recolored, drawn under hair and props. */
export const FACE_ASSETS: readonly PaperdollAsset[] = parseGendered(FACE_FILES);
export const HAIR_ASSETS: readonly PaperdollAsset[] = parseGendered(HAIR_FILES);
export const FACIAL_ASSETS: readonly PaperdollAsset[] = parseGendered(FACIAL_FILES);
export const PROP_ASSETS: readonly PaperdollAsset[] = parseGendered(PROP_FILES);
export const TOP_ASSETS: readonly PaperdollAsset[] = parseGendered(TOP_FILES);
export const OUTER_ASSETS: readonly PaperdollAsset[] = parseGendered(OUTER_FILES);
export const WAISTBAND_ASSETS: readonly PaperdollAsset[] = parseGendered(WAISTBAND_FILES);
/** Worn on the face — glasses, an eye patch, a bandana over the mouth. Over hair and beard, under a hat. */
export const ACC_ASSETS: readonly PaperdollAsset[] = parseGendered(ACC_FILES);
/** Face makeup. Drawn under the facial features so eyes and mouth stay readable. */
export const PAINT_ASSETS: readonly PaperdollAsset[] = parseGendered(PAINT_FILES);
/** Ties, chains, towels — over everything on the torso. */
export const NECK_ASSETS: readonly PaperdollAsset[] = parseGendered(NECK_FILES);
/** A chest graphic, only ever drawn on a top and cut to that top's shape. */
export const LOGO_ASSETS: readonly PaperdollAsset[] = parseGendered(LOGO_FILES);
