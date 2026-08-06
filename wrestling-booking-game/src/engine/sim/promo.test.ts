import { describe, it, expect } from 'vitest';
import {
  promoQuality,
  resolvePromo,
  promoIsValid,
  promoShowContribution,
  promoEnergyCost,
  type PromoContext,
} from './promo';
import { PROMO_TOPICS, promoTopicById, PROMO_LINES } from '../../data/promoTopics';
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
    charisma: 50,
    popularity: 50,
    morale: 50,
    ...over,
  } as unknown as Wrestler;
}

function ctxFor(over: Partial<PromoContext> = {}): PromoContext {
  return {
    speaker: person(),
    target: person(),
    topicId: 'startFeud',
    existingHeat: 0,
    settings,
    ...over,
  };
}

/** Average out the variance so a comparison is about the inputs. */
function meanQuality(ctx: PromoContext, seedBase = 'q'): number {
  let total = 0;
  for (let i = 0; i < 200; i++) total += promoQuality(ctx, rngFromSeed(`${seedBase}-${i}`));
  return total / 200;
}

describe('the topics', () => {
  it('has no duplicates and says what each one does and costs', () => {
    expect(new Set(PROMO_TOPICS.map((t) => t.id)).size).toBe(PROMO_TOPICS.length);
    for (const topic of PROMO_TOPICS) {
      // Every option states both halves — the same rule the event library
      // plays by. An option with no downside is not a decision.
      expect(topic.effect.length).toBeGreaterThan(10);
      expect(topic.cost.length).toBeGreaterThan(10);
    }
  });

  it('covers every quality band with a write-up', () => {
    for (const band of PROMO_LINES) expect(band.lines.length).toBeGreaterThan(1);
    expect(PROMO_LINES[PROMO_LINES.length - 1]!.minQuality).toBe(0);
  });
});

describe('what makes a promo good', () => {
  it('is charisma first and popularity second', () => {
    const talker = meanQuality(ctxFor({ speaker: person({ charisma: 90, popularity: 20 }) }), 'talker');
    const star = meanQuality(ctxFor({ speaker: person({ charisma: 20, popularity: 90 }) }), 'star');
    // A great talker nobody knows out-talks a famous mute. This is the whole
    // reason the system exists.
    expect(talker).toBeGreaterThan(star);
  });

  it('lets a manager speak for somebody who cannot', () => {
    const monster = person({ charisma: 15, popularity: 60 });
    const alone = meanQuality(ctxFor({ speaker: monster }), 'alone');
    const withMouthpiece = meanQuality(ctxFor({ speaker: monster, mouthpieceCharisma: 90 }), 'mouth');
    expect(withMouthpiece).toBeGreaterThan(alone);
  });

  it('rates a hot feud higher than a cold one', () => {
    const cold = meanQuality(ctxFor({ existingHeat: 0 }), 'cold');
    const hot = meanQuality(ctxFor({ existingHeat: 100 }), 'hot');
    expect(hot).toBeGreaterThan(cold);
  });

  it('does not get a good promo out of somebody who does not want to be there', () => {
    const happy = meanQuality(ctxFor({ speaker: person({ morale: 95 }) }), 'happy');
    const miserable = meanQuality(ctxFor({ speaker: person({ morale: 5 }) }), 'sad');
    expect(happy).toBeGreaterThan(miserable);
  });

  it('stays on the 0-100 scale at the extremes', () => {
    const best = promoQuality(ctxFor({ speaker: person({ charisma: 100, popularity: 100, morale: 100 }), existingHeat: 100 }), rngFromSeed('max'));
    const worst = promoQuality(ctxFor({ speaker: person({ charisma: 0, popularity: 0, morale: 0 }) }), rngFromSeed('min'));
    expect(best).toBeLessThanOrEqual(100);
    expect(worst).toBeGreaterThanOrEqual(0);
  });
});

describe('what a promo does', () => {
  const resolve = (over: Partial<PromoContext> = {}, seed = 'promo') => resolvePromo(rngFromSeed(seed), ctxFor(over));

  it('starts a feud out of nothing', () => {
    const result = resolve({ topicId: 'startFeud' });
    const heat = result.effects.find((e) => e.kind === 'crowdHeat');
    expect(heat).toBeDefined();
    expect((heat as { delta: number }).delta).toBeGreaterThan(0);
  });

  it('scales everything by how well it went', () => {
    const great = resolve({ speaker: person({ charisma: 100, popularity: 100, morale: 100 }) }, 'great');
    const awful = resolve({ speaker: person({ charisma: 0, popularity: 0, morale: 0 }) }, 'awful');
    const heatOf = (r: typeof great) =>
      (r.effects.find((e) => e.kind === 'crowdHeat') as { delta: number } | undefined)?.delta ?? 0;
    expect(heatOf(great)).toBeGreaterThan(heatOf(awful));
  });

  it('annoys the locker room whether it went well or not', () => {
    // The one downside that does not scale — the boys mind either way.
    const great = resolve({ topicId: 'callOutLockerRoom', speaker: person({ charisma: 100 }) }, 'callout-good');
    const awful = resolve({ topicId: 'callOutLockerRoom', speaker: person({ charisma: 0, morale: 0 }) }, 'callout-bad');
    const moraleOf = (r: typeof great) =>
      (r.effects.find((e) => e.kind === 'rosterMorale') as { delta: number } | undefined)?.delta ?? 0;
    expect(moraleOf(great)).toBeLessThan(0);
    expect(moraleOf(great)).toBe(moraleOf(awful));
  });

  it('writes it up without leaving a placeholder behind', () => {
    for (const topic of PROMO_TOPICS) {
      const result = resolve({ topicId: topic.id }, `text-${topic.id}`);
      expect(result.text).not.toMatch(/\{[a-z]+\}/i);
      expect(result.text.length).toBeGreaterThan(10);
    }
  });

  it('gives every topic something to do', () => {
    for (const topic of PROMO_TOPICS) {
      const result = resolve({ topicId: topic.id, speaker: person({ charisma: 80 }) }, `does-${topic.id}`);
      expect(result.effects.length).toBeGreaterThan(0);
    }
  });
});

describe('casting it', () => {
  it('refuses a topic that needs a target and has not got one', () => {
    const speaker = person();
    expect(promoIsValid('startFeud', speaker, null, false)).toBe(false);
    expect(promoIsValid('startFeud', speaker, person(), false)).toBe(true);
  });

  it('will not let somebody cut a promo on themselves', () => {
    const speaker = person();
    expect(promoIsValid('startFeud', speaker, speaker, false)).toBe(false);
  });

  it('keeps the championship address for a champion', () => {
    const speaker = person();
    expect(promoIsValid('championshipAddress', speaker, null, false)).toBe(false);
    expect(promoIsValid('championshipAddress', speaker, null, true)).toBe(true);
  });

  it('needs somebody on the microphone at all', () => {
    expect(promoIsValid('hypeMatch', null, null, false)).toBe(false);
  });

  it('knows every topic it is asked about', () => {
    for (const topic of PROMO_TOPICS) expect(promoTopicById(topic.id)).toBeDefined();
    expect(promoTopicById('nonsense')).toBeUndefined();
  });
});

describe('what it is worth to the show', () => {
  it('helps a show when it was good and hurts when it was bad', () => {
    expect(promoShowContribution(90, settings)).toBeGreaterThan(0);
    expect(promoShowContribution(settings.promoNeutralQuality, settings)).toBe(0);
    expect(promoShowContribution(10, settings)).toBeLessThan(0);
  });

  it('is worth less than a match, because a card of promos is not a show', () => {
    // A perfect promo moves the show rating by a few points, not by twenty.
    expect(promoShowContribution(100, settings)).toBeLessThan(10);
  });

  it('costs more energy when somebody is talking and wrestling the same night', () => {
    expect(promoEnergyCost(true, settings)).toBeGreaterThan(promoEnergyCost(false, settings));
  });
});
