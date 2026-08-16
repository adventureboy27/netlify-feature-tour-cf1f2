// What it costs to book a man who is already hurt.
//
// The engine half of this (`resolveInjuryCall`) has its own tests. These are
// about the wire: that a hurt man the booker clears and then books actually
// reaches the settlement, and that whatever happens to him is *said*.
//
// That second half is the whole reason this file exists. The first attempt at
// this wire ran correctly and reported nothing — it settled inside the card
// loop, so every line it produced was stamped with the outgoing week and
// dropped by the wire's own filter. A system that can retire or bury somebody
// silently is exactly what CLAUDE.md §0 forbids, so the test is written
// against the news the player reads rather than against the state.

import { describe, expect, it, beforeEach } from 'vitest';
import { useGameStore } from './store';
import { defaultWorldSettings } from '../engine/world/settings';
import { stanceOn, type InjuryIntent } from '../engine/career/theBody';
import type { Injury, WorldSettings, Wrestler } from '../engine/types';

function settings(over: Partial<WorldSettings> = {}): WorldSettings {
  return {
    ...defaultWorldSettings(),
    seed: 'worked-hurt',
    startingRosterSize: 24,
    ownerMandatesEnabled: false,
    ...over,
  };
}

function hurt(week: number, severity: Injury['severity']): Injury {
  return {
    description: 'a bad neck',
    weeksRemaining: 8,
    totalWeeks: 8,
    sufferedWeek: week,
    severity,
  } as Injury;
}

/**
 * Hurt somebody, clear them, and find the first man on the roster who intends
 * the thing we want to test. The stance is seeded from the man and the injury,
 * so this is a lookup rather than a retry loop.
 */
function findSomeoneWhoIntends(intent: InjuryIntent, severity: Injury['severity'] = 'moderate') {
  const world = useGameStore.getState().world!;
  const injury = hurt(world.week, severity);
  return world.promotion.rosterIds
    .map((id) => world.wrestlers[id]!)
    .find((w) => stanceOn({ ...w, injury } as Wrestler, world.settings)?.man.intent === intent);
}

function bookHurt(man: Wrestler, severity: Injury['severity'] = 'moderate') {
  useGameStore.setState((state) => {
    const person = state.world!.wrestlers[man.id]!;
    person.injury = hurt(state.world!.week, severity);
    person.clearedToWorkHurt = true;
  });
  const world = useGameStore.getState().world!;
  const foe = world.promotion.rosterIds.find((id) => id !== man.id)!;
  useGameStore.getState().setSegmentParticipant(0, man.id, 0);
  useGameStore.getState().setSegmentParticipant(0, foe, 1);
}

function runWeek() {
  useGameStore.getState().resolveWeek();
  const s = useGameStore.getState();
  if (s.world?.pendingWeatherCall) s.answerWeatherCall('runIt');
}

describe('a man booked while hurt', () => {
  beforeEach(() => {
    useGameStore.getState().newGame(settings());
  });

  it('has the gamble settled, and the wire says how it went', () => {
    const man = findSomeoneWhoIntends('workThroughIt');
    expect(man).toBeDefined();
    bookHurt(man!);
    runWeek();

    const news = useGameStore.getState().world!.weeklyNews;
    const said = news.filter((n) => n.kind === 'injury' && n.text.includes(man!.name));
    expect(said).toHaveLength(1);
  });

  it('says nothing about a man who was doing what the doctor told him', () => {
    // He is hurt and he is on the card, but he took no gamble — his own plan
    // was the doctor's plan. There is no outcome to report and reporting one
    // would be noise on every card with a walking wounded on it.
    const man = findSomeoneWhoIntends('restProperly');
    expect(man).toBeDefined();
    bookHurt(man!);
    runWeek();

    const news = useGameStore.getState().world!.weeklyNews;
    expect(news.filter((n) => n.kind === 'injury' && n.text.includes(man!.name))).toHaveLength(0);
  });
});

describe('when it goes as badly as it can', () => {
  beforeEach(() => {
    // Both dials at 1: this is the rarest outcome in the game and the point of
    // the test is the wiring, not the odds. The odds are tested in
    // career/theBody.test.ts.
    useGameStore.getState().newGame(settings({ bodyWorkThroughBackfire: 1, bodyDeathChance: 1 }));
  });

  it('a man sent out on a career-threatening injury can die, and the paper says how', () => {
    const man = findSomeoneWhoIntends('workThroughIt', 'careerThreatening');
    expect(man).toBeDefined();
    bookHurt(man!, 'careerThreatening');
    runWeek();

    const world = useGameStore.getState().world!;
    const person = world.wrestlers[man!.id]!;
    expect(person.deceased).not.toBeNull();

    // Not a status icon on a roster card. A sentence, in the week's news,
    // that says what he did and what it cost.
    const obit = world.weeklyNews.find((n) => n.kind === 'death' && n.text.includes(man!.name));
    expect(obit).toBeDefined();
    expect(obit!.text).toContain('against medical advice');

    // And the machinery every other death gets: the wall, the year, and the
    // company's own dead taken off its books.
    expect(world.memoriam.some((p) => p.wrestlerId === man!.id)).toBe(true);
    expect(world.thisYear.passings.some((p) => p.wrestlerId === man!.id)).toBe(true);
    expect(world.promotion.rosterIds).not.toContain(man!.id);
  });
});
