import { describe, expect, it } from 'vitest';
import {
  eligibleForBreakfastBelt,
  pickTournamentEntrants,
  runBreakfastBeltTournament,
  breakfastBeltAnnouncementLine,
  breakfastBeltMockeryFadesLine,
  BREAKFAST_BELT_NAME,
} from './breakfastBelt';
import { generateWrestlers } from '../generate/wrestler';
import { defaultWorldSettings } from './settings';
import { rngFromSeed } from '../rng';
import type { Wrestler } from '../types';

const settings = defaultWorldSettings();

function roster(seed: string, count: number, overrides: Partial<Wrestler> = {}): Wrestler[] {
  return generateWrestlers(rngFromSeed(seed), count, { settings }).map((w, i) => ({
    ...w,
    id: `${seed}-${i}`,
    health: 100,
    role: 'wrestler',
    ...overrides,
  })) as Wrestler[];
}

describe('eligibleForBreakfastBelt', () => {
  it('never fires before the week gate', () => {
    expect(eligibleForBreakfastBelt(settings.breakfastBeltEarliestWeek - 1, false, settings)).toBe(false);
  });

  it('fires once the gate clears', () => {
    expect(eligibleForBreakfastBelt(settings.breakfastBeltEarliestWeek, false, settings)).toBe(true);
  });

  it('never fires a second time, however far past the gate', () => {
    expect(eligibleForBreakfastBelt(settings.breakfastBeltEarliestWeek + 500, true, settings)).toBe(false);
  });
});

describe('pickTournamentEntrants', () => {
  it('picks up to the configured entrant count from a bigger roster', () => {
    const wrestlers = roster('field', settings.breakfastBeltEntrantCount + 10);
    const entrants = pickTournamentEntrants(rngFromSeed('pick'), wrestlers, settings);
    expect(entrants).toHaveLength(settings.breakfastBeltEntrantCount);
    expect(new Set(entrants).size).toBe(entrants.length);
    for (const id of entrants) expect(wrestlers.some((w) => w.id === id)).toBe(true);
  });

  it('returns everybody eligible when the roster has fewer than the configured count', () => {
    const wrestlers = roster('small', 3);
    const entrants = pickTournamentEntrants(rngFromSeed('pick'), wrestlers, settings);
    expect(entrants).toHaveLength(3);
  });

  it('excludes anybody who cannot work — injured, frozen, or not a wrestler', () => {
    const hurt = roster('hurt', 2, {
      injury: {
        severity: 'moderate',
        grade: 50,
        description: 'test',
        sufferedWeek: 1,
        totalWeeks: 4,
        weeksRemaining: 4,
        permanentStatLoss: {},
        earlyReturnWeeksUsed: 0,
      },
    });
    const frozen = roster('frozen', 2, { paperworkFrozen: true });
    const referee = roster('ref', 2, { role: 'referee' });
    const fine = roster('fine', 2);
    const wrestlers = [...hurt, ...frozen, ...referee, ...fine];
    const entrants = pickTournamentEntrants(rngFromSeed('pick'), wrestlers, settings);
    const fineIds = new Set(fine.map((w) => w.id));
    for (const id of entrants) expect(fineIds.has(id)).toBe(true);
  });
});

describe('runBreakfastBeltTournament', () => {
  it('returns null with fewer than two entrants', () => {
    const wrestlers = roster('one', 1);
    const byId = new Map(wrestlers.map((w) => [w.id, w]));
    const result = runBreakfastBeltTournament(rngFromSeed('run'), [wrestlers[0]!.id], byId, settings, 50);
    expect(result).toBeNull();
  });

  it('always crowns a real entrant', () => {
    for (let i = 0; i < 10; i++) {
      const wrestlers = roster(`crown-${i}`, 8);
      const byId = new Map(wrestlers.map((w) => [w.id, w]));
      const entrantIds = wrestlers.map((w) => w.id);
      const result = runBreakfastBeltTournament(rngFromSeed(`run-${i}`), entrantIds, byId, settings, 50);
      expect(result).not.toBeNull();
      expect(entrantIds).toContain(result!.winnerId);
      expect(result!.bouts.length).toBeGreaterThan(0);
    }
  });

  it('charges wornOut only to people who worked more than once, and never charges the untouched', () => {
    const wrestlers = roster('worn', 8);
    const byId = new Map(wrestlers.map((w) => [w.id, w]));
    const entrantIds = wrestlers.map((w) => w.id);
    const result = runBreakfastBeltTournament(rngFromSeed('worn'), entrantIds, byId, settings, 50)!;
    const worked = new Map<string, number>();
    for (const bout of result.bouts) {
      worked.set(bout.aId, (worked.get(bout.aId) ?? 0) + 1);
      worked.set(bout.bId, (worked.get(bout.bId) ?? 0) + 1);
    }
    const worn = new Map(result.wornOut.map((w) => [w.wrestlerId, w.cost]));
    for (const [id, cost] of worn) {
      expect(cost).toBeGreaterThan(0);
      expect(worked.get(id) ?? 0).toBeGreaterThan(1);
    }
    for (const [id, count] of worked) {
      if (count <= 1) expect(worn.get(id) ?? 0).toBe(0);
    }
  });

  it('leaves the entrants it was handed unmodified — fatigue only ever touches a copy', () => {
    const wrestlers = roster('untouched', 8);
    const byId = new Map(wrestlers.map((w) => [w.id, w]));
    const entrantIds = wrestlers.map((w) => w.id);
    const before = wrestlers.map((w) => w.health);
    runBreakfastBeltTournament(rngFromSeed('untouched'), entrantIds, byId, settings, 50);
    expect(wrestlers.map((w) => w.health)).toEqual(before);
  });
});

describe('the wire lines', () => {
  it('say something real and name the belt and the people given', () => {
    const announcement = breakfastBeltAnnouncementLine('Southside Wrestling', 'Casey Vale');
    expect(announcement.length).toBeGreaterThan(20);
    expect(announcement).toContain('Southside Wrestling');
    expect(announcement).toContain('Casey Vale');
    expect(announcement).toContain(BREAKFAST_BELT_NAME);
    expect(breakfastBeltMockeryFadesLine().length).toBeGreaterThan(10);
  });
});
