// Turns a save file into a ready-to-use art shot list: one image-generation
// prompt and one target filename per wrestler on the player's own roster —
// the only pool BatchPhotoImport.tsx actually matches against.
//
// Why this exists: the old procedural sprite atlas (see git history,
// f66103e "Replace the generated sprite atlas with real photo uploads") drew
// its own art in code and it wasn't good. This does not draw anything — it
// writes a text description per wrestler for a real image model to draw, one
// cohesive image per shot rather than composited layers. Variety lives in the
// prompt text (skin tone, hair, build, a gimmick prop), not in swappable
// parts, so there is no compositing engine to build or maintain here.
//
// Deterministic per wrestler, not random per run: every trait is derived from
// a hash of the wrestler's own id, the same "seed off the entity, never the
// shared stream" rule the rest of this codebase follows for RNG (see
// CLAUDE.md's "Traps" section). Re-running this script against the same save
// reproduces the same prompts, so a rerun after a few weeks of play only adds
// new wrestlers instead of reshuffling everybody else's look.
//
// Usage:
//   node scripts/wrestlerArtPrompts.mjs path/to/save-export.json > shotlist.md
//
// The input is whatever "Export save" (Settings screen) downloads. Only
// world.wrestlers and world.promotion.rosterIds are read; nothing is sent
// anywhere, this never touches the network.

import { readFileSync } from 'node:fs';

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

const inputPath = process.argv[2];
if (!inputPath) {
  fail('Usage: node scripts/wrestlerArtPrompts.mjs path/to/save-export.json');
}

let file;
try {
  file = JSON.parse(readFileSync(inputPath, 'utf8'));
} catch (err) {
  fail(`Could not read/parse ${inputPath}: ${err.message}`);
}

const world = file.world ?? file; // tolerate a bare World export too
if (!world?.wrestlers || !world?.promotion?.rosterIds) {
  fail('That does not look like a save export — expected world.wrestlers and world.promotion.rosterIds.');
}

// --- deterministic per-id hash, same idea as PaperDoll.tsx's placeholderColor ---
function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// A tiny seeded PRNG (mulberry32) driven off the hash, so a wrestler gets a
// consistent *sequence* of picks (skin, then hair color, then hair style, ...)
// rather than every trait collapsing onto the same single hash value.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

const SKIN_TONES = ['pale', 'fair', 'olive', 'tan', 'brown', 'dark brown', 'deep ebony'];
const HAIR_COLORS = ['black', 'dark brown', 'chestnut brown', 'sandy blond', 'platinum blond', 'auburn red', 'salt-and-pepper grey', 'bleached white'];
const HAIRSTYLES = ['buzzed short', 'shaved bald', 'a slicked-back crew cut', 'shoulder-length', 'a long ponytail', 'a mohawk', 'close-cropped with a hard part', 'wild and shaggy'];
const HAIRSTYLES_F = ['a long ponytail', 'a shaved undercut', 'shoulder-length and loose', 'long and braided', 'a short pixie cut', 'twin braids', 'a messy bun', 'long and wind-blown'];
const FACIAL_HAIR = ['clean-shaven', 'a thick beard', 'a goatee', 'a handlebar moustache', 'heavy stubble', 'thin chin strap facial hair'];

const BUILD_BY_ARCHETYPE = {
  powerhouse: 'a massive, heavily muscled build',
  monster: 'an enormous, intimidating build, taller and broader than everyone around them',
  technician: 'a lean, compact athletic build',
  highFlyer: 'a slight, wiry, acrobatic build',
  brawler: 'a thick, scarred, bruiser build',
  showman: 'a chiseled, camera-ready physique',
  veteran: 'a weathered, sturdy build carrying the wear of a long career',
  rookie: 'a fit, still-filling-out build',
};

const EXPRESSION_HEEL = ['a smug sneer', 'a cold, contemptuous stare', 'a mocking grin', 'a menacing glare'];
const EXPRESSION_FACE = ['a confident, easy smile', 'a determined, steady gaze', 'a warm, crowd-ready grin', 'a fierce, focused look'];
const EXPRESSION_NEUTRAL = ['an intense, unreadable stare', 'a calm, focused expression', 'a proud, steady gaze'];

const STYLE_PREFIX =
  'Digital painting, dramatic studio lighting, head-and-shoulders portrait, professional wrestling promotional photo style, consistent painterly art direction';

function normalizeName(s) {
  return s
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
}

function targetFilename(wrestler, ext) {
  // Mirrors BatchPhotoImport.tsx's parseFileName exactly: <M|F>-<name>.<ext>
  const genderPrefix = wrestler.gender === 'f' ? 'F' : 'M';
  return `${genderPrefix}-${wrestler.name}.${ext}`;
}

function buildPrompt(wrestler, rng) {
  const skin = pick(rng, SKIN_TONES);
  const hairColor = pick(rng, HAIR_COLORS);
  const hairstyle = pick(rng, wrestler.gender === 'f' ? HAIRSTYLES_F : HAIRSTYLES);
  const facialHair = wrestler.gender === 'm' ? pick(rng, FACIAL_HAIR) : null;
  const build = BUILD_BY_ARCHETYPE[wrestler.archetype] ?? 'an athletic build';

  const alignment = wrestler.alignment ?? 0;
  const expression =
    alignment <= -25 ? pick(rng, EXPRESSION_HEEL) : alignment >= 25 ? pick(rng, EXPRESSION_FACE) : pick(rng, EXPRESSION_NEUTRAL);

  const parts = [
    STYLE_PREFIX + '.',
    `A professional wrestler with ${skin} skin and ${build}.`,
  ];

  if (wrestler.masked) {
    parts.push('Face fully covered by a colorful lucha-style wrestling mask, no visible hair.');
  } else if (hairstyle === 'shaved bald') {
    parts.push(`A shaved bald head${facialHair ? `, ${facialHair}` : ''}.`);
  } else {
    parts.push(
      `${hairColor} hair, ${hairstyle}${facialHair ? `, ${facialHair}` : ''}.`,
    );
  }

  parts.push(`Wearing ${expression}.`);

  // Gimmick flavor — the one thing worth regenerating art for when it changes,
  // since a repackage's name/character concept is exactly what this line reads.
  const gimmick = wrestler.gimmick;
  if (gimmick?.prop) {
    parts.push(`Carrying or wearing ${gimmick.prop}, fitting a "${gimmick.name}" character.`);
  } else if (gimmick?.concept) {
    parts.push(`Styled to fit a "${gimmick.name}" character: ${gimmick.concept}`);
  }

  parts.push('Square crop, centered, plain neutral background, no text or logos.');

  return parts.join(' ');
}

const roster = world.promotion.rosterIds
  .map((id) => world.wrestlers[id])
  .filter(Boolean)
  .sort((a, b) => a.name.localeCompare(b.name));

if (roster.length === 0) {
  fail('Roster is empty — nothing to generate prompts for.');
}

console.log(`# Wrestler art shot list — ${world.promotion?.name ?? 'promotion'} (${roster.length} wrestlers)\n`);
console.log(
  'Generate each image with your image model of choice, save it under the exact filename shown, ' +
    'then drop the whole folder into Settings -> Batch photo import. Filenames already match its ' +
    '`M-`/`F-` exact-name convention, so nothing needs renaming.\n',
);
console.log(
  'Re-run this script later against a fresh save export to pick up new signings only — everyone ' +
    "already on this list gets the exact same prompt again, since it's derived from their id, not rolled fresh.\n",
);

for (const w of roster) {
  const rng = mulberry32(hashString(w.id));
  const ext = w.gender === 'f' ? 'jpg' : 'png';
  console.log(`## ${targetFilename(w, ext)}`);
  console.log(`${buildPrompt(w, rng)}\n`);
}
