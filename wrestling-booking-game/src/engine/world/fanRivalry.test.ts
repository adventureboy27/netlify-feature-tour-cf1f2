import { describe, expect, it } from 'vitest';
import {
  canTriggerFanIncident,
  generateRingsideFan,
  beginFanRivalryStory,
  buildFanCalloutPromo,
  buildFanRivalryMatchSegment,
} from './fanRivalry';
import { defaultWorldSettings } from './settings';
import { rngFromSeed } from '../rng';
import type { Wrestler } from '../types';

const settings = defaultWorldSettings();

let nextId = 0;
function person(over: Partial<Wrestler> = {}): Wrestler {
  nextId += 1;
  return {
    id: `w${nextId}`,
    name: `Wrestler ${nextId}`,
    role: 'wrestler',
    gender: 'f',
    alignment: -40,
    ...over,
  } as unknown as Wrestler;
}

describe('canTriggerFanIncident', () => {
  it('true for a heel woman, wrestling role', () => {
    expect(canTriggerFanIncident(person({ gender: 'f', alignment: -40, role: 'wrestler' }))).toBe(true);
  });

  it('false for a man, however heel', () => {
    expect(canTriggerFanIncident(person({ gender: 'm', alignment: -80, role: 'wrestler' }))).toBe(false);
  });

  it('false for a face woman', () => {
    expect(canTriggerFanIncident(person({ gender: 'f', alignment: 40, role: 'wrestler' }))).toBe(false);
  });

  it('false for a manager, even a heel woman', () => {
    expect(canTriggerFanIncident(person({ gender: 'f', alignment: -40, role: 'manager' }))).toBe(false);
  });

  it('false exactly on the alignment boundary (0 is not a heel)', () => {
    expect(canTriggerFanIncident(person({ gender: 'f', alignment: 0, role: 'wrestler' }))).toBe(false);
  });
});

describe('generateRingsideFan', () => {
  it('produces a woman, off the street, with the gem-tier walk-on shape', () => {
    const fan = generateRingsideFan(rngFromSeed('fan-1'), 2024, settings, new Set());
    expect(fan.gender).toBe('f');
    expect(fan.role).toBe('wrestler');
    expect(fan.contract).toBeNull();
    expect(fan.promotionId).toBeNull();
    // A gem's whole point: the mouth/ceiling is real even though nobody
    // trained her — see engine/world/walkOns.ts's asWalkOn.
    expect(fan.talent).toBeGreaterThanOrEqual(settings.walkOnGemTalentFloor);
  });

  it('never collides with an already-taken name', () => {
    // generateWrestler mutates the set it's handed (adds its own pick, so a
    // batch avoids colliding with itself) — the real assertion is against a
    // snapshot taken before the call, not the set afterward.
    const before = new Set(['professor wren']);
    const taken = new Set(before);
    const fan = generateRingsideFan(rngFromSeed('fan-collide'), 2024, settings, taken);
    expect(before.has(fan.name.toLowerCase())).toBe(false);
  });
});

describe('beginFanRivalryStory', () => {
  it('locks the callout and match weeks in at trigger time, two and one week ahead', () => {
    const heel = person({ id: 'heel-1', name: 'Mean Michelle' });
    const fan = person({ id: 'fan-1', name: 'Dana from Section 12' });
    const story = beginFanRivalryStory(heel, fan, 'rivalry-1', 10);
    expect(story).toEqual({
      wrestlerId: 'heel-1',
      wrestlerName: 'Mean Michelle',
      fanId: 'fan-1',
      fanName: 'Dana from Section 12',
      rivalryId: 'rivalry-1',
      triggeredWeek: 10,
      calloutWeek: 11,
      matchWeek: 12,
      calloutDone: false,
    });
  });
});

describe('buildFanCalloutPromo', () => {
  it('builds a forced challenge promo aimed at the fan', () => {
    const seg = buildFanCalloutPromo(2, 'heel-1', 'fan-1');
    expect(seg.slot).toBe(2);
    expect(seg.kind).toBe('promo');
    expect(seg.promoTopicId).toBe('challenge');
    expect(seg.promoSpeakerId).toBe('heel-1');
    expect(seg.promoTargetId).toBe('fan-1');
    expect(seg.systemForced).toBe('fanRivalry');
  });
});

describe('buildFanRivalryMatchSegment', () => {
  it('builds a real 1v1, unsanctioned, forced and stipulated', () => {
    const seg = buildFanRivalryMatchSegment(0, 'heel-1', 'fan-1');
    expect(seg.slot).toBe(0);
    expect(seg.kind).toBe('match');
    expect(seg.stipulation).toBe('unsanctioned');
    expect(seg.systemForced).toBe('fanRivalry');
    expect(seg.participants).toEqual([
      { wrestlerId: 'heel-1', side: 0, role: 'competitor' },
      { wrestlerId: 'fan-1', side: 1, role: 'competitor' },
    ]);
    expect(seg.rules.ruleStrictness).toBe('none');
    expect(seg.rules.countOuts).toBe('none');
    expect(seg.result).toBeNull();
  });
});
