// What a company remembers about working with you.
//
// The property that makes the supershow a relationship rather than a dice
// roll: taking the whole card has to cost something later. If a burial is ever
// free, the split stops being a decision.

import { describe, expect, it } from 'vitest';
import {
  burialShare,
  grudgeFromNight,
  rememberNight,
  addGrudge,
  decayGrudge,
  decayGrudges,
  grudgeAgainst,
  grudgeLine,
  type Grudge,
} from './grudges';
import { defaultWorldSettings } from './settings';

const settings = defaultWorldSettings();
const night = (playerWins: number, partnerWins: number, showStars = 4) => ({
  playerWins,
  partnerWins,
  showStars,
});

describe('how one-sided the night was', () => {
  it('reads a clean sweep as a sweep and an even card as even', () => {
    expect(burialShare(9, 0)).toBe(1);
    expect(burialShare(0, 9)).toBe(0);
    expect(burialShare(4, 4)).toBe(0.5);
  });

  it('calls a night with no decisive finishes even rather than a massacre', () => {
    expect(burialShare(0, 0)).toBe(0.5);
  });
});

describe('what the night earns you', () => {
  it('costs a lot to bury somebody on a joint card', () => {
    expect(grudgeFromNight(night(9, 0), settings)).toBeGreaterThan(40);
  });

  it('climbs steeply rather than evenly, so three quarters is far worse than three fifths', () => {
    const threeFifths = grudgeFromNight(night(6, 4), settings);
    const threeQuarters = grudgeFromNight(night(9, 3), settings);
    expect(threeQuarters).toBeGreaterThan(threeFifths * 2.5);
  });

  it('earns goodwill back for putting the other company over', () => {
    expect(grudgeFromNight(night(1, 8), settings)).toBeLessThan(0);
  });

  it('gives back much less than it takes — the asymmetry is the design', () => {
    // Otherwise a booker could bury them one year and buy it back the next,
    // and the decision would cost nothing across a career.
    const buried = grudgeFromNight(night(9, 0), settings);
    const generous = Math.abs(grudgeFromNight(night(0, 9), settings));
    expect(generous).toBeLessThan(buried / 3);
  });

  it('annoys everybody a little when the show itself was a flop', () => {
    expect(grudgeFromNight(night(4, 4, 1), settings)).toBeGreaterThan(
      grudgeFromNight(night(4, 4, 5), settings),
    );
  });

  it('minds a flop much less than a burial', () => {
    // Nobody minds losing on a great night nearly as much as being buried on
    // a bad one, and the numbers have to agree.
    const flopButEven = grudgeFromNight(night(4, 4, 0), settings);
    const buriedButGreat = grudgeFromNight(night(9, 0, 5), settings);
    expect(buriedButGreat).toBeGreaterThan(flopButEven * 2);
  });
});

describe('the ledger', () => {
  it('opens a grudge on a bad night and stacks a second one on top', () => {
    const first = rememberNight(undefined, 'rival-1', night(9, 0), 10, settings)!;
    expect(first.promotionId).toBe('rival-1');
    expect(first.resentment).toBeGreaterThan(0);

    const second = rememberNight(first, 'rival-1', night(9, 0), 62, settings)!;
    expect(second.resentment).toBeGreaterThan(first.resentment);
    expect(second.since).toBe(62);
  });

  it('never carries more than a whole grudge', () => {
    let g: Grudge | null = null;
    for (let i = 0; i < 20; i += 1) g = rememberNight(g ?? undefined, 'rival-1', night(9, 0), i, settings);
    expect(g!.resentment).toBe(100);
  });

  it('holds nothing at all against a straight dealer', () => {
    expect(rememberNight(undefined, 'rival-1', night(0, 9), 4, settings)).toBeNull();
  });

  it('lets goodwill work a burial off, given enough good nights', () => {
    const buried = rememberNight(undefined, 'rival-1', night(9, 0), 1, settings)!;
    let g: Grudge | null = buried;
    for (let i = 0; i < 10 && g; i += 1) g = rememberNight(g, 'rival-1', night(0, 9), i, settings);
    expect(g).toBeNull();
  });

  it('says why, and names it a burial when it was one', () => {
    const g = rememberNight(undefined, 'rival-1', night(9, 0), 1, settings)!;
    expect(g.reason).toMatch(/buried/i);
    expect(grudgeLine(g, 'Atlas Pro')).toMatch(/Atlas Pro has not forgotten/);
    expect(grudgeLine(undefined, 'Atlas Pro')).toBeNull();
  });
});

describe('adding a grudge for something other than a joint night', () => {
  it('opens a fresh grudge with the reason given', () => {
    const g = addGrudge(undefined, 'rival-1', 20, 'You took their guy.', 10)!;
    expect(g.promotionId).toBe('rival-1');
    expect(g.resentment).toBe(20);
    expect(g.reason).toBe('You took their guy.');
    expect(g.since).toBe(10);
  });

  it('stacks on top of an existing grudge rather than replacing it', () => {
    const first = addGrudge(undefined, 'rival-1', 20, 'first', 1)!;
    const second = addGrudge(first, 'rival-1', 15, 'second', 5)!;
    expect(second.resentment).toBe(35);
    expect(second.since).toBe(5);
  });

  it('never carries more than a whole grudge', () => {
    const g = addGrudge(undefined, 'rival-1', 500, 'a lot at once', 1)!;
    expect(g.resentment).toBe(100);
  });

  it('drops to nothing rather than going negative, same as a night can', () => {
    const existing = addGrudge(undefined, 'rival-1', 10, 'a little', 1)!;
    expect(addGrudge(existing, 'rival-1', -50, 'made up for it', 2)).toBeNull();
  });
});

describe('forgetting', () => {
  const g = (resentment: number): Grudge => ({
    promotionId: 'rival-1',
    resentment,
    reason: 'x',
    since: 1,
  });

  it('fades a little every week', () => {
    expect(decayGrudge(g(50), settings)!.resentment).toBeLessThan(50);
  });

  it('is forgotten eventually, and dropped rather than kept at nothing', () => {
    expect(decayGrudge(g(1), settings)).toBeNull();
  });

  it('takes long enough that a burial costs you the next season', () => {
    // The supershow runs twice a year, so a grudge that faded inside 26 weeks
    // would never actually be paid for.
    let carried: Grudge | null = rememberNight(undefined, 'rival-1', night(9, 0), 1, settings);
    let weeks = 0;
    while (carried && weeks < 200) {
      carried = decayGrudge(carried, settings);
      weeks += 1;
    }
    expect(weeks).toBeGreaterThan(26);
  });

  it('ages a whole ledger and clears out the ones that are done', () => {
    const ledger = [g(50), g(1)];
    const after = decayGrudges(ledger, settings);
    expect(after).toHaveLength(1);
    expect(grudgeAgainst(after, 'rival-1')).toBeDefined();
    expect(grudgeAgainst(after, 'nobody')).toBeUndefined();
  });
});
