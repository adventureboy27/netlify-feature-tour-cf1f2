import { describe, expect, it } from 'vitest';
import { deliveryBonus, demandsDelivered, fanDemands, signingOpportunities, type DemandContext } from './fanDemand';
import { recallBookings } from '../sim/freshness';
import { createStartingTitles } from '../../data/titles';
import { defaultWorldSettings } from './settings';
import { generateWrestlers } from '../generate/wrestler';
import { rngFromSeed } from '../rng';
import type { Rivalry, Show, Wrestler } from '../types';

const settings = defaultWorldSettings();

function people(n: number, over: Partial<Wrestler> = {}, seed = 'demand'): Wrestler[] {
  return generateWrestlers(rngFromSeed(seed), n).map((w, i) => ({
    ...w,
    id: `${seed}-${i}`,
    promotionId: 'me',
    popularity: 50,
    talent: 50, hype: 50,
    momentum: 50,
    careerHighPopularity: 60,
    ...over,
  }));
}

function ctxFor(over: Partial<DemandContext> = {}): DemandContext {
  const roster = people(6);
  return {
    wrestlers: roster,
    playerRosterIds: roster.map((w) => w.id),
    titles: createStartingTitles('me', 'Southside Championship Wrestling', 'territory'),
    rivalries: [],
    memory: recallBookings([], 20, settings),
    currentWeek: 20,
    playerPromotionId: 'me',
    settings,
    ...over,
  };
}

describe('the match they have never been given', () => {
  it('names two big draws who have not met', () => {
    const stars = people(2, { popularity: 90 }, 'stars');
    const demands = fanDemands(
      ctxFor({ wrestlers: stars, playerRosterIds: stars.map((w) => w.id) }),
    );
    const dream = demands.find((d) => d.kind === 'dreamMatch');
    expect(dream).toBeDefined();
    expect(dream!.wrestlerIds).toHaveLength(2);
    expect(dream!.text).toContain(stars[0]!.name);
  });

  it('stops asking once you have run it', () => {
    const stars = people(2, { popularity: 90 }, 'stars');
    const show: Show = {
      id: 's',
      week: 19,
      segments: [
        {
          participants: [
            { wrestlerId: stars[0]!.id, side: 0, role: 'competitor' },
            { wrestlerId: stars[1]!.id, side: 1, role: 'competitor' },
          ],
        },
      ],
    } as unknown as Show;
    const demands = fanDemands(
      ctxFor({
        wrestlers: stars,
        playerRosterIds: stars.map((w) => w.id),
        memory: recallBookings([show], 20, settings),
      }),
    );
    expect(demands.some((d) => d.kind === 'dreamMatch')).toBe(false);
  });

  it('does not ask for a match between two people nobody has heard of', () => {
    const nobodies = people(4, { popularity: 20 }, 'nobody');
    const demands = fanDemands(
      ctxFor({ wrestlers: nobodies, playerRosterIds: nobodies.map((w) => w.id) }),
    );
    expect(demands.some((d) => d.kind === 'dreamMatch')).toBe(false);
  });
});

describe('somebody else’s roster', () => {
  it('notices a good hand being wasted, and says where he is', () => {
    // This is the bridge to a secret signing: the audience naming somebody is
    // how the booker finds out who is worth taking.
    const wasted = people(1, { promotionId: 'rival-1', talent: 92, hype: 92, popularity: 40 }, 'wasted').map((w) => ({
      ...w,
      contract: { ...w.contract!, weeksRemaining: 5 },
    }));
    const demands = fanDemands(ctxFor({ wrestlers: [...people(2), ...wasted] }));
    const call = demands.find((d) => d.kind === 'wastedElsewhere');
    expect(call).toBeDefined();
    expect(call!.signableFrom).toBe('rival-1');
    expect(signingOpportunities(demands).map((d) => d.id)).toContain(call!.id);
  });

  it('still complains about somebody locked up for a year, but does not pretend he is gettable', () => {
    const locked = people(1, { promotionId: 'rival-1', talent: 92, hype: 92, popularity: 40 }, 'locked').map((w) => ({
      ...w,
      contract: { ...w.contract!, weeksRemaining: 90 },
    }));
    const demands = fanDemands(ctxFor({ wrestlers: [...people(2), ...locked] }));
    const call = demands.find((d) => d.kind === 'wastedElsewhere');
    expect(call).toBeDefined();
    expect(call!.signableFrom).toBeUndefined();
    expect(signingOpportunities(demands)).toHaveLength(0);
  });

  it('leaves alone somebody who is being used properly', () => {
    const fine = people(1, { promotionId: 'rival-1', talent: 60, hype: 60, popularity: 62 }, 'fine');
    const demands = fanDemands(ctxFor({ wrestlers: [...people(2), ...fine] }));
    expect(demands.some((d) => d.kind === 'wastedElsewhere')).toBe(false);
  });

  it('never points at your own roster — that is not a signing, it is a booking', () => {
    const ours = people(1, { talent: 95, hype: 95, popularity: 30 }, 'ours');
    const demands = fanDemands(ctxFor({ wrestlers: [...ours, ...people(2)], playerRosterIds: [ours[0]!.id] }));
    expect(demands.every((d) => d.kind !== 'wastedElsewhere' || d.wrestlerIds[0] !== ours[0]!.id)).toBe(true);
  });
});

describe('the things they want doing with your own people', () => {
  it('asks for a shot for somebody on a run', () => {
    const hot = people(1, { momentum: 95 }, 'hot');
    const demands = fanDemands(ctxFor({ wrestlers: hot, playerRosterIds: [hot[0]!.id] }));
    const shot = demands.find((d) => d.kind === 'titleShot');
    expect(shot).toBeDefined();
    expect(shot!.titleId).toBeDefined();
  });

  it('asks for a rematch when a feud is hot and unfinished', () => {
    const pair = people(2, { popularity: 60 }, 'feud');
    const rivalry: Rivalry = {
      id: 'r1',
      participantIds: pair.map((w) => w.id),
      origin: 'worked',
      heat: 80,
      shootHeat: 0,
      startWeek: 5,
      lastAdvancedWeek: 18,
      matchesContested: 2,
      blowoffBooked: false,
      resolvedWeek: null,
    };
    const demands = fanDemands(
      ctxFor({ wrestlers: pair, playerRosterIds: pair.map((w) => w.id), rivalries: [rivalry] }),
    );
    expect(demands.some((d) => d.kind === 'rematch')).toBe(true);
  });

  it('tells you when they have had enough of somebody', () => {
    const worked = people(1, {}, 'worked');
    const shows: Show[] = Array.from({ length: 9 }, (_, i) => ({
      id: `s${i}`,
      week: 11 + i,
      segments: [
        {
          participants: [
            { wrestlerId: worked[0]!.id, side: 0, role: 'competitor' },
            { wrestlerId: 'other', side: 1, role: 'competitor' },
          ],
        },
      ],
    })) as unknown as Show[];
    const demands = fanDemands(
      ctxFor({
        wrestlers: worked,
        playerRosterIds: [worked[0]!.id],
        memory: recallBookings(shows, 20, settings),
      }),
    );
    expect(demands.some((d) => d.kind === 'enoughOfHim')).toBe(true);
  });

  it('asks what a belt is for when nobody has challenged for it', () => {
    const roster = people(2);
    const titles = createStartingTitles('me', 'Southside Championship Wrestling', 'territory').map((t) => ({
      ...t,
      vacant: false,
      currentHolderIds: [roster[0]!.id],
      lastDefendedWeek: 0,
    }));
    const demands = fanDemands(ctxFor({ wrestlers: roster, playerRosterIds: roster.map((w) => w.id), titles, currentWeek: 9 }));
    expect(demands.some((d) => d.kind === 'defendIt')).toBe(true);
  });
});

describe('the board itself', () => {
  it('is capped, because a wishlist of forty is a wishlist nobody reads', () => {
    const many = people(14, { popularity: 90, talent: 95, hype: 95, momentum: 95 }, 'lots');
    const demands = fanDemands(ctxFor({ wrestlers: many, playerRosterIds: many.map((w) => w.id) }));
    expect(demands.length).toBeLessThanOrEqual(settings.demandBoardSize);
  });

  it('puts the loudest thing first', () => {
    const many = people(10, { popularity: 85, momentum: 90 }, 'order');
    const heats = fanDemands(ctxFor({ wrestlers: many, playerRosterIds: many.map((w) => w.id) })).map(
      (d) => d.heat,
    );
    expect([...heats].sort((a, b) => b - a)).toEqual(heats);
  });

  it('says something readable about every entry', () => {
    const many = people(8, { popularity: 80, talent: 90, hype: 90, momentum: 88 }, 'read');
    for (const demand of fanDemands(ctxFor({ wrestlers: many, playerRosterIds: many.map((w) => w.id) }))) {
      expect(demand.text.length, demand.kind).toBeGreaterThan(25);
      expect(demand.text, demand.kind).not.toMatch(/\{|\}/);
    }
  });
});

describe('giving them what they asked for', () => {
  const pair = people(2, { popularity: 90 }, 'give');
  const demands = fanDemands(ctxFor({ wrestlers: pair, playerRosterIds: pair.map((w) => w.id) }));
  const dream = demands.find((d) => d.kind === 'dreamMatch')!;

  it('counts a match that has both of them in it', () => {
    const delivered = demandsDelivered([dream], [
      { participantIds: pair.map((w) => w.id), titleIds: [] },
    ]);
    expect(delivered).toHaveLength(1);
  });

  it('does not count a match with only one of them', () => {
    expect(
      demandsDelivered([dream], [{ participantIds: [pair[0]!.id, 'somebody'], titleIds: [] }]),
    ).toHaveLength(0);
  });

  it('is worth more the louder they were asking', () => {
    const loud = { ...dream, heat: 100 };
    const quiet = { ...dream, heat: 10 };
    expect(deliveryBonus([loud], settings)).toBeGreaterThan(deliveryBonus([quiet], settings));
  });

  it('answers "enough of him" by leaving him off', () => {
    const enough = { ...dream, kind: 'enoughOfHim' as const, wrestlerIds: [pair[0]!.id] };
    expect(demandsDelivered([enough], [{ participantIds: ['somebody'], titleIds: [] }])).toHaveLength(1);
    expect(demandsDelivered([enough], [{ participantIds: [pair[0]!.id], titleIds: [] }])).toHaveLength(0);
  });

  it('is nothing when you gave them nothing', () => {
    expect(deliveryBonus([], settings)).toBe(0);
  });
});
