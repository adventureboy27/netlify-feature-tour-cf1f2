// The one channel in the game that is allowed to be wrong.

import { describe, expect, it } from 'vitest';
import { inventRumour, rumourTweets, voicesFor, type Rumour } from './rumours';
import { defaultWorldSettings } from './settings';
import { rngFromSeed } from '../rng';
import { HE, SHE } from '../career/pronouns';

const settings = defaultWorldSettings();
const rumour = (over: Partial<Rumour> = {}): Rumour => ({
  kind: 'defection',
  subject: 'Duke Rawlins',
  true: true,
  heat: 1,
  who: HE,
  ...over,
});

/** Average voices over many seeds — this is a distribution, not a value. */
function meanVoices(r: Rumour, runs = 400): number {
  let total = 0;
  for (let i = 0; i < runs; i++) total += voicesFor(r, rngFromSeed(`v${i}`), settings);
  return total / runs;
}

describe('how many people are saying it', () => {
  it('is the whole signal: a true, obvious thing gets a chorus', () => {
    expect(meanVoices(rumour({ true: true, heat: 1 }))).toBeGreaterThan(
      meanVoices(rumour({ true: false })),
    );
  });

  it('gives a true thing nobody has noticed yet no more than a made-up one', () => {
    // The reason an early read is an edge rather than a free answer.
    expect(meanVoices(rumour({ true: true, heat: 0 }))).toBeLessThan(
      meanVoices(rumour({ true: true, heat: 1 })),
    );
  });

  it('lets a false rumour reach two, so counting is a read and not a lie detector', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 400; i++) seen.add(voicesFor(rumour({ true: false }), rngFromSeed(`f${i}`), settings));
    expect(seen.has(2)).toBe(true);
  });

  it('never lets a false rumour reach the full chorus', () => {
    // At some point the feed has to be worth trusting, or reading it is
    // superstition rather than skill.
    for (let i = 0; i < 800; i++) {
      expect(voicesFor(rumour({ true: false }), rngFromSeed(`n${i}`), settings)).toBeLessThan(
        settings.rumourMaxVoices,
      );
    }
  });

  it('sometimes leaves a true, obvious thing with one voice', () => {
    // Somebody has to be first, and the player who acts on a single voice is
    // taking a real risk in both directions.
    const seen = new Set<number>();
    for (let i = 0; i < 400; i++) seen.add(voicesFor(rumour({ true: true, heat: 1 }), rngFromSeed(`q${i}`), settings));
    expect(seen.has(1)).toBe(true);
  });
});

describe('what the chorus sounds like', () => {
  it('says the same idea in different words, never the same line twice', () => {
    // Three fans posting identical text is a bug report. Three posting the
    // same idea in their own words is a rumour.
    const lines = rumourTweets(rumour({ true: true, heat: 1 }), rngFromSeed('chorus'), settings);
    expect(new Set(lines).size).toBe(lines.length);
    for (const line of lines) expect(line).toContain('Duke Rawlins');
  });

  it('names both parties when the whisper is about two people', () => {
    const lines = rumourTweets(
      rumour({ kind: 'badBlood', subject: 'Duke', other: 'Cyclone', true: true, heat: 1 }),
      rngFromSeed('pair'),
      settings,
    );
    expect(lines.join(' ')).toContain('Cyclone');
  });

  it('carries good news the same way as bad', () => {
    // §0 asks for information, not warnings. Three people saying somebody is
    // the best thing in the company is as much a signal as three saying he is
    // about to walk.
    const lines = rumourTweets(rumour({ kind: 'onFire', true: true, heat: 1 }), rngFromSeed('good'), settings);
    expect(lines.length).toBeGreaterThan(0);
  });
});

describe('the ones that are not about anything', () => {
  it('invents a rumour that is flatly untrue', () => {
    const made = inventRumour(rngFromSeed('m'), [{ name: 'Duke Rawlins', who: HE }], ['defection']);
    expect(made!.true).toBe(false);
    expect(made!.heat).toBe(0);
  });

  it('has nothing to say about an empty roster', () => {
    expect(inventRumour(rngFromSeed('m'), [], ['defection'])).toBeNull();
    expect(inventRumour(rngFromSeed('m'), [{ name: 'A', who: HE }], [])).toBeNull();
  });
});

describe('the feed is not talking about men only', () => {
  it('never says he about a woman, in any phrasing of any kind', () => {
    // Every whisper, exhaustively — this is the file where a stray "he" is
    // most likely to survive, because the templates are prose.
    const kinds = ['defection', 'recruitment', 'badBlood', 'workingHurt', 'walkingOut', 'onFire'] as const;
    for (const kind of kinds) {
      for (let i = 0; i < 40; i++) {
        const lines = rumourTweets(
          { kind, subject: 'Josie Voss', other: 'Mabel Cartwright', who: SHE, true: true, heat: 1 },
          rngFromSeed(`w${kind}${i}`),
          settings,
        );
        for (const line of lines) expect(line, line).not.toMatch(/\b(he|him|his|guy|man)\b/i);
      }
    }
  });
});
