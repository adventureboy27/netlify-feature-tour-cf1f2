// The guard on the whole rule.
//
// This bug has been found three times: once on the free-agent list under
// Deacon Yolanda's name, once across a whole session of new systems, and once
// on the older content underneath them. Fifty-six of the three hundred people
// this game generates are women, and prose written for men reads as a bug to
// every one of them.
//
// So it stops being a thing anybody has to remember. This walks the source of
// the modules that write sentences about people and fails on a bare gendered
// pronoun in a string literal — the fix is either a `Pronouns` argument or a
// rewrite that does not need one.

import { describe, expect, it } from 'vitest';

/**
 * Every engine and data source file, read as text. Vite's raw glob rather
 * than node:fs so the guard runs on the same toolchain as everything else.
 */
const SOURCES = import.meta.glob('../../{engine,data}/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/**
 * The only files allowed to contain a gendered pronoun, and why.
 *
 * This used to be a list of content waiting to be swept. It is empty of those
 * now — what is left is the two files describing fixed, named characters, and
 * the pronoun machinery itself. Nothing should be added here. If a new file
 * trips this test the answer is a `Pronouns` argument or a rewrite, not an
 * entry below.
 */
const ALLOWED = new Set([
  // Fixed, named characters whose gender is part of who they are — the
  // pronoun in their description is correct rather than assumed.
  'data/refereePool.ts',
  'data/ringsidePool.ts',
  // The helper itself, and the module that had the first private copy of it.
  'career/pronouns.ts',
  'career/scouting.ts',
]);

/**
 * The last two segments of the path, so a key reads `career/theBody.ts`
 * however the glob spelled it relative to this file.
 */
function shortName(path: string): string {
  return path.split('/').slice(-2).join('/');
}

/** Every single- double- or back-quoted literal on a line. */
const LITERAL = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
const GENDERED = /\b(he|him|his|himself|she|her|hers|herself)\b/i;

describe('nothing the player reads is written for men only', () => {
  it('has no bare gendered pronoun in any string the game prints', () => {
    const offenders: string[] = [];

    for (const [path, text] of Object.entries(SOURCES)) {
      if (path.endsWith('.test.ts')) continue;
      const relative = shortName(path);
      if ([...ALLOWED].some((skip) => relative.endsWith(skip.split('/').pop()!))) continue;

      {
        text
          .split('\n')
          .forEach((line, index) => {
            // Comments explain the code to a reader, not the game to a player.
            if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
            for (const [, , body] of line.matchAll(LITERAL)) {
              if (!body || !GENDERED.test(body)) continue;
              // A `{they}`-style token is the fix, not the problem.
              if (/\{(they|them|their)\}/i.test(body)) continue;
              offenders.push(`${relative}:${index + 1}  ${body.trim().slice(0, 90)}`);
            }
          });
      }
    }

    expect(offenders, `gendered prose:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('is watching a real body of content, not an empty directory', () => {
    // A guard that silently stopped scanning would pass forever.
    expect(Object.keys(SOURCES).length).toBeGreaterThan(80);
  });
});
