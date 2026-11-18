import { describe, expect, it } from 'vitest';
import { mulberry32, rngFromSeed } from '../rng';
import { generateWrestler } from '../generate/wrestler';
import { defaultWorldSettings } from '../world/settings';
import { seedRefereePool } from './referees';
import { cheatLine, planCheat, type CheatContext } from './cheating';
import type { Wrestler } from '../types';
import type { Manager } from './ringside';

const settings = defaultWorldSettings();
const rng = mulberry32(7);
const names = new Set<string>();
const person = (alignment: number): Wrestler => ({ ...generateWrestler(rng, names), alignment });
const heel = person(-100);
const face = person(100);
const devious: Manager = { id: 'mgr-1', name: 'Slick Eddie', micWork: 50, presence: 50, deviousness: 100, feePerShow: 0, blurb: '' };
const sharpest = [...seedRefereePool()].sort((a, b) => b.competence - a.competence)[0]!;

const ctx = (over: Partial<CheatContext> = {}): CheatContext => ({
  sides: [
    { side: 0, wrestlers: [heel], managers: [] },
    { side: 1, wrestlers: [face], managers: [] },
  ],
  referee: sharpest,
  guest: null,
  settings,
  ...over,
});
const many = (c: CheatContext, n = 4000) => Array.from({ length: n }, (_, i) => planCheat(rngFromSeed(`cheat-${i}`), c));

describe('behind the referee\'s back', () => {
  it('is a heel\'s game far more than a face\'s, and a devious manager in the corner makes it likelier', () => {
    const plans = many(ctx()).filter(Boolean);
    const byHeel = plans.filter((p) => p!.actorId === heel.id).length;
    const byFace = plans.filter((p) => p!.actorId === face.id).length;
    expect(byHeel).toBeGreaterThan(byFace * 4);
    const withManager = many(ctx({ sides: [{ side: 0, wrestlers: [face], managers: [devious] }, { side: 1, wrestlers: [face], managers: [] }] })).filter(Boolean);
    expect(withManager.filter((p) => p!.byManager).length).toBeGreaterThan(400);
  });

  it('is seen sometimes by a sharp official, never with nobody in the shirt, and exactly as a guest with an agenda wants', () => {
    const seen = (c: CheatContext) => many(c).filter((p) => p?.side === 0).map((p) => p!.seen);
    const sharp = seen(ctx());
    expect(sharp.some(Boolean)).toBe(true);
    expect(sharp.some((x) => !x)).toBe(true);
    expect(seen(ctx({ referee: null })).some(Boolean)).toBe(false);
    expect(seen(ctx({ referee: null, guest: { favoursSide: 0 } })).some(Boolean)).toBe(false);
    expect(seen(ctx({ referee: null, guest: { favoursSide: 1 } })).every(Boolean)).toBe(true);
  });

  it('only happens one-on-one sides, and the write-up names who, what and on whom', () => {
    expect(planCheat(rngFromSeed('x'), ctx({ sides: [ctx().sides[0]!, ctx().sides[1]!, { side: 2, wrestlers: [face], managers: [] }] }))).toBeNull();
    const plan = many(ctx()).find(Boolean)!;
    const line = cheatLine(plan, 'Bo', 0);
    expect(line).toContain(plan.actorName);
    expect(line).toContain('Bo');
    expect(line).not.toMatch(/\{/);
  });
});
