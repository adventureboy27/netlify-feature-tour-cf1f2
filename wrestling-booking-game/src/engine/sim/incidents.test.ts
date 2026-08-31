import { describe, it, expect } from 'vitest';
import {
  eligibleIncidents,
  rollIncident,
  turnToward,
  groupsInPlay,
  type IncidentContext,
} from './incidents';
import { INCIDENTS } from '../../data/incidents';
import { defaultWorldSettings } from '../world/settings';
import { rngFromSeed } from '../rng';
import type { Wrestler } from '../types';

const settings = defaultWorldSettings();

let nextId = 0;
function person(over: Partial<Wrestler> = {}): Wrestler {
  nextId += 1;
  return {
    id: `w${nextId}`,
    name: `Wrestler ${nextId}`,
    age: 30,
    popularity: 50,
    momentum: 0,
    morale: 60,
    health: 90,
    alignment: 40,
    crowdReaction: 40,
    deceased: null,
    careerStatus: 'midcarder',
    promotionId: 'player',
    ...over,
  } as unknown as Wrestler;
}

function ctxFor(over: Partial<IncidentContext> = {}): IncidentContext {
  const a = person({ name: 'Doomsday' });
  const b = person({ name: 'Wren Stillwater' });
  return {
    week: 30,
    isMainEvent: true,
    rating: 60,
    finish: 'cleanPin',
    titleOnTheLine: false,
    titleChanged: false,
    titleName: null,
    competitors: [
      { wrestler: a, side: 0 },
      { wrestler: b, side: 1 },
    ],
    winnerIds: [a.id],
    loserIds: [b.id],
    managers: [],
    hasReferee: true,
    groups: [],
    enemies: [],
    heat: 0,
    shootHeat: 0,
    availableReturns: [],
    potentialInvaders: [],
    settings,
    ...over,
  };
}

/** Force an incident by rolling until the odds come good. */
function forced(ctx: IncidentContext, seed = 'incident') {
  const rng = rngFromSeed(seed);
  for (let i = 0; i < 400; i++) {
    const incident = rollIncident(rng, ctx);
    if (incident) return incident;
  }
  return null;
}

describe('the library', () => {
  it('has no duplicate ids', () => {
    const ids = INCIDENTS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every incident a real weight and a kind', () => {
    for (const definition of INCIDENTS) {
      expect(definition.weight).toBeGreaterThan(0);
      expect(definition.kind).not.toBe('');
    }
  });

  it('gives every incident something it actually does', () => {
    // An incident with no effects is a caption, not an incident.
    const ctx = ctxFor({
      rating: 95,
      finish: 'interference',
      titleOnTheLine: true,
      titleName: 'World Heavyweight Championship',
      shootHeat: 90,
      availableReturns: [person({ name: 'The Returning' })],
    });
    for (const definition of INCIDENTS) {
      if (!definition.when(ctx)) continue;
      const incident = definition.build(ctx, rngFromSeed(definition.id));
      if (!incident) continue;
      expect(incident.effects.length).toBeGreaterThan(0);
      expect(incident.headline.length).toBeGreaterThan(10);
      expect(incident.headline).not.toMatch(/\{[a-z]+\}/i);
      expect(incident.involvedIds.length).toBeGreaterThan(0);
    }
  });
});

describe('nothing fires out of nowhere', () => {
  it('produces nothing at all on an unremarkable match', () => {
    // A mid-card match with a clean finish, no belt, no history, no managers
    // and nobody left off the card is exactly the match that should be
    // allowed to just be a match.
    const ctx = ctxFor({ isMainEvent: false, rating: 55, finish: 'cleanPin' });
    expect(eligibleIncidents(ctx)).toEqual([]);
    expect(forced(ctx)).toBeNull();
  });

  it('will not turn a partner who was not in the match', () => {
    const ctx = ctxFor({ groups: [{ id: 'g1', name: 'The Wreckers', memberIds: ['someone', 'someone-else'] }] });
    expect(groupsInPlay(ctx)).toEqual([]);
    expect(eligibleIncidents(ctx).map((d) => d.id)).not.toContain('partnerTurn');
  });

  it('will not blame a manager who was in the other corner', () => {
    const ctx = ctxFor({
      finish: 'interference',
      // The manager is with the side that *won*, so there is nothing to blame
      // them for.
      managers: [{ id: 'mgr-1', name: 'Bad Advice', forSide: 0 }],
    });
    expect(eligibleIncidents(ctx).map((d) => d.id)).not.toContain('managerCostThem');
  });

  it('will not shoot without real animosity already in the room', () => {
    expect(eligibleIncidents(ctxFor({ shootHeat: 10 })).map((d) => d.id)).not.toContain('itWentReal');
    expect(eligibleIncidents(ctxFor({ shootHeat: 90 })).map((d) => d.id)).toContain('itWentReal');
  });

  it('will not make a star out of somebody who was already one', () => {
    const favourite = person({ popularity: 80 });
    const other = person({ popularity: 78 });
    const ctx = ctxFor({
      rating: 90,
      competitors: [
        { wrestler: favourite, side: 0 },
        { wrestler: other, side: 1 },
      ],
      winnerIds: [favourite.id],
      loserIds: [other.id],
    });
    expect(eligibleIncidents(ctx).map((d) => d.id)).not.toContain('starIsBorn');
  });

  it('will not bring back somebody who was on the card', () => {
    expect(eligibleIncidents(ctxFor({ availableReturns: [] })).map((d) => d.id)).not.toContain('runIn');
  });

  it('will not invade with nobody eligible to send', () => {
    expect(eligibleIncidents(ctxFor({ potentialInvaders: [] })).map((d) => d.id)).not.toContain('rivalInvasion');
  });

  it('will not invade a card with no main event or title stakes', () => {
    const invader = { wrestler: person({ name: 'Outsider' }), fromPromotionId: 'rival-1', fromPromotionName: 'Rival Co' };
    const ctx = ctxFor({ potentialInvaders: [invader], isMainEvent: false, titleOnTheLine: false });
    expect(eligibleIncidents(ctx).map((d) => d.id)).not.toContain('rivalInvasion');
  });
});

describe('an incident never changes who won', () => {
  it('leaves the result exactly as the sim called it', () => {
    const ctx = ctxFor({
      rating: 92,
      finish: 'interference',
      titleOnTheLine: true,
      titleName: 'World Heavyweight Championship',
      shootHeat: 80,
      availableReturns: [person({ name: 'The Ghost' })],
    });
    const before = { winnerIds: [...ctx.winnerIds], loserIds: [...ctx.loserIds], finish: ctx.finish };

    // Roll a great many of them. Not one is allowed to touch the result.
    const rng = rngFromSeed('never-changes');
    for (let i = 0; i < 500; i++) rollIncident(rng, ctx);

    expect(ctx.winnerIds).toEqual(before.winnerIds);
    expect(ctx.loserIds).toEqual(before.loserIds);
    expect(ctx.finish).toBe(before.finish);
  });

  it('never produces an effect that decides a match', () => {
    // The closed set of effects is the guarantee: there is no 'setWinner'.
    const ctx = ctxFor({
      rating: 92,
      finish: 'interference',
      titleOnTheLine: true,
      titleName: 'World Heavyweight Championship',
      shootHeat: 80,
      availableReturns: [person()],
    });
    const allowed = new Set([
      'popularity', 'momentum', 'morale', 'rosterMorale', 'health', 'injury',
      'crowdHeat', 'shootHeat', 'alignmentTurn', 'disbandStable',
      'bookingCredibility', 'companyRating',
    ]);
    for (const definition of INCIDENTS) {
      if (!definition.when(ctx)) continue;
      const incident = definition.build(ctx, rngFromSeed(definition.id));
      for (const effect of incident?.effects ?? []) expect(allowed).toContain(effect.kind);
    }
  });
});

describe('what an incident does', () => {
  it('turns the partner who did the turning, and breaks up the team', () => {
    const a = person({ name: 'Boomtown', alignment: 55 });
    const b = person({ name: 'Doyle Voss', alignment: 50 });
    const winner = person({ name: 'Someone Else' });
    const ctx = ctxFor({
      competitors: [
        { wrestler: a, side: 0 },
        { wrestler: b, side: 0 },
        { wrestler: winner, side: 1 },
      ],
      winnerIds: [winner.id],
      loserIds: [a.id, b.id],
      groups: [{ id: 'g1', name: 'The Twin Towers', memberIds: [a.id, b.id] }],
      // Nothing else about this match is eligible, so the turn is the only
      // thing that can fire.
      rating: 55,
      isMainEvent: false,
      hasReferee: false,
    });
    expect(eligibleIncidents(ctx).map((d) => d.id)).toEqual(['partnerTurn']);

    const incident = forced(ctx)!;
    expect(incident.id).toBe('partnerTurn');
    expect(incident.headline).toContain('The Twin Towers');
    expect(incident.effects).toContainEqual({ kind: 'disbandStable', stableId: 'g1' });
    // Somebody flipped, and it was one of the two who lost.
    const turn = incident.effects.find((e) => e.kind === 'alignmentTurn');
    expect(turn).toBeDefined();
    expect([a.id, b.id]).toContain((turn as { wrestlerId: string }).wrestlerId);
    // Two faces, so the turncoat goes heel.
    expect((turn as { toward: string }).toward).toBe('heel');
  });

  it('sends a heel the other way', () => {
    expect(turnToward(person({ alignment: -60 }))).toBe('face');
    expect(turnToward(person({ alignment: 60 }))).toBe('heel');
    expect(turnToward(person({ alignment: 0 }))).toBe('heel');
  });

  it('puts a returning wrestler into a feud with whoever they stood over', () => {
    const returning = person({ name: 'The Ghost' });
    const ctx = ctxFor({ availableReturns: [returning], rating: 60, hasReferee: false });
    const incident = forced(ctx, 'return')!;
    expect(incident.id).toBe('runIn');
    expect(incident.headline).toContain('The Ghost');
    expect(incident.effects.some((e) => e.kind === 'crowdHeat')).toBe(true);
    expect(incident.involvedIds).toContain(returning.id);
  });

  it('hurts somebody when a match goes real, and unsettles the room', () => {
    const ctx = ctxFor({ shootHeat: 90, rating: 60, hasReferee: false });
    const incident = forced(ctx, 'shoot')!;
    expect(incident.id).toBe('itWentReal');
    expect(incident.effects.some((e) => e.kind === 'injury')).toBe(true);
    expect(incident.effects.some((e) => e.kind === 'rosterMorale')).toBe(true);
  });

  it('sends a rival to crash the show, names their promotion, and drains some of the grudge', () => {
    const invader = { wrestler: person({ name: 'The Outsider' }), fromPromotionId: 'rival-1', fromPromotionName: 'Grudge Wrestling' };
    const ctx = ctxFor({ potentialInvaders: [invader], rating: 60, hasReferee: false });
    const incident = forced(ctx, 'invade')!;
    expect(incident.id).toBe('rivalInvasion');
    expect(incident.headline).toContain('The Outsider');
    expect(incident.headline).toContain('Grudge Wrestling');
    expect(incident.involvedIds).toContain(invader.wrestler.id);
    expect(incident.effects.some((e) => e.kind === 'crowdHeat')).toBe(true);
    const relief = incident.effects.find((e) => e.kind === 'grudgeRelief');
    expect(relief).toEqual({ kind: 'grudgeRelief', promotionId: 'rival-1', delta: settings.invasionCatharsis });
  });

  it('costs the promotion credibility for a finish nobody could explain', () => {
    const ctx = ctxFor({ finish: 'countOut', rating: 55, isMainEvent: false });
    expect(eligibleIncidents(ctx).map((d) => d.id)).toEqual(['refBump']);
    const incident = forced(ctx, 'ref')!;
    expect(incident.effects.some((e) => e.kind === 'bookingCredibility')).toBe(true);
    expect(incident.effects.some((e) => e.kind === 'crowdHeat')).toBe(true);
  });
});

describe('how often they happen', () => {
  it('stays rare on an ordinary card and picks up in a main event', () => {
    const eligibleEverywhere = { rating: 92, availableReturns: [person()], hasReferee: false };
    const count = (over: Partial<IncidentContext>, seed: string) => {
      const rng = rngFromSeed(seed);
      const ctx = ctxFor({ ...eligibleEverywhere, ...over });
      let n = 0;
      for (let i = 0; i < 2000; i++) if (rollIncident(rng, ctx)) n += 1;
      return n / 2000;
    };

    const undercard = count({ isMainEvent: false }, 'under');
    const mainEvent = count({ isMainEvent: true }, 'main');
    const titleMain = count({ isMainEvent: true, titleOnTheLine: true, titleName: 'The Belt' }, 'title');

    expect(undercard).toBeLessThan(0.1);
    expect(mainEvent).toBeGreaterThan(undercard);
    expect(titleMain).toBeGreaterThan(mainEvent);
    // And no single match is ever close to a coin flip.
    expect(titleMain).toBeLessThanOrEqual(settings.incidentChanceCap + 0.03);
  });

  it('cuts the odds when steel barricades or security are on the books', () => {
    // See engine/economy/production.ts's equipmentSafetyEffects — this is
    // the consumer that field never had before.
    const eligibleEverywhere = { rating: 92, availableReturns: [person()], hasReferee: false, isMainEvent: true };
    const count = (incidentReduction: number, seed: string) => {
      const rng = rngFromSeed(seed);
      const ctx = ctxFor({ ...eligibleEverywhere, incidentReduction });
      let n = 0;
      for (let i = 0; i < 2000; i++) if (rollIncident(rng, ctx)) n += 1;
      return n / 2000;
    };

    const bare = count(0, 'bare-rope');
    const guarded = count(0.5, 'guarded');
    expect(guarded).toBeLessThan(bare);
  });

  it('leaves the odds alone with nothing owned — the field is optional', () => {
    const ctx = ctxFor({ rating: 92, availableReturns: [person()], hasReferee: false, isMainEvent: true });
    const withZero = ctxFor({ ...ctx, incidentReduction: 0 });
    const rng1 = rngFromSeed('same-seed');
    const rng2 = rngFromSeed('same-seed');
    let a = 0;
    let b = 0;
    for (let i = 0; i < 500; i++) {
      if (rollIncident(rng1, ctx)) a += 1;
      if (rollIncident(rng2, withZero)) b += 1;
    }
    expect(a).toBe(b);
  });
});
