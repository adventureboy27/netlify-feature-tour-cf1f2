// The match viewer decides nothing about a match — but it makes three
// promises about how it shows one, and each of them is a thing that can be
// checked without a browser:
//
//   the move in the ring is the move the commentary names,
//   the match flows (variety, and somebody on the mat is dealt with there),
//   and the ring is solid (ropes, mat, floor).

import { describe, expect, it } from 'vitest';
import { PLAY_BY_PLAY } from '../../data/commentaryLines';
import { generateWrestlers } from '../../engine/generate/wrestler';
import { rngFromSeed } from '../../engine/rng';
import type { PlaybackBeat } from '../../engine/sim/matchPlayback';
import { DOWN, FLOOR, FRONT_FLOOR, META, MOVE_IDS, endPose, isDown, moveSaid, stageMatch, stageMove, understands, type MoveId } from './choreography';
import { RING, onFrontFloor, planBeat, type PlanFighter, type WorldPose } from './ringPhysics';

const [alpha, bravo] = generateWrestlers(rngFromSeed('match-viewer'), 2) as [ReturnType<typeof generateWrestlers>[number], ReturnType<typeof generateWrestlers>[number]];
const cast = new Map([alpha, bravo].map((w) => [w.id, w] as const));
const beat = (pose: PlaybackBeat['pose'], over: Partial<PlaybackBeat> = {}): PlaybackBeat => ({
  kind: 'control',
  pose,
  text: '',
  significant: true,
  actorId: alpha.id,
  targetId: bravo.id,
  moveName: null,
  ...over,
});

describe('the ring shows what the commentary says', () => {
  it('understands every play-by-play line that describes action', () => {
    for (const kind of ['openingExchange', 'control', 'hopeSpot', 'signature'] as const) {
      for (const line of PLAY_BY_PLAY[kind] ?? []) {
        // A new line with no rule would be staged as whatever the viewer
        // felt like — exactly the mismatch this exists to prevent. Add a
        // pattern to choreography.ts's SAID when adding a line.
        expect(understands(line), `no staging rule for: "${line}"`).toBe(true);
      }
    }
  });

  it('stages the named move', () => {
    const cases: [string, MoveId][] = [
      ['Collar and elbow to start, and A backs B into the corner.', 'lockupCorner'],
      ['Off the ropes, shoulder block, and B goes down hard.', 'shoulderBlock'],
      ['A takes over now. Stomps in the corner and the referee is counting.', 'cornerStomp'],
      ['A hard whip into the corner and B folds up on impact.', 'cornerWhip'],
      ['Backbreaker, and A holds them there across the knee.', 'backbreaker'],
      ['A slows it right down — a chinlock, and the crowd does not like it.', 'groundHold'],
      ['A drives a knee into the midsection and B drops to a knee.', 'kneeLift'],
      ['Out of nothing — A catches the foot and turns it into a takedown!', 'takedown'],
      ['Right hands. One after another, and B has nowhere to go.', 'flurry'],
    ];
    for (const [text, move] of cases) {
      expect(moveSaid(text), text).toBe(move);
      const { moments } = stageMatch([beat('control')], [{ speaker: 'play', name: 'PBP', text, beat: 0 }], cast, 'cleanPin');
      expect(moments[0]!.staged.move, text).toBe(move);
    }
  });

  it('never leaves the one the line says is on top as the only one on the mat', () => {
    // Every action line is written "{onTop} does it to {inTrouble}". Whatever
    // it is staged as, the attacker must not be the one who comes off worse:
    // if they end on the mat (a crossbody, a spear), so does the other.
    for (const kind of ['openingExchange', 'control', 'hopeSpot', 'signature'] as const) {
      for (const text of PLAY_BY_PLAY[kind] ?? []) {
        for (const targetDown of [false, true]) {
          const down = targetDown ? [beat('control'), beat('control')] : [beat('control')];
          const lines = [{ speaker: 'play' as const, name: 'P', text, beat: down.length - 1, actorId: alpha.id, targetId: bravo.id }];
          const { moments } = stageMatch(down, lines, cast, 'cleanPin');
          const called = moments.find((m) => m.lines.length > 0)!;
          expect(called.actorId, text).toBe(alpha.id);
          expect(called.targetId, text).toBe(bravo.id);
          const attackerDown = isDown(endPose(called.staged.choreo.actor));
          const targetIsDown = isDown(endPose(called.staged.choreo.target));
          expect(attackerDown && !targetIsDown, `"${text}" staged as ${called.staged.move}`).toBe(false);
        }
      }
    }
  });

  it('puts the two the line names in the ring, the right way round', () => {
    // The beat says alpha did it; the call says bravo is on top. The call wins.
    const line = { speaker: 'play' as const, name: 'PBP', text: 'B takes over now.', beat: 0, actorId: bravo.id, targetId: alpha.id };
    const { moments } = stageMatch([beat('control')], [line], cast, 'cleanPin');
    expect(moments[0]!.actorId).toBe(bravo.id);
    expect(moments[0]!.targetId).toBe(alpha.id);
  });

  it('keeps every line on the beat it was said over', () => {
    const timeline = [beat('exchange'), beat('control'), beat('comeback'), beat('finish')];
    const lines = timeline.flatMap((_, i) => [
      { speaker: 'play' as const, name: 'P', text: `call ${i}`, beat: i },
      { speaker: 'colour' as const, name: 'C', text: `colour ${i}`, beat: i },
    ]);
    const staged = stageMatch(timeline, [{ speaker: 'play', name: 'P', text: 'intro' }, ...lines, { speaker: 'colour', name: 'C', text: 'outro', beat: 4 }], cast, 'cleanPin');
    expect(staged.before.map((l) => l.text)).toEqual(['intro']);
    expect(staged.after.map((l) => l.text)).toEqual(['outro']);
    const real = staged.moments.filter((m) => !m.filler);
    expect(real.map((m) => m.lines.map((l) => l.text))).toEqual(timeline.map((_, i) => [`call ${i}`, `colour ${i}`]));
    // The unspoken exchanges in between are exactly that.
    expect(staged.moments.filter((m) => m.filler).every((m) => m.lines.length === 0)).toBe(true);
  });
});

describe('the match flows', () => {
  const long = Array.from({ length: 9 }, (_, i) => beat(i === 0 ? 'exchange' : i === 8 ? 'finish' : i % 4 === 0 ? 'comeback' : 'control'));

  it('is more than the handful of beats the simulation recorded, and never the same move twice running', () => {
    const { moments } = stageMatch(long, [], cast, 'cleanPin');
    expect(moments.length).toBeGreaterThan(long.length * 2);
    for (let i = 1; i < moments.length; i++) {
      expect(moments[i]!.staged.move, `beats ${i - 1} and ${i}`).not.toBe(moments[i - 1]!.staged.move);
    }
    expect(new Set(moments.map((m) => m.staged.move)).size).toBeGreaterThanOrEqual(10);
  });

  it('deals with somebody on the mat where they lie', () => {
    const { moments } = stageMatch(long, [], cast, 'cleanPin');
    let checked = 0;
    for (let i = 1; i < moments.length; i++) {
      const before = moments[i - 1]!;
      const now = moments[i]!;
      const leftDown = isDown(endPose(before.staged.choreo.target)) && before.targetId === now.targetId;
      if (!leftDown || now.beat.pose !== 'control') continue;
      checked++;
      // Either a move you do to a downed opponent, or one that opens by
      // putting them down (which is skipped: they are down).
      expect(now.staged.meta.needsDown || now.staged.meta.knockdownBy !== undefined, `${before.staged.move} then ${now.staged.move}`).toBe(true);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('carries each wrestler from where the last move left them', () => {
    const first = planBeat(stageMove('slam'), [fighter('a', 'actor', 1), fighter('b', 'target', -1)], 0);
    const second = planBeat(stageMove('stomp'), [fighter('a', 'actor', 1, first.end.get('a')), fighter('b', 'target', -1, first.end.get('b'))], first.centre);
    const down = first.end.get('b')!;
    // The target never moved: the stomp came to them.
    for (const frame of second.tracks.get('b')!) expect(Math.abs(frame.x - down.x)).toBeLessThan(0.01);
    // And the attacker starts the next move from where the slam ended.
    expect(second.tracks.get('a')![0]).toMatchObject(first.end.get('a')!);
  });
});

function fighter(id: string, role: 'actor' | 'target', dir: 1 | -1, from?: WorldPose): PlanFighter {
  return { id, role, dir, from, taggedIn: false };
}

describe('the ring is solid', () => {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const head = (f: { x: number; y: number; rot: number }) => ({ x: f.x + Math.sin(rad(f.rot)) * RING.tall, y: f.y + Math.cos(rad(f.rot)) * RING.tall });
  // Everywhere a beat might start from: nowhere in particular, both ends of
  // the ring, and with the target already flat on the mat in a corner.
  const starts: (WorldPose | undefined)[][] = [
    [undefined, undefined],
    [{ x: -22, y: 0, rot: 0 }, { x: -9, y: 0, rot: 0 }],
    [{ x: 10, y: 0, rot: 0 }, { x: 23, y: 0, rot: 0 }],
    [{ x: 0, y: 0, rot: 0 }, { x: 5, y: DOWN, rot: 90 }],
    [{ x: -3, y: 0, rot: 0 }, { x: -4, y: DOWN, rot: -90 }],
  ];

  // (The two moves that cross between ring and floor are checked on their own below.)
  for (const move of MOVE_IDS.filter((id) => id !== 'tossOutside' && id !== 'rollInside')) {
    it(`${move}: nobody goes through the ropes or the mat`, () => {
      for (const dirs of [[1, -1], [-1, 1]] as const) {
        for (const [from, toFrom] of starts) {
          const plan = planBeat(stageMove(move), [fighter('a', 'actor', dirs[0], from), fighter('t', 'target', dirs[1], toFrom)], 0);
          const exits = META[move]?.exits;
          for (const id of ['a', 't']) {
            const frames = plan.tracks.get(id)!;
            // The pose a beat starts from is the last beat's business; this
            // move answers for everything after it.
            for (const frame of frames.slice(plan.lead > 0 ? 1 : 0)) {
              const at = plan.lead > 0 ? (frame.at - plan.lead) / (1 - plan.lead) : frame.at;
              if (id === 't' && exits !== undefined && at >= exits - 1e-6) continue;
              const top = head(frame);
              const where = `${move} ${id} at ${frame.at.toFixed(2)} x=${frame.x.toFixed(1)} head=${top.x.toFixed(1)} y=${frame.y.toFixed(1)}`;
              if (frame.y < RING.topRope) {
                expect(Math.max(frame.x, top.x), where).toBeLessThanOrEqual(RING.half + 0.01);
                expect(Math.min(frame.x, top.x), where).toBeGreaterThanOrEqual(-RING.half - 0.01);
              }
              expect(frame.y, where).toBeGreaterThanOrEqual(-0.01);
              expect(top.y, where).toBeGreaterThanOrEqual(-0.01);
            }
          }
        }
      }
    });
  }

  it('the only way out is over the top rope, and it ends on the floor', () => {
    for (const move of MOVE_IDS.filter((id) => META[id]?.exits !== undefined)) {
      for (const dirs of [[1, -1], [-1, 1]] as const) {
        const plan = planBeat(stageMove(move), [fighter('a', 'actor', dirs[0]), fighter('t', 'target', dirs[1])], 0);
        const frames = plan.tracks.get('t')!;
        const last = frames[frames.length - 1]!;
        expect(Math.abs(last.x), `${move} lands outside`).toBeGreaterThan(RING.half + 3);
        expect(last.y, `${move} lands on the floor`).toBeLessThan(FLOOR + DOWN + 1);
        expect(last.y, `${move} does not sink into it`).toBeGreaterThanOrEqual(FLOOR - 0.01);
        // Whenever the body is passing the ropes, it is above them.
        for (const frame of frames) {
          if (Math.abs(Math.abs(frame.x) - RING.half) < 2 && frame.y > FLOOR / 2) expect(frame.y, `${move} clears the top rope`).toBeGreaterThan(RING.topRope);
        }
        // And the attacker stays in.
        for (const frame of plan.tracks.get('a')!) expect(Math.abs(frame.x), `${move} attacker`).toBeLessThanOrEqual(RING.half);
      }
    }
  });
});

describe('fighting outside', () => {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const long = Array.from({ length: 6 }, (_, i) => beat(i === 0 ? 'exchange' : i === 5 ? 'finish' : 'control'));

  it('never happens unless the rules allow it', () => {
    const { moments } = stageMatch(long, [], cast, 'cleanPin');
    expect(moments.every((m) => (m.staged.zone ?? 'ring') === 'ring')).toBe(true);
  });

  it('goes out, works on the floor, and comes back before anything the caller has a line for', () => {
    const lines = long.map((_, i) => ({ speaker: 'play' as const, name: 'P', text: `call ${i}`, beat: i }));
    const { moments } = stageMatch(long, lines, cast, 'cleanPin', true);
    const zones = moments.map((m) => m.staged.zone ?? 'ring');
    const out = zones.indexOf('out');
    const back = zones.indexOf('in');
    expect(out).toBeGreaterThan(0);
    expect(back).toBeGreaterThan(out + 1);
    expect(zones.slice(out + 1, back).every((z) => z === 'floor')).toBe(true);
    // Everything else, and every beat with a line over it, is in the ring.
    expect(zones.filter((_, i) => i < out || i > back).every((z) => z === 'ring')).toBe(true);
    expect(moments.filter((m) => m.lines.length > 0).every((m) => (m.staged.zone ?? 'ring') === 'ring')).toBe(true);
    // The finish is in the ring.
    expect(zones[zones.length - 1]).toBe('ring');
  });

  it('puts the floor under them and the barricades either side', () => {
    const { moments } = stageMatch(long, [], cast, 'cleanPin', true);
    const left = new Map<string, WorldPose>();
    let centre = 0;
    for (const m of moments) {
      const plan = planBeat(m.staged, [fighter(m.actorId!, 'actor', 1, left.get(m.actorId!)), fighter(m.targetId!, 'target', -1, left.get(m.targetId!))], centre);
      centre = plan.centre;
      const zone = m.staged.zone ?? 'ring';
      for (const [id, frames] of plan.tracks) {
        for (const frame of frames.slice(1)) {
          const where = `${m.staged.move} (${zone}) x=${frame.x.toFixed(1)} y=${frame.y.toFixed(1)}`;
          const headX = frame.x + Math.sin(rad(frame.rot)) * RING.tall;
          const headY = frame.y + Math.cos(rad(frame.rot)) * RING.tall;
          // Nothing below the floor, ever; nothing past a barricade.
          expect(Math.min(frame.y, headY), where).toBeGreaterThanOrEqual(FRONT_FLOOR - 0.01);
          expect(Math.max(Math.abs(frame.x), Math.abs(headX)), where).toBeLessThanOrEqual(RING.floorHalf + 0.01);
          // (A body can be in the air down there — being slammed — so height
          // alone proves nothing; where each step ENDS is checked below.)
        }
        left.set(id, plan.end.get(id)!);
      }
      // After each step they are where the step says they should be.
      const where = [...plan.end.values()].map(onFrontFloor);
      if (zone === 'out' || zone === 'floor') expect(where, m.staged.move).toEqual([true, true]);
      if (zone === 'in' || zone === 'ring') {
        expect(where, m.staged.move).toEqual([false, false]);
        // Back inside the ropes, not hanging through them.
        for (const pose of plan.end.values()) {
          const headX = pose.x + Math.sin(rad(pose.rot)) * RING.tall;
          expect(Math.max(Math.abs(pose.x), Math.abs(headX)), `${m.staged.move} ends inside`).toBeLessThanOrEqual(RING.half + 0.01);
        }
      }
    }
  });
});
