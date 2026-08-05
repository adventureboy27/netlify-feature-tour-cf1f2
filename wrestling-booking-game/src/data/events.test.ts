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
import type { EventEffect, EventSubjects } from '../engine/events/types';
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
  };
  return { primary, secondary, promotion, rival: { ...promotion, id: 'them', name: 'Rival Co', isPlayer: false } };
}

/** Is this effect bad for the player? */
function isNegative(effect: EventEffect): boolean {
  switch (effect.kind) {
    case 'release':
    case 'injury':
      return true;
    case 'gimmickChange':
    case 'alignmentTurn':
    case 'formStable':
      return false; // neutral — a change, not a gain or a loss
    case 'contractRate':
      return effect.multiplier > 1; // paying more is a cost
    case 'shootHeat':
      return effect.delta > 0; // real bad blood is a liability
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

  it('has unique option ids within each event', () => {
    for (const event of CREATIVE_EVENTS) {
      const ids = event.options.map((o) => o.id);
      expect(new Set(ids).size, event.id).toBe(ids.length);
    }
  });

  it('finds events by id', () => {
    expect(eventById('backstageFight')).toBeDefined();
    expect(eventById('nope')).toBeUndefined();
  });
});

describe('no option is free — the house rule', () => {
  const ctx = subjects();

  it.each(CREATIVE_EVENTS.flatMap((e) => e.options.map((o) => [`${e.id}/${o.id}`, e, o] as const)))(
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
    for (const event of CREATIVE_EVENTS) {
      for (const option of event.options) {
        if (!option.gamble) continue;
        const failure = option.gamble.onFailure(ctx, settings);
        expect(failure.length, `${event.id}/${option.id} failure does nothing`).toBeGreaterThan(0);
        expect(failure.some(isNegative), `${event.id}/${option.id} failure does not hurt`).toBe(true);
      }
    }
  });

  it('keeps every gamble a genuine gamble, never a sure thing', () => {
    for (const event of CREATIVE_EVENTS) {
      for (const option of event.options) {
        if (!option.gamble) continue;
        const p = option.gamble.chance(ctx);
        expect(p, `${event.id}/${option.id}`).toBeGreaterThan(0.05);
        expect(p, `${event.id}/${option.id}`).toBeLessThan(0.95);
      }
    }
  });

  it('produces effects that reference only the subjects it was given', () => {
    const allowed = new Set(['p1', 'p2']);
    for (const event of CREATIVE_EVENTS) {
      for (const option of event.options) {
        const effects = [
          ...option.effects(ctx, settings),
          ...(option.gamble?.onSuccess(ctx, settings) ?? []),
          ...(option.gamble?.onFailure(ctx, settings) ?? []),
        ];
        for (const effect of effects) {
          if ('wrestlerId' in effect) expect(allowed.has(effect.wrestlerId), `${event.id}: ${effect.wrestlerId}`).toBe(true);
          if ('wrestlerIds' in effect) for (const id of effect.wrestlerIds) expect(allowed.has(id)).toBe(true);
          if ('memberIds' in effect) for (const id of effect.memberIds) expect(allowed.has(id)).toBe(true);
        }
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
    expect(ids).toContain('rivalTampering'); // rival bookers going after talent
    expect(ids).toContain('stableProposal'); // forming a group
  });
});
