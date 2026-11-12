// What moves a story, and how much.
//
// The weights are the whole design of the thing. A match is the meat and is
// worth the most; a promo is cheap and keeps a story breathing between
// matches; a confrontation is worth more than a promo because two people in
// the same room is an event rather than a monologue. A screwjob finish is
// worth more than a clean one, because unfinished business is the engine of
// every feud ever run.
//
// Read engine/world/storyline.ts first. Nothing here decides a result — these
// are the reactions to results the simulation already produced.

/** The kinds of thing that can happen in a story. */
export type StorylineBeatKind =
  /** They wrestled. */
  | 'match'
  /** One of them talked about the other. */
  | 'promo'
  /** Face to face — a call-out, a contract signing, a brawl in the back. */
  | 'confrontation'
  /** Somebody else got involved, or the finish settled nothing. */
  | 'interference'
  /** It cost one of them physically, which raises the stakes for everybody. */
  | 'injury'
  /** It was for a championship, which makes it about more than the two of them. */
  | 'titleMatch';

/**
 * How far each kind moves the arc.
 *
 * Tuned against the stage thresholds in settings: roughly three or four real
 * events to reach building, and seven or eight to boil. That is two months of
 * weekly television for a story told properly, which is about right — a feud
 * built in a fortnight is a feud nobody believed in.
 */
export const BEAT_WEIGHTS: Record<StorylineBeatKind, number> = {
  match: 10,
  promo: 5,
  confrontation: 8,
  interference: 12,
  injury: 14,
  titleMatch: 13,
};

/**
 * Storyline names.
 *
 * Generated so a story has an identity the moment it is created, and the
 * booker can rename it. `{a}` and `{b}` are the two surnames, `{town}` the
 * home territory. Deliberately in the register a wrestling company would
 * actually use rather than a novel's.
 */
export const STORYLINE_NAME_PATTERNS: readonly string[] = [
  '{a} vs {b}',
  'Bad Blood: {a} and {b}',
  'The {a}–{b} Problem',
  'Unfinished Business',
  '{a} Wants {b}',
  'No Love Lost',
  'The Long Count',
  'Something Personal',
  'The {b} Situation',
  'Settle It',
  'Bad Blood in {town}',
  'The Reckoning',
];

/**
 * How an ordinary match between them reads in the recap.
 *
 * The most-read text in the whole system — a story that ran for two months
 * is eight lines of this — so it cannot be one sentence repeated. Indexed by
 * how far into the arc the beat is rather than rolled, so a recap reads as a
 * sequence and nothing here touches the simulation's random stream.
 */
export const MATCH_BEAT_LINES: readonly string[] = [
  '{who} met right there in the ring, and this crowd knew exactly what it was watching.',
  '{who} went at it again, and neither one backed off an inch.',
  'They put {who} back out there, and it was rougher than the last one by a mile.',
  '{who} fought once more, and this crowd was louder for it than ever before.',
  'Another one between {who}. Nobody in this business is settling this quietly.',
];
