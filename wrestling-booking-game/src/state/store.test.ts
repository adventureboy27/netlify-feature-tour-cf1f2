import { describe, expect, it, beforeEach } from 'vitest';
import { useGameStore } from './store';
import { defaultWorldSettings } from '../engine/world/settings';
import { eventById } from '../data/events';

// A roster big enough to survive its own injuries. This was 12, which was
// never a viable promotion — it produced 1.5-star shows and injured itself to
// a standstill inside twenty weeks. The old TV ladder hid that by putting a
// floor of 60 under every company however bad it got, so the tests below ran
// against a promotion that was quietly dying the whole time.
const TEST_ROSTER_SIZE = 24;

function freshSettings() {
  return { ...defaultWorldSettings(), seed: 'store-test', startingRosterSize: TEST_ROSTER_SIZE };
}

/**
 * A world the owner is not leaning on. Anything that has to run for a year
 * needs this: three ignored mandates ends a run at week 24, which is correct
 * behaviour and makes a passive year impossible to simulate.
 */
function patientOwner() {
  return { ...freshSettings(), ownerMandatesEnabled: false };
}

beforeEach(() => {
  useGameStore.getState().newGame(freshSettings());
});

/**
 * Resolve the week, answering a severe-weather call if one is waiting.
 *
 * A bad forecast holds the week open until the booker decides — that is the
 * point of it — so anything that just wants the show to have happened has to
 * answer. 'runIt' is the choice that still produces a show.
 */
function runWeek(choice: 'runIt' | 'callItOff' | 'moveIt' = 'runIt') {
  useGameStore.getState().resolveWeek();
  if (useGameStore.getState().world?.pendingWeatherCall) {
    useGameStore.getState().answerWeatherCall(choice);
  }
}

describe('newGame', () => {
  it('creates a world with the requested roster size, starting cash, and week 1', () => {
    const { world } = useGameStore.getState();
    expect(world).not.toBeNull();
    // `wrestlers` is the whole population of the business — your roster, every
    // rival's, and everyone unsigned — so the roster is checked on the
    // promotion itself, and the population against all three.
    expect(world!.promotion.rosterIds).toHaveLength(TEST_ROSTER_SIZE);
    const rivalRosters = world!.rivals.reduce((sum, r) => sum + r.rosterIds.length, 0);
    expect(rivalRosters).toBeGreaterThan(0);
    expect(Object.keys(world!.wrestlers)).toHaveLength(TEST_ROSTER_SIZE + freshSettings().freeAgentPoolSize + rivalRosters);
    expect(world!.promotion.bankBalance).toBe(freshSettings().startingCash);
    expect(world!.week).toBe(1);
    expect(world!.currentCard).toHaveLength(world!.settings.segmentsPerTV);
  });

  it('is deterministic for a given seed', () => {
    useGameStore.getState().newGame(freshSettings());
    const namesA = Object.values(useGameStore.getState().world!.wrestlers).map((w) => w.name);
    useGameStore.getState().newGame(freshSettings());
    const namesB = Object.values(useGameStore.getState().world!.wrestlers).map((w) => w.name);
    expect(namesA).toEqual(namesB);
  });
});

describe('card editing', () => {
  it('setSegmentParticipant adds a wrestler to a slot and side', () => {
    const { world, setSegmentParticipant } = useGameStore.getState();
    const wrestlerId = Object.keys(world!.wrestlers)[0]!;
    setSegmentParticipant(0, wrestlerId, 0);
    const segment = useGameStore.getState().world!.currentCard[0]!;
    expect(segment.participants).toEqual([{ wrestlerId, side: 0, role: 'competitor' }]);
  });

  it('moving a wrestler to a new side replaces their old entry rather than duplicating', () => {
    const { world, setSegmentParticipant } = useGameStore.getState();
    const wrestlerId = Object.keys(world!.wrestlers)[0]!;
    setSegmentParticipant(0, wrestlerId, 0);
    setSegmentParticipant(0, wrestlerId, 1);
    const segment = useGameStore.getState().world!.currentCard[0]!;
    expect(segment.participants).toHaveLength(1);
    expect(segment.participants[0]!.side).toBe(1);
  });

  it('removeSegmentParticipant removes them', () => {
    const { world, setSegmentParticipant, removeSegmentParticipant } = useGameStore.getState();
    const wrestlerId = Object.keys(world!.wrestlers)[0]!;
    setSegmentParticipant(0, wrestlerId, 0);
    removeSegmentParticipant(0, wrestlerId);
    expect(useGameStore.getState().world!.currentCard[0]!.participants).toHaveLength(0);
  });

  it('setSegmentRules merges into the existing rules rather than replacing them', () => {
    const { setSegmentRules } = useGameStore.getState();
    setSegmentRules(0, { timeLimit: 30 });
    const rules = useGameStore.getState().world!.currentCard[0]!.rules;
    expect(rules.timeLimit).toBe(30);
    expect(rules.preset).toBe('singles'); // untouched
  });

  it('setSegmentStipulation sets and clears the stipulation', () => {
    const { setSegmentStipulation } = useGameStore.getState();
    setSegmentStipulation(0, 'ladder');
    expect(useGameStore.getState().world!.currentCard[0]!.stipulation).toBe('ladder');
    setSegmentStipulation(0, null);
    expect(useGameStore.getState().world!.currentCard[0]!.stipulation).toBeNull();
  });
});

describe('resolveWeek', () => {
  it('advances the week and resets the card even with nothing booked', () => {
    const before = useGameStore.getState().world!;
    useGameStore.getState().resolveWeek();
    const after = useGameStore.getState().world!;
    expect(after.week).toBe(before.week + 1);
    expect(after.currentCard.every((s) => s.participants.length === 0)).toBe(true);
    expect(after.showHistory).toHaveLength(1);
    expect(after.showHistory[0]!.showRating).toBe(0);
  });

  it('leaves an empty segment unresolved (no result) and a filled one resolved', () => {
    const { world, setSegmentParticipant } = useGameStore.getState();
    const ids = Object.keys(world!.wrestlers);
    setSegmentParticipant(5, ids[0]!, 0);
    setSegmentParticipant(5, ids[1]!, 1);
    useGameStore.getState().resolveWeek();
    const show = useGameStore.getState().world!.showHistory[0]!;
    expect(show.segments[0]!.result).toBeNull();
    expect(show.segments[5]!.result).not.toBeNull();
    expect(show.segments[5]!.result!.stars).toBeGreaterThanOrEqual(0);
  });

  it('books, pays, and updates the bank balance from the gate', () => {
    const { world, setSegmentParticipant } = useGameStore.getState();
    const ids = Object.keys(world!.wrestlers);
    for (let slot = 0; slot < 6; slot++) {
      setSegmentParticipant(slot, ids[slot * 2]!, 0);
      setSegmentParticipant(slot, ids[slot * 2 + 1]!, 1);
    }
    const bankBefore = useGameStore.getState().world!.promotion.bankBalance;
    useGameStore.getState().resolveWeek();
    const after = useGameStore.getState().world!;
    expect(after.promotion.bankBalance).not.toBe(bankBefore);
    expect(after.showHistory[0]!.gate).toBeGreaterThanOrEqual(0);
  });

  it('moves the company rating toward the target implied by the show stars', () => {
    const { world, setSegmentParticipant } = useGameStore.getState();
    const ids = Object.keys(world!.wrestlers);
    // Stack every segment with the two most popular wrestlers to get a strong show.
    const sorted = Object.values(world!.wrestlers).sort((a, b) => b.popularity - a.popularity);
    for (let slot = 0; slot < 6; slot++) {
      setSegmentParticipant(slot, sorted[0]!.id, 0);
      setSegmentParticipant(slot, sorted[1]!.id, 1);
    }
    void ids;
    const ratingBefore = useGameStore.getState().world!.promotion.rating;
    useGameStore.getState().resolveWeek();
    const ratingAfter = useGameStore.getState().world!.promotion.rating;
    // rating moves by exactly one settings.ratingLadderStepPerWeek step (up, down, or holds at target)
    const step = useGameStore.getState().world!.settings.ratingLadderStepPerWeek;
    expect(Math.abs(ratingAfter - ratingBefore)).toBeLessThanOrEqual(step);
  });
});

describe('the opening position', () => {
  it('puts everyone on the roster on a two-year deal with no clauses', () => {
    const { world } = useGameStore.getState();
    const roster = world!.promotion.rosterIds.map((id) => world!.wrestlers[id]!);
    expect(roster.length).toBeGreaterThan(0);
    for (const w of roster) {
      expect(w.contract, w.name).not.toBeNull();
      expect(w.contract!.totalWeeks).toBe(104);
      expect(w.contract!.clauses).toEqual([]);
      expect(w.contract!.weeklyRate).toBeGreaterThan(0);
    }
  });

  it('makes payroll a real number — the bug this fixes made it silently zero', () => {
    const { world } = useGameStore.getState();
    const roster = world!.promotion.rosterIds.map((id) => world!.wrestlers[id]!);
    const bill = roster.reduce((sum, w) => sum + (w.contract?.weeklyRate ?? 0), 0);
    expect(bill).toBeGreaterThan(0);
  });

  it('has a pool of unsigned talent to sign from', () => {
    const { world } = useGameStore.getState();
    expect(world!.freeAgents.length).toBe(world!.settings.freeAgentPoolSize);
    for (const agent of world!.freeAgents) {
      const w = world!.wrestlers[agent.wrestlerId]!;
      expect(w.promotionId).toBeNull();
      expect(w.contract).toBeNull();
    }
  });

  it('does not put free agents on your roster', () => {
    const { world } = useGameStore.getState();
    const rosterSet = new Set(world!.promotion.rosterIds);
    for (const agent of world!.freeAgents) expect(rosterSet.has(agent.wrestlerId)).toBe(false);
  });
});

describe('the office filling the card', () => {
  it('books the empty slots from the roster, nobody twice', () => {
    const store = useGameStore.getState();
    store.autoFillCard();

    const card = useGameStore.getState().world!.currentCard;
    const filled = card.filter((s) => new Set(s.participants.map((p) => p.side)).size >= 2);
    expect(filled.length).toBeGreaterThan(0);

    const booked = card.flatMap((s) => s.participants.map((p) => p.wrestlerId));
    expect(new Set(booked).size).toBe(booked.length);
  });

  it('leaves what you booked by hand alone', () => {
    const store = useGameStore.getState();
    const roster = store.world!.promotion.rosterIds;
    store.setSegmentParticipant(0, roster[0]!, 0);
    store.setSegmentParticipant(0, roster[1]!, 1);
    useGameStore.getState().autoFillCard();

    const opener = useGameStore.getState().world!.currentCard[0]!;
    expect(opener.participants.map((p) => p.wrestlerId).sort()).toEqual([roster[0]!, roster[1]!].sort());
  });
});

describe('going under', () => {
  it('folds the promotion after the grace period, and lets the roster go', () => {
    // A promotion with no income at all: the worst room in the game at a
    // giveaway price, and nothing booked on it. Note that it deliberately does
    // *not* book a card — a company that puts on good shows now earns
    // pay-per-view buys every month regardless of how small the room is, which
    // is correct and which makes a bad venue on its own survivable.
    useGameStore.getState().newGame(patientOwner());
    const store = useGameStore.getState();
    store.setVenue('schoolGym');
    store.setTicketPrice(1);
    const hadContracts = [...useGameStore.getState().world!.promotion.rosterIds];

    for (let i = 0; i < 40 && !useGameStore.getState().world!.folded; i++) {
      useGameStore.getState().resolveWeek();
    }

    const world = useGameStore.getState().world!;
    expect(world.folded).not.toBeNull();
    expect(world.weeksInTheRed).toBeGreaterThan(world.settings.bankruptcyGraceWeeks);
    expect(world.promotion.rosterIds).toHaveLength(0);

    // Everybody who was under contract is loose in the business, not deleted.
    // Asserted against the actual roster rather than against the starting
    // pool size: rivals shop weekly now, so the pool is a moving number and
    // comparing to its opening value only ever measured the rivals.
    const loose = new Set(world.freeAgents.map((a) => a.wrestlerId));
    const stillSomewhere = hadContracts.filter(
      (id) =>
        loose.has(id) ||
        world.rivals.some((r) => r.rosterIds.includes(id)) ||
        world.wrestlers[id]?.deceased ||
        world.wrestlers[id]?.careerStatus === 'retired',
    );
    expect(stillSomewhere).toHaveLength(hadContracts.length);
  });

  it('will not run another show once it has folded', () => {
    useGameStore.getState().newGame(patientOwner());
    const store = useGameStore.getState();
    store.setVenue('schoolGym');
    store.setTicketPrice(1);
    for (let i = 0; i < 40 && !useGameStore.getState().world!.folded; i++) {
      useGameStore.getState().resolveWeek();
    }

    const weekWhenFolded = useGameStore.getState().world!.week;
    useGameStore.getState().resolveWeek();
    expect(useGameStore.getState().world!.week).toBe(weekWhenFolded);
  });
});

describe('the rest of the business', () => {
  it('runs its own shows every week', () => {
    useGameStore.getState().resolveWeek();
    const world = useGameStore.getState().world!;

    expect(world.rivalShows.length).toBeGreaterThan(0);
    for (const show of world.rivalShows) {
      expect(show.matches.length).toBeGreaterThan(0);
      expect(show.showRating).toBeGreaterThan(0);
    }
  });

  it('gives every rival a staffed roster and crowned champions', () => {
    const world = useGameStore.getState().world!;
    for (const rival of world.rivals) {
      expect(rival.rosterIds.length).toBeGreaterThan(0);
      const belts = world.titles.filter((t) => t.promotionId === rival.id);
      expect(belts.length).toBeGreaterThan(0);
      expect(belts.some((t) => !t.vacant)).toBe(true);
    }
  });

  it('moves their belts over a few years without the player touching anything', () => {
    for (let i = 0; i < 52 * 3; i++) useGameStore.getState().resolveWeek();
    const world = useGameStore.getState().world!;
    const rivalBelts = world.titles.filter((t) => t.promotionId !== world.promotion.id);
    expect(rivalBelts.some((t) => t.history.length > 1)).toBe(true);
  });
});

describe('the awards night', () => {
  /** Run until the calendar turns, which is not exactly 52 shows in. */
  function toTheTurnOfTheYear(): void {
    useGameStore.getState().newGame(patientOwner());
    for (let i = 0; i < 60; i++) {
      // Anything waiting on the booker holds the week open, so a helper that
      // only presses "resolve" stalls forever. Neither of these used to fire
      // inside sixty weeks of autofill: the repackage event could not fire at
      // all, being gated on a stale gimmick that nothing ever staled.
      const pending = useGameStore.getState().world!.pendingEvent;
      const firstOption = pending ? eventById(pending.eventId)?.options[0] : undefined;
      if (firstOption) useGameStore.getState().chooseEventOption(firstOption.id);
      useGameStore.getState().dismissEventOutcome();
      if (useGameStore.getState().world!.pendingWeatherCall) {
        useGameStore.getState().answerWeatherCall('runIt');
      }
      useGameStore.getState().autoFillCard();
      useGameStore.getState().resolveWeek();
      if (useGameStore.getState().world!.yearInReview) return;
    }
    throw new Error('the year never turned');
  }

  it('hands out the year at the turn of the year, and remembers it', () => {
    toTheTurnOfTheYear();
    const world = useGameStore.getState().world!;

    expect(world.yearInReview!.awards.length).toBeGreaterThan(0);
    // Somebody was the biggest name in the year, and some match was the best
    // in it. Those two are the awards a year always produces.
    const ids = world.yearInReview!.awards.map((a) => a.awardId);
    expect(ids).toContain('wrestlerOfTheYear');
    expect(ids).toContain('matchOfTheYear');
    // Everything handed out is on the permanent record, stamped with the year
    // that just finished rather than the one starting.
    expect(world.awardHistory).toEqual(world.yearInReview!.awards);
    for (const winner of world.awardHistory) {
      expect(winner.year).toBe(world.settings.startingYear);
      expect(winner.wrestlerIds.length).toBeGreaterThan(0);
      expect(winner.wrestlerIds.every((id) => world.wrestlers[id])).toBe(true);
      expect(winner.citation).not.toBe('');
    }
  });

  it('opens a clean sheet for the new year', () => {
    toTheTurnOfTheYear();
    const world = useGameStore.getState().world!;

    expect(world.yearRecord.year).toBe(world.settings.startingYear + 1);
    expect(world.yearRecord.bestMatch).toBeNull();
    expect(world.yearRecord.worstMatch).toBeNull();
    expect(Object.keys(world.yearRecord.matches)).toHaveLength(0);
    // And the baseline is everybody's standing right now, so next year's
    // movement is measured from here.
    for (const w of Object.values(world.wrestlers)) {
      expect(world.yearRecord.popularityAtStart[w.id]).toBe(w.popularity);
    }
  });

  it('counts matches from every promotion, not just the player s', () => {
    for (let i = 0; i < 4; i++) {
      useGameStore.getState().autoFillCard();
      useGameStore.getState().resolveWeek();
    }
    const world = useGameStore.getState().world!;
    const onARivalRoster = Object.values(world.wrestlers).filter(
      (w) => w.promotionId !== null && w.promotionId !== world.promotion.id,
    );
    expect(onARivalRoster.some((w) => (world.yearRecord.matches[w.id] ?? 0) > 0)).toBe(true);
  });

  it('applies the effects without pushing anybody out of bounds', () => {
    toTheTurnOfTheYear();
    const world = useGameStore.getState().world!;

    // What each award is worth is settled in awards.test.ts. What the store
    // has to get right is that the effects land on real people and stay
    // inside the ranges the rest of the game assumes.
    expect(world.awardHistory.length).toBeGreaterThan(0);
    for (const winner of world.awardHistory) {
      for (const id of winner.wrestlerIds) {
        const w = world.wrestlers[id];
        expect(w).toBeDefined();
        expect(w!.popularity).toBeGreaterThanOrEqual(0);
        expect(w!.popularity).toBeLessThanOrEqual(100);
        expect(w!.momentum).toBeGreaterThanOrEqual(-100);
        expect(w!.momentum).toBeLessThanOrEqual(100);
        expect(w!.morale).toBeGreaterThanOrEqual(0);
        expect(w!.morale).toBeLessThanOrEqual(100);
      }
    }
  });

  it('does not give one person two of the individual awards in a year', () => {
    toTheTurnOfTheYear();
    const world = useGameStore.getState().world!;
    const individual = world.awardHistory.filter(
      (a) => a.awardId !== 'matchOfTheYear' && a.awardId !== 'worstMatchOfTheYear',
    );
    const named = individual.flatMap((a) => a.wrestlerIds);
    expect(new Set(named).size).toBe(named.length);
  });
});

describe('the owner', () => {
  it('comes calling on schedule with something specific', () => {
    for (let i = 0; i < 8; i++) {
      useGameStore.getState().autoFillCard();
      useGameStore.getState().resolveWeek();
      if (useGameStore.getState().world!.mandate) break;
    }
    const world = useGameStore.getState().world!;
    expect(world.mandate).not.toBeNull();
    expect(world.mandate!.description.length).toBeGreaterThan(10);
    expect(world.mandate!.deadlineWeek).toBeGreaterThan(world.week);
  });

  it('takes yes for an answer as soon as it is true', () => {
    // Drive to a release mandate, then do the thing, and it should resolve on
    // the next week rather than sitting until the deadline.
    for (let i = 0; i < 40; i++) {
      const world = useGameStore.getState().world!;
      if (world.mandate?.type === 'releaseWrestler') break;
      useGameStore.getState().autoFillCard();
      useGameStore.getState().resolveWeek();
      useGameStore.getState().dismissMandateOutcome();
    }
    const mandate = useGameStore.getState().world!.mandate;
    if (mandate?.type !== 'releaseWrestler') return; // this seed never asked; nothing to assert

    useGameStore.getState().releaseWrestler(mandate.targetId!);
    useGameStore.getState().autoFillCard();
    useGameStore.getState().resolveWeek();

    const world = useGameStore.getState().world!;
    expect(world.lastMandateOutcome?.met).toBe(true);
    expect(world.mandate).toBeNull();
    expect(world.mandateStrikes).toBe(0);
  });

  it('fires you on the third strike, and the save stops there', () => {
    // This test is about the owner's patience, not about solvency, and three
    // mandates take the better part of a year to run their deadlines out. A
    // promotion booking auto-filled cards for that long can genuinely go
    // under first, at which point nobody is left to fire anybody — so it is
    // given the cash to still be trading when the third strike lands.
    useGameStore.getState().newGame({ ...freshSettings(), startingCash: 2_000_000 });

    // Ignore everything the owner ever says.
    for (let i = 0; i < 60 && !useGameStore.getState().world!.fired; i++) {
      useGameStore.getState().autoFillCard();
      useGameStore.getState().resolveWeek();
      useGameStore.getState().dismissMandateOutcome();
    }
    const world = useGameStore.getState().world!;
    expect(world.fired).not.toBeNull();
    expect(world.mandateStrikes).toBe(world.settings.mandateStrikesBeforeFiring);

    // And the run really is over — a week does not advance after it.
    const weekWhenFired = world.week;
    useGameStore.getState().resolveWeek();
    expect(useGameStore.getState().world!.week).toBe(weekWhenFired);
  });

  it('leaves you alone when mandates are switched off', () => {
    useGameStore.getState().newGame(patientOwner());
    for (let i = 0; i < 30; i++) {
      useGameStore.getState().autoFillCard();
      useGameStore.getState().resolveWeek();
    }
    const world = useGameStore.getState().world!;
    expect(world.mandate).toBeNull();
    expect(world.mandateStrikes).toBe(0);
    expect(world.fired).toBeNull();
  });
});

describe('the officials', () => {
  const patient = () => ({ ...patientOwner(), seed: 'officials' });

  beforeEach(() => {
    useGameStore.getState().newGame(patient());
  });

  const world = () => useGameStore.getState().world!;
  const mine = () => world().referees.filter((r) => r.promotionId === world().promotion.id);

  it('opens with one man on the books and the rest of the business available', () => {
    // One official and a six-match card is the shape of the lesson: he cannot
    // work the whole night well, and the fix costs money.
    expect(mine()).toHaveLength(1);
    expect(world().defaultRefereeId).toBe(mine()[0]!.id);
    expect(world().referees.filter((r) => !r.promotionId).length).toBeGreaterThan(5);
  });

  it('signs one to a weekly deal with no clauses at all', () => {
    const target = world().referees.find((r) => !r.promotionId)!;
    expect(useGameStore.getState().signReferee(target.id)).toEqual({ ok: true, reason: null });

    const signed = world().referees.find((r) => r.id === target.id)!;
    expect(signed.promotionId).toBe(world().promotion.id);
    expect(signed.contract!.weeklyRate).toBeGreaterThan(0);
    // An official never gets a say in who goes over.
    expect(signed.contract!.clauses).toEqual([]);
  });

  it('refuses to sign somebody who already works for somebody', () => {
    const target = world().referees.find((r) => !r.promotionId)!;
    useGameStore.getState().signReferee(target.id);
    // He is under contract now, including to you — no double-signing.
    const second = useGameStore.getState().signReferee(target.id);
    expect(second.ok).toBe(false);
    expect(second.reason).toBeTruthy();
  });

  it('pays them every week out of the payroll, booked or not', () => {
    const before = world().promotion.bankBalance;
    const target = world().referees.find((r) => !r.promotionId)!;
    useGameStore.getState().signReferee(target.id);
    const wage = world().referees.find((r) => r.id === target.id)!.contract!.weeklyRate;

    // Run a week with nobody booked at all: the wage is still due.
    runWeek();
    const show = world().showHistory[0]!;
    expect(show.payroll).toBeGreaterThanOrEqual(wage);
    expect(world().promotion.bankBalance).not.toBe(before);
  });

  it('names an official beside every match it resolves', () => {
    useGameStore.getState().autoFillCard();
    runWeek();
    const show = world().showHistory[0]!;
    const booked = show.segments.filter((s) => s.result);
    expect(booked.length).toBeGreaterThan(0);
    // Somebody is always counting, and the card always says who.
    for (const segment of booked) expect(segment.result!.officialName).toBeTruthy();
  });

  it('lets one man be named for the card and another for a single match', () => {
    const spare = world().referees.find((r) => !r.promotionId)!;
    useGameStore.getState().signReferee(spare.id);
    useGameStore.getState().autoFillCard();
    useGameStore.getState().setSegmentReferee(0, spare.id);
    useGameStore.getState().resolveWeek();

    const show = world().showHistory[0]!;
    const opener = show.segments.find((s) => s.slot === 0 && s.result);
    expect(opener!.result!.officialName).toBe(spare.name);
    const others = show.segments.filter((s) => s.result && s.slot !== 0);
    expect(others.some((s) => s.result!.officialName !== spare.name)).toBe(true);
  });

  it('wears an official down across a card and rests him after it', () => {
    useGameStore.getState().autoFillCard();
    const before = mine()[0]!.sharpness;
    useGameStore.getState().resolveWeek();
    const worked = mine()[0]!;
    // He worked the whole night on his own, so he is spent — and the week
    // that follows gives some of it back.
    expect(worked.careerMatches).toBeGreaterThan(0);
    expect(worked.sharpness).toBeLessThan(before);
    expect(worked.matchesTonight).toBe(0);
  });

  it('shares the card out with the best official on the main event', () => {
    const best = [...world().referees]
      .filter((r) => !r.promotionId)
      .sort((a, b) => b.competence - a.competence)[0]!;
    useGameStore.getState().signReferee(best.id);
    useGameStore.getState().autoFillCard();
    useGameStore.getState().spreadOfficialsAcrossCard();

    const card = world().currentCard.filter((s) => new Set(s.participants.map((p) => p.side)).size >= 2);
    expect(card.length).toBeGreaterThan(1);
    expect(card[card.length - 1]!.refereeId).toBe(best.id);
    expect(card[0]!.refereeId).not.toBe(best.id);
  });

  it('says what a bad official missed, by name, rather than hiding it in the finish', () => {
    // The whole reason a cheap referee is a decision and not a stat.
    const worst = [...world().referees]
      .filter((r) => !r.promotionId)
      .sort((a, b) => a.competence - b.competence)[0]!;
    useGameStore.getState().signReferee(worst.id);
    useGameStore.getState().setDefaultReferee(worst.id);

    const seen: string[] = [];
    for (let week = 0; week < 12; week++) {
      useGameStore.getState().autoFillCard();
      // Keep him on every match — this is the booker who bought cheap.
      for (const segment of useGameStore.getState().world!.currentCard) {
        useGameStore.getState().setSegmentReferee(segment.slot, worst.id);
      }
      useGameStore.getState().resolveWeek();
      const show = world().showHistory[world().showHistory.length - 1]!;
      for (const segment of show.segments) {
        for (const miss of segment.result?.refereeMisses ?? []) seen.push(miss.text);
      }
    }

    expect(seen.length).toBeGreaterThan(0);
    // Every miss names the official who made it. Not necessarily the one we
    // signed: rivals sign officials away, and across twelve weeks they do, at
    // which point somebody else is counting. Naming *an* official is the
    // invariant — asserting a name captured up front was testing the poaching
    // system by accident, and failed the moment it worked.
    const everyName = world().referees.map((r) => r.name);
    for (const text of seen) {
      expect(everyName.some((name) => text.includes(name)), text).toBe(true);
      // A miss that reaches the screen with a placeholder in it is the bug
      // this is guarding.
      expect(text).not.toMatch(/\{[a-z]+\}/i);
    }
  });

  it('puts a wrestler in the shirt when the promotion has signed nobody', () => {
    // Releasing the last official is allowed. It just means one of the boys
    // counts every fall, and they all have an opinion.
    for (const referee of mine()) useGameStore.getState().releaseReferee(referee.id);
    expect(mine()).toHaveLength(0);

    useGameStore.getState().autoFillCard();
    runWeek();
    const show = world().showHistory[0]!;
    const booked = show.segments.filter((s) => s.result);
    expect(booked.length).toBeGreaterThan(0);
    for (const segment of booked) expect(segment.result!.officialName).toContain('guest');
  });

  it('reports it when an official leaves rather than letting him vanish', () => {
    // CLAUDE.md: nothing happens to a person off-screen, and a referee whose
    // deal ran out is a departure like any other.
    let announced = false;
    for (let week = 0; week < 60 && !announced; week++) {
      useGameStore.getState().autoFillCard();
      runWeek();
      if (
        world().weeklyNews.some(
          (item) => item.kind === 'official' && item.text.includes('contract has run out'),
        )
      ) {
        announced = true;
      }
    }
    expect(announced).toBe(true);
  });
});

describe('second careers', () => {
  const patient = () => ({ ...patientOwner(), seed: 'careers' });

  beforeEach(() => {
    useGameStore.getState().newGame(patient());
  });

  const world = () => useGameStore.getState().world!;
  const roster = () => world().promotion.rosterIds.map((id) => world().wrestlers[id]!).filter(Boolean);

  it('lets you move somebody in week one of a new save', () => {
    // The starting roster has never changed jobs, so it owes no cooldown.
    // Treating "roleSinceWeek 0" as "just took the job" locked every save out
    // of the entire system for its first year.
    expect(world().week).toBe(1);
    const anyone = roster()[0]!;
    expect(useGameStore.getState().changeRole(anyone.id, 'referee')).toEqual({ ok: true, reason: null });
  });

  it('will not let them move straight back', () => {
    const anyone = roster()[0]!;
    useGameStore.getState().changeRole(anyone.id, 'referee');
    const back = useGameStore.getState().changeRole(anyone.id, 'wrestler');
    expect(back.ok).toBe(false);
    expect(back.reason).toContain('weeks');
  });

  it('puts a converted wrestler in the shirt and takes him off the card', () => {
    const anyone = roster()[0]!;
    useGameStore.getState().changeRole(anyone.id, 'referee');

    const asOfficial = world().referees.find((r) => r.wrestlerId === anyone.id);
    expect(asOfficial).toBeDefined();
    expect(asOfficial!.promotionId).toBe(world().promotion.id);
    // No deal of his own: he is already on the roster payroll, and charging
    // him twice was the obvious bug waiting in this feature.
    expect(asOfficial!.contract).toBeNull();
    // He brings a wrestler's toughness, which is the whole reason to convert
    // one rather than sign a career official.
    expect(asOfficial!.toughness).toBe(anyone.toughness);

    useGameStore.getState().autoFillCard();
    runWeek();
    const show = world().showHistory[0]!;
    expect(show.segments.some((seg) => seg.participants.some((p) => p.wrestlerId === anyone.id))).toBe(false);
  });

  it('puts a converted wrestler in a suit, for nothing, and takes him off the card', () => {
    const talker = [...roster()].sort((a, b) => b.charisma - a.charisma)[0]!;
    useGameStore.getState().changeRole(talker.id, 'manager');

    const asManager = world().staffManagers.find((m) => m.wrestlerId === talker.id);
    expect(asManager).toBeDefined();
    expect(asManager!.micWork).toBe(talker.charisma);
    // Already on the payroll, so no appearance fee.
    expect(asManager!.feePerShow).toBe(0);

    useGameStore.getState().autoFillCard();
    useGameStore.getState().setSegmentManager(0, asManager!.id, 0);
    runWeek();

    const show = world().showHistory[0]!;
    expect(show.segments.some((seg) => seg.participants.some((p) => p.wrestlerId === talker.id))).toBe(false);
    // And the booking survived the night rather than being dropped for an
    // unrecognised manager id — the pool lookup has to know about your own.
    expect(world().showHistory[0]!.segments[0]!.managerIds?.[0]?.managerId).toBe(asManager!.id);
  });

  it('takes somebody out of the shirt when they leave the company', () => {
    const anyone = roster()[0]!;
    useGameStore.getState().changeRole(anyone.id, 'referee');
    useGameStore.getState().releaseWrestler(anyone.id);

    expect(world().wrestlers[anyone.id]!.role).toBe('wrestler');
    expect(world().referees.find((r) => r.wrestlerId === anyone.id)!.promotionId).toBeNull();
    expect(world().defaultRefereeId).not.toBe(`ref-of-${anyone.id}`);
  });
});

describe('trades', () => {
  const patient = () => ({ ...patientOwner(), seed: 'trades' });

  beforeEach(() => {
    useGameStore.getState().newGame(patient());
  });

  const world = () => useGameStore.getState().world!;
  const roster = () => world().promotion.rosterIds.map((id) => world().wrestlers[id]!).filter(Boolean);

  it('moves the wrestler and his contract to the other company', () => {
    const rival = world().rivals.find((r) => r.closedWeek === null)!;
    const mine = [...roster()].sort((a, b) => b.popularity - a.popularity)[0]!;
    const theirs = rival.rosterIds
      .map((id) => world().wrestlers[id]!)
      .sort((a, b) => a.popularity - b.popularity)[0]!;

    // Make it a deal nobody would turn down: your best man on a cheap, short
    // deal. A star on a big contract is *supposed* to be hard to move — that
    // is the system working — so the mechanics have to be proved on an offer
    // whose acceptance is not in question.
    useGameStore.setState((s) => {
      const c = s.world!.wrestlers[mine.id]!.contract!;
      c.weeklyRate = 100;
      c.weeksRemaining = 10;
      c.guaranteedPct = 0;
    });
    const rate = world().wrestlers[mine.id]!.contract!.weeklyRate;

    const verdict = useGameStore.getState().proposeTrade(mine.id, rival.id, theirs.id, 0);
    expect(verdict.accepted).toBe(true);

    // He is theirs now, on exactly the deal you were paying.
    expect(world().wrestlers[mine.id]!.promotionId).toBe(rival.id);
    expect(world().wrestlers[mine.id]!.contract!.weeklyRate).toBe(rate);
    expect(world().promotion.rosterIds).not.toContain(mine.id);
    expect(world().rivals.find((r) => r.id === rival.id)!.rosterIds).toContain(mine.id);

    // And the man coming back is yours.
    expect(world().wrestlers[theirs.id]!.promotionId).toBe(world().promotion.id);
    expect(world().promotion.rosterIds).toContain(theirs.id);
  });

  it('reports it, rather than the roster just changing', () => {
    const rival = world().rivals.find((r) => r.closedWeek === null)!;
    const mine = [...roster()].sort((a, b) => b.popularity - a.popularity)[0]!;
    useGameStore.getState().proposeTrade(mine.id, rival.id, null, 0);
    const said = world().weeklyNews.some((n) => n.text.includes(mine.name) && n.text.includes(rival.name));
    if (world().wrestlers[mine.id]!.promotionId === rival.id) expect(said).toBe(true);
  });

  it('will not take the same call twice in a row after a refusal', () => {
    const rival = world().rivals.find((r) => r.closedWeek === null)!;
    // Ask for their best in exchange for your worst: certain refusal.
    const worst = [...roster()].sort((a, b) => a.popularity - b.popularity)[0]!;
    const best = rival.rosterIds
      .map((id) => world().wrestlers[id]!)
      .sort((a, b) => b.popularity - a.popularity)[0]!;

    const first = useGameStore.getState().proposeTrade(worst.id, rival.id, best.id, 0);
    expect(first.accepted).toBe(false);
    expect(world().tradeRefusals[rival.id]).toBe(world().week);
  });

  it('refuses to trade somebody with a no-trade clause at any price', () => {
    const rival = world().rivals.find((r) => r.closedWeek === null)!;
    const mine = roster()[0]!;
    // Through the store, because the world is an immer draft and frozen
    // outside a set().
    useGameStore.setState((s) => {
      s.world!.wrestlers[mine.id]!.contract!.clauses.push('noTrade');
    });
    const verdict = useGameStore.getState().proposeTrade(mine.id, rival.id, null, 0);
    expect(verdict.accepted).toBe(false);
    expect(verdict.reason).toContain('no-trade');
    expect(world().promotion.rosterIds).toContain(mine.id);
  });

  it('takes the traded man off this week’s card', () => {
    const rival = world().rivals.find((r) => r.closedWeek === null)!;
    useGameStore.getState().autoFillCard();
    const booked = world()
      .currentCard.flatMap((seg) => seg.participants.map((p) => p.wrestlerId))
      .find((id) => world().wrestlers[id]?.promotionId === world().promotion.id)!;

    const verdict = useGameStore.getState().proposeTrade(booked, rival.id, null, 0);
    if (verdict.accepted) {
      const stillBooked = world().currentCard.some((seg) =>
        seg.participants.some((p) => p.wrestlerId === booked),
      );
      expect(stillBooked).toBe(false);
    }
  });
});

describe('the call on the weather', () => {
  // Forcing the roll is the only way to test a decision that fires roughly
  // every eighteen months. Everything after the roll is the real code path.
  function forceCall(): boolean {
    for (let i = 0; i < 400; i += 1) {
      useGameStore.getState().autoFillCard();
      useGameStore.getState().resolveWeek();
      if (useGameStore.getState().world?.pendingWeatherCall) return true;
      useGameStore.getState().dismissMandateOutcome();
      const w = useGameStore.getState().world!;
      if (w.folded || w.fired) useGameStore.getState().newGame({ ...freshSettings(), chaosLevel: 3, seed: `w${i}` });
    }
    return false;
  }

  it('holds the week open until the booker answers, and then resolves it', () => {
    useGameStore.getState().newGame({ ...freshSettings(), chaosLevel: 3, seed: 'weather-call' });
    expect(forceCall(), 'no severe forecast in 400 weeks').toBe(true);

    const call = useGameStore.getState().world!.pendingWeatherCall!;
    const showsBefore = useGameStore.getState().world!.showHistory.length;
    const weekBefore = useGameStore.getState().world!.week;

    // The week really is held: resolving again changes nothing.
    useGameStore.getState().resolveWeek();
    expect(useGameStore.getState().world!.week).toBe(weekBefore);
    expect(useGameStore.getState().world!.showHistory.length).toBe(showsBefore);
    expect(call.options).toHaveLength(3);
    expect(call.forecast).not.toMatch(/\d/);

    useGameStore.getState().answerWeatherCall('runIt');
    const after = useGameStore.getState().world!;
    expect(after.pendingWeatherCall).toBeNull();
    expect(after.weatherChoice).toBeNull();
    expect(after.week).toBe(weekBefore + 1);
    expect(after.showHistory.length).toBe(showsBefore + 1);
    // And it says what happened, in the paper, that week.
    expect(after.weeklyNews.some((n) => n.kind === 'weather' && n.weight === 'lead')).toBe(true);
  });

  it('calling it off means no show, and it still costs', () => {
    useGameStore.getState().newGame({ ...freshSettings(), chaosLevel: 3, seed: 'weather-off' });
    expect(forceCall()).toBe(true);
    const bankBefore = useGameStore.getState().world!.promotion.bankBalance;

    useGameStore.getState().answerWeatherCall('callItOff');
    const after = useGameStore.getState().world!;
    const show = after.showHistory[after.showHistory.length - 1]!;
    expect(show.attendance).toBe(0);
    expect(show.gate).toBe(0);
    // The building was booked and the crew was called. It is not free.
    expect(after.promotion.bankBalance).toBeLessThan(bankBefore);
  });
});
