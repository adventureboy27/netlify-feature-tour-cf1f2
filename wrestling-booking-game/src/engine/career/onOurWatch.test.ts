import { describe, expect, it } from 'vitest';
import {
  compassionateLeave,
  leaveLine,
  leaveStatusLine,
  mostRecentDeath,
  ourPrice,
  refusalLine,
  riskPremium,
  roomMoraleCost,
  roomLine,
  stillHeldAgainstUs,
  tickLeave,
  wontRenewLine,
  wontWorkForUs,
  blameLine,
  negligenceOf,
  officeShare,
  shunLine,
  shunned,
  type DeathOnOurWatch,
} from './onOurWatch';
import { HE, SHE } from './pronouns';
import { defaultWorldSettings } from '../world/settings';
import type { Wrestler } from '../types';

const settings = defaultWorldSettings();

function man(selfPreservation: number): Wrestler {
  return { id: 'w1', name: 'Duke Rawlins', selfPreservation } as Wrestler;
}

function death(week: number, name = 'Earl Mercer'): DeathOnOurWatch {
  return { wrestlerId: `d${week}`, name, week };
}

describe('how long it is held against you', () => {
  it('is heaviest the week it happens and gone once it is old enough', () => {
    expect(stillHeldAgainstUs([death(100)], 100, settings)).toBeCloseTo(1);
    expect(stillHeldAgainstUs([death(100)], 100 + settings.watchMemoryWeeks, settings)).toBe(0);
  });

  it('is worse for a company that has done it more than once', () => {
    // Two deaths a year apart are held against you harder than the freshest
    // one alone — a pattern is not the same as an accident.
    const old = stillHeldAgainstUs([death(60)], 100, settings);
    const both = stillHeldAgainstUs([death(60), death(96)], 100, settings);
    expect(both).toBeGreaterThan(old);
  });

  it('holds nothing against a company that has not killed anybody', () => {
    expect(stillHeldAgainstUs([], 100, settings)).toBe(0);
  });

  it('names the most recent one, which is the one people talk about', () => {
    expect(mostRecentDeath([death(60, 'Earl'), death(96, 'Vern')])?.name).toBe('Vern');
    expect(mostRecentDeath([])).toBeNull();
  });
});

describe('what the market charges you for it', () => {
  it('costs nothing until it happens, and more the fresher it is', () => {
    expect(riskPremium(0, settings)).toBe(1);
    expect(ourPrice(1000, 0, settings)).toBe(1000);
    expect(ourPrice(1000, 1, settings)).toBeGreaterThan(1000);
    expect(ourPrice(1000, 1, settings)).toBeGreaterThan(ourPrice(1000, 0.4, settings));
  });

  it('has a ceiling — it prices you, it does not price you out', () => {
    expect(riskPremium(1, settings)).toBeLessThan(2);
  });
});

describe('who stops taking your calls', () => {
  it('nobody, before it happens', () => {
    expect(wontWorkForUs(man(95), 0, settings)).toBe(false);
  });

  it('the ones who look after themselves, while it is fresh', () => {
    // The whole point of this being derived from self-preservation rather
    // than rolled: the man who has been taking the insurance and the weeks
    // off is exactly the man who reads what happened and stays away.
    expect(wontWorkForUs(man(95), 1, settings)).toBe(true);
    expect(wontWorkForUs(man(20), 1, settings)).toBe(false);
  });

  it('gives the same answer every time it is asked', () => {
    const same = man(95);
    expect(wontWorkForUs(same, 0.8, settings)).toBe(wontWorkForUs(same, 0.8, settings));
  });

  it('says so in words rather than leaving a dead button', () => {
    expect(refusalLine('Duke Rawlins', 'Earl Mercer', HE)).toContain('Earl Mercer');
  });
});

describe('the month off', () => {
  it('is four weeks, paid, and says why', () => {
    const leave = compassionateLeave('Earl Mercer', settings, HE);
    expect(leave.weeksRemaining).toBe(settings.watchLeaveWeeks);
    expect(leave.paid).toBe(true);
    expect(leave.reason).toContain('Earl Mercer');
    expect(leave.reason).toContain('full pay');
  });

  it('counts down and then it is over', () => {
    let leave = compassionateLeave('Earl Mercer', settings, HE) as ReturnType<typeof compassionateLeave> | null;
    for (let i = 1; i < settings.watchLeaveWeeks; i++) {
      leave = tickLeave(leave!);
      expect(leave).not.toBeNull();
    }
    expect(tickLeave(leave!)).toBeNull();
  });

  it('reads as time away rather than as an injury', () => {
    const said = leaveStatusLine(compassionateLeave('Earl Mercer', settings, HE));
    expect(said).toContain('Away');
    expect(said.toLowerCase()).not.toContain('injur');
  });

  it('names everybody who was out there, however many that is', () => {
    expect(leaveLine(['A'], 'Earl', settings)).toContain('A is off');
    const three = leaveLine(['A', 'B', 'C'], 'Earl', settings);
    expect(three).toContain('A, B and C');
    expect(three).toContain('are off');
  });
});

describe('the room', () => {
  it('takes a hit, and it is aimed at the office rather than at the man', () => {
    expect(roomMoraleCost(settings)).toBeLessThan(0);
    expect(roomLine('Earl Mercer', 'Ironbelt Wrestling', HE)).toContain('Ironbelt Wrestling');
  });
});

describe('and then it stops', () => {
  // The point of the whole module. It is an aftershock, not a permanent fact
  // about the company — once the business has filed it as an unfortunate
  // thing that happened, nothing about a new contract is different from one
  // signed before any of it.
  const old = [death(10)];
  const later = 10 + settings.watchMemoryWeeks;

  it('holds nothing against you once the memory is out', () => {
    expect(stillHeldAgainstUs(old, later, settings)).toBe(0);
  });

  it('charges nothing extra, at either table', () => {
    const weight = stillHeldAgainstUs(old, later, settings);
    expect(ourPrice(1234, weight, settings)).toBe(1234);
    expect(riskPremium(weight, settings)).toBe(1);
  });

  it('and nobody refuses any more, however careful they are', () => {
    const weight = stillHeldAgainstUs(old, later, settings);
    expect(wontWorkForUs(man(100), weight, settings)).toBe(false);
  });

  it('is still shrinking the week before it goes', () => {
    // Not a cliff at the end of two years: the price comes down every week,
    // so a booker who waits sees it getting cheaper rather than nothing at
    // all followed by everything at once.
    const nearly = stillHeldAgainstUs(old, later - 1, settings);
    const halfway = stillHeldAgainstUs(old, 10 + settings.watchMemoryWeeks / 2, settings);
    expect(nearly).toBeGreaterThan(0);
    expect(nearly).toBeLessThan(halfway);
  });
});

describe('whose fault the room decides it was', () => {
  function worker(over: Partial<Wrestler> = {}): Wrestler {
    return {
      id: 'o1',
      name: 'Cyclone',
      skill: 70,
      selfPreservation: 60,
      discipline: { violations: [], finesPaid: 0, suspendedUntilWeek: null },
      ...over,
    } as Wrestler;
  }

  it('blames nobody much for a safe hand in a match he can work', () => {
    expect(negligenceOf(worker({ skill: 90 }), 0, settings)).toBeLessThan(0.35);
  });

  it('blames the man who was out of his depth', () => {
    const green = negligenceOf(worker({ skill: 20 }), 3, settings);
    const safe = negligenceOf(worker({ skill: 95 }), 3, settings);
    expect(green).toBeGreaterThan(safe);
  });

  it('blames the man with a file, and the man who does not look after himself', () => {
    const clean = negligenceOf(worker(), 2, settings);
    const filed = negligenceOf(
      worker({ discipline: { violations: [{}, {}, {}, {}] as never, finesPaid: 0, suspendedUntilWeek: null } }),
      2,
      settings,
    );
    const careless = negligenceOf(worker({ selfPreservation: 5 }), 2, settings);
    expect(filed).toBeGreaterThan(clean);
    // A man who does not protect himself does not protect you either.
    expect(careless).toBeGreaterThan(clean);
  });

  it('never lets the office off entirely', () => {
    // It still said a hurt man could work. Whoever else had a hand in it, the
    // company does not get to walk away clean.
    expect(officeShare(true, settings)).toBeGreaterThan(0);
    expect(officeShare(true, settings)).toBeLessThan(officeShare(false, settings));
    expect(officeShare(false, settings)).toBe(1);
  });

  it('prices a blamed death more gently than one that was all ours', () => {
    const ours: DeathOnOurWatch = { ...death(100), blame: 1 };
    const his: DeathOnOurWatch = { ...death(100), blame: officeShare(true, settings) };
    expect(stillHeldAgainstUs([his], 100, settings)).toBeLessThan(stillHeldAgainstUs([ours], 100, settings));
    expect(stillHeldAgainstUs([his], 100, settings)).toBeGreaterThan(0);
  });

  it('reads an old save with no blame recorded as all ours', () => {
    expect(stillHeldAgainstUs([death(100)], 100, settings)).toBeCloseTo(1);
  });
});

describe('the man nobody will work with', () => {
  const blame = { wrestlerId: 'dead', name: 'Earl Mercer', week: 100 };

  it('is shunned while it is fresh and workable again after', () => {
    expect(shunned(blame, 100, settings)).toBe(true);
    expect(shunned(blame, 100 + settings.watchShunWeeks - 1, settings)).toBe(true);
    expect(shunned(blame, 100 + settings.watchShunWeeks, settings)).toBe(false);
  });

  it('leaves everybody else alone', () => {
    expect(shunned(null, 100, settings)).toBe(false);
    expect(shunned(undefined, 100, settings)).toBe(false);
  });

  it('says who and how much longer, rather than a bare status', () => {
    const said = shunLine(blame, 110, settings, HE);
    expect(said).toContain('Earl Mercer');
    expect(said).toContain(`${settings.watchShunWeeks - 10} weeks`);
  });

  it('aims the sentence at the man rather than at the office', () => {
    expect(blameLine('Cyclone', 'Earl Mercer')).toContain('not blaming the office');
    expect(blameLine('Cyclone', 'Earl Mercer')).toContain('Cyclone');
  });
});

describe('the roster is not all men', () => {
  // Caught twice now: once on the free-agent list under Deacon Yolanda's
  // name, and again when a whole session of new systems went in saying "he"
  // about everybody. Every line that names a person takes pronouns.
  it('says she about a woman, everywhere', () => {
    const blame = { wrestlerId: 'dead', name: 'Earl Mercer', week: 100 };
    const lines = [
      roomLine('Josie Voss', 'Ironbelt Wrestling', SHE),
      refusalLine('Josie Voss', 'Earl Mercer', SHE),
      wontRenewLine('Josie Voss', 'Earl Mercer', SHE),
      shunLine(blame, 110, settings, SHE),
      compassionateLeave('Earl Mercer', settings, SHE).reason,
    ];
    for (const line of lines) {
      expect(line, line).not.toMatch(/\b(he|him|his)\b/i);
    }
  });
});
