// What the official did, in words. See engine/sim/officiating.ts.
//
// Each of these is the write-up's sentence for something the viewer then
// shows the referee doing — a hand coming down too fast, a man running in
// behind his back — so every line says plainly what physically happened.

/** Somebody not in the match hits the ring for the side that goes on to win. {runner} {victim} */
export const RUN_IN_LINES = [
  '{runner} hit the ring from out of nowhere with the referee looking the other way, and laid {victim} out.',
  "{runner} came over the barricade, slid in behind the referee's back and flattened {victim}.",
  "Nobody saw {runner} coming until {runner} was already in the ring — and {victim} never saw anything at all.",
  '{runner} ran in while the official was tied up in the corner and left {victim} in a heap.',
];

/** Somebody runs in for the side that goes on to lose — in full view, which is the disqualification. {runner} {victim} */
export const DQ_RUN_IN_LINES = [
  '{runner} hit the ring and went straight for {victim}, right in front of the referee. That was the end of that.',
  "{runner} came through the ropes and jumped {victim} with the official standing a foot away. There was only one call to make.",
  "{runner} could not stay in the back, ran in, and attacked {victim} in full view of everybody — the referee included.",
];

/** A guest referee getting the three down for the side he favours. {guest} {pinned} */
export const FAST_COUNT_LINES = [
  '{guest} counted that three faster than anybody has ever counted anything.',
  "{guest}'s hand hit the mat three times before {pinned} had any chance to move.",
  'That was the quickest three-count {guest} will ever make, and {guest} knew it.',
];

/** A guest referee dragging his feet on a cover by the side he is against. {guest} {coverer} {pinned} */
export const SLOW_COUNT_LINES = [
  "{guest} was in no hurry at all getting down to count {coverer}'s cover, and {pinned} was out at one.",
  "{guest} took a long, slow look around before counting {coverer}'s cover. {pinned} was clear by then.",
  "{coverer} had it, and {guest} counted it like a man walking into the sea.",
];

/** ...and even dragging it could not save the one he wanted. {guest} {coverer} {pinned} */
export const SLOW_NOT_ENOUGH_LINES = [
  "{guest} could not have counted it any slower, and {pinned} still could not get a shoulder up.",
  "{guest} dragged that count out as long as anybody could, and it still got to three on {pinned}.",
];
