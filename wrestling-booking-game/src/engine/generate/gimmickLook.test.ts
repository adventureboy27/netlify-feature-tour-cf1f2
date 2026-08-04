import { describe, it, expect } from 'vitest';
import { applyGimmickLook, effectiveAppearance, stableColorsFrom } from './gimmickLook';
import { generateWrestler } from './wrestler';
import { rngFromSeed } from '../rng';
import { GIMMICKS } from '../../data/gimmicks';
import { APPEARANCE_TRAIT_RANGES } from './appearance';
import type { Appearance, Stable, Wrestler } from '../types';

const gimmick = (id: string) => GIMMICKS.find((g) => g.id === id)!;
const rng = () => rngFromSeed('look');

function someone(over: Partial<Wrestler> = {}): Wrestler {
  return { ...generateWrestler(rngFromSeed('w'), new Set()), ...over };
}

describe('every gimmick knows how it dresses', () => {
  it('gives all of them a look', () => {
    for (const g of GIMMICKS) expect(g.look, `${g.id} has no look`).toBeDefined();
  });

  it('only ever produces trait values inside the documented ranges', () => {
    const base = someone().appearance;
    for (const g of GIMMICKS) {
      const styled = applyGimmickLook(base, g, rngFromSeed(`r-${g.id}`));
      for (const [trait, max] of Object.entries(APPEARANCE_TRAIT_RANGES)) {
        const value = styled[trait as keyof Appearance];
        expect(value, `${g.id}.${trait}`).toBeGreaterThanOrEqual(0);
        expect(value, `${g.id}.${trait}`).toBeLessThanOrEqual(max);
      }
    }
  });
});

describe('applyGimmickLook', () => {
  it('puts a mask on a luchador who was not wearing one', () => {
    const bare: Appearance = { ...someone().appearance, mask: 0 };
    expect(applyGimmickLook(bare, gimmick('luchadorGimmick'), rng()).mask).toBeGreaterThan(0);
  });

  it('takes the mask off a gimmick that forbids one', () => {
    const masked: Appearance = { ...someone().appearance, mask: 5 };
    expect(applyGimmickLook(masked, gimmick('daredevil'), rng()).mask).toBe(0);
  });

  it('changes what a gimmick specifies and nothing else', () => {
    // A gimmick change is a change of character, not of person: skin tone,
    // build, height and face must survive it untouched.
    const before = someone().appearance;
    const after = applyGimmickLook(before, gimmick('richSnob'), rng());
    expect(after.skinTone).toBe(before.skinTone);
    expect(after.build).toBe(before.build);
    expect(after.height).toBe(before.height);
    expect(after.faceShape).toBe(before.faceShape);
    expect(after.eyes).toBe(before.eyes);
  });

  it('actually restyles the attire', () => {
    const before: Appearance = { ...someone().appearance, attireTop: 0, attireBottom: 0, boots: 0 };
    const after = applyGimmickLook(before, gimmick('rockstar'), rng());
    expect([after.attireTop, after.attireBottom, after.boots]).not.toEqual([0, 0, 0]);
  });

  it('leaves an appearance alone for a gimmick with no look', () => {
    const before = someone().appearance;
    const plain = { ...gimmick('rockstar'), look: undefined };
    expect(applyGimmickLook(before, plain, rng())).toBe(before);
  });

  it('never mutates the appearance it was given', () => {
    const before = someone().appearance;
    const snapshot = { ...before };
    applyGimmickLook(before, gimmick('luchadorGimmick'), rng());
    expect(before).toEqual(snapshot);
  });

  it('dresses a bald gimmick bald', () => {
    expect(applyGimmickLook(someone().appearance, gimmick('silentMonster'), rng()).hairStyle).toBe(0);
  });
});

describe('stable colours', () => {
  const a = someone({ id: 'a' });
  const b = someone({ id: 'b' });

  const stable = (over: Partial<Stable> = {}): Stable => ({
    id: 's1',
    name: 'The Firm',
    kind: 'stable',
    memberIds: ['a', 'b'],
    leaderId: 'a',
    colors: { primary: 5, secondary: 11, accent: 17 },
    unifiedLook: true,
    formedWeek: 1,
    disbandedWeek: null,
    record: { wins: 0, losses: 0, draws: 0 },
    ...over,
  });

  it('puts every member in the same colours', () => {
    const [lookA, lookB] = [a, b].map((w) => effectiveAppearance(w, [stable()]));
    expect(lookA!.primaryColor).toBe(5);
    expect(lookB!.primaryColor).toBe(5);
    expect(lookA!.secondaryColor).toBe(lookB!.secondaryColor);
    expect(lookA!.accentColor).toBe(lookB!.accentColor);
  });

  it('leaves everything except the colours alone, so members stay tellable apart', () => {
    const look = effectiveAppearance(a, [stable()]);
    expect(look.hairStyle).toBe(a.appearance.hairStyle);
    expect(look.skinTone).toBe(a.appearance.skinTone);
    expect(look.attireTop).toBe(a.appearance.attireTop);
  });

  it('gives a wrestler their own look back the moment they leave', () => {
    // Non-destructive is the whole point — no bookkeeping on disband.
    expect(effectiveAppearance(a, [stable({ memberIds: ['b'] })])).toBe(a.appearance);
    expect(effectiveAppearance(a, [stable({ disbandedWeek: 12 })])).toBe(a.appearance);
    expect(effectiveAppearance(a, [])).toBe(a.appearance);
  });

  it('does not dress a loose alliance alike', () => {
    expect(effectiveAppearance(a, [stable({ unifiedLook: false })])).toBe(a.appearance);
    expect(effectiveAppearance(a, [stable({ colors: null })])).toBe(a.appearance);
  });

  it('takes a new group\'s colours from its founder', () => {
    const colors = stableColorsFrom(a);
    expect(colors.primary).toBe(a.appearance.primaryColor);
    expect(colors.secondary).toBe(a.appearance.secondaryColor);
    expect(colors.accent).toBe(a.appearance.accentColor);
  });
});
