import { describe, it, expect } from 'vitest';
import { rollCasualty, stoppageCasualty, injuryFrom, outFor, type CasualtyContext } from './casualties';
import { INJURY_CAUSES, causesFor, injuryCauseById } from '../../data/casualties';
import { defaultWorldSettings } from '../world/settings';
import { rngFromSeed } from '../rng';

const settings = defaultWorldSettings();

function ctxFor(over: Partial<CasualtyContext> = {}): CasualtyContext {
  return {
    personId: 'p1',
    name: 'Doomsday',
    role: 'competitor',
    violenceLevel: 0,
    injuryMultiplier: 1,
    toughness: 50,
    settings,
    ...over,
  };
}

/** Roll until one lands, so the shape can be checked. */
function forced(over: Partial<CasualtyContext> = {}, seed = 'hurt') {
  const rng = rngFromSeed(seed);
  for (let i = 0; i < 2000; i++) {
    const casualty = rollCasualty(rng, ctxFor(over));
    if (casualty) return casualty;
  }
  return null;
}

describe('the catalogue', () => {
  it('gives every cause a name and more than one way to say it', () => {
    for (const cause of INJURY_CAUSES) {
      expect(cause.label.length).toBeGreaterThan(0);
      expect(cause.lines.length).toBeGreaterThan(1);
      expect(cause.roles.length).toBeGreaterThan(0);
      expect(cause.weeks).toBeGreaterThan(0);
    }
  });

  it('has no duplicate ids', () => {
    const ids = INJURY_CAUSES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('can hurt everybody who stands in the fight, not just the wrestlers', () => {
    // A system that could only hurt competitors was modelling the ring and
    // not the room.
    for (const role of ['competitor', 'referee', 'manager', 'guestReferee'] as const) {
      expect(causesFor(role, 6).length).toBeGreaterThan(0);
    }
  });

  it('keeps the bloody ones out of a clean match', () => {
    const clean = causesFor('competitor', 0).map((c) => c.id);
    expect(clean).not.toContain('burn');
    expect(clean).not.toContain('cut');
    expect(causesFor('competitor', 6).map((c) => c.id)).toContain('burn');
  });
});

describe('every injury can say how it happened', () => {
  it('never produces one without a sentence', () => {
    // This is the whole rule. An injury with no explanation is the bug this
    // module exists to prevent.
    for (const role of ['competitor', 'referee', 'manager', 'guestReferee'] as const) {
      const casualty = forced({ role, violenceLevel: 6 }, `say-${role}`);
      expect(casualty).not.toBeNull();
      expect(casualty!.text.length).toBeGreaterThan(15);
      expect(casualty!.text).not.toMatch(/\{[a-z]+\}/i);
      expect(casualty!.text).toContain('Doomsday');
    }
  });

  it('names the body part rather than saying "Injured"', () => {
    const casualty = forced()!;
    const injury = injuryFrom(casualty, 40);
    expect(injury.description).not.toBe('Injured');
    expect(injury.description).toBe(injuryCauseById(casualty.causeId)!.label);
  });

  it('always explains a match that was stopped', () => {
    // An injuryStoppage finish is not optional — it must be able to say who
    // and why, or the finish is a mystery.
    for (let i = 0; i < 20; i++) {
      const casualty = stoppageCasualty(rngFromSeed(`stop-${i}`), ctxFor({ violenceLevel: i % 7 }));
      expect(casualty.text.length).toBeGreaterThan(15);
      expect(casualty.weeks).toBeGreaterThan(0);
    }
  });
});

describe('who gets hurt and how often', () => {
  const rate = (over: Partial<CasualtyContext>, seed: string) => {
    const rng = rngFromSeed(seed);
    let hurt = 0;
    for (let i = 0; i < 4000; i++) if (rollCasualty(rng, ctxFor(over))) hurt += 1;
    return hurt / 4000;
  };

  it('hurts a guest referee more often than a professional one', () => {
    // In the middle of it without a wrestler's licence to defend themselves.
    expect(rate({ role: 'guestReferee' }, 'g')).toBeGreaterThan(rate({ role: 'referee' }, 'r'));
  });

  it('hurts a competitor more often than the officials', () => {
    expect(rate({ role: 'competitor' }, 'c')).toBeGreaterThan(rate({ role: 'referee' }, 'r2'));
  });

  it('hurts the tough less than the fragile', () => {
    expect(rate({ toughness: 95 }, 't')).toBeLessThan(rate({ toughness: 10 }, 'f'));
  });

  it('climbs with how dangerous the match was', () => {
    expect(rate({ injuryMultiplier: 2.5 }, 'v')).toBeGreaterThan(rate({ injuryMultiplier: 1 }, 'n'));
  });

  it('never makes anybody certain to be hurt', () => {
    expect(rate({ injuryMultiplier: 100, toughness: 0 }, 'max')).toBeLessThanOrEqual(
      settings.casualtyChanceCap + 0.03,
    );
  });

  it('leaves most matches with nobody hurt at all', () => {
    expect(rate({}, 'ordinary')).toBeLessThan(0.1);
  });
});

describe('how long they are out', () => {
  it('grades the same injury differently as it gets worse', () => {
    expect(outFor(2, settings)).toContain('back soon');
    expect(outFor(6, settings)).toContain('weeks');
    expect(outFor(14, settings)).toContain('months');
    expect(outFor(40, settings)).toContain('indefinitely');
  });

  it('says it in words, never a bare number', () => {
    for (const weeks of [1, 5, 12, 30]) expect(outFor(weeks, settings)).not.toMatch(/\d/);
  });

  it('varies the same injury from one night to the next', () => {
    const lengths = new Set<number>();
    for (let i = 0; i < 40; i++) {
      lengths.add(stoppageCasualty(rngFromSeed(`len-${i}`), ctxFor()).weeks);
    }
    expect(lengths.size).toBeGreaterThan(3);
  });

  it('grades severity off how long it actually is', () => {
    const long = stoppageCasualty(rngFromSeed('long'), ctxFor({ injuryMultiplier: 4 }));
    const short = stoppageCasualty(rngFromSeed('short'), ctxFor({ injuryMultiplier: 0.2 }));
    expect(long.weeks).toBeGreaterThan(short.weeks);
  });
});
