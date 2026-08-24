// The things that happen to people between shows.
//
// A wrestler's week did not exist. They were healthy or they were hurt, and
// the only thing that could change either was a match — so nothing ever
// happened to anybody on a Tuesday. The business does not work like that:
// people get hurt in the gym, in cars, in bars and in the corridor outside
// the locker room, and people miss shows for reasons that have nothing to do
// with wrestling at all.
//
// The dice are heavily weighted toward the boring end, which is the whole
// point: most weeks nothing happens to anybody. A blown tire comes up often;
// somebody getting jumped in the parking lot is rare, and being hit by a car
// is rarer still. A lot of sides of the die are small.
//
// Every one of these gets reported and says how it happened — CLAUDE.md's
// hardest rule. Nobody vanishes off a card without a sentence.

export type MisfortuneKind =
  /** They will not be in the building. Whatever they were booked in goes on without them. */
  | 'absence'
  /** Hurt away from the ring. */
  | 'injury'
  /** Something that was already wrong got worse. */
  | 'aggravation';

export interface MisfortuneDefinition {
  id: string;
  kind: MisfortuneKind;
  /** The label above it in the newsfeed. */
  label: string;
  /** Against everything else that could have happened. Higher is commoner. */
  weight: number;
  /** `{name}` is substituted. Several so the same thing reads differently. */
  lines: string[];
  /** Injuries and aggravations only: roughly how long, before the usual swing. */
  weeks?: [number, number];
  /** 'injured' entries can only land on somebody already hurt, and vice versa. */
  requires: 'healthy' | 'injured';
  /**
   * Somebody attacked in the building implicates another wrestler, and that
   * is how a night nobody booked becomes a feud.
   */
  impliesAttacker?: boolean;
  /**
   * Only drawn for a wrestler whose whole weekly ask sits under
   * settings.dayJobWageThreshold — see world/misfortune.ts's
   * rollDayJobAbsence, a separate roll from the ordinary one below. Nobody
   * on real money ever draws from this pool.
   */
  dayJob?: boolean;
}

export const MISFORTUNES: MisfortuneDefinition[] = [
  // --- Missing the show. The common, cheap end of the die. ----------------
  {
    id: 'carTrouble',
    kind: 'absence',
    label: 'No-show',
    weight: 30,
    requires: 'healthy',
    lines: [
      '{name} is stuck on the shoulder ninety miles out, hood up, going nowhere fast.',
      "{name}'s car gave up the ghost in a gas station parking lot, and the tow truck is a good two hours out.",
      '{name} blew a tire wide open on the interstate, and there is no spare waiting in the trunk.',
      "{name}'s car cooked itself right there on the on-ramp, and traffic is not moving an inch.",
    ],
  },
  {
    id: 'missedFlight',
    kind: 'absence',
    label: 'No-show',
    weight: 26,
    requires: 'healthy',
    lines: [
      '{name} is parked in an airport four states away, staring down a departures board that will not budge.',
      "{name}'s connection got canceled outright, and there is nothing else flying out tonight.",
      '{name} made it all the way to the gate — and watched it close anyway.',
      "{name}'s flight sat grounded on the tarmac for two straight hours and blew right through the window.",
    ],
  },
  {
    id: 'weatheredIn',
    kind: 'absence',
    label: 'No-show',
    weight: 18,
    requires: 'healthy',
    lines: [
      '{name} is completely snowed in tonight, and every road out of town is closed.',
      '{name} sat six hours in dead-stopped traffic behind an overturned truck and never got within a hundred miles.',
      'The whole county is under a storm warning tonight, and {name} never even left the hotel room.',
      "{name}'s only road out of town has been underwater since this morning.",
    ],
  },
  {
    id: 'foodPoisoning',
    kind: 'absence',
    label: 'No-show',
    weight: 14,
    requires: 'healthy',
    lines: [
      '{name} has not left the hotel bathroom since lunchtime, and is not about to start now.',
      '{name} ate at the exact same place as everybody else on the roster — and somehow was the only one it got.',
      "{name} has been flat on a hospital bed hooked to an IV since this morning.",
      "Whatever was in that gas-station sandwich, {name} is paying for it in full tonight.",
    ],
  },
  {
    id: 'overslept',
    kind: 'absence',
    label: 'No-show',
    weight: 12,
    requires: 'healthy',
    lines: [
      '{name} slept clean through the alarm, the wake-up call, and four different phones going off.',
      "Nobody has been able to raise {name} all day long. The hotel says the room has not even been touched.",
      "{name} rolled in at five this morning and simply never woke back up.",
      "{name} set the alarm for the wrong time zone entirely, and found out about it three hours too late.",
    ],
  },
  {
    id: 'familyEmergency',
    kind: 'absence',
    label: 'No-show',
    weight: 10,
    requires: 'healthy',
    lines: [
      '{name} took a phone call at six this morning and turned the car around without a second thought.',
      '{name} is sitting at a hospital bedside tonight, and it is not their own.',
      '{name} is on a plane home right now, for a reason nobody in this office is willing to ask about out loud.',
      "{name} left a message that just said 'family thing, I'll explain later,' and switched the phone off cold.",
    ],
  },
  {
    id: 'paperwork',
    kind: 'absence',
    label: 'No-show',
    weight: 7,
    requires: 'healthy',
    lines: [
      '{name} is sitting at the border tonight over paperwork nobody bothered to check.',
      "{name}'s visa never came through, and the promoter only found out about it this morning.",
      "{name}'s work permit quietly expired last week, and nobody on the booking side caught it.",
      'Customs pulled {name} aside for a random check, and this is turning into anything but quick.',
    ],
  },
  {
    id: 'lockedUp',
    kind: 'absence',
    label: 'No-show',
    weight: 4,
    requires: 'healthy',
    lines: [
      '{name} is spending tonight in a holding cell over something that started, of all places, in a hotel bar.',
      '{name} got picked up on the way to the building tonight and has not been released since.',
      '{name} is out on bail as of tonight, and the lawyer is telling everybody in the building to stop asking questions.',
      'Whatever happened at that bar last night, {name} is explaining it to a desk sergeant as we speak.',
    ],
  },
  {
    id: 'jumpedInTheBack',
    kind: 'absence',
    label: 'Attacked',
    weight: 5,
    requires: 'healthy',
    impliesAttacker: true,
    lines: [
      '{name} was found flat out by the production cases just twenty minutes before the doors opened tonight.',
      '{name} got jumped cold in the corridor outside the locker room, and not one soul in this building saw who did it.',
      '{name} was attacked walking in through the parking lot tonight, and there are no cameras out there to say who.',
      '{name} turned up in a stairwell nobody uses, and nobody backstage is saying a word about who found them there.',
    ],
  },

  // --- The day job wins. Only ever drawn for wrestlers who are not making a
  // living at this — see rollDayJobAbsence and settings.dayJobWageThreshold.
  {
    id: 'heldLateAtWork',
    kind: 'absence',
    label: 'No-show',
    weight: 24,
    requires: 'healthy',
    dayJob: true,
    lines: [
      "{name}'s manager would not let the shift end on time, and there was no getting to the building after that.",
      '{name} got asked to close again tonight, and a promise to a boss beats a promise to a promoter.',
      "{name} is still behind the register three hours after they were supposed to clock out.",
      '{name} begged off the closing shift and got told no. The rent gets paid either way.',
    ],
  },
  {
    id: 'noOneToCoverTheShift',
    kind: 'absence',
    label: 'No-show',
    weight: 20,
    requires: 'healthy',
    dayJob: true,
    lines: [
      "Nobody could cover {name}'s shift tonight, and a no-call, no-show at the day job was not a risk worth taking.",
      '{name} tried every single person on that schedule and could not find one soul to swap with.',
      "{name}'s day job does not know wrestling exists, and tonight it did not care to find out.",
      'The schedule went up short-handed, and {name} could not be the one who left it that way.',
    ],
  },
  {
    id: 'calledInSickBackfired',
    kind: 'absence',
    label: 'No-show',
    weight: 10,
    requires: 'healthy',
    dayJob: true,
    lines: [
      '{name} called in sick to make the show and got caught out — the boss saw the flyer online an hour later.',
      "{name}'s cover story fell apart the second a coworker mentioned seeing the same flyer {name} was supposedly too sick to see.",
      'The sick day {name} took to be here tonight just became a very awkward conversation for tomorrow — and a missed show either way.',
    ],
  },
  {
    id: 'noPtoLeftForThis',
    kind: 'absence',
    label: 'No-show',
    weight: 12,
    requires: 'healthy',
    dayJob: true,
    lines: [
      "{name} is flat out of time off, and a promotion this size does not pay enough to burn a real day's wage on it.",
      'The math did not work out tonight — {name} needs the hours from the day job a lot more than the payoff from this one.',
      "{name} asked for the night off weeks ago and only found out today it never actually got approved.",
    ],
  },

  // --- Hurt away from the ring. ------------------------------------------
  {
    id: 'gymAccident',
    kind: 'injury',
    label: 'Injury',
    weight: 16,
    requires: 'healthy',
    weeks: [2, 5],
    lines: [
      '{name} tore something loose under a bar in the gym tonight — no spotter anywhere in sight.',
      '{name} went up for a weight they have hit a hundred times before, and this time something gave way for good.',
      '{name} rolled an ankle on the very last rep of the very last set, and this one did not walk off.',
      'A machine {name} has used a thousand times without incident finally caught them the wrong way.',
    ],
  },
  {
    id: 'houseAccident',
    kind: 'injury',
    label: 'Injury',
    weight: 12,
    requires: 'healthy',
    weeks: [1, 4],
    lines: [
      '{name} came down the stairs at home wrong tonight and heard that ankle go clean.',
      '{name} slipped stepping out of the shower and put a hand straight through a glass door.',
      '{name} caught a foot on a rug at two in the morning and went down hard on the way to the kitchen.',
      'Moving a couch — a couch, of all things — is what finally took {name} down.',
    ],
  },
  {
    id: 'barFight',
    kind: 'injury',
    label: 'Injury',
    weight: 7,
    requires: 'healthy',
    weeks: [1, 4],
    lines: [
      '{name} got into it with some guy in a bar who had absolutely no idea who they were picking a fight with.',
      '{name} broke a hand on a face that had absolutely nothing to do with the show.',
      'Somebody recognized {name} at exactly the wrong bar tonight and simply would not let it go.',
      '{name} got dragged into a fight that was not even theirs, and came out of it a lot worse for it.',
    ],
  },
  {
    id: 'attackedBackstage',
    kind: 'injury',
    label: 'Attacked',
    weight: 5,
    requires: 'healthy',
    weeks: [2, 6],
    impliesAttacker: true,
    lines: [
      '{name} got put straight through a production case backstage tonight and never saw it coming.',
      '{name} got jumped in that locker room and came out needing stitches for the trouble.',
      '{name} got blindsided in the parking lot on the way to the car tonight, and this one was not a work.',
      'Somebody caught {name} alone out by the trucks tonight, and nobody backstage is saying a word about who.',
    ],
  },
  {
    id: 'carWreck',
    kind: 'injury',
    label: 'Car wreck',
    weight: 3,
    requires: 'healthy',
    weeks: [6, 20],
    lines: [
      '{name} got cut off on the interstate doing seventy and put the car straight into the barrier.',
      "{name}'s car took a broadside hit at an intersection from somebody who blew straight through the light.",
      '{name} fell asleep at the wheel after a four-hundred-mile haul and woke up flat in a ditch.',
      "{name} hydroplaned on the highway in the rain tonight and rolled that car twice before it stopped.",
    ],
  },

  // --- Something that was already wrong getting worse. --------------------
  {
    id: 'gaveOut',
    kind: 'aggravation',
    label: 'Setback',
    weight: 22,
    requires: 'injured',
    weeks: [2, 5],
    lines: [
      'The knee gave out under {name} on nothing more than a flight of stairs, and now it is worse than it ever was.',
      '{name} felt it go again reaching for nothing more than something on a shelf.',
      'It gave out on {name} climbing out of a car, of all things, and the whole recovery is worse for it now.',
      'One wrong step off a curb is all it took to undo weeks of {name}\'s recovery, gone just like that.',
    ],
  },
  {
    id: 'cameBackTooSoon',
    kind: 'aggravation',
    label: 'Setback',
    weight: 16,
    requires: 'injured',
    weeks: [3, 8],
    lines: [
      '{name} has been training on it against every bit of medical advice, and has set the whole recovery back.',
      '{name} was told flat out to rest it and did not, and today\'s scan came back worse than the last one.',
      '{name} pushed through a training session that should have been a full rest day, and it showed today.',
      'Nobody in this building could talk {name} into taking one extra week off, and now it is two.',
    ],
  },
  {
    id: 'infection',
    kind: 'aggravation',
    label: 'Setback',
    weight: 6,
    requires: 'injured',
    weeks: [4, 10],
    lines: [
      'The wound {name} has been quietly working around got infected, and now it is a hospital bed and an IV.',
      '{name} went in for what was supposed to be a routine look, and came out booked for another operation entirely.',
      'What was supposed to be healing on {name} is doing the exact opposite, and the doctors are not loving what they are seeing.',
      '{name} ignored that fever two full days too long, and it caught up with them all at once.',
    ],
  },
];

/**
 * How the wire narrates a business-wide catastrophe (engine/world/
 * catastrophe.ts) landing on a rival rather than the player — the player
 * never sees the decision, only the aftermath, so it needs its own short
 * write-up rather than reusing the per-wrestler misfortune lines above.
 * {name} is the rival promotion.
 */
export const RIVAL_WEATHER_CATASTROPHE_LINES = [
  "{name}'s show ran headlong into a night nobody in their right mind wanted to be out in — and they ran it anyway, risk and all.",
  '{name} pushed their card through weather that should have shut the whole thing down. The building was half empty by the main event.',
  'Whatever hit the building {name} was running in that night, the call was to push through rather than pull the plug.',
  '{name} gambled on the forecast and lost that bet outright. The show went on regardless.',
];

export const RIVAL_NO_SHOW_CATASTROPHE_LINES = [
  '{name} had a name on the card who simply never turned up. Their office scrambled a replacement in a hurry and the show went on.',
  'Somebody on {name}\'s card never made the building at all tonight. They patched the hole on the fly and kept the night moving.',
  '{name} lost a name off their card at the last possible minute and had to think fast on their feet.',
  'A no-show threw {name}\'s whole night into chaos. Somehow, some way, they got through it.',
];

