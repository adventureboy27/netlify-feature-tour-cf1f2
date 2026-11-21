// How the building feels about what just happened.
//
// Nothing here happens to anybody: it is the crowd reacting to what the
// match already recorded — who did it (a face or a heel, by their real
// alignment), and what it was (a big move, a comeback, a near fall, a chair
// behind the referee's back, a finish). The write-up and the call are the
// record; this is the room.

import type { PlaybackBeat } from '../../engine/sim/matchPlayback';
import type { OfficialMoment, Wrestler } from '../../engine/types';

export type Mood = 'cheer' | 'boo' | 'ooh' | 'mixed';

export interface Reaction {
  mood: Mood;
  size: 'pop' | 'roar';
  /**
   * When, as a fraction of the move. Absent: at the move's biggest impact,
   * or most of the way through if it has none.
   */
  at?: number;
  /**
   * A star's moment: a main eventer (or bigger) the whole building is
   * reacting to — their introduction, their big moments, their win. The
   * arena is theirs for it (MatchStage): their face and name on the big
   * screen, banners, the lights in their colour.
   */
  star?: Wrestler;
}

/** Past this either way, the crowd knows which side they are on. */
const LEAN = 25;

export type Standing = 'face' | 'heel' | 'tweener';
export const standingOf = (w: Pick<Wrestler, 'alignment'> | undefined): Standing =>
  !w ? 'tweener' : w.alignment > LEAN ? 'face' : w.alignment < -LEAN ? 'heel' : 'tweener';

/** The top of the card: what the game itself calls a main eventer, or a draw. */
export const isStar = (w: Pick<Wrestler, 'careerStatus'> | undefined) => w?.careerStatus === 'mainEventer' || w?.careerStatus === 'draw';

/** Somebody popular gets it louder; a star always does. */
const loud = (w: Pick<Wrestler, 'popularity' | 'careerStatus'> | undefined) => ((w?.popularity ?? 0) >= 70 || isStar(w) ? 'roar' : 'pop');

/** For somebody: cheered if they are a face, booed if a heel, both if neither — and the building theirs if they are a star. */
const for_ = (w: Wrestler | undefined, size?: 'pop' | 'roar'): Reaction => {
  const s = standingOf(w);
  const r: Reaction = { mood: s === 'face' ? 'cheer' : s === 'heel' ? 'boo' : 'mixed', size: size ?? loud(w) };
  return w && isStar(w) && r.size === 'roar' ? { ...r, star: w } : r;
};

/** Things done that should not have been: booed whoever did them, unless a face did it (and then it is split). */
const DIRTY: ReadonlySet<OfficialMoment> = new Set(['cheapShot', 'runIn', 'mugging', 'distracted', 'lowBlow', 'foreignObject', 'missedInterference', 'missedTag', 'wrongLegalMan']);
/** The official getting it wrong at the finish: nobody likes that. */
const ROBBED: ReadonlySet<OfficialMoment> = new Set(['fastCount', 'footOnRope', 'shoulderUp', 'blewTheFinish', 'lostCountOut', 'lateStoppage']);

/**
 * What the crowd does over one beat, if anything. `actor`/`target` are the
 * wrestlers the beat is about (absent for somebody at ringside who is not one).
 */
export function reactionTo(beat: PlaybackBeat, actor: Wrestler | undefined, target: Wrestler | undefined): Reaction | null {
  const official = beat.official;
  if (official === 'sawIt' || official === 'caught') {
    // Caught: the one it was done to wins it — the room is with them, or is not.
    return { ...for_(target ?? undefined, 'roar'), at: 0.85 };
  }
  if (official && DIRTY.has(official)) {
    const doer = standingOf(actor);
    return { mood: doer === 'face' ? 'mixed' : 'boo', size: official === 'runIn' || official === 'cheapShot' ? 'roar' : 'pop' };
  }
  if (official && ROBBED.has(official)) return { mood: 'boo', size: 'roar', at: 0.95 };
  if (official === 'guestSlowCount' || official === 'slowCount') return { mood: 'boo', size: 'pop', at: 0.9 };
  // Going under the ring for something: they know what is coming.
  if (beat.fetched) return { ...for_(actor), size: 'pop', at: 0.62 };
  switch (beat.pose) {
    case 'nearFall':
      return { mood: 'ooh', size: 'pop', at: 0.9 };
    case 'comeback':
      return for_(actor);
    case 'elimination':
      // Out over the top: glad to see the back of a heel, sorry to see a face go.
      return standingOf(target) === 'heel' ? { mood: 'cheer', size: 'pop' } : standingOf(target) === 'face' ? { mood: 'ooh', size: 'pop' } : null;
    case 'signature':
      return for_(actor);
    case 'finish':
      // The move that ends it; the reaction to who won is the ending's (finale).
      return null;
  }
  if (beat.spot) return for_(actor);
  return null;
}

/** Walking out to the ring: each of them, in turn. */
export const entranceOf = (w: Wrestler): Reaction => for_(w, loud(w));

/** When it is over: for whoever won. Nobody won: split. */
export function finaleFor(winners: readonly Wrestler[]): Reaction {
  if (winners.length === 0) return { mood: 'mixed', size: 'pop' };
  const faces = winners.filter((w) => standingOf(w) === 'face').length;
  const heels = winners.filter((w) => standingOf(w) === 'heel').length;
  const mood = faces > heels ? 'cheer' : heels > faces ? 'boo' : 'mixed';
  // A star's win is theirs: the first star among the winners gets the building.
  const star = winners.find((w) => isStar(w));
  return { mood, size: 'roar', ...(star ? { star } : {}) };
}
