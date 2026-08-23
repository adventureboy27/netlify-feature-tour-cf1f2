import { describe, expect, it } from 'vitest';
import { mulberry32, rngFromSeed } from '../engine/rng';
import { generateWrestler } from '../engine/generate/wrestler';
import {
  STIPULATIONS,
  stipulationById,
  stipulationRequirementsMet,
  stipulationConsequence,
  stipulationConsequenceLine,
} from './stipulations';

describe('STIPULATIONS', () => {
  it('every entry has a unique id', () => {
    const ids = STIPULATIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('stipulationById finds every entry by its own id', () => {
    for (const s of STIPULATIONS) {
      expect(stipulationById(s.id)).toBe(s);
    }
  });

  it('every gimmick match (everything but squash) has its own finish text', () => {
    for (const s of STIPULATIONS) {
      if (s.id === 'squash') continue;
      expect(s.finishFlavor, `${s.id} has no finishFlavor`).toBeTruthy();
      expect(Object.keys(s.finishFlavor ?? {}).length).toBeGreaterThan(0);
    }
  });
});

describe('stipulationConsequence', () => {
  it('only the three blowoff stipulations with a real stake carry one', () => {
    expect(stipulationConsequence('hairVsHair')).toBe('shaveHead');
    expect(stipulationConsequence('maskVsMask')).toBe('unmask');
    expect(stipulationConsequence('loserLeaves')).toBe('release');
  });

  it('every other stipulation, including the other two blowoffs, carries none', () => {
    for (const s of STIPULATIONS) {
      if (['hairVsHair', 'maskVsMask', 'loserLeaves'].includes(s.id)) continue;
      expect(stipulationConsequence(s.id)).toBeNull();
    }
    expect(stipulationConsequence(null)).toBeNull();
  });
});

describe('stipulationConsequenceLine', () => {
  it('never leaves a placeholder behind, and names the loser', () => {
    for (const consequence of ['shaveHead', 'unmask', 'release'] as const) {
      const line = stipulationConsequenceLine(consequence, rngFromSeed(`test-${consequence}`), 'Danny Cruz');
      expect(line).toContain('Danny Cruz');
      expect(line).not.toMatch(/\{[a-z]+\}/i);
    }
  });

  it('has more than one way to say it', () => {
    for (const consequence of ['shaveHead', 'unmask', 'release'] as const) {
      const texts = new Set<string>();
      for (let i = 0; i < 20; i++) {
        texts.add(stipulationConsequenceLine(consequence, rngFromSeed(`variety-${consequence}-${i}`), 'X'));
      }
      expect(texts.size).toBeGreaterThan(1);
    }
  });
});

describe('stipulationRequirementsMet', () => {
  const rng = mulberry32(1);
  const names = new Set<string>();
  const low = { ...generateWrestler(rng, names), skill: 20, stamina: 20, agility: 20, popularity: 20 };
  const high = { ...generateWrestler(rng, names), skill: 90, stamina: 90, agility: 90, popularity: 90 };

  it('fails a heat-gated stipulation when heat is too low', () => {
    const steelCage = stipulationById('steelCage')!;
    expect(stipulationRequirementsMet(steelCage, { participants: [low, high], rivalryHeat: 10, matchTimeLimitMinutes: 15 })).toBe(false);
    expect(stipulationRequirementsMet(steelCage, { participants: [low, high], rivalryHeat: 50, matchTimeLimitMinutes: 15 })).toBe(true);
  });

  it('fails a stat-gated stipulation when the average is too low', () => {
    const ladder = stipulationById('ladder')!;
    expect(stipulationRequirementsMet(ladder, { participants: [low, low], rivalryHeat: 0, matchTimeLimitMinutes: 15 })).toBe(false);
    expect(stipulationRequirementsMet(ladder, { participants: [high, high], rivalryHeat: 0, matchTimeLimitMinutes: 15 })).toBe(true);
  });

  it('iron man additionally requires a 30+ minute time limit', () => {
    const ironMan = stipulationById('ironMan')!;
    expect(stipulationRequirementsMet(ironMan, { participants: [high, high], rivalryHeat: 0, matchTimeLimitMinutes: 15 })).toBe(false);
    expect(stipulationRequirementsMet(ironMan, { participants: [high, high], rivalryHeat: 0, matchTimeLimitMinutes: 30 })).toBe(true);
  });

  it('battle royal requires at least 8 participants', () => {
    const battleRoyal = stipulationById('battleRoyal')!;
    const few = Array.from({ length: 4 }, () => high);
    const many = Array.from({ length: 8 }, () => high);
    expect(stipulationRequirementsMet(battleRoyal, { participants: few, rivalryHeat: 0, matchTimeLimitMinutes: 15 })).toBe(false);
    expect(stipulationRequirementsMet(battleRoyal, { participants: many, rivalryHeat: 0, matchTimeLimitMinutes: 15 })).toBe(true);
  });

  it('squash requires a wide popularity gap', () => {
    const squash = stipulationById('squash')!;
    expect(stipulationRequirementsMet(squash, { participants: [high, { ...high, popularity: 85 }], rivalryHeat: 0, matchTimeLimitMinutes: 15 })).toBe(false);
    expect(stipulationRequirementsMet(squash, { participants: [high, low], rivalryHeat: 0, matchTimeLimitMinutes: 15 })).toBe(true);
  });
});
