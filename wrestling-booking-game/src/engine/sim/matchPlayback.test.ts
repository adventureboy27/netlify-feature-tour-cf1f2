import { describe, it, expect } from 'vitest';
import { buildPlaybackTimeline, finishCallout } from './matchPlayback';
import { rngFromSeed } from '../rng';
import { generateWrestlers } from '../generate/wrestler';
import type { MatchBeat, Wrestler } from '../types';

function pair(): [Wrestler, Wrestler] {
  const [a, b] = generateWrestlers(rngFromSeed('playback'), 2, { currentYear: 1985 });
  return [a!, b!];
}

function beat(kind: MatchBeat['kind'], significant = true): MatchBeat {
  return { kind, text: `${kind} happens`, significant };
}

describe('buildPlaybackTimeline', () => {
  it('starts with the loser on top and flips at the hope spot', () => {
    const [a, b] = pair();
    const beats: MatchBeat[] = [beat('openingExchange'), beat('control'), beat('hopeSpot'), beat('control')];
    const timeline = buildPlaybackTimeline(beats, [a], [b], 'a'); // a wins, so b starts on top

    expect(timeline[0]!.actorId).toBe(b.id); // opening exchange: loser (b) on top
    expect(timeline[1]!.actorId).toBe(b.id); // still on top going into the hope spot
    expect(timeline[3]!.actorId).toBe(a.id); // after the flip, the winner is on top
  });

  it('resets to the winner on top at the finish, regardless of the last flip', () => {
    const [a, b] = pair();
    const beats: MatchBeat[] = [beat('hopeSpot'), beat('hopeSpot'), beat('finish')];
    const timeline = buildPlaybackTimeline(beats, [a], [b], 'a');
    const finishBeat = timeline[timeline.length - 1]!;
    expect(finishBeat.pose).toBe('finish');
    expect(finishBeat.actorId).toBe(a.id);
    expect(finishBeat.targetId).toBe(b.id);
  });

  it('maps every beat kind to the expected pose, with a whip on every third control beat', () => {
    const [a, b] = pair();
    const beats: MatchBeat[] = [
      beat('openingExchange'),
      beat('control'), // index 1
      beat('control'), // index 2
      beat('control'), // index 3 -> whip (3 % 3 === 0)
      beat('nearFall'),
      beat('signature'),
      beat('interference'),
      beat('botch'),
      beat('pyroBurn'),
      beat('gearFailure'),
      beat('finish'),
    ];
    const timeline = buildPlaybackTimeline(beats, [a], [b], 'a');
    expect(timeline.map((b) => b.pose)).toEqual([
      'exchange',
      'control',
      'control',
      'whip',
      'nearFall',
      'signature',
      'interference',
      'botch',
      'environmental',
      'environmental',
      'finish',
    ]);
  });

  it('never assigns an actor or target to an environmental beat', () => {
    const [a, b] = pair();
    const beats: MatchBeat[] = [beat('pyroBurn'), beat('gearFailure')];
    const timeline = buildPlaybackTimeline(beats, [a], [b], 'a');
    for (const pb of timeline) {
      expect(pb.actorId).toBeNull();
      expect(pb.targetId).toBeNull();
    }
  });

  it('only ever sets moveName on signature and finish beats, from the actor\'s own MoveSet', () => {
    const [a, b] = pair();
    const beats: MatchBeat[] = [beat('openingExchange'), beat('control'), beat('signature'), beat('finish')];
    const timeline = buildPlaybackTimeline(beats, [a], [b], 'a');

    expect(timeline[0]!.moveName).toBeNull();
    expect(timeline[1]!.moveName).toBeNull();

    const signatureBeat = timeline[2]!;
    const signatureActor = signatureBeat.actorId === a.id ? a : b;
    expect(signatureBeat.moveName).not.toBeNull();
    expect(signatureActor.moveSet.signatures.map((m) => m.name)).toContain(signatureBeat.moveName);

    const finishBeat = timeline[3]!;
    expect(finishBeat.actorId).toBe(a.id);
    expect(finishBeat.moveName).toBe(a.moveSet.finisher.name);
  });

  it('prefers a beat\'s own actorId/targetId over the rotation guess', () => {
    const [a, b] = pair();
    // If the guess ran, a control beat with b as sideA's only member would
    // put b on top (loser starts on top) — but this beat says otherwise.
    const beats: MatchBeat[] = [{ kind: 'control', text: 'control happens', significant: true, actorId: a.id, targetId: b.id }];
    const timeline = buildPlaybackTimeline(beats, [a], [b], 'a');
    expect(timeline[0]!.actorId).toBe(a.id);
    expect(timeline[0]!.targetId).toBe(b.id);
  });

  it('maps an elimination beat to the elimination pose and carries real ids', () => {
    const [a, b] = pair();
    const beats: MatchBeat[] = [{ kind: 'elimination', text: 'b goes over the top', significant: true, actorId: a.id, targetId: b.id }];
    const timeline = buildPlaybackTimeline(beats, [a], [b], 'a');
    expect(timeline[0]!.pose).toBe('elimination');
    expect(timeline[0]!.actorId).toBe(a.id);
    expect(timeline[0]!.targetId).toBe(b.id);
  });

  it('falls back to the rotation guess only when a beat has no actor/target at all', () => {
    const [a, b] = pair();
    const beats: MatchBeat[] = [beat('control')]; // no actorId/targetId set
    const timeline = buildPlaybackTimeline(beats, [a], [b], 'a');
    // Loser (b) starts on top per the momentum rule.
    expect(timeline[0]!.actorId).toBe(b.id);
  });

  it('rotates the spotlight across a tag team rather than always featuring the same member', () => {
    const [a, b] = pair();
    const [c, d] = pair();
    const beats: MatchBeat[] = [beat('control'), beat('nearFall'), beat('signature'), beat('interference')];
    // sideA has two members; nothing should crash, and actors should be drawn from sideA/sideB only.
    const timeline = buildPlaybackTimeline(beats, [a, c], [b, d], 'a');
    for (const pb of timeline) {
      if (pb.actorId) expect([a.id, c.id, b.id, d.id]).toContain(pb.actorId);
    }
  });

  it('keeps a real given id even when it belongs to nobody in the match — a manager, not a guess', () => {
    const [a, b] = pair();
    // simulateMatch.ts stamps the interference beat's actorId with a
    // manager's id, which never appears among the match's own competitors —
    // this must survive untouched rather than being overwritten by the
    // onTop/inTrouble rotation guess the way a truly id-less beat would be.
    const interferenceBeat: MatchBeat = { kind: 'interference', text: 'A mouthpiece got involved.', significant: true, actorId: 'mgr-not-a-competitor', targetId: b.id };
    const timeline = buildPlaybackTimeline([interferenceBeat], [a], [b], 'a');
    expect(timeline[0]!.actorId).toBe('mgr-not-a-competitor');
    expect(timeline[0]!.targetId).toBe(b.id);
  });
});

describe('finishCallout', () => {
  it('gives every FinishType a distinct, non-empty callout', () => {
    const finishes = [
      'cleanPin',
      'submission',
      'knockout',
      'rollup',
      'interference',
      'disqualification',
      'countOut',
      'timeLimitDraw',
      'doubleKO',
      'refereeStoppage',
      'injuryStoppage',
      'escape',
      'equipmentFailure',
    ] as const;
    const callouts = finishes.map((f) => finishCallout(f));
    expect(callouts.every((c) => c.length > 0)).toBe(true);
    // cleanPin and rollup are legitimately the same word (both a pinfall) — every other pairing should differ.
    const distinct = new Set(callouts);
    expect(distinct.size).toBe(callouts.length - 1);
  });
});
