// Confrontations — two people, a microphone, and something that might go
// wrong.
//
// A promo (data/promoTopics.ts) is one voice. The booker points at somebody,
// picks a topic, and gets the heat the topic implies — the target is named
// but silent, and nothing ever happens that was not booked. It is the one
// segment in the game where somebody is handed a live microphone and it is
// also the only segment that cannot surprise anybody, which is backwards.
//
// A confrontation is two voices. Both of them roll, the better talker comes
// out of it looking better, and there is a weighted chance of something the
// booker did not book: the other man does not take it, a partner gets hit by
// mistake, a third party walks out, or somebody goes into business for
// himself and the heat stops being worked.
//
// Where it happens matters. In the ring is public — the crowd is in it, the
// heat swing is bigger both ways, and a turn that lands lands in front of
// nine thousand people. Backstage is private: no crowd, smaller swings, and
// a much better chance of it getting real, because there is nobody watching
// to keep it a performance.
//
// The dice follow the same rule as the rest of the chaos layer: most sides
// are small. Usually two men talk and one of them wins the exchange.

import type { Id } from '../engine/types';

export type ConfrontationVenue = 'ring' | 'backstage';

export type ConfrontationIntent =
  /** Get out here and face me. The ordinary way a feud starts. */
  | 'callOut'
  /** The table, the pen, and something to go through. */
  | 'contractSigning'
  /** The booker wants somebody's alignment to flip tonight. */
  | 'turn'
  /** Somebody wants what the other one has. */
  | 'jealousy'
  /** Partners who are coming apart, whether they know it yet or not. */
  | 'stableTension';

/** What the pair must already have between them for this to make sense. */
export type ConfrontationRequirement =
  | 'none'
  /** They are in the same team or stable. */
  | 'allies'
  /** One of them holds a belt. */
  | 'championship'
  /** One of them is married to or seeing somebody. */
  | 'romance';

export interface ConfrontationDefinition {
  id: Id;
  name: string;
  /** What the booker is buying, in the words the picker shows. */
  blurb: string;
  intent: ConfrontationIntent;
  venues: ConfrontationVenue[];
  requires: ConfrontationRequirement;
  /**
   * A third body: the partner who takes the shot by mistake, or the person
   * the two of them are arguing over.
   */
  needsThird?: 'ally' | 'prize';
  /** `{a}` speaks, `{b}` is opposite, `{c}` is the third when there is one. */
  openers: string[];
  /** Heat this puts on the feud before any twist. */
  heat: number;
}

export const CONFRONTATIONS: ConfrontationDefinition[] = [
  {
    id: 'callOut',
    name: 'Call-out',
    blurb: 'One of them demands the other comes out and says it to their face.',
    intent: 'callOut',
    venues: ['ring'],
    requires: 'none',
    heat: 12,
    openers: [
      '{a} stood in the middle of the ring and would not leave until {b} came out.',
      '{a} called {b} out by name and told the timekeeper not to bother with the bell.',
      '{a} said what everybody in the building had been thinking about {b}, and then said it again slower.',
    ],
  },
  {
    id: 'backstageWords',
    name: 'Words backstage',
    blurb: 'No crowd, no cameras anybody trusts, and nothing keeping it polite.',
    intent: 'callOut',
    venues: ['backstage'],
    requires: 'none',
    heat: 9,
    openers: [
      '{a} was waiting by the catering table when {b} walked past, and did not let it go.',
      '{a} and {b} were separated in the corridor before either of them had finished a sentence.',
      'It started quietly between {a} and {b} and half the locker room heard the end of it.',
    ],
  },
  {
    id: 'contractSigning',
    name: 'Contract signing',
    blurb: 'A table, two chairs and a pen. It almost never stays that way.',
    intent: 'contractSigning',
    venues: ['ring'],
    requires: 'none',
    heat: 16,
    openers: [
      '{a} and {b} were put at the same table with a contract between them and told to sign.',
      'The table went out, the chairs went out, and {a} sat down opposite {b} without once looking up.',
      '{a} signed first, slid the pen across to {b}, and kept one hand flat on the table.',
    ],
  },
  {
    id: 'championshipChallenge',
    name: 'Challenge for the belt',
    blurb: 'Somebody wants what the champion has, and says so holding it.',
    intent: 'jealousy',
    venues: ['ring'],
    requires: 'championship',
    heat: 14,
    openers: [
      '{b} was doing an address with the belt up on one shoulder when {a} came down and took it away.',
      '{a} told {b} the title had not looked like it meant anything since it changed hands.',
      '{a} held the belt up next to {b}’s face so the crowd could see which of them the camera wanted.',
    ],
  },
  {
    id: 'jealousyOverTheSpot',
    name: 'Jealous of the spot',
    blurb: 'One of them is more over than the other and neither of them can pretend otherwise.',
    intent: 'jealousy',
    venues: ['ring', 'backstage'],
    requires: 'none',
    heat: 11,
    openers: [
      '{a} pointed out that the crowd had chanted {b}’s name during somebody else’s match, not their own.',
      '{a} asked {b}, face to face, what had ever been done to deserve that spot on the card.',
      '{a} said the difference between them is a marketing department, and meant it.',
    ],
  },
  {
    id: 'jealousyOverAPartner',
    name: 'Jealous over a partner',
    blurb: 'Somebody makes a play at another wrestler’s other half, on camera.',
    intent: 'jealousy',
    venues: ['ring', 'backstage'],
    requires: 'romance',
    needsThird: 'prize',
    heat: 18,
    openers: [
      '{a} spent the whole segment talking to {c} and never once looked at {b}.',
      '{a} told {b}, in front of the building, exactly what {c} had said behind their back.',
      '{a} put an arm round {c} while {b} was still holding the microphone.',
    ],
  },
  {
    id: 'stableCracks',
    name: 'Cracks in the group',
    blurb: 'Two allies airing it out. Whatever they were, they may not be after.',
    intent: 'stableTension',
    venues: ['ring', 'backstage'],
    requires: 'allies',
    heat: 13,
    openers: [
      '{a} blamed {b} for the loss in front of everybody instead of taking it inside.',
      '{a} asked {b} about being slow getting into the ring, and would not accept the answer.',
      '{b} tried to laugh it off and {a} did not laugh.',
    ],
  },
  {
    id: 'theTurn',
    name: 'Turn on them',
    blurb: 'The booker has decided somebody changes tonight. Whether it lands is up to them.',
    intent: 'turn',
    venues: ['ring', 'backstage'],
    requires: 'none',
    heat: 15,
    openers: [
      '{a} let {b} finish, and then said the thing nobody comes back from.',
      '{a} had the microphone for four minutes and by the end of it the building did not know what to think.',
      'Everything about how {a} spoke to {b} was different, and everybody watching worked out why at the same moment.',
    ],
  },
  {
    id: 'ambush',
    name: 'Jump them backstage',
    blurb: 'No talking. One of them is waiting when the other comes through the door.',
    intent: 'callOut',
    venues: ['backstage'],
    requires: 'none',
    heat: 17,
    openers: [
      '{a} was behind the door when {b} came through it, and there was no chance to turn round.',
      '{b} was still in ring gear when {a} came through and put them into the equipment cases.',
      'It was over before anybody got there, and {a} was still standing.',
    ],
  },
];

export function confrontationById(id: Id): ConfrontationDefinition | undefined {
  return CONFRONTATIONS.find((c) => c.id === id);
}

// ---------------------------------------------------------------------------
// The things nobody booked
// ---------------------------------------------------------------------------

export type TwistId =
  | 'tookIt'
  | 'answeredBack'
  | 'wentPhysical'
  | 'allyMisfire'
  | 'thirdParty'
  | 'wentIntoBusiness'
  | 'refusedToSign'
  | 'throughTheTable'
  | 'walkedOff'
  | 'crowdTurned';

export interface ConfrontationTwist {
  id: TwistId;
  /** The label above it on the results page. */
  label: string;
  /** Against everything else possible tonight. The dull ones are the common ones. */
  weight: number;
  /** Only where it makes sense. */
  venues: ConfrontationVenue[];
  /** Only for these kinds of segment; empty means any. */
  intents: ConfrontationIntent[];
  /** Needs a third body to have been in the segment. */
  needsThird?: boolean;
  lines: string[];
  /** Extra heat on the feud, on top of the segment's own. */
  heat: number;
  /**
   * Real animosity. The classic way this starts is somebody saying something
   * they should not have — which the game could not previously model, because
   * shoot heat only ever came out of matches.
   */
  shootHeat: number;
  /** Alignment push on the speaker, for twists that change who somebody is. */
  alignmentShift: number;
  /** Somebody gets hurt, in weeks. */
  injuryWeeks?: [number, number];
  /** Which of them it lands on. */
  hurts?: 'speaker' | 'opposite' | 'third';
}

export const CONFRONTATION_TWISTS: ConfrontationTwist[] = [
  // --- The common, boring end of the die --------------------------------
  {
    id: 'tookIt',
    label: 'And that was that',
    weight: 44,
    venues: ['ring', 'backstage'],
    intents: [],
    heat: 0,
    shootHeat: 0,
    alignmentShift: 0,
    lines: [
      '{b} took it, said nothing worth repeating, and walked.',
      'It stayed words. Both of them left under their own steam.',
      'Nobody laid a hand on anybody. It did not need it.',
    ],
  },
  {
    id: 'answeredBack',
    label: 'There was an answer ready',
    weight: 30,
    venues: ['ring', 'backstage'],
    intents: [],
    heat: 6,
    shootHeat: 0,
    alignmentShift: 0,
    lines: [
      '{b} had an answer ready and the building went with it.',
      '{b} did not raise a voice once and still came out of it ahead.',
      '{b} gave it back word for word, and it was better than what came in.',
    ],
  },

  // --- It stops being words ---------------------------------------------
  {
    id: 'wentPhysical',
    label: 'It went physical',
    weight: 20,
    venues: ['ring', 'backstage'],
    intents: [],
    heat: 14,
    shootHeat: 0,
    alignmentShift: 0,
    lines: [
      'The microphone hit the mat and it took four people to get between them.',
      '{b} threw the first one and {a} had clearly been waiting for it.',
      'It was a fight by the end and neither of them was performing.',
    ],
  },
  {
    id: 'throughTheTable',
    label: 'Through the table',
    weight: 22,
    venues: ['ring'],
    intents: ['contractSigning'],
    heat: 20,
    shootHeat: 0,
    alignmentShift: 0,
    injuryWeeks: [1, 3],
    hurts: 'opposite',
    lines: [
      '{a} put {b} through the table before the pen had touched the paper.',
      'The table did not survive the signing. Neither did {b}.',
      '{b} went over the table backwards and the contract went too.',
    ],
  },
  {
    id: 'refusedToSign',
    label: 'No signature',
    weight: 14,
    venues: ['ring'],
    intents: ['contractSigning'],
    heat: 10,
    shootHeat: 0,
    alignmentShift: 0,
    lines: [
      '{b} looked at the contract, looked at {a}, and put the pen down.',
      '{b} would not sign it and would not say why, which was worse.',
      '{b} signed nothing and left the building. The match has no signature on it.',
    ],
  },

  // --- The ones that make a story ---------------------------------------
  {
    id: 'allyMisfire',
    label: 'The wrong one got hit',
    weight: 12,
    venues: ['ring', 'backstage'],
    intents: [],
    needsThird: true,
    heat: 16,
    shootHeat: 8,
    alignmentShift: 0,
    injuryWeeks: [1, 2],
    hurts: 'third',
    lines: [
      '{a} swung at {b}, {b} moved, and {c} took it flush. {c} is {a}’s own partner.',
      '{c} stepped in to break it up and {a} connected with {c} instead of {b}. Nobody is sure it was an accident.',
      '{a} went for {b} and put {c} down by mistake, and {c} got up looking at {a} rather than at {b}.',
    ],
  },
  {
    id: 'thirdParty',
    label: 'Somebody else came out',
    weight: 13,
    venues: ['ring'],
    intents: [],
    heat: 12,
    shootHeat: 0,
    alignmentShift: 0,
    lines: [
      'Somebody nobody had booked came down the ramp and made it a three-way argument.',
      'The music that hit was not either of theirs, and the building came apart.',
      'It stopped being about {a} and {b} the moment the third man walked out.',
    ],
  },
  {
    id: 'wentIntoBusiness',
    label: 'It stopped being worked',
    weight: 9,
    venues: ['backstage', 'ring'],
    intents: [],
    heat: 8,
    shootHeat: 22,
    alignmentShift: 0,
    lines: [
      '{a} said something that was not in anybody’s notes and {b} stopped pretending.',
      'Whatever {a} said, it was true, and that is the problem with saying it into a microphone.',
      '{b} did not come back to the meeting afterwards. This one is real now.',
    ],
  },
  {
    id: 'walkedOff',
    label: 'No engagement',
    weight: 10,
    venues: ['ring', 'backstage'],
    intents: [],
    heat: -4,
    shootHeat: 0,
    alignmentShift: 0,
    lines: [
      '{b} listened to about half of it and walked off while {a} was still talking.',
      '{b} did not come out at all. {a} stood there for two minutes and then left.',
      '{b} shrugged, and a shrug is the worst thing you can do to a man with a microphone.',
    ],
  },
  {
    id: 'crowdTurned',
    label: 'The crowd went the other way',
    weight: 11,
    venues: ['ring'],
    intents: ['turn'],
    heat: 5,
    shootHeat: 0,
    alignmentShift: -1,
    lines: [
      '{a} said the unforgivable thing and the building cheered for it.',
      'It was meant to make {a} the villain. Nine thousand people decided otherwise.',
      'The turn landed and landed the wrong way round, and {a} could hear it happening.',
    ],
  },
];
