// The rule this file holds: where somebody sits on the card is a read of what
// is true right now, in this company — never a label stamped at birth.

import { describe, expect, it } from 'vitest';
import { rngFromSeed } from '../rng';
import { defaultWorldSettings } from '../world/settings';
import { generateWrestler } from '../generate/wrestler';
import { styleProfileFor, PROMOTION_ARCHETYPES } from '../../data/promotionIdentity';
import type { CardStatus, Promotion, Wrestler } from '../types';
import { overnessIn } from './fit';
import {
  bandFor,
  caughtFire,
  hotCommodities,
  isAbove,
  mainEventPicture,
  statusFor,
  statusMove,
  statusOf,
  trajectoryLabel,
  type StatusContext,
} from './cardStatus';

const settings = defaultWorldSettings();

function person(seed: string, over: Partial<Wrestler> = {}): Wrestler {
  return { ...generateWrestler(rngFromSeed(seed), new Set(), { currentYear: 2030 }), ...over };
}

function company(id: string, identity: Promotion['identity'] = 'sportsEntertainment'): Promotion {
  return {
    id, name: id, identity, isPlayer: false, rating: 55, bankBalance: 1e6,
    rosterIds: [], titleIds: [], ownedTerritoryIds: [], homeTerritoryId: 't1',
    styleProfile: styleProfileFor(identity), bookingCredibility: 50, reputation: 50,
    hardcoreSaturation: 0, recentShowQuality: 50, weeksInTheRed: 0, closedWeek: null,
    ownerId: 'o', ownerPersonality: 'traditionalist', ppvCalendar: [],
  };
}

function ctx(over: Partial<StatusContext> = {}): StatusContext {
  return { current: 'midcard', standing: 45, momentum: 50, matches: 100, ...over };
}

describe('the ladder', () => {
  it('runs top to bottom and knows which way is up', () => {
    expect(isAbove('mainEventer', 'midcard')).toBe(true);
    expect(isAbove('enhancement', 'lowerCard')).toBe(false);
    expect(isAbove('midcard', 'midcard')).toBe(false);
  });

  it('puts each band above the next', () => {
    const s = settings;
    expect(bandFor(s.cardMainEventAt, s)).toBe('mainEventer');
    expect(bandFor(s.cardUpperMidcardAt, s)).toBe('upperMidcard');
    expect(bandFor(s.cardMidcardAt, s)).toBe('midcard');
    expect(bandFor(s.cardLowerCardAt, s)).toBe('lowerCard');
    expect(bandFor(0, s)).toBe('enhancement');
  });

  it('is monotonic — more over is never a lower spot', () => {
    let last = 'enhancement' as CardStatus;
    for (let standing = 0; standing <= 100; standing += 1) {
      const here = bandFor(standing, settings);
      expect(isAbove(last, here)).toBe(false);
      last = here;
    }
  });
});

describe('nobody is anything until they have worked', () => {
  it('leaves a signing with no matches a prospect, whatever the scouting said', () => {
    expect(statusFor(ctx({ matches: 0, standing: 90, current: 'prospect' }), settings)).toBe('prospect');
  });

  it('lets them onto the ladder once they have', () => {
    expect(statusFor(ctx({ matches: settings.cardMinMatches, standing: 90 }), settings)).toBe('mainEventer');
  });
});

describe('it moves', () => {
  it('promotes somebody the crowd has moved to', () => {
    expect(statusFor(ctx({ current: 'midcard', standing: 80 }), settings)).toBe('mainEventer');
  });

  it('brings a main eventer down when he stops drawing', () => {
    // The thing that was impossible before: a main eventer was a main eventer
    // for thirty years regardless.
    expect(statusFor(ctx({ current: 'mainEventer', standing: 10 }), settings)).toBe('enhancement');
  });

  it('does not drop somebody off the top the first bad month', () => {
    // Just under the main event line, having been a main eventer, stays one —
    // the audience remembers who you were for a while after you stop being it.
    const justBelow = settings.cardMainEventAt - Math.floor(settings.cardFallCushion / 2);
    expect(statusFor(ctx({ current: 'mainEventer', standing: justBelow }), settings)).toBe('mainEventer');
  });

  it('gives no cushion at all on the way up', () => {
    // Stickiness is a thing you earn by having been there, not a free half
    // band for everybody.
    const justBelow = settings.cardMainEventAt - 1;
    expect(statusFor(ctx({ current: 'midcard', standing: justBelow }), settings)).toBe('upperMidcard');
  });
});

describe('somebody catches fire', () => {
  const austin = ctx({ current: 'lowerCard', standing: 60, momentum: 95, matches: 200 });

  it('jumps a man out of the lower card without the year in between', () => {
    expect(caughtFire(austin, settings)).toBe(true);
    const after = statusFor(austin, settings);
    expect(isAbove(after, 'lowerCard')).toBe(true);
    // Two bands, which is what makes it read as overnight rather than as the
    // ladder working normally.
    expect(after).toBe('upperMidcard');
  });

  it('will not do it on a hot streak alone', () => {
    // Momentum with no crowd behind it is somebody the booker has been
    // protecting, not a star.
    expect(caughtFire({ ...austin, standing: 20 }, settings)).toBe(false);
  });

  it('will not do it for somebody nobody has seen', () => {
    expect(caughtFire({ ...austin, matches: 1 }, settings)).toBe(false);
  });

  it('cannot happen to somebody already at the top', () => {
    // A main eventer cannot catch fire. He can only stop being one.
    expect(caughtFire({ ...austin, current: 'mainEventer' }, settings)).toBe(false);
    expect(caughtFire({ ...austin, current: 'upperMidcard' }, settings)).toBe(false);
  });

  it('never invents a main eventer out of a man nobody has heard of', () => {
    // Catching fire moves somebody up the queue. It does not overrule the
    // crowd — the jump is capped by what his standing will actually carry.
    const barely = ctx({
      current: 'enhancement',
      standing: settings.cardBreakoutStanding,
      momentum: 95,
      matches: 200,
    });
    expect(caughtFire(barely, settings)).toBe(true);
    expect(statusFor(barely, settings)).toBe('midcard');
  });
});

describe('the same man, two companies', () => {
  it('can be a main eventer in one room and not in the other', () => {
    // The whole reason this reads `overnessIn` rather than popularity: a
    // status ladder that ignored fit would contradict career/fit.ts.
    const rooms = PROMOTION_ARCHETYPES.map((a, i) => company(`c-${i}`, a));
    // Found by measurement rather than assumed: not everybody's fit spread
    // straddles a band boundary, and picking one man and hoping tests the
    // seed rather than the rule. Measured, 55% of the roster at this
    // popularity sits in two different bands depending on the company.
    const spanning: Wrestler[] = [];
    for (let i = 0; i < 60 && spanning.length === 0; i++) {
      const candidate = person(`t-${i}`, { popularity: 74 });
      const w: Wrestler = { ...candidate, career: { ...candidate.career, matches: 200 } };
      const bands = new Set(rooms.map((r) => statusOf({ ...w, cardStatus: 'midcard' }, r, settings)));
      if (bands.size > 1) spanning.push(w);
    }
    expect(spanning).toHaveLength(1);
    const w = spanning[0]!;

    const best = rooms.reduce((x, y) => (overnessIn(w, y, settings) > overnessIn(w, x, settings) ? y : x));
    const worst = rooms.reduce((x, y) => (overnessIn(w, y, settings) < overnessIn(w, x, settings) ? y : x));

    const here = statusOf({ ...w, cardStatus: 'midcard' }, best, settings);
    const there = statusOf({ ...w, cardStatus: 'midcard' }, worst, settings);
    expect(isAbove(here, there)).toBe(true);
  });
});

describe('who is in the picture', () => {
  function roster(): Wrestler[] {
    const base = person('r');
    const withMatches = (over: Partial<Wrestler>) => ({
      ...base,
      ...over,
      career: { ...base.career, matches: 200 },
    });
    return [
      withMatches({ id: 'top', name: 'Top', popularity: 90, cardStatus: 'mainEventer', momentum: 60 }),
      withMatches({ id: 'next', name: 'Next', popularity: 62, cardStatus: 'upperMidcard', momentum: 55 }),
      // Popularity chosen so he clears the midcard line in *any* room: fit
      // runs 0.72-1.28, so 45 could land him under it on a bad pairing and
      // this would be testing the chemistry hash rather than the picture.
      withMatches({ id: 'climbing', name: 'Climbing', popularity: 55, cardStatus: 'midcard', momentum: 90 }),
      withMatches({ id: 'filler', name: 'Filler', popularity: 30, cardStatus: 'lowerCard', momentum: 40 }),
      withMatches({ id: 'hurt', name: 'Hurt', popularity: 88, cardStatus: 'mainEventer', momentum: 70, injury: { description: 'knee', weeksRemaining: 8, severity: 'moderate' } as Wrestler['injury'] }),
    ];
  }

  it('shows the top of the card and the people coming for it', () => {
    const picture = mainEventPicture(roster(), company('p'), settings);
    const ids = picture.map((c) => c.wrestlerId);
    expect(ids).toContain('top');
    expect(ids).toContain('next');
    // Somebody climbing hard belongs in the picture *before* he arrives —
    // that is the whole point of planning a main event story.
    expect(ids).toContain('climbing');
    expect(ids).not.toContain('filler');
  });

  it('leaves out somebody who cannot work', () => {
    // You cannot plan a title run around a man with eight weeks on a knee.
    expect(mainEventPicture(roster(), company('p'), settings).map((c) => c.wrestlerId)).not.toContain('hurt');
  });

  it('sorts it so the man to build around is first', () => {
    const picture = mainEventPicture(roster(), company('p'), settings);
    expect(picture[0]!.wrestlerId).toBe('top');
  });

  it('lists the hot ones wherever they sit on the card', () => {
    const hot = hotCommodities(roster(), company('p'), settings);
    expect(hot.map((c) => c.wrestlerId)).toContain('climbing');
    expect(hot.map((c) => c.wrestlerId)).not.toContain('filler');
  });
});

describe('what gets said about it', () => {
  it('says a move happened, once, and never a number', () => {
    const w = { name: 'Vance Mercer' };
    expect(statusMove(w, 'midcard', 'midcard', false).kind).toBe('none');

    const up = statusMove(w, 'midcard', 'upperMidcard', false);
    expect(up.kind).toBe('rose');
    if (up.kind === 'rose') expect(up.note).toContain('Vance Mercer');

    const down = statusMove(w, 'mainEventer', 'midcard', false);
    expect(down.kind).toBe('fell');

    const fire = statusMove(w, 'lowerCard', 'midcard', true);
    expect(fire.kind).toBe('caughtFire');
    if (fire.kind === 'caughtFire') expect(fire.note).not.toMatch(/\d/);
  });

  it('describes direction in words, and says nothing about most people', () => {
    expect(trajectoryLabel({ momentum: 90, cardStatus: 'midcard' }, settings)).toBe('On the way up');
    expect(trajectoryLabel({ momentum: 10, cardStatus: 'midcard' }, settings)).toBe('Going backwards');
    expect(trajectoryLabel({ momentum: 50, cardStatus: 'midcard' }, settings)).toBeNull();
  });
});
