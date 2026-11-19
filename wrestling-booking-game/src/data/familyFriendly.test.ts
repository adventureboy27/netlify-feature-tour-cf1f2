// This is not a mature game: no sexual innuendo, no slurs or stereotypes, no
// swearing, no drinking or drugs. And it may be sold, so nothing that belongs
// to somebody else either: a wrestling company's events and catchphrases, a
// real team's or wrestler's name (data/blocklist.ts keeps real ring names out
// of generation; this keeps them out of everything else), a real brand. Every string the game can show a player
// lives in a string literal somewhere under src/, so this reads them all and
// fails on anything from the list below. A word that is fine in a code
// identifier (a "strip" of lights, a "screwy" finish weight) is never in a
// string a player reads, so only literals are checked.
//
// Grow the list when something slips through. If a real, harmless use trips
// it, rephrase the line rather than loosening the pattern.

import { describe, expect, it } from 'vitest';

/** Every source file under src/, read as text (Vite's raw glob, as engine/career/pronouns.test.ts does). */
const FILES = import.meta.glob('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const NOT_FOR_THIS_GAME = new RegExp(
  [
    // sexual
    'sexy', '\\bsex\\b', 'seduc', '\\blust', 'naked', '\\bnude', 'stripper', 'hooker', 'booty', '\\bboob', '\\bthong',
    'lingerie', '\\bpimp', 'playboy', '\\bvixen', 'temptress', '\\bharlot', 'horny', 'kinky', 'fetish', 'bombshell', '\\bslut',
    '\\bwhore', '\\bbimbo', '\\bhussy', 'ring ?rat', 'cockburn', 'total package',
    // drinking and drugs
    '\\bdrunk', '\\bbooze', '\\bbeer\\b', '\\blager\\b', 'whiskey', '\\bvodka', 'liquor', 'moonshin', 'hangover',
    'bar fight', 'cocaine', 'heroin', 'junkie', '\\bstoned\\b',
    // swearing
    '\\bdamn', '\\bhell\\b', 'bastard', '\\bbitch', '\\bcrap\\b', '\\bpiss', '\\bshit', '\\bfuck', '\\bsucks\\b',
    // slurs, stereotypes and hate
    'retard', 'midget', '\\bspaz', 'tranny', '\\bfag', '\\bdyke', '\\bgyps', 'eskimo', 'redskin', '\\bsavage', '\\binjun',
    '\\bsquaw', '\\bchink', '\\bjap\\b', 'oriental', 'voodoo', 'cannibal', '\\bnazi', 'hitler', '\\bkkk\\b', 'stormfront',
    'confederate', '\\bslave', '\\bghetto', 'wetback', 'beaner', '\\bkaren\\b', 'sombrero',
    // organised crime as a brand
    '\\bcartel', '\\bmafia',
    // other people's property: wrestling companies, their events and catchphrases, real teams and nicknames
    '\\bwwe\\b', '\\bwcw\\b', '\\becw\\b', '\\baew\\b', '\\btna\\b', 'wrestlemania', 'summerslam', 'royal rumble', 'starrcade',
    'smackdown', 'survivor series', 'hell in a cell', 'suplex city', 'twin towers', 'midnight express',
    'jumping bomb angels', 'mouth of the south', 'rattlesnake', 'best in the world', 'total package', 'junkyard dog',
    '\\bhitman\\b', 'booker ?t\\b', 'wendy',
  ].join('|'),
  'i',
);

/** Files whose strings are deliberately not shown as game content. */
const SKIP = new Set([
  // Real wrestlers' names, kept only so generation can avoid them.
  'src/data/blocklist.ts',
  // The scrub's own pattern lists.
  'src/data/familyFriendly.test.ts',
  'src/data/matchBeats.ts:NOT_IN_SUMO',
]);

/**
 * The contents of every string and template literal in a file, comments left
 * out — and in a screen, the text written straight into the markup too.
 */
function literals(code: string, jsx = false): string[] {
  const withoutComments = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  const out: string[] = [];
  const re = /'((?:\\.|[^'\\\n])*)'|"((?:\\.|[^"\\\n])*)"|`((?:\\.|[^`\\])*)`/g;
  for (const m of withoutComments.matchAll(re)) out.push(m[1] ?? m[2] ?? m[3] ?? '');
  if (jsx) for (const m of withoutComments.matchAll(/>([^<>{}]*[A-Za-z][^<>{}]*)</g)) out.push(m[1]!);
  return out;
}

describe('a game for everybody', () => {
  it('says nothing suggestive, offensive, crude, or about drink or drugs', () => {
    const files = Object.entries(FILES).filter(([path]) => !/\.test\.tsx?$/.test(path));
    expect(files.length).toBeGreaterThan(100);
    const found: string[] = [];
    for (const [path, code] of files) {
      const rel = path.startsWith('./') ? `src/data/${path.slice(2)}` : `src/${path.replace(/^\.\.\//, '')}`;
      if (SKIP.has(rel)) continue;
      for (const text of literals(code, path.endsWith('.tsx'))) {
        // The sumo filter is a list of words a line must not contain; it is not a line.
        if (text.startsWith('rope|turnbuckle')) continue;
        // A camelCase id (a gimmick's, a sponsor's) is stored in saves and never shown; its display name is checked.
        if (/^[a-z]+[A-Z][A-Za-z0-9]*$/.test(text)) continue;
        const hit = NOT_FOR_THIS_GAME.exec(text);
        if (hit) found.push(`${rel}: "${hit[0]}" in ${JSON.stringify(text.slice(0, 120))}`);
      }
    }
    expect(found).toEqual([]);
  });

  it('really does catch them, in any kind of string', () => {
    const sample = "const a = 'The Bombshells'; const b = `${name} SUCKS`; const c = \"a hotel bar fight\"; // a comment saying hell is fine\nconst d = <p>What the hell</p>;";
    const caught = literals(sample, true).filter((t) => NOT_FOR_THIS_GAME.test(t));
    expect(caught).toEqual(['The Bombshells', '${name} SUCKS', 'a hotel bar fight', 'What the hell']);
  });
});
