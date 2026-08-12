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

`Appearance` carries 20 traits. The sheets cut cells for six of them
(`skinTone`, `hairStyle`, `mask`, `attireTop`, `attireBottom`, `boots`), the
three colour slots, and — since the body-frame work below — `build` and
`height`. The rest (`faceShape`, `eyes`, `facialHair`, `accessory`, `glasses`,
`shirt`, `tattoos`) are still generated, still edited, still saved, and still
counted by the §7 visual-distinctness check, but they do not change the sprite.

## Body frames: build and height

There are eighteen frames — two genders x `slim`/`average`/`heavy` x
`short`/`average`/`tall` — keyed `masc_heavy_tall` and so on. `frameFor` in
`atlas/traits.ts` maps an `Appearance` onto one; the tables there are authored,
so `athletic` and `thick` both land on the average body because most of a
roster should look like most of a roster and the ends of the scale are where a
silhouette earns its keep. Measured on a 24-person roster: 15 of the 18 bodies
in use.

This is done generator-side, in the landmarks, before a single pixel is
rasterised — never by stretching a finished sprite at display time, which
would give non-integer nearest-neighbour scaling and visibly uneven pixels.
`_widen` pushes every x away from the centre line; `_stretch` handles height.

Two earlier attempts at height are worth recording, because both looked
plausible and neither worked:

- **Moving the body below the collarbone down.** Invisible. The silhouette
  still filled the same cell, so short and tall were indistinguishable side by
  side.
- **Scaling the whole figure about the floor.** Read as a height difference
  but stretched the *neck* — a tall wrestler's head floated above his
  shoulders, a short one's sank into them, and the tall head clipped the top
  of the frame.

What works is anatomy: the skull-to-pelvis block is rigid and simply moves,
and only the legs lengthen or shorten to make up the difference, feet pinned
to the floor. `HEIGHTS` offsets the *average* body downward rather than
sitting at zero, because the original art already filled the 96-pixel cell to
the pixel and "taller" had nowhere to go.

Adding a build or a height means extending `BUILDS`/`HEIGHTS` in
`wrestler_atlas.py`, `FRAMES` in `atlas/manifest.ts`, the URL map in
`atlas/sheets.ts`, and the two tables in `atlas/traits.ts`. The sheets cost
about 19 KB per frame, so the axis count is a real budget: eighteen frames is
~344 KB inlined.

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
