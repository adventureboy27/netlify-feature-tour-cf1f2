# Wrestler portraits

Every wrestler shows one flat image: a real photo the booker uploaded, a
composited look built from the paperdoll asset library (see `assets/README.md`)
if the call site opted in and has one to assign, or a plain initials
placeholder if neither exists.

This replaced an earlier generated-pixel-art system entirely (procedural
sprites composited from an indexed atlas, one wrestler at a time, from a
20-trait `Appearance` vector) rather than sitting alongside it. That system
is gone — the atlas, the generator (`tools/wrestler_atlas.py`), the trait
vector, the distinctness checks that kept generated sprites from looking
alike, the gimmick-driven "outfit" changes, the stable unified-color
palettes — all of it, along with anything that only existed to serve it.

## How it works now

- `Wrestler.photoDataUrl?: string` (`engine/types.ts`) — an optional data URI.
  Absent for almost everyone; the vast majority of the roster is procedurally
  generated (free agents, academy graduates, rival rosters) and nobody is
  uploading a photo for all of them.
- `PaperDoll.tsx` is still the single render point every screen uses. When
  `photoDataUrl` is set it draws that image. Otherwise, if the call site
  passed a `lookSubject` (id, gender, masked, gimmick category) it asks
  `assignLook.ts` for a composited look built from `assets/` — base body,
  skin tone, hair, facial hair, a themed prop — and renders that via
  `ComposedPortrait.tsx`. If neither exists (no photo, no `lookSubject`, or an
  empty asset library), it falls back to the plain initials circle, same as
  before this existed — same idea as the commentator avatars in the match
  viewer, just generalized.
- The composited look is **not** the old atlas system come back: real art
  files, supplied by the booker or their artist, drawn once each and reused
  across the whole roster — not code drawing shapes, and not a swappable-parts
  engine trying to stay distinct at world-population scale. See
  `assets/README.md` for the asset spec and naming rules, and
  `gimmickPropTags.ts` for how a gimmick prefers a themed prop.
- `photoUpload.ts` is where an uploaded file becomes that data URI: decode →
  draw to an off-screen canvas, centre-cropped to a square → resize → export
  as compressed WebP. Runs entirely in the browser; nothing here is a network
  call, same as the rest of the game.
- The upload/remove-photo control lives in `ui/screens/WrestlerEditor.tsx`,
  next to the live preview.

## What's gone, for anyone looking for it

- `Appearance` (skin tone, build, hairstyle, attire, three color slots, ...),
  `RENDERED_APPEARANCE_KEYS`, `appearanceHammingDistance` / distinctness at
  generation and repackage time — deleted. Real photos don't need a
  Hamming-distance check to avoid looking alike, and there was nothing left
  to generate once nothing rendered from the vector.
- `GimmickLook` / `applyGimmickLook` / `effectiveAppearance` (gimmick outfits,
  stable unified colors) — deleted. Both only ever existed to nudge
  `Appearance` traits.
- `resemblance()` in `career/lineage.ts` (a second-generation wrestler
  inheriting their parent's look) — deleted for the same reason. Everything
  else about lineage (the name, the inherited standing, proving it, fading
  out) is untouched — that was never about the sprite.
- `tools/wrestler_atlas.py`, the indexed PNG sheets, `spriteCache.ts`,
  `useAtlasSheets.ts`, `crops.ts`, `palette.ts` — deleted.
