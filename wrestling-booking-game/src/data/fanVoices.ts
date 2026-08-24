// What the fans say afterwards.
//
// The show rating is a number. This is what the number *feels* like, which is
// a different thing and often a more useful one: a 62 that everybody loved
// because the main event delivered reads nothing like a 62 that was carried
// by the undercard while the main event stank.
//
// Rules that keep it from being noise:
//   - The majority tone follows the show. A great night is mostly praise.
//   - But never unanimously. There is always somebody who hated it, and
//     somebody defending the thing everybody else is burying. Wrestling fans
//     do not agree about anything and a feed where they do reads as fake.
//   - Fans want things. A feed that only reacts is flat; one that asks for
//     a rematch, a title change, or somebody to turn is a feed that makes the
//     player think about next week.
//
// Placeholders: {winner} {loser} {best} {worst} {champ} {title} {promotion}
// {name} {gimmick} (the last two are gimmick-reaction tweets only — a
// debut, a new tag team/faction, or a cold-meeting relaunch; {name} is the
// wrestler or, for a pairing, the group's shared identity)

export type TweetTone = 'praise' | 'criticism' | 'joke' | 'demand' | 'contrarian';

export interface TweetTemplate {
  text: string;
  tone: TweetTone;
  /** Needs the show to be at least this good. */
  minRating?: number;
  /** Needs the show to be no better than this. */
  maxRating?: number;
}

/** Handles. Deliberately period-appropriate and a bit sad. */
export const FAN_HANDLES = [
  'markoutmarv', 'kayfabe_karen', 'suplex_city_dave', 'ringrat79', 'thatsnotwrestling',
  'armdrag_annie', 'bookerT_truther', 'smarkhunter', 'popcornguy88', 'chairshot_charlie',
  'ladderMatchLarry', 'the_real_workrate', 'canvas_crusader', 'turnbuckle_tina', 'gorillaposition',
  'dirtsheetdan', 'frontrowfrank', 'bodyslam_betty', 'heelturnhenry', 'tapeTraderTom',
  'main_event_mike', 'jobber_justice', 'nearfall_nancy', 'cagematch_cal', 'wrestlingdad42',
  'sundaynightsam', 'theresmartmark', 'lucha_lou', 'oldschoolotis', 'blade_job_bob',
];

export const SHOW_TWEETS: TweetTemplate[] = [
  // --- the show was good
  { text: 'best show they have run in YEARS. i have zero notes. not one.', tone: 'praise', minRating: 78 },
  { text: 'i was in the building tonight and my throat is completely gone, worth every bit of it', tone: 'praise', minRating: 72 },
  { text: 'ok {promotion} actually cooked tonight, and i mean that', tone: 'praise', minRating: 68 },
  { text: 'solid show, nothing offensive, and honestly i will absolutely take it', tone: 'praise', minRating: 55, maxRating: 72 },
  { text: 'THAT is how you book a wrestling show. take notes, everybody.', tone: 'praise', minRating: 75 },
  { text: 'rewinding the last twenty minutes for the third time. genuinely incredible.', tone: 'praise', minRating: 80 },

  // --- the show was bad
  { text: 'two hours of my life i am never getting back', tone: 'criticism', maxRating: 35 },
  { text: 'who is booking this?? seriously, who??', tone: 'criticism', maxRating: 40 },
  { text: 'i fell asleep and woke up and it was somehow still going', tone: 'criticism', maxRating: 30 },
  { text: 'genuinely the worst card i have ever sat through in my life', tone: 'criticism', maxRating: 25 },
  { text: 'fine i guess. absolutely nothing i will remember by tuesday.', tone: 'criticism', minRating: 35, maxRating: 58 },
  { text: 'cancel my subscription. again. i mean it this time.', tone: 'criticism', maxRating: 32 },

  // --- jokes, any night
  { text: 'somebody just asked me why i am yelling at grown men in trunks. i had no answer for them.', tone: 'joke' },
  { text: 'the referee counted so slowly i aged a full year', tone: 'joke' },
  { text: 'popcorn was $4. the show was worth less than the popcorn, easily.', tone: 'joke', maxRating: 45 },
  { text: 'guy behind me shouted "BORING" at the national anthem. an absolute legend.', tone: 'joke' },
  { text: 'my nephew asked if it was real and i had to sit them down for a talk', tone: 'joke' },
  { text: 'i have watched this company for 20 years and i still cannot explain why to anybody', tone: 'joke' },
  { text: 'security tackled a guy in a hot dog costume. easily the best part of the night.', tone: 'joke', maxRating: 50 },

  // --- the middle, where most shows actually live
  { text: 'perfectly watchable wrestling show. that is allowed to be enough, people.', tone: 'praise', minRating: 45, maxRating: 70 },
  { text: 'first hour dragged hard, second hour absolutely delivered', tone: 'praise', minRating: 45, maxRating: 72 },
  { text: 'good show carried by two matches and we all know exactly which two', tone: 'praise', minRating: 50, maxRating: 75 },
  { text: 'the undercard was better than the main event and that is a real problem', tone: 'criticism', minRating: 40, maxRating: 70 },
  { text: 'they are SO close to something here and keep getting in their own way', tone: 'criticism', minRating: 40, maxRating: 68 },
  { text: 'why in the world is this show three hours long', tone: 'criticism', minRating: 35, maxRating: 75 },
  { text: 'decent card, terrible crowd, straight up dead building', tone: 'criticism', minRating: 40, maxRating: 70 },

  // --- contrarians, deliberately covering the whole range so there is always
  // somebody in the feed arguing with everybody else
  { text: 'everyone is majorly overreacting right now. it was fine.', tone: 'contrarian' },
  { text: 'genuinely do not understand this entire timeline tonight', tone: 'contrarian' },
  { text: 'i am going to be the one person who says it: that was fine, actually', tone: 'contrarian' },
  { text: 'unpopular opinion and i stand by it: tonight was overrated', tone: 'contrarian', minRating: 65 },
  { text: 'you people would boo a five star match if it landed on a tuesday', tone: 'contrarian', maxRating: 55 },
  { text: 'i enjoyed every second of that and i am not apologizing to this timeline', tone: 'contrarian', maxRating: 55 },
  { text: 'reply guys are out in full force tonight and every single one of them is wrong', tone: 'contrarian' },
];

/** About a specific match or wrestler. */
export const MATCH_TWEETS: TweetTemplate[] = [
  { text: '{best} is the best wrestler on this entire planet and it is not close', tone: 'praise', minRating: 70 },
  { text: 'whatever they are paying {best}, it is nowhere near enough', tone: 'praise', minRating: 65 },
  { text: '{best} carried that entire match on their back, full stop', tone: 'praise', minRating: 60 },
  { text: 'give {best} the belt. tonight. right now. no more waiting.', tone: 'demand', minRating: 65 },
  { text: '{winner} over {loser} was the right call and every single one of you knows it', tone: 'praise' },

  { text: '{worst} needs to be sent straight back to the school', tone: 'criticism', maxRating: 45 },
  { text: 'every single time {worst} is on my screen i check my phone', tone: 'criticism', maxRating: 50 },
  { text: '{worst} has been protected for years and i genuinely still do not know why', tone: 'criticism', maxRating: 50 },
  { text: 'no disrespect to {worst} but that was genuinely rough to watch', tone: 'criticism', maxRating: 42 },

  { text: 'run {winner} vs {loser} again. immediately. do not make us wait.', tone: 'demand', minRating: 72 },
  { text: '{loser} deserved so much better than that finish', tone: 'demand' },
  { text: 'turn {winner} heel already, the crowd is literally begging for it', tone: 'demand' },
  { text: 'PUT. THE BELT. ON {best}.', tone: 'demand', minRating: 60 },
  { text: 'somebody please give {loser} an actual storyline to work with', tone: 'demand', maxRating: 55 },

  { text: 'hot take and i am not backing down: {worst} was the best thing on this whole show', tone: 'contrarian', maxRating: 55 },
  { text: 'i am the only person alive who does not care about {best}', tone: 'contrarian', minRating: 65 },
  { text: '{best} is fine. everyone needs to seriously calm down.', tone: 'contrarian' },
  { text: 'leave {worst} alone, they are trying their absolute best out there', tone: 'contrarian' },

  // --- more mid-range so the feed does not run dry on an average night
  { text: '{winner} needed that win more than people actually realize', tone: 'praise', minRating: 40 },
  { text: '{loser} is being wasted and it is genuinely starting to annoy me', tone: 'criticism', maxRating: 72 },
  { text: 'i need {winner} and {loser} to never wrestle each other ever again', tone: 'demand', maxRating: 55 },
  { text: 'book {best} against somebody who can actually go, for once', tone: 'demand', minRating: 45 },
  { text: '{worst} vs {best} would be a full-blown disaster and i want to see it happen', tone: 'joke' },
  { text: 'they have been doing {winner} vs {loser} since i still had hair', tone: 'joke' },
  { text: 'somebody go check on {loser}', tone: 'joke', maxRating: 50 },
];

/** When a belt changed hands. */
export const TITLE_CHANGE_TWEETS: TweetTemplate[] = [
  { text: 'NEW CHAMPION. i am not okay. i am genuinely not okay right now.', tone: 'praise' },
  { text: 'they actually did it. {champ} has the {title}. i am shaking.', tone: 'praise' },
  { text: 'putting the {title} on {champ} is a mistake and i will be right here in six months saying i told you so', tone: 'criticism' },
  { text: 'about time. {champ} should have had that two whole years ago.', tone: 'praise' },
  { text: 'so we are just changing the {title} on a random tuesday now, cool cool cool', tone: 'criticism' },
  { text: 'my {title} prediction was completely wrong and i have never been happier about anything', tone: 'joke' },
];

/**
 * A new signee's debut gimmick — {name} the wrestler, {gimmick} the
 * character the booker gave them.
 */
export const GIMMICK_DEBUT_TWEETS: TweetTemplate[] = [
  { text: 'okay {name} as {gimmick} is actually genuinely really good', tone: 'praise' },
  { text: '{gimmick}?? say absolutely less. i am so in.', tone: 'praise' },
  { text: 'new signing {name} debuting as {gimmick} and i am already fully invested', tone: 'praise' },
  { text: '{name} deserved so much better than {gimmick}', tone: 'criticism' },
  { text: '{gimmick} is not going to work and i do not know why nobody told them that', tone: 'criticism' },
  { text: 'not {name} coming in as {gimmick} like it is still 1987', tone: 'joke' },
  { text: '{gimmick} really said sir this is a wendy\'s', tone: 'joke' },
  { text: 'give {gimmick} a solid six months before you scrap it, i am literally begging', tone: 'demand' },
  { text: 'everybody hating on {gimmick} and honestly i think it slaps', tone: 'contrarian' },
];

/**
 * A new tag team or faction from the signing meeting — {name} is the
 * group's shared identity, not a person.
 */
export const GIMMICK_PAIRING_TWEETS: TweetTemplate[] = [
  { text: '{name} is about to run this entire division', tone: 'praise' },
  { text: 'finally, a tag team that actually makes sense together: {name}', tone: 'praise' },
  { text: '{name} feels rushed. give it time i guess.', tone: 'criticism' },
  { text: 'not sure {name} needed to happen but hey, here we are', tone: 'criticism' },
  { text: '{name} coordinated outfits already?? they are not playing around', tone: 'joke' },
  { text: 'run {name} straight for the titles, do not overthink this', tone: 'demand' },
  { text: '{name} is fine, everyone please calm down', tone: 'contrarian' },
];

/**
 * A relaunch out of the forced cold-meeting — {name} the wrestler,
 * {gimmick} the new direction.
 */
export const GIMMICK_RELAUNCH_TWEETS: TweetTemplate[] = [
  { text: '{name} as {gimmick} is exactly the reset they needed', tone: 'praise' },
  { text: 'okay the {gimmick} relaunch actually, genuinely works', tone: 'praise' },
  { text: '{gimmick} is not fixing whatever the real problem was with {name}', tone: 'criticism' },
  { text: 'another repackage. groundbreaking stuff, truly.', tone: 'criticism' },
  { text: '{name} has had more gimmicks than i have had hot dinners at this point', tone: 'joke' },
  { text: 'commit to {gimmick} for real this time, do not give up on it in three weeks', tone: 'demand' },
  { text: 'i kind of miss the old {name} honestly, there i said it', tone: 'contrarian' },
];

/** Tone words for the summary line above the feed. */
export const CROWD_VERDICTS: { minRating: number; verdict: string }[] = [
  { minRating: 85, verdict: 'The internet has completely lost its mind, in the best possible way.' },
  { minRating: 72, verdict: 'They loved it.' },
  { minRating: 58, verdict: 'Mostly positive, with the usual complaints thrown in.' },
  { minRating: 45, verdict: 'Split right down the middle.' },
  { minRating: 32, verdict: 'Not going down well at all.' },
  { minRating: 0, verdict: 'They are absolutely furious.' },
];
