import { describe, expect, it } from 'vitest';
import { rngFromSeed } from '../rng';
import { defaultWorldSettings } from './settings';
import { graduateClass } from './academy';
import { asWalkOn, rollKind, walkOnIntake, walkOnLine, type WalkOnKind } from './walkOns';
import { generateWrestler } from '../generate/wrestler';
import type { Wrestler } from '../types';

const settings = defaultWorldSettings();
const YEAR = 2030;

function raw(seed: string): Wrestler {
  return generateWrestler(rngFromSeed(seed), new Set(), { currentYear: YEAR });
}

/** Mean of a field across a batch. */
function mean(list: readonly Wrestler[], of: (w: Wrestler) => number): number {
  return list.reduce((sum, w) => sum + of(w), 0) / Math.max(1, list.length);
}

describe('the school has a door policy', () => {
  it('takes nobody over the cap, however late they came to it', () => {
    const { wrestlers } = graduateClass(rngFromSeed('class'), 40, YEAR, settings);
    for (const graduate of wrestlers) {
      expect(graduate.age).toBeLessThanOrEqual(settings.academyMaxAge);
      expect(graduate.age).toBeGreaterThanOrEqual(settings.academyDebutAgeMin);
    }
  });
});

describe('who walks in off the street', () => {
  it('is older than anybody the school would have taken', () => {
    const { wrestlers } = walkOnIntake(rngFromSeed('street'), 30, YEAR, settings);
    for (const person of wrestlers) {
      expect(person.age).toBeGreaterThan(settings.academyMaxAge);
      expect(person.age).toBeLessThanOrEqual(settings.walkOnMaxAge);
      expect(person.debutYear).toBe(YEAR);
      expect(person.contract).toBeNull();
      expect(person.record).toEqual({ wins: 0, losses: 0, draws: 0 });
    }
  });

  it('arrives rougher in the ring than a graduating class', () => {
    // The whole difference between the two doors: one has been taught.
    const school = graduateClass(rngFromSeed('a'), 40, YEAR, settings).wrestlers;
    const street = walkOnIntake(rngFromSeed('b'), 40, YEAR, settings).wrestlers;
    expect(mean(street, (w) => w.skill)).toBeLessThan(mean(school, (w) => w.skill));
    expect(mean(street, (w) => w.agility)).toBeLessThan(mean(school, (w) => w.agility));
  });

  it('is unknown even by the standards of a rookie', () => {
    const { wrestlers } = walkOnIntake(rngFromSeed('unknown'), 30, YEAR, settings);
    for (const person of wrestlers) expect(person.popularity).toBeLessThanOrEqual(20);
  });

  it('comes in as a free agent asking for a look rather than for money', () => {
    const { freeAgents } = walkOnIntake(rngFromSeed('cheap'), 10, YEAR, settings);
    expect(freeAgents).toHaveLength(10);
    for (const agent of freeAgents) {
      expect(agent.reason).toBe('walkOn');
      expect(agent.askingRate).toBe(settings.contractBaseWeeklyRate);
      expect(agent.weeksUnsigned).toBe(0);
    }
  });

  it('turns up in ones and twos rather than in a year group', () => {
    expect(walkOnIntake(rngFromSeed('none'), 0, YEAR, settings).wrestlers).toEqual([]);
  });
});

describe('most of them are rough, and some are not', () => {
  function batch(seed: string, size = 600) {
    const { wrestlers, kinds } = walkOnIntake(rngFromSeed(seed), size, YEAR, settings);
    const by = (kind: WalkOnKind) => wrestlers.filter((w) => kinds[w.id] === kind);
    return { wrestlers, by };
  }

  it('is mostly ordinary', () => {
    const { wrestlers, by } = batch('mix');
    expect(by('roughAndReady').length / wrestlers.length).toBeGreaterThan(0.7);
  });

  it('turns up a gem often enough to be worth looking', () => {
    const { wrestlers, by } = batch('gems');
    const share = by('gem').length / wrestlers.length;
    expect(share).toBeGreaterThan(0.03);
    expect(share).toBeLessThan(0.2);
  });

  it('makes a gem plainly better than the rest of the street', () => {
    const { by } = batch('gems');
    const gems = by('gem');
    const rest = by('roughAndReady');
    expect(mean(gems, (w) => w.talent)).toBeGreaterThan(mean(rest, (w) => w.talent) + 20);
    expect(mean(gems, (w) => w.skill)).toBeGreaterThan(mean(rest, (w) => w.skill));
    // And a ceiling worth two years of your time.
    expect(mean(gems, (w) => w.potentials.skill)).toBeGreaterThan(mean(rest, (w) => w.potentials.skill) + 15);
  });

  it('produces somebody who cannot go and can talk', () => {
    const { by } = batch('talkers');
    const talkers = by('naturalTalker');
    expect(talkers.length).toBeGreaterThan(0);
    // The mouth is the whole reason to sign them...
    expect(mean(talkers, (w) => w.charisma)).toBeGreaterThan(settings.walkOnTalkerCharismaFloor);
    // ...and there is no pretending about the rest.
    expect(mean(talkers, (w) => w.skill)).toBeLessThan(35);
  });

  it('leaves the ordinary walk-on without much of a ceiling', () => {
    // They came to it too late to become anything very different. That is the
    // gamble: a lower floor than the school, and a shorter runway too.
    const { by } = batch('ceiling');
    const rest = by('roughAndReady');
    expect(mean(rest, (w) => w.potentials.skill - w.skill)).toBeLessThan(15);
  });

  it('still lets an ordinary one be worth a spot on the card', () => {
    // Not every walk-on is a write-off — plenty make perfectly good low and
    // mid-card hands, which is the point of having the door at all.
    const { by } = batch('useful');
    const rest = by('roughAndReady');
    expect(rest.some((w) => w.charisma >= 60 || w.strength >= 65)).toBe(true);
  });
});

describe('the roll', () => {
  it('hits all three kinds and nothing else', () => {
    const seen = new Set<WalkOnKind>();
    for (let i = 0; i < 500; i++) seen.add(rollKind(rngFromSeed(`k-${i}`), settings));
    expect([...seen].sort()).toEqual(['gem', 'naturalTalker', 'roughAndReady']);
  });

  it('never produces a gem when the chance is off', () => {
    const off = { ...settings, walkOnGemChance: 0, walkOnTalkerChance: 0 };
    for (let i = 0; i < 200; i++) expect(rollKind(rngFromSeed(`o-${i}`), off)).toBe('roughAndReady');
  });
});

describe('saying it out loud', () => {
  it('says somebody turned up, and that nobody has trained them', () => {
    expect(walkOnLine(['Cass Dunmore'])).toContain('Cass Dunmore');
    expect(walkOnLine(['a', 'b', 'c'])).toContain('3 of them');
    expect(walkOnLine(['a'])).toContain('Never been trained');
    expect(walkOnLine(['a', 'b'])).toContain('None of them have ever been trained');
  });
});

describe('turning one person into a walk-on', () => {
  it('leaves what they were born with alone', () => {
    const person = raw('born');
    const walkOn = asWalkOn(rngFromSeed('w'), person, 'roughAndReady', YEAR, settings);
    // The frame and the face are not things a school gives you.
    expect(walkOn.strength).toBe(person.strength);
    expect(walkOn.heightIn).toBe(person.heightIn);
    expect(walkOn.gender).toBe(person.gender);
    expect(walkOn.appearance).toEqual(person.appearance);
  });

  it('knocks down the things a school would have taught', () => {
    const person = { ...raw('taught'), skill: 70, agility: 70, stamina: 70 };
    const walkOn = asWalkOn(rngFromSeed('w2'), person, 'roughAndReady', YEAR, settings);
    expect(walkOn.skill).toBeLessThan(person.skill);
    expect(walkOn.agility).toBeLessThan(person.agility);
    expect(walkOn.stamina).toBeLessThan(person.stamina);
  });
});
