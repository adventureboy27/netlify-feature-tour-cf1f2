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

**`base/m.png` and `base/f.png` are still v1 art** (head-to-chest framing,
submitted before the v2 head-to-waist framing above was decided) — they work
correctly today, they're just framed tighter than the current spec calls
for. Due to be replaced with v2 versions; every hair/facial/prop file is
still placeholder either way, so nothing downstream is blocked on this.
