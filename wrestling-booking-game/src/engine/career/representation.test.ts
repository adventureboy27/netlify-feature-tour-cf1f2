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
