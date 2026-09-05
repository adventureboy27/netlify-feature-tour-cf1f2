// The asset library, read straight off the filesystem — dropping a correctly
// named file into assets/hair, assets/facial or assets/prop is the entire
// way to add one. Nothing here needs editing when a new file shows up; Vite's
// glob re-runs at build/dev time and picks it up.
//
// Naming, enforced by the parse below rather than documented and hoped for:
//   assets/base/m.png / assets/base/f.png            — exactly one each
//   assets/hair/<m|f|both>-<id>.png                  — e.g. m-buzzcut.png
//   assets/facial/<m|f|both>-<id>.png                — e.g. m-goatee.png
//   assets/prop/<m|f|both>-<id>.png                  — e.g. both-military-cap.png
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

export type AssetGender = 'm' | 'f' | 'both';

export interface PaperdollAsset {
  id: string;
  gender: AssetGender;
  url: string;
  tintable: boolean;
}

// Vite statically analyzes this call, so each options object must be a
// literal right here — a shared constant reference fails to parse.
const BASE_FILES = import.meta.glob('./assets/base/*.{png,svg,webp,jpg,jpeg}', {
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

function basename(path: string): string {
  const file = path.split('/').pop() ?? path;
  return file.replace(/\.[a-z0-9]+$/i, '');
}

const TINT_SUFFIX = '--tint';

function parseGendered(files: Record<string, string>): PaperdollAsset[] {
  const out: PaperdollAsset[] = [];
  for (const [path, url] of Object.entries(files)) {
    const match = basename(path).match(/^(m|f|both)-(.+)$/);
    if (!match) continue;
    const rawId = match[2]!;
    const tintable = rawId.endsWith(TINT_SUFFIX);
    const id = tintable ? rawId.slice(0, -TINT_SUFFIX.length) : rawId;
    out.push({ id, gender: match[1] as AssetGender, url, tintable });
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

export const HAIR_ASSETS: readonly PaperdollAsset[] = parseGendered(HAIR_FILES);
export const FACIAL_ASSETS: readonly PaperdollAsset[] = parseGendered(FACIAL_FILES);
export const PROP_ASSETS: readonly PaperdollAsset[] = parseGendered(PROP_FILES);
