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
// point: most weeks nothing happens to anybody. A blown tyre comes up often;
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
      '{name} is on the hard shoulder ninety miles out with the bonnet up.',
      "{name}'s car died in a petrol station car park and the tow truck is two hours away.",
      '{name} blew a tyre on the interstate and there is no spare in the boot.',
    ],
  },
  {
    id: 'missedFlight',
    kind: 'absence',
    label: 'No-show',
    weight: 26,
    requires: 'healthy',
    lines: [
      '{name} is sitting in an airport four states away watching the departures board.',
      "{name}'s connection was cancelled and there is nothing else out tonight.",
      '{name} got as far as the gate and the gate closed.',
    ],
  },
  {
    id: 'weatheredIn',
    kind: 'absence',
    label: 'No-show',
    weight: 18,
    requires: 'healthy',
    lines: [
      '{name} is snowed in and the roads out are closed.',
      '{name} spent six hours in standstill traffic behind an overturned lorry and never got close.',
    ],
  },
  {
    id: 'foodPoisoning',
    kind: 'absence',
    label: 'No-show',
    weight: 14,
    requires: 'healthy',
    lines: [
      '{name} has been in the hotel bathroom since lunchtime and is not leaving it.',
      '{name} ate at the same place as everybody else and was the only one it got.',
    ],
  },
  {
    id: 'overslept',
    kind: 'absence',
    label: 'No-show',
    weight: 12,
    requires: 'healthy',
    lines: [
      '{name} slept through the alarm, the wake-up call and four phones going off.',
      "Nobody has been able to raise {name} all day. The hotel says the room is still made up.",
    ],
  },
  {
    id: 'familyEmergency',
    kind: 'absence',
    label: 'No-show',
    weight: 10,
    requires: 'healthy',
    lines: [
      '{name} got a phone call at six this morning and drove the other way.',
      '{name} is at a hospital bedside and it is not theirs.',
    ],
  },
  {
    id: 'paperwork',
    kind: 'absence',
    label: 'No-show',
    weight: 7,
    requires: 'healthy',
    lines: [
      '{name} is being held at the border over paperwork nobody checked.',
      "{name}'s visa did not come through and the promoter found out this morning.",
    ],
  },
  {
    id: 'lockedUp',
    kind: 'absence',
    label: 'No-show',
    weight: 4,
    requires: 'healthy',
    lines: [
      '{name} spent the night in a cell over something that started in a hotel bar.',
      '{name} was picked up on the way to the building and has not been released.',
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
      '{name} was found laid out by the production cases twenty minutes before the doors opened.',
      '{name} got jumped in the corridor outside the locker room and nobody saw who.',
      '{name} was attacked in the parking lot walking in. The car park has no cameras.',
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
      '{name} tore something under a bar in the gym with nobody spotting.',
      '{name} went up for a weight they have done a hundred times and something let go.',
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
      '{name} came down the stairs at home wrong and heard the ankle go.',
      '{name} slipped getting out of a shower and put a hand through a glass door.',
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
      '{name} got into it with somebody in a bar who did not know the difference.',
      '{name} broke a hand on a face that was not part of the show.',
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
      '{name} was put through a production case backstage and did not see it coming.',
      '{name} was jumped in the locker room and came out of it needing stitches.',
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
      '{name} was cut up on the interstate at seventy and put the car into the barrier.',
      "{name}'s car was hit side-on at a junction by somebody who ran the light.",
      '{name} fell asleep at the wheel after a four-hundred-mile drive and woke up in a ditch.',
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
      'The knee gave out under {name} on a flight of stairs. It is worse than it was.',
      '{name} felt it go again reaching for something on a shelf.',
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
      '{name} has been training on it against advice and has set the whole thing back.',
      '{name} was told to rest it and did not, and the scan today was worse than the last one.',
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
      'The wound {name} has been working around got infected and they are in hospital on a drip.',
      '{name} went in for a routine look at it and came out booked for another operation.',
    ],
  },
];

export function misfortuneById(id: string): MisfortuneDefinition | undefined {
  return MISFORTUNES.find((m) => m.id === id);
}
