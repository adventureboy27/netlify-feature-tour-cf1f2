import { describe, it, expect } from 'vitest';
import { workingPopulation, graduateCount, graduateClass } from './academy';
import { defaultWorldSettings } from '../world/settings';
import { rngFromSeed } from '../rng';
import { generateWrestlers } from '../generate/wrestler';
import type { Wrestler } from '../types';

const settings = defaultWorldSettings();

function population(count: number, overrides: Partial<Wrestler> = {}): Wrestler[] {
  return generateWrestlers(rngFromSeed('academy'), count, { currentYear: 2000 }).map((w) => ({ ...w, ...overrides }));
}

describe('who counts as working', () => {
  it('leaves out the retired and the dead', () => {
    const people = [
      ...population(5),
      ...population(3, { careerStatus: 'retired' }),
      ...population(2, { deceased: { wrestlerId: 'x', cause: 'age', age: 80, week: 1 } }),
    ];
    expect(workingPopulation(people)).toBe(5);
  });
});

describe('the intake', () => {
  it('shuts the doors when the business is full', () => {
    const rng = rngFromSeed('full');
    for (let i = 0; i < 20; i++) {
      expect(graduateCount(rng, settings.worldPopulationMax + 5, settings)).toBe(0);
    }
  });

  it('opens them when it is short', () => {
    const rng = rngFromSeed('short');
    const counts = Array.from({ length: 10 }, () => graduateCount(rng, settings.worldPopulationMin - 8, settings));
    expect(counts.every((c) => c > 0)).toBe(true);
    expect(Math.max(...counts)).toBeLessThanOrEqual(settings.academyMaxGraduates);
  });

  it('lets the population wander rather than pinning it', () => {
    const rng = rngFromSeed('middle');
    const inside = Math.round((settings.worldPopulationMin + settings.worldPopulationMax) / 2);
    const counts = Array.from({ length: 30 }, () => graduateCount(rng, inside, settings));
    expect(counts.some((c) => c === 0)).toBe(true);
    expect(counts.some((c) => c > 0)).toBe(true);
  });
});

describe('a graduating class', () => {
  /** No phenom, so the ordinary case is testable on its own. */
  const ordinary = { ...settings, biddingPhenomChancePerClass: 0 };

  it('comes out young, unsigned and with no record', () => {
    const { wrestlers, freeAgents } = graduateClass(rngFromSeed('class'), 3, 2000, ordinary);
    expect(wrestlers).toHaveLength(3);
    expect(freeAgents).toHaveLength(3);
    for (const w of wrestlers) {
      expect(w.age).toBeGreaterThanOrEqual(settings.academyDebutAgeMin);
      expect(w.age).toBeLessThanOrEqual(settings.academyDebutAgeMax);
      expect(w.debutYear).toBe(2000);
      expect(w.careerStatus).toBe('rookie');
      expect(w.contract).toBeNull();
      expect(w.titleReigns).toHaveLength(0);
      expect(w.record).toEqual({ wins: 0, losses: 0, draws: 0 });
    }
    expect(freeAgents.every((a) => a.reason === 'schoolGraduate')).toBe(true);
  });

  it('produces nothing when nobody graduates', () => {
    const empty = graduateClass(rngFromSeed('none'), 0, 2000, settings);
    expect(empty.wrestlers).toHaveLength(0);
    expect(empty.phenomId).toBeNull();
  });

  it('leaves the schools unknown — a graduate is a project, not a signing', () => {
    const { wrestlers } = graduateClass(rngFromSeed('unknown'), 8, 2000, ordinary);
    // The generator rolls popularity for somebody mid-career. Before this was
    // scaled down a school leaver could come out at 82 — as over as the world
    // champion, having never had a match.
    for (const w of wrestlers) expect(w.popularity).toBeLessThan(20);
  });
});

describe('the phenom', () => {
  /** Certainty, so the one-in-a-long-while case is testable at all. */
  const certain = { ...settings, biddingPhenomChancePerClass: 1 };

  it('never turns up in an ordinary class', () => {
    const never = { ...settings, biddingPhenomChancePerClass: 0 };
    for (let i = 0; i < 20; i++) {
      expect(graduateClass(rngFromSeed(`plain-${i}`), 6, 2000, never).phenomId).toBeNull();
    }
  });

  it('comes out able to work, and young enough for that to be the story', () => {
    const { wrestlers, phenomId } = graduateClass(rngFromSeed('gift'), 6, 2000, certain);
    const phenom = wrestlers.find((w) => w.id === phenomId)!;
    expect(phenom).toBeDefined();
    expect(phenom.skill).toBeGreaterThanOrEqual(settings.biddingPhenomStatFloor);
    expect(phenom.agility).toBeGreaterThanOrEqual(settings.biddingPhenomStatFloor);
    expect(phenom.talent).toBeGreaterThanOrEqual(settings.biddingPhenomTalentFloor);
    expect(phenom.age).toBeLessThanOrEqual(settings.academyDebutAgeMin + 2);
    // And a ceiling worth chasing — growth follows talent everywhere else in
    // the game, so a phenom on a graduate's growth rate would stall by 25.
    expect(phenom.growthRate).toBeGreaterThan(1.4);
    expect(phenom.potentials.skill).toBeGreaterThanOrEqual(90);
  });

  it('is famous for nothing yet — the buzz is about what they can do', () => {
    const { wrestlers, phenomId } = graduateClass(rngFromSeed('buzz'), 6, 2000, certain);
    const phenom = wrestlers.find((w) => w.id === phenomId)!;
    // Well above the rest of the class, nowhere near a drawing card. Nobody
    // has seen them wrestle; they have heard.
    expect(phenom.popularity).toBe(settings.biddingPhenomPopularity);
    expect(phenom.record).toEqual({ wins: 0, losses: 0, draws: 0 });
  });

  it('is only ever one of them', () => {
    const { wrestlers, phenomId } = graduateClass(rngFromSeed('one'), 10, 2000, certain);
    const gifted = wrestlers.filter((w) => w.talent >= settings.biddingPhenomTalentFloor && w.age <= 21);
    expect(gifted.map((w) => w.id)).toContain(phenomId);
    expect(gifted).toHaveLength(1);
  });

  it('cannot appear at all when the bidding war is switched off', () => {
    const off = { ...certain, biddingEnabled: false };
    expect(graduateClass(rngFromSeed('off'), 6, 2000, off).phenomId).toBeNull();
  });
});
