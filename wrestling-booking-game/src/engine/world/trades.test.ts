import { describe, it, expect } from 'vitest';
import { tradeValue, canBeTraded, evaluateTrade, tradeWorth, tradeLine, tradePartners } from './trades';
import { createStandardContract, askingRate } from '../economy/contracts';
import { defaultWorldSettings } from '../world/settings';
import { generateWrestler } from '../generate/wrestler';
import { rngFromSeed } from '../rng';
import type { Contract, Promotion, Wrestler } from '../types';

const settings = defaultWorldSettings();

function deal(over: Partial<Contract> = {}): Contract {
  return {
    ...createStandardContract(generateWrestler(rngFromSeed('c'), new Set()), settings, 1985),
    weeklyRate: 200,
    weeksRemaining: 40,
    guaranteedPct: 0,
    ...over,
  };
}

function person(over: Partial<Wrestler> = {}): Wrestler {
  return {
    ...generateWrestler(rngFromSeed('t'), new Set()),
    role: 'wrestler',
    roleSinceWeek: 0,
    injury: null,
    contract: deal(),
    ...over,
  };
}

function company(over: Partial<Promotion> = {}): Promotion {
  return {
    id: 'them',
    name: 'Northern Combat League',
    bankBalance: 200_000,
    closedWeek: null,
    ...over,
  } as Promotion;
}

function ask(
  outgoing: Wrestler,
  incoming: Wrestler | null,
  over: Partial<Parameters<typeof evaluateTrade>[0]> = {},
) {
  return evaluateTrade({
    offer: { outgoing, incoming, cashFromYou: 0 },
    them: company(),
    theirRosterSize: 20,
    targetRosterSize: 20,
    settings,
    ...over,
  });
}

describe('what somebody is worth', () => {
  it('makes a draw worth several midcarders, not a few points more', () => {
    // Both on market-rate deals, so the contract cancels out and this is a
    // clean read on the popularity curve. (Comparing two men on the *same*
    // wage does not work: the same $200 is a bargain for a star and merely
    // cheap for a midcarder, which compresses the gap.)
    const star = person({ popularity: 90 });
    const midcarder = person({ popularity: 50 });
    star.contract = deal({ weeklyRate: askingRate(star, settings) });
    midcarder.contract = deal({ weeklyRate: askingRate(midcarder, settings) });
    expect(tradeValue(star, settings)).toBeGreaterThan(tradeValue(midcarder, settings) * 3);
  });

  it('makes somebody on a bargain deal worth more than the same man at market rate', () => {
    // The trade market is about the paper as much as the person.
    const atMarket = person({ popularity: 70 });
    atMarket.contract = deal({ weeklyRate: askingRate(atMarket, settings) });
    const bargain = person({ popularity: 70, contract: deal({ weeklyRate: 50 }) });
    expect(tradeValue(bargain, settings)).toBeGreaterThan(tradeValue(atMarket, settings));
  });

  it('counts the contract against them', () => {
    const cheap = person({ popularity: 70, contract: deal({ weeklyRate: 100 }) });
    const dear = person({ popularity: 70, contract: deal({ weeklyRate: 900 }) });
    expect(tradeValue(dear, settings)).toBeLessThan(tradeValue(cheap, settings));
  });

  it('makes a guaranteed deal a bigger liability than the same wage without one', () => {
    // The point of guaranteed money arriving in the trade market: it is not
    // just what he earns, it is what he costs to get rid of.
    const plain = person({ popularity: 70, contract: deal({ weeklyRate: 600, guaranteedPct: 0 }) });
    const locked = person({ popularity: 70, contract: deal({ weeklyRate: 600, guaranteedPct: 1 }) });
    expect(tradeValue(locked, settings)).toBeLessThan(tradeValue(plain, settings));
  });

  it('can make somebody worth less than nothing', () => {
    // A fading star on a fully guaranteed long deal is not an asset.
    const albatross = person({
      popularity: 25,
      contract: deal({ weeklyRate: 900, weeksRemaining: 90, guaranteedPct: 1 }),
    });
    expect(tradeValue(albatross, settings)).toBeLessThan(0);
    expect(tradeWorth(albatross, settings)).toBe('A liability');
  });

  it('says what they are worth in words, never a number', () => {
    expect(tradeWorth(person({ popularity: 95, contract: deal({ weeklyRate: 100 }) }), settings)).toBe(
      'Everybody wants him',
    );
    for (const pop of [10, 40, 70, 95]) {
      expect(tradeWorth(person({ popularity: pop }), settings)).not.toMatch(/\d/);
    }
  });
});

describe('who cannot be moved', () => {
  it('refuses somebody with a no-trade clause at any price', () => {
    const protectedMan = person({ contract: deal({ clauses: ['noTrade'] }) });
    expect(canBeTraded(protectedMan).ok).toBe(false);
    expect(canBeTraded(protectedMan).reason).toContain('no-trade');
    // And no offer, however good, gets round it.
    const verdict = ask(protectedMan, null, { offer: { outgoing: protectedMan, incoming: null, cashFromYou: 500_000 } });
    expect(verdict.accepted).toBe(false);
  });

  it('refuses the injured, the retired, the dead and the unsigned', () => {
    expect(canBeTraded(person({ injury: { severity: 'severe', description: 'Knee', sufferedWeek: 1, totalWeeks: 10, weeksRemaining: 8, permanentStatLoss: {}, earlyReturnWeeksUsed: 0 } })).ok).toBe(false);
    expect(canBeTraded(person({ careerStatus: 'retired' })).ok).toBe(false);
    expect(canBeTraded(person({ contract: null })).ok).toBe(false);
  });

  it('refuses somebody who is refereeing or managing', () => {
    expect(canBeTraded(person({ role: 'referee' })).ok).toBe(false);
    expect(canBeTraded(person({ role: 'manager' })).ok).toBe(false);
  });

  it('says why, every time', () => {
    for (const blocked of [
      person({ role: 'referee' }),
      person({ contract: deal({ clauses: ['noTrade'] }) }),
      person({ contract: null }),
    ]) {
      expect(canBeTraded(blocked).reason!.length).toBeGreaterThan(10);
    }
  });
});

describe('whether they say yes', () => {
  it('will not trade at par — the other side has to come out ahead', () => {
    // This is what stops the player laundering bad paper through the AI.
    const same = person({ popularity: 60 });
    expect(ask(same, person({ popularity: 60 })).accepted).toBe(false);
  });

  it('takes a deal that is clearly good for them', () => {
    const star = person({ popularity: 92, contract: deal({ weeklyRate: 150 }) });
    const spare = person({ popularity: 35 });
    expect(ask(star, spare).accepted).toBe(true);
  });

  it('lets cash close a gap', () => {
    const mine = person({ popularity: 55 });
    const theirs = person({ popularity: 70 });
    expect(ask(mine, theirs).accepted).toBe(false);
    const sweetened = evaluateTrade({
      offer: { outgoing: mine, incoming: theirs, cashFromYou: 60_000 },
      them: company(),
      theirRosterSize: 20,
      targetRosterSize: 20,
      settings,
    });
    expect(sweetened.accepted).toBe(true);
  });

  it('will not take on a wage it cannot service', () => {
    const expensive = person({ popularity: 95, contract: deal({ weeklyRate: 5_000 }) });
    const verdict = ask(expensive, null, { them: company({ bankBalance: 4_000 }) });
    expect(verdict.accepted).toBe(false);
    expect(verdict.reason).toContain('cannot carry that wage');
  });

  it('values a body more when it cannot fill a card', () => {
    const spare = person({ popularity: 48 });
    const theirs = person({ popularity: 55 });
    const comfortable = ask(spare, theirs, { theirRosterSize: 20, targetRosterSize: 20 });
    const desperate = ask(spare, theirs, { theirRosterSize: 6, targetRosterSize: 20 });
    expect(comfortable.accepted).toBe(false);
    expect(desperate.accepted).toBe(true);
  });

  it('will not take a liability off your hands for free', () => {
    const albatross = person({
      popularity: 20,
      contract: deal({ weeklyRate: 900, weeksRemaining: 90, guaranteedPct: 1 }),
    });
    const verdict = ask(albatross, null);
    expect(verdict.accepted).toBe(false);
    expect(verdict.reason).toContain('Nobody wants');
  });

  it('always says why, in words, whichever way it went', () => {
    const verdicts = [
      ask(person({ popularity: 92, contract: deal({ weeklyRate: 150 }) }), person({ popularity: 30 })),
      ask(person({ popularity: 40 }), person({ popularity: 80 })),
      ask(person({ popularity: 20, contract: deal({ weeklyRate: 900, guaranteedPct: 1, weeksRemaining: 90 }) }), null),
    ];
    for (const verdict of verdicts) {
      expect(verdict.reason.length).toBeGreaterThan(12);
      expect(verdict.reason).not.toMatch(/\d/);
    }
  });
});

describe('the paperwork', () => {
  it('says who went where, and which way the cash went', () => {
    expect(tradeLine('Duke', 'Cyclone', 'CCW', 'NCL', 0)).toContain('in exchange for Cyclone');
    expect(tradeLine('Duke', null, 'CCW', 'NCL', -5000)).toContain('for cash');
    expect(tradeLine('Duke', 'Cyclone', 'CCW', 'NCL', 5000)).toContain('adding cash');
    expect(tradeLine('Duke', null, 'CCW', 'NCL', 0)).toContain('CCW have traded Duke to NCL');
  });

  it('will not ring the same company back the week after they said no', () => {
    const rivals = [company({ id: 'a' }), company({ id: 'b' })];
    const partners = tradePartners(rivals, { a: 10 }, 12, settings);
    expect(partners.map((p) => p.id)).toEqual(['b']);
    // And takes the call again once the cooldown is up.
    expect(tradePartners(rivals, { a: 10 }, 10 + settings.tradeCooldownWeeks, settings)).toHaveLength(2);
  });

  it('leaves a folded company out of it', () => {
    const rivals = [company({ id: 'a', closedWeek: 4 }), company({ id: 'b' })];
    expect(tradePartners(rivals, {}, 12, settings).map((p) => p.id)).toEqual(['b']);
  });
});
