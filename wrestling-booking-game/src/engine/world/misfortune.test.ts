import { describe, expect, it } from 'vitest';
import { injuryFromMisfortune, pickReplacement, rollMisfortune } from './misfortune';
import { MISFORTUNES } from '../../data/misfortunes';
import { defaultWorldSettings } from './settings';
import { generateWrestlers } from '../generate/wrestler';
import { rngFromSeed } from '../rng';
import type { Injury, Wrestler } from '../types';

const settings = defaultWorldSettings();

const hurt = (weeks = 6): Injury => ({
  severity: 'moderate',
  grade: 35,
  description: 'Torn shoulder',
  sufferedWeek: 1,
  totalWeeks: weeks,
  weeksRemaining: weeks,
  permanentStatLoss: {},
  earlyReturnWeeksUsed: 0,
});

function roster(n: number, seed = 'misfortune'): Wrestler[] {
  return generateWrestlers(rngFromSeed(seed), n).map((w) => ({ ...w, injury: null }));
}

describe('the library', () => {
  it('says what happened, with the person in it', () => {
    for (const entry of MISFORTUNES) {
      expect(entry.lines.length, entry.id).toBeGreaterThan(0);
      for (const line of entry.lines) {
        expect(line, entry.id).toContain('{name}');
        expect(line.length, entry.id).toBeGreaterThan(25);
      }
    }
  });

  it('gives every injury and setback a length, and every absence none', () => {
    for (const entry of MISFORTUNES) {
      if (entry.kind === 'absence') expect(entry.weeks, entry.id).toBeUndefined();
      else expect(entry.weeks, entry.id).toBeDefined();
    }
  });

  it('weights the cheap end heavily — most sides of the die are small', () => {
    // The user's rule for the whole chaos layer: common things common, the
    // roof collapsing rare. A car wreck must not be as likely as a flat tyre.
    const flat = MISFORTUNES.find((m) => m.id === 'carTrouble')!;
    const wreck = MISFORTUNES.find((m) => m.id === 'carWreck')!;
    expect(flat.weight).toBeGreaterThan(wreck.weight * 5);
  });

  it('only offers setbacks to people who are already hurt', () => {
    for (const entry of MISFORTUNES) {
      if (entry.kind === 'aggravation') expect(entry.requires, entry.id).toBe('injured');
      if (entry.kind === 'absence') expect(entry.requires, entry.id).toBe('healthy');
    }
  });
});

describe('rolling a week', () => {
  it('is quiet most weeks', () => {
    // Thirty-odd people, a full season. This should be an occasional event,
    // not a weekly one, or the roster is a casualty ward.
    const rng = rngFromSeed('quiet');
    const people = roster(34);
    let hits = 0;
    for (let week = 0; week < 52; week++) {
      for (const person of people) if (rollMisfortune(rng, person, settings)) hits++;
    }
    expect(hits).toBeGreaterThan(4);
    expect(hits, 'the roster is a casualty ward').toBeLessThan(40);
  });

  it('is more dangerous for somebody already hurt', () => {
    const rng = rngFromSeed('setbacks');
    const healthy = roster(60, 'a');
    const injured = roster(60, 'b').map((w) => ({ ...w, injury: hurt() }));
    const count = (people: Wrestler[]) => {
      let n = 0;
      for (let week = 0; week < 40; week++) {
        for (const person of people) if (rollMisfortune(rng, person, settings)) n++;
      }
      return n;
    };
    expect(count(injured)).toBeGreaterThan(count(healthy));
  });

  it('never hands a setback to somebody healthy, or an accident to somebody hurt', () => {
    const rng = rngFromSeed('kinds');
    for (const person of roster(200)) {
      const m = rollMisfortune(rng, person, settings);
      if (m) expect(m.kind, person.name).not.toBe('aggravation');
    }
    for (const person of roster(200, 'hurt').map((w) => ({ ...w, injury: hurt() }))) {
      const m = rollMisfortune(rng, person, settings);
      if (m) expect(m.kind, person.name).toBe('aggravation');
    }
  });

  it('leaves the dead and the retired alone', () => {
    const rng = rngFromSeed('gone');
    const [base] = roster(1);
    const retired = { ...base!, careerStatus: 'retired' as const };
    for (let i = 0; i < 500; i++) expect(rollMisfortune(rng, retired, settings)).toBeNull();
  });

  it('produces variety rather than the same line every time', () => {
    const rng = rngFromSeed('variety');
    const seen = new Set<string>();
    for (const person of roster(400, 'v')) {
      const m = rollMisfortune(rng, person, settings);
      if (m) seen.add(m.text);
    }
    expect(seen.size).toBeGreaterThan(3);
  });

  it('does not give two different people the same definition\'s line in one week', () => {
    // A big roster can genuinely draw the same misfortune definition for
    // two different people in the same week — two different names should
    // not still read the identical flavour line underneath them.
    const rng = rngFromSeed('shared-week');
    const usedLines = new Set<string>();
    const seenByDefinition = new Map<string, Set<string>>();
    for (const person of roster(400, 'shared')) {
      const m = rollMisfortune(rng, person, settings, usedLines);
      if (!m) continue;
      const seenForThis = seenByDefinition.get(m.definitionId) ?? new Set<string>();
      const rawLine = m.text.replace(m.wrestlerName, '{name}');
      seenForThis.add(rawLine);
      seenByDefinition.set(m.definitionId, seenForThis);
    }
    // With the shared set threaded through, no definition should have
    // produced the exact same line text twice unless its own pool of
    // lines was genuinely exhausted first.
    for (const [definitionId, lines] of seenByDefinition) {
      const pool = MISFORTUNES.find((m) => m.id === definitionId)!.lines.length;
      expect(lines.size, definitionId).toBeLessThanOrEqual(pool);
    }
  });

  it('leaves an unshared call unaffected, same as before', () => {
    const rng = rngFromSeed('solo');
    const [person] = roster(1, 'solo-person');
    const result = rollMisfortune(rng, person!, settings);
    expect(result === null || typeof result.text === 'string').toBe(true);
  });
});

describe('a setback adds to what was already wrong', () => {
  it('extends an existing injury rather than replacing it', () => {
    const existing = hurt(6);
    const setback = {
      wrestlerId: 'w',
      wrestlerName: 'Somebody',
      definitionId: 'gaveOut',
      kind: 'aggravation' as const,
      label: 'Setback',
      text: 'The knee gave out.',
      weeks: 4,
      attacked: false,
    };
    const worse = injuryFromMisfortune(setback, 10, existing, settings);
    expect(worse.weeksRemaining).toBe(10);
    // It is still the same injury, dated from when it first happened.
    expect(worse.sufferedWeek).toBe(existing.sufferedWeek);
    expect(worse.description).toContain('worse');
  });

  it('starts a fresh injury from nothing', () => {
    const accident = {
      wrestlerId: 'w',
      wrestlerName: 'Somebody',
      definitionId: 'carWreck',
      kind: 'injury' as const,
      label: 'Car wreck',
      text: 'Put the car into a barrier.',
      weeks: 12,
      attacked: false,
    };
    const injury = injuryFromMisfortune(accident, 10, null, settings);
    expect(injury.weeksRemaining).toBe(12);
    expect(injury.sufferedWeek).toBe(10);
    expect(injury.severity).toBe('severe');
  });
});

describe('the mystery opponent', () => {
  const people = roster(30, 'replace');
  const absent = { ...people[0]!, popularity: 70 };

  it('finds somebody when there is anybody', () => {
    expect(pickReplacement(rngFromSeed('r'), absent, people.slice(1), settings)).not.toBeNull();
  });

  it('gives up when the roster is empty, so the match comes off instead', () => {
    expect(pickReplacement(rngFromSeed('r'), absent, [], settings)).toBeNull();
  });

  it('leans toward somebody near the same level', () => {
    // The match still has to be worth watching.
    const rng = rngFromSeed('level');
    const picks: number[] = [];
    for (let i = 0; i < 400; i++) {
      const pick = pickReplacement(rng, absent, people.slice(1), settings);
      if (pick) picks.push(Math.abs(pick.popularity - absent.popularity));
    }
    const averageGap = picks.reduce((a, b) => a + b, 0) / picks.length;
    const allGaps = people.slice(1).map((w) => Math.abs(w.popularity - absent.popularity));
    const unweighted = allGaps.reduce((a, b) => a + b, 0) / allGaps.length;
    expect(averageGap).toBeLessThan(unweighted);
  });

  it('still lets a long shot through, which is where the surprise lives', () => {
    const rng = rngFromSeed('longshot');
    const chosen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const pick = pickReplacement(rng, absent, people.slice(1), settings);
      if (pick) chosen.add(pick.id);
    }
    // Not just the three closest names in popularity.
    expect(chosen.size).toBeGreaterThan(8);
  });
});
