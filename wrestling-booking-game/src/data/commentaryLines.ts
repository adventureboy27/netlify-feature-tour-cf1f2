// What the two of them say.
//
// Read engine/sim/commentary.ts first; it explains the rules. The short
// version, because it governs every line in this file:
//
//   A colour line may only use a placeholder backed by a fact it declares in
//   `needs`. {manager} requires 'manager'. {title} requires 'title'. {ref}
//   requires 'referee'. If you add a line that mentions something without
//   declaring it, the call will eventually say it about a match where it is
//   not true, and the whole feature stops being worth having.
//
//   Nothing before the finish may reference {winner} or {loser}. Nobody on
//   commentary knows how it ends. Mid-match, the two people you can talk
//   about are {onTop} and {inTrouble}, and the caller hands that advantage
//   over at the moment the match turns.
//
// PLACEHOLDERS
//   {onTop} {onTopPartner}       whoever currently has the advantage
//   {inTrouble} {inTroublePartner}  whoever is currently getting it
//   {sideA} {sideB}              the two corners, before anything has happened
//   {winner} {loser}             finish and wrap-up only
//   {finisher}                   the finisher of whoever is on top
//   {winnerFinisher}             finish only
//   {play} {colour}              the two announcers, by name
//   {manager} {managerClient}    needs 'manager'
//   {ref} {refMiss}              needs 'referee' / 'refereeMiss'
//   {guestRef}                   needs 'guestReferee'
//   {title} {champion} {reign}   needs 'title' / 'titleRetained' / 'longReign'
//   {hurt} {hurtHow}             needs 'injuredInMatch'
//   {hurtComingIn}               needs 'carryingInjury'
//   {incident}                   needs 'incident'
//   {stip}                       needs 'stipulation'. A bare noun phrase with
//                                no article and sometimes the word "Match"
//                                already in it — "Steel Cage", "Tables
//                                Match", "Hair vs Hair". So never write "a
//                                {stip}" or "{stip} match": that produced
//                                "this is Tables Match" and "in a Tables
//                                Match match". "Under {stip} rules" and a
//                                bare "{stip}." both work for all of them.
//   {vet} {rookie}               needs 'veteran' / 'rookie'
//   {big} {small}                needs 'sizeGap'
//   {town}                       always known — the building we are in
//   {formerChamp} {formerTitle}  needs 'formerChampion'
//   {otherChamp} {otherBelt}     needs 'reigningElsewhere'
//   {streaking}                  needs 'onATear'
//   {slumping}                   needs 'slumping'
//   {debutant}                   needs 'debut'
//   {secondGen} {secondGenParent} needs 'secondGeneration'
//   {timesMet}                   needs 'metOften'
//   {feudWeeks} {feudMatches}    needs 'longFeud'
//   {weather}                    needs 'weatherHurtGate'
//   {tearRun} {slumpRun}         needs 'onATear' / 'slumping'
//   {oldHand} {oldHandYears}     needs 'longCareer'

import type { CommentaryFact, Speaker } from '../engine/sim/commentary';
import type { MatchBeatKind } from '../engine/types';

/** Which way the colour man leans, and therefore what he is willing to say. */
export type Leaning = 'heel' | 'face' | 'analyst';

export interface ColourTemplate {
  text: string;
  /** Every one of these must be true of the match, or the line is not said. */
  needs: CommentaryFact[];
  /** Only after these beats. Omitted means anywhere in the body. */
  after?: MatchBeatKind[];
  /** Only from a colour man who leans this way. */
  leaning?: Leaning;
  /** Worth arguing with — the play-by-play man may answer it. */
  provocative?: boolean;
  /** For pools where either of them might say it. */
  speaker?: Speaker;
}

// ---------------------------------------------------------------------------
// Play-by-play — the action, in the present tense, from the man whose job is
// to say what is happening.
// ---------------------------------------------------------------------------

export const PLAY_BY_PLAY: Partial<Record<MatchBeatKind, readonly string[]>> = {
  openingExchange: [
    'And they lock up. Neither one of them giving an inch early.',
    'Collar and elbow to start, and {onTop} backs {inTrouble} into the corner.',
    'They circle. {inTrouble} goes for the leg, {onTop} sprawls out of it.',
    'A shove from {onTop}. {inTrouble} shoves back harder, and here we go.',
    'Feeling-out process early, both of them working the wristlock.',
    'No handshake. Straight into it — {onTop} with the first real strike.',
    'Off the ropes, shoulder block, and {inTrouble} goes down hard.',
    'Chain wrestling to open, and neither one can hold an advantage for long.',
  ],
  control: [
    '{onTop} takes over now. Stomps in the corner and the referee is counting.',
    '{onTop} grounds {lowThem}. Wearing {inTrouble} down, taking {topTheir} time about it.',
    'A hard whip into the corner and {inTrouble} folds up on impact.',
    '{onTop} has the arm and {topThey} is not letting go of it.',
    'Right hands. One after another, and {inTrouble} has nowhere to go.',
    '{onTop} drives a knee into the midsection and {inTrouble} drops to a knee.',
    '{Top} is picking {lowThem} apart. {onTop} in complete control here.',
    'Elbow. Elbow. Another one. {inTrouble} is in serious trouble.',
    '{onTop} slows it right down — a chinlock, and the crowd does not like it.',
    'Backbreaker, and {onTop} holds {lowThem} there across the knee.',
  ],
  hopeSpot: [
    '{onTop} fires back! Out of nowhere!',
    'Wait — {onTop} ducks under and catches {lowThem} coming in!',
    '{Top} is up! {onTop} is up and the building is coming with {topThem}!',
    '{onTop} blocks it, blocks it again, and now the right hands are {topTheir}!',
    'Reversal! {onTop} sends {lowThem} across and follows in behind!',
    'Out of nothing — {onTop} catches the foot and turns it into a takedown!',
    '{onTop} will not stay down. {Top} is on {topTheir} feet and {topThey} is throwing bombs!',
  ],
  nearFall: [
    'Cover — one, two, and {inTrouble} gets the shoulder up!',
    'ONE, TWO — no! How is {lowThey} still in this?',
    '{Top} hooks the leg — two and a half! That was as close as it gets.',
    'Cover, and {inTrouble} kicks out at the very last instant!',
    'One! Two! Th— no! I thought that was it.',
    'That has to be it — no! {inTrouble} is still alive!',
  ],
  signature: [
    '{onTop} up top now. {Top} is going to fly.',
    '{Top} is setting up for {finisher}. This could be it.',
    '{onTop} lifts {lowThem} up — and drives {lowThem} straight through the mat!',
    'Off the top rope and {topThey} connects flush! Nobody is moving.',
    '{Top} is calling for it. {onTop} is calling for the end.',
    'What a shot! {onTop} caught {lowThem} square and {inTrouble} went down like a bag of sand.',
  ],
  interference: [
    'Hang on — somebody else is out here. This is falling apart.',
    'There is a body on the apron and the referee has lost sight of the match.',
    'Now it has broken down entirely. Bodies everywhere.',
  ],
  finish: [
    '{winnerFinisher}! Cover — one, two, three! It is over!',
    'That is it! {winner} gets the three and this one is finished!',
    'One, two, three — {winner} has done it!',
    '{Win} hooks the leg and gets it! {winner} wins it!',
    '{winner} put {loseThem} away, and {loser} has no answer for it.',
    'It is over. {winner} stands, {loser} does not.',
  ],
};

// ---------------------------------------------------------------------------
// The opening. Always the play-by-play man, always naming who is in there.
// ---------------------------------------------------------------------------

export const OPENERS: readonly ColourTemplate[] = [
  { text: 'Here we go — {sideA} and {sideB}, and this crowd is ready.', needs: ['hotCrowd'] },
  { text: 'Our main event of the evening: {sideA} against {sideB}.', needs: ['mainEvent'] },
  {
    text: 'Main event time, and there is a championship on the line — {sideA} and {sideB} for the {title}.',
    needs: ['mainEvent', 'title'],
  },
  { text: 'And it is for the {title}. {sideA}, {sideB}, and one of them leaves with it.', needs: ['title'] },
  { text: '{stip} rules here tonight, and it is {sideA} against {sideB}.', needs: ['stipulation'] },
  {
    text: 'These two do not like each other, folks. {sideA} and {sideB}, and this is not going to be pretty.',
    needs: ['grudge'],
  },
  { text: '{sideA} and {sideB}. Referee {ref} calls for the bell.', needs: ['referee'] },
  {
    text: 'Live from {town} tonight — {sideA} squaring off against {sideB}.',
    needs: [],
  },
  {
    text: 'This is the one they paid for. {sideA} and {sideB}, here in {town}.',
    needs: ['bigShow'],
  },
  {
    text: 'This settles it. {sideA} and {sideB}, and after tonight there is nothing left to argue about.',
    needs: ['blowoff'],
  },
  {
    text: 'Debut night. {debutant} has never worked a match for this company, and starts against {sideB}.',
    needs: ['debut'],
  },
  {
    text: 'That name should sound familiar — {secondGen}, and yes, that is {secondGenParent}\u2019s kid.',
    needs: ['secondGeneration'],
  },
  { text: 'Up next: {sideA} taking on {sideB}, right here.', needs: [] },
  { text: 'The bell rings — {sideA} and {sideB}, right in the middle of this ring.', needs: [] },
];

// ---------------------------------------------------------------------------
// The stakes. The colour man's first job is to say why this matters, and
// there is only anything to say when something is actually at stake.
// ---------------------------------------------------------------------------

export const STAKES: readonly ColourTemplate[] = [
  {
    text: '{champion} has held that belt {reign} weeks, {play}. Nobody has come close in all that time.',
    needs: ['longReign'],
  },
  {
    text: 'I called {secondGenParent}\u2019s matches for years, {play}. Now I am calling the kid\u2019s. That is what this business does to you.',
    needs: ['secondGeneration'],
    leaning: 'analyst',
  },
  {
    text: 'There is a weight to carrying a name like that. {secondGen} did not ask for it and cannot put it down either.',
    needs: ['secondGeneration'],
    leaning: 'analyst',
  },
  {
    text: 'And a title changes everything. You wrestle differently when you have something to lose.',
    needs: ['title'],
    leaning: 'analyst',
  },
  {
    text: 'I will say this for the champion — that belt was not stolen. It was earned.',
    needs: ['titleRetained'],
    leaning: 'face',
  },
  {
    text: 'This is not a wrestling match, {play}. This is a fight, and it has been coming for months.',
    needs: ['grudge'],
  },
  {
    text: '{manager} is out here with {managerClient}, and has never been at ringside for an honest three-count.',
    needs: ['deviousManager'],
    leaning: 'face',
    provocative: true,
  },
  {
    text: 'Look at {manager} down there. That is a professional at work, {play}, and I will not apologise for admiring it.',
    needs: ['deviousManager'],
    leaning: 'heel',
    provocative: true,
  },
  {
    text: '{manager} in the corner, and a good manager is worth ten pounds of muscle. Watch the difference it makes.',
    needs: ['manager'],
    leaning: 'analyst',
  },
  {
    text: '{hurtComingIn} should not be in this building tonight, never mind in that ring.',
    needs: ['carryingInjury'],
  },
  {
    text: 'Under {stip} rules, half of what you know about wrestling goes out the window.',
    needs: ['stipulation'],
  },
  {
    text: 'For anybody just joining us: {stip}. That is what these two asked for.',
    needs: ['stipulation'],
  },
  {
    text: '{stip}. I have called a lot of these and somebody always gets hurt.',
    needs: ['stipulation'],
  },
  {
    text: 'They asked for {stip} and they got it. Whatever happens now, they asked for it.',
    needs: ['stipulation', 'grudge'],
  },
  {
    text: 'A {oldHandYears}-year man under {stip} rules. At some point the body says no.',
    needs: ['stipulation', 'longCareer'],
  },
  {
    text: 'Look at the size of {big} next to {small}. That is not a fair fight on paper.',
    needs: ['sizeGap'],
  },
  { text: '{rookie} is a baby in this business, in there with a wolf.', needs: ['rookie'] },
  { text: 'Listen to this place. They are up for this one already.', needs: ['hotCrowd'] },

  // --- who they are, before a hand has been laid on anybody ---------------
  {
    text: '{formerChamp} used to carry the {formerTitle}, {play}. People forget that.',
    needs: ['formerChampion'],
  },
  {
    text: 'A former {formerTitle} holder in there tonight. {formerChamp} has been at the top of this company before and wants it back.',
    needs: ['formerChampion'],
  },
  {
    text: '{otherChamp} is the {otherBelt} holder and it is not even on the line here. Wrestling for nothing but pride.',
    needs: ['reigningElsewhere'],
  },
  {
    text: '{streaking} has not lost in weeks. Whatever is going on there, it is working.',
    needs: ['onATear'],
  },
  {
    text: 'That is {tearRun} straight for {streaking}, {play}. Nobody has come close.',
    needs: ['onATear'],
  },
  {
    text: '{oldHandYears} years {oldHand} has been doing this. {oldHandYears} years, and still here.',
    needs: ['longCareer'],
  },
  {
    text: 'You are looking at {oldHandYears} years of this business standing in that corner.',
    needs: ['longCareer'],
  },
  {
    text: 'A {oldHandYears}-year veteran against somebody who has never worked a match here. That is the whole of wrestling in one picture.',
    needs: ['longCareer', 'debut'],
  },
  {
    text: '{slumping} cannot buy a win at the moment, {play}. This one is needed badly.',
    needs: ['slumping'],
  },
  {
    text: '{slumpRun} in a row {slumping} has dropped now. You start to wonder what is going on there.',
    needs: ['slumping'],
  },
  {
    text: 'On a {slumpRun}-match losing run and now this. It does not get easier.',
    needs: ['slumping'],
  },
  {
    text: 'These two have never been in a ring together. Not once, in all this time.',
    needs: ['firstMeeting'],
  },
  {
    text: 'They have met {timesMet} times now and neither one has settled it.',
    needs: ['metOften'],
  },
  {
    text: 'This has been going on {feudWeeks} weeks, {play}. It has to end sometime.',
    needs: ['longFeud'],
  },
  {
    text: 'Whatever happens tonight, that is the end of it. This is the blow-off.',
    needs: ['blowoff'],
  },

  // --- the night itself ---------------------------------------------------
  {
    text: 'Half of {town} stayed home tonight and you cannot blame them — {weather} out there.',
    needs: ['weatherHurtGate'],
  },
  {
    text: 'A lot of empty seats in {town}, {play}, and that is the {weather} rather than the card.',
    needs: ['weatherHurtGate'],
  },
  {
    text: 'Thin house in {town} tonight. These two deserve better than this.',
    needs: ['flatCrowd'],
  },
  {
    text: 'They are hanging off the rafters in {town} tonight.',
    needs: ['hotCrowd', 'bigShow'],
  },
  {
    text: 'A debut is the hardest night of anybody\u2019s career. Everything {debutant} does from here, they will remember this first.',
    needs: ['debut'],
  },
];

// ---------------------------------------------------------------------------
// Colour. Every one of these is gated on something being true.
// ---------------------------------------------------------------------------

export const COLOUR: readonly ColourTemplate[] = [
  // --- the manager -------------------------------------------------------
  {
    text: '{manager} is up on the apron again. {ref} has to deal with that.',
    needs: ['manager', 'referee'],
    after: ['control', 'nearFall'],
  },
  {
    text: 'Watch {manager} — every time {ref} turns away, that is when the move comes.',
    needs: ['deviousManager', 'referee'],
    provocative: true,
  },
  {
    text: 'That is coaching, {play}. {manager} is calling exactly where to go, and that is where it goes.',
    needs: ['manager'],
    after: ['control', 'signature'],
    leaning: 'analyst',
  },
  {
    text: '{manager} has not stopped shouting since the bell. I would pay money for five minutes of quiet.',
    needs: ['manager'],
    provocative: true,
  },
  {
    text: 'And {manager} is loving this. Look at that.',
    needs: ['manager'],
    after: ['control'],
    leaning: 'heel',
  },
  {
    text: 'Somebody get {manager} away from that ring. That is a participant at this point.',
    needs: ['deviousManager'],
    leaning: 'face',
    provocative: true,
  },

  // --- the official ------------------------------------------------------
  {
    text: '{ref} is losing this one, {play}. A step behind since the bell.',
    needs: ['referee'],
    after: ['control', 'nearFall'],
    provocative: true,
  },
  {
    text: 'That was a slow count. {ref} was miles behind that.',
    needs: ['referee'],
    after: ['nearFall'],
    provocative: true,
  },
  {
    // A pass-through, like {incident}: the miss already has its own written
    // sentence, and it already names the official. Embedding it in a frame
    // produced "Dennis Poole Wherever the action was, Dennis Poole was
    // somewhere else... He did not see a thing." — the name twice and two
    // full stops. The colour man relays it and the reaction lines below do
    // the reacting.
    text: '{refMiss}',
    needs: ['refereeMiss'],
    provocative: true,
  },
  {
    text: 'You cannot officiate what you cannot see, and {ref} was on the wrong side of the ring.',
    needs: ['refereeMiss'],
    leaning: 'analyst',
  },
  {
    text: 'That is twice now. Somebody in the back needs a word with {ref}.',
    needs: ['refereeMiss'],
    provocative: true,
  },
  {
    text: 'If you are wrestling tonight and {ref} has your match, you are on your own out there.',
    needs: ['refereeMiss'],
  },
  {
    text: 'I am not blaming {ref}. It happens fast and there is only one official out there.',
    needs: ['refereeMiss'],
    leaning: 'analyst',
    provocative: true,
  },
  {
    text: 'And nobody will remember that except the man it happened to.',
    needs: ['refereeMiss'],
    after: ['nearFall', 'signature'],
  },
  {
    text: '{oldHandYears} years in this business and {oldHand} still knows exactly when to do that.',
    needs: ['longCareer'],
    after: ['hopeSpot', 'signature'],
    leaning: 'analyst',
  },
  {
    text: 'You do not last {oldHandYears} years by being brave, {play}. You last by being clever.',
    needs: ['longCareer'],
    after: ['control', 'nearFall'],
  },
  {
    text: '{tearRun} wins on the bounce, and it shows in every move out there.',
    needs: ['onATear'],
    after: ['control', 'signature'],
  },
  {
    text: 'That is what {slumpRun} straight losses does to somebody. The trust is gone.',
    needs: ['slumping'],
    after: ['nearFall', 'control'],
  },
  {
    text: 'And that is why you do not put a wrestler in the shirt. {guestRef} has a horse in this race.',
    needs: ['guestReferee'],
    provocative: true,
  },
  {
    text: '{guestRef} counted that one quick. Very quick.',
    needs: ['guestReferee'],
    after: ['nearFall'],
    leaning: 'face',
  },

  // --- the championship --------------------------------------------------
  {
    text: 'And remember what is hanging over this ring — the {title}.',
    needs: ['title'],
    after: ['nearFall', 'signature'],
  },
  {
    text: 'That nearly cost {champion} the {title} right there.',
    needs: ['titleRetained'],
    after: ['nearFall'],
  },
  {
    text: '{reign} weeks with that belt and I have never seen the champion in trouble like this.',
    needs: ['longReign'],
    after: ['nearFall', 'hopeSpot'],
  },
  {
    text: 'You do not get many shots at the {title}. You take the one you get.',
    needs: ['title'],
    after: ['hopeSpot'],
    leaning: 'analyst',
  },

  // --- somebody is hurt --------------------------------------------------
  {
    text: 'That is not selling, {play}. {hurt} is genuinely hurt.',
    needs: ['injuredInMatch'],
    after: ['control', 'signature'],
  },
  {
    text: '{hurtHow} — and still trying to get up. That is somebody who should be staying down.',
    needs: ['injuredInMatch'],
  },
  {
    text: 'Somebody is getting beaten up tonight and it is {hurt}. This has stopped being a wrestling match.',
    needs: ['injuredInMatch'],
    after: ['control'],
  },
  {
    text: '{hurtComingIn} came in here carrying something and now they are working it. Of course they are.',
    needs: ['carryingInjury'],
    after: ['control'],
  },
  {
    text: 'That is the leg {hurtComingIn} has been favoring all month. This is deliberate.',
    needs: ['carryingInjury'],
    after: ['control', 'signature'],
    leaning: 'analyst',
  },
  {
    text: 'Good. You find the injury and you live on it. That is the business.',
    needs: ['carryingInjury'],
    leaning: 'heel',
    provocative: true,
  },

  // --- bad blood ---------------------------------------------------------
  {
    text: 'There is nothing professional about this any more. They are trying to hurt each other.',
    needs: ['grudge'],
    after: ['control', 'signature'],
  },
  {
    text: 'Those punches are closed fists, {play}. Nobody is pulling anything.',
    needs: ['grudge'],
    provocative: true,
  },
  {
    text: 'This stopped being about winning about ten minutes ago.',
    needs: ['grudge'],
    after: ['nearFall'],
  },

  // --- the gimmick -------------------------------------------------------
  {
    text: 'And under {stip} rules there is nothing {ref} can do about that.',
    needs: ['stipulation', 'referee'],
    after: ['control', 'signature'],
  },
  {
    text: 'This is exactly what {stip} does to people. It takes the wrestling out of them.',
    needs: ['stipulation'],
    after: ['control'],
    leaning: 'analyst',
  },

  // --- size and age ------------------------------------------------------
  {
    text: '{small} cannot match {big} for power, and will have to be smarter than that.',
    needs: ['sizeGap', 'smallInTrouble'],
    after: ['control'],
    leaning: 'analyst',
  },
  {
    text: 'Every pound of that size difference is showing right now.',
    needs: ['sizeGap'],
    after: ['control'],
  },
  {
    text: '{vet} has been doing this for twenty years. No panic in that position.',
    needs: ['veteran', 'vetInTrouble'],
    after: ['control', 'nearFall'],
    leaning: 'analyst',
  },
  {
    text: 'There is a lot of mileage on {vet}, {play}. A body only takes so much.',
    needs: ['veteran', 'vetInTrouble'],
    after: ['control'],
  },
  {
    text: '{rookie} is learning something tonight, and the lesson is expensive.',
    needs: ['rookie', 'rookieInTrouble'],
    after: ['control'],
  },
  {
    text: 'Green as grass, {rookie}, but the heart is there. You cannot teach that.',
    needs: ['rookie'],
    after: ['hopeSpot'],
    leaning: 'face',
  },

  // --- the room ----------------------------------------------------------
  {
    text: 'Listen to this building. They are on their feet.',
    needs: ['hotCrowd'],
    after: ['hopeSpot', 'nearFall', 'signature'],
  },
  {
    text: 'You can hear individual people out there, {play}. That is not a good sign.',
    needs: ['flatCrowd'],
    after: ['control'],
    provocative: true,
  },
  {
    text: 'This one has been a hell of a match and we are not close to done.',
    needs: ['greatMatch'],
    after: ['nearFall', 'signature'],
  },
  {
    text: 'I have seen better on a wet Tuesday in a school gym.',
    needs: ['poorMatch'],
    after: ['control'],
    provocative: true,
  },

  // --- something nobody booked -------------------------------------------
  { text: '{incident}', needs: ['incident'] },
  {
    text: 'What was that? Did you see that, {play}? Neither did I, properly.',
    needs: ['incident'],
    after: ['signature', 'nearFall'],
  },

  // --- it broke down ------------------------------------------------------
  {
    text: 'This has gone completely off the rails. There are people out here who do not belong.',
    needs: ['interference'],
    after: ['signature', 'nearFall'],
  },

  // --- careers, mid-match -------------------------------------------------
  {
    text: 'Been here before, {play}. {formerChamp} held the {formerTitle} and knows exactly what this feels like.',
    needs: ['formerChampion'],
    after: ['nearFall', 'signature'],
  },
  {
    text: 'That is championship experience. You do not learn that anywhere but at the top.',
    needs: ['formerChampion'],
    after: ['hopeSpot'],
    leaning: 'analyst',
  },
  {
    text: '{otherChamp} is a champion in this company and is being made to look ordinary.',
    needs: ['reigningElsewhere'],
    after: ['control'],
    provocative: true,
  },
  {
    text: 'This is what a run of form does. {streaking} believes this one is already won.',
    needs: ['onATear'],
    after: ['hopeSpot', 'signature'],
  },
  {
    text: 'You can see it in {slumping}. Stopped expecting anything to go the right way.',
    needs: ['slumping'],
    after: ['control', 'nearFall'],
  },
  {
    text: 'That is nerves, {play}. {debutant} has never had a crowd like this in front of them.',
    needs: ['debut'],
    after: ['control'],
  },
  {
    text: 'Not bad for a first night. {debutant} belongs in there.',
    needs: ['debut'],
    after: ['hopeSpot', 'nearFall'],
    leaning: 'face',
  },
  {
    text: 'That is the family timing. You cannot teach it — {secondGen} grew up in a locker room.',
    needs: ['secondGeneration'],
    after: ['signature', 'hopeSpot'],
    leaning: 'face',
  },
  {
    text: 'The crowd is behind {secondGen} because of the surname, {play}. They will stay for what gets done with it.',
    needs: ['secondGeneration'],
    after: ['nearFall', 'control'],
    leaning: 'analyst',
  },
  {
    text: '{secondGenParent} never got caught like that. Says everything about the kid.',
    needs: ['secondGeneration'],
    after: ['control'],
    provocative: true,
    leaning: 'heel',
  },

  // --- what has already happened between them -----------------------------
  {
    text: 'Neither of them has an answer for the other, because neither of them has seen the other do this before.',
    needs: ['firstMeeting'],
    after: ['nearFall', 'signature'],
    leaning: 'analyst',
  },
  {
    text: '{timesMet} matches and they still fell for that. You would think somebody would learn.',
    needs: ['metOften'],
    after: ['signature', 'nearFall'],
    provocative: true,
  },
  {
    text: 'They know each other far too well. Every counter is a counter to a counter.',
    needs: ['metOften'],
    after: ['control', 'hopeSpot'],
    leaning: 'analyst',
  },
  {
    text: '{feudWeeks} weeks of this and it comes down to who wants it more.',
    needs: ['longFeud'],
    after: ['nearFall'],
  },
  {
    text: 'Nobody walks away from a blow-off happy. One of them leaves here with nothing.',
    needs: ['blowoff'],
    after: ['nearFall', 'signature'],
  },

  // --- the room and the night ---------------------------------------------
  {
    text: 'The ones who did make it through the {weather} are getting their money back on this.',
    needs: ['weatherHurtGate', 'greatMatch'],
    after: ['nearFall', 'signature'],
  },
  {
    text: 'Three thousand people should be watching this, {play}, and there are not three thousand people in {town} tonight.',
    needs: ['weatherHurtGate'],
    after: ['signature', 'nearFall'],
  },
  {
    text: '{town} is on its feet, and it takes a lot to get {town} on its feet.',
    needs: ['hotCrowd'],
    after: ['signature'],
  },
  {
    text: 'This is a pay-per-view. You do not get to have an off night on a pay-per-view.',
    needs: ['bigShow', 'poorMatch'],
    after: ['control'],
    provocative: true,
  },

  // --- tag ----------------------------------------------------------------
  {
    text: '{inTrouble} needs to make the tag. {inTroublePartner} has a hand out and it is inches away.',
    needs: ['tagMatch'],
    after: ['control'],
  },
  {
    text: 'Great tag team wrestling, that. {onTop} and {onTopPartner} are cutting the ring in half.',
    needs: ['tagMatch'],
    after: ['control', 'signature'],
    leaning: 'analyst',
  },
];

// ---------------------------------------------------------------------------
// The play-by-play man answering back. Only ever fires after a line marked
// provocative, so it always has something to be answering.
// ---------------------------------------------------------------------------

export const COMEBACKS: readonly ColourTemplate[] = [
  { text: 'You would say that, {colour}.', needs: [] },
  { text: 'That is a disgraceful thing to say and you know it.', needs: [] },
  { text: 'I am not sure the people in this building agree with you, {colour}.', needs: [] },
  { text: 'You have been defending that all night.', needs: [], leaning: 'heel' },
  { text: 'All right, all right. Back to the match.', needs: [] },
  { text: 'I will give you that one, {colour}. Just that one.', needs: [] },
  { text: 'Will you listen to yourself?', needs: [], leaning: 'heel' },
  { text: 'Say what you like, it is working.', needs: [], leaning: 'analyst' },
];

// ---------------------------------------------------------------------------
// The wrap. What it meant, said once the bell has gone.
// ---------------------------------------------------------------------------

export const CLOSERS: readonly ColourTemplate[] = [
  {
    text: 'New champion! I do not believe it — the {title} has a new holder.',
    needs: ['titleChange'],
    speaker: 'play',
  },
  {
    text: 'And {champion} walks out of here still carrying the {title}.',
    needs: ['titleRetained'],
  },
  {
    text: 'Nobody saw that coming, {play}. Nobody in this building had {winner} winning that.',
    needs: ['upset'],
  },
  {
    text: 'That is not over. Whatever that was, it is not over.',
    needs: ['grudge'],
  },
  {
    text: 'And {loser} is still down. We need somebody out here.',
    needs: ['injuredInMatch'],
  },
  {
    text: 'They will be talking about that one for a long time.',
    needs: ['greatMatch'],
  },
  {
    text: '{winner} won it, and {manager} is already in the ring celebrating like it was their doing.',
    needs: ['manager'],
  },
  {
    text: 'A win is a win. It does not have to be pretty and that certainly was not.',
    needs: ['poorMatch'],
    leaning: 'heel',
  },
  {
    text: 'Listen to that reaction. That is what this business is for.',
    needs: ['hotCrowd', 'greatMatch'],
  },
  {
    text: 'I hope {ref} is proud of what got allowed out here.',
    needs: ['refereeMiss'],
    leaning: 'face',
  },
  {
    text: 'A former {formerTitle} holder, right back in the conversation after that.',
    needs: ['formerChampion'],
  },
  {
    text: 'And that is {feudWeeks} weeks settled in about fifteen minutes.',
    needs: ['longFeud'],
  },
  {
    text: 'It is finished. Whatever they had, it ends here, and one of them has to live with it.',
    needs: ['blowoff'],
  },
  {
    text: 'The people who stayed home tonight because of the {weather} are going to hear about this one.',
    needs: ['weatherHurtGate'],
  },
  {
    text: 'What a way to start a career. {debutant} will not forget {town}.',
    needs: ['debut'],
  },
  {
    text: 'That is the run over. {streaking} could not make it stand up.',
    needs: ['onATear'],
  },
  {
    text: '{slumping} needed that more than anybody in this building knows.',
    needs: ['slumping'],
  },
];

// ---------------------------------------------------------------------------
// The last word. Rare, and only when the night has earned one.
// ---------------------------------------------------------------------------

export const BANTER: readonly ColourTemplate[] = [
  {
    text: 'Twenty years I have been doing this, {colour}, and that is in the top ten.',
    needs: ['greatMatch'],
    speaker: 'play',
  },
  {
    text: 'I have nothing bad to say. That is the first time all night.',
    needs: ['greatMatch'],
    speaker: 'colour',
    leaning: 'heel',
  },
  {
    text: 'Main event of the evening, and it delivered every bit of it.',
    needs: ['mainEvent', 'greatMatch'],
    speaker: 'play',
  },
  {
    text: 'Get me a drink, {play}.',
    needs: ['grudge', 'greatMatch'],
    speaker: 'colour',
  },
  {
    text: 'We are out of time. What a way to go off the air.',
    needs: ['mainEvent', 'hotCrowd'],
    speaker: 'play',
  },
  {
    text: 'For everybody who braved the {weather} to be here in {town} — thank you. Goodnight.',
    needs: ['weatherHurtGate', 'mainEvent'],
    speaker: 'play',
  },
  {
    text: 'Every one of those {feudMatches} matches was leading here, {colour}. Every single one.',
    needs: ['longFeud', 'mainEvent'],
    speaker: 'play',
  },
];
