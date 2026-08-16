import { describe, expect, it } from 'vitest';
import {
  deliveredTo,
  expectation,
  moodBand,
  moodLabel,
  moraleContext,
  moraleSummary,
  troubleInTheRoom,
  weeklyMorale,
  type MoraleContext,
  type MoraleShow,
} from './morale';
import { defaultWorldSettings } from '../world/settings';
import { generateWrestlers } from '../generate/wrestler';
import { rngFromSeed } from '../rng';
import type { Wrestler } from '../types';

const settings = defaultWorldSettings();

function person(over: Partial<Wrestler> = {}, seed = 'mood'): Wrestler {
  const [w] = generateWrestlers(rngFromSeed(seed), 1);
  return { ...w!, popularity: 50, ego: 50, morale: 65, ...over };
}

/** A quiet week: booked mid-card, won, nothing else going on. */
function week(over: Partial<MoraleContext> = {}): MoraleContext {
  return {
    worked: true,
    slot: 3,
    slotCount: 6,
    currentWeek: 40,
    moodOfTheOthers: [],
    outcome: 'won',
    beatenByPopularity: null,
    weeksIdle: 0,
    beltsHeld: 0,
    showRating: 55,
    gaveThemWhatTheyWanted: false,
    workedWithAllies: 0,
    workedWithEnemies: 0,
    companyRating: 55,
    roster: [],
    ...over,
  };
}

describe('the bands', () => {
  it('runs green to red without a gap', () => {
    const bands = [95, 70, 55, 40, 25, 5].map((m) => moodBand(m, settings));
    expect(bands).toEqual(['delighted', 'happy', 'content', 'restless', 'unhappy', 'miserable']);
  });

  it('says each one in words, never a number', () => {
    for (const morale of [0, 20, 40, 60, 80, 100]) {
      const label = moodLabel(moodBand(morale, settings));
      expect(label.length).toBeGreaterThan(3);
      expect(label).not.toMatch(/\d/);
    }
  });

  it('starts everybody happy, with somewhere to go in both directions', () => {
    expect(moodBand(person().morale, settings)).toBe('happy');
  });
});

describe('what somebody thinks they are owed', () => {
  it('is higher for a draw than for an undercard hand', () => {
    expect(expectation(person({ popularity: 95 }), settings)).toBeGreaterThan(
      expectation(person({ popularity: 15 }), settings),
    );
  });

  it('is higher for somebody with a big opinion of himself', () => {
    expect(expectation(person({ ego: 95 }), settings)).toBeGreaterThan(
      expectation(person({ ego: 10 }), settings),
    );
  });
});

describe('how the booker moves it', () => {
  it('pays for the main event', () => {
    const main = weeklyMorale(person(), week({ slot: 5 }), settings);
    const opener = weeklyMorale(person(), week({ slot: 0 }), settings);
    expect(main.delta).toBeGreaterThan(opener.delta);
    expect(main.reasons.some((r) => r.text.includes('Main evented'))).toBe(true);
  });

  it('is worth something to anybody, however far down the card they usually are', () => {
    // A nobody in the main event is thrilled; the position term alone would
    // have given him almost nothing because he expected nothing.
    const nobody = weeklyMorale(person({ popularity: 10, ego: 10 }), week({ slot: 5 }), settings);
    expect(nobody.delta).toBeGreaterThan(0);
  });

  it('reads the undercard as an insult only for somebody who matters', () => {
    const star = weeklyMorale(person({ popularity: 90, ego: 80 }), week({ slot: 0 }), settings);
    const hand = weeklyMorale(person({ popularity: 15, ego: 20 }), week({ slot: 0 }), settings);
    expect(star.delta).toBeLessThan(hand.delta);
    expect(star.reasons.some((r) => r.text.includes('undercard'))).toBe(true);
  });

  it('treats an ordinary loss as part of the job', () => {
    const lost = weeklyMorale(
      person({ popularity: 50 }),
      week({ outcome: 'lost', beatenByPopularity: 55 }),
      settings,
    );
    expect(lost.reasons.some((r) => r.text === 'Took the loss.')).toBe(true);
  });

  it('treats being beaten by a nobody as something else entirely', () => {
    const routine = weeklyMorale(
      person({ popularity: 80 }),
      week({ outcome: 'lost', beatenByPopularity: 75 }),
      settings,
    );
    const insult = weeklyMorale(
      person({ popularity: 80 }),
      week({ outcome: 'lost', beatenByPopularity: 10 }),
      settings,
    );
    expect(insult.delta).toBeLessThan(routine.delta);
    expect(insult.reasons.some((r) => r.text.includes('nobody has heard of'))).toBe(true);
  });

  it('says nothing about a week off — a roster is always bigger than a card', () => {
    // Without this a deep roster rotted simply for being deep: six matches
    // means half of a twenty-four-man locker room is idle every single week.
    const off = weeklyMorale(person(), week({ worked: false, slot: null, weeksIdle: 1 }), settings);
    expect(off.reasons.some((r) => r.text.includes('without a match'))).toBe(false);
  });

  it('punishes a pattern of it, and punishes it more every week', () => {
    const three = weeklyMorale(person(), week({ worked: false, slot: null, weeksIdle: 3 }), settings);
    const eight = weeklyMorale(person(), week({ worked: false, slot: null, weeksIdle: 8 }), settings);
    expect(three.reasons.some((r) => r.delta < 0)).toBe(true);
    expect(eight.delta).toBeLessThan(three.delta);
    expect(eight.reasons[0]!.text).toContain('8 weeks');
  });

  it('punishes it far more for somebody who thinks they matter', () => {
    const star = weeklyMorale(
      person({ popularity: 92, ego: 85 }),
      week({ worked: false, slot: null, weeksIdle: 4 }),
      settings,
    );
    const hand = weeklyMorale(
      person({ popularity: 12, ego: 15 }),
      week({ worked: false, slot: null, weeksIdle: 4 }),
      settings,
    );
    expect(star.delta).toBeLessThan(hand.delta);
  });

  it('pays for the belt, every week they hold it', () => {
    expect(weeklyMorale(person(), week({ beltsHeld: 1 }), settings).delta).toBeGreaterThan(
      weeklyMorale(person(), week({ beltsHeld: 0 }), settings).delta,
    );
  });

  it('notices who they were put in with', () => {
    const friend = weeklyMorale(person(), week({ workedWithAllies: 1 }), settings);
    const enemy = weeklyMorale(person(), week({ workedWithEnemies: 1 }), settings);
    expect(friend.delta).toBeGreaterThan(enemy.delta);
    expect(enemy.reasons.some((r) => r.text.includes('cannot stand'))).toBe(true);
  });
});

describe('leaning into what the crowd is asking for', () => {
  it('is the best week anybody has', () => {
    // The whole point of the fan-demand board: reading it and booking to it
    // should pay in the room as well as on the night.
    const delivered = weeklyMorale(person(), week({ gaveThemWhatTheyWanted: true }), settings);
    const ignored = weeklyMorale(person(), week({ gaveThemWhatTheyWanted: false }), settings);
    expect(delivered.delta).toBeGreaterThan(ignored.delta);
    expect(delivered.reasons[0]!.text).toContain('asking for this');
  });

  it('outweighs being stuck in the opener', () => {
    const opener = week({ slot: 0, gaveThemWhatTheyWanted: true });
    expect(weeklyMorale(person({ popularity: 70, ego: 60 }), opener, settings).delta).toBeGreaterThan(0);
  });

  it('pays nobody for being rested — that one is answered by leaving them off', () => {
    const rewarded = deliveredTo([
      { kind: 'enoughOfHim', wrestlerIds: ['a'] },
      { kind: 'dreamMatch', wrestlerIds: ['b', 'c'] },
    ]);
    expect(rewarded.has('a')).toBe(false);
    expect(rewarded.has('b')).toBe(true);
    expect(rewarded.has('c')).toBe(true);
  });
});

describe('the company itself', () => {
  it('pulls somebody toward how good a place it is to be', () => {
    const good = weeklyMorale(person({ morale: 40 }), week({ companyRating: 90 }), settings);
    const bad = weeklyMorale(person({ morale: 40 }), week({ companyRating: 10 }), settings);
    expect(good.delta).toBeGreaterThan(bad.delta);
  });

  it('keeps morale off the rails — nothing swings anybody in one week', () => {
    const worst = weeklyMorale(
      person({ popularity: 99, ego: 99, morale: 100 }),
      week({
        worked: false,
        slot: null,
        weeksIdle: 200,
        companyRating: 0,
      }),
      settings,
    );
    expect(worst.delta).toBeGreaterThanOrEqual(-settings.moraleWeeklyCap);
    const best = weeklyMorale(
      person({ morale: 0 }),
      week({ slot: 5, beltsHeld: 3, gaveThemWhatTheyWanted: true, showRating: 100, companyRating: 100 }),
      settings,
    );
    expect(best.delta).toBeLessThanOrEqual(settings.moraleWeeklyCap);
  });
});

describe('every point of it says why', () => {
  it('gives a readable sentence for anything that moved', () => {
    const report = weeklyMorale(
      person({ popularity: 85, ego: 75 }),
      week({ slot: 0, outcome: 'lost', beatenByPopularity: 5, workedWithEnemies: 1, showRating: 20 }),
      settings,
    );
    expect(report.reasons.length).toBeGreaterThan(2);
    for (const reason of report.reasons) {
      expect(reason.text.length).toBeGreaterThan(6);
      expect(reason.text).not.toMatch(/\d+\.\d|\{|\}/);
    }
  });

  it('puts the loudest thing first, which is what the card shows', () => {
    const report = weeklyMorale(person(), week({ worked: false, slot: null, weeksIdle: 8 }), settings);
    expect(report.reasons[0]!.text).toContain('without a match');
  });

  it('falls back to the mood itself when nothing happened worth saying', () => {
    expect(moraleSummary(person({ moraleNote: null, morale: 55 }), settings)).toBe('No complaints');
    expect(moraleSummary(person({ moraleNote: 'Main evented the show.' }), settings)).toBe(
      'Main evented the show.',
    );
  });
});

describe('reading a week off a show', () => {
  const show: MoraleShow = {
    showRating: 70,
    segments: [
      {
        slot: 0,
        participants: [
          { wrestlerId: 'a', side: 0, role: 'competitor' },
          { wrestlerId: 'b', side: 1, role: 'competitor' },
        ],
        result: { winnerSide: 1 },
      },
      {
        slot: 1,
        participants: [
          { wrestlerId: 'c', side: 0, role: 'competitor' },
          { wrestlerId: 'd', side: 1, role: 'competitor' },
        ],
        result: { winnerSide: 0 },
      },
    ],
  };

  const world = {
    popularityOf: (id: string) => (id === 'b' ? 12 : 60),
    alliesOf: () => new Set<string>(['d']),
    enemiesOf: () => new Set<string>(),
    beltsHeldBy: () => 1,
    moraleOf: () => 65,
    weeksIdle: 3,
    companyRating: 60,
    deliveredTo: new Set<string>(['c']),
    roster: [] as Wrestler[],
    currentWeek: 40,
  };

  it('finds the match somebody was in, and which way it went', () => {
    const ctx = moraleContext(person({ id: 'a' }), show, world);
    expect(ctx.worked).toBe(true);
    expect(ctx.slot).toBe(0);
    expect(ctx.outcome).toBe('lost');
    expect(ctx.beatenByPopularity).toBe(12);
  });

  it('reports somebody who was not on the show at all as idle', () => {
    const ctx = moraleContext(person({ id: 'nobody' }), show, world);
    expect(ctx.worked).toBe(false);
    expect(ctx.slot).toBeNull();
    expect(ctx.weeksIdle).toBe(3);
  });

  it('carries the crowd’s wishlist through', () => {
    expect(moraleContext(person({ id: 'c' }), show, world).gaveThemWhatTheyWanted).toBe(true);
    expect(moraleContext(person({ id: 'a' }), show, world).gaveThemWhatTheyWanted).toBe(false);
  });

  it('counts who was in there with them', () => {
    expect(moraleContext(person({ id: 'c' }), show, world).workedWithAllies).toBe(1);
  });

  it('handles a week with no show at all', () => {
    const ctx = moraleContext(person({ id: 'a' }), null, world);
    expect(ctx.worked).toBe(false);
    expect(ctx.showRating).toBe(0);
  });
});

describe('who is a problem', () => {
  it('lists the unhappy, worst first, and leaves the content alone', () => {
    const room = [
      person({ id: '1', morale: 80 }),
      person({ id: '2', morale: 10 }),
      person({ id: '3', morale: 30 }),
      person({ id: '4', morale: 55 }),
    ];
    expect(troubleInTheRoom(room, settings).map((w) => w.id)).toEqual(['2', '3']);
  });
});

describe('the man the room blames, still on the books', () => {
  // The other half of the decision to pay him off. Nobody has to look at him
  // on a card — the office will not book him — but he is still in the room,
  // and keeping him costs something every week until it fades.
  const blamed = (week: number) =>
    person({ id: 'blamed', name: 'Cyclone', blamedFor: { wrestlerId: 'dead', name: 'Earl Mercer', week } });

  it('costs everybody else morale, and says whose fault they think it was', () => {
    const clean = weeklyMorale(person({ id: 'a' }), week({ roster: [person({ id: 'a' })] }), settings);
    const soured = weeklyMorale(
      person({ id: 'a' }),
      week({ roster: [person({ id: 'a' }), blamed(38)], currentWeek: 40 }),
      settings,
    );

    expect(soured.delta).toBeLessThan(clean.delta);
    expect(soured.delta).toBeCloseTo(clean.delta - settings.moraleBlamedInTheRoom, 5);
    const said = soured.reasons.find((r) => r.text.includes('Cyclone'));
    expect(said).toBeDefined();
    expect(said!.text).toContain('Earl Mercer');
  });

  it('does not sour the man himself', () => {
    // He is not unhappy about being in a room with himself.
    const him = blamed(38);
    const report = weeklyMorale(him, week({ roster: [him, person({ id: 'a' })], currentWeek: 40 }), settings);
    expect(report.reasons.some((r) => r.text.includes('still on the books'))).toBe(false);
  });

  it('stops once the room has let it go, without anybody being released', () => {
    // A booker who can afford neither the severance nor the sour room can
    // simply wait it out, and that has to actually work.
    const late = week({
      roster: [person({ id: 'a' }), blamed(10)],
      currentWeek: 10 + settings.watchShunWeeks,
    });
    const report = weeklyMorale(person({ id: 'a' }), late, settings);
    expect(report.reasons.some((r) => r.text.includes('still on the books'))).toBe(false);
  });
});

describe('mood rubs off on the people you are in there with', () => {
  it('lifts a miserable man who worked with somebody enjoying himself', () => {
    const sulking = person({ id: 'a', morale: 10 });
    const alone = weeklyMorale(sulking, week({ moodOfTheOthers: [] }), settings);
    const withACheerfulOne = weeklyMorale(sulking, week({ moodOfTheOthers: [90] }), settings);

    expect(withACheerfulOne.delta).toBeGreaterThan(alone.delta);
    expect(withACheerfulOne.reasons.some((r) => r.text.includes('enjoying himself'))).toBe(true);
  });

  it('drags a happy man who spent the night with somebody who wants out', () => {
    // Both ways, or it is not contagion — it is a free repair tool.
    const content = person({ id: 'a', morale: 90 });
    const alone = weeklyMorale(content, week({ moodOfTheOthers: [] }), settings);
    const withAMalcontent = weeklyMorale(content, week({ moodOfTheOthers: [10] }), settings);

    expect(withAMalcontent.delta).toBeLessThan(alone.delta);
    expect(withAMalcontent.reasons.some((r) => r.text.includes('wants out'))).toBe(true);
  });

  it('does nothing between two people in the same mood', () => {
    const even = person({ id: 'a', morale: 50 });
    expect(weeklyMorale(even, week({ moodOfTheOthers: [50] }), settings).delta).toBeCloseTo(
      weeklyMorale(even, week({ moodOfTheOthers: [] }), settings).delta,
      5,
    );
  });

  it('averages the room he was in rather than taking the loudest', () => {
    // A six-man match with one miserable body in it is not the same as being
    // in there with him alone.
    const w = person({ id: 'a', morale: 50 });
    const oneOnOne = weeklyMorale(w, week({ moodOfTheOthers: [0] }), settings).delta;
    const inACrowd = weeklyMorale(w, week({ moodOfTheOthers: [0, 80, 80] }), settings).delta;
    expect(inACrowd).toBeGreaterThan(oneOnOne);
  });

  it('is a nudge, not a transfer', () => {
    // The widest possible gap, so this is the ceiling on the whole mechanic.
    const rock = person({ id: 'a', morale: 0 });
    const lifted = weeklyMorale(rock, week({ moodOfTheOthers: [100] }), settings).delta;
    const flat = weeklyMorale(rock, week({ moodOfTheOthers: [] }), settings).delta;
    expect(lifted - flat).toBeLessThanOrEqual(settings.moraleContagionWeight);
  });

  it('leaves out anybody who was not wrestling', () => {
    // Managers and officials at ringside are in the segment; they were not in
    // the match. Asserted through the context builder, which is where the
    // filtering has to happen.
    const ctx = moraleContext(
      person({ id: 'a' }),
      {
        showRating: 60,
        segments: [
          {
            slot: 0,
            participants: [
              { wrestlerId: 'a', side: 0, role: 'competitor' },
              { wrestlerId: 'b', side: 1, role: 'competitor' },
              { wrestlerId: 'mgr', side: 1, role: 'manager' },
            ],
            result: { winnerSide: 0 },
          },
        ],
      } as never,
      {
        popularityOf: () => 50,
        alliesOf: () => new Set<string>(),
        enemiesOf: () => new Set<string>(),
        beltsHeldBy: () => 0,
        moraleOf: (id) => (id === 'mgr' ? 0 : 80),
        weeksIdle: 0,
        companyRating: 60,
        deliveredTo: new Set<string>(),
        roster: [] as Wrestler[],
        currentWeek: 40,
      },
    );
    expect(ctx.moodOfTheOthers).toEqual([80]);
  });
});
