import { describe, it, expect } from 'vitest';
import {
  responseOutcome,
  responseIsAvailable,
  resolveOffer,
  tamperingRisk,
  attemptPlayerTampering,
  sanctionFor,
  type PoachingOffer,
} from './poaching';
import { defaultWorldSettings } from '../world/settings';
import { createStandardContract } from '../economy/contracts';
import { generateWrestler } from '../generate/wrestler';
import { rngFromSeed } from '../rng';
import type { Wrestler } from '../types';

const settings = defaultWorldSettings();

function w(over: Partial<Wrestler> = {}): Wrestler {
  const base = generateWrestler(rngFromSeed('p'), new Set());
  return { ...base, contract: createStandardContract(base, settings, 2000), ...over };
}

const offer = (over: Partial<PoachingOffer> = {}): PoachingOffer => ({
  id: 'o1',
  wrestlerId: 'x',
  rivalPromotionId: 'r1',
  kind: 'tampering',
  offerPremium: 500,
  temptation: 0.7,
  openedWeek: 5,
  resolvesWeek: 6,
  status: 'open',
  ...over,
});

describe('you always get to answer first', () => {
  it('opens an offer rather than taking the wrestler', () => {
    const o = offer();
    expect(o.status).toBe('open');
    expect(o.resolvesWeek).toBeGreaterThan(o.openedWeek);
  });

  it('gives every response a real cost', () => {
    for (const kind of ['matchMoney', 'promiseAPush', 'legalThreat'] as const) {
      const outcome = responseOutcome({ kind }, settings);
      const costsSomething =
        outcome.rateMultiplier > 1 ||
        outcome.rosterMoraleDelta < 0 ||
        outcome.reputationDelta < 0 ||
        outcome.moraleDelta < 0;
      expect(costsSomething, `${kind} is free`).toBe(true);
    }
  });

  it('makes every response actually reduce the risk of losing them', () => {
    for (const kind of ['matchMoney', 'promiseAPush', 'legalThreat'] as const) {
      expect(responseOutcome({ kind }, settings).temptationDelta, kind).toBeLessThan(0);
    }
  });

  it('lets you do nothing, and charges you for it', () => {
    const outcome = responseOutcome({ kind: 'doNothing' }, settings);
    expect(outcome.temptationDelta).toBe(0);
    expect(outcome.moraleDelta).toBeLessThan(0);
  });

  it('only allows a legal threat against a live contract', () => {
    expect(responseIsAvailable({ kind: 'legalThreat' }, offer({ kind: 'tampering' }))).toBe(true);
    expect(responseIsAvailable({ kind: 'legalThreat' }, offer({ kind: 'approach' }))).toBe(false);
    expect(responseIsAvailable({ kind: 'matchMoney' }, offer({ kind: 'approach' }))).toBe(true);
  });

  it('makes responding measurably better than ignoring it', () => {
    const trials = 400;
    const run = (kind: Parameters<typeof responseOutcome>[0]['kind']) => {
      const rng = rngFromSeed(`resolve-${kind}`);
      let left = 0;
      for (let i = 0; i < trials; i++) if (resolveOffer(rng, offer(), { kind }, settings)) left++;
      return left / trials;
    };
    expect(run('matchMoney')).toBeLessThan(run('doNothing'));
    expect(run('promiseAPush')).toBeLessThan(run('doNothing'));
  });

  it('never makes any response a guarantee', () => {
    const rng = rngFromSeed('never-certain');
    let left = 0;
    for (let i = 0; i < 500; i++) {
      if (resolveOffer(rng, offer({ temptation: 0.95 }), { kind: 'matchMoney' }, settings)) left++;
    }
    // Match the money on someone who is as good as gone and you still lose
    // them sometimes.
    expect(left).toBeGreaterThan(0);
  });
});

describe('the player tampering — a deliberately bad bet', () => {
  const target = w({ popularity: 80, morale: 50, momentum: 50, attitude: 50 });
  const attempt = { targetWrestlerId: target.id, targetPromotionId: 'r1', offerPremium: 4000 };

  it('has a low chance of landing even with a huge offer', () => {
    const risk = tamperingRisk(target, attempt, settings);
    expect(risk.successChance).toBeLessThanOrEqual(settings.playerTamperingSuccessCap);
    expect(settings.playerTamperingSuccessCap).toBeLessThan(0.25);
  });

  it('is more likely to be caught than to succeed', () => {
    const risk = tamperingRisk(target, attempt, settings);
    expect(risk.caughtChance).toBeGreaterThan(risk.successChance);
  });

  it('gets you noticed faster when you go after a bigger name', () => {
    const nobody = tamperingRisk(w({ popularity: 15 }), attempt, settings);
    const star = tamperingRisk(w({ popularity: 95 }), attempt, settings);
    expect(star.caughtChance).toBeGreaterThan(nobody.caughtChance);
  });

  it('punishes being caught severely', () => {
    const rng = rngFromSeed('always-caught');
    let sawCaught = false;
    for (let i = 0; i < 200 && !sawCaught; i++) {
      const result = attemptPlayerTampering(rng, target, attempt, 400000, settings);
      if (!result.caught) continue;
      sawCaught = true;
      expect(result.fine).toBeGreaterThanOrEqual(settings.playerTamperingMinFine);
      expect(result.fine).toBeGreaterThan(100000); // a third of a 400k bank
      expect(result.reputationDelta).toBeLessThanOrEqual(-20);
      expect(result.signingBanWeeks).toBeGreaterThanOrEqual(12);
    }
    expect(sawCaught).toBe(true);
  });

  it('can catch you even when the wrestler said no', () => {
    const rng = rngFromSeed('caught-and-failed');
    let sawWorstCase = false;
    for (let i = 0; i < 400; i++) {
      const result = attemptPlayerTampering(rng, target, attempt, 200000, settings);
      if (result.caught && !result.signed) {
        sawWorstCase = true;
        expect(result.fine).toBeGreaterThan(0);
        break;
      }
    }
    expect(sawWorstCase).toBe(true);
  });

  it('never fines below the floor, however broke you are', () => {
    const rng = rngFromSeed('broke');
    for (let i = 0; i < 200; i++) {
      const result = attemptPlayerTampering(rng, target, attempt, 100, settings);
      if (result.caught) {
        expect(result.fine).toBe(settings.playerTamperingMinFine);
        break;
      }
    }
  });

  it('is a losing proposition on average over many attempts', () => {
    // The honest test of "make it a really low chance of success with a
    // severe penalty": run it a hundred times and count the damage.
    const rng = rngFromSeed('grind');
    let signed = 0;
    let totalFines = 0;
    for (let i = 0; i < 100; i++) {
      const result = attemptPlayerTampering(rng, target, attempt, 300000, settings);
      if (result.signed && !result.caught) signed++;
      totalFines += result.fine;
    }
    expect(signed).toBeLessThan(20);
    expect(totalFines).toBeGreaterThan(1_000_000);
  });
});

describe('the sanction ladder — it gets worse every time', () => {
  const target = w({ popularity: 80, morale: 50, momentum: 50, attitude: 50 });
  const attempt = { targetWrestlerId: target.id, targetPromotionId: 'r1', offerPremium: 4000 };

  /** Keep rolling until we get a caught result at this offence count. */
  function caughtAt(priorOffenses: number) {
    const rng = rngFromSeed(`ladder-${priorOffenses}`);
    for (let i = 0; i < 500; i++) {
      const result = attemptPlayerTampering(rng, target, attempt, 300000, settings, priorOffenses);
      if (result.caught) return result;
    }
    throw new Error('never caught');
  }

  it('escalates fine, suspension, then expulsion', () => {
    expect(sanctionFor(0)).toBe('fine');
    expect(sanctionFor(1)).toBe('suspension');
    expect(sanctionFor(2)).toBe('expulsion');
    expect(sanctionFor(9)).toBe('expulsion');
  });

  it('fines you massively the first time and does not stop you running', () => {
    const first = caughtAt(0);
    expect(first.sanction).toBe('fine');
    expect(first.fine).toBeGreaterThan(100000);
    expect(first.suspensionWeeks).toBe(0);
  });

  it('takes your shows away the second time', () => {
    const second = caughtAt(1);
    expect(second.sanction).toBe('suspension');
    expect(second.suspensionWeeks).toBeGreaterThan(0);
    expect(second.fine).toBeGreaterThan(caughtAt(0).fine);
  });

  it('takes the television as well the third time', () => {
    const third = caughtAt(2);
    expect(third.sanction).toBe('expulsion');
    expect(third.companyRatingPenalty).toBeGreaterThan(0);
    expect(third.suspensionWeeks).toBeGreaterThan(caughtAt(1).suspensionWeeks);
  });

  it('makes every sanction strictly worse than the one before it', () => {
    const [a, b, c] = [caughtAt(0), caughtAt(1), caughtAt(2)];
    expect(b.fine).toBeGreaterThan(a.fine);
    expect(c.fine).toBeGreaterThan(b.fine);
    expect(Math.abs(c.reputationDelta)).toBeGreaterThan(Math.abs(a.reputationDelta));
    expect(c.signingBanWeeks).toBeGreaterThan(a.signingBanWeeks);
  });

  it('tells the player exactly what happened to them', () => {
    expect(caughtAt(1).description).toMatch(/suspended/i);
    expect(caughtAt(2).description).toMatch(/television/i);
  });
});
