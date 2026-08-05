import { describe, expect, it, beforeEach } from 'vitest';
import { useGameStore } from './store';
import { defaultWorldSettings } from '../engine/world/settings';

function freshSettings() {
  return { ...defaultWorldSettings(), seed: 'store-test', startingRosterSize: 12 };
}

beforeEach(() => {
  useGameStore.getState().newGame(freshSettings());
});

describe('newGame', () => {
  it('creates a world with the requested roster size, starting cash, and week 1', () => {
    const { world } = useGameStore.getState();
    expect(world).not.toBeNull();
    // `wrestlers` is the whole population of the business — your roster, every
    // rival's, and everyone unsigned — so the roster is checked on the
    // promotion itself, and the population against all three.
    expect(world!.promotion.rosterIds).toHaveLength(12);
    const rivalRosters = world!.rivals.reduce((sum, r) => sum + r.rosterIds.length, 0);
    expect(rivalRosters).toBeGreaterThan(0);
    expect(Object.keys(world!.wrestlers)).toHaveLength(12 + freshSettings().freeAgentPoolSize + rivalRosters);
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
    const store = useGameStore.getState();
    // The worst room in the game at a giveaway price, week after week.
    store.setVenue('schoolGym');
    store.setTicketPrice(1);

    for (let i = 0; i < 40 && !useGameStore.getState().world!.folded; i++) {
      useGameStore.getState().autoFillCard();
      useGameStore.getState().resolveWeek();
    }

    const world = useGameStore.getState().world!;
    expect(world.folded).not.toBeNull();
    expect(world.weeksInTheRed).toBeGreaterThan(world.settings.bankruptcyGraceWeeks);
    expect(world.promotion.rosterIds).toHaveLength(0);
    // Everybody who was under contract is loose in the business, not deleted.
    expect(world.freeAgents.length).toBeGreaterThan(world.settings.freeAgentPoolSize);
  });

  it('will not run another show once it has folded', () => {
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
