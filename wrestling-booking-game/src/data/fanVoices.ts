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
  { text: 'best show they have run in years. no notes.', tone: 'praise', minRating: 78 },
  { text: 'i was in the building tonight and my throat is GONE', tone: 'praise', minRating: 72 },
  { text: 'ok {promotion} actually cooked tonight', tone: 'praise', minRating: 68 },
  { text: 'solid show. nothing offensive. i will take it.', tone: 'praise', minRating: 55, maxRating: 72 },
  { text: 'that is how you book a wrestling show', tone: 'praise', minRating: 75 },
  { text: 'rewinding the last twenty minutes. incredible.', tone: 'praise', minRating: 80 },

  // --- the show was bad
  { text: 'two hours i am never getting back', tone: 'criticism', maxRating: 35 },
  { text: 'who is booking this. seriously. who.', tone: 'criticism', maxRating: 40 },
  { text: 'i fell asleep and woke up and it was still going', tone: 'criticism', maxRating: 30 },
  { text: 'genuinely the worst card i have sat through', tone: 'criticism', maxRating: 25 },
  { text: 'fine i guess. nothing i will remember on tuesday.', tone: 'criticism', minRating: 35, maxRating: 58 },
  { text: 'cancel my subscription. again.', tone: 'criticism', maxRating: 32 },

  // --- jokes, any night
  { text: 'somebody just asked why i am yelling at people in trunks. i had no answer.', tone: 'joke' },
  { text: 'the referee counted so slowly i aged', tone: 'joke' },
  { text: 'popcorn was £4. the show was worth less than the popcorn.', tone: 'joke', maxRating: 45 },
  { text: 'guy behind me shouted “BORING” at the national anthem. legend.', tone: 'joke' },
  { text: 'my nephew asked if it was real and i had to sit them down', tone: 'joke' },
  { text: 'i have watched this company for 20 years and i still cannot explain why', tone: 'joke' },
  { text: 'security tackled a guy in a hot dog costume. best part of the night.', tone: 'joke', maxRating: 50 },

  // --- the middle, where most shows actually live
  { text: 'perfectly watchable wrestling show. that is allowed to be enough.', tone: 'praise', minRating: 45, maxRating: 70 },
  { text: 'first hour dragged, second hour delivered', tone: 'praise', minRating: 45, maxRating: 72 },
  { text: 'good show carried by two matches and we all know which two', tone: 'praise', minRating: 50, maxRating: 75 },
  { text: 'the undercard was better than the main event and that is a problem', tone: 'criticism', minRating: 40, maxRating: 70 },
  { text: 'they are so close to something here and keep getting in their own way', tone: 'criticism', minRating: 40, maxRating: 68 },
  { text: 'why is this show three hours long', tone: 'criticism', minRating: 35, maxRating: 75 },
  { text: 'decent card. terrible crowd. dead building.', tone: 'criticism', minRating: 40, maxRating: 70 },

  // --- contrarians, deliberately covering the whole range so there is always
  // somebody in the feed arguing with everybody else
  { text: 'everyone is overreacting. it was fine.', tone: 'contrarian' },
  { text: 'genuinely do not understand this timeline tonight', tone: 'contrarian' },
  { text: 'i am going to be the one person who says it: that was fine', tone: 'contrarian' },
  { text: 'unpopular opinion: tonight was overrated', tone: 'contrarian', minRating: 65 },
  { text: 'you people would boo a five star match if it was on a tuesday', tone: 'contrarian', maxRating: 55 },
  { text: 'i enjoyed that and i am not apologising to this timeline', tone: 'contrarian', maxRating: 55 },
  { text: 'reply guys are out in force tonight and they are all wrong', tone: 'contrarian' },
];

/** About a specific match or wrestler. */
export const MATCH_TWEETS: TweetTemplate[] = [
  { text: '{best} is the best wrestler on this planet and it is not close', tone: 'praise', minRating: 70 },
  { text: 'whatever they are paying {best} it is not enough', tone: 'praise', minRating: 65 },
  { text: '{best} carried that match on their back', tone: 'praise', minRating: 60 },
  { text: 'give {best} the belt. tonight. now.', tone: 'demand', minRating: 65 },
  { text: '{winner} over {loser} was the right call and you all know it', tone: 'praise' },

  { text: '{worst} needs to be sent back to the school', tone: 'criticism', maxRating: 45 },
  { text: 'every time {worst} is on my screen i check my phone', tone: 'criticism', maxRating: 50 },
  { text: '{worst} has been protected for years and i still do not know why', tone: 'criticism', maxRating: 50 },
  { text: 'no disrespect to {worst} but that was rough', tone: 'criticism', maxRating: 42 },

  { text: 'run {winner} vs {loser} again. immediately.', tone: 'demand', minRating: 72 },
  { text: '{loser} deserved better than that finish', tone: 'demand' },
  { text: 'turn {winner} heel already. the crowd is begging.', tone: 'demand' },
  { text: 'PUT THE BELT ON {best}', tone: 'demand', minRating: 60 },
  { text: 'someone please give {loser} something to do', tone: 'demand', maxRating: 55 },

  { text: 'hot take: {worst} was the best thing on this show', tone: 'contrarian', maxRating: 55 },
  { text: 'i am the only person alive who does not care about {best}', tone: 'contrarian', minRating: 65 },
  { text: '{best} is fine. everyone needs to calm down.', tone: 'contrarian' },
  { text: 'leave {worst} alone, they are trying their best out there', tone: 'contrarian' },

  // --- more mid-range so the feed does not run dry on an average night
  { text: '{winner} needed that win more than people realise', tone: 'praise', minRating: 40 },
  { text: '{loser} is being wasted and it is starting to annoy me', tone: 'criticism', maxRating: 72 },
  { text: 'i need {winner} and {loser} to never wrestle each other again', tone: 'demand', maxRating: 55 },
  { text: 'book {best} against somebody who can actually go', tone: 'demand', minRating: 45 },
  { text: '{worst} vs {best} would be a disaster and i want to see it', tone: 'joke' },
  { text: 'they have been doing {winner} vs {loser} since i had hair', tone: 'joke' },
  { text: 'somebody check on {loser}', tone: 'joke', maxRating: 50 },
];

/** When a belt changed hands. */
export const TITLE_CHANGE_TWEETS: TweetTemplate[] = [
  { text: 'NEW CHAMPION. i am not okay. i am not okay.', tone: 'praise' },
  { text: 'they actually did it. {champ} has the {title}.', tone: 'praise' },
  { text: 'putting the {title} on {champ} is a mistake and i will be here in six months to say i told you so', tone: 'criticism' },
  { text: 'about time. {champ} should have had that two years ago.', tone: 'praise' },
  { text: 'so we are just changing the {title} on a random tuesday now', tone: 'criticism' },
  { text: 'my {title} prediction was wrong and i have never been happier', tone: 'joke' },
];

/**
 * A new signee's debut gimmick — {name} the wrestler, {gimmick} the
 * character the booker gave them.
 */
export const GIMMICK_DEBUT_TWEETS: TweetTemplate[] = [
  { text: 'okay {name} as {gimmick} is actually really good', tone: 'praise' },
  { text: '{gimmick}?? say less. i am so in.', tone: 'praise' },
  { text: 'new signing {name} debuting as {gimmick} and i am already invested', tone: 'praise' },
  { text: '{name} deserved better than {gimmick}', tone: 'criticism' },
  { text: '{gimmick} is not going to work and i do not know why nobody told them', tone: 'criticism' },
  { text: 'not {name} coming in as {gimmick} like it is 1987', tone: 'joke' },
  { text: '{gimmick} really said sir this is a wendy\'s', tone: 'joke' },
  { text: 'give {gimmick} six months before you scrap it, i am begging', tone: 'demand' },
  { text: 'everybody hating on {gimmick} and i think it slaps', tone: 'contrarian' },
];

/**
 * A new tag team or faction from the signing meeting — {name} is the
 * group's shared identity, not a person.
 */
export const GIMMICK_PAIRING_TWEETS: TweetTemplate[] = [
  { text: '{name} is going to run this whole division', tone: 'praise' },
  { text: 'finally a tag team that actually makes sense together: {name}', tone: 'praise' },
  { text: '{name} feels rushed. give it time i guess', tone: 'criticism' },
  { text: 'not sure {name} needed to happen but here we are', tone: 'criticism' },
  { text: '{name} coordinated outfits already?? they are not playing', tone: 'joke' },
  { text: 'run {name} straight for the titles', tone: 'demand' },
  { text: '{name} is fine, everyone calm down', tone: 'contrarian' },
];

/**
 * A relaunch out of the forced cold-meeting — {name} the wrestler,
 * {gimmick} the new direction.
 */
export const GIMMICK_RELAUNCH_TWEETS: TweetTemplate[] = [
  { text: '{name} as {gimmick} is the reset they needed', tone: 'praise' },
  { text: 'okay the {gimmick} relaunch actually works', tone: 'praise' },
  { text: '{gimmick} is not fixing whatever the real problem was with {name}', tone: 'criticism' },
  { text: 'another repackage. groundbreaking.', tone: 'criticism' },
  { text: '{name} has had more gimmicks than i have had hot dinners', tone: 'joke' },
  { text: 'commit to {gimmick} for real this time. do not give up in three weeks.', tone: 'demand' },
  { text: 'i kind of miss the old {name} honestly', tone: 'contrarian' },
];

/** Tone words for the summary line above the feed. */
export const CROWD_VERDICTS: { minRating: number; verdict: string }[] = [
  { minRating: 85, verdict: 'The internet has lost its mind, in a good way.' },
  { minRating: 72, verdict: 'They loved it.' },
  { minRating: 58, verdict: 'Mostly positive, with the usual complaints.' },
  { minRating: 45, verdict: 'Split down the middle.' },
  { minRating: 32, verdict: 'Not going down well.' },
  { minRating: 0, verdict: 'They are furious.' },
];
