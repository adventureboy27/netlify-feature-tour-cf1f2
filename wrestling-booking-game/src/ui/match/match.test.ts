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
import { BRAWL, DOWN, FLOOR, FRONT_FLOOR, GAP, META, MOVE_IDS, endPose, isDown, moveSaid, stageMatch, stageMove, understands, type MoveId } from './choreography';
import { STANDARD, conductOf, type Conduct } from './conduct';
import type { FinishType, MatchRules } from '../../engine/types';
import { FIELD, RING, onFrontFloor, planBeat, type PlanFighter, type WorldPose } from './ringPhysics';

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
  for (const move of MOVE_IDS.filter((id) => id !== 'tossOutside' && id !== 'rollInside' && id !== 'throwOut')) {
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
              const actorExits = META[move]?.actorExits;
              if (id === 'a' && actorExits !== undefined && at >= actorExits - 1e-6) continue;
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
    const { moments } = stageMatch(long, lines, cast, 'cleanPin', { conduct: { ...STANDARD, outside: true } });
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
    const { moments } = stageMatch(long, [], cast, 'cleanPin', { conduct: { ...STANDARD, outside: true } });
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

describe('there is always action', () => {
  it('a battle royal field brawls where it stands, for as long as it likes, without leaving or eliminating anybody', () => {
    for (const move of BRAWL) {
      expect(META[move]?.exits, `${move} must not put anybody out`).toBeUndefined();
      expect(META[move]?.anchor, `${move} must not need the ropes`).toBeUndefined();
      expect(META[move]?.needsDown ?? false, `${move} must not need a downed opponent`).toBe(false);
    }
    const rad = (deg: number) => (deg * Math.PI) / 180;
    for (const station of [-24, 0, 24]) {
      const left = new Map<string, WorldPose>();
      for (let round = 0; round < 60; round++) {
        const cast = [
          fighter('a', round % 2 === 0 ? 'actor' : 'target', 1, left.get('a')),
          fighter('b', round % 2 === 0 ? 'target' : 'actor', -1, left.get('b')),
        ];
        const plan = planBeat(stageMove(BRAWL[(round * 5) % BRAWL.length]!), cast, station, { half: FIELD.half, near: station });
        for (const [id, frames] of plan.tracks) {
          for (const frame of frames.slice(1)) {
            const head = frame.x + Math.sin(rad(frame.rot)) * RING.tall;
            const where = `round ${round} at station ${station}: x=${frame.x.toFixed(1)}`;
            expect(Math.max(Math.abs(frame.x), Math.abs(head)), where).toBeLessThanOrEqual(FIELD.half + 0.01);
            expect(frame.y, where).toBeGreaterThanOrEqual(-0.01);
            // And it stays on its own patch: within a couple of body lengths of the station.
            expect(Math.abs(frame.x - station), where).toBeLessThan(GAP / 2 + RING.tall + 8);
          }
          left.set(id, plan.end.get(id)!);
        }
      }
    }
  });

  it('a tag team in control makes its own tags, and only that team', () => {
    const [charlie, delta] = generateWrestlers(rngFromSeed('partners'), 2);
    const four = new Map([alpha, bravo, charlie!, delta!].map((w) => [w.id, w] as const));
    const timeline = Array.from({ length: 6 }, (_, i) => beat(i === 0 ? 'exchange' : i === 5 ? 'finish' : 'control'));
    const teams = [[alpha.id, charlie!.id], [bravo.id, delta!.id]];
    const { moments } = stageMatch(timeline, [], four, 'cleanPin', { conduct: { ...STANDARD, tags: true }, teams });
    const attackers = new Set(moments.map((m) => m.actorId));
    // The partner gets in...
    expect(attackers.has(charlie!.id)).toBe(true);
    // ...the other side, which is taking the beating throughout, never does.
    expect(attackers.has(delta!.id)).toBe(false);
    expect(moments.every((m) => m.targetId === bravo.id)).toBe(true);
    // And every beat the simulation recorded is still alpha's, as recorded.
    expect(moments.filter((m) => !m.filler).every((m) => m.actorId === alpha.id)).toBe(true);
  });

  it('the announced move is the very next thing done', () => {
    const timeline = [beat('exchange'), beat('control'), beat('control'), beat('finish')];
    const lines = [
      { speaker: 'play' as const, name: 'P', text: 'Backbreaker, and A holds them there across the knee.', beat: 1, actorId: alpha.id, targetId: bravo.id },
      { speaker: 'play' as const, name: 'P', text: 'Clothesline! A nearly takes their head off.', beat: 2, actorId: alpha.id, targetId: bravo.id },
    ];
    const { moments } = stageMatch(timeline, lines, cast, 'cleanPin');
    for (const [text, move] of [['Backbreaker', 'backbreaker'], ['Clothesline', 'clothesline']] as const) {
      const called = moments.find((m) => m.lines.some((l) => l.text.startsWith(text)))!;
      expect(called.staged.move).toBe(move);
      // Unspoken work leads up to it, and it is not that same move.
      const before = moments[moments.indexOf(called) - 1]!;
      expect(before.filler).toBe(true);
      expect(before.staged.move).not.toBe(move);
    }
  });
});

// ---------------------------------------------------------------------------
// The rulebook. Whatever the stipulation and the rules say, the staging does.
// ---------------------------------------------------------------------------

const PLAIN_RULES: MatchRules = {
  preset: 'singles',
  format: 'individuals',
  ruleStrictness: 'strict',
  aim: 'firstFall',
  falls: 'pinsAndSubs',
  timeLimit: 0,
  stoppage: 'none',
  countOuts: 'normal',
  reward: 'none',
  pace: 'standard' as MatchRules['pace'],
};
const rulebook = (stipulation: string | null, finish: FinishType = 'cleanPin', rules: Partial<MatchRules> = {}, sizes: readonly [number, number] = [1, 1]) =>
  conductOf({ stipulation, rules: { ...PLAIN_RULES, ...rules } }, finish, sizes);
/** A whole match under these rules, start to finish. */
const played = (conduct: Conduct, finish: FinishType = 'cleanPin') =>
  stageMatch([beat('exchange'), beat('control'), beat('nearFall'), beat('comeback'), beat('control'), beat('nearFall'), beat('finish')], [], cast, finish, { conduct }).moments;

describe('the rules of the match are the rules of the picture', () => {
  it('an ordinary match: pins, in the ring, no chairs', () => {
    const conduct = rulebook(null);
    expect(conduct).toMatchObject({ outside: false, weapons: false, cage: false, allIn: false, nearFall: 'cover', finish: 'pin' });
    const moments = played(conduct);
    expect(moments.every((m) => (m.staged.zone ?? 'ring') === 'ring')).toBe(true);
    expect(moments.every((m) => m.staged.prop === undefined)).toBe(true);
    expect(moments[moments.length - 1]!.staged.choreo.cover?.count).toBe(3);
  });

  it('a submission match never shows a pin attempt', () => {
    const conduct = rulebook('submissionMatch', 'submission');
    expect(conduct).toMatchObject({ nearFall: 'hold', finish: 'submission' });
    const moments = played(conduct, 'submission');
    expect(moments.every((m) => m.staged.choreo.cover === undefined)).toBe(true);
    expect(moments[moments.length - 1]!.staged.move).toBe('submission');
  });

  it('last man standing is counted to ten, never pinned', () => {
    const conduct = rulebook('lastManStanding', 'knockout');
    expect(conduct).toMatchObject({ nearFall: 'count', finish: 'count10', weapons: true });
    const moments = played(conduct, 'knockout');
    const counts = moments.map((m) => m.staged.choreo.cover?.count).filter((c): c is number => c !== undefined);
    // Near falls are counts somebody beats; the finish is the one nobody does.
    expect(counts.every((c) => c > 3)).toBe(true);
    expect(counts[counts.length - 1]).toBe(10);
    // Nobody is lying across anybody: the attacker is on their feet for every count.
    for (const m of moments.filter((x) => x.staged.choreo.cover)) expect(isDown(endPose(m.staged.choreo.actor))).toBe(false);
  });

  it('a battle royal ends over the top rope, with nobody pinned and nobody on the floor by choice', () => {
    const conduct = rulebook('battleRoyal', 'cleanPin', { preset: 'battleRoyal' }, [1, 19]);
    expect(conduct).toMatchObject({ allIn: true, tags: false, outside: false, overTheTop: true, nearFall: 'teeter', elimination: 'overTop', finish: 'overTop' });
    const moments = stageMatch([beat('exchange'), beat('elimination'), beat('nearFall'), beat('elimination'), beat('finish')], [], cast, 'cleanPin', { conduct }).moments;
    expect(moments.every((m) => m.staged.choreo.cover === undefined)).toBe(true);
    expect(moments.every((m) => (m.staged.zone ?? 'ring') === 'ring')).toBe(true);
    for (const m of moments.filter((x) => x.beat.pose === 'elimination' || x.beat.pose === 'finish')) expect(m.staged.meta.exits, m.staged.move).toBeDefined();
    // And nothing else puts anybody out.
    for (const m of moments.filter((x) => x.beat.pose !== 'elimination' && x.beat.pose !== 'finish')) expect(m.staged.meta.exits, m.staged.move).toBeUndefined();
  });

  it('an elimination that is not a battle royal is a pinfall, not a throw', () => {
    const conduct = rulebook(null, 'cleanPin', { preset: 'sixMan', format: 'elimination' }, [3, 3]);
    expect(conduct).toMatchObject({ tags: true, elimination: 'fall' });
    const moments = stageMatch([beat('exchange'), beat('elimination'), beat('finish')], [], cast, 'cleanPin', { conduct }).moments;
    const out = moments.find((m) => m.beat.pose === 'elimination')!;
    expect(out.staged.meta.exits).toBeUndefined();
    expect(out.staged.choreo.cover?.count).toBe(3);
  });

  it('a cage match stays in the cage, and an escape goes over the wall', () => {
    const conduct = rulebook('steelCage', 'escape');
    expect(conduct).toMatchObject({ cage: true, outside: false, finish: 'escape' });
    const moments = played(conduct, 'escape');
    expect(moments.slice(0, -1).every((m) => (m.staged.zone ?? 'ring') === 'ring')).toBe(true);
    const last = moments[moments.length - 1]!;
    expect(last.staged.move).toBe('escapeCage');
    // It is the winner who ends up outside, on their feet; the loser is on the mat.
    const plan = planBeat(last.staged, [fighter('a', 'actor', 1), fighter('t', 'target', -1)], 0);
    expect(Math.abs(plan.end.get('a')!.x)).toBeGreaterThan(RING.half);
    expect(plan.end.get('a')!.y).toBeCloseTo(FLOOR, 1);
    expect(Math.abs(plan.end.get('t')!.x)).toBeLessThan(RING.half);
  });

  it('chairs only where there are no disqualifications', () => {
    for (const stipulation of ['noDQ', 'hardcore', 'streetFight', 'unsanctioned']) {
      const conduct = rulebook(stipulation);
      expect(conduct.weapons, stipulation).toBe(true);
      expect(conduct.outside, stipulation).toBe(true);
    }
    const long = Array.from({ length: 9 }, (_, i) => beat(i === 0 ? 'exchange' : i === 8 ? 'finish' : 'control'));
    const armed = stageMatch(long, [], cast, 'cleanPin', { conduct: rulebook('hardcore') }).moments;
    expect(armed.some((m) => m.staged.prop !== undefined)).toBe(true);
    const clean = stageMatch(long, [], cast, 'cleanPin', { conduct: rulebook(null) }).moments;
    expect(clean.some((m) => m.staged.prop !== undefined)).toBe(false);
  });

  it("a disqualification is the loser's doing", () => {
    const conduct = rulebook(null, 'disqualification');
    expect(conduct.finish).toBe('dq');
    const moments = played(conduct, 'disqualification');
    const last = moments[moments.length - 1]!;
    // The beat was recorded as alpha beating bravo; what is shown is bravo
    // swinging the chair that got them thrown out.
    expect(last.actorId).toBe(bravo.id);
    expect(last.targetId).toBe(alpha.id);
    expect(last.staged.prop).toBe('chair');
  });

  it('each stipulation ends the way that stipulation ends', () => {
    const endings: [string | null, FinishType, Partial<MatchRules>, Conduct['finish'], string][] = [
      ['ladder', 'cleanPin', {}, 'climb', 'climbLadder'],
      ['tables', 'knockout', {}, 'table', 'powerbomb'],
      ['flamingTables', 'knockout', {}, 'flamingTable', 'powerbomb'],
      ['casket', 'knockout', {}, 'casket', 'tossOutside'],
      [null, 'countOut', {}, 'countOut', 'throwOut'],
      [null, 'doubleKO', {}, 'doubleKO', 'doubleDown'],
      [null, 'timeLimitDraw', {}, 'draw', 'lockup'],
      [null, 'knockout', { aim: 'firstBlood' }, 'blood', 'headbutt'],
    ];
    for (const [stipulation, finish, rules, want, move] of endings) {
      const conduct = rulebook(stipulation, finish, rules);
      expect(conduct.finish, String(stipulation ?? finish)).toBe(want);
      const last = played(conduct, finish).pop()!;
      expect(last.staged.move, String(stipulation ?? finish)).toBe(move);
    }
    expect(played(rulebook('ladder')).pop()!.staged.scene).toBe('ladder');
    expect(played(rulebook('tables', 'knockout'), 'knockout').pop()!.staged.scene).toBe('table');
    expect(played(rulebook('casket', 'knockout'), 'knockout').pop()!.staged.scene).toBe('casket');
    // A count-out: the loser is on the floor being counted, the winner never left.
    const countOut = played(rulebook(null, 'countOut'), 'countOut').pop()!;
    expect(countOut.staged.choreo.cover?.count).toBe(10);
    const plan = planBeat(countOut.staged, [fighter('a', 'actor', 1), fighter('t', 'target', -1)], 0);
    expect(onFrontFloor(plan.end.get('t')!)).toBe(true);
    expect(onFrontFloor(plan.end.get('a')!)).toBe(false);
  });

  it("who is in the ring at once is the match type's business", () => {
    expect(rulebook(null, 'cleanPin', { preset: 'tag', format: 'teams' }, [2, 2])).toMatchObject({ tags: true, allIn: false });
    expect(rulebook(null, 'cleanPin', { preset: 'tornado', format: 'teams' }, [2, 2])).toMatchObject({ tags: false, allIn: true });
    expect(rulebook(null, 'cleanPin', { preset: 'triple' }, [1, 2])).toMatchObject({ tags: false, allIn: true });
    expect(rulebook(null, 'cleanPin', { preset: 'fatal4' }, [1, 3])).toMatchObject({ tags: false, allIn: true });
    expect(rulebook(null)).toMatchObject({ tags: false, allIn: false });
  });
});

describe('what the referee would be shouting', () => {
  const shoutsOf = (moments: ReturnType<typeof played>) => moments.flatMap((m) => (m.staged.choreo.shouts ?? []).map((s) => s.text));

  it('a kickout is shouted on every two-count, and never on the three', () => {
    const moments = played(rulebook(null));
    const twos = moments.filter((m) => m.staged.choreo.cover?.count === 2);
    expect(twos.length).toBeGreaterThan(0);
    for (const m of twos) expect(m.staged.choreo.shouts?.map((s) => s.text)).toContain('KICK OUT!!');
    expect(moments[moments.length - 1]!.staged.choreo.shouts ?? []).toEqual([]);
  });

  it('a submission is a tap out', () => {
    const moments = played(rulebook(null, 'submission'), 'submission');
    expect(moments[moments.length - 1]!.staged.choreo.shouts?.map((s) => s.text)).toEqual(['TAP OUT!']);
  });

  it('every shout lands inside its beat', () => {
    for (const stip of [null, 'submissionMatch', 'lastManStanding', 'battleRoyal', 'steelCage', 'ladder', 'tables']) {
      for (const m of played(rulebook(stip))) for (const s of m.staged.choreo.shouts ?? []) expect(s.at).toBeGreaterThan(0), expect(s.at).toBeLessThanOrEqual(1);
    }
  });

  it('two out of three falls: the falls before the last are staged, and the score adds up', () => {
    const conduct = rulebook(null, 'cleanPin', { aim: 'twoOfThree' });
    expect(conduct.multiFall).toBe(true);
    const their = (pose: PlaybackBeat['pose']): PlaybackBeat => ({ ...beat(pose), actorId: bravo.id, targetId: alpha.id });
    // The winner on top early, the loser later: one fall each, then the decider.
    const both = stageMatch([beat('exchange'), beat('control'), beat('control'), their('comeback'), their('control'), beat('comeback'), beat('finish')], [], cast, 'cleanPin', { conduct }).moments;
    const falls = both.filter((m) => m.staged.choreo.cover?.count === 3);
    expect(falls.map((m) => m.actorId)).toEqual([alpha.id, bravo.id, alpha.id]);
    expect(shoutsOf(both).filter((t) => t.includes('FALL'))).toEqual(['FIRST FALL!', 'ONE FALL EACH!']);
    // The loser never on top: two straight, and never a fall for the loser.
    const sweep = played(conduct).filter((m) => m.staged.choreo.cover?.count === 3);
    expect(sweep.map((m) => m.actorId)).toEqual([alpha.id, alpha.id]);
    // An ordinary match has exactly one.
    expect(played(rulebook(null)).filter((m) => m.staged.choreo.cover?.count === 3)).toHaveLength(1);
  });

  it('falls count anywhere: somebody goes for a pin on the floor', () => {
    const conduct = rulebook('fallsCountAnywhere');
    expect(conduct.fallsAnywhere).toBe(true);
    const moments = played(conduct);
    expect(moments.some((m) => m.staged.zone === 'floor' && m.staged.choreo.cover?.count === 2)).toBe(true);
    expect(played(rulebook('streetFight')).some((m) => m.staged.zone === 'floor' && m.staged.choreo.cover)).toBe(false);
  });
});

describe('a match known only by its result', () => {
  it('plays out to the result it was given, and nothing else', async () => {
    const { exhibitionOf } = await import('./exhibition');
    const { buildPlaybackTimeline } = await import('../../engine/sim/matchPlayback');
    for (const [winner, loser] of [[alpha, bravo], [bravo, alpha]] as const) {
      const { segment, result } = exhibitionOf([[alpha.id], [bravo.id]], [winner.id], 'submission');
      expect(result.winnerWrestlerIds).toEqual([winner.id]);
      const timeline = buildPlaybackTimeline(result.beats, [winner], [loser], 'a');
      const conduct = conductOf(segment, result.finish, [1, 1]);
      const { moments } = stageMatch(timeline, [], cast, result.finish, { conduct });
      const last = moments[moments.length - 1]!;
      expect(last.beat.pose).toBe('finish');
      expect([last.actorId, last.targetId]).toEqual([winner.id, loser.id]);
      expect(last.staged.choreo.shouts?.map((s) => s.text)).toEqual(['TAP OUT!']);
      // Both of them get the upper hand at some point: it is a match, not a squash.
      expect(new Set(moments.map((m) => m.actorId))).toEqual(new Set([alpha.id, bravo.id]));
    }
  });

  it('a draw has no winner, and a two-on-two is a tag match', async () => {
    const { exhibitionOf } = await import('./exhibition');
    expect(exhibitionOf([[alpha.id], [bravo.id]], [], 'timeLimitDraw').result.winnerSide).toBeNull();
    const tag = exhibitionOf([[alpha.id, 'c'], [bravo.id, 'd']], [bravo.id, 'd'], 'cleanPin');
    expect(tag.result.winnerSide).toBe(1);
    expect(conductOf(tag.segment, 'cleanPin', [2, 2]).tags).toBe(true);
  });
});

describe('the fixes to the match types', () => {
  const needsRing = (id: MoveId) => Boolean(META[id]?.anchor || META[id]?.exits || META[id]?.actorExits) || id === 'tossOutside' || id === 'rollInside';

  it('an arena-floor match never uses a rope, a corner or the floor outside', () => {
    const conduct = rulebook('arenaFloor');
    expect(conduct).toMatchObject({ noRing: true, outside: false });
    const said = [{ speaker: 'play' as const, name: 'P', text: 'Off the top rope with a crossbody!', beat: 1, actorId: alpha.id, targetId: bravo.id }];
    const moments = stageMatch([beat('exchange'), beat('control'), beat('whip'), beat('nearFall'), beat('comeback'), beat('signature'), beat('finish')], said, cast, 'cleanPin', { conduct }).moments;
    expect(moments.filter((m) => needsRing(m.staged.move)).map((m) => m.staged.move)).toEqual([]);
    expect(moments.every((m) => (m.staged.zone ?? 'ring') === 'ring')).toBe(true);
  });

  it('only a cage match throws anybody into a cage', () => {
    const caged = played(rulebook('steelCage'));
    const usesCage = (m: { staged: { move: MoveId } }) => m.staged.move === 'intoCage' || m.staged.move === 'cageTop';
    expect(caged.some(usesCage)).toBe(true);
    for (const stip of [null, 'noDQ', 'hardcore', 'ladder']) expect(played(rulebook(stip)).some(usesCage)).toBe(false);
  });

  it('a hardcore match finds more than one thing to swing', () => {
    const conduct = rulebook('hardcore');
    const long = stageMatch(Array.from({ length: 9 }, (_, i) => beat(i === 8 ? 'finish' : i % 2 ? 'control' : 'comeback')), [], cast, 'cleanPin', { conduct }).moments;
    const found = new Set(long.map((m) => m.staged.prop).filter(Boolean));
    expect(found.size).toBeGreaterThan(1);
    // And whatever is in the hand, it is in the hand for a swing.
    for (const m of long) if (m.staged.prop) expect(m.staged.move).toBe('chairShot');
  });

  it('a squash is one-way traffic between the recorded beats', () => {
    const conduct = rulebook('squash');
    const their = (pose: PlaybackBeat['pose']): PlaybackBeat => ({ ...beat(pose), actorId: bravo.id, targetId: alpha.id });
    const moments = stageMatch([beat('exchange'), their('control'), their('comeback'), beat('control'), beat('finish')], [], cast, 'cleanPin', { conduct }).moments;
    expect(moments.filter((m) => m.filler).every((m) => m.actorId === alpha.id && m.targetId === bravo.id)).toBe(true);
  });
});

describe('from the waist down', () => {
  it('is the same every time, changes with the gimmick, and matches the costume', async () => {
    const { assignLook, lookSubjectOf } = await import('../paperdoll/assignLook');
    const { legwearOf } = await import('./legwear');
    const seen = { bottoms: new Set<string>(), feet: new Set<string>() };
    const people = generateWrestlers(rngFromSeed('legs'), 120);
    for (const w of people) {
      const subject = lookSubjectOf(w);
      if (!subject) continue;
      const look = assignLook(subject);
      if (!look) continue;
      const gear = legwearOf(subject, look);
      expect(legwearOf(subject, look)).toEqual(gear);
      seen.bottoms.add(gear.bottom);
      seen.feet.add(gear.footwear);
      // Nobody wears kneepads over trousers, and only women are put in a skirt.
      if (gear.bottom === 'pants') expect(gear.kneepads).toBeNull();
      if (gear.bottom === 'skirt') expect(w.gender).toBe('f');
      // The trim has to show against what it is on.
      if (gear.stripe) expect(gear.stripe).not.toBe(gear.color);
      const top = `${look.top?.asset.id ?? ''} ${look.outer?.asset.id ?? ''}`;
      if (/karate/.test(top)) expect(gear).toMatchObject({ bottom: 'pants', footwear: 'barefoot' });
    }
    // A roster is not all in black trunks and black boots any more.
    expect(seen.bottoms.size).toBeGreaterThanOrEqual(4);
    expect(seen.feet.size).toBeGreaterThanOrEqual(4);
  });

  it('a shaved head has no hair, and a mask lost in the ring is never replaced', async () => {
    const { assignLook, lookSubjectOf } = await import('../paperdoll/assignLook');
    for (const w of generateWrestlers(rngFromSeed('stakes'), 200)) {
      const subject = lookSubjectOf({ ...w, masked: false, headShaved: true, unmaskedInRing: true });
      const look = subject && assignLook(subject);
      if (!look) continue;
      expect(look.hair).toBeNull();
      expect(look.prop?.asset.id ?? '').not.toMatch(/luchador|mask/);
    }
  });
});

describe('the last gaps', () => {
  it('a cage match you win by escaping has near-escapes, not near falls', () => {
    const conduct = rulebook('steelCage', 'escape');
    expect(conduct.nearFall).toBe('climb');
    const moments = played(conduct, 'escape');
    const near = moments.filter((m) => m.beat.pose === 'nearFall');
    expect(near.length).toBeGreaterThan(0);
    for (const m of near) {
      expect(m.staged.move).toBe('cageClimb');
      expect(m.staged.choreo.cover).toBeUndefined();
      // Dragged back: the climber ends up on the mat, inside.
      expect(isDown(endPose(m.staged.choreo.actor))).toBe(true);
    }
    expect(moments[moments.length - 1]!.staged.move).toBe('escapeCage');
  });
});

describe('closing out', () => {
  it('a fight on top of the cage happens in a cage and nowhere else, and somebody comes off it', () => {
    const line = [{ speaker: 'play' as const, name: 'P', text: 'They are both up on the cage!', beat: 1, actorId: alpha.id, targetId: bravo.id }];
    const timeline = [beat('exchange'), beat('control'), beat('finish')];
    const caged = stageMatch(timeline, line, cast, 'cleanPin', { conduct: rulebook('steelCage') }).moments;
    const called = caged.find((m) => m.lines.length > 0)!;
    expect(called.staged.move).toBe('cageTop');
    expect(isDown(endPose(called.staged.choreo.target))).toBe(true);
    // The one who stayed up comes back down to the mat before the next thing happens.
    expect(endPose(called.staged.choreo.actor)[1]).toBe(0);
    const open = stageMatch(timeline, line, cast, 'cleanPin', { conduct: rulebook(null) }).moments;
    expect(open.some((m) => m.staged.move === 'cageTop' || m.staged.move === 'intoCage')).toBe(false);
  });

  it('a tallied match goes on the record, the ledger and the career marks, and nowhere else', async () => {
    const { tallyMatch } = await import('../../engine/sim/aftermath');
    const [w] = generateWrestlers(rngFromSeed('tally'), 1);
    const before = { ...w!.record, matches: w!.career.matches, pop: w!.popularity, health: w!.health };
    tallyMatch(w!, 'win', 80);
    tallyMatch(w!, 'loss', 40);
    expect(w!.record).toMatchObject({ wins: before.wins + 1, losses: before.losses + 1, draws: before.draws });
    expect(w!.career.matches).toBe(before.matches + 2);
    expect(w!.career.bestMatchRating).toBeGreaterThanOrEqual(80);
    expect([w!.popularity, w!.health]).toEqual([before.pop, before.health]);
  });
});
