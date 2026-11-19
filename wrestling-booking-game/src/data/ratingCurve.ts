// How hard the top of the star scale is to reach (sim/matchRating.ts).
//
// Below the knee a point of match quality is a point of rating, as it always
// was. Above it, every point is worth a little less than the last, until at
// `full` the match is giving back `maxOffset` points it would otherwise have
// had — so a good card earns its three stars as before, but four and a half
// takes something special and five takes legends having the night of their
// lives. Measured (docs/BALANCE.md): two all-95 legends in a pay-per-view
// main event went from 5★ about one time in four to a few times in a hundred.
// Kept in data/ rather than WorldSettings so older saves need nothing new.

export const RATING_CURVE = {
  /** Raw match quality where the climb starts getting steeper (60 = 3★). */
  knee: 60,
  /** Raw quality by which the whole offset applies. */
  full: 95,
  /** Rating points a great match gives back at the top. */
  maxOffset: 13,
} as const;
