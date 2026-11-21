import { describe, it, expect } from 'vitest';
import { paceEffect, paceFit, decayPaceSaturation } from './pacing';
import { PACES, paceById } from '../../data/pacing';
import { defaultWorldSettings } from '../world/settings';
import { generateWrestler } from '../generate/wrestler';
import { rngFromSeed } from '../rng';
import type { PaceId, Wrestler } from '../types';

const settings = defaultWorldSettings();

function worker(skill: number): Wrestler {
  return { ...generateWrestler(rngFromSeed('p'), new Set()), skill, stamina: skill };
}

const craftsmen = [worker(90), worker(88)];
const bodies = [worker(25), worker(30)];

function effect(pace: PaceId, participants: Wrestler[], over: Partial<Parameters<typeof paceEffect>[0]> = {}) {
  return paceEffect({
    pace,
    participants,
    isMainEvent: false,
    isOpener: false,
    saturation: 0,
    settings,
    ...over,
  });
}

describe('the catalogue', () => {
  it('gives every pace a name, a blurb and a distinct identity', () => {
    for (const pace of PACES) {
      expect(pace.name.length).toBeGreaterThan(0);
      expect(pace.blurb.length).toBeGreaterThan(15);
    }
    expect(new Set(PACES.map((p) => p.id)).size).toBe(PACES.length);
  });

  it('falls back to standard rather than throwing on an unknown id', () => {
    expect(paceById('nonsense' as PaceId).id).toBe('standard');
  });

  it('leaves standard as the one with no opinion about anything', () => {
    const standard = paceById('standard');
    expect(standard.ratingBonus).toBe(0);
    expect(standard.healthCostMultiplier).toBe(1);
    expect(standard.injuryMultiplier).toBe(1);
    expect(standard.ratingCeiling).toBe(100);
  });
});

describe('no pace is strictly better than another', () => {
  it('caps what a sprint can ever be, however good the people in it', () => {
    // The trade for how cheap it is: you cannot have a classic in six
    // minutes. Without this, sprint is free rating and the lever is dead.
    expect(effect('sprint', craftsmen).ratingCeiling).toBeLessThan(100);
    expect(effect('allOut', craftsmen).ratingCeiling).toBe(100);
  });

  it('charges all-out in bodies for what it pays in rating', () => {
    const allOut = effect('allOut', craftsmen);
    const standard = effect('standard', craftsmen);
    expect(allOut.ratingBonus).toBeGreaterThan(standard.ratingBonus);
    expect(allOut.healthCostMultiplier).toBeGreaterThan(standard.healthCostMultiplier);
    expect(allOut.injuryMultiplier).toBeGreaterThan(standard.injuryMultiplier);
    expect(allOut.energyCostMultiplier).toBeGreaterThan(standard.energyCostMultiplier);
  });

  it('makes a sprint genuinely cheap on the body', () => {
    const sprint = effect('sprint', bodies);
    expect(sprint.healthCostMultiplier).toBeLessThan(1);
    expect(sprint.injuryMultiplier).toBeLessThan(1);
  });
});

describe('slow build separates workers from bodies', () => {
  it('is the best thing on the card with two craftsmen in it', () => {
    expect(effect('slowBuild', craftsmen).ratingBonus).toBeGreaterThan(
      effect('standard', craftsmen).ratingBonus,
    );
  });

  it('is a disaster with two people who cannot work', () => {
    expect(effect('slowBuild', bodies).ratingBonus).toBeLessThan(effect('standard', bodies).ratingBonus);
    expect(paceFit({ pace: 'slowBuild', participants: bodies, isMainEvent: false, isOpener: false, saturation: 0, settings })).toBe(
      'Wrong call',
    );
  });

  it('swings further on who is in it than any other pace', () => {
    const spread = (pace: PaceId) =>
      Math.abs(effect(pace, craftsmen).ratingBonus - effect(pace, bodies).ratingBonus);
    expect(spread('slowBuild')).toBeGreaterThan(spread('sprint'));
    expect(spread('slowBuild')).toBeGreaterThan(spread('allOut'));
  });
});

describe('where it sits on the card', () => {
  it('punishes a sprint in the main event', () => {
    // A crowd that sat through a card expecting a blow-off does not want six
    // minutes of it.
    expect(effect('sprint', craftsmen, { isMainEvent: true }).ratingBonus).toBeLessThan(
      effect('sprint', craftsmen).ratingBonus,
    );
  });

  it('rewards a sprint in the opener and punishes it everywhere else', () => {
    // Without the off-spot penalty a sprint is free rating: its only other
    // cost is a ceiling, and a ceiling is inert on a roster whose matches do
    // not approach it. A card of six sprints has to feel like one.
    expect(effect('sprint', craftsmen, { isOpener: true }).ratingBonus).toBeGreaterThan(
      effect('sprint', craftsmen).ratingBonus,
    );
    expect(effect('sprint', craftsmen).ratingBonus).toBeLessThan(paceById('sprint').ratingBonus);
  });

  it('leaves the paces meant for anywhere on the card unpenalised off the top', () => {
    for (const id of ['standard', 'slowBuild', 'allOut'] as PaceId[]) {
      expect(paceById(id).offSpotPenalty).toBe(0);
    }
  });

  it('leaves standard indifferent to where it is', () => {
    const mid = effect('standard', craftsmen).ratingBonus;
    expect(effect('standard', craftsmen, { isMainEvent: true }).ratingBonus).toBe(mid);
    expect(effect('standard', craftsmen, { isOpener: true }).ratingBonus).toBe(mid);
  });
});

describe('the crowd gets numb', () => {
  it('takes the shine off all-out when it is run every week', () => {
    const fresh = effect('allOut', craftsmen, { saturation: 0 }).ratingBonus;
    const stale = effect('allOut', craftsmen, { saturation: 100 }).ratingBonus;
    expect(stale).toBeLessThan(fresh);
  });

  it('never lets a sprint go stale, because it was never the point', () => {
    expect(effect('sprint', craftsmen, { saturation: 100 }).ratingBonus).toBe(
      effect('sprint', craftsmen, { saturation: 0 }).ratingBonus,
    );
  });

  it('only banks saturation for the paces that carry a cost', () => {
    expect(effect('allOut', craftsmen).saturationAdded).toBeGreaterThan(0);
    expect(effect('sprint', craftsmen).saturationAdded).toBe(0);
    expect(effect('standard', craftsmen).saturationAdded).toBe(0);
    expect(effect('slowBuild', craftsmen).saturationAdded).toBe(0);
  });

  it('forgets, given a few weeks off it', () => {
    let saturation = 100;
    for (let i = 0; i < 20; i++) saturation = decayPaceSaturation(saturation, settings);
    expect(saturation).toBe(0);
  });
});

describe('telling the player', () => {
  it('says whether it is the right call, in words', () => {
    const fit = paceFit({
      pace: 'slowBuild',
      participants: craftsmen,
      isMainEvent: false,
      isOpener: false,
      saturation: 0,
      settings,
    });
    expect(['Fine', 'Good call', 'Exactly right']).toContain(fit);
    expect(fit).not.toMatch(/\d/);
  });

  it('calls a sprint on top a bad idea without stopping you booking it', () => {
    // CLAUDE.md: the game never warns before a bad decision. This is a
    // description of the pairing, the same as manager fit — not a block.
    const fit = paceFit({
      pace: 'sprint',
      participants: craftsmen,
      isMainEvent: true,
      isOpener: false,
      saturation: 0,
      settings,
    });
    expect(['Wrong call', 'Questionable']).toContain(fit);
  });
});
