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
//   {weapon}                   something to hit somebody with (recorded on the beat: see WEAPONS)
//   {eliminated}               battle-royal elimination beats only — who just went out
//   {eliminatedBy}             BATTLE_ROYAL_ELIMINATION_BY_BEATS only — who put them out
//
// Every line here has to read as a *highlight* — the bit somebody would tell
// you about afterwards — not as play-by-play. "They locked up" is not a
// highlight. "They locked up and did not break for ninety seconds" is.

import type { MatchAction, MatchSpot, MatchWeapon } from '../engine/types';

export interface BeatTemplate {
  text: string;
  /** Only used when the match is at least this good, 0-100. */
  minRating?: number;
  /** Only used when the match is no better than this. */
  maxRating?: number;
}

// ------------------------------------------------------------ the opening

export const OPENING_BEATS: BeatTemplate[] = [
  { text: 'A cautious feeling-out process to start — both of them circling, neither one committing to anything just yet.' },
  { text: 'The bell rang and it was fists from the jump. No feeling-out process. No handshake. Just business.' },
  { text: 'A slow, grinding, mat-based build, and this one was in no hurry to get anywhere fast.' },
  { text: '{winner} and {loser} locked up at the bell and neither one budged for a full minute — a genuine standoff to open the show.' },
  { text: '{loser} jumped {winner} before the bell ever rang, and the referee lost this thing before it even got started.' },
  { text: 'This building was locked in from the very first lock-up. You could feel it.', minRating: 60 },
  { text: 'Physical from the opening bell — this read like a fight wearing a wrestling match as a disguise.' },
  { text: 'It got quiet enough out there that you could pick out individual voices in the crowd. Never a good sign.', maxRating: 35 },
  { text: 'Not once did this building get out of its seats tonight. Not once.', maxRating: 30 },
  { text: 'Both of these two looked like they had somewhere better to be.', maxRating: 25 },
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
    '{winner} threw {loser} around like a rag doll — pure, brutal strength on full display.',
    '{winner} plucked {loser} right out of the air and turned it into something downright ugly.',
    '{winner} hoisted {loser} up like they weighed nothing and drove them back down like they meant every ounce of it.',
    'Every single time {loser} tried to build a head of steam, {winner} just picked them up and moved them somewhere worse.',
  ],
  technical: [
    '{winner} went to work on a limb and simply never let go — textbook, relentless, mean.',
    '{winner} tied {loser} up in a knot the hard way, and this crowd started counting the submission attempts out loud.',
    '{winner} broke the hold clean, reset, and immediately found something even more painful.',
    'Patient. Mean. Surgical. {winner} was never once in a hurry to put this away.',
  ],
  highFlyer: [
    '{winner} climbed to the top rope and this whole building rose right up with them.',
    '{winner} launched a dive to the floor that absolutely nobody in this building was ready for.',
    '{winner} strung together three moves in mid-air before {loser} had even landed from the first — pure, gravity-defying offense.',
    'That guardrail took just as much punishment tonight as {loser} did.',
  ],
  submission: [
    '{winner} hunted that arm for five straight minutes and would not let it go.',
    '{loser} got one finger on the bottom rope and this place absolutely lost it.',
    '{winner} switched submissions twice, and {loser} never got a single full breath in between.',
    'That hold is not coming off without the referee getting involved, and {loser} knows it better than anybody here.',
  ],
  hardcore: [
    '{winner} introduced {weapon} to this fight, and the referee simply gave up asking nicely.',
    'This one spilled out into the crowd and stayed there a good long while.',
    '{winner} went digging under that ring, came back up with {weapon}, and it became {loser}\'s problem in a hurry.',
    'Nobody sitting in the first three rows left this building with a dry seat.',
  ],
  striker: [
    '{winner} lit {loser} up with strikes loud enough to make the front row wince.',
    'One kick landed flush and {loser} genuinely went a different color.',
    '{winner} worked the body so hard and so often that {loser} eventually stopped even trying to block it.',
    'You could hear every single one of those strikes land, all the way from the cheap seats.',
  ],
  luchador: [
    '{winner} strung together a sequence so fast that nobody in this building could follow all of it.',
    'A rope-walk straight into an armdrag brought this entire house down.',
    '{winner} went to the apron, then the top rope, then somewhere that should not have been physically possible.',
    'That exchange looked like it had been rehearsed for a month — and it very likely had not been.',
  ],
  showman: [
    '{winner} stopped mid-match to play to the crowd, and shockingly, got away with it.',
    '{winner} hit the signature pose. This crowd hit it right back.',
    '{winner} narrated the entire sequence to the front row like {loser} was not even in the building.',
    'That was more entrance than offense, and this crowd ate up every last second of it.',
  ],
  giant: [
    '{winner} simply would not go down, and {loser} was flat-out running out of ideas.',
    '{winner} put a boot straight up and {loser} ran right into it — full speed, no brakes.',
    'It took three of {loser}\'s absolute best shots just to move {winner} a single inch.',
    '{winner} just stood there in the middle of the ring and let {loser} come to them. That was the entire game plan, and it worked.',
  ],
  bruiser: [
    '{winner} beat {loser} from one corner of this ring clean to the other.',
    'Somewhere in there this stopped being a wrestling match and turned into a flat-out fight.',
    '{winner} did not bother with a single hold tonight. Just hands.',
    'The referee\'s warnings stopped meaning a single thing after about the second one.',
  ],
  oldSchool: [
    '{winner} worked a plain old headlock for four straight minutes and had this crowd hanging on every twitch.',
    'Clean breaks, hard chops, and not one wasted motion the entire way through.',
    'A slow, old-fashioned, methodical beating, and this building was right there with them for every second.',
    '{winner} did not need thirty moves tonight. Six good ones got the job done.',
  ],
  allRounder: [
    '{winner} had an answer ready for absolutely everything {loser} tried.',
    'Whatever {loser} reached for, {winner} had already scouted it and had a counter waiting.',
    '{winner} matched {loser} strike for strike, hold for hold, and still looked like they had another gear left.',
    'There was no single game plan to solve here, because {winner} never committed to just one.',
  ],
};

// ------------------------------------------------------------ the middle

export const HOPE_SPOT_BEATS: BeatTemplate[] = [
  { text: '{loser} caught fire out of absolutely nowhere, and this place came alive right along with them.' },
  { text: '{loser} started firing back with everything they had, and simply would not stop.' },
  { text: 'Every single time {loser} got a foot on that bottom rope, the noise in this building climbed another notch.' },
  { text: '{loser} kept getting back up off that mat — and honestly, that alone was a highlight.' },
];

export const NEAR_FALL_BEATS: BeatTemplate[] = [
  { text: '{loser} kicked out at two and this crowd came absolutely unglued.' },
  { text: 'One near-fall had this entire building up on its feet.' },
  { text: 'A shocking, out-of-nowhere reversal nearly ended this thing way ahead of schedule.' },
  { text: 'Three separate near-falls inside of ninety seconds. Nobody in this building sat back down again.', minRating: 75 },
  { text: 'The referee\'s hand hit two and a half and the roof nearly came off this building.', minRating: 70 },
];

/** The big one — reserved for genuinely good matches. */
export const BIG_SPOT_BEATS: BeatTemplate[] = [
  { text: '{winner} hit something off the top rope that should not have been survivable — and the building knew it.', minRating: 65 },
  { text: 'Both of them went down at the exact same time, and the referee started counting them both out.', minRating: 60 },
  { text: 'They stood in the middle of that ring and traded strikes until neither one of them could stand up straight.', minRating: 65 },
  { text: '{loser} kicked out of the {finisher}. Nobody kicks out of the {finisher} — and this building knows it.', minRating: 78 },
  { text: 'This match went straight through the timekeeper\'s table and kept right on going.', minRating: 60 },
];

// ------------------------------------------------------- what it was for

export const TITLE_BEATS: BeatTemplate[] = [
  { text: 'You could feel exactly what that {title} meant to both of these competitors tonight.' },
  { text: '{loser} went after that {title} like it was the very last shot they were ever going to get.' },
  { text: 'The referee held that {title} up high, and for one second this entire building went dead quiet.' },
  { text: 'Every single near-fall in this one hit that much harder with the {title} on the line.' },
  { text: '{winner} kept stealing glances at that {title} between exchanges, like it was the only thing in this whole building that mattered.' },
];

export const GRUDGE_BEATS: BeatTemplate[] = [
  { text: 'There was nothing worked about this one, folks. They were hitting each other for real.' },
  { text: 'The referee flat-out stopped trying to separate these two somewhere in the second act.' },
  { text: 'This stopped looking anything like a wrestling match a long way before the finish came.' },
  { text: 'Whatever history is between these two, it did not get settled in this ring tonight.' },
];

// --------------------------------------------------------- the aftermath

export const AFTERMATH_BEATS: BeatTemplate[] = [
  { text: '{winner} did not celebrate. Not even a little. Just looked down at {loser} and walked away.', minRating: 55 },
  { text: 'This crowd stayed up on its feet long after that final bell rang.', minRating: 78 },
  { text: '{loser} sat right there in the middle of that ring for a long, long time afterward.', minRating: 60 },
  { text: 'Half this building was already out in the concourse before the bell even rang.', maxRating: 30 },
  { text: 'Even the announce team moved on from that one in a hurry.', maxRating: 25 },
];

/**
 * Battle royal only — the trickle of eliminations that makes a battle royal
 * read like a battle royal instead of an instant fatal-4-way roll with extra
 * bodies in it. MIDDLE names one elimination from partway through the field;
 * FINAL frames the last two before the finish beat takes over. See
 * engine/sim/battleRoyal.ts's orderEliminations for how the order itself is
 * decided — this pool only narrates it.
 */
/** A real elimination, identity unknown or not worth naming (nobody clear did it — a gang-up, a scramble). */
export const BATTLE_ROYAL_ELIMINATION_BEATS: BeatTemplate[] = [
  { text: '{eliminated} never saw it coming — hoisted up and heaved over the top rope, gone, and the field just got a whole lot more dangerous.' },
  { text: 'Two of them ganged up on {eliminated} at the ropes, and that was the whole story — over and out.' },
  { text: '{eliminated} tried fighting off three sets of hands at once. Nobody wins that math. Over the top and gone.' },
  { text: 'The floor is where {eliminated} landed, and the roar that followed said this crowd was not expecting that one so soon.' },
];

/** A real elimination with a decided eliminator — engine/sim/battleRoyal.ts's pickEliminators. */
export const BATTLE_ROYAL_ELIMINATION_BY_BEATS: BeatTemplate[] = [
  { text: '{eliminatedBy} put {eliminated} over the top rope and out, clean as anything.' },
  { text: '{eliminated} never saw {eliminatedBy} coming from behind — over the ropes and gone.' },
  { text: 'It was {eliminatedBy} who finally got rid of {eliminated}, and the whole building came alive for it.' },
  { text: '{eliminatedBy} and {eliminated} traded shots right at the ropes, and {eliminatedBy} was the one still standing on the apron after.' },
];

export const BATTLE_ROYAL_FINAL_BEATS: BeatTemplate[] = [
  { text: 'Down to the final two now, and this ring feels a whole lot bigger than it did twenty minutes ago.' },
  { text: 'Everybody else is on the floor. It comes down to these two, right here, right now.' },
  { text: 'The rest of the field is gone. Whatever happens from here decides the whole night.' },
  { text: 'Two left standing, and every soul in this building is up out of their seat for it.' },
];

/**
 * Things to hit somebody with, for the hardcore lines — only what the match
 * viewer can put in a hand, so a line that names one is a line it can show.
 */
export const WEAPONS: readonly { id: MatchWeapon; text: string }[] = [
  { id: 'chair', text: 'a steel chair' },
  { id: 'can', text: 'a trash can' },
  { id: 'kendo', text: 'a kendo stick' },
];

/**
 * The special matches' spots (types.ts MatchSpot), in the write-up's voice.
 * {actor} did it, {target} had it done to them (for a near thing: {actor}
 * nearly won with it, {target} survived it). {weapon} as above.
 */
export const SPOT_BEATS: Record<MatchSpot, readonly string[]> = {
  weaponShot: ['{actor} cracked {target} with {weapon}, and nobody was going to stop it.', '{actor} came up with {weapon} and laid {target} out with it.'],
  ladderShot: ['{actor} swung a ladder into {target} like it weighed nothing at all.', '{actor} caught {target} square with the ladder, and the whole ring heard it.'],
  stepsShot: ['{actor} hauled the steel steps up overhead and brought them down on {target}.', '{actor} lifted the ring steps and dropped them on {target} — the sound alone cleared the front row.'],
  tableThrough: ['{actor} powerbombed {target} clean through a table.', '{actor} set up a table, and {target} went through it.'],
  ladderDive: ['{actor} climbed to the top of the ladder and came off it onto {target}.', '{actor} jumped off the very top of the ladder and crashed down on {target}.'],
  blindSwing: ['{actor} threw a haymaker at thin air, and then the two of them walked straight into each other.', 'Neither of them could see a thing: {actor} swung at nothing and {target} stumbled right into the follow-up.'],
  intoCage: ['{actor} sent {target} face-first into the steel of the cage.', '{actor} rammed {target} into the cage wall, and the whole structure shook.'],
  cageTop: ['They fought on top of the cage itself, and {target} came off it the hard way.', '{actor} met {target} at the top of the cage and knocked them back down to the mat.'],
  breakdown: ['It broke down — all four of them in the ring at once, and the referee lost control of the whole thing.', 'The partners came in, it was all four of them at once, and nobody was going back to the apron for a while.'],
  ladderPull: ['{actor} had a hand on the prize when {target} dragged them back off the ladder.', '{actor} was at the top of the ladder, fingertips on it, and {target} pulled them down.'],
  tableFightOff: ['{actor} had {target} up for the powerbomb with the table right there, and {target} fought their way free.', '{target} was one second from going through the table and punched out of {actor}\'s grip.'],
  casketNear: ['{actor} got {target} into the casket — and the lid came flying back open before it could be shut.', '{target} was in the casket with the lid coming down and somehow forced it back open.'],
  cageClimb: ['{actor} was nearly over the top of the cage when {target} dragged them back in.', '{actor} got a leg over the top of the cage and {target} hauled them back down.'],
  teeter: ['{target} was halfway over the top rope and somehow hung on.', '{actor} had {target} over the top, feet dangling, and {target} would not go.'],
  holdEscape: ['{actor} had the hold cinched in and {target} fought their way out of it.', '{target} was a breath away from tapping to {actor} and broke the hold instead.'],
  countBeaten: ['{actor} left {target} down, and {target} beat the referee\'s count at eight.', 'The referee counted to eight over {target} and they were up again.'],
};

/**
 * What the write-up lines above say physically happened, keyed by the line
 * as written. A line in here is recorded with its action (types.ts
 * MatchAction): the play-by-play calls that action and the ring stages it, so
 * the highlight, the call and the picture never describe three different
 * matches. `by: 'loser'` — the line's {loser} is the one doing it.
 * Lines about the crowd, the mood or the stakes are deliberately absent.
 */
export const LINE_ACTIONS: Readonly<Record<string, { action: MatchAction; by?: 'loser' }>> = {
  // the opening
  'A cautious feeling-out process to start — both of them circling, neither one committing to anything just yet.': { action: 'feelingOut' },
  'The bell rang and it was fists from the jump. No feeling-out process. No handshake. Just business.': { action: 'brawl' },
  'A slow, grinding, mat-based build, and this one was in no hurry to get anywhere fast.': { action: 'matWork' },
  '{winner} and {loser} locked up at the bell and neither one budged for a full minute — a genuine standoff to open the show.': { action: 'lockup' },
  '{loser} jumped {winner} before the bell ever rang, and the referee lost this thing before it even got started.': { action: 'jumpStart', by: 'loser' },
  'This building was locked in from the very first lock-up. You could feel it.': { action: 'lockup' },
  'Physical from the opening bell — this read like a fight wearing a wrestling match as a disguise.': { action: 'brawl' },
  // powerhouse
  '{winner} threw {loser} around like a rag doll — pure, brutal strength on full display.': { action: 'slam' },
  '{winner} plucked {loser} right out of the air and turned it into something downright ugly.': { action: 'slam' },
  '{winner} hoisted {loser} up like they weighed nothing and drove them back down like they meant every ounce of it.': { action: 'liftDrive' },
  'Every single time {loser} tried to build a head of steam, {winner} just picked them up and moved them somewhere worse.': { action: 'slam' },
  // technical
  '{winner} went to work on a limb and simply never let go — textbook, relentless, mean.': { action: 'limbWork' },
  '{winner} tied {loser} up in a knot the hard way, and this crowd started counting the submission attempts out loud.': { action: 'groundHold' },
  '{winner} broke the hold clean, reset, and immediately found something even more painful.': { action: 'limbWork' },
  // high flyer
  '{winner} climbed to the top rope and this whole building rose right up with them.': { action: 'topRope' },
  '{winner} launched a dive to the floor that absolutely nobody in this building was ready for.': { action: 'floorDive' },
  '{winner} strung together three moves in mid-air before {loser} had even landed from the first — pure, gravity-defying offense.': { action: 'aerialCombo' },
  'That guardrail took just as much punishment tonight as {loser} did.': { action: 'barricade' },
  // submission
  '{winner} hunted that arm for five straight minutes and would not let it go.': { action: 'limbWork' },
  '{loser} got one finger on the bottom rope and this place absolutely lost it.': { action: 'groundHold' },
  '{winner} switched submissions twice, and {loser} never got a single full breath in between.': { action: 'groundHold' },
  'That hold is not coming off without the referee getting involved, and {loser} knows it better than anybody here.': { action: 'groundHold' },
  // hardcore (the weapon lines are spots: see narrative.ts spotInLine)
  'This one spilled out into the crowd and stayed there a good long while.': { action: 'crowdBrawl' },
  'Nobody sitting in the first three rows left this building with a dry seat.': { action: 'crowdBrawl' },
  // striker
  '{winner} lit {loser} up with strikes loud enough to make the front row wince.': { action: 'strikes' },
  'One kick landed flush and {loser} genuinely went a different color.': { action: 'kick' },
  '{winner} worked the body so hard and so often that {loser} eventually stopped even trying to block it.': { action: 'bodyShots' },
  'You could hear every single one of those strikes land, all the way from the cheap seats.': { action: 'strikes' },
  // luchador
  '{winner} strung together a sequence so fast that nobody in this building could follow all of it.': { action: 'aerialCombo' },
  'A rope-walk straight into an armdrag brought this entire house down.': { action: 'armDrag' },
  '{winner} went to the apron, then the top rope, then somewhere that should not have been physically possible.': { action: 'topRope' },
  'That exchange looked like it had been rehearsed for a month — and it very likely had not been.': { action: 'counter' },
  // showman
  '{winner} stopped mid-match to play to the crowd, and shockingly, got away with it.': { action: 'taunt' },
  '{winner} hit the signature pose. This crowd hit it right back.': { action: 'taunt' },
  '{winner} narrated the entire sequence to the front row like {loser} was not even in the building.': { action: 'taunt' },
  'That was more entrance than offense, and this crowd ate up every last second of it.': { action: 'taunt' },
  // giant
  '{winner} simply would not go down, and {loser} was flat-out running out of ideas.': { action: 'noSell' },
  '{winner} put a boot straight up and {loser} ran right into it — full speed, no brakes.': { action: 'bigBoot' },
  'It took three of {loser}\'s absolute best shots just to move {winner} a single inch.': { action: 'noSell' },
  '{winner} just stood there in the middle of the ring and let {loser} come to them. That was the entire game plan, and it worked.': { action: 'noSell' },
  // bruiser
  '{winner} beat {loser} from one corner of this ring clean to the other.': { action: 'brawl' },
  'Somewhere in there this stopped being a wrestling match and turned into a flat-out fight.': { action: 'brawl' },
  '{winner} did not bother with a single hold tonight. Just hands.': { action: 'strikes' },
  'The referee\'s warnings stopped meaning a single thing after about the second one.': { action: 'brawl' },
  // old school
  '{winner} worked a plain old headlock for four straight minutes and had this crowd hanging on every twitch.': { action: 'headlock' },
  'Clean breaks, hard chops, and not one wasted motion the entire way through.': { action: 'chops' },
  // all-rounder
  '{winner} had an answer ready for absolutely everything {loser} tried.': { action: 'counter' },
  'Whatever {loser} reached for, {winner} had already scouted it and had a counter waiting.': { action: 'counter' },
  '{winner} matched {loser} strike for strike, hold for hold, and still looked like they had another gear left.': { action: 'strikes' },
  // the comeback
  '{loser} caught fire out of absolutely nowhere, and this place came alive right along with them.': { action: 'fireUp', by: 'loser' },
  '{loser} started firing back with everything they had, and simply would not stop.': { action: 'fireUp', by: 'loser' },
  '{loser} kept getting back up off that mat — and honestly, that alone was a highlight.': { action: 'fireUp', by: 'loser' },
  // the big one
  '{winner} hit something off the top rope that should not have been survivable — and the building knew it.': { action: 'topRope' },
  'Both of them went down at the exact same time, and the referee started counting them both out.': { action: 'doubleDown' },
  'They stood in the middle of that ring and traded strikes until neither one of them could stand up straight.': { action: 'strikes' },
  '{loser} kicked out of the {finisher}. Nobody kicks out of the {finisher} — and this building knows it.': { action: 'finisherKickout' },
  // the grudge
  'There was nothing worked about this one, folks. They were hitting each other for real.': { action: 'strikes' },
  'The referee flat-out stopped trying to separate these two somewhere in the second act.': { action: 'brawl' },
};

/** Said after a spot that busted somebody open (narrative.ts). {target} is who. */
export const BLEEDING_LINES: readonly string[] = [
  '{target} was busted open.',
  '{target} came up from that one bleeding.',
  'There was blood on {target} after that, and plenty of it.',
];

/** The spots hard enough to open somebody up. */
export const BLOODY_SPOTS: readonly MatchSpot[] = ['weaponShot', 'ladderShot', 'stepsShot', 'tableThrough', 'intoCage', 'cageTop', 'ladderDive'];
