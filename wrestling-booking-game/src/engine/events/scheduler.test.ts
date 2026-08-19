// The "nothing fires too often" guarantee, tested the only way that means
// anything: by simulating a long save and looking at the distribution.

import { describe, it, expect } from 'vitest';
import { rollWeeklyEvent, recordFired, emptyEventHistory, eligibleEvents, dampedWeight, globalGapSatisfied } from './scheduler';
import { CREATIVE_EVENTS } from '../../data/events';
import { defaultWorldSettings } from '../world/settings';
import { generateWrestlers } from '../generate/wrestler';
import { deriveCareerStatus } from '../career/status';
import { rngFromSeed } from '../rng';
import type { Promotion, Wrestler, CareerStatus } from '../types';
import type { EventHistory } from './scheduler';

const settings = defaultWorldSettings();

function world(seed = 'sched') {
  const rng = rngFromSeed(seed);
  const roster = generateWrestlers(rng, 30, { currentYear: 2000 });
  const promotion: Promotion = {
    id: 'you',
    name: 'Your Promotion',
    identity: 'territory' as const,
    weeksInTheRed: 0,
    closedWeek: null,
    isPlayer: true,
    rating: 55,
    bankBalance: 75000,
    rosterIds: roster.map((w) => w.id),
    titleIds: [],
    ownedTerritoryIds: [],
    homeTerritoryId: 't',
    styleProfile: { preferredStyles: [], violenceTolerance: 50, workrateVsStarPower: 50, divisionFocus: ['mens'], promoHeavy: false },
    bookingCredibility: 50,
    reputation: 50,
    hardcoreSaturation: 0,
    recentShowQuality: 55,
    ownerId: 'o',
    ownerPersonality: 'showman' as const,
    ppvCalendar: ['The Reckoning'],
  };
  const rosterPeak = Math.max(...roster.map((w) => w.popularity));
  const statusOf = (w: Wrestler): CareerStatus =>
    deriveCareerStatus(w, { currentYear: 2000, rosterPeakPopularity: rosterPeak, settings });

  return { roster, promotion, statusOf, rival: { ...promotion, id: 'them', name: 'Rival Co', isPlayer: false } };
}

/** Play `weeks` weeks, always taking the first option. Returns the fire log. */
function playOut(weeks: number, seed = 'play') {
  const { roster, promotion, statusOf, rival } = world(seed);
  const rng = rngFromSeed(seed);
  let history: EventHistory = emptyEventHistory();
  const fired: { week: number; eventId: string; category: string }[] = [];

  for (let week = 1; week <= weeks; week++) {
    const event = rollWeeklyEvent(rng, {
      week,
      library: CREATIVE_EVENTS,
      history,
      roster,
      statusOf,
      promotion,
      rivals: [rival],
      settings,
    });
    if (event) {
      fired.push({ week, eventId: event.eventId, category: event.category });
      history = recordFired(history, event, week);
    }
  }
  return { fired, history };
}

describe('nothing fires too often', () => {
  it('respects each event\'s own cooldown across a five-year save', () => {
    const { fired } = playOut(260);
    const lastSeen = new Map<string, number>();
    for (const f of fired) {
      const previous = lastSeen.get(f.eventId);
      if (previous !== undefined) {
        const cooldown = CREATIVE_EVENTS.find((e) => e.id === f.eventId)!.cooldownWeeks;
        expect(f.week - previous, `${f.eventId} repeated too soon`).toBeGreaterThanOrEqual(cooldown);
      }
      lastSeen.set(f.eventId, f.week);
    }
  });

  it('keeps a hard gap of quiet weeks between any two events', () => {
    const { fired } = playOut(260);
    for (let i = 1; i < fired.length; i++) {
      expect(fired[i]!.week - fired[i - 1]!.week).toBeGreaterThanOrEqual(settings.eventGlobalGapWeeks);
    }
  });

  it('does not run the same category back to back', () => {
    const { fired } = playOut(260);
    const lastByCategory = new Map<string, number>();
    for (const f of fired) {
      const previous = lastByCategory.get(f.category);
      if (previous !== undefined) {
        expect(f.week - previous, `${f.category} repeated too soon`).toBeGreaterThanOrEqual(settings.eventCategoryGapWeeks);
      }
      lastByCategory.set(f.category, f.week);
    }
  });

  it('fires close to every week, per the direct ask for regular personnel decisions', () => {
    const { fired } = playOut(260);
    const weeksPerEvent = 260 / fired.length;
    // Was "roughly one every 3-8 weeks" — deliberately retuned (settings.ts's
    // eventWeeklyChance/eventGlobalGapWeeks/eventCategoryGapWeeks) after
    // direct user feedback: "I want personnel decisions pretty regularly
    // (weekly)". Still not literally every single week — cooldowns and the
    // 80% weekly roll leave some quiet weeks — but noticeably more than one.
    expect(weeksPerEvent).toBeGreaterThan(1);
    expect(weeksPerEvent).toBeLessThan(3);
  });

  it('spreads across the library instead of hammering one favourite', () => {
    const { fired } = playOut(520);
    const counts = new Map<string, number>();
    for (const f of fired) counts.set(f.eventId, (counts.get(f.eventId) ?? 0) + 1);

    const most = Math.max(...counts.values());
    // Over ten years no single event should be more than a third of everything
    // the player saw.
    expect(most / fired.length).toBeLessThan(0.34);
  });

  it('holds up across many different worlds, not just a lucky seed', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const { fired } = playOut(260, seed);
      expect(fired.length).toBeGreaterThan(10);
      for (let i = 1; i < fired.length; i++) {
        expect(fired[i]!.week - fired[i - 1]!.week).toBeGreaterThanOrEqual(settings.eventGlobalGapWeeks);
      }
    }
  });
});

describe('recency damping', () => {
  it('makes a repeatedly seen event rarer', () => {
    const event = CREATIVE_EVENTS[0]!;
    const fresh = dampedWeight(event, emptyEventHistory(), settings);
    const seenThrice = dampedWeight(event, { ...emptyEventHistory(), timesFired: { [event.id]: 3 } }, settings);
    expect(seenThrice).toBeLessThan(fresh);
  });

  it('never makes it impossible, so a long save keeps its whole library', () => {
    const event = CREATIVE_EVENTS[0]!;
    const seenALot = dampedWeight(event, { ...emptyEventHistory(), timesFired: { [event.id]: 40 } }, settings);
    expect(seenALot).toBeGreaterThan(0);
    expect(seenALot).toBeCloseTo(event.weight * settings.eventMinWeightFraction, 5);
  });
});

describe('eligibility', () => {
  it('fires nothing at all in week 1, before anything has happened', () => {
    const { roster, promotion, statusOf, rival } = world();
    const candidates = eligibleEvents({
      week: 1,
      library: CREATIVE_EVENTS,
      history: emptyEventHistory(),
      roster,
      statusOf,
      promotion,
      rivals: [rival],
      settings,
    });
    expect(candidates.every((c) => (c.event.conditions.minWeek ?? 0) <= 1)).toBe(true);
  });

  it('withholds rival events when there is no rival', () => {
    const { roster, promotion, statusOf } = world();
    const candidates = eligibleEvents({
      week: 100,
      library: CREATIVE_EVENTS,
      history: emptyEventHistory(),
      roster,
      statusOf,
      promotion,
      rivals: [],
      settings,
    });
    expect(candidates.some((c) => c.event.conditions.needsRival)).toBe(false);
  });

  it('always resolves the subjects an event asked for', () => {
    const { roster, promotion, statusOf, rival } = world();
    const candidates = eligibleEvents({
      week: 100,
      library: CREATIVE_EVENTS,
      history: emptyEventHistory(),
      roster,
      statusOf,
      promotion,
      rivals: [rival],
      settings,
    });
    expect(candidates.length).toBeGreaterThan(0);
    for (const { event, subjects } of candidates) {
      if (event.conditions.primary) expect(subjects.primary).toBeDefined();
      if (event.conditions.secondary) {
        expect(subjects.secondary).toBeDefined();
        expect(subjects.secondary!.id).not.toBe(subjects.primary?.id);
      }
    }
  });
});

describe('the fired event', () => {
  it('substitutes real names into the text', () => {
    const { fired } = playOut(120);
    expect(fired.length).toBeGreaterThan(0);
  });

  it('always offers the player a choice', () => {
    const { roster, promotion, statusOf, rival } = world();
    const rng = rngFromSeed('choices');
    let history = emptyEventHistory();
    for (let week = 1; week <= 200; week++) {
      const event = rollWeeklyEvent(rng, {
        week,
        library: CREATIVE_EVENTS,
        history,
        roster,
        statusOf,
        promotion,
        rivals: [rival],
        settings,
      });
      if (!event) continue;
      expect(event.options.length).toBeGreaterThanOrEqual(2);
      for (const option of event.options) {
        expect(option.gains).toBeTruthy();
        expect(option.costs).toBeTruthy();
      }
      expect(event.title).not.toContain('{');
      expect(event.body).not.toContain('{');
      history = recordFired(history, event, week);
    }
  });
});

describe('globalGapSatisfied', () => {
  it('lets the very first event through', () => {
    expect(globalGapSatisfied(emptyEventHistory(), 1, settings)).toBe(true);
  });

  it('blocks anything inside the gap', () => {
    const history = { ...emptyEventHistory(), lastFiredWeek: 10 };
    expect(globalGapSatisfied(history, 10 + settings.eventGlobalGapWeeks - 1, settings)).toBe(false);
    expect(globalGapSatisfied(history, 10 + settings.eventGlobalGapWeeks, settings)).toBe(true);
  });
});
