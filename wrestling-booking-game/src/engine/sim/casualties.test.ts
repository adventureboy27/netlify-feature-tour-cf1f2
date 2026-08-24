import { describe, it, expect } from 'vitest';
import {
  rollCasualty,
  stoppageCasualty,
  injuryFrom,
  outFor,
  severityOf,
  gradeFromLength,
  weeksFromGrade,
  riskFromGrade,
  healPerWeek,
  aggravate,
  fitToWork,
  injuryWord,
  type CasualtyContext,
} from './casualties';
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

  it('keeps the hardware-specific causes out of every match except the stipulation they belong to', () => {
    // "The ladder buckled" makes no sense outside a ladder match — see
    // stipulationIds on data/casualties.ts's ladderGaveWay/cageGaveWay/tableNoBreak.
    const noStip = causesFor('competitor', 6).map((c) => c.id);
    expect(noStip).not.toContain('ladderGaveWay');
    expect(noStip).not.toContain('cageGaveWay');
    expect(noStip).not.toContain('tableNoBreak');

    const wrongStip = causesFor('competitor', 6, 'noDQ').map((c) => c.id);
    expect(wrongStip).not.toContain('ladderGaveWay');
    expect(wrongStip).not.toContain('cageGaveWay');
    expect(wrongStip).not.toContain('tableNoBreak');

    const ladder = causesFor('competitor', 6, 'ladder').map((c) => c.id);
    expect(ladder).toContain('ladderGaveWay');
    expect(ladder).not.toContain('cageGaveWay');
    expect(ladder).not.toContain('tableNoBreak');

    const cage = causesFor('competitor', 6, 'steelCage').map((c) => c.id);
    expect(cage).toContain('cageGaveWay');
    expect(cage).not.toContain('ladderGaveWay');

    for (const stip of ['tables', 'flamingTables']) {
      const tables = causesFor('competitor', 6, stip).map((c) => c.id);
      expect(tables).toContain('tableNoBreak');
      expect(tables).not.toContain('ladderGaveWay');
      expect(tables).not.toContain('cageGaveWay');
    }
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

  it('actually reaches a ladder-match cause when a ladder match rolls one, not just when asked directly', () => {
    // End-to-end through rollCasualty/stoppageCasualty, not just causesFor.
    const rng = rngFromSeed('ladder-thread');
    const causeIds = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      const casualty = rollCasualty(rng, ctxFor({ violenceLevel: 6, stipulationId: 'ladder' }));
      if (casualty) causeIds.add(casualty.causeId);
    }
    expect(causeIds.has('ladderGaveWay')).toBe(true);
  });

  it('never reaches a ladder-match cause outside a ladder match', () => {
    const rng = rngFromSeed('no-ladder-thread');
    for (let i = 0; i < 3000; i++) {
      const casualty = rollCasualty(rng, ctxFor({ violenceLevel: 6, stipulationId: 'steelCage' }));
      expect(casualty?.causeId).not.toBe('ladderGaveWay');
    }
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
    expect(outFor(2, settings)).toContain('a week or two');
    expect(outFor(6, settings)).toContain('weeks');
    expect(outFor(14, settings)).toContain('months');
    expect(outFor(40, settings)).toContain('indefinitely');
  });

  it('reads correctly after "is", which is how every caller says it', () => {
    // "Moss Jessup is should be back soon." shipped for every short injury in
    // the game until somebody read one out loud.
    for (const weeks of [1, 2, 6, 14, 40]) {
      expect(`Somebody is ${outFor(weeks, settings)}.`, `${weeks} weeks`).toMatch(/is out /);
    }
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

describe('how bad a dangerous match makes it', () => {
  const settings = defaultWorldSettings();

  function ctx(multiplier: number, seed: string) {
    return {
      rng: rngFromSeed(seed),
      ctx: {
        personId: 'w1',
        name: 'Somebody',
        role: 'competitor' as const,
        violenceLevel: 50,
        injuryMultiplier: multiplier,
        toughness: 50,
        settings,
      },
    };
  }

  /** Median length over many rolls at a given danger level. */
  function median(multiplier: number): number {
    const weeks: number[] = [];
    for (let i = 0; i < 400; i++) {
      const { rng, ctx: c } = ctx(multiplier, `len${multiplier}-${i}`);
      weeks.push(stoppageCasualty(rng, c).weeks);
    }
    weeks.sort((a, b) => a - b);
    return weeks[Math.floor(weeks.length / 2)]!;
  }

  it('still makes a rough match worse than a safe one', () => {
    expect(median(3)).toBeGreaterThan(median(1));
  });

  it('does not scale length as hard as it scales the odds', () => {
    // The bug this closes. `injuryMultiplier` fed both the chance and the
    // length at full strength, and every source of it compounds — stipulation,
    // pace, bad blood, a blown spot, a body that breaks easily. A hardcore
    // match with a botch in it and a fragile wrestler came to about ten times,
    // which turned a six-week injury into a sixty-week one. A measured save's
    // worst injury was sixty-six weeks and two in five were eight weeks plus.
    const safe = median(1);
    const brutal = median(8);
    expect(brutal).toBeLessThan(safe * 8);
    expect(brutal).toBeLessThan(safe * 3);
  });

  it('still ends somebody occasionally, however careful the booking', () => {
    // Its own roll rather than the far end of the multiplier, so a career
    // ender is a rare awful thing that can happen in any match rather than
    // something a booker manufactures by stacking a dangerous card. Capping
    // the compounding above removed these entirely, which was not the point.
    const worst = Array.from({ length: 900 }, (_, i) => {
      const { rng, ctx: c } = ctx(1, `cat${i}`);
      return stoppageCasualty(rng, c).weeks;
    });
    expect(Math.max(...worst)).toBeGreaterThanOrEqual(settings.injurySevereWeeks * 2);
  });
});

describe('severity as a number', () => {
  const settings = defaultWorldSettings();

  it('keeps the labels meaning what they meant on the week scale', () => {
    // Grade replaced a severity inferred from a week count. If the bands do
    // not line up with the old thresholds then a refactor has quietly become
    // a balance change — which it did, once, moving severe from ten weeks to
    // fifteen before anybody noticed.
    const at = (weeks: number) => severityOf(gradeFromLength(weeks, settings), settings);
    expect(at(2)).toBe('minor');
    expect(at(6)).toBe('moderate');
    expect(at(12)).toBe('severe');
    expect(at(28)).toBe('careerThreatening');
  });

  it('converts back and forth without drifting', () => {
    for (const weeks of [1, 4, 9, 15, 26]) {
      const back = weeksFromGrade(gradeFromLength(weeks, settings), settings);
      expect(Math.abs(back - weeks), `${weeks}w`).toBeLessThanOrEqual(1);
    }
  });

  it('climbs the re-injury risk steeply with how hurt somebody is', () => {
    expect(riskFromGrade(0, settings)).toBe(1);
    const knock = riskFromGrade(15, settings);
    const bad = riskFromGrade(65, settings);
    const awful = riskFromGrade(95, settings);
    expect(knock).toBeGreaterThan(1);
    expect(knock).toBeLessThan(1.3);
    expect(bad).toBeGreaterThan(2);
    expect(awful).toBeGreaterThan(bad);
    // Steeper than linear — a knock is a risk, a torn knee is recklessness.
    expect(bad - knock).toBeGreaterThan(knock - 1);
  });

  it('mends when rested, barely when trained on, and worsens in a ring', () => {
    expect(healPerWeek('rest', settings)).toBeLessThan(0);
    expect(healPerWeek('gym', settings)).toBeLessThan(0);
    expect(healPerWeek('gym', settings)).toBeGreaterThan(healPerWeek('rest', settings));
    expect(healPerWeek('wrestled', settings)).toBeGreaterThan(0);
  });

  it('makes going out on it a slow bleed rather than a punishment', () => {
    // Deliberately small: the cost of working hurt is being hurt *again*, not
    // this drift. A bleed big enough to feel on its own would make the
    // decision obvious rather than tempting.
    expect(healPerWeek('wrestled', settings)).toBeLessThan(Math.abs(healPerWeek('rest', settings)));
  });

  it('stacks a fresh injury onto an old one rather than replacing it', () => {
    const worse = aggravate(60, 30, settings);
    expect(worse).toBeGreaterThan(60);
    expect(worse).toBeGreaterThan(30);
    // A light knock cannot launder a bad knee.
    expect(aggravate(60, 5, settings)).toBeGreaterThanOrEqual(60);
    expect(aggravate(90, 60, settings)).toBeLessThanOrEqual(100);
  });

  it('lets somebody be booked while still carrying something', () => {
    expect(fitToWork(5, settings)).toBe(true);
    expect(fitToWork(40, settings)).toBe(false);
    // And carrying something is still a risk, which is the point.
    expect(riskFromGrade(5, settings)).toBeGreaterThan(1);
  });

  it('never shows the player a number (§0)', () => {
    for (const grade of [0, 10, 30, 60, 95]) {
      expect(injuryWord(grade, settings)).not.toMatch(/\d/);
    }
  });
});
