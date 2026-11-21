import { describe, expect, it } from 'vitest';
import type { MatchBeat } from '../types';
import { withRingProps } from './ringProps';

const nameOf = (id: string) => ({ a: 'Ace', b: 'Bo' })[id] ?? null;
const B = (over: Partial<MatchBeat>): MatchBeat => ({ kind: 'control', text: 'x.', significant: false, actorId: 'a', targetId: 'b', ...over });
const fetches = (beats: MatchBeat[]) => beats.filter((b) => b.fetched).map((b) => b.fetched!.item);

describe('where the furniture comes from', () => {
  it('goes under the ring for a chair the first time, as a moment of its own, and picks the same one up after that', () => {
    const out = withRingProps([B({ spot: 'weaponShot', weapon: 'chair' }), B({ spot: 'weaponShot', weapon: 'chair' })], { gearFamilyId: undefined, nameOf });
    expect(out).toHaveLength(3);
    expect(out[0]!.fetched).toEqual({ item: 'chair', from: 'underRing' });
    expect(out[0]!.text).toMatch(/^Ace .*under .*steel chair\./);
    expect(out[0]!.significant).toBe(true);
    expect(out[0]!.actorId).toBe('a');
    expect(out[1]!.spot).toBe('weaponShot');
    expect(fetches(out)).toEqual(['chair']);
  });

  it('takes the steps off the corner', () => {
    const out = withRingProps([B({ spot: 'stepsShot' })], { gearFamilyId: undefined, nameOf });
    expect(out[0]!.fetched).toEqual({ item: 'steps', from: 'corner' });
  });

  it('needs a new table after one is broken, and says it is another', () => {
    const out = withRingProps([B({ spot: 'tableThrough' }), B({ spot: 'tableFightOff' }), B({ spot: 'tableFightOff' })], { gearFamilyId: undefined, nameOf });
    expect(fetches(out)).toEqual(['table', 'table']);
    expect(out.filter((b) => b.fetched)[1]!.text).toMatch(/another table/);
  });

  it('gets the ladder out for a ladder match, and a new one after the first gives out', () => {
    const reel = [B({ kind: 'nearFall' }), B({ kind: 'gearFailure' }), B({ kind: 'finish' })];
    const out = withRingProps(reel, { gearFamilyId: 'ladder', nameOf });
    expect(out.map((b) => (b.fetched ? 'fetch' : b.kind))).toEqual(['fetch', 'nearFall', 'gearFailure', 'fetch', 'finish']);
    expect(out[3]!.text).toMatch(/another ladder/);
  });

  it('leaves a reel that needs nothing alone', () => {
    const plain = B({});
    expect(withRingProps([plain], { gearFamilyId: undefined, nameOf })).toEqual([plain]);
  });
});
