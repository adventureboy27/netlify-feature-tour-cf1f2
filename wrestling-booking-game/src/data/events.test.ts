// The two house rules of the event library, enforced rather than trusted.
//
// This file is what stops the library rotting as it grows to §0's 150+
// events: an option with no downside, or an event that can spam the player,
// fails the build.

import { describe, it, expect } from 'vitest';
import { CREATIVE_EVENTS, eventById } from './events';
import { defaultWorldSettings } from '../engine/world/settings';
import { generateWrestler } from '../engine/generate/wrestler';
import { rngFromSeed } from '../engine/rng';
import type { CreativeEvent, EventEffect, EventOption, EventSubjects } from '../engine/events/types';
import type { Promotion, Wrestler } from '../engine/types';

const settings = defaultWorldSettings();

function subjects(): EventSubjects {
  const rng = rngFromSeed('event-subjects');
  const primary: Wrestler = { ...generateWrestler(rng, new Set()), id: 'p1' };
  const secondary: Wrestler = { ...generateWrestler(rng, new Set()), id: 'p2' };
  const promotion: Promotion = {
    id: 'you',
    name: 'Your Promotion',
    identity: 'territory' as const,
    weeksInTheRed: 0,
    closedWeek: null,
    isPlayer: true,
    rating: 55,
    bankBalance: 75000,
    rosterIds: ['p1', 'p2'],
    titleIds: [],
    ownedTerritoryIds: [],
    homeTerritoryId: 't',
    styleProfile: { preferredStyles: [], violenceTolerance: 50, workrateVsStarPower: 50, divisionFocus: ['mens'], promoHeavy: false },
    bookingCredibility: 50,
    reputation: 50,
    hardcoreSaturation: 0,
    recentShowQuality: 55,
    ownerId: 'owner-1',
    ownerPersonality: 'showman' as const,
    ppvCalendar: ['The Reckoning'],
  };
  return { primary, secondary, promotion, rival: { ...promotion, id: 'them', name: 'Rival Co', isPlayer: false } };
}

/**
 * Every option in an event's library — the root node's, and every follow-up
 * node's — flattened with which node it belongs to. Branching added a second
 * place options can live; every rule that used to walk `event.options` alone
 * now walks this instead, so a follow-up node is held to the same standard
 * as a root one rather than escaping the house rules by being one hop away.
 */
function allOptions(): { event: CreativeEvent; nodeId: string; option: EventOption }[] {
  const entries: { event: CreativeEvent; nodeId: string; option: EventOption }[] = [];
  for (const event of CREATIVE_EVENTS) {
    for (const option of event.options) entries.push({ event, nodeId: 'root', option });
    for (const node of Object.values(event.nodes ?? {})) {
      for (const option of node.options) entries.push({ event, nodeId: node.id, option });
    }
  }
  return entries;
}

/** Is this effect bad for the player? */
function isNegative(effect: EventEffect): boolean {
  switch (effect.kind) {
    case 'release':
    case 'injury':
    case 'violation':
      return true;
    case 'gimmickChange':
    case 'alignmentTurn':
    case 'formStable':
    case 'contractType':
    case 'leave':
    case 'wire':
      return false; // neutral — a change, not a gain or a loss on its own
    case 'contractRate':
      return effect.multiplier > 1; // paying more is a cost
    case 'shootHeat':
      return effect.delta > 0; // real bad blood is a liability
    case 'fatigue':
      return effect.delta > 0; // more fatigue is the cost, not less
    default:
      return 'delta' in effect && effect.delta < 0;
  }
}

describe('every event is well formed', () => {
  it.each(CREATIVE_EVENTS.map((e) => [e.id, e] as const))('%s', (_id, event) => {
    expect(event.options.length, 'needs a real choice').toBeGreaterThanOrEqual(2);
    expect(event.body.length, 'needs variants so a repeat reads differently').toBeGreaterThanOrEqual(3);
    expect(event.weight).toBeGreaterThan(0);
    expect(event.cooldownWeeks, 'needs a cooldown').toBeGreaterThan(0);
    expect(event.title.length).toBeGreaterThan(0);
  });

  it('has no duplicate ids', () => {
    const ids = CREATIVE_EVENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique option ids within each node', () => {
    // Uniqueness is per node, not per event — resolution is always keyed by
    // (nodeId, optionId), so a follow-up node reusing an id like 'accept'
    // that a different node also uses is unambiguous.
    for (const event of CREATIVE_EVENTS) {
      const rootIds = event.options.map((o) => o.id);
      expect(new Set(rootIds).size, `${event.id}/root`).toBe(rootIds.length);
      for (const node of Object.values(event.nodes ?? {})) {
        const ids = node.options.map((o) => o.id);
        expect(new Set(ids).size, `${event.id}/${node.id}`).toBe(ids.length);
      }
    }
  });

  it('finds events by id', () => {
    expect(eventById('backstageFight')).toBeDefined();
    expect(eventById('nope')).toBeUndefined();
  });

  it('never branches to a node that does not exist', () => {
    // A typo'd `next` would otherwise hang the conversation silently — the
    // store falls back to closing it out, but that's a bug hiding as a
    // feature. Catch it here instead.
    for (const event of CREATIVE_EVENTS) {
      for (const { nodeId, option } of allOptions().filter((e) => e.event.id === event.id)) {
        for (const target of [option.next, option.gamble?.nextOnSuccess, option.gamble?.nextOnFailure]) {
          if (!target) continue;
          expect(event.nodes?.[target], `${event.id}/${nodeId}/${option.id} -> ${target}`).toBeDefined();
        }
      }
    }
  });

  it('every node is actually reachable from some option', () => {
    // A node nobody's `next` ever points to is dead content.
    for (const event of CREATIVE_EVENTS) {
      const reachable = new Set<string>();
      for (const { option } of allOptions().filter((e) => e.event.id === event.id)) {
        if (option.next) reachable.add(option.next);
        if (option.gamble?.nextOnSuccess) reachable.add(option.gamble.nextOnSuccess);
        if (option.gamble?.nextOnFailure) reachable.add(option.gamble.nextOnFailure);
      }
      for (const nodeId of Object.keys(event.nodes ?? {})) {
        expect(reachable.has(nodeId), `${event.id}/${nodeId} is unreachable`).toBe(true);
      }
    }
  });
});

describe('no option is free — the house rule', () => {
  const ctx = subjects();

  it.each(allOptions().map(({ event, nodeId, option }) => [`${event.id}/${nodeId}/${option.id}`, event, option] as const))(
    '%s carries a stated cost and a real one',
    (_label, _event, option) => {
      // Stated to the player...
      expect(option.gains.length).toBeGreaterThan(0);
      expect(option.costs.length).toBeGreaterThan(0);

      // ...and actually true in the effects. An option is legitimate if it
      // either applies a negative effect outright, or is a gamble that can
      // fail — a certain small cost against an uncertain gain is still a
      // decision. What is not allowed is pure upside.
      const certain = option.effects(ctx, settings);
      const hasCertainDownside = certain.some(isNegative);
      const canFail = Boolean(option.gamble);

      expect(hasCertainDownside || canFail, `${option.id} is all upside`).toBe(true);
    },
  );

  it('never lets a gamble succeed for free either', () => {
    for (const { event, nodeId, option } of allOptions()) {
      if (!option.gamble) continue;
      const failure = option.gamble.onFailure(ctx, settings);
      expect(failure.length, `${event.id}/${nodeId}/${option.id} failure does nothing`).toBeGreaterThan(0);
      expect(failure.some(isNegative), `${event.id}/${nodeId}/${option.id} failure does not hurt`).toBe(true);
    }
  });

  // Events added for the "wrestlers bring the booker their problems" content
  // pass — the user's own requirement was that every answer has to move the
  // wrestler's mood, a stat, or a relationship, not just company money or
  // rating. Scoped to these ids rather than every event in the library: the
  // business/rival events (sponsorOffer, tvSlotOffer, rivalRaidsTape, ...)
  // are legitimately about the company, not a person, and always have been.
  const PERSONAL_STAKES_EVENTS = new Set([
    'lateToWork',
    'wantsToMainEvent',
    'tagTeamPitch',
    'wantsTitleShot',
    'timeOffRequest',
    'trainingInjury',
    'burnout',
    'sick',
    'wantsPartTime',
    'wantsToFilmAMovie',
  ]);
  const PERSONAL_STAKES_KINDS = new Set(['morale', 'momentum', 'popularity', 'relationship']);

  it('moves mood, a stat, or a relationship — never just the company', () => {
    for (const { event, nodeId, option } of allOptions()) {
      if (!PERSONAL_STAKES_EVENTS.has(event.id)) continue;
      const effects = [
        ...option.effects(ctx, settings),
        ...(option.gamble?.onSuccess(ctx, settings) ?? []),
        ...(option.gamble?.onFailure(ctx, settings) ?? []),
      ];
      const touchesSomeone = effects.some((e) => PERSONAL_STAKES_KINDS.has(e.kind));
      expect(touchesSomeone, `${event.id}/${nodeId}/${option.id} never touches morale/momentum/popularity/relationship`).toBe(
        true,
      );
    }
  });

  it('keeps every gamble a genuine gamble, never a sure thing', () => {
    for (const { event, nodeId, option } of allOptions()) {
      if (!option.gamble) continue;
      const p = option.gamble.chance(ctx);
      expect(p, `${event.id}/${nodeId}/${option.id}`).toBeGreaterThan(0.05);
      expect(p, `${event.id}/${nodeId}/${option.id}`).toBeLessThan(0.95);
    }
  });

  it('produces effects that reference only the subjects it was given', () => {
    const allowed = new Set(['p1', 'p2']);
    for (const { event, nodeId, option } of allOptions()) {
      const effects = [
        ...option.effects(ctx, settings),
        ...(option.gamble?.onSuccess(ctx, settings) ?? []),
        ...(option.gamble?.onFailure(ctx, settings) ?? []),
      ];
      for (const effect of effects) {
        if ('wrestlerId' in effect) expect(allowed.has(effect.wrestlerId), `${event.id}/${nodeId}: ${effect.wrestlerId}`).toBe(true);
        if ('wrestlerIds' in effect) for (const id of effect.wrestlerIds) expect(allowed.has(id)).toBe(true);
        if ('memberIds' in effect) for (const id of effect.memberIds) expect(allowed.has(id)).toBe(true);
        if ('aId' in effect) expect(allowed.has(effect.aId), `${event.id}/${nodeId}: ${effect.aId}`).toBe(true);
        if ('bId' in effect) expect(allowed.has(effect.bId), `${event.id}/${nodeId}: ${effect.bId}`).toBe(true);
      }
    }
  });
});

describe('library coverage', () => {
  it('spans every category', () => {
    const categories = new Set(CREATIVE_EVENTS.map((e) => e.category));
    expect(categories).toContain('lockerRoom');
    expect(categories).toContain('creative');
    expect(categories).toContain('business');
    expect(categories).toContain('rival');
    expect(categories).toContain('personal');
  });

  it('covers the systems the player was promised', () => {
    const ids = CREATIVE_EVENTS.map((e) => e.id);
    expect(ids).toContain('gimmickRequest'); // gimmick change -> restyle
    expect(ids).toContain('rivalInterest'); // rival bookers going after talent
    expect(ids).toContain('stableProposal'); // forming a group
  });
});
