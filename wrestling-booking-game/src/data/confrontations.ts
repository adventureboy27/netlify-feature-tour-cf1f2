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
    blurb: 'One of them demands the other get out here and say it to their face.',
    intent: 'callOut',
    venues: ['ring'],
    requires: 'none',
    heat: 12,
    openers: [
      '{a} planted themselves dead center in that ring and would not leave until {b} showed up.',
      '{a} called {b} out by name, loud and clear, and told the timekeeper not to bother with the bell.',
      '{a} said out loud exactly what everybody in this building had been thinking about {b} — then said it again, slower, for the people in the back.',
    ],
  },
  {
    id: 'backstageWords',
    name: 'Words backstage',
    blurb: 'No crowd, no cameras anybody trusts, and absolutely nothing keeping it polite.',
    intent: 'callOut',
    venues: ['backstage'],
    requires: 'none',
    heat: 9,
    openers: [
      '{a} was waiting right by the catering table when {b} walked past, and did not let it go for one second.',
      '{a} and {b} had to be pulled apart in that corridor before either one had even finished a sentence.',
      'It started quiet between {a} and {b}, but half the locker room heard exactly how it ended.',
    ],
  },
  {
    id: 'contractSigning',
    name: 'Contract signing',
    blurb: 'A table, two chairs, and a pen. It almost never stays that civil.',
    intent: 'contractSigning',
    venues: ['ring'],
    requires: 'none',
    heat: 16,
    openers: [
      '{a} and {b} were sat down at the same table with a contract between them and told, flat out, to sign.',
      'The table went out, the chairs went out, and {a} dropped into the seat across from {b} without once looking up.',
      '{a} signed first, slid the pen clean across the table to {b}, and kept one hand flat right next to it.',
    ],
  },
  {
    id: 'championshipChallenge',
    name: 'Challenge for the belt',
    blurb: 'Somebody wants exactly what the champion has, and says so with the belt right in front of them.',
    intent: 'jealousy',
    venues: ['ring'],
    requires: 'championship',
    heat: 14,
    openers: [
      '{b} was mid-address with that belt up on one shoulder when {a} marched right down and took it clean off.',
      '{a} told {b}, flat out, that title has not looked like it meant a thing since it changed hands.',
      '{a} held the belt up right next to {b}’s face so every camera in the building could see exactly who the crowd wanted.',
    ],
  },
  {
    id: 'jealousyOverTheSpot',
    name: 'Jealous of the spot',
    blurb: 'One of them is a whole lot more over than the other, and neither one can pretend otherwise anymore.',
    intent: 'jealousy',
    venues: ['ring', 'backstage'],
    requires: 'none',
    heat: 11,
    openers: [
      '{a} pointed out, loud enough for everybody to hear, that this crowd chanted {b}’s name during somebody else’s match — not their own.',
      '{a} got right in {b}’s face and asked what exactly had ever been done to earn that spot on the card.',
      '{a} said the only difference between the two of them is a marketing department, and meant every word of it.',
    ],
  },
  {
    id: 'jealousyOverAPartner',
    name: 'Jealous over a partner',
    blurb: 'Somebody makes a play at another wrestler’s other half, right there on camera.',
    intent: 'jealousy',
    venues: ['ring', 'backstage'],
    requires: 'romance',
    needsThird: 'prize',
    heat: 18,
    openers: [
      '{a} spent the entire segment talking straight to {c} and never once so much as glanced at {b}.',
      '{a} told {b}, in front of this whole building, exactly what {c} had said behind their back.',
      '{a} slid an arm right around {c} while {b} was still standing there holding the microphone.',
    ],
  },
  {
    id: 'stableCracks',
    name: 'Cracks in the group',
    blurb: 'Two allies airing it out in the open. Whatever they were, they may not be after tonight.',
    intent: 'stableTension',
    venues: ['ring', 'backstage'],
    requires: 'allies',
    heat: 13,
    openers: [
      '{a} blamed {b} for the loss right out in the open instead of taking it inside like everybody expected.',
      '{a} pressed {b} hard about being slow getting into that ring, and would not accept one word of the answer.',
      '{b} tried to laugh it off, and {a} did not laugh back — not even a little.',
    ],
  },
  {
    id: 'theTurn',
    name: 'Turn on them',
    blurb: 'The booker has decided somebody changes colors tonight. Whether the crowd buys it is up to them.',
    intent: 'turn',
    venues: ['ring', 'backstage'],
    requires: 'none',
    heat: 15,
    openers: [
      '{a} let {b} finish completely, and then said the one thing nobody ever comes back from.',
      '{a} held that microphone for four straight minutes, and by the end of it this building did not know what to think anymore.',
      'Everything about how {a} spoke to {b} was different tonight, and everybody watching worked out exactly why at the same instant.',
    ],
  },
  {
    id: 'ambush',
    name: 'Jump them backstage',
    blurb: 'No talking, none needed. One of them is waiting when the other comes through that door.',
    intent: 'callOut',
    venues: ['backstage'],
    requires: 'none',
    heat: 17,
    openers: [
      '{a} was waiting right behind that door when {b} came through it — never even had a chance to turn around.',
      '{b} was still in ring gear when {a} came through and drove them straight into the equipment cases.',
      'It was over before a single soul got there to break it up, and {a} was the only one still standing.',
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
      '{b} took it, said nothing worth repeating back, and walked off under their own power.',
      'It stayed strictly words tonight. Both of them left the way they came in.',
      'Nobody laid a hand on anybody out there. Did not need to — the words did plenty.',
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
      '{b} had an answer locked and loaded, and this building went right along with it.',
      '{b} never once raised a voice and still walked out of there way ahead on points.',
      '{b} gave it right back word for word, and honestly, it landed better than what came in.',
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
      'The microphone hit that mat hard and it took four grown men to pull these two apart.',
      '{b} threw the first one, and {a} had very clearly been waiting for exactly that.',
      'This was a fight by the end of it, and neither one of them was performing anymore.',
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
      '{a} put {b} clean through that table before the pen had even touched the paper.',
      'That table did not survive the signing. Neither, really, did {b}.',
      '{b} went over the table backwards, and the contract went right along with it.',
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
      '{b} looked at that contract, looked hard at {a}, and set the pen right back down.',
      '{b} would not sign it and would not say why — and that was the worse of the two.',
      '{b} signed absolutely nothing and walked straight out of the building. This match has no signature on it.',
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
      '{a} swung for {b}, {b} moved, and {c} took it flush — and {c} is {a}’s own partner.',
      '{c} stepped in to break it up and {a} connected with {c} instead of {b}. Nobody in this building is convinced that was an accident.',
      '{a} went for {b}, caught {c} instead, and {c} got right back up looking dead at {a} instead of {b}.',
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
      'Somebody nobody had booked came marching down that ramp and turned it into a three-way argument.',
      'The music that hit belonged to neither one of them, and this building came clean apart.',
      'It stopped being about {a} and {b} the second that third man walked out.',
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
      '{a} said something that was not in anybody’s notes, and {b} stopped pretending right there on the spot.',
      'Whatever {a} said, every word of it was true — and that is exactly the problem with saying it into a live microphone.',
      '{b} never showed back up to the production meeting afterward. This one is real now.',
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
      '{b} listened to about half of it and simply walked off while {a} was still mid-sentence.',
      '{b} never even came out. {a} stood out there for two full minutes and then left, alone.',
      '{b} just shrugged — and a shrug is about the worst thing you can do to a man holding a live microphone.',
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
      '{a} said the unforgivable thing, and this building cheered for it like they meant every word of it back.',
      'It was supposed to make {a} the villain of the night. Nine thousand people decided otherwise, loudly.',
      'The turn landed, and it landed backwards — and {a} could hear it happening in real time.',
    ],
  },
];
