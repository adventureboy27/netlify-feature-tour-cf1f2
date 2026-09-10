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
      "{ref} counted all the way to three with {victim}'s boot sitting right there on the bottom rope. Every soul in this building saw it. {ref} did not.",
      "{victim} had a foot on that rope from the second the cover went in, and {ref} counted straight through it without so much as a glance.",
      "{victim}'s toe was on the rope for a full second before {ref} even started the count. Nobody in stripes did a thing about it.",
      "{ref} was staring at the completely wrong side of this ring when {victim} reached the ropes — and paid for it.",
    ],
    needsVictim: true,
    context: 'any',
    severity: 0.8,
  },
  {
    id: 'shoulderUp',
    label: 'Counted a shoulder up',
    lines: [
      "{victim} got that shoulder up clean between two and three, and {ref} brought the hand down anyway — three.",
      '{ref} counted three on a cover {victim} had already kicked out of, and needed the replay after the fact just to believe it.',
      "{victim}'s shoulder was clean off that mat and {ref} counted straight through it like it never happened.",
      "{victim} kicked out with time to spare, but {ref}'s hand was already swinging down before the shoulder even lifted.",
    ],
    needsVictim: true,
    context: 'any',
    severity: 0.9,
  },
  {
    id: 'lowBlow',
    label: 'Missed a low blow',
    lines: [
      '{ref} had eyes on the corner when {victim} took one square below the belt. By the time {ref} turned back around there was a cover, and it got counted.',
      'A low blow in full view of everybody in this building except {ref}, who happened to be looking at the timekeeper. {victim} never recovered from it.',
      "{victim} took a shot that had nothing to do with wrestling whatsoever, and {ref} somehow missed all of it.",
      "This crowd groaned in sympathy for {victim} a full second before {ref} even bothered turning around.",
    ],
    needsVictim: true,
    context: 'any',
    severity: 0.7,
  },
  {
    id: 'foreignObject',
    label: 'Missed a foreign object',
    lines: [
      'Something metal came out of the tights and went right back in before {ref} ever turned around. {victim} was out cold by the time it mattered.',
      '{ref} never saw the object, never saw it disappear, and counted the pin it produced anyway. {victim} is still asking what hit them.',
      "Whatever hit {victim} was already gone by the time {ref} looked over — and the pin had already been counted.",
      "{ref} checked the tights afterward and found nothing on {victim}'s opponent, which is exactly the problem — it was long gone by then.",
    ],
    needsVictim: true,
    context: 'any',
    severity: 0.85,
  },
  {
    id: 'missedTag',
    label: 'Missed a legal tag',
    lines: [
      "{ref} waved off a tag the hard camera caught clean as day, and sent {victim}'s partner right back to the apron for it.",
      '{ref} completely lost track of who was legal, and by the time it got sorted out, {victim} had already been worked over for another two minutes.',
      "{victim}'s tag was clean as could be, and {ref} simply never saw it happen.",
      "{ref} was still buried in a pin count on the other side of the ring when {victim}'s tag came in clean as a whistle.",
    ],
    needsVictim: true,
    context: 'tag',
    severity: 0.6,
  },
  {
    id: 'wrongLegalMan',
    label: 'Lost the legal man',
    lines: [
      '{ref} counted the fall while {victim} stood right there as the legal man, screaming from the apron and getting absolutely nowhere.',
      'Two men in that ring, neither one of them legal, and {ref} counted {victim} down anyway. The decision stood.',
      "{victim} was tagged in and standing right there in plain sight, and {ref} counted the other man's pin anyway.",
      "By the time {ref} finally sorted out who was actually legal, {victim} had already been counted out of a fall that never should have happened in the first place.",
    ],
    needsVictim: true,
    context: 'tag',
    severity: 0.75,
  },
  {
    id: 'missedInterference',
    label: 'Missed the interference',
    lines: [
      '{ref} was down on the floor sorting out the corner when it happened, climbed back in, saw a cover, and counted it clean. {victim} had no idea what had just hit them.',
      "The interference came and went while {ref}'s back was turned the entire time. {victim}'s protests afterward went absolutely nowhere.",
      "Somebody who had no business being anywhere near that ring got involved against {victim}, and {ref} counted the pin it produced without so much as blinking.",
      "{victim} was still trying to explain what had just happened when {ref} went ahead and raised the other man's hand.",
    ],
    needsVictim: true,
    context: 'interference',
    severity: 0.8,
  },
  {
    id: 'slowCount',
    label: 'Slow count',
    lines: [
      '{ref} was late getting down on two separate covers and slow getting back up from both. It took the air clean out of every near-fall in this match.',
      'The counting was so slow tonight that this crowd started doing it faster than {ref} could.',
      "Every single count out of {ref} tonight ran a half-second behind where it needed to be.",
      "{ref} looked like they were counting through wet cement from bell to bell tonight.",
    ],
    needsVictim: false,
    context: 'any',
    severity: 0.35,
  },
  {
    id: 'outOfPosition',
    label: 'Out of position all night',
    lines: [
      '{ref} spent this entire match on the wrong side of everything, and got flattened twice just trying to get into position.',
      'Wherever the action actually was, {ref} was somewhere else entirely — and twice had to be physically moved out of the way.',
      "{ref} was always a beat and a half behind wherever the cover actually happened tonight.",
      "Somebody had to physically steer {ref} into position more than once tonight — more than once.",
    ],
    needsVictim: false,
    context: 'any',
    severity: 0.3,
  },
  {
    id: 'lostCountOut',
    label: 'Lost the count on the floor',
    lines: [
      '{ref} started the count on the floor, got distracted halfway through, and started it right back over from one. Nobody in this building knew where they actually stood.',
      'The count out of {ref} went one, two, three, three, four — and this crowd noticed the mistake before {ref} ever did.',
      "{ref} lost the thread of that count completely and had to be reminded by the timekeeper where it actually stood.",
      "By the end of it, nobody in this entire building could tell you what number {ref} was actually on.",
    ],
    needsVictim: false,
    context: 'any',
    severity: 0.4,
  },
  {
    id: 'lateStoppage',
    label: 'Slow to stop it',
    lines: [
      '{victim} was completely gone, and {ref} let it run another full minute before anybody in stripes stepped in.',
      '{ref} should have waved this off long before the bell ever came. {victim} took a lot of punishment in the meantime that never needed to happen.',
      "{victim} had absolutely nothing left to give, and {ref} did not call it until well after everyone else in this building already had.",
      "This one was over the second {victim} stopped answering back, and {ref} let it keep going regardless.",
    ],
    needsVictim: true,
    context: 'any',
    severity: 0.7,
  },
  {
    id: 'blewTheFinish',
    label: 'Blew the finish',
    lines: [
      '{ref} called for the bell a beat too early and had to talk the timekeeper back out of it. The finish limped home from there.',
      'Whatever {ref} thought was there, the bell rang anyway, and the whole finish had to be restarted in front of a thoroughly confused building.',
      "{ref} raised the wrong hand for a solid second before the correction came, and the moment never quite recovered from it.",
      "The bell rang on {ref}'s call a beat too early, and a finish that should have landed clean instead landed as pure confusion.",
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
