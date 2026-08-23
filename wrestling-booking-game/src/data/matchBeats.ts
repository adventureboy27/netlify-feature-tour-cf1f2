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
//   {eliminated}               BATTLE_ROYAL_MIDDLE_BEATS only — whoever just went out
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

/**
 * Control segments, keyed to how the wrestler on top works. Four lines
 * apiece rather than two — several matches on one card are routinely won
 * by wrestlers of the same style, and with only two lines a card of that
 * shape had a real chance of reading the identical sentence twice, even
 * with the cross-card dedup in narrative.ts's generateBeats.
 */
export const CONTROL_BEATS: Record<string, string[]> = {
  powerhouse: [
    '{winner} threw {loser} around like laundry for a while.',
    '{winner} caught {loser} mid-air and turned it into something ugly.',
    '{winner} picked {loser} up like it cost nothing and put them down like it should have hurt more.',
    'Every time {loser} tried to get something going, {winner} just moved them somewhere worse.',
  ],
  technical: [
    '{winner} went to work on a limb and stayed there.',
    '{winner} tied {loser} in a knot the hard way, and the crowd started counting the holds.',
    '{winner} broke the hold clean, reset, and found a worse one.',
    'Patient, mean, and precise — {winner} was never in a hurry to finish this.',
  ],
  highFlyer: [
    '{winner} took it to the top rope and the building noticed.',
    '{winner} hit a dive to the floor that nobody was ready for.',
    '{winner} strung together three moves in the air before {loser} even landed from the first.',
    'The barrier took as much punishment as {loser} did.',
  ],
  submission: [
    '{winner} hunted the arm for five straight minutes.',
    '{loser} made the ropes with one finger and the place lost it.',
    '{winner} switched holds twice, and {loser} never got a full breath between them.',
    'That is not coming off without the referee getting involved, and {loser} knows it.',
  ],
  hardcore: [
    '{winner} introduced {weapon} and the referee gave up asking.',
    'It spilled into the crowd and stayed there for a while.',
    '{winner} went looking under the ring, and what came back up was somebody else\'s problem now.',
    'Nobody in the front three rows still had a dry seat.',
  ],
  striker: [
    '{winner} lit {loser} up with strikes until the front row winced.',
    'A kick landed flush and {loser} went a funny color.',
    '{winner} worked the body until {loser} stopped bothering to block it.',
    'You could hear every one of those from the cheap seats.',
  ],
  luchador: [
    '{winner} strung together a sequence nobody in the building could follow.',
    'A rope-walk into an armdrag brought the house down.',
    '{winner} went to the apron, then the top rope, then somewhere that should not have been possible.',
    'That exchange looked rehearsed for a month and probably was not.',
  ],
  showman: [
    '{winner} stopped to play to the crowd and got away with it.',
    '{winner} did the pose. The crowd did it back.',
    '{winner} narrated the whole thing to the front row like {loser} was not even in it.',
    'That was more entrance than offence, and the building loved every second of it.',
  ],
  giant: [
    '{winner} simply would not go down, and {loser} was running out of ideas.',
    '{winner} put a boot up and {loser} ran straight into it.',
    'It took three of {loser}\'s best shots just to move {winner} an inch.',
    '{winner} stood in the middle of the ring and let {loser} come to them. That was the whole plan.',
  ],
  bruiser: [
    '{winner} beat {loser} from one corner to the other.',
    'It stopped being wrestling and started being a fight.',
    '{winner} did not bother with a hold. Just hands.',
    'The referee\'s warnings stopped meaning anything after the second one.',
  ],
  oldSchool: [
    '{winner} worked a headlock for four minutes and had them hanging on every twitch.',
    'Clean breaks, hard chops, and not a wasted motion.',
    'A methodical, old-fashioned beating, and the building was right there for it.',
    '{winner} did not need thirty moves. Six good ones did the job.',
  ],
  allRounder: [
    '{winner} had an answer for everything {loser} tried.',
    'Whatever {loser} went to, {winner} had already scouted it.',
    '{winner} matched {loser} strike for strike, hold for hold, and still had more in reserve.',
    'There was no obvious game plan to beat, because {winner} did not have just one.',
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
  { text: 'Every near-fall in this one meant more with the {title} on the line.' },
  { text: '{winner} kept looking at the {title} between exchanges, like it was the only thing in the building.' },
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

/**
 * Battle royal only — the trickle of eliminations that makes a battle royal
 * read like a battle royal instead of an instant fatal-4-way roll with extra
 * bodies in it. MIDDLE names one elimination from partway through the field;
 * FINAL frames the last two before the finish beat takes over. See
 * engine/sim/battleRoyal.ts's orderEliminations for how the order itself is
 * decided — this pool only narrates it.
 */
export const BATTLE_ROYAL_MIDDLE_BEATS: BeatTemplate[] = [
  { text: '{eliminated} never saw it coming — hoisted up and heaved over the top rope, gone, and the field just got a whole lot more dangerous.' },
  { text: 'Two of them ganged up on {eliminated} at the ropes, and that was the whole story — over and out.' },
  { text: '{eliminated} tried fighting off three sets of hands at once. Nobody wins that math. Over the top and gone.' },
  { text: 'The floor is where {eliminated} landed, and the roar that followed said this crowd was not expecting that one so soon.' },
];

export const BATTLE_ROYAL_FINAL_BEATS: BeatTemplate[] = [
  { text: 'Down to the final two now, and this ring feels a whole lot bigger than it did twenty minutes ago.' },
  { text: 'Everybody else is on the floor. It comes down to these two, right here, right now.' },
  { text: 'The rest of the field is gone. Whatever happens from here decides the whole night.' },
  { text: 'Two left standing, and every soul in this building is up out of their seat for it.' },
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
