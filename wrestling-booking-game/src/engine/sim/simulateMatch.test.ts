import { describe, expect, it } from 'vitest';
import { mulberry32, rngFromSeed } from '../rng';
import { generateWrestler } from '../generate/wrestler';
import { defaultWorldSettings } from '../world/settings';
import { simulateMatch, type SimParticipant, type SimulateMatchContext } from './simulateMatch';
import type { MatchRules, Stipulation, Wrestler } from '../types';

function stipWith(overrides: Partial<Stipulation> = {}): Stipulation {
  return {
    id: 'test-stip',
    name: 'Test Stipulation',
    ratingBonus: 0,
    violenceLevel: 0,
    injuryMult: 1,
    archetypeFit: [],
    ...overrides,
  };
}

function baseRules(overrides: Partial<MatchRules> = {}): MatchRules {
  return {
    preset: 'singles',
    format: 'individuals',
    ruleStrictness: 'lenient',
    aim: 'firstFall',
    falls: 'pinsAndSubs',
    timeLimit: 15,
    stoppage: 'referee',
    countOuts: 'normal',
    reward: 'none',
    pace: 'standard',
    ...overrides,
  };
}

function baseContext(overrides: Partial<SimulateMatchContext> = {}): SimulateMatchContext {
  return {
    rules: baseRules(),
    stipulation: null,
    requirementsMet: true,
    isPPV: false,
    matchLengthMinutes: 12,
    settings: defaultWorldSettings(),
    ...overrides,
  };
}

function makeRoster(seed: number, count: number): Wrestler[] {
  const rng = mulberry32(seed);
  const names = new Set<string>();
  return Array.from({ length: count }, () => generateWrestler(rng, names));
}

describe('simulateMatch', () => {
  it('is deterministic for a given seed', () => {
    const roster = makeRoster(1, 2);
    const byId = new Map(roster.map((w) => [w.id, w]));
    const participants: SimParticipant[] = [
      { wrestlerId: roster[0]!.id, side: 0 },
      { wrestlerId: roster[1]!.id, side: 1 },
    ];

    const a = simulateMatch(rngFromSeed('match-seed'), participants, byId, baseContext());
    const b = simulateMatch(rngFromSeed('match-seed'), participants, byId, baseContext());
    expect(a.rating).toBe(b.rating);
    expect(a.winnerSide).toBe(b.winnerSide);
    expect(a.finish).toBe(b.finish);
  });

  it('the winner is always one of the two sides, or null on a draw finish', () => {
    const roster = makeRoster(2, 2);
    const byId = new Map(roster.map((w) => [w.id, w]));
    const participants: SimParticipant[] = [
      { wrestlerId: roster[0]!.id, side: 0 },
      { wrestlerId: roster[1]!.id, side: 1 },
    ];

    const rng = mulberry32(99);
    for (let i = 0; i < 100; i++) {
      const result = simulateMatch(rng, participants, byId, baseContext());
      if (result.winnerSide === null) {
        expect(['timeLimitDraw', 'doubleKO']).toContain(result.finish);
        expect(result.winnerWrestlerIds).toHaveLength(0);
      } else {
        expect([0, 1]).toContain(result.winnerSide);
        expect(result.winnerWrestlerIds).toEqual([byId.get(participants[result.winnerSide]!.wrestlerId)!.id]);
      }
    }
  });

  it('supports multi-man matches (more than two sides)', () => {
    const roster = makeRoster(3, 4);
    const byId = new Map(roster.map((w) => [w.id, w]));
    const participants: SimParticipant[] = roster.map((w, i) => ({ wrestlerId: w.id, side: i }));

    const result = simulateMatch(rngFromSeed('multi-man'), participants, byId, baseContext({ rules: baseRules({ preset: 'fatal4' }) }));
    expect(result.winProbabilitiesBySide).toBeDefined();
    expect(Object.keys(result.winProbabilitiesBySide)).toHaveLength(4);
    if (result.winnerSide !== null) {
      expect([0, 1, 2, 3]).toContain(result.winnerSide);
    }
  });

  it('an overwhelmingly stronger side wins far more often than not', () => {
    const rng = mulberry32(4);
    const names = new Set<string>();
    const strong = { ...generateWrestler(rng, names), popularity: 99, skill: 99, strength: 99, agility: 99, stamina: 99, health: 100, momentum: 100, age: 28 };
    const weak = { ...generateWrestler(rng, names), popularity: 5, skill: 5, strength: 5, agility: 5, stamina: 5, health: 100, momentum: 50, age: 28 };
    const byId = new Map([[strong.id, strong], [weak.id, weak]]);
    const participants: SimParticipant[] = [
      { wrestlerId: strong.id, side: 0 },
      { wrestlerId: weak.id, side: 1 },
    ];

    const simRng = mulberry32(777);
    let strongWins = 0;
    let total = 0;
    for (let i = 0; i < 200; i++) {
      const result = simulateMatch(simRng, participants, byId, baseContext());
      if (result.winnerSide === 0) strongWins++;
      if (result.winnerSide !== null) total++;
    }
    expect(strongWins / total).toBeGreaterThan(0.8);
  });

  it('always produces at least an opening and a finish beat', () => {
    const roster = makeRoster(5, 2);
    const byId = new Map(roster.map((w) => [w.id, w]));
    const participants: SimParticipant[] = [
      { wrestlerId: roster[0]!.id, side: 0 },
      { wrestlerId: roster[1]!.id, side: 1 },
    ];
    const result = simulateMatch(rngFromSeed('beats-check'), participants, byId, baseContext());
    expect(result.beats.length).toBeGreaterThanOrEqual(2);
    expect(result.beats[0]!.kind).toBe('openingExchange');
    expect(result.beats[result.beats.length - 1]!.kind).toBe('finish');
  });

  it('a better ring cuts the injury multiplier for real — the field this test locks in', () => {
    // See engine/economy/production.ts's equipmentSafetyEffects: this is the
    // consumer that field never had before.
    const roster = makeRoster(6, 2);
    const byId = new Map(roster.map((w) => [w.id, w]));
    const participants: SimParticipant[] = [
      { wrestlerId: roster[0]!.id, side: 0 },
      { wrestlerId: roster[1]!.id, side: 1 },
    ];
    const bareRing = simulateMatch(
      rngFromSeed('equip-seed'),
      participants,
      byId,
      baseContext({ equipmentInjuryReduction: 0 }),
    );
    const goodRing = simulateMatch(
      rngFromSeed('equip-seed'),
      participants,
      byId,
      baseContext({ equipmentInjuryReduction: 0.5 }),
    );
    expect(goodRing.injuryMultiplier).toBeCloseTo(bareRing.injuryMultiplier * 0.5, 5);
  });

  it('omitting equipmentInjuryReduction behaves exactly like passing 0', () => {
    const roster = makeRoster(7, 2);
    const byId = new Map(roster.map((w) => [w.id, w]));
    const participants: SimParticipant[] = [
      { wrestlerId: roster[0]!.id, side: 0 },
      { wrestlerId: roster[1]!.id, side: 1 },
    ];
    const omitted = simulateMatch(rngFromSeed('omit-seed'), participants, byId, baseContext());
    const explicitZero = simulateMatch(
      rngFromSeed('omit-seed'),
      participants,
      byId,
      baseContext({ equipmentInjuryReduction: 0 }),
    );
    expect(omitted.injuryMultiplier).toBe(explicitZero.injuryMultiplier);
  });

  it('a hardware-sensitive stipulation is riskier than an identical one that is not, on bare gear', () => {
    // Ladder, cage, and tables matches lean on real hardware the rest of the
    // card doesn't — see data/stipulations.ts's hardwareGearSensitive.
    const roster = makeRoster(8, 2);
    const byId = new Map(roster.map((w) => [w.id, w]));
    const participants: SimParticipant[] = [
      { wrestlerId: roster[0]!.id, side: 0 },
      { wrestlerId: roster[1]!.id, side: 1 },
    ];
    const settings = defaultWorldSettings();
    const plain = simulateMatch(
      rngFromSeed('hardware-seed'),
      participants,
      byId,
      baseContext({ stipulation: stipWith(), equipmentInjuryReduction: 0 }),
    );
    const hardware = simulateMatch(
      rngFromSeed('hardware-seed'),
      participants,
      byId,
      baseContext({ stipulation: stipWith({ hardwareGearSensitive: true }), equipmentInjuryReduction: 0 }),
    );
    expect(hardware.injuryMultiplier).toBeCloseTo(plain.injuryMultiplier * (1 + settings.hardwareGearRiskAtWorst), 5);
  });

  it('better equipment shrinks that extra hardware risk, but never erases it', () => {
    const roster = makeRoster(9, 2);
    const byId = new Map(roster.map((w) => [w.id, w]));
    const participants: SimParticipant[] = [
      { wrestlerId: roster[0]!.id, side: 0 },
      { wrestlerId: roster[1]!.id, side: 1 },
    ];
    const bare = simulateMatch(
      rngFromSeed('hardware-equip-seed'),
      participants,
      byId,
      baseContext({ stipulation: stipWith({ hardwareGearSensitive: true }), equipmentInjuryReduction: 0 }),
    );
    const equipped = simulateMatch(
      rngFromSeed('hardware-equip-seed'),
      participants,
      byId,
      baseContext({ stipulation: stipWith({ hardwareGearSensitive: true }), equipmentInjuryReduction: 0.5 }),
    );
    expect(equipped.injuryMultiplier).toBeLessThan(bare.injuryMultiplier);
    expect(equipped.injuryMultiplier).toBeGreaterThan(0);
  });

  it('never fires the entrance pyro unless the show actually fired it', () => {
    const roster = makeRoster(10, 2);
    const byId = new Map(roster.map((w) => [w.id, w]));
    const participants: SimParticipant[] = [
      { wrestlerId: roster[0]!.id, side: 0 },
      { wrestlerId: roster[1]!.id, side: 1 },
    ];
    for (let i = 0; i < 300; i++) {
      const result = simulateMatch(
        rngFromSeed(`no-pyro-${i}`),
        participants,
        byId,
        baseContext({ pyroActive: false }),
      );
      expect(result.beats.some((b) => b.kind === 'pyroBurn')).toBe(false);
    }
    // Omitting it entirely behaves the same as explicitly false.
    const omitted = simulateMatch(rngFromSeed('pyro-omitted'), participants, byId, baseContext());
    expect(omitted.beats.some((b) => b.kind === 'pyroBurn')).toBe(false);
  });

  it('can fire the entrance pyro when the show fired it, and names who it caught', () => {
    const roster = makeRoster(11, 2);
    const byId = new Map(roster.map((w) => [w.id, w]));
    const participants: SimParticipant[] = [
      { wrestlerId: roster[0]!.id, side: 0 },
      { wrestlerId: roster[1]!.id, side: 1 },
    ];
    const beat = Array.from({ length: 2000 }, (_, i) =>
      simulateMatch(
        rngFromSeed(`pyro-${i}`),
        participants,
        byId,
        baseContext({ pyroActive: true, equipmentInjuryReduction: 0 }),
      ),
    )
      .flatMap((r) => r.beats)
      .find((b) => b.kind === 'pyroBurn');
    expect(beat).toBeTruthy();
    expect(beat!.text.length).toBeGreaterThan(15);
  });

  // Match hardware — a ladder, a cage, a table — with its own tracked
  // condition, distinct from the general ring/mat proxy above. See
  // engine/economy/matchProps.ts and gearFailure.ts.
  it('a worn specific unit is measurably riskier than a fresh one, mirroring the general-equipment pattern', () => {
    const roster = makeRoster(12, 2);
    const byId = new Map(roster.map((w) => [w.id, w]));
    const participants: SimParticipant[] = [
      { wrestlerId: roster[0]!.id, side: 0 },
      { wrestlerId: roster[1]!.id, side: 1 },
    ];
    const hardwareStip = stipWith({ hardwareGearSensitive: true });
    const freshGear = simulateMatch(
      rngFromSeed('gear-unit-seed'),
      participants,
      byId,
      baseContext({ stipulation: hardwareStip, equipmentInjuryReduction: 0, gearUnitRisk: 0 }),
    );
    const wornGear = simulateMatch(
      rngFromSeed('gear-unit-seed'),
      participants,
      byId,
      baseContext({ stipulation: hardwareStip, equipmentInjuryReduction: 0, gearUnitRisk: 1 }),
    );
    expect(wornGear.injuryMultiplier).toBeGreaterThan(freshGear.injuryMultiplier);
  });

  it('the gap from worn specific gear shrinks toward better condition, but never vanishes', () => {
    const roster = makeRoster(13, 2);
    const byId = new Map(roster.map((w) => [w.id, w]));
    const participants: SimParticipant[] = [
      { wrestlerId: roster[0]!.id, side: 0 },
      { wrestlerId: roster[1]!.id, side: 1 },
    ];
    const hardwareStip = stipWith({ hardwareGearSensitive: true });
    const worst = simulateMatch(
      rngFromSeed('gear-gap-seed'),
      participants,
      byId,
      baseContext({ stipulation: hardwareStip, equipmentInjuryReduction: 0, gearUnitRisk: 1 }),
    );
    const mid = simulateMatch(
      rngFromSeed('gear-gap-seed'),
      participants,
      byId,
      baseContext({ stipulation: hardwareStip, equipmentInjuryReduction: 0, gearUnitRisk: 0.5 }),
    );
    const best = simulateMatch(
      rngFromSeed('gear-gap-seed'),
      participants,
      byId,
      baseContext({ stipulation: hardwareStip, equipmentInjuryReduction: 0, gearUnitRisk: 0 }),
    );
    expect(mid.injuryMultiplier).toBeLessThan(worst.injuryMultiplier);
    expect(best.injuryMultiplier).toBeLessThan(mid.injuryMultiplier);
    // Never fully switched off, same as the general-equipment case above.
    expect(best.injuryMultiplier).toBeGreaterThan(0);
  });

  it('the specific unit term moves the number even when the general ring is excellent — it is not just the same proxy twice', () => {
    const roster = makeRoster(14, 2);
    const byId = new Map(roster.map((w) => [w.id, w]));
    const participants: SimParticipant[] = [
      { wrestlerId: roster[0]!.id, side: 0 },
      { wrestlerId: roster[1]!.id, side: 1 },
    ];
    const hardwareStip = stipWith({ hardwareGearSensitive: true });
    // A great ring (equipmentInjuryReduction 0.9) would predict very low
    // risk if gearUnitRisk just fell back to it — but the actual ladder
    // assigned tonight is worn out, and that is what should win out.
    const greatRingWornLadder = simulateMatch(
      rngFromSeed('specific-unit-seed'),
      participants,
      byId,
      baseContext({ stipulation: hardwareStip, equipmentInjuryReduction: 0.9, gearUnitRisk: 0.9 }),
    );
    const greatRingNoSpecificUnit = simulateMatch(
      rngFromSeed('specific-unit-seed'),
      participants,
      byId,
      baseContext({ stipulation: hardwareStip, equipmentInjuryReduction: 0.9 }),
    );
    expect(greatRingWornLadder.injuryMultiplier).toBeGreaterThan(greatRingNoSpecificUnit.injuryMultiplier);
  });

  it('never fires equipmentFailure without a gear family on the stipulation, however high the break chance', () => {
    const roster = makeRoster(15, 2);
    const byId = new Map(roster.map((w) => [w.id, w]));
    const participants: SimParticipant[] = [
      { wrestlerId: roster[0]!.id, side: 0 },
      { wrestlerId: roster[1]!.id, side: 1 },
    ];
    for (let i = 0; i < 300; i++) {
      const result = simulateMatch(
        rngFromSeed(`no-gear-family-${i}`),
        participants,
        byId,
        baseContext({ stipulation: stipWith({ hardwareGearSensitive: true }), gearFailureChance: 1 }),
      );
      expect(result.finish).not.toBe('equipmentFailure');
    }
  });

  it('reaches equipmentFailure when a gear family is on the line and the break chance is high, and names the unit that gave out', () => {
    const roster = makeRoster(16, 2);
    const byId = new Map(roster.map((w) => [w.id, w]));
    const participants: SimParticipant[] = [
      { wrestlerId: roster[0]!.id, side: 0 },
      { wrestlerId: roster[1]!.id, side: 1 },
    ];
    const results = Array.from({ length: 500 }, (_, i) =>
      simulateMatch(
        rngFromSeed(`gear-family-${i}`),
        participants,
        byId,
        baseContext({
          stipulation: stipWith({ hardwareGearSensitive: true, gearFamilyId: 'ladder' }),
          gearFailureChance: 1,
          gearUnitsInPlay: [{ id: 'ladder-unit-1', name: 'Wooden Ladder', condition: 5 }],
        }),
      ),
    );
    const failed = results.find((r) => r.finish === 'equipmentFailure');
    expect(failed).toBeTruthy();
    expect(failed!.winnerSide).toBeNull();
    expect(failed!.gearFailureUnitId).toBe('ladder-unit-1');
  });
});
