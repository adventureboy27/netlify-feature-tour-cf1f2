import { describe, expect, it } from 'vitest';
import { alignmentLabel, availability, scout, theCatch, thePitch } from './scouting';
import { defaultWorldSettings } from '../world/settings';
import { generateWrestlers } from '../generate/wrestler';
import { rngFromSeed } from '../rng';
import type { Wrestler } from '../types';

const settings = defaultWorldSettings();

const someone = (over: Partial<Wrestler> = {}): Wrestler => {
  const [w] = generateWrestlers(rngFromSeed('scout'), 1);
  return {
    ...w!,
    popularity: 50,
    skill: 50,
    agility: 50,
    strength: 50,
    stamina: 50,
    charisma: 50,
    health: 90,
    morale: 70,
    momentum: 50,
    ego: 40,
    attitude: 60,
    age: 30,
    fatigueDebt: 0,
    injury: null,
    ...over,
  };
};

describe('can he work tonight', () => {
  it('leads with the injury, and says how long', () => {
    const hurt = someone({
      injury: {
        severity: 'moderate',
        grade: 35,
        description: 'Torn shoulder',
        sufferedWeek: 3,
        totalWeeks: 6,
        weeksRemaining: 4,
        permanentStatLoss: {},
        earlyReturnWeeksUsed: 0,
      },
    });
    expect(availability(hurt, settings)).toMatchObject({ flag: 'injured', tone: 'bad' });
    expect(availability(hurt, settings).label).toContain('4');
    expect(theCatch(hurt, settings)).toContain('Torn shoulder');
    expect(theCatch(hurt, settings)).toContain('4 weeks');
  });

  it('leads with a paperwork lockout, ahead of an injury', () => {
    const frozenAndHurt = someone({
      paperworkFrozen: true,
      injury: {
        severity: 'moderate',
        grade: 35,
        description: 'Torn shoulder',
        sufferedWeek: 3,
        totalWeeks: 6,
        weeksRemaining: 4,
        permanentStatLoss: {},
        earlyReturnWeeksUsed: 0,
      },
    });
    expect(availability(frozenAndHurt, settings)).toMatchObject({ flag: 'frozen', tone: 'bad' });
    expect(availability(someone({ paperworkFrozen: false }), settings).flag).not.toBe('frozen');
  });

  it('ranks worst-first, so the thing that decides tonight wins', () => {
    // Somebody exhausted AND unhappy is an exhaustion problem first.
    const both = someone({ fatigueDebt: 90, morale: 10 });
    expect(availability(both, settings).flag).toBe('exhausted');
  });

  it('says so when somebody is hot, and when somebody is simply fine', () => {
    expect(availability(someone({ momentum: 90 }), settings)).toMatchObject({ flag: 'onARoll', tone: 'good' });
    expect(availability(someone(), settings)).toMatchObject({ flag: 'fresh', tone: 'neutral' });
  });

  it('never leaves a tone without a label', () => {
    for (const w of [
      someone({ fatigueDebt: 90 }),
      someone({ health: 20 }),
      someone({ morale: 10 }),
      someone({ momentum: 95 }),
      someone(),
    ]) {
      const a = availability(w, settings);
      expect(a.label.length, a.flag).toBeGreaterThan(2);
    }
  });
});

describe('the pitch', () => {
  it('leads with drawing power, because that is what sells a ticket', () => {
    // A brilliant worker nobody has heard of is not the same sell as a draw.
    expect(thePitch(someone({ popularity: 95, skill: 20 }), settings)).toMatch(/draw/i);
    expect(thePitch(someone({ popularity: 20, skill: 95 }), settings)).toMatch(/good match/i);
  });

  it('finds something to say about everybody', () => {
    const rng = rngFromSeed('pitch-coverage');
    for (const w of generateWrestlers(rng, 300)) {
      const pitch = thePitch(w, settings);
      expect(pitch.length, w.name).toBeGreaterThan(10);
      expect(pitch, w.name).not.toMatch(/\d/);
    }
  });

  it('says she about a woman', () => {
    // Every line said "him" until somebody read the free-agent list and found
    // it under Deacon Yolanda's name. A third of a generated roster is women.
    const her = someone({ gender: 'f', popularity: 95, skill: 20, charisma: 20, agility: 20 });
    expect(thePitch(her, settings)).toContain('her');
    expect(thePitch(her, settings)).not.toMatch(/\bhim\b|\bhe\b/);
    const him = someone({ gender: 'm', popularity: 95, skill: 20, charisma: 20, agility: 20 });
    expect(thePitch(him, settings)).toContain('him');
    expect(theCatch(someone({ gender: 'f', age: 50, popularity: 70 }), settings)).toContain('her');
    expect(theCatch(someone({ gender: 'f', ego: 95, popularity: 70 }), settings)).toMatch(/\bshe\b/);
  });

  it('keeps distinguishing at the top of a sorted list, where the player is looking', () => {
    // The bug: leading on popularity alone meant every one of the best people
    // read "A draw. People buy tickets for him." — and a list sorted by rank
    // puts exactly those people at the top of the screen.
    const rng = rngFromSeed('sorted-top');
    const best = generateWrestlers(rng, 400)
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 12);
    const pitches = best.map((w) => thePitch(w, settings));
    expect(new Set(pitches).size).toBeGreaterThan(3);
  });

  it('distinguishes people rather than saying one thing about everyone', () => {
    const rng = rngFromSeed('pitch-variety');
    const pitches = generateWrestlers(rng, 200).map((w) => thePitch(w, settings));
    expect(new Set(pitches).size).toBeGreaterThan(4);
    // And no single line covers most of the roster.
    const commonest = Math.max(...[...new Set(pitches)].map((p) => pitches.filter((x) => x === p).length));
    expect(commonest).toBeLessThan(pitches.length * 0.6);
  });
});

describe('the catch', () => {
  it('is absent when there is genuinely nothing wrong', () => {
    expect(theCatch(someone({ popularity: 70 }), settings)).toBeNull();
  });

  it('puts condition ahead of character', () => {
    // Somebody who cannot go tonight is a harder no than somebody difficult.
    const hurtAndDifficult = someone({ health: 20, ego: 95, popularity: 70 });
    expect(theCatch(hurtAndDifficult, settings)).toMatch(/carrying something/i);
  });

  it('catches the things a booker would actually hesitate over', () => {
    expect(theCatch(someone({ fatigueDebt: 90 }), settings)).toMatch(/ground/i);
    expect(theCatch(someone({ morale: 10, popularity: 70 }), settings)).toMatch(/miserable/i);
    expect(theCatch(someone({ ego: 95, popularity: 70 }), settings)).toMatch(/worth/i);
    expect(theCatch(someone({ attitude: 10, popularity: 70 }), settings)).toMatch(/locker room/i);
    expect(theCatch(someone({ momentum: 5, popularity: 70 }), settings)).toMatch(/cold/i);
    expect(theCatch(someone({ popularity: 10 }), settings)).toMatch(/knows who he is/i);
    expect(theCatch(someone({ age: 50, popularity: 70 }), settings)).toMatch(/end/i);
  });

  it('never shows a number where §0 forbids one', () => {
    // The one exception is a countdown of weeks on an injury, which is a
    // duration rather than a stat — the rule is about not exposing the
    // hidden numbers behind ability.
    const rng = rngFromSeed('catch-numbers');
    for (const w of generateWrestlers(rng, 300)) {
      const line = theCatch({ ...w, injury: null }, settings);
      if (line) expect(line, w.name).not.toMatch(/\d/);
    }
  });
});

describe('reading a roster at a glance', () => {
  it('gives most of a real roster a catch, and a few of them none', () => {
    // A screen where everybody reads "fine" tells the player nothing, and one
    // where nobody does is just noise. Both halves have to exist.
    const roster = generateWrestlers(rngFromSeed('roster'), 34);
    const reads = roster.map((w) => scout(w, settings));
    const clean = reads.filter((r) => r.catch === null).length;
    expect(clean).toBeGreaterThan(0);
    expect(clean).toBeLessThan(roster.length);
  });

  it('says "nothing wrong with her" about a woman', () => {
    // This line lived hardcoded in two components and so escaped the pronoun
    // fix entirely — it read "him" under every clean woman on the screen.
    expect(scout(someone({ gender: 'f', popularity: 70 }), settings).cleanBill).toBe('Nothing wrong with her.');
    expect(scout(someone({ gender: 'm', popularity: 70 }), settings).cleanBill).toBe('Nothing wrong with him.');
  });

  it('says the alignment in words, not only a colour', () => {
    // The dot was the player's first complaint: colour alone is unreadable
    // for anybody who has not been told the code, and for the colourblind it
    // stays unreadable forever.
    expect(alignmentLabel(80)).toBe('Face');
    expect(alignmentLabel(-80)).toBe('Heel');
    expect(alignmentLabel(0)).toBe('Tweener');
  });
});
