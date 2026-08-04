# Paper dolls

How a wrestler becomes a sprite (§7 of `booking-game-design.md`).

```
Appearance          atlas/traits.ts        atlas/sheets.ts        atlas/compose.ts
(20 ints)  ──────>  frame + 4 cells   +    index buffers   ──────>  64x96 RGBA
                    + 3 color ramps        (decoded once)           ──> spriteCache
                                                                    ──> <PaperDoll>
```

## Indexed art, recolored at runtime

The sheets in `atlas/sheets/` are **indexed** PNGs: every pixel is a palette
slot, not a color. One `trunks` cell dresses the entire promotion, recolored
per wrestler when it's composited. Shape and color are independent axes —
that's what makes the roster look varied off a small amount of art.

The 16 slots are documented in `atlas/indexPalette.ts`. In short: 1-4 skin,
5 outline, 6-9 the slot's main material, 10-13 its trim, 14-15 eye whites and
pupils.

Browsers won't hand back a PNG's palette indices, only decoded RGBA, so
`atlas/sheets.ts` decodes each sheet once at startup and runs the generator's
palette *backwards* to recover the indices. From then on the app holds what
the generator meant.

The PNGs are inlined into the bundle as data URIs (`?inline`, ~11 KB for all
eight). Nothing fetches anything, so "fully offline, no network calls
anywhere" holds by construction rather than by service-worker config.

## Regenerating the art

`tools/wrestler_atlas.py` is the generator. It needs `pillow` and `numpy`:

```
python tools/wrestler_atlas.py   # rewrites atlas/sheets/, previews in tools/preview/
npm run test                     # manifest.test.ts checks the cells still match
```

`atlas/manifest.ts` is the typed mirror of the generated `atlas.json`, and
`manifest.test.ts` asserts the two agree. A regenerated atlas with different
cells fails the suite instead of quietly drawing jeans where tights used to
be.

## What the atlas does not express yet

`Appearance` carries 20 traits; the current sheets cut cells for six of them
(`skinTone`, `hairStyle`, `mask`, `attireTop`, `attireBottom`, `boots`) plus
the three color slots. The rest — **`build` and `height` most visibly**, along
with `faceShape`, `eyes`, `facialHair`, `accessory`, `glasses`, `shirt`,
`tattoos` — are still generated, still edited, still saved, and still counted
by the §7 visual-distinctness check, but they do not change the sprite.

This is deliberate. `build` used to reshape the silhouette when the renderer
drew shapes procedurally; faking it now by stretching a finished sprite at
display time would give non-integer nearest-neighbour scaling and visibly
uneven pixels, which is the opposite of what §7 asks for. The honest fix is
generator-side: `build_frame()` in `wrestler_atlas.py` already takes a full
set of skeletal landmarks, so emitting `masc_heavy`, `fem_tall` and friends is
a matter of adding frames there. When those land, extend `FRAMES` in
`atlas/manifest.ts` and `frameForGender` in `atlas/traits.ts`.

The mapping tables in `atlas/traits.ts` are authored rather than modulo
arithmetic, so trait ranges wider than the cell list (24 hair styles onto 7
haired heads) produce a distribution someone chose. Adding cells to the
generator means extending those tables.

## Note on §7

§7 opens with "No image assets." That is no longer true — the art is a
generated sprite atlas rather than shapes drawn at runtime. Everything else
§7 asks for is unchanged and still holds: integer trait vector in, layered
pixel-art sprite out, low internal resolution scaled with nearest-neighbour,
`full`/`bust`/`thumb` variants, container-level heel/face palette shift, and
an editor covering every trait. Flagged here per the §0 working agreement.
