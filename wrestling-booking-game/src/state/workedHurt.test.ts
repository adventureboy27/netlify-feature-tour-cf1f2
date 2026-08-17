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
import { ourPrice, shunned, stillHeldAgainstUs, wontWorkForUs } from '../engine/career/onOurWatch';
import { contractDemand } from '../engine/career/ego';
import { renewalRate } from '../engine/economy/contracts';
import { canWork } from '../engine/world/rivalBooking';
import { weeklyWageBill } from '../engine/economy/contracts';
import type { Injury, WorldSettings, Wrestler } from '../engine/types';

function settings(over: Partial<WorldSettings> = {}): WorldSettings {
  return {
    ...defaultWorldSettings(),
    // A seed where the hurt man is not himself hurt fresh in the same match —
    // `putOut` tears up his clearance if he is, and then there is no gamble
    // left to settle. Chosen by trying a handful, not by tuning anything.
    seed: 'wh2',
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

  it('runs the memorial show whoever he was', () => {
    // The test of whether somebody earned one is for the deaths the company
    // did not cause. There is no version of this where the company that
    // killed him decides he was not worth closing the doors for — so this is
    // asserted on a man with no tenure, no belt and no hall of fame.
    const man = findSomeoneWhoIntends('workThroughIt', 'careerThreatening');
    bookHurt(man!, 'careerThreatening');
    runWeek();

    const world = useGameStore.getState().world!;
    expect(world.impromptuShows.some((s) => s.announcement.includes(man!.name))).toBe(true);
  });

  it('sends everybody who was in there with him home for a month, on full pay', () => {
    const man = findSomeoneWhoIntends('workThroughIt', 'careerThreatening');
    bookHurt(man!, 'careerThreatening');
    const foeId = useGameStore.getState().world!.currentCard[0]!.participants.find(
      (p) => p.wrestlerId !== man!.id,
    )!.wrestlerId;
    runWeek();

    const world = useGameStore.getState().world!;
    const foe = world.wrestlers[foeId]!;
    expect(foe.leave).toBeTruthy();
    expect(foe.leave!.weeksRemaining).toBe(world.settings.watchLeaveWeeks);

    // Not bookable, and not because anything is wrong with him.
    expect(canWork(foe, world.settings, world.week)).toBe(false);
    expect(foe.injury).toBeNull();

    // With pay means with pay: he is still on the roster, still under
    // contract, and still in the wage bill the company pays every week.
    expect(world.promotion.rosterIds).toContain(foeId);
    expect(weeklyWageBill([foe])).toBeGreaterThan(0);

    // And the results page says it rather than the roster card quietly
    // greying him out.
    expect(world.weeklyNews.some((n) => n.text.includes(foe.name) && n.text.includes('full pay'))).toBe(true);
  });

  it('turns the whole locker room against the office, not just his friends', () => {
    const before = useGameStore.getState().world!;
    const man = findSomeoneWhoIntends('workThroughIt', 'careerThreatening');
    // Somebody with no relationship to him at all — `bereavements` will have
    // nothing to say about this man, so anything that moves him came from the
    // company having caused it.
    const stranger = before.promotion.rosterIds.find(
      (id) =>
        id !== man!.id &&
        !before.relationships.some((r) => r.aId === id && r.bId === man!.id) &&
        !before.relationships.some((r) => r.bId === id && r.aId === man!.id),
    )!;
    const moraleBefore = before.wrestlers[stranger]!.morale;

    bookHurt(man!, 'careerThreatening');
    runWeek();

    const world = useGameStore.getState().world!;
    expect(world.wrestlers[stranger]!.morale).toBeLessThan(moraleBefore);
    expect(world.weeklyNews.some((n) => n.text.includes('said he could'))).toBe(true);
  });

  it('goes on the company\'s record, where the free-agent market can read it', () => {
    const man = findSomeoneWhoIntends('workThroughIt', 'careerThreatening');
    bookHurt(man!, 'careerThreatening');
    runWeek();

    const world = useGameStore.getState().world!;
    const deaths = world.promotion.deathsOnOurWatch ?? [];
    expect(deaths.map((d) => d.wrestlerId)).toContain(man!.id);
    expect(stillHeldAgainstUs(deaths, world.week, world.settings)).toBeGreaterThan(0);

    // A careful free agent will not sign here now. Checked through the store
    // action rather than the predicate, because the rule has to hold at the
    // place the signing actually happens.
    const held = stillHeldAgainstUs(deaths, world.week, world.settings);
    const careful = world.freeAgents.find((a) => {
      const w = world.wrestlers[a.wrestlerId];
      return w && wontWorkForUs(w, held, world.settings);
    });
    if (careful) {
      useGameStore.getState().signFreeAgent(careful.wrestlerId);
      expect(useGameStore.getState().world!.promotion.rosterIds).not.toContain(careful.wrestlerId);
    }
  });
});

describe('the renewal table, and the day it stops mattering', () => {
  beforeEach(() => {
    useGameStore.getState().newGame(settings({ bodyWorkThroughBackfire: 1, bodyDeathChance: 1 }));
  });

  it('charges the man who already works here the same premium as a stranger', () => {
    const man = findSomeoneWhoIntends('workThroughIt', 'careerThreatening');
    bookHurt(man!, 'careerThreatening');
    runWeek();

    const world = useGameStore.getState().world!;
    const held = stillHeldAgainstUs(world.promotion.deathsOnOurWatch ?? [], world.week, world.settings);
    expect(held).toBeGreaterThan(0);

    // Run every remaining deal down at once, so this is a property of the
    // table rather than of one man who happened to be up.
    const clean = new Map(
      world.promotion.rosterIds.map((id) => {
        const p = world.wrestlers[id]!;
        return [id, contractDemand(p, renewalRate(p, world.settings), p.careerStatus, world.settings).weeklyRate];
      }),
    );
    useGameStore.setState((state) => {
      for (const id of state.world!.promotion.rosterIds) {
        const c = state.world!.wrestlers[id]!.contract;
        if (c) c.weeksRemaining = 1;
      }
    });
    runWeek();

    const after = useGameStore.getState().world!;
    expect(after.pendingRenewals.length).toBeGreaterThan(0);
    for (const offer of after.pendingRenewals) {
      expect(offer.demand.weeklyRate).toBeGreaterThan(clean.get(offer.wrestlerId)!);
    }

    // And the ones who look after themselves did not come to the table at
    // all. They are gone, and the wire says why rather than leaving a hole in
    // the roster for the player to notice.
    const walked = after.weeklyNews.filter((n) => n.text.includes('not signing another one'));
    expect(walked.length).toBeGreaterThan(0);
    expect(walked[0]!.text).toContain(man!.name);
  });

  it('lets it go once the business has, and prices exactly as it did before', () => {
    // The whole point of the fade. Same promotion, same man, two years on:
    // the number is the number, with nothing added for what happened.
    const man = findSomeoneWhoIntends('workThroughIt', 'careerThreatening');
    bookHurt(man!, 'careerThreatening');
    runWeek();

    const world = useGameStore.getState().world!;
    const deaths = world.promotion.deathsOnOurWatch ?? [];
    const wayLater = world.week + world.settings.watchMemoryWeeks;
    const held = stillHeldAgainstUs(deaths, wayLater, world.settings);

    expect(held).toBe(0);
    expect(ourPrice(5000, held, world.settings)).toBe(5000);
    const careful = world.promotion.rosterIds
      .map((id) => world.wrestlers[id]!)
      .reduce((worst, w) => ((w.selfPreservation ?? 0) > (worst.selfPreservation ?? 0) ? w : worst));
    expect(wontWorkForUs(careful, held, world.settings)).toBe(false);

    // And the wall still says what happened. The money forgets; the record
    // does not.
    expect(world.memoriam.some((p) => p.wrestlerId === man!.id)).toBe(true);
  });
});

describe('when the room blames the other man instead', () => {
  beforeEach(() => {
    // Death certain, and the opponent certainly at fault. The odds live in
    // career/onOurWatch.test.ts; this is about where the anger goes.
    useGameStore.getState().newGame(
      settings({
        bodyWorkThroughBackfire: 1,
        bodyDeathChance: 1,
        watchNegligenceFromCarelessness: 1,
      }),
    );
  });

  function killHimThroughSomebodyCareless() {
    const man = findSomeoneWhoIntends('workThroughIt', 'careerThreatening');
    const foeId = useGameStore.getState().world!.promotion.rosterIds.find((id) => id !== man!.id)!;
    // A man who does not look after himself does not look after you either.
    useGameStore.setState((state) => {
      state.world!.wrestlers[foeId]!.selfPreservation = 0;
    });
    bookHurt(man!, 'careerThreatening');
    runWeek();
    return { man: man!, foeId };
  }

  it('lays it at his door, by name, instead of at the office\'s', () => {
    const { man, foeId } = killHimThroughSomebodyCareless();
    const world = useGameStore.getState().world!;

    expect(world.wrestlers[foeId]!.blamedFor?.wrestlerId).toBe(man.id);
    const said = world.weeklyNews.find((n) => n.text.includes('not blaming the office'));
    expect(said).toBeDefined();
    expect(said!.text).toContain(world.wrestlers[foeId]!.name);
    // And the sentence the office would have taken is not also on the wire.
    expect(world.weeklyNews.some((n) => n.text.includes('said he could'))).toBe(false);
  });

  it('still leaves the company carrying some of it — it said he could work', () => {
    killHimThroughSomebodyCareless();
    const world = useGameStore.getState().world!;
    const held = stillHeldAgainstUs(world.promotion.deathsOnOurWatch ?? [], world.week, world.settings);

    expect(held).toBeGreaterThan(0);
    expect(held).toBeLessThan(1);
    expect(ourPrice(1000, held, world.settings)).toBeGreaterThan(1000);
  });

  it('stops the office booking him, without stopping the player', () => {
    const { foeId } = killHimThroughSomebodyCareless();
    // He is off for the month first; the shunning outlasts it.
    for (let i = 0; i < 6; i++) runWeek();

    const world = useGameStore.getState().world!;
    const him = world.wrestlers[foeId]!;
    expect(him.leave).toBeNull();
    expect(shunned(him.blamedFor, world.week, world.settings)).toBe(true);

    // Fill the card and he is not on it.
    useGameStore.getState().autoFillCard();
    const card = useGameStore.getState().world!.currentCard;
    expect(card.flatMap((seg) => seg.participants.map((p) => p.wrestlerId))).not.toContain(foeId);

    // The booker can still put him out there. §0: no warning, no block.
    useGameStore.getState().setSegmentParticipant(0, foeId, 0);
    expect(
      useGameStore.getState().world!.currentCard[0]!.participants.some((p) => p.wrestlerId === foeId),
    ).toBe(true);
  });
});
