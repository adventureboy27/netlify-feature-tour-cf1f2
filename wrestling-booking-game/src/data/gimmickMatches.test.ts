// The gimmick matches added on top of §9's original table, and the two
// mechanisms that make them behave like themselves: impliedRules and
// finishWeights.

import { describe, it, expect } from 'vitest';
import { STIPULATIONS, stipulationById, blowoffStipulations, effectiveRules } from './stipulations';
import { rollFinish } from '../engine/sim/finish';
import { rngFromSeed } from '../engine/rng';
import { defaultWorldSettings } from '../engine/world/settings';
import type { MatchRules, FinishType } from '../engine/types';
import { generateBeats } from '../engine/sim/narrative';

const strictRules: MatchRules = {
  preset: 'singles',
  format: 'individuals',
  ruleStrictness: 'strict',
  aim: 'firstFall',
  falls: 'pinsAndSubs',
  timeLimit: 15,
  stoppage: 'referee',
  countOuts: 'normal',
  reward: 'none',
};

/** Roll a stipulation's finish many times and tally what came up. */
function finishDistribution(stipulationId: string, rolls = 3000): Map<FinishType, number> {
  const stipulation = stipulationById(stipulationId)!;
  const rules = effectiveRules(strictRules, stipulation);
  const rng = rngFromSeed(`finish-${stipulationId}`);
  const counts = new Map<FinishType, number>();
  for (let i = 0; i < rolls; i++) {
    const finish = rollFinish(rng, {
      rules,
      violenceLevel: stipulation.violenceLevel,
      winnerIsTechnician: false,
      isUpset: false,
      isCloselyMatched: false,
      finishWeights: stipulation.finishWeights,
    });
    counts.set(finish, (counts.get(finish) ?? 0) + 1);
  }
  return counts;
}

describe('the new gimmick matches exist and are coherent', () => {
  it.each(['tables', 'flamingTables', 'casket', 'noDQ', 'streetFight'])('ships %s', (id) => {
    expect(stipulationById(id)).toBeDefined();
  });

  it('keeps every stipulation id unique', () => {
    const ids = STIPULATIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('splits No-DQ from Hardcore as separate bookings', () => {
    const noDQ = stipulationById('noDQ')!;
    const hardcore = stipulationById('hardcore')!;
    expect(noDQ.name).not.toContain('Hardcore');
    // The whole point of the split: No-DQ is cheaper in violence, so it does
    // not drag the rest of the card down through hardcore saturation.
    expect(noDQ.violenceLevel).toBeLessThan(hardcore.violenceLevel);
    expect(noDQ.ratingBonus).toBeLessThan(hardcore.ratingBonus);
  });

  it('prices flaming tables as the ceiling of violence', () => {
    const flaming = stipulationById('flamingTables')!;
    const others = STIPULATIONS.filter((s) => s.id !== 'flamingTables');
    expect(flaming.violenceLevel).toBeGreaterThan(Math.max(...others.map((s) => s.violenceLevel)));
    expect(flaming.injuryMult).toBeGreaterThan(Math.max(...others.map((s) => s.injuryMult)));
    expect(flaming.heatRequirement).toBeGreaterThanOrEqual(70);
  });

  it('makes one flaming table a serious chunk of the saturation budget', () => {
    const { hardcoreSaturationPerViolence, hardcoreSaturationDecayPerWeek } = defaultWorldSettings();
    const cost = stipulationById('flamingTables')!.violenceLevel * hardcoreSaturationPerViolence;
    // Costs more than a week of decay can undo — that's what stops it being
    // a weekly gimmick.
    expect(cost).toBeGreaterThan(hardcoreSaturationDecayPerWeek * 3);
  });

  it('lists the grudge blowoffs, including flaming tables', () => {
    const ids = blowoffStipulations().map((s) => s.id);
    expect(ids).toContain('hairVsHair');
    expect(ids).toContain('maskVsMask');
    expect(ids).toContain('loserLeaves');
    expect(ids).toContain('flamingTables');
  });
});

describe('impliedRules', () => {
  it('turns disqualifications off for No-DQ without the player flipping a switch', () => {
    const rules = effectiveRules(strictRules, stipulationById('noDQ')!);
    expect(rules.ruleStrictness).toBe('none');
    expect(rules.countOuts).toBe('none');
  });

  it('leaves the caller rules untouched', () => {
    const before = { ...strictRules };
    effectiveRules(strictRules, stipulationById('hardcore')!);
    expect(strictRules).toEqual(before);
  });

  it('passes rules straight through when there is no stipulation', () => {
    expect(effectiveRules(strictRules, null)).toBe(strictRules);
  });
});

describe('finishWeights', () => {
  it('never ends a No-DQ or street fight in a disqualification', () => {
    for (const id of ['noDQ', 'hardcore', 'streetFight']) {
      const counts = finishDistribution(id);
      expect(counts.get('disqualification') ?? 0).toBe(0);
      expect(counts.get('countOut') ?? 0).toBe(0);
    }
  });

  it('ends a tables match by putting someone through a table, never by pinfall', () => {
    const counts = finishDistribution('tables');
    expect(counts.get('cleanPin') ?? 0).toBe(0);
    expect(counts.get('submission') ?? 0).toBe(0);
    expect(counts.get('rollup') ?? 0).toBe(0);
    expect(counts.get('knockout')!).toBeGreaterThan(0);
  });

  it('ends a casket match with the lid, not the referee', () => {
    const counts = finishDistribution('casket');
    expect(counts.get('cleanPin') ?? 0).toBe(0);
    expect(counts.get('timeLimitDraw') ?? 0).toBe(0);
    expect(counts.get('knockout')!).toBeGreaterThan(0);
  });

  it('makes a submission match end in the hold, and never by pinfall', () => {
    const counts = finishDistribution('submissionMatch');
    expect(counts.get('cleanPin') ?? 0).toBe(0);
    expect(counts.get('rollup') ?? 0).toBe(0);

    // Submissions dominate by a wide margin. A submission match still has a
    // referee, so it can still be thrown out or counted out — that stays
    // possible, just rare.
    const submissions = counts.get('submission')!;
    const runnerUp = Math.max(...[...counts].filter(([f]) => f !== 'submission').map(([, n]) => n));
    expect(submissions).toBeGreaterThan(runnerUp * 4);
  });

  it('still produces a winner when a stipulation zeroes out every rules-legal finish', () => {
    // Submission-only rules crossed with a tables match: nothing survives
    // both filters, and the sim still has to name a winner.
    const rng = rngFromSeed('impossible');
    const finish = rollFinish(rng, {
      rules: { ...strictRules, falls: 'pinsOnly' },
      violenceLevel: 3,
      winnerIsTechnician: false,
      isUpset: false,
      isCloselyMatched: false,
      finishWeights: stipulationById('tables')!.finishWeights,
    });
    expect(finish).toBeTruthy();
  });

  it('leaves an unweighted stipulation rolling the normal §11.3 spread', () => {
    const counts = finishDistribution('hairVsHair');
    expect(counts.size).toBeGreaterThan(4);
    expect(counts.get('cleanPin')!).toBeGreaterThan(0);
  });
});

describe('finishFlavor — the write-up is the only place the player sees it happen', () => {
  const wrestler = (name: string) => ({ name }) as never;

  function finishLineFor(stipulationId: string | null, finish: 'knockout') {
    const beats = generateBeats(rngFromSeed('flavor'), {
      winnerMembers: [wrestler('Vic Yeager')],
      loserMembers: [wrestler('Blaze Lambert')],
      finish,
      stars: 2,
      stipulation: stipulationId ? stipulationById(stipulationId)! : null,
    });
    return beats.find((b) => b.kind === 'finish')!.text;
  }

  it('puts someone through the table instead of knocking them out cold', () => {
    const line = finishLineFor('tables', 'knockout');
    expect(line).toContain('through the table');
    expect(line).toContain('Blaze Lambert');
    expect(line).not.toContain('out cold');
  });

  it('closes the lid on a casket match', () => {
    expect(finishLineFor('casket', 'knockout')).toContain('casket');
  });

  it('sets the table on fire', () => {
    expect(finishLineFor('flamingTables', 'knockout')).toContain('burning table');
  });

  it('falls back to the generic line when the stipulation has no flavor for that finish', () => {
    expect(finishLineFor('hairVsHair', 'knockout')).toContain('out cold');
    expect(finishLineFor(null, 'knockout')).toContain('out cold');
  });
});
