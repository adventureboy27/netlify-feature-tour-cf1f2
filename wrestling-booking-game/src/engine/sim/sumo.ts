// Sumo — the falls of a best-of-three ring-out match, decided after the fact
// on a result already made. simulateMatch.ts picks the winner off the real
// win-probability maths like any other match and rolls how it ended; this
// only says what the falls before that were, so the write-up, the call and
// the ring can all show the same match: who went off the edge first, whether
// it went the distance, and who put whom out each time.
//
// A ring-out finish is the winner's second fall. Before it the winner took
// one more, and the loser took one of their own or none — more often one the
// closer the two of them were. Any other finish (a disqualification, a match
// stopped because somebody got hurt) cut it short wherever it stood: no fall
// yet, one, or one each, but never two for anybody, or it would have been over.
//
// Its own entity-seeded stream throughout, never the shared rng — the root
// CLAUDE.md's "adding an RNG draw shifts every seeded roll after it" trap.

import { pick, rngFromSeed } from '../rng';
import type { Id, Wrestler } from '../types';

export interface SumoFall {
  /** The side that took the fall. */
  side: number;
  /** Who put them off. */
  byId: Id;
  /** Who went off. */
  outId: Id;
  /** Falls each way once this one counted: this fall's side first. */
  score: [number, number];
  /**
   * Both of them went off together: no fall to either. `side` and `byId` are
   * whoever charged, `outId` the other; `score` is where it already stood.
   */
  both?: true;
}

export interface SumoOptions {
  winnerSide: number;
  loserSide: number;
  sideMembers: ReadonlyMap<number, readonly Wrestler[]>;
  /** The winner's win probability (0-1): the closer to even, the likelier it went to a third fall. */
  winnerProbability: number;
  /** True when the match was decided by a ring-out — the winner's second fall is the finish itself. */
  endedOnRingOut: boolean;
  week: number;
}

/**
 * The falls before the finish, in order, with any time they both went off
 * together (no fall) among them. The finish itself (a ring-out's deciding
 * fall) is not among them.
 */
export function sumoFalls(o: SumoOptions): SumoFall[] {
  const everyone = [...(o.sideMembers.get(o.winnerSide) ?? []), ...(o.sideMembers.get(o.loserSide) ?? [])];
  const rng = rngFromSeed(`sumo:${everyone.map((w) => w.id).sort().join(',')}:${o.week}`);
  const closeness = 1 - Math.min(1, Math.abs(o.winnerProbability - 0.5) * 2);
  // How likely the loser took a fall of their own: a mismatch goes two straight.
  const loserScores = rng.next() < 0.2 + 0.45 * closeness;

  let order: number[];
  if (o.endedOnRingOut) {
    // The winner's first fall, and maybe one for the loser before or after it.
    order = loserScores ? (rng.next() < 0.5 ? [o.loserSide, o.winnerSide] : [o.winnerSide, o.loserSide]) : [o.winnerSide];
  } else {
    // Stopped wherever it stood.
    const r = rng.next();
    const first = rng.next() < o.winnerProbability ? o.winnerSide : o.loserSide;
    order = r < 0.35 ? [] : r < 0.75 ? [first] : [first, first === o.winnerSide ? o.loserSide : o.winnerSide];
  }

  const tally = new Map<number, number>([[o.winnerSide, 0], [o.loserSide, 0]]);
  const falls = order.map((side): SumoFall => {
    const other = side === o.winnerSide ? o.loserSide : o.winnerSide;
    tally.set(side, tally.get(side)! + 1);
    const by = pick(rng, o.sideMembers.get(side) ?? []);
    const out = pick(rng, o.sideMembers.get(other) ?? []);
    return { side, byId: by.id, outId: out.id, score: [tally.get(side)!, tally.get(other)!] };
  });

  // Sometimes they go off together: nobody gets that one, and they climb
  // back in and go again. Drawn after the falls, so it changes none of them.
  const r = rng.next();
  const washes = r < 0.28 ? 1 : r < 0.36 ? 2 : 0;
  for (let n = 0; n < washes; n++) {
    const at = Math.floor(rng.next() * (falls.length + 1));
    const side = rng.next() < 0.5 ? o.winnerSide : o.loserSide;
    const other = side === o.winnerSide ? o.loserSide : o.winnerSide;
    const by = pick(rng, o.sideMembers.get(side) ?? []);
    const out = pick(rng, o.sideMembers.get(other) ?? []);
    // Where it stood when they went off: the last real fall before it, from this side's point of view.
    const before = falls.slice(0, at).filter((f) => !f.both);
    const mine = before.filter((f) => f.side === side).length;
    const theirs = before.length - mine;
    falls.splice(at, 0, { side, byId: by.id, outId: out.id, score: [mine, theirs], both: true });
  }
  return falls;
}
