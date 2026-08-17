// The things an official does not see.
//
// A bad referee is only worth paying less for if the player can watch him be
// bad. Before this file, competence was a hidden multiplier on finish weights:
// cheap officials produced more disqualifications and nobody could tell why.
// Now the incompetence is on the page — which referee, what he missed, and
// who it cost.
//
// Every line names the official. That is the point: the player chose him.
//
// `needsVictim` marks the misses that go *against* somebody. Those cost the
// wrestler on the wrong end of them real morale, which is what makes signing
// a cheap official a way to make somebody's life miserable on purpose.
//
// `context` gates the ones that only make sense in a particular match:
// 'tag' needs more than one a side, 'interference' needs somebody outside to
// have got involved, 'any' fits anywhere.

export type MissContext = 'any' | 'tag' | 'interference';

export interface RefereeMiss {
  id: string;
  /** Short label for the ranking and the card. */
  label: string;
  /** Write-up lines. {ref} is the official, {victim} the wrestler wronged. */
  lines: string[];
  needsVictim: boolean;
  context: MissContext;
  /**
   * How badly it reflects on him, 0-1. A slow count is sloppy; counting three
   * on a shoulder that was clearly up is the kind of thing that follows an
   * official around.
   */
  severity: number;
}

export const REFEREE_MISSES: RefereeMiss[] = [
  {
    id: 'footOnRope',
    label: 'Missed a foot on the rope',
    lines: [
      "{ref} counted three with {victim}'s boot plainly on the bottom rope. The whole building saw it. The official did not.",
      "{victim} had a foot on the rope from the moment the cover went in. {ref} counted anyway and never looked.",
    ],
    needsVictim: true,
    context: 'any',
    severity: 0.8,
  },
  {
    id: 'shoulderUp',
    label: 'Counted a shoulder up',
    lines: [
      "{victim} got the shoulder up somewhere between two and three. {ref} brought a hand down anyway.",
      '{ref} counted three on a cover {victim} had already kicked out of, and had to be shown the replay to believe it.',
    ],
    needsVictim: true,
    context: 'any',
    severity: 0.9,
  },
  {
    id: 'lowBlow',
    label: 'Missed a low blow',
    lines: [
      '{ref} was busy with the corner when {victim} got kicked square below the belt. The official turned round to a cover and counted it.',
      'A low blow in full view of everybody except {ref}, who was looking at the timekeeper. {victim} never recovered.',
    ],
    needsVictim: true,
    context: 'any',
    severity: 0.7,
  },
  {
    id: 'foreignObject',
    label: 'Missed a foreign object',
    lines: [
      'Something metal came out of the tights and went back in before {ref} turned round. {victim} was out cold by then.',
      '{ref} never saw the object, never saw it leave, and counted the pin it produced. {victim} is still asking what hit them.',
    ],
    needsVictim: true,
    context: 'any',
    severity: 0.85,
  },
  {
    id: 'missedTag',
    label: 'Missed a legal tag',
    lines: [
      "{ref} waved off a tag the hard camera caught cleanly and sent {victim}'s partner back to the apron.",
      '{ref} lost track of who was legal, and by the time that was straight {victim} had been worked over for another two minutes.',
    ],
    needsVictim: true,
    context: 'tag',
    severity: 0.6,
  },
  {
    id: 'wrongLegalMan',
    label: 'Lost the legal man',
    lines: [
      '{ref} counted the fall while {victim} was the legal one on the apron, screaming and getting nowhere.',
      'Two men in the ring, neither of them legal, and {ref} counting {victim} down anyway. It stood.',
    ],
    needsVictim: true,
    context: 'tag',
    severity: 0.75,
  },
  {
    id: 'missedInterference',
    label: 'Missed the interference',
    lines: [
      '{ref} was on the floor sorting out the corner when it happened, then climbed back in, saw a cover, and counted it. {victim} had no idea what had hit them.',
      "The interference came and went while {ref} had their back turned. {victim}'s protests went nowhere.",
    ],
    needsVictim: true,
    context: 'interference',
    severity: 0.8,
  },
  {
    id: 'slowCount',
    label: 'Slow count',
    lines: [
      '{ref} was late getting down on two covers and slow getting up from both. It took the air out of every near fall in the match.',
      'The counting was so laboured that the crowd started doing it faster than {ref} was.',
    ],
    needsVictim: false,
    context: 'any',
    severity: 0.35,
  },
  {
    id: 'outOfPosition',
    label: 'Out of position all night',
    lines: [
      '{ref} spent the match on the wrong side of everything and got flattened twice getting there.',
      'Wherever the action was, {ref} was somewhere else. Twice the official had to be moved bodily out of a spot.',
    ],
    needsVictim: false,
    context: 'any',
    severity: 0.3,
  },
  {
    id: 'lostCountOut',
    label: 'Lost the count on the floor',
    lines: [
      '{ref} started the count on the floor, got distracted, and started it again from one. Nobody knew where they were.',
      'The ring count from {ref} went one, two, three, three, four. The crowd noticed before the official did.',
    ],
    needsVictim: false,
    context: 'any',
    severity: 0.4,
  },
  {
    id: 'lateStoppage',
    label: 'Slow to stop it',
    lines: [
      '{victim} was gone and {ref} let it run another minute before anybody in stripes saw it.',
      '{ref} should have stopped it long before the bell came. {victim} took a lot of unnecessary punishment in the meantime.',
    ],
    needsVictim: true,
    context: 'any',
    severity: 0.7,
  },
  {
    id: 'blewTheFinish',
    label: 'Blew the finish',
    lines: [
      '{ref} called for the bell early and had to talk the timekeeper out of it. The finish limped home from there.',
      'Whatever {ref} thought was there, the bell was called and the whole thing had to be restarted in front of a confused building.',
    ],
    needsVictim: false,
    context: 'any',
    severity: 0.65,
  },
];

export function refereeMissById(id: string): RefereeMiss | undefined {
  return REFEREE_MISSES.find((m) => m.id === id);
}

/** The misses that make sense for this match. */
export function missesFor(hasTags: boolean, hadInterference: boolean): RefereeMiss[] {
  return REFEREE_MISSES.filter((m) => {
    if (m.context === 'tag') return hasTags;
    if (m.context === 'interference') return hadInterference;
    return true;
  });
}
