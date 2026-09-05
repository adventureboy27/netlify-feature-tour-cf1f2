import { describe, it, expect } from 'vitest';
import { createStartingTitles, shortTitleName, titlesOf, awardTitle, reignLength } from './titles';
import {
  PROMOTION_ARCHETYPES,
  PROMOTION_IDENTITIES,
  beltPrefix,
  styleFit,
  identityOf,
} from './promotionIdentity';
import { stipulationById } from './stipulations';

describe('promotion identity', () => {
  it('gives every archetype a distinct top belt or a distinct signature belt', () => {
    // The design bar: you should be able to read a belt name and know what
    // kind of company you are looking at.
    const lineups = PROMOTION_ARCHETYPES.map((a) =>
      createStartingTitles('p', 'Continental Championship Wrestling', a)
        .map((t) => t.name)
        .join(' | '),
    );
    expect(new Set(lineups).size).toBe(PROMOTION_ARCHETYPES.length);
  });

  it('names every signature belt after a stipulation that actually exists', () => {
    for (const archetype of PROMOTION_ARCHETYPES) {
      const id = PROMOTION_IDENTITIES[archetype].signatureBelt.stipulationId;
      expect(stipulationById(id), `${archetype} signature stipulation`).toBeDefined();
    }
  });

  it('carries the signature stipulation onto the belt itself', () => {
    const belts = createStartingTitles('p', 'Blackline Pro', 'hardcore');
    const signature = belts.find((t) => t.signatureStipulationId !== null);
    expect(signature?.name).toContain('Deathmatch');
    expect(signature?.signatureStipulationId).toBe('flamingTables');
  });

  it('favours the styles it is known for and turns its nose up at the opposite', () => {
    const hardcore = identityOf('hardcore');
    expect(styleFit(hardcore, 'hardcore')).toBeGreaterThan(0);
    expect(styleFit(hardcore, 'technical')).toBeLessThan(0);
    // A style it has no opinion about is neither a bonus nor a penalty.
    expect(styleFit(hardcore, 'highFlyer')).toBe(0);
  });
});

describe('belt naming', () => {
  it('prefixes every belt with the promotion, and never repeats a name', () => {
    const belts = createStartingTitles('p', 'Meridian Grappling', 'technical');
    for (const belt of belts) expect(belt.name.startsWith('Meridian ')).toBe(true);
    expect(new Set(belts.map((b) => b.name)).size).toBe(belts.length);
  });

  it('drops the generic tail off a promotion name', () => {
    expect(beltPrefix('Continental Championship Wrestling')).toBe('Continental');
    expect(beltPrefix('Atlas Pro')).toBe('Atlas');
    expect(beltPrefix('Sunbelt Wrestling Alliance')).toBe('Sunbelt');
    // Nothing distinctive to grab — fall back to the first word rather than
    // producing a belt with no name in front of it.
    expect(beltPrefix('Wrestling Alliance')).toBe('Wrestling');
  });

  it('shortens to the part that carries information', () => {
    const [top] = createStartingTitles('p', 'Gold Coast Wrestling', 'sportsEntertainment');
    expect(top!.name).toBe('Gold World Heavyweight Championship');
    expect(shortTitleName(top!)).toBe('World Heavyweight');
  });

  it('gives every belt a line saying what it is for', () => {
    for (const archetype of PROMOTION_ARCHETYPES) {
      for (const belt of createStartingTitles('p', 'Atlas Pro', archetype)) {
        expect(belt.blurb.length).toBeGreaterThan(10);
      }
    }
  });
});

describe('titles in the world', () => {
  it('separates one promotion’s belts from another’s', () => {
    const all = [
      ...createStartingTitles('you', 'Southside Championship Wrestling', 'territory'),
      ...createStartingTitles('rival-0', 'Atlas Pro', 'athletic'),
    ];
    expect(titlesOf(all, 'you')).toHaveLength(5);
    expect(titlesOf(all, 'rival-0').every((t) => t.promotionId === 'rival-0')).toBe(true);
  });

  it('closes the old reign when the belt changes hands', () => {
    const [belt] = createStartingTitles('you', 'Atlas Pro', 'athletic');
    const first = awardTitle(belt!, ['a'], 4);
    const second = awardTitle(first, ['b'], 30);

    expect(second.currentHolderIds).toEqual(['b']);
    expect(second.history).toHaveLength(2);
    expect(second.history[0]!.endWeek).toBe(30);
    expect(second.history[1]!.wonFromIds).toEqual(['a']);
    expect(reignLength(second, 40)).toBe(10);
  });
});
