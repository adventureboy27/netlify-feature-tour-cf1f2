// The rule this file holds: a record says what somebody did and where, and a
// match that got stopped is not a loss.

import { describe, expect, it } from 'vitest';
import { defaultWorldSettings } from '../world/settings';
import {
  appearances,
  clientsOf,
  credit,
  creditMatch,
  creditPay,
  decided,
  emptyLedger,
  emptyRecord,
  homeCompany,
  join,
  leave,
  openStint,
  recordLine,
  stintLine,
  tickWeek,
  totalsFor,
  winRate,
  yearsManaging,
  yearsWrestling,
} from './ledger';

const settings = defaultWorldSettings();

describe('a match that got stopped', () => {
  it('is never scored as a loss', () => {
    const r = emptyRecord();
    credit(r, 'dnf');
    expect(r.losses).toBe(0);
    expect(r.dnf).toBe(1);
  });

  it('does not count against a winning percentage', () => {
    // A man carried out on a stretcher did not lose, and holding it against
    // him would make every top-ten list a list of people who never got hurt.
    const clean = { wins: 5, losses: 5, draws: 0, dnf: 0 };
    const hurt = { wins: 5, losses: 5, draws: 0, dnf: 4 };
    expect(winRate(hurt)).toBe(winRate(clean));
  });

  it('still counts as having turned up', () => {
    const r = { wins: 5, losses: 5, draws: 0, dnf: 4 };
    expect(decided(r)).toBe(10);
    expect(appearances(r)).toBe(14);
  });

  it('shows on the page as a no-contest rather than hidden', () => {
    expect(recordLine({ wins: 12, losses: 3, draws: 1, dnf: 0 })).toBe('12-3-1');
    expect(recordLine({ wins: 12, losses: 3, draws: 1, dnf: 2 })).toBe('12-3-1 (2 NC)');
  });

  it('scores a draw as half a win and an empty record as nothing', () => {
    expect(winRate({ wins: 0, losses: 0, draws: 4, dnf: 0 })).toBe(0.5);
    expect(winRate(emptyRecord())).toBe(0);
  });
});

describe('two sets of books', () => {
  it('lands every match on the lifetime record and on the company', () => {
    const l = emptyLedger();
    join(l, 'p1', 'Atlas Pro', 'wrestler', 10);
    creditMatch(l, 'win');
    creditMatch(l, 'loss');
    expect(l.lifetime).toMatchObject({ wins: 1, losses: 1 });
    expect(openStint(l)!.record).toMatchObject({ wins: 1, losses: 1 });
  });

  it('keeps the lifetime total when a company is left behind', () => {
    // Not derived from the sum of stints: a lifetime figure that is the sum
    // of surviving spells loses everything somebody did for a promotion that
    // has since folded.
    const l = emptyLedger();
    join(l, 'p1', 'Gone Wrestling', 'wrestler', 10);
    creditMatch(l, 'win');
    leave(l, 60);
    l.stints = [];
    expect(l.lifetime.wins).toBe(1);
  });

  it('does not credit a company for a match worked after leaving', () => {
    const l = emptyLedger();
    join(l, 'p1', 'Atlas Pro', 'wrestler', 10);
    leave(l, 20);
    creditMatch(l, 'win');
    expect(l.lifetime.wins).toBe(1);
    expect(totalsFor(l, 'p1').record.wins).toBe(0);
  });

  it('remembers two separate spells at the same company, and adds them up', () => {
    const l = emptyLedger();
    join(l, 'p1', 'Atlas Pro', 'wrestler', 10);
    creditMatch(l, 'win');
    leave(l, 60);
    join(l, 'p2', 'Northern Combat', 'wrestler', 61);
    creditMatch(l, 'loss');
    leave(l, 100);
    join(l, 'p1', 'Atlas Pro', 'wrestler', 101);
    creditMatch(l, 'win');

    const atlas = totalsFor(l, 'p1');
    expect(atlas.spells).toBe(2);
    expect(atlas.record).toMatchObject({ wins: 2, losses: 0 });
    expect(totalsFor(l, 'p2').record).toMatchObject({ wins: 0, losses: 1 });
  });

  it('never leaves somebody under contract in two places', () => {
    const l = emptyLedger();
    join(l, 'p1', 'A', 'wrestler', 10);
    join(l, 'p2', 'B', 'wrestler', 20);
    expect(l.stints.filter((s) => s.leftWeek === null)).toHaveLength(1);
    expect(openStint(l)!.promotionId).toBe('p2');
    expect(l.stints[0]!.leftWeek).toBe(20);
  });
});

describe('money', () => {
  it('lands on the lifetime figure and on the company that paid it', () => {
    const l = emptyLedger();
    join(l, 'p1', 'Atlas Pro', 'wrestler', 10);
    creditPay(l, 1200);
    creditPay(l, 800);
    expect(l.earnings).toBe(2000);
    expect(totalsFor(l, 'p1').earnings).toBe(2000);
  });

  it('keeps each company’s share separate', () => {
    const l = emptyLedger();
    join(l, 'p1', 'A', 'wrestler', 10);
    creditPay(l, 1000);
    leave(l, 50);
    join(l, 'p2', 'B', 'wrestler', 51);
    creditPay(l, 5000);
    expect(totalsFor(l, 'p1').earnings).toBe(1000);
    expect(totalsFor(l, 'p2').earnings).toBe(5000);
    expect(l.earnings).toBe(6000);
  });

  it('ignores nothing-happened weeks rather than logging zeroes', () => {
    const l = emptyLedger();
    join(l, 'p1', 'A', 'wrestler', 10);
    creditPay(l, 0);
    creditPay(l, Number.NaN);
    expect(l.earnings).toBe(0);
  });
});

describe('time served', () => {
  it('counts weeks rather than subtracting dates', () => {
    const l = emptyLedger();
    join(l, 'p1', 'A', 'wrestler', 10);
    for (let i = 0; i < 52; i++) tickWeek(l);
    expect(totalsFor(l, 'p1').weeks).toBe(52);
    expect(yearsWrestling(l, settings)).toBe(1);
  });

  it('does not inflate wrestling years with years spent managing', () => {
    // The one that matters: a man who wrestled fifteen years and then managed
    // for ten has fifteen years in the ring, and a page that says twenty-five
    // is not rounding, it is wrong.
    const l = emptyLedger();
    join(l, 'p1', 'A', 'wrestler', 0);
    for (let i = 0; i < 52 * 15; i++) tickWeek(l);
    leave(l, 52 * 15);
    join(l, 'p1', 'A', 'manager', 52 * 15);
    for (let i = 0; i < 52 * 10; i++) tickWeek(l);

    expect(yearsWrestling(l, settings)).toBe(15);
    expect(yearsManaging(l, settings)).toBe(10);
  });

  it('does not retroactively convert years already banked', () => {
    const l = emptyLedger();
    join(l, 'p1', 'A', 'wrestler', 0);
    for (let i = 0; i < 100; i++) tickWeek(l);
    leave(l, 100);
    join(l, 'p1', 'A', 'manager', 100);
    tickWeek(l);
    expect(l.weeksAsWrestler).toBe(100);
    expect(l.weeksAsManager).toBe(1);
  });

  it('accrues nothing for somebody nobody has signed', () => {
    const l = emptyLedger();
    tickWeek(l);
    expect(l.weeksAsWrestler).toBe(0);
    expect(l.weeksAsManager).toBe(0);
  });

  it('names the company somebody gave the most of their career to', () => {
    const l = emptyLedger();
    join(l, 'p1', 'Atlas Pro', 'wrestler', 0);
    for (let i = 0; i < 300; i++) tickWeek(l);
    leave(l, 300);
    join(l, 'p2', 'Somewhere Else', 'wrestler', 301);
    for (let i = 0; i < 40; i++) tickWeek(l);
    expect(homeCompany(l)!.promotionName).toBe('Atlas Pro');
  });

  it('has no home to name for somebody who never signed anywhere', () => {
    expect(homeCompany(emptyLedger())).toBeNull();
  });
});

describe('managers', () => {
  it('keeps a manager’s record off their wrestling record', () => {
    const l = emptyLedger();
    join(l, 'p1', 'A', 'manager', 10);
    creditMatch(l, 'win', 'manager');
    expect(l.managing.wins).toBe(1);
    expect(l.lifetime.wins).toBe(0);
  });

  it('credits the company they were managing at, per clientele', () => {
    const l = emptyLedger();
    join(l, 'p1', 'A', 'manager', 10);
    creditMatch(l, 'win', 'manager');
    creditMatch(l, 'loss', 'manager');
    leave(l, 50);
    join(l, 'p2', 'B', 'manager', 51);
    creditMatch(l, 'win', 'manager');

    expect(totalsFor(l, 'p1').record).toMatchObject({ wins: 1, losses: 1 });
    expect(totalsFor(l, 'p2').record).toMatchObject({ wins: 1, losses: 0 });
    expect(l.managing).toMatchObject({ wins: 2, losses: 1 });
  });

  it('does not credit a wrestling stint with a night spent in a corner', () => {
    const l = emptyLedger();
    join(l, 'p1', 'A', 'wrestler', 10);
    creditMatch(l, 'win', 'manager');
    expect(totalsFor(l, 'p1').record.wins).toBe(0);
    expect(l.managing.wins).toBe(1);
  });

  it('counts as a client anybody whose corner they have recently worked', () => {
    const corners = [
      { managerId: 'm', wrestlerIds: ['a', 'b'], week: 100 },
      { managerId: 'm', wrestlerIds: ['a'], week: 104 },
      { managerId: 'other', wrestlerIds: ['z'], week: 104 },
    ];
    expect(clientsOf(corners, 'm', 105, settings).sort()).toEqual(['a', 'b']);
  });

  it('drops a client the moment they stop being booked with them', () => {
    // No client list to maintain — being at ringside is the relationship.
    const corners = [{ managerId: 'm', wrestlerIds: ['a'], week: 10 }];
    const longAfter = 10 + settings.ledgerClientWindowWeeks + 1;
    expect(clientsOf(corners, 'm', longAfter, settings)).toEqual([]);
  });
});

describe('how a career page reads it', () => {
  it('gives a spell a span and a record, with no dates in it', () => {
    const l = emptyLedger();
    join(l, 'p1', 'Atlas Pro', 'wrestler', 0);
    creditMatch(l, 'win');
    leave(l, 52 * 3);
    const line = stintLine(l.stints[0]!, settings);
    expect(line).toContain('Atlas Pro');
    expect(line).toContain('1-0-0');
    // Years, never a day of a month.
    expect(line).not.toMatch(/January|week \d/);
  });

  it('says a current spell is current', () => {
    const l = emptyLedger();
    join(l, 'p1', 'Atlas Pro', 'wrestler', 0);
    expect(stintLine(l.stints[0]!, settings)).toContain('present');
  });
});
