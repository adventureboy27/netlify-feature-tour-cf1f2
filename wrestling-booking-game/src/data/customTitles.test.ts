// Custom championships — the player's own lineup, not the house style's.

import { describe, expect, it } from 'vitest';
import {
  createStartingTitles,
  startingBlueprints,
  startingPrestige,
  TITLE_PRESETS,
  TITLE_PRESET_FAMILIES,
  TITLE_COLORWAYS,
  defaultHolders,
} from './titles';
import { eligibleTitles } from '../engine/sim/titleMatch';
import { generateWrestlers } from '../engine/generate/wrestler';
import { stipulationById } from './stipulations';
import { PROMOTION_ARCHETYPES } from './promotionIdentity';
import { defaultWorldSettings } from '../engine/world/settings';
import { createInitialWorld } from '../state/world';
import { rngFromSeed } from '../engine/rng';
import type { TitleBlueprint } from '../engine/types';

const belt = (over: Partial<TitleBlueprint> = {}): TitleBlueprint => ({
  suffix: 'Championship',
  blurb: 'A championship.',
  tier: 'secondary',
  division: 'open',
  weightClass: 'open',
  signatureStipulationId: null,
  ...over,
});

describe('the house style still suggests a lineup', () => {
  it('gives every archetype a full set to start from', () => {
    for (const archetype of PROMOTION_ARCHETYPES) {
      const suggested = startingBlueprints(archetype);
      expect(suggested.length, archetype).toBeGreaterThan(2);
      for (const b of suggested) {
        expect(b.suffix.length, archetype).toBeGreaterThan(2);
        expect(b.blurb.length, archetype).toBeGreaterThan(10);
      }
    }
  });

  it('is what you get when you do not build your own', () => {
    const suggested = createStartingTitles('p', 'Atlas Pro', 'hardcore');
    const explicit = createStartingTitles('p', 'Atlas Pro', 'hardcore', startingBlueprints('hardcore'));
    expect(explicit.map((t) => t.name)).toEqual(suggested.map((t) => t.name));
  });
});

describe('building your own', () => {
  it('uses the names the player typed', () => {
    const titles = createStartingTitles('p', 'Southside Championship Wrestling', 'territory', [
      belt({ suffix: 'Undisputed Heavyweight Crown', tier: 'world' }),
      belt({ suffix: 'Cleveland Street Title', tier: 'hardcore' }),
    ]);
    expect(titles).toHaveLength(2);
    expect(titles[0]!.name).toContain('Undisputed Heavyweight Crown');
    expect(titles[1]!.name).toContain('Cleveland Street Title');
  });

  it('keeps the division the player chose, which §3.1 locks at creation', () => {
    const [womens] = createStartingTitles('p', 'Atlas Pro', 'athletic', [
      belt({ suffix: "Women's World Championship", tier: 'world', division: 'womens' }),
    ]);
    expect(womens!.division).toBe('womens');
    expect(womens!.tier).toBe('world');
  });

  it('lets a company run any number of belts, including a lot of one division', () => {
    const womensOnly = Array.from({ length: 6 }, (_, i) =>
      belt({ suffix: `Women's Title ${i}`, division: 'womens' }),
    );
    const titles = createStartingTitles('p', 'Atlas Pro', 'athletic', womensOnly);
    expect(titles).toHaveLength(6);
    expect(titles.every((t) => t.division === 'womens')).toBe(true);
  });

  it('allows a promotion with no championships at all', () => {
    // The game does not warn anybody out of a decision. Running no belts is a
    // hard way to book, not an invalid one.
    expect(createStartingTitles('p', 'Atlas Pro', 'athletic', [])).toEqual([]);
  });

  it('carries the signature stipulation onto the belt', () => {
    const [deathmatch] = createStartingTitles('p', 'Blackline Pro', 'hardcore', [
      belt({ suffix: 'Barbed Wire Championship', tier: 'hardcore', signatureStipulationId: 'flamingTables' }),
    ]);
    expect(deathmatch!.signatureStipulationId).toBe('flamingTables');
  });

  it('opens every belt vacant, whoever designed it', () => {
    const titles = createStartingTitles('p', 'Atlas Pro', 'athletic', [belt(), belt({ suffix: 'Second' })]);
    expect(titles.every((t) => t.vacant && t.currentHolderIds.length === 0)).toBe(true);
  });

  it('gives every belt a distinct id even with identical names', () => {
    const titles = createStartingTitles('p', 'Atlas Pro', 'athletic', [belt(), belt(), belt()]);
    expect(new Set(titles.map((t) => t.id)).size).toBe(3);
  });
});

describe('standing is earned, not typed', () => {
  it('takes prestige from the kind of belt rather than from the player', () => {
    // A blueprint has no prestige field on purpose: letting somebody open with
    // a 100-prestige world title is a promotion's credibility for free.
    expect(startingPrestige('world')).toBeGreaterThan(startingPrestige('tertiary'));
    const [world] = createStartingTitles('p', 'Atlas Pro', 'athletic', [belt({ tier: 'world' })]);
    const [low] = createStartingTitles('p', 'Atlas Pro', 'athletic', [belt({ tier: 'tertiary' })]);
    expect(world!.prestige).toBeGreaterThan(low!.prestige);
  });

  it('looks like the kind of belt it is', () => {
    const [world] = createStartingTitles('p', 'Atlas Pro', 'athletic', [belt({ tier: 'world' })]);
    const [tag] = createStartingTitles('p', 'Atlas Pro', 'athletic', [belt({ tier: 'tag' })]);
    expect(world!.colorway.plate).not.toBe(tag!.colorway.plate);
  });
});

describe('a save built with custom belts', () => {
  it('opens the world with them, and rivals keep their own', () => {
    const world = createInitialWorld(rngFromSeed('custom-belts'), {
      ...defaultWorldSettings(),
      promotionName: 'Bramble Hollow Wrestling',
      startingTitles: [
        belt({ suffix: 'Hollow Heavyweight Championship', tier: 'world' }),
        belt({ suffix: "Hollow Women's Championship", tier: 'world', division: 'womens' }),
      ],
    });

    const mine = world.titles.filter((t) => t.promotionId === world.promotion.id);
    expect(mine).toHaveLength(2);
    expect(mine.map((t) => t.name).join(' ')).toContain('Hollow Heavyweight Championship');
    expect(world.promotion.titleIds).toHaveLength(2);

    // Every rival still has a full lineup of its own — the player's choice is
    // theirs alone and does not reshape the rest of the business.
    for (const rival of world.rivals) {
      expect(world.titles.filter((t) => t.promotionId === rival.id).length, rival.name).toBeGreaterThan(2);
    }
  });

  it('still crowns opening champions on a custom lineup', () => {
    const world = createInitialWorld(rngFromSeed('custom-belts'), {
      ...defaultWorldSettings(),
      startingTitles: [belt({ suffix: 'The Big One', tier: 'world' })],
    });
    const mine = world.titles.filter((t) => t.promotionId === world.promotion.id);
    expect(mine).toHaveLength(1);
    // crownOpeningChampions runs over whatever lineup it is handed.
    expect(mine[0]!.name).toContain('The Big One');
  });
});

describe('the preset library', () => {
  it('offers a good spread beyond "Championship"', () => {
    // A booker building their own lineup should not be typing every belt from
    // a blank field, and a trophy, a crown and a cup all say something
    // different about a company before anybody has wrestled for them.
    expect(TITLE_PRESETS.length).toBeGreaterThan(15);
    for (const family of TITLE_PRESET_FAMILIES) {
      expect(TITLE_PRESETS.filter((p) => p.family === family).length, family).toBeGreaterThan(2);
    }
    const names = TITLE_PRESETS.map((p) => p.suffix).join(' ');
    for (const word of ['Trophy', 'Crown', 'Cup', 'Medal', 'Briefcase']) {
      expect(names, word).toContain(word);
    }
  });

  it('names a stipulation that actually exists', () => {
    // A preset pointing at a stipulation id that was renamed is silent — the
    // belt just never gets its signature match. 'submission' vs
    // 'submissionMatch' was exactly that, caught here.
    for (const preset of TITLE_PRESETS) {
      if (!preset.signatureStipulationId) continue;
      expect(stipulationById(preset.signatureStipulationId), preset.suffix).toBeDefined();
    }
  });

  it('gives every preset a distinct name and a real blurb', () => {
    const names = TITLE_PRESETS.map((p) => p.suffix);
    expect(new Set(names).size).toBe(names.length);
    for (const preset of TITLE_PRESETS) {
      expect(preset.blurb.length, preset.suffix).toBeGreaterThan(20);
    }
  });

  it('makes a real title out of any of them', () => {
    for (const preset of TITLE_PRESETS) {
      const [belt] = createStartingTitles('p', 'Atlas Pro', 'athletic', [preset]);
      expect(belt!.name, preset.suffix).toContain(preset.suffix);
      expect(belt!.vacant).toBe(true);
    }
  });
});

describe('a belt that can only be won one way', () => {
  const roster = () => generateWrestlers(rngFromSeed('stip-gate'), 8);

  function eligible(title: TitleBlueprint, sides: number[][], stipulationId: string | null) {
    const people = roster();
    const [belt] = createStartingTitles('p', 'Atlas Pro', 'athletic', [title]);
    return eligibleTitles([belt!], {
      promotionId: 'p',
      stipulationId,
      participants: sides.flatMap((side, index) =>
        side.map((i) => ({ wrestler: people[i]!, side: index })),
      ),
    });
  }

  const trophy = (over: Partial<TitleBlueprint> = {}): TitleBlueprint =>
    belt({
      suffix: 'Battle Royal Trophy',
      tier: 'tertiary',
      signatureStipulationId: 'battleRoyal',
      stipulationRequired: true,
      ...over,
    });

  it('refuses to go on the line under anything else', () => {
    expect(eligible(trophy(), [[0], [1]], null)).toEqual([]);
    expect(eligible(trophy(), [[0], [1]], 'steelCage')).toEqual([]);
  });

  it('goes on the line under the one it demands', () => {
    expect(eligible(trophy(), [[0], [1]], 'battleRoyal')).toHaveLength(1);
  });

  it('leaves an ordinary signature belt bookable anywhere', () => {
    // A tradition is not a rule unless the booker says it is.
    const soft = trophy({ stipulationRequired: false });
    expect(eligible(soft, [[0], [1]], null)).toHaveLength(1);
  });
});

describe('how many people hold it', () => {
  it('defaults to what the tier implies', () => {
    expect(defaultHolders('tag')).toBe(2);
    expect(defaultHolders('trios')).toBe(3);
    expect(defaultHolders('world')).toBe(1);
    const [tag] = createStartingTitles('p', 'Atlas Pro', 'athletic', [belt({ tier: 'tag' })]);
    expect(tag!.holdersRequired).toBe(2);
  });

  it("takes the booker's number over the tier's", () => {
    // "Held by two" should be sayable about any belt, not only a tag title.
    const [four] = createStartingTitles('p', 'Atlas Pro', 'athletic', [
      belt({ suffix: 'Stable Championship', tier: 'secondary', holdersRequired: 4 }),
    ]);
    expect(four!.holdersRequired).toBe(4);
  });

  it('is what the eligibility check actually counts', () => {
    const people = generateWrestlers(rngFromSeed('holders'), 8);
    const [pair] = createStartingTitles('p', 'Atlas Pro', 'athletic', [
      belt({ suffix: 'Duos Championship', tier: 'secondary', holdersRequired: 2 }),
    ]);
    const check = (sides: number[][]) =>
      eligibleTitles([pair!], {
        promotionId: 'p',
        participants: sides.flatMap((side, index) => side.map((i) => ({ wrestler: people[i]!, side: index }))),
      });
    expect(check([[0], [1]]), 'singles should not fit a two-person belt').toEqual([]);
    expect(check([[0, 1], [2, 3]])).toHaveLength(1);
  });
});

describe('what a belt looks like', () => {
  it('offers a range of schemes, each with a strap and a plate', () => {
    expect(TITLE_COLORWAYS.length).toBeGreaterThan(8);
    for (const scheme of TITLE_COLORWAYS) {
      expect(scheme.strap, scheme.name).toMatch(/^#[0-9a-f]{6}$/i);
      expect(scheme.plate, scheme.name).toMatch(/^#[0-9a-f]{6}$/i);
      expect(scheme.strap).not.toBe(scheme.plate);
    }
    expect(new Set(TITLE_COLORWAYS.map((c) => c.name)).size).toBe(TITLE_COLORWAYS.length);
  });

  it("uses the booker's choice, and the tier's when they have none", () => {
    const chosen = TITLE_COLORWAYS[4]!;
    const [painted] = createStartingTitles('p', 'Atlas Pro', 'athletic', [
      belt({ colorway: { strap: chosen.strap, plate: chosen.plate } }),
    ]);
    expect(painted!.colorway).toEqual({ strap: chosen.strap, plate: chosen.plate });

    const [defaulted] = createStartingTitles('p', 'Atlas Pro', 'athletic', [belt({ tier: 'world' })]);
    expect(defaulted!.colorway.plate).toBeDefined();
  });
});
