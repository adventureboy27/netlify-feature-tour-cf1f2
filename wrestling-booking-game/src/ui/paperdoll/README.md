# Wrestler portraits

Every wrestler shows one flat image: a real photo the booker uploaded, or a
placeholder if nobody has.

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
  `photoDataUrl` is set it draws that image; otherwise it draws a plain
  colored circle with the wrestler's initials — same idea as the commentator
  avatars in the match viewer, just generalized. No compositing, no canvas,
  no atlas to load.
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
