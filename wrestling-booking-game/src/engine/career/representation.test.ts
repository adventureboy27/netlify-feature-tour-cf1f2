// The rule this file holds: a manager earns from a percentage, so he wants
// more names — and every extra name makes him worse at the job.

import { describe, expect, it } from 'vitest';
import { defaultWorldSettings } from '../world/settings';
import { rngFromSeed } from '../rng';
import { generateWrestler } from '../generate/wrestler';
import { MANAGERS, managerById } from '../../data/ringsidePool';
import type { Representation } from './representation';
import {
  askingCut,
  attention,
  attentionOf,
  clientWouldWalk,
  condition,
  endRepresentation,
  managerWouldDrop,
  presenceAt,
  splitNote,
  travelBill,
  travelBurden,
  roadCost,
  wearLabel,
  bookLine,
  bookOf,
  clientCutLine,
  clientNets,
  cutOf,
  negotiatedRate,
  representativeOf,
  weeklyTake,
  wouldCourt,
  wouldStretchTooThin,
} from './representation';

const settings = defaultWorldSettings();
const rep = (managerId: string, clientId: string, cut = 0.2): Representation => ({
  managerId, clientId, cut, signedWeek: 1,
});

describe('the cut', () => {
  it('is bigger for a manager who argues harder', () => {
    const shark = { ...managerById('mgr-cornelius')!, negotiation: 95 };
    const pushover = { ...shark, negotiation: 10 };
    expect(askingCut(shark, settings)).toBeGreaterThan(askingCut(pushover, settings));
  });

  it('never asks for more than anybody would ever agree to', () => {
    for (const m of MANAGERS) {
      const cut = askingCut({ ...m, negotiation: 100 }, settings);
      expect(cut).toBeLessThanOrEqual(settings.repCutMax);
      expect(cut).toBeGreaterThanOrEqual(settings.repCutMin);
    }
  });

  it('comes out of the client’s purse, not out of thin air', () => {
    const r = rep('m', 'c', 0.25);
    expect(cutOf(1000, r)).toBe(250);
    expect(clientNets(1000, r)).toBe(750);
    expect(cutOf(1000, r) + clientNets(1000, r)).toBe(1000);
  });

  it('leaves an unrepresented wrestler with all of it', () => {
    expect(clientNets(1000, null)).toBe(1000);
  });
});

describe('what it costs the promotion', () => {
  it('makes a represented wrestler more expensive to sign', () => {
    // The whole triangle: the promotion pays more, the wrestler nets about
    // what he did, and the manager eats the difference.
    const agent = { ...managerById('mgr-cornelius')!, negotiation: 90 };
    expect(negotiatedRate(1000, agent, settings)).toBeGreaterThan(1000);
  });

  it('costs nothing extra for somebody who represents himself', () => {
    expect(negotiatedRate(1000, null, settings)).toBe(1000);
  });

  it('roughly leaves the wrestler where he started', () => {
    // He is not signing an agent to earn less. The promotion is the one
    // paying for it.
    const agent = { ...managerById('mgr-cornelius')!, negotiation: 80 };
    const before = 1000;
    const after = negotiatedRate(before, agent, settings);
    const netted = clientNets(after, rep('m', 'c', askingCut(agent, settings)));
    expect(netted).toBeGreaterThan(before * 0.85);
  });
});

describe('a book gets too heavy', () => {
  it('gives a man with one client all of himself', () => {
    expect(attention(1, settings)).toBe(1);
    expect(attention(0, settings)).toBe(1);
  });

  it('thins him out with every name he adds', () => {
    let last = Infinity;
    for (let n = 1; n <= 8; n++) {
      const here = attention(n, settings);
      expect(here).toBeLessThanOrEqual(last);
      last = here;
    }
  });

  it('never reaches zero — a distracted manager is still a manager', () => {
    expect(attention(50, settings)).toBeGreaterThanOrEqual(settings.repAttentionFloor);
  });

  it('makes collecting clients stop being free', () => {
    // Without this, signing everybody is strictly correct and the decision
    // evaporates. Two or three is the sweet spot; six is a man collecting
    // cheques and doing nobody any good.
    expect(attention(2, settings)).toBeGreaterThan(settings.repStretchedAt);
    expect(attention(3, settings)).toBeGreaterThan(settings.repStretchedAt);
    expect(attention(6, settings)).toBeLessThan(settings.repStretchedAt);
  });

  it('knows when one more would be one too many', () => {
    const reps = [rep('m', 'a'), rep('m', 'b'), rep('m', 'c'), rep('m', 'd')];
    expect(wouldStretchTooThin([], 'm', settings)).toBe(false);
    expect(wouldStretchTooThin(reps, 'm', settings)).toBe(true);
  });
});

describe('the book itself', () => {
  const reps = [rep('m', 'a', 0.2), rep('m', 'b', 0.1), rep('other', 'c', 0.3)];

  it('is only his own clients', () => {
    expect(bookOf(reps, 'm').map((r) => r.clientId)).toEqual(['a', 'b']);
  });

  it('finds who speaks for a given wrestler', () => {
    expect(representativeOf(reps, 'a')!.managerId).toBe('m');
    expect(representativeOf(reps, 'nobody')).toBeNull();
  });

  it('adds up what he earns across all of them', () => {
    // The salesman's incentive, stated: two clients at a smaller cut each can
    // beat one at a big one.
    expect(weeklyTake(reps, 'm', () => 1000)).toBe(300);
    expect(attentionOf(reps, 'm', settings)).toBeLessThan(1);
  });
});

describe('a manager on the make', () => {
  const manager = managerById('mgr-cornelius')!;
  const worthIt = { ...generateWrestler(rngFromSeed('a'), new Set()), popularity: 70 };
  const nobody = { ...generateWrestler(rngFromSeed('b'), new Set()), popularity: 5 };

  it('chases somebody already earning', () => {
    expect(wouldCourt(manager, worthIt, [], settings)).toBe(true);
  });

  it('does not chase a percentage of nothing', () => {
    expect(wouldCourt(manager, nobody, [], settings)).toBe(false);
  });

  it('will not poach somebody who already has a man', () => {
    expect(wouldCourt(manager, worthIt, [rep('other', worthIt.id)], settings)).toBe(false);
  });

  it('stops when his book is full', () => {
    const full = [rep(manager.id, 'a'), rep(manager.id, 'b'), rep(manager.id, 'c'), rep(manager.id, 'd')];
    expect(wouldCourt(manager, worthIt, full, settings)).toBe(false);
  });
});

describe('what the profiles show', () => {
  it('tells the wrestler what is leaving his purse', () => {
    const line = clientCutLine(rep('m', 'c', 0.2), 'Cornelius Vance III')!;
    expect(line).toContain('20%');
    expect(line).toContain('Cornelius Vance III');
  });

  it('says nothing for somebody who represents himself', () => {
    expect(clientCutLine(null, 'x')).toBeNull();
  });

  it('tells the manager what his book is worth, and whether he is spread thin', () => {
    const light = bookLine([rep('m', 'a')], 'm', () => 1000, settings);
    expect(light).toContain('1 client');
    expect(light).toContain('full attention');

    const heavy = bookLine(
      ['a', 'b', 'c', 'd', 'e', 'f'].map((c) => rep('m', c)),
      'm', () => 1000, settings,
    );
    expect(heavy).toContain('6 clients');
    expect(heavy).toMatch(/spread far too thin/);
  });

  it('says so plainly when he represents nobody', () => {
    expect(bookLine([], 'm', () => 1000, settings)).toBe('Represents nobody.');
  });
});

describe('the road itself wears him out', () => {
  it('costs nothing to represent nobody', () => {
    expect(roadCost(0, settings)).toBe(0);
  });

  it('costs more than proportionally as the book grows', () => {
    // Two clients in two towns is not twice one client. It is two towns and
    // the driving between them.
    expect(roadCost(2, settings)).toBeGreaterThan(roadCost(1, settings) * 2 * 0.9);
    expect(roadCost(6, settings) / 6).toBeGreaterThan(roadCost(1, settings));
  });

  it('leaves a fresh man with everything he has', () => {
    expect(condition({ fatigueDebt: 0, energy: 100 }, settings)).toBe(1);
  });

  it('takes a real bite out of somebody who is running on empty', () => {
    const spent = condition({ fatigueDebt: 95, energy: 10 }, settings);
    expect(spent).toBeLessThan(0.6);
    expect(spent).toBeGreaterThanOrEqual(settings.repWearFloor);
  });

  it('compounds with being spread thin, which neither does alone', () => {
    // A fat book makes him immediately worse at each job *and* worse at all
    // of them over months. That is the whole point of having both.
    const reps = ['a', 'b', 'c', 'd'].map((c) => rep('m', c));
    const fresh = presenceAt(reps, 'm', { fatigueDebt: 0, energy: 100 }, settings);
    const shot = presenceAt(reps, 'm', { fatigueDebt: 90, energy: 15 }, settings);
    expect(shot).toBeLessThan(fresh);
    expect(fresh).toBeLessThan(1);
  });

  it('falls back to spread alone when there is nobody to read', () => {
    const reps = [rep('m', 'a'), rep('m', 'b')];
    expect(presenceAt(reps, 'm', null, settings)).toBe(attention(2, settings));
  });

  it('says how he is holding up in words, and nothing at all when he is fine', () => {
    expect(wearLabel({ fatigueDebt: 0, energy: 100 }, settings)).toBeNull();
    expect(wearLabel({ fatigueDebt: 95, energy: 5 }, settings)).toBe('Running on fumes');
    for (const w of [{ fatigueDebt: 50, energy: 50 }, { fatigueDebt: 95, energy: 5 }]) {
      expect(wearLabel(w, settings)).not.toMatch(/\d/);
    }
  });
});

describe('getting out of it', () => {
  const client = { charisma: 30, popularity: 60 };

  it('lets the client sack a man who is never there', () => {
    // The client is the one who can see the bill, and an over-committed
    // manager is exactly what an absentee looks like from underneath.
    expect(clientWouldWalk(rep('m', 'c', 0.25), client, 0.2, settings)).toBe('notWorthTheCut');
  });

  it('keeps a man who is actually turning up', () => {
    expect(clientWouldWalk(rep('m', 'c', 0.25), client, 0.95, settings)).toBeNull();
  });

  it('lets somebody who has learned to talk do their own talking', () => {
    const grown = { charisma: 95, popularity: 80 };
    expect(clientWouldWalk(rep('m', 'c', 0.1), grown, 1, settings)).toBe('outgrewHim');
  });

  it('lets a worn-out manager drop somebody, and drops the one paying least', () => {
    // Not the newest — the one earning him least. This is a business.
    const reps = [rep('m', 'rich', 0.3), rep('m', 'poor', 0.3), rep('m', 'mid', 0.3)];
    const rates: Record<string, number> = { rich: 5000, poor: 200, mid: 1500 };
    const shot = { fatigueDebt: 95, energy: 10 };
    const dropped = managerWouldDrop(reps, 'm', shot, (id) => rates[id] ?? 0, settings);
    expect(dropped!.rep.clientId).toBe('poor');
    expect(dropped!.reason).toBe('droppedForTheBook');
  });

  it('will not leave a fresh manager with nobody over one bad client', () => {
    const fresh = { fatigueDebt: 0, energy: 100 };
    const reps = [rep('m', 'only', 0.3)];
    expect(managerWouldDrop(reps, 'm', fresh, () => 5000, settings)).toBeNull();
  });

  it('drops somebody who is not worth the diary space at all', () => {
    const reps = [rep('m', 'nobody', 0.1)];
    const fresh = { fatigueDebt: 0, energy: 100 };
    expect(managerWouldDrop(reps, 'm', fresh, () => 50, settings)!.reason).toBe('notEarningEnough');
  });

  it('actually removes the deal, and only that one', () => {
    const reps = [rep('m', 'a'), rep('m', 'b')];
    const after = endRepresentation(reps, 'a');
    expect(after.map((r) => r.clientId)).toEqual(['b']);
  });

  it('says who ended it and why, by name', () => {
    for (const reason of ['notWorthTheCut', 'outgrewHim', 'droppedForTheBook', 'notEarningEnough'] as const) {
      const note = splitNote(reason, 'Duke Rawlins', 'Cornelius Vance III');
      expect(note).toContain('Duke Rawlins');
      expect(note).toContain('Cornelius Vance III');
      expect(note).not.toMatch(/\d/);
    }
  });
});

describe('getting to work', () => {
  it('costs the person travelling, unless their deal covers it', () => {
    expect(travelBill(3, false, settings)).toBeGreaterThan(0);
    expect(travelBill(3, true, settings)).toBe(0);
  });

  it('costs nothing to somebody who did not have to be anywhere', () => {
    expect(travelBill(0, false, settings)).toBe(0);
  });

  it('scales with how many nights they had to turn up', () => {
    expect(travelBill(5, false, settings)).toBeGreaterThan(travelBill(2, false, settings));
  });

  it('is a real slice of a hand’s purse and pocket change to a star', () => {
    // Which is exactly who ends up with the clause, and what makes it worth
    // arguing for — it bought a wrestler nothing at all before this existed.
    expect(travelBurden(400, 3, settings)).toBeGreaterThan(0.3);
    expect(travelBurden(20_000, 3, settings)).toBeLessThan(0.05);
  });
});
