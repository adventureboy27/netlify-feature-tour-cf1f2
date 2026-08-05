// The highlight reel's vocabulary.
//
// The player never watches a match, so this text *is* the match. A two-line
// write-up cannot carry a story, which is why the reel now scales: a squash
// gets two beats, a five-star title main event gets seven or eight, and the
// beats in between are chosen from what was actually true about that match —
// who was in it, how they wrestle, what was on the line, whether the two of
// them genuinely hate each other.
//
// Placeholders, filled by engine/sim/narrative.ts:
//   {winner} {loser} {other}   people
//   {finisher}                 the winner's finishing move
//   {title}                    the belt on the line
//   {weapon}                   something to hit somebody with
//
// Every line here has to read as a *highlight* — the bit somebody would tell
// you about afterwards — not as play-by-play. "They locked up" is not a
// highlight. "They locked up and did not break for ninety seconds" is.

export interface BeatTemplate {
  text: string;
  /** Only used when the match is at least this good, 0-100. */
  minRating?: number;
  /** Only used when the match is no better than this. */
  maxRating?: number;
}

// ------------------------------------------------------------ the opening

export const OPENING_BEATS: BeatTemplate[] = [
  { text: 'A cautious feeling-out process to start.' },
  { text: 'They came out swinging from the opening bell.' },
  { text: 'A slow, methodical, mat-based build.' },
  { text: '{winner} and {loser} locked up and did not break for a full minute.' },
  { text: '{loser} jumped {winner} before the bell and the referee lost control early.' },
  { text: 'The crowd was in it from the first lock-up.', minRating: 60 },
  { text: 'A grinding, physical contest from the first lock-up.' },
  { text: 'You could hear individual voices in the crowd.', maxRating: 35 },
  { text: 'The building never got out of its seats.', maxRating: 30 },
  { text: 'Both of them looked like they had somewhere else to be.', maxRating: 25 },
];

// ------------------------------------------------- how the styles read

/** Control segments, keyed to how the wrestler on top works. */
export const CONTROL_BEATS: Record<string, string[]> = {
  powerhouse: [
    '{winner} threw {loser} around like laundry for a while.',
    '{winner} caught {loser} mid-air and turned it into something ugly.',
  ],
  technical: [
    '{winner} went to work on a limb and stayed there.',
    '{winner} tied {loser} in a knot the hard way, and the crowd started counting the holds.',
  ],
  highFlyer: [
    '{winner} took it to the top rope and the building noticed.',
    '{winner} hit a dive to the floor that nobody was ready for.',
  ],
  submission: [
    '{winner} hunted the arm for five straight minutes.',
    '{loser} made the ropes with one finger and the place lost it.',
  ],
  hardcore: [
    '{winner} introduced {weapon} and the referee gave up asking.',
    'It spilled into the crowd and stayed there for a while.',
  ],
  striker: [
    '{winner} lit {loser} up with strikes until the front row winced.',
    'A kick landed flush and {loser} went a funny colour.',
  ],
  luchador: [
    '{winner} strung together a sequence nobody in the building could follow.',
    'A rope-walk into an armdrag brought the house down.',
  ],
  showman: [
    '{winner} stopped to play to the crowd and got away with it.',
    '{winner} did the pose. The crowd did it back.',
  ],
  giant: [
    '{winner} simply would not go down, and {loser} was running out of ideas.',
    '{winner} put a boot up and {loser} ran straight into it.',
  ],
  bruiser: [
    '{winner} beat {loser} from one corner to the other.',
    'It stopped being wrestling and started being a fight.',
  ],
  oldSchool: [
    '{winner} worked a headlock for four minutes and had them hanging on every twitch.',
    'Clean breaks, hard chops, and not a wasted motion.',
  ],
  allRounder: [
    '{winner} had an answer for everything {loser} tried.',
    'Whatever {loser} went to, {winner} had already scouted it.',
  ],
};

// ------------------------------------------------------------ the middle

export const HOPE_SPOT_BEATS: BeatTemplate[] = [
  { text: '{loser} caught fire out of nowhere and the place came with them.' },
  { text: '{loser} started firing back and would not stop.' },
  { text: 'Every time {loser} got a foot on the ropes the noise went up a level.' },
  { text: '{loser} kept getting up, which is its own kind of highlight.' },
];

export const NEAR_FALL_BEATS: BeatTemplate[] = [
  { text: '{loser} kicked out at two and the crowd came unglued.' },
  { text: 'A near-fall had the building on its feet.' },
  { text: 'A shocking reversal nearly ended it early.' },
  { text: 'Three separate near-falls in ninety seconds. Nobody sat down again.', minRating: 75 },
  { text: 'The referee got to two and a half and the roof came off.', minRating: 70 },
];

/** The big one — reserved for genuinely good matches. */
export const BIG_SPOT_BEATS: BeatTemplate[] = [
  { text: '{winner} hit something off the top that should not have been survivable.', minRating: 65 },
  { text: 'Both of them went down and the referee started counting them both out.', minRating: 60 },
  { text: 'They traded strikes in the middle of the ring until neither could stand.', minRating: 65 },
  { text: '{loser} kicked out of the {finisher}. Nobody kicks out of the {finisher}.', minRating: 78 },
  { text: 'The match went through the timekeeper’s table and kept going.', minRating: 60 },
];

// ------------------------------------------------------- what it was for

export const TITLE_BEATS: BeatTemplate[] = [
  { text: 'You could feel what the {title} meant to both of them.' },
  { text: '{loser} went after the {title} like it was the last one they would get.' },
  { text: 'The referee held the {title} up and the building went quiet for a second.' },
];

export const GRUDGE_BEATS: BeatTemplate[] = [
  { text: 'There was nothing worked about this. They were hitting each other properly.' },
  { text: 'The referee stopped trying to separate them somewhere in the second act.' },
  { text: 'This stopped looking like a wrestling match a long way before the finish.' },
  { text: 'Whatever is between these two, it did not get settled tonight.' },
];

// --------------------------------------------------------- the aftermath

export const AFTERMATH_BEATS: BeatTemplate[] = [
  { text: '{winner} did not celebrate. They just looked at {loser} and left.', minRating: 55 },
  { text: 'The crowd stayed on their feet well after the bell.', minRating: 78 },
  { text: '{loser} sat in the middle of the ring for a long time afterwards.', minRating: 60 },
  { text: 'Half the building was already in the concourse before the bell.', maxRating: 30 },
  { text: 'The announcers moved on quickly.', maxRating: 25 },
];

/** Things to hit somebody with, for the hardcore lines. */
export const WEAPONS = [
  'a steel chair',
  'a trash can lid',
  'a kendo stick',
  'somebody’s crutch',
  'a cookie sheet',
  'the ring bell',
  'a stop sign',
  'a length of chain',
];
