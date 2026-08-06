// How people get hurt, and what it is called afterwards.
//
// The rule this file exists to serve (CLAUDE.md): nothing happens to a person
// off-screen. A player must never find out somebody is on the shelf by
// noticing an icon on a roster card — they find out because the write-up said
// his knee went on a dive, and now they know which spot cost them their main
// eventer.
//
// So every way somebody can be hurt has a named cause with a sentence
// attached. A generic "Injured" is exactly the thing this is here to stop.

export type CasualtyRole = 'competitor' | 'referee' | 'manager' | 'guestReferee';

export interface InjuryCause {
  id: string;
  /** What it is called on the roster card. */
  label: string;
  /** How the write-up says it. {name} is filled in. */
  lines: string[];
  /** Who this can happen to. */
  roles: CasualtyRole[];
  /** Roughly how long it keeps somebody out, in weeks, before variance. */
  weeks: number;
  /** Needs a violent match to be plausible. */
  minViolence?: number;
}

export const INJURY_CAUSES: InjuryCause[] = [
  // ------------------------------------------------------------ in the ring
  {
    id: 'knee',
    label: 'Knee ligament',
    roles: ['competitor'],
    weeks: 14,
    lines: [
      '{name} came down badly off the top and the knee went. They did not get up on their own.',
      "{name}'s knee buckled on a simple landing. Everybody in the building heard the noise.",
    ],
  },
  {
    id: 'shoulder',
    label: 'Shoulder',
    roles: ['competitor'],
    weeks: 9,
    lines: [
      '{name} landed on the point of the shoulder and could not lift the arm afterwards.',
      "{name}'s shoulder came out of the socket on a whip into the corner.",
    ],
  },
  {
    id: 'concussion',
    label: 'Concussion',
    roles: ['competitor', 'guestReferee', 'referee'],
    weeks: 6,
    lines: [
      '{name} took a knee to the head and spent the rest of it not knowing where they were.',
      '{name} was out on their feet long before the finish and should not have been allowed to continue.',
    ],
  },
  {
    id: 'ribs',
    label: 'Ribs',
    roles: ['competitor', 'guestReferee'],
    weeks: 5,
    lines: [
      '{name} got folded in half and could not draw a breath after it.',
      "Something gave in {name}'s ribs and they worked the last five minutes on one lung.",
    ],
  },
  {
    id: 'back',
    label: 'Back',
    roles: ['competitor'],
    weeks: 11,
    lines: [
      '{name} was dropped on the back of the neck and stayed down a long time.',
      "{name}'s back locked up completely and they had to be helped to the back.",
    ],
  },
  {
    id: 'ankle',
    label: 'Ankle',
    roles: ['competitor', 'referee', 'guestReferee'],
    weeks: 4,
    lines: [
      '{name} caught a foot in the ropes and the ankle turned the wrong way.',
      '{name} rolled the ankle on the floor and could not put weight on it.',
    ],
  },

  // ------------------------------------------------------- the hardware
  {
    id: 'cut',
    label: 'Cut',
    roles: ['competitor', 'guestReferee'],
    weeks: 2,
    minViolence: 3,
    lines: [
      '{name} was opened up early and the doctor spent the finish trying to get to them.',
      '{name} lost a lot of blood and was grey by the end of it.',
    ],
  },
  {
    id: 'burn',
    label: 'Burns',
    roles: ['competitor'],
    weeks: 8,
    minViolence: 5,
    lines: [
      '{name} did not get clear of it and the burns are worse than anybody wants to say.',
      'Whatever that spot was meant to look like, {name} is the one wearing it.',
    ],
  },

  // ------------------------------------------------ caught in the middle
  {
    id: 'refBump',
    label: 'Referee bump',
    roles: ['referee', 'guestReferee'],
    weeks: 3,
    lines: [
      '{name} took the full force of it and was still down when the finish came.',
      '{name} got flattened trying to separate them and did not get up quickly.',
    ],
  },
  {
    id: 'crossfire',
    label: 'Caught in the crossfire',
    roles: ['referee', 'manager', 'guestReferee'],
    weeks: 4,
    lines: [
      '{name} was on the apron in the wrong place at the wrong time and paid for it.',
      '{name} got dragged into something they had no business being in.',
    ],
  },
  {
    id: 'thrownOut',
    label: 'Thrown out of the ring',
    roles: ['manager', 'referee', 'guestReferee'],
    weeks: 3,
    lines: [
      '{name} was thrown over the top and landed on the floor badly.',
      'Somebody had had enough of {name} at ringside and made the point physically.',
    ],
  },
  {
    id: 'chairShot',
    label: 'Took a chair',
    roles: ['manager', 'guestReferee'],
    weeks: 5,
    minViolence: 3,
    lines: [
      '{name} took a chair meant for somebody else and went down hard.',
      '{name} stepped in to protect their man and wore it instead.',
    ],
  },
];

export function injuryCauseById(id: string): InjuryCause | undefined {
  return INJURY_CAUSES.find((c) => c.id === id);
}

/** Everything that could plausibly happen to this person in this match. */
export function causesFor(role: CasualtyRole, violenceLevel: number): InjuryCause[] {
  return INJURY_CAUSES.filter(
    (cause) => cause.roles.includes(role) && violenceLevel >= (cause.minViolence ?? 0),
  );
}
