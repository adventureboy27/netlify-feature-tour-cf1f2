import { describe, expect, it } from 'vitest';
import { defaultFanTaste, driftFanTaste, fanTasteHighlights, styleRunShare, type FanTaste } from './fanTaste';
import { defaultWorldSettings } from './settings';
import { WRESTLING_STYLES } from '../../data/styles';
import type { WrestlingStyle } from '../types';

const settings = defaultWorldSettings();

function flatTaste(value = 50): FanTaste {
  const taste = {} as FanTaste;
  for (const style of WRESTLING_STYLES) taste[style] = value;
  return taste;
}

describe('starting taste', () => {
  it('gives every style a value, none of them missing', () => {
    const taste = defaultFanTaste('hardcore');
    for (const style of WRESTLING_STYLES) expect(taste[style]).toBeGreaterThanOrEqual(0);
  });

  it('leans toward the declared identity without maxing out', () => {
    const taste = defaultFanTaste('hardcore');
    // Favoured for a hardcore promotion (data/promotionIdentity.ts).
    expect(taste.hardcore).toBeGreaterThan(settings.fanTasteNeutral);
    expect(taste.hardcore).toBeLessThan(100);
    // Opposed.
    expect(taste.technical).toBeLessThan(settings.fanTasteNeutral);
  });

  it('stays neutral on a style the identity has no opinion about', () => {
    const taste = defaultFanTaste('hardcore');
    expect(taste.giant).toBe(settings.fanTasteNeutral);
  });
});

describe('reading the card', () => {
  it('splits an even card evenly', () => {
    const styles: WrestlingStyle[] = ['hardcore', 'hardcore', 'technical', 'technical'];
    const share = styleRunShare(styles);
    expect(share.hardcore).toBeCloseTo(0.5);
    expect(share.technical).toBeCloseTo(0.5);
  });

  it('gives nothing for a card nobody worked', () => {
    expect(styleRunShare([])).toEqual({});
  });

  it('leaves an unworked style out of the result entirely, not at zero', () => {
    const share = styleRunShare(['hardcore']);
    expect(share.technical).toBeUndefined();
  });
});

describe('the drift', () => {
  it('climbs toward love for a style run well above its fair share, week after week', () => {
    const taste = flatTaste(50);
    const heavyHardcoreNight = styleRunShare(['hardcore', 'hardcore', 'hardcore', 'bruiser', 'bruiser', 'striker']);
    for (let week = 0; week < 30; week++) driftFanTaste(taste, heavyHardcoreNight, settings);
    expect(taste.hardcore).toBeGreaterThan(70);
  });

  it('settles low for a style that never gets run, without collapsing to zero in one week', () => {
    const taste = flatTaste(50);
    const noLuchadorNight = styleRunShare(['hardcore', 'hardcore', 'bruiser', 'bruiser', 'striker', 'striker']);
    driftFanTaste(taste, noLuchadorNight, settings);
    // One missed week barely moves it.
    expect(taste.luchador).toBeGreaterThan(45);
    for (let week = 0; week < 40; week++) driftFanTaste(taste, noLuchadorNight, settings);
    // Sustained neglect settles it below neutral, but not pinned at zero.
    expect(taste.luchador).toBeLessThan(50);
    expect(taste.luchador).toBeGreaterThan(0);
  });

  it('holds roughly steady for a style run at its own fair share', () => {
    // Twelve styles, one match apiece — every style at exactly a fair share.
    const styles = [...WRESTLING_STYLES];
    const taste = flatTaste(50);
    const share = styleRunShare(styles);
    for (let week = 0; week < 20; week++) driftFanTaste(taste, share, settings);
    for (const style of WRESTLING_STYLES) expect(taste[style]).toBeCloseTo(50, 0);
  });

  it('stays in bounds at the extremes', () => {
    const taste = flatTaste(95);
    const allHardcore: WrestlingStyle[] = Array(20).fill('hardcore');
    for (let week = 0; week < 50; week++) driftFanTaste(taste, styleRunShare(allHardcore), settings);
    expect(taste.hardcore).toBeLessThanOrEqual(100);

    const cold = flatTaste(5);
    for (let week = 0; week < 50; week++) driftFanTaste(cold, {}, settings);
    for (const style of WRESTLING_STYLES) expect(cold[style]).toBeGreaterThanOrEqual(0);
  });

  it('mutates the object it is given, matching ageGimmick', () => {
    const taste = flatTaste(50);
    const before = taste.hardcore;
    driftFanTaste(taste, styleRunShare(['hardcore', 'hardcore', 'hardcore']), settings);
    expect(taste.hardcore).not.toBe(before);
  });

  it('leaves a cancelled night (nothing run) nudging gently toward neutral, not doing nothing', () => {
    const taste = flatTaste(80);
    const before = taste.hardcore;
    driftFanTaste(taste, {}, settings);
    expect(taste.hardcore).toBeLessThan(before);
  });
});

describe('what is worth naming', () => {
  it('calls out a style that has genuinely become a favourite', () => {
    const taste = flatTaste(50);
    taste.hardcore = 90;
    const { loved } = fanTasteHighlights(taste, settings);
    expect(loved).toContain('hardcore');
  });

  it('calls out a style that has genuinely gone cold', () => {
    const taste = flatTaste(50);
    taste.luchador = 10;
    const { cold } = fanTasteHighlights(taste, settings);
    expect(cold).toContain('luchador');
  });

  it('says nothing about a style sitting near neutral', () => {
    const taste = flatTaste(50);
    const { loved, cold } = fanTasteHighlights(taste, settings);
    expect(loved).toEqual([]);
    expect(cold).toEqual([]);
  });
});
