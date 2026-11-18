import { describe, expect, it } from 'vitest';
import { rngFromSeed } from '../rng';
import type { MatchBeat, RefereeMissRecord } from '../types';
import { placeGuestCounts, placeMiss, placeMugging, placeRunIn } from './officiating';
import { REFEREE_MISSES, missesFor } from '../../data/refereeMisses';

const reel = (): MatchBeat[] => [
  { kind: 'openingExchange', text: 'They lock up.', significant: false },
  { kind: 'nearFall', text: 'B covers A for two.', significant: true, actorId: 'b', targetId: 'a' },
  { kind: 'nearFall', text: 'A covers B for two.', significant: true, actorId: 'a', targetId: 'b' },
  { kind: 'finish', text: 'A pins B.', significant: true, actorId: 'a', targetId: 'b' },
];

const miss = (missId: string): RefereeMissRecord => ({
  refereeId: 'ref',
  refereeName: 'Earl',
  missId,
  text: `Earl missed it (${missId}).`,
  victimId: 'b',
});

describe('placeMiss', () => {
  const ctx = { winnerIds: ['a'], loserIds: ['b'], finish: 'cleanPin' as const };

  it('puts a miss on the finish on the finish itself, and nowhere else', () => {
    const out = placeMiss(reel(), miss('footOnRope'), ctx);
    expect(out).toHaveLength(4);
    expect(out[3]!.official).toBe('footOnRope');
    expect(out.slice(0, 3).every((b) => !b.official)).toBe(true);
  });

  it('puts a slow count on every count he made', () => {
    const out = placeMiss(reel(), miss('slowCount'), ctx);
    expect(out.filter((b) => b.official === 'slowCount')).toHaveLength(3);
  });

  it('gives a miss of its own a moment just before the finish, with the line and who it went against', () => {
    const out = placeMiss(reel(), miss('lowBlow'), ctx);
    expect(out).toHaveLength(5);
    expect(out[3]).toMatchObject({ official: 'lowBlow', text: 'Earl missed it (lowBlow).', actorId: 'a', targetId: 'b' });
    // The miss panel says it in the write-up; the highlights do not repeat it.
    expect(out[3]!.significant).toBe(false);
    expect(out[4]!.kind).toBe('finish');
  });

  it('pins a missed interference on the run-in it missed', () => {
    const withRunIn = placeRunIn(reel(), { runnerId: 'c', runnerName: 'C', victimId: 'b', victimName: 'B', disqualified: false, rng: rngFromSeed('t') });
    const out = placeMiss(withRunIn, miss('missedInterference'), { ...ctx, finish: 'interference' });
    expect(out).toHaveLength(withRunIn.length);
    expect(out.find((b) => b.ringsideId === 'c')!.official).toBe('missedInterference');
  });

  it('never touches the beats it was given', () => {
    const before = reel();
    placeMiss(before, miss('footOnRope'), ctx);
    expect(before[3]!.official).toBeUndefined();
  });

  it('stamps the real finish, not a manager caught at the top of the reel', () => {
    const caught: MatchBeat = { kind: 'finish', text: 'Caught.', significant: true, official: 'caught' };
    const out = placeMiss([caught, ...reel()], miss('blewTheFinish'), ctx);
    expect(out[0]!.official).toBe('caught');
    expect(out[4]!.official).toBe('blewTheFinish');
  });
});

describe('which misses a match can have', () => {
  it('only counts three over a foot on the rope in a match that ended in a three-count', () => {
    const sub = missesFor(false, false, 'submission').map((m) => m.id);
    expect(sub).not.toContain('footOnRope');
    expect(sub).not.toContain('shoulderUp');
    expect(missesFor(false, false, 'cleanPin').map((m) => m.id)).toContain('footOnRope');
    expect(missesFor(false, false, 'cleanPin').map((m) => m.id)).not.toContain('lostCountOut');
    expect(missesFor(false, false, 'countOut').map((m) => m.id)).toContain('lostCountOut');
  });

  it('always leaves something he could have missed, so the roll never changes how many draws it takes', () => {
    const finishes = ['cleanPin', 'submission', 'knockout', 'rollup', 'interference', 'disqualification', 'countOut', 'timeLimitDraw', 'doubleKO', 'refereeStoppage', 'injuryStoppage', 'escape', 'equipmentFailure', 'lastFactionStanding'] as const;
    for (const finish of finishes) expect(missesFor(false, false, finish).length).toBeGreaterThan(0);
  });

  it('says where every miss happened', () => {
    for (const m of REFEREE_MISSES) expect(['finish', 'counts', 'during']).toContain(m.when);
  });
});

describe('placeGuestCounts', () => {
  const nameOf = (id: string) => id.toUpperCase();

  it('gives the side he favours a fast three, and says so', () => {
    const out = placeGuestCounts(reel(), { guestName: 'Guest', favoured: new Set(['a']), finish: 'cleanPin', nameOf, rng: rngFromSeed('g') });
    const finish = out[3]!;
    expect(finish.official).toBe('fastCount');
    expect(finish.text.startsWith('A pins B. ')).toBe(true);
    expect(finish.text).toContain('Guest');
  });

  it("slow-counts the other side's first cover on the one he favours", () => {
    const out = placeGuestCounts(reel(), { guestName: 'Guest', favoured: new Set(['a']), finish: 'cleanPin', nameOf, rng: rngFromSeed('g') });
    expect(out[1]!.official).toBe('guestSlowCount');
    expect(out[1]!.text).toContain('Guest');
    expect(out[2]!.official).toBeUndefined();
  });

  it('drags the count on the finish too, when the one he wanted lost anyway', () => {
    const out = placeGuestCounts(reel(), { guestName: 'Guest', favoured: new Set(['b']), finish: 'cleanPin', nameOf, rng: rngFromSeed('g') });
    expect(out[3]!.official).toBe('guestSlowCount');
  });

  it('has nothing to count in a match that did not end on a count', () => {
    const out = placeGuestCounts(reel(), { guestName: 'Guest', favoured: new Set(['a']), finish: 'submission', nameOf, rng: rngFromSeed('g') });
    expect(out[3]!.official).toBeUndefined();
  });
});

describe('people outside the ropes', () => {
  it('names the man who ran in, in the write-up, on the beat before the finish', () => {
    const out = placeRunIn(reel(), { runnerId: 'c', runnerName: 'Cutter', victimId: 'b', victimName: 'Bo', disqualified: false, rng: rngFromSeed('r') });
    const run = out[3]!;
    expect(run).toMatchObject({ kind: 'interference', official: 'runIn', ringsideId: 'c', actorId: 'c', targetId: 'b', significant: true });
    expect(run.text).toContain('Cutter');
    expect(run.text).toContain('Bo');
    expect(run.text).not.toMatch(/\{/);
  });

  it('puts the mugging in the match, with the muscle on the victim and the mouthpiece on the official', () => {
    const out = placeMugging(reel(), { muscleId: 'm', distractorId: 'd', victimId: 'b', text: 'D had the referee; M put B into the barricade.' });
    expect(out[3]).toMatchObject({ official: 'mugging', actorId: 'm', targetId: 'b', ringsideId: 'd' });
  });
});
