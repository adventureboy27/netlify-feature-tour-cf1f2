import { describe, it, expect } from 'vitest';
import {
  managerEffect,
  managerFit,
  refereeEffect,
  guestRefereeEffect,
  guestRefereeIsLegal,
  ringsideTotals,
} from './ringside';
import { MANAGERS, REFEREES, managerById, refereeById, cheapestReferee } from '../../data/ringsidePool';
import { defaultWorldSettings } from '../world/settings';
import { generateWrestler } from '../generate/wrestler';
import { rngFromSeed } from '../rng';
import { rollFinish } from './finish';
import type { Wrestler } from '../types';

const settings = defaultWorldSettings();
const w = (over: Partial<Wrestler> = {}): Wrestler => ({ ...generateWrestler(rngFromSeed('r'), new Set()), ...over });

const talker = w({ charisma: 95, popularity: 60 });
const monster = w({ charisma: 12, popularity: 60 });

describe('the manager pool', () => {
  it('offers a real spread of price and ability', () => {
    const fees = MANAGERS.map((m) => m.feePerShow);
    expect(MANAGERS.length).toBeGreaterThanOrEqual(10);
    expect(Math.max(...fees)).toBeGreaterThan(Math.min(...fees) * 3);
  });

  it('charges more for the better talkers', () => {
    const best = [...MANAGERS].sort((a, b) => b.micWork - a.micWork)[0]!;
    const worst = [...MANAGERS].sort((a, b) => a.micWork - b.micWork)[0]!;
    expect(best.feePerShow).toBeGreaterThan(worst.feePerShow);
  });

  it('finds managers by id', () => {
    expect(managerById('mgr-slick')).toBeDefined();
    expect(managerById('nope')).toBeUndefined();
  });
});

describe('what a manager is worth', () => {
  const slick = managerById('mgr-cornelius')!;

  it('always adds something to the match itself', () => {
    expect(managerEffect(slick, talker, settings).ratingBonus).toBeGreaterThan(0);
  });

  it('helps somebody who cannot talk far more than somebody who can', () => {
    // The whole design: a mouthpiece transforms a silent monster and is money
    // wasted on a great promo.
    const forMonster = managerEffect(slick, monster, settings).clientPopularityMultiplier;
    const forTalker = managerEffect(slick, talker, settings).clientPopularityMultiplier;
    expect(forMonster).toBeGreaterThan(forTalker);
    expect(forMonster).toBeGreaterThan(1);
  });

  it('carries a cost that is not money — the client builds less on their own', () => {
    expect(managerEffect(slick, monster, settings).selfMadePenalty).toBeGreaterThan(0);
  });

  it('makes a devious manager more likely to get involved in the finish', () => {
    const crook = managerById('mgr-slick')!;
    const straight = managerById('mgr-sarge')!;
    expect(managerEffect(crook, monster, settings).interferenceWeight).toBeGreaterThan(
      managerEffect(straight, monster, settings).interferenceWeight,
    );
  });

  it('says in words whether the pairing is worth it', () => {
    expect(managerFit(slick, monster, settings)).toBe('Exactly what they need');
    expect(managerFit(slick, talker, settings)).toBe('Wasted on them');
  });
});

describe('referees as characters', () => {
  it('ships a spread from unbuyable to entirely purchasable', () => {
    expect(REFEREES.length).toBeGreaterThanOrEqual(10);
    expect(Math.min(...REFEREES.map((r) => r.bendable))).toBeLessThan(15);
    expect(Math.max(...REFEREES.map((r) => r.bendable))).toBeGreaterThan(80);
  });

  it('makes a good official a small positive and a bad one a small negative', () => {
    const good = refereeById('ref-hollis')!;
    const bad = refereeById('ref-whitfield')!;
    expect(refereeEffect(good, settings).ratingBonus).toBeGreaterThan(0);
    expect(refereeEffect(bad, settings).ratingBonus).toBeLessThan(0);
  });

  it('produces more messy finishes with an incompetent official', () => {
    const good = refereeById('ref-hollis')!;
    const bad = refereeById('ref-tibbs')!;
    expect(refereeEffect(bad, settings).screwyFinishWeight).toBeGreaterThan(
      refereeEffect(good, settings).screwyFinishWeight,
    );
  });

  it('makes a bendable official the route to a bought finish', () => {
    const crooked = refereeById('ref-cade')!;
    const straight = refereeById('ref-hollis')!;
    expect(refereeEffect(crooked, settings).interferenceWeight).toBeGreaterThan(
      refereeEffect(straight, settings).interferenceWeight,
    );
    // And you pay for it — the crooked one is dearer than the honest one.
    expect(crooked.feePerShow).toBeGreaterThan(straight.feePerShow);
  });

  it('always leaves an official you can afford', () => {
    expect(cheapestReferee().feePerShow).toBeLessThan(250);
  });
});

describe('guest referees', () => {
  const star = w({ popularity: 92 });
  const nobody = w({ popularity: 20 });

  it('lifts the match by star power', () => {
    expect(guestRefereeEffect(star, settings).ratingBonus).toBeGreaterThan(
      guestRefereeEffect(nobody, settings).ratingBonus,
    );
  });

  it('costs you the clean finish — that is the trade', () => {
    const guest = guestRefereeEffect(star, settings);
    const professional = refereeEffect(refereeById('ref-hollis')!, settings);
    expect(guest.screwyFinishWeight).toBeGreaterThan(professional.screwyFinishWeight);
    expect(guest.interferenceWeight).toBeGreaterThan(professional.interferenceWeight);
  });

  it('will not let somebody referee a match they are wrestling in', () => {
    expect(guestRefereeIsLegal('a', ['a', 'b'])).toBe(false);
    expect(guestRefereeIsLegal('c', ['a', 'b'])).toBe(true);
  });
});

describe('everything at ringside together', () => {
  const manager = managerById('mgr-cornelius')!;
  const referee = refereeById('ref-hollis')!;
  const star = w({ popularity: 92 });

  it('bills for every person out there', () => {
    const totals = ringsideTotals({
      managers: [{ manager, client: monster }],
      referee,
      guestReferee: null,
      settings,
    });
    expect(totals.cost).toBe(manager.feePerShow + referee.feePerShow);
  });

  it('costs no wages when nobody is at ringside, but is not free', () => {
    // This test used to assert ratingBonus 0 and screwy weight 1, which was
    // the bug: an empty shirt was strictly better than a bad referee, so the
    // correct play was to never hire one.
    const totals = ringsideTotals({ managers: [], referee: null, guestReferee: null, settings });
    expect(totals.cost).toBe(0);
    expect(totals.ratingBonus).toBeLessThan(0);
    expect(totals.screwyFinishWeight).toBeGreaterThan(1);
  });

  it('replaces the assigned official with the guest rather than paying both', () => {
    const totals = ringsideTotals({ managers: [], referee, guestReferee: star, settings });
    // The guest is a wrestler on your roster, not a fee at ringside.
    expect(totals.cost).toBe(0);
    expect(totals.screwyFinishWeight).toBeGreaterThan(1);
  });

  it('stacks managers on both sides', () => {
    const two = ringsideTotals({
      managers: [
        { manager, client: monster },
        { manager: managerById('mgr-duchess')!, client: talker },
      ],
      referee: null,
      guestReferee: null,
      settings,
    });
    const one = ringsideTotals({ managers: [{ manager, client: monster }], referee: null, guestReferee: null, settings });
    expect(two.ratingBonus).toBeGreaterThan(one.ratingBonus);
    expect(two.cost).toBeGreaterThan(one.cost);
  });

  it('never lets ringside run away with the match rating', () => {
    const everyone = ringsideTotals({
      managers: MANAGERS.map((m) => ({ manager: m, client: monster })),
      referee: null,
      guestReferee: star,
      settings,
    });
    expect(everyone.ratingBonus).toBeLessThanOrEqual(20);
  });
});

describe('running a match with nobody in the shirt', () => {
  const settings = defaultWorldSettings();
  const nobody = () => ringsideTotals({ managers: [], referee: null, guestReferee: null, settings });

  it('is worse than every referee in the pool at running a match', () => {
    // If booking nobody were merely cheaper, booking nobody would be the
    // correct play and the whole referee system would be decoration. Checked
    // against the real pool rather than an invented extreme.
    for (const referee of REFEREES) {
      const hired = ringsideTotals({ managers: [], referee, guestReferee: null, settings });
      expect(nobody().ratingBonus).toBeLessThan(hired.ratingBonus);
      expect(nobody().screwyFinishWeight).toBeGreaterThan(hired.screwyFinishWeight);
      expect(nobody().injuryMultiplier).toBeGreaterThan(hired.injuryMultiplier);
      expect(nobody().decisiveFinishWeight).toBeLessThan(hired.decisiveFinishWeight);
    }
  });

  it('is not the most interference-prone option, and should not be', () => {
    // A bought referee is a *tool*: somebody actively helping a wrestler
    // cheat produces more interference than an empty shirt does. Chaos and
    // corruption are different problems and the numbers say so.
    const bent = REFEREES.reduce((worst, r) => (r.bendable > worst.bendable ? r : worst));
    const crooked = ringsideTotals({ managers: [], referee: bent, guestReferee: null, settings });
    expect(crooked.interferenceWeight).toBeGreaterThan(nobody().interferenceWeight);
    // But an empty shirt is still worse than an honest one.
    const honest = REFEREES.reduce((best, r) => (r.bendable < best.bendable ? r : best));
    const straight = ringsideTotals({ managers: [], referee: honest, guestReferee: null, settings });
    expect(nobody().interferenceWeight).toBeGreaterThan(straight.interferenceWeight);
  });

  it('costs nothing in wages, which is the whole temptation', () => {
    expect(nobody().cost).toBe(0);
    expect(cheapestReferee().feePerShow).toBeGreaterThan(0);
  });

  it('says whether anybody is officiating', () => {
    expect(nobody().hasOfficial).toBe(false);
    expect(ringsideTotals({ managers: [], referee: REFEREES[0]!, guestReferee: null, settings }).hasOfficial).toBe(
      true,
    );
    expect(
      ringsideTotals({ managers: [], referee: null, guestReferee: w({ popularity: 70 }), settings }).hasOfficial,
    ).toBe(true);
  });

  it('leaves a guest referee able to count, however crooked they are', () => {
    const guest = ringsideTotals({ managers: [], referee: null, guestReferee: w({ popularity: 70 }), settings });
    expect(guest.decisiveFinishWeight).toBe(1);
    expect(guest.injuryMultiplier).toBe(1);
  });
});

describe('what the finish looks like with no official', () => {
  const settings = defaultWorldSettings();
  const rules = {
    preset: 'singles' as const,
    format: 'individuals' as const,
    ruleStrictness: 'lenient' as const,
    aim: 'firstFall' as const,
    falls: 'pinsAndSubs' as const,
    timeLimit: 15 as const,
    stoppage: 'referee' as const,
    countOuts: 'normal' as const,
    reward: 'none' as const,
  };

  function finishSpread(hasOfficial: boolean): Record<string, number> {
    const totals = ringsideTotals({
      managers: [],
      referee: hasOfficial ? REFEREES.find((r) => r.id === 'ref-birch') ?? REFEREES[0]! : null,
      guestReferee: null,
      settings,
    });
    const counts: Record<string, number> = {};
    for (let i = 0; i < 3000; i++) {
      const finish = rollFinish(rngFromSeed(`f-${hasOfficial}-${i}`), {
        rules,
        isCloselyMatched: false,
        violenceLevel: 0,
        winnerIsTechnician: false,
        isUpset: false,
        injuryMultiplier: totals.injuryMultiplier,
        ringsideWeights: {
          screwy: totals.screwyFinishWeight,
          interference: totals.interferenceWeight,
          decisive: totals.decisiveFinishWeight,
          hasOfficial: totals.hasOfficial,
        },
      });
      counts[finish] = (counts[finish] ?? 0) + 1;
    }
    return counts;
  }

  it('makes a clean decision much harder to reach', () => {
    const officiated = finishSpread(true);
    const chaos = finishSpread(false);
    const decisive = (c: Record<string, number>) =>
      (c.cleanPin ?? 0) + (c.submission ?? 0) + (c.rollup ?? 0) + (c.refereeStoppage ?? 0);
    expect(decisive(chaos)).toBeLessThan(decisive(officiated) * 0.6);
  });

  it('has nobody to stop the match, so there is no referee stoppage at all', () => {
    expect(finishSpread(false).refereeStoppage ?? 0).toBe(0);
    expect(finishSpread(true).refereeStoppage ?? 0).toBeGreaterThan(0);
  });

  it('fills the gap with the messy finishes instead', () => {
    const officiated = finishSpread(true);
    const chaos = finishSpread(false);
    const messy = (c: Record<string, number>) =>
      (c.disqualification ?? 0) + (c.countOut ?? 0) + (c.doubleKO ?? 0) + (c.timeLimitDraw ?? 0);
    expect(messy(chaos)).toBeGreaterThan(messy(officiated));
  });

  it('still always produces a finish', () => {
    const chaos = finishSpread(false);
    expect(Object.values(chaos).reduce((a, b) => a + b, 0)).toBe(3000);
  });
});
