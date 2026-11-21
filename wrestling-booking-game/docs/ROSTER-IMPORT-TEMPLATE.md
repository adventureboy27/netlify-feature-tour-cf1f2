# Roster import template

This file is a template + complete field reference for building a wrestler
roster to import into **Southside Championship Wrestling** (a wrestling
promotion management game). Hand this whole document to another
session/tool with instructions like "fill this out with N wrestlers" or
"replace the example entries with a real roster for [promotion]" — everything
needed to do that correctly is below. No other context is required.

The output must be **one JSON file** matching the schema and example at the
bottom. Nothing outside that JSON block is part of the deliverable.

---

## Top-level shape

```json
{
  "format": 1,
  "label": "Free text — whatever this roster is called",
  "wrestlers": [ /* array of wrestler entries, described below */ ]
}
```

- `format` — always the literal number `1`. Not optional.
- `label` — optional, free text, just a human-readable name for the file.
- `wrestlers` — required, an array. Can be any length.

## One wrestler entry

Every field except `name` is **optional**. Leave a field out entirely
(don't set it to `null` or `0` — just omit the key) if you don't have an
opinion about it; the game fills anything missing in with a complete,
sensible, distinct wrestler, so a bare `{"name": "Ace Steel"}` is a
perfectly valid, perfectly playable entry on its own. Do not feel obligated
to fill in every field for every wrestler — a realistic file is a mix of
fully-detailed entries and name-only ones.

| Field | Type | Range / valid values | Notes |
|---|---|---|---|
| `name` | string | — | **Required.** Must be unique across the whole file (case-insensitive). Ring name, not a real legal name. |
| `nickname` | string | — | Optional. "The Franchise", "Stone Cold", etc. |
| `gender` | string | `"m"` or `"f"` only | No other values are recognised. |
| `age` | number | 18–70 | |
| `alignment` | number | -100 to 100 | -100 = full heel (villain), 100 = full face (hero), near 0 = tweener/ambiguous. |
| `popularity` | number | 0–100 | How over they are. |
| `charisma` | number | 0–100 | Mic work / crowd charisma. |
| `strength` | number | 0–100 | |
| `skill` | number | 0–100 | In-ring technical skill. |
| `agility` | number | 0–100 | |
| `stamina` | number | 0–100 | |
| `toughness` | number | 0–100 | Durability / how well they take punishment. |
| `style` | string | one of the 12 below | Primary in-ring style. |
| `company` | string | any text | **Which promotion this wrestler belongs to.** See "Grouping by company" below — this is the field that matters most for a multi-promotion import. |

**Valid `style` values** (exactly these strings, case-sensitive):
`bruiser`, `technical`, `highFlyer`, `powerhouse`, `striker`, `luchador`,
`submission`, `hardcore`, `showman`, `giant`, `allRounder`, `oldSchool`

Do not invent other style names — anything not in that list is simply
ignored and the game rolls one instead.

**Do not include** an `appearance` field (visual look/sprite traits). It
exists in the underlying format but requires knowing the game's internal
art indices to use correctly, which nobody filling out this template will
have — leave it out entirely and the game generates a distinct look for
everybody automatically.

## Grouping by company

This is the one part of the format that's about *how the file is used*,
not just what a single entry looks like — and the one part where getting a
detail wrong doesn't produce an error, it produces a wrestler quietly
landing on the wrong roster or not being imported at all.

- **If every wrestler (or none of them) has a `company` field, that decides
  the mode:**
  - **Every entry tagged** → the game treats the file as multiple separate
    promotions, one per distinct `company` value. All of "ECW"'s wrestlers
    stay ECW's roster; all of "WCW"'s stay WCW's. Rosters don't get mixed
    together, and each promotion's size is simply however many wrestlers
    you gave that company — no need to make them even.
  - **No entry tagged at all** → the file is treated as one flat, ungrouped
    pool, to be divided up by the game itself.
- If you're building a **multi-company file**, use the *exact* company name
  consistently across every wrestler in that group (e.g., always `"ECW"`,
  never a mix of `"ECW"` and `"E.C.W."`) — matching is literal, not fuzzy.
- Real historical rosters were not gender-balanced, and grouped companies
  are imported exactly as given — don't force an even split within a
  company's roster just because the file supports gender data. Balance only
  matters for the *ungrouped* pool case, which the game handles on its own.

### How the game actually matches a company to a promotion — read this part carefully

The new-game screen is three steps: pick how many promotions are in the
world (1–7), **type a name for each one**, and choose Generate or Import
for each. There is no dropdown of "real" companies and no fuzzy matching —
a `company` value is only ever placed correctly if it is **exactly equal,
ignoring case, to the name the player types into a promotion slot on that
screen**. `"Eastern Championship Wrestling"` in the file matches a slot the
player named `"eastern championship wrestling"` or `"EASTERN CHAMPIONSHIP
WRESTLING"`, but not `"Eastern Championship Wrestling "` with a stray
character, and not a slot the player left named `"ECW"` if the file says
`"Eastern Championship Wrestling"`.

Two consequences that follow directly from this, both silent — the game
never blocks a start over it, it just quietly does the next-best thing:

- **A company nobody's slot name matches is not imported at all.** Its
  wrestlers are simply left out of the game — not merged into another
  promotion, not turned into free agents.
- **A file can only ever populate as many named companies as the game has
  promotion slots for**, and there are at most **7** slots total (including
  the player's own). A file with 9 distinct companies in it is fine to
  build, but only up to 7 of them can ever be used in one playthrough, and
  the player has to type each one's name exactly to claim it.

**Because of this, the single most useful thing you can do beyond just
building valid JSON is tell the person you hand the file to exactly what to
type.** End your delivery with a short, literal list like:

> To use this file, when the new-game screen asks you to name your
> promotions, type these exactly (case doesn't matter, spelling does):
> `Eastern Championship Wrestling`, `World Combat Organization`,
> `Northeast Wrestling Federation`. Mark each one Import and upload/paste
> this file once — one file covers every company in it.

If the file is a flat, ungrouped pool instead, there's nothing to type
correctly — say so instead: "no company names to match; mark however many
promotions you want as Import and this file splits evenly across them."

## Example — multi-company file, three promotions worth of talent

This is a complete, valid file. Everything in it is placeholder content —
replace the example wrestlers with real ones, keep the structure identical.

```json
{
  "format": 1,
  "label": "Sample multi-promotion universe",
  "wrestlers": [
    {
      "name": "Dutch Kessler",
      "nickname": "The Iron Horse",
      "company": "Eastern Championship Wrestling",
      "gender": "m",
      "age": 34,
      "alignment": -70,
      "popularity": 78,
      "charisma": 82,
      "strength": 75,
      "skill": 70,
      "agility": 55,
      "stamina": 68,
      "toughness": 90,
      "style": "hardcore"
    },
    {
      "name": "Reina Salvaje",
      "company": "Eastern Championship Wrestling",
      "gender": "f",
      "age": 27,
      "alignment": 60,
      "popularity": 71,
      "style": "luchador"
    },
    {
      "name": "Bobby Two-Face",
      "company": "Eastern Championship Wrestling"
    },
    {
      "name": "Colossal Order",
      "nickname": "The World Champion",
      "company": "World Combat Organization",
      "gender": "m",
      "age": 41,
      "alignment": -40,
      "popularity": 95,
      "charisma": 90,
      "strength": 88,
      "skill": 92,
      "toughness": 80,
      "style": "technical"
    },
    {
      "name": "Sable Winters",
      "company": "World Combat Organization",
      "gender": "f",
      "age": 30,
      "alignment": 20,
      "popularity": 60,
      "style": "showman"
    },
    {
      "name": "The Franchise Kidd",
      "nickname": "The Franchise",
      "company": "Northeast Wrestling Federation",
      "gender": "m",
      "age": 24,
      "alignment": 85,
      "popularity": 55,
      "charisma": 60,
      "skill": 65,
      "agility": 80,
      "style": "highFlyer"
    },
    {
      "name": "Marnie Steele",
      "company": "Northeast Wrestling Federation",
      "gender": "f"
    }
  ]
}
```

## Example — single flat pool, no companies (for a random-split import)

```json
{
  "format": 1,
  "label": "Sample flat pool, no company grouping",
  "wrestlers": [
    { "name": "Ace Steel", "gender": "m", "style": "powerhouse" },
    { "name": "Junko Blaze", "gender": "f", "style": "striker" },
    { "name": "Diesel Marsh" },
    { "name": "Roxy Calloway", "gender": "f" }
  ]
}
```

---

## Checklist before handing the file back

- [ ] Valid JSON (every `{`, `}`, `[`, `]`, `,` and `"` balanced — this is
      the single most common way a file fails to load).
- [ ] `format` is present and is `1`.
- [ ] Every wrestler has a `name`, and no two names are identical
      (case-insensitive).
- [ ] `gender` is only ever `"m"` or `"f"` where present.
- [ ] `style` is only ever one of the 12 listed values where present.
- [ ] All 0–100 stat fields are actually within 0–100.
- [ ] `alignment` is within -100 to 100.
- [ ] `age` is within 18–70.
- [ ] Either **every** wrestler has a `company`, or **none** do — not a
      partial mix (unless you deliberately want an "ungrouped leftovers"
      pool alongside named companies, which the game also supports, but
      default to one or the other unless you have a specific reason).
- [ ] No `appearance` field anywhere.
- [ ] If the file is company-grouped: **7 or fewer distinct `company`
      values** (that's the most promotion slots the game allows), and the
      delivered message includes the exact list of company names, spelled
      and cased exactly as they appear in the file, for the player to type
      into the new-game screen.
