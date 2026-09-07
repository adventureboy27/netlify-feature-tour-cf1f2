# Paperdoll asset library

Drop a correctly named file into one of these four folders and it's live —
nothing in code needs to change. `paperdollAssets.ts` reads the folder
contents at build/dev time; `assignLook.ts` picks from whatever's there.

The two base bodies are real art now (v2, head-to-waist framing); everything
else is still placeholder line-art. Replace files in place, same names, same
folders — nothing else changes.

## The one rule that matters: shared canvas

Every file — base body, every hairstyle, every prop — must be drawn on the
**same square canvas with the head in the same place**, or layers won't line
up. Reference: **[The Bust Line](https://claude.ai/code/artifact/c45d358a-8d70-41f0-af39-9cf655115aca)**.

- Canvas: 512×512, transparent background (PNG or SVG).
- **v2 framing (current): head-to-waist, not head-to-chest.** Head centered
  horizontally, about 25% of the canvas width across, top of head starting
  about 4% down from the top edge. Shoulders begin a little past the head's
  bottom edge, and the torso fills down to the canvas's bottom edge at
  roughly waist height — the whole square is more zoomed out than v1 was, so
  there's real room for a wrestling top (straps, a chest wrap, a singlet
  line) to actually read, rather than being cropped to a sliver of upper
  chest. Nothing below the waist is ever drawn or needed.
- Base body should be drawn **bald and as one flat mid-gray shape**, no
  internal shading — skin tone is a flat color cut to this shape's outline in
  code (see "Recoloring in code" below), so any color or gradient painted
  into the source file itself is simply discarded, not blended. Hair is its
  own layer (a "bald" hairstyle option is valid and just means an empty file
  isn't needed — simply don't pick one for that look).
- The silhouette's **outline itself** should carry real anatomy — a
  muscular male taper through the delts/lats/waist, a defined female bust
  and waist curve — since contour is the one thing a flat single-color fill
  can still express. See "Anatomical detail" below for definition *inside*
  the silhouette (muscle lines, chest/pec separation).

## Folders and naming

| Folder | What goes in it | Filename pattern |
|---|---|---|
| `base/` | The two body shapes | `m.png`, `f.png` — exactly these two names |
| `base/` | Optional anatomical detail overlay | `m-detail.png`, `f-detail.png` — see below |
| `hair/` | Hairstyles | `<m\|f\|both>-<name>.png`, e.g. `m-buzzcut.png`, `f-ponytail.png` |
| `facial/` | Facial hair | `<m\|f\|both>-<name>.png`, e.g. `m-goatee.png` (in practice always `m-`) |
| `prop/` | Headgear, masks, glasses, anything gimmick-themed | `<m\|f\|both>-<name>.png`, e.g. `both-military-cap.png` |

`both` means eligible for either gender. Any image format works (`.png`,
`.svg`, `.webp`, `.jpg`) as long as it matches the canvas spec above — mixing
formats across the library is fine.

A file that doesn't match this pattern is silently skipped, not an error —
worst case a typo'd name just means one fewer option in the pool.

## Gimmick-themed props

`gimmickPropTags.ts` maps a wrestler's gimmick category (e.g. "Military and
paramilitary") to keywords. A prop whose filename **contains** one of those
keywords gets preferred for wrestlers in that category — e.g.
`both-military-cap.png` matches the "military" keyword automatically. No
separate registration step; the filename is the whole mechanism. See that
file for the current keyword list, and add to it as new prop themes get
added.

## Masks

A filename containing "mask" (anywhere in the `<name>` part, e.g.
`m-luchador-mask.png`) is treated as a mask rather than an ordinary prop:
it's the only prop type offered to a wrestler whose `Gimmick.masked ===
'required'` field made them `Wrestler.masked`, and it replaces hair and
facial hair entirely rather than sitting on top of them. It's never offered
to anyone who isn't supposed to be masked.

## Anatomical detail — `base/m-detail.png` / `f-detail.png`

Optional, and the one file in the whole library that's never recolored,
by design. It sits directly on top of the tinted skin layer and must be
**dark linework only, on an otherwise fully transparent canvas** — muscle
striations, pec/chest separation, ab lines, deltoid and arm definition, and
for the female body, the underside curve of the bust and waist definition.

Why it's a separate file rather than painted into the base body itself: the
base body's own fill is a full-alpha flat mask (see "Recoloring in code"),
so any shading painted into *that* file — which is exactly how muscle
definition is normally drawn — gets thrown away in favor of whatever skin
tone gets assigned, same as any other color painted into it. A linework-only
overlay sidesteps that entirely: it's never masked or recolored, so it
survives on top of any skin tone untouched. Confirmed working with a rough
test file before writing this spec — the layering renders correctly at every
size the game actually uses (see "What's NOT handled yet"), though fine
detail is naturally more visible at the larger sizes than in a 24-48px
roster thumbnail.

If this file doesn't exist for a gender, nothing renders for it — no
regression, exactly like every other optional slot in this library.

## Recoloring in code — the `--tint` marker

Skin tone always works this way; anything else can opt in the same way. Add
`--tint` right before the extension — `m-buzzcut--tint.png`,
`both-bandana--tint.png` — and that file is drawn as a flat color cut exactly
to its own shape in code, using a color drawn from `hairColors.ts` (hair and
facial hair — one color is drawn per wrestler and shared by both, so a
redhead's beard matches their hair) or `accentColors.ts` (props). Paint that
file as a **flat mid-gray silhouette**, same as the base body — any color
painted into the source is discarded in favor of the assigned one, not
blended with it, so there's no reason to paint it in color at all.

Leave the marker off and a file is drawn exactly as painted, every time —
right for anything that shouldn't vary, like a mask with fixed team colors
or a pair of sunglasses that's always black.

This is a per-file choice, not a per-slot one: some hairstyles can be
`--tint` (recolored) while others in the same folder are fixed-color art, and
the same is true within `prop/`.

## What's NOT handled yet

Only `WrestlerRow.tsx` and `WrestlerTile.tsx` (the roster list and the
match-card wrestler picker) use this system today. Every other screen that
shows a wrestler still falls back to the plain initials placeholder when
there's no uploaded photo. Rolling it out further is a follow-up, tracked in
`docs/BACKLOG.md`.

**`base/m.png` is now real v2 art** — muscular, athletic, correct head-to-waist
proportions, clean transparency (verified the same way as `f.png`: solid
black background this time rather than a checkerboard, converted with
inverted thresholds — transparent below the background's luminance, opaque
above the body's). Confirmed live in a played save.

**`base/f.png` is real v2 art** — a genuinely muscular/athletic silhouette
with the bust rendered as an actual physical bulge-and-notch in the outer
edge (not internal shading, which a first attempt got wrong — internal color
gets discarded by the tint mask, only the alpha shape survives; see
"Recoloring in code" below). Verified directly: sampled the raw pixel alpha
channel to confirm the transparency is real and clean (no artifact left over
from an earlier editing pass that looked like a defect in preview but wasn't
actually present in the file's alpha data), and confirmed live in a played
save that skin tint, hair, and the armpit-to-waist gaps all render correctly.

**`base/m-detail.png` is closer to aligning with the new `base/m.png` than it
was against the old v1 body, but still not a precise match** — the detail's
shoulders and arm outline extend past the new body's actual edges (the
chest/ab lines land reasonably well). Not very visible at the sizes the game
currently renders at, but worth a proper fix: regenerate `m-detail.png` by
feeding Gemini the actual `base/m.png` file as a reference, the same
technique that got `f-detail.png` to align precisely.

**`base/f-detail.png` is now real v2 art that aligns correctly with
`base/f.png`, with genuine female-specific anatomy (bust curve, sternum
line).** Got here by feeding Gemini the actual `base/f.png` image as a
reference and asking it to draw the overlay to match what it could see in
that image, rather than describing proportions in text alone — this is
overall a more reliable technique than independent text-only prompts for
keeping two files in registration, worth using for every future asset pair.
Arrived as a PNG with the "transparent" checkerboard baked into real opaque
pixels — same root problem as the original JPEGs, different file format —
converted the same way: sampled this file's own luminance histogram
(background >=~135, ink lines topping out ~129, its own distinct calibration
from the first conversion) and mapped that gap to alpha. Verified with the
same three checks as `base/f.png`: raw alpha channel visualized directly (no
transparency defect), composited over two solid colors (checkerboard fully
gone), and overlaid directly on `base/f.png` at full size (bust curves land
exactly on the body's chest bump, arm lines trace the actual arm contour).
Confirmed live in a played save afterward.

**`f-detail.png` also still doesn't have any actual female-specific
anatomy** — same male-styled chest/ab lines as `m-detail.png`, no bust curve,
despite its prompt (now revised to v2.1, see the Prompt Sheet) asking for
one. Needs a regenerate.

Also worth knowing: the female detail file, as submitted, is essentially the
same male-styled muscular chest as the male one — no distinguishing bust
curve, which is what its actual prompt asked for. Worth a regenerate later
that pushes harder on that specifically, but not urgent while it's misaligned
with the base body anyway.

Both files arrived as JPEGs with the "transparent" area baked in as a real
checkerboard pattern (JPEG cannot store an alpha channel at all — there is no
way to export a genuinely transparent JPEG from anything). Converted by
sampling the actual pixel luminance histogram — the checkerboard sat at
luminance ≥~200, the ink line population topped out around ~190, a clean gap
between them — and mapping that gap to a hard cutoff, with a smooth ramp
across it so anti-aliased line edges stayed smooth rather than jagged.
**Any future line-art submission should ideally be a real PNG to begin with**
to skip this conversion step, but JPEG works fine as a source now that this
exists.
