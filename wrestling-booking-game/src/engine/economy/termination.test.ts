import { describe, it, expect } from 'vitest';
import {
  severanceOwed,
  severanceWeight,
  guaranteedShareFor,
  exitTerms,
  canBeSigned,
  guaranteeLabel,
  noCompeteLabel,
  wantsOut,
  EXIT_LABELS,
} from './termination';
import { createStandardContract } from './contracts';
import { defaultWorldSettings } from '../world/settings';
import { generateWrestler } from '../generate/wrestler';
import { rngFromSeed } from '../rng';
import type { Contract, Wrestler } from '../types';

const settings = defaultWorldSettings();

function person(over: Partial<Wrestler> = {}): Wrestler {
  return { ...generateWrestler(rngFromSeed('x'), new Set()), ...over };
}

function deal(over: Partial<Contract> = {}): Contract {
  return { ...createStandardContract(person(), settings, 1985), weeklyRate: 1000, weeksRemaining: 50, ...over };
}

describe('what is guaranteed', () => {
  it('gives the people you built money and everybody else nothing', () => {
    // Keyed to ego, not to career status: 'draw' is so rare that guarantees
    // keyed to it never appeared once in a five-year save. A rule nobody
    // ever meets is not a rule.
    expect(guaranteedShareFor(95, settings)).toBe(1);
    expect(guaranteedShareFor(75, settings)).toBe(0.5);
    expect(guaranteedShareFor(60, settings)).toBeGreaterThan(0);
    expect(guaranteedShareFor(40, settings)).toBe(0);
    expect(guaranteedShareFor(0, settings)).toBe(0);
  });

  it('climbs as somebody gets a bigger opinion of themselves', () => {
    const ladder = [30, 60, 75, 95].map((ego) => guaranteedShareFor(ego, settings));
    for (let i = 1; i < ladder.length; i++) expect(ladder[i]!).toBeGreaterThan(ladder[i - 1]!);
  });

  it('says what they are asking for, in words', () => {
    expect(guaranteeLabel(40, settings)).toBeNull();
    expect(guaranteeLabel(95, settings)).toContain('Every penny');
    expect(guaranteeLabel(75, settings)).not.toMatch(/\d/);
  });

  it('costs nothing to cut somebody with nothing guaranteed', () => {
    expect(severanceOwed(deal({ guaranteedPct: 0 }))).toBe(0);
    expect(severanceWeight(deal({ guaranteedPct: 0 }), 10_000)).toBe('Free to cut');
  });

  it('charges the rest of the paper on a fully guaranteed deal', () => {
    expect(severanceOwed(deal({ guaranteedPct: 1, weeklyRate: 800, weeksRemaining: 40 }))).toBe(32_000);
  });

  it('honours the iron-clad clause the game already promised', () => {
    // The UI has always told the player this clause means "releasing them
    // costs the full remaining term". Until now nothing charged it.
    const ironClad = deal({ guaranteedPct: 0, clauses: ['ironClad'], weeklyRate: 500, weeksRemaining: 20 });
    expect(severanceOwed(ironClad)).toBe(10_000);
  });

  it('gets cheaper to escape the longer you sit on it', () => {
    const fresh = deal({ guaranteedPct: 1, weeksRemaining: 80 });
    const nearlyDone = deal({ guaranteedPct: 1, weeksRemaining: 6 });
    expect(severanceOwed(fresh)).toBeGreaterThan(severanceOwed(nearlyDone));
  });

  it('owes nothing on somebody with no contract at all', () => {
    expect(severanceOwed(null)).toBe(0);
  });

  it('says in words how heavy the deal is, against what you actually have', () => {
    const heavy = deal({ guaranteedPct: 1, weeklyRate: 900, weeksRemaining: 60 });
    expect(severanceWeight(heavy, 10_000)).toBe('You are stuck with them');
    expect(severanceWeight(heavy, 5_000_000)).toBe('Cheap to cut');
    expect(severanceWeight(heavy, 10_000)).not.toMatch(/\d/);
  });
});

describe('the three exits', () => {
  const guy = () => person({ name: 'Duke Rawlins', contract: deal({ guaranteedPct: 1 }) });

  it('lets an expired deal walk free the same day, owing nothing', () => {
    const terms = exitTerms(guy(), 'expiry', settings, 'CCW');
    expect(terms.severance).toBe(0);
    expect(terms.noCompeteWeeks).toBe(0);
  });

  it('makes firing cost the guarantee and still let them sign anywhere', () => {
    // The worst exit on both counts, deliberately: you broke it, so you pay
    // and you do not also get to keep them off television.
    const terms = exitTerms(guy(), 'fired', settings, 'CCW');
    expect(terms.severance).toBe(50_000);
    expect(terms.noCompeteWeeks).toBe(0);
  });

  it('makes a negotiated release cost nothing and cost them ninety days', () => {
    const terms = exitTerms(guy(), 'negotiatedRelease', settings, 'CCW');
    expect(terms.severance).toBe(0);
    expect(terms.noCompeteWeeks).toBe(settings.noCompeteWeeks);
  });

  it('is the only exit where the promotion pays and the only one where they wait', () => {
    // Stated as one assertion because the asymmetry IS the design: the side
    // that breaks the deal pays, the side that asks out waits.
    const fired = exitTerms(guy(), 'fired', settings, 'CCW');
    const asked = exitTerms(guy(), 'negotiatedRelease', settings, 'CCW');
    expect(fired.severance > 0 && fired.noCompeteWeeks === 0).toBe(true);
    expect(asked.severance === 0 && asked.noCompeteWeeks > 0).toBe(true);
  });

  it('always says what happened, by name', () => {
    // Nothing happens to a person off-screen — CLAUDE.md. A departure is a
    // departure whichever door they went out of.
    for (const kind of ['expiry', 'fired', 'negotiatedRelease'] as const) {
      const terms = exitTerms(guy(), kind, settings, 'Continental');
      expect(terms.text).toContain('Duke Rawlins');
      expect(terms.text.length).toBeGreaterThan(30);
      expect(terms.text).not.toMatch(/\{[a-z]+\}/i);
    }
    // And the free release says out loud what he gave up for it.
    expect(exitTerms(guy(), 'negotiatedRelease', settings, 'CCW').text).toContain('ninety days');
  });

  it('says something different when there was nothing to pay off', () => {
    const cheap = person({ name: 'Jobber Joe', contract: deal({ guaranteedPct: 0 }) });
    expect(exitTerms(cheap, 'fired', settings, 'CCW').text).toContain('cost them nothing');
  });

  it('names every exit for the UI', () => {
    for (const label of Object.values(EXIT_LABELS)) expect(label.length).toBeGreaterThan(0);
  });
});

describe('the ninety days', () => {
  it('stops anybody signing them, including the company they left', () => {
    expect(canBeSigned(person({ noCompeteWeeks: 8 }))).toBe(false);
    expect(canBeSigned(person({ noCompeteWeeks: 0 }))).toBe(true);
    expect(canBeSigned(person())).toBe(true);
  });

  it('counts it down in words, never a number', () => {
    expect(noCompeteLabel(person({ noCompeteWeeks: 12 }))).toBe('Ninety days, just started');
    expect(noCompeteLabel(person({ noCompeteWeeks: 1 }))).toBe('Free to sign shortly');
    expect(noCompeteLabel(person({ noCompeteWeeks: 0 }))).toBeNull();
    expect(noCompeteLabel(person({ noCompeteWeeks: 5 }))).not.toMatch(/\d/);
  });
});

describe('who asks to be let go', () => {
  it('only asks when they are genuinely unhappy', () => {
    expect(wantsOut(person({ morale: 80, contract: deal() }), settings)).toBe(false);
    expect(wantsOut(person({ morale: 10, contract: deal({ guaranteedPct: 0 }) }), settings)).toBe(true);
  });

  it('does not ask when they are sitting on a fortune of guaranteed money', () => {
    // Nobody tears up a year of guaranteed wages because they are sulking.
    const rich = person({ morale: 5, contract: deal({ guaranteedPct: 1, weeksRemaining: 80 }) });
    expect(wantsOut(rich, settings)).toBe(false);
  });

  it('never asks when there is no deal to ask out of', () => {
    expect(wantsOut(person({ morale: 0, contract: null }), settings)).toBe(false);
  });
});

describe('who asks to be let go, and who barely needs an excuse', () => {
  // Before this, the only question `wantsOut` could answer was "how unhappy
  // is he", so a loyal veteran and a Never Satisfied draw at the same morale
  // were exactly as likely to ask for a release.
  it('is much harder to move at the same morale, for a loyal one', () => {
    const morale = 25; // below the base 30 threshold for both
    const grateful = person({ morale, traits: ['gratefulForTheWork'], contract: deal() });
    const restless = person({ morale, traits: ['neverSatisfied'], contract: deal() });
    expect(wantsOut(grateful, settings)).toBe(false);
    expect(wantsOut(restless, settings)).toBe(true);
  });

  it('lets somebody ask sooner than the base line when nothing you book fixes it', () => {
    // No Time For The Office: "nothing you book changes it." A morale that
    // would not trigger the base threshold still triggers theirs.
    const morale = 38; // above the base 30 threshold
    const ordinary = person({ morale, contract: deal() });
    const dislikesUs = person({ morale, traits: ['noTimeForTheOffice'], contract: deal() });
    expect(wantsOut(ordinary, settings)).toBe(false);
    expect(wantsOut(dislikesUs, settings)).toBe(true);
  });

  it('asks out over money alone, for the one who is only here for it', () => {
    // In It For The Money reads its own contract every week that morale does
    // — and can want out before the mood has caught up with the number.
    const content = person({ morale: 80, traits: ['inItForTheMoney'], contract: deal({ weeklyRate: 300 }) });
    expect(wantsOut(content, settings)).toBe(false);
    expect(wantsOut(content, settings, { worth: 1000 })).toBe(true);
    // But not over a fair number, however unhappy that leaves them about
    // something else — this trait cares about the money and nothing else.
    expect(wantsOut(content, settings, { worth: 320 })).toBe(false);
  });

  it('is drawn toward wherever the partner already is, and only when they are apart', () => {
    const morale = 32; // above the base 30 threshold
    const home = person({ morale, traits: ['somebodyAtHome'], contract: deal() });
    expect(wantsOut(home, settings, { apartFromPartner: false })).toBe(false);
    expect(wantsOut(home, settings, { apartFromPartner: true })).toBe(true);
  });

  it('gives the locker room leader one more reason to stay', () => {
    const morale = 27; // below the base 30 threshold
    const ordinary = person({ morale, contract: deal() });
    const leader = person({ morale, traits: ['lockerRoomLeader'], contract: deal() });
    expect(wantsOut(ordinary, settings)).toBe(true);
    expect(wantsOut(leader, settings)).toBe(false);
  });
});
