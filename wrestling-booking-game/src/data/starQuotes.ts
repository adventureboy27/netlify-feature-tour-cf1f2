// The line under the stars after a match (ui/match/StarReveal.tsx): a verdict
// for how many it earned, then the biggest real reason the simulation gave it
// that rating (SegmentResult.ratingBreakdown) — never a reason it did not.

/** The verdict, by how many stars. Each band runs up to (not including) `below`. */
export const STAR_VERDICTS: readonly { below: number; lines: readonly string[] }[] = [
  { below: 1, lines: ['A complete disaster.', 'Nobody needs to see that one again.', 'Rough. Really rough.'] },
  { below: 2, lines: ['Forgettable, and the crowd knew it.', 'Not their night.', 'That one never got going.'] },
  { below: 3, lines: ['Solid enough.', 'A decent little match.', 'Did the job, and not much more.'] },
  { below: 3.75, lines: ['A good match.', 'The crowd got their money’s worth.', 'Good stuff out there.'] },
  { below: 4.5, lines: ['A great match.', 'One for the highlight reel.', 'That was the real thing.'] },
  { below: 5, lines: ['An instant classic.', 'They will be talking about this one for years.', 'Match of the night, easily.'] },
  { below: Infinity, lines: ['Perfection. Five stars.', 'As good as it gets.', 'Nobody will ever forget that one.'] },
];

/**
 * The reason, keyed by the rating breakdown's own labels (sim/matchRating.ts):
 * `up` when that term helped the match most, `down` when it hurt it most.
 */
export const STAR_REASONS: Record<string, { up?: readonly string[]; down?: readonly string[] }> = {
  'Pair chemistry': { up: ['These two just click.', 'You cannot teach the chemistry those two have.'], down: ['Those two just do not mesh.'] },
  Chemistry: { up: ['Real chemistry in that ring.'], down: ['They never got on the same page.'] },
  'Style mesh': { up: ['The styles fit together perfectly.'], down: ['Their styles clashed all night.'] },
  Balance: { up: ['Even all the way to the bell.'], down: ['Too one-sided to care about.'] },
  'History between them': { up: ['All that history made every move matter.'], down: ['The history between them got in the way.'] },
  'Bad blood': { up: ['The bad blood was real, and you could feel it.'] },
  Stipulation: { up: ['The stipulation delivered.'], down: ['The stipulation did them no favours.'] },
  'Mismatched stipulation': { down: ['That stipulation made no sense for these two.'] },
  Finish: { up: ['And what a finish.'], down: ['The finish let everybody down.'] },
  "Who's watching": { up: ['Exactly what this crowd came to see.'], down: ['Not what this crowd came for.'] },
  'House style': { up: ['This is what this company is all about.'], down: ['Not this company’s kind of match.'] },
  'Territory fit': { up: ['This town ate it up.'], down: ['This town was not having it.'] },
  Signature: { up: ['The match this championship was made for.'], down: ['Wrong match for this championship.'] },
  'Gear spectacle': { up: ['The spectacle sold it.'] },
  Pace: { up: ['The pace never let up.'], down: ['The pace dragged it down.'] },
  Overexposure: { down: ['The crowd has seen this one too many times.'] },
  'Stale act': { down: ['That act is getting stale.'] },
  'Hardcore saturation': { down: ['The crowd is numb to the violence by now.'] },
  Boredom: { down: ['It went on far too long.'] },
  'Jobber drag': { down: ['Somebody out there was in over their head.'] },
  'Randomness (off night / they clicked)': { up: ['Everything clicked tonight.'], down: ['Just an off night.'] },
};

/** A term has to have moved the rating at least this many points to be the reason. */
export const STAR_REASON_MIN = 1.5;
