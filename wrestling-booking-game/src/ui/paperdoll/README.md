# Paper dolls

How a wrestler becomes a sprite (§7 of `booking-game-design.md`).

```
Appearance          atlas/traits.ts        atlas/sheets.ts        atlas/compose.ts
(20 ints)  ──────>  frame + 6 cells   +    index buffers   ──────>  64x96 RGBA
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

The PNGs are inlined into the bundle as data URIs (`?inline`, ~150 KB for all
108 — six slots across eighteen bodies). Nothing fetches anything, so "fully
offline, no network calls anywhere" holds by construction rather than by
service-worker config.

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

## Six slots: head, face, extra, upper, lower, feet

Paint order back to front, all sharing one 64x96 origin. `face` is facial hair
and `extra` is whatever sits over the eyes — shades, glasses, an eye patch, a
headband, warpaint.

Those two are late additions and the reason is worth keeping. At the sizes the
game actually draws a wrestler — a bust on a roster card, a thumb in a picker —
the head is nearly the whole sprite, and there were eight head cells. A 24-man
roster could put three men in the same skull. Measured on a 2000-person world
before the change: **200 silhouettes shared by three or more people, the worst
of them worn by ten.** After: none shared by three, the worst by two, and every
one of the 2000 distinct once colour is counted. `atlas/lookalikes.test.ts`
holds that line.

## What the atlas does not express yet

`Appearance` carries 20 traits and the sheets now draw 15 of them: `skinTone`,
`build`, `height`, `hairStyle`, `hairColor`, `facialHair`, `attireTop`,
`attireBottom`, `boots`, `mask`, `accessory`, `glasses`, and the three colour
slots. The five that still draw nothing are `faceShape`, `eyes`, `shirt`,
`tattoos` and `beltStyle`.

That list is not just documentation — it is
`RENDERED_APPEARANCE_KEYS` in `engine/generate/appearance.ts`, and the §7
distinctness check measures Hamming distance over *it* rather than over all
twenty. It has to: the old rule let two wrestlers clear "four traits apart" on
`faceShape`, `eyes`, `tattoos` and `shirt` alone and then render as the same
man. `lookalikes.test.ts` asserts the list is exactly the set of traits that
change a sprite, so cutting cells for tattoos fails the suite until the list
catches up.

One trait reads the wrestler rather than only itself: `facialHair` is rolled
only for `m`. It was a flat 50% for everybody, which was harmless while the
trait drew nothing and put half the women in the business in goatees the
moment it did. The editor still exposes it for anyone who wants a bearded
lady on purpose.

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
about 8 KB per frame across all six slots, so the axis count is a real budget:
eighteen frames is ~150 KB of PNG.

The mapping tables in `atlas/traits.ts` are authored rather than modulo
arithmetic, so trait ranges wider than the cell list produce a distribution
someone chose — `none` takes nine of the sixteen `accessory` values because an
accessory on two thirds of a roster stops being a distinguishing mark and
starts being the house style. Adding cells to the generator means extending
those tables.

`extra` is the one slot fed by two traits: `glasses` overrides `accessory`
when set, the same way `mask` overrides `hairStyle`, because you cannot wear a
headband over your eyes. `traitValueForCell` reads the `accessory` table, so
every extra cell has to stay reachable from it — the editor writes back
through that path.

## Note on §7

§7 opens with "No image assets." That is no longer true — the art is a
generated sprite atlas rather than shapes drawn at runtime. Everything else
§7 asks for is unchanged and still holds: integer trait vector in, layered
pixel-art sprite out, low internal resolution scaled with nearest-neighbour,
`full`/`bust`/`thumb` variants, container-level heel/face palette shift, and
an editor covering every trait. Flagged here per the §0 working agreement.
