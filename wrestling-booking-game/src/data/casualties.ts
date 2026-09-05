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
  /**
   * Restricts this cause to specific stipulation ids — "the ladder buckled"
   * makes no sense outside a ladder match. Undefined means always eligible,
   * same as before this field existed.
   */
  stipulationIds?: string[];
}

export const INJURY_CAUSES: InjuryCause[] = [
  // ------------------------------------------------------------ in the ring
  {
    id: 'knee',
    label: 'Knee ligament',
    roles: ['competitor'],
    weeks: 14,
    lines: [
      '{name} came down wrong off the top and that knee just gave out — did not get up under their own power.',
      "{name}'s knee buckled on what should have been a routine landing, and this entire building heard the pop.",
    ],
  },
  {
    id: 'shoulder',
    label: 'Shoulder',
    roles: ['competitor'],
    weeks: 9,
    lines: [
      '{name} landed square on the point of the shoulder and could not lift that arm for the rest of the night.',
      "{name}'s shoulder popped clean out of the socket on a whip into the corner — you could see it happen.",
    ],
  },
  {
    id: 'concussion',
    label: 'Concussion',
    roles: ['competitor', 'guestReferee', 'referee'],
    weeks: 6,
    lines: [
      '{name} took a knee square to the head and spent the rest of this match not knowing where they were.',
      '{name} was out on their feet a long time before the finish, and honestly, should never have been allowed to keep going.',
    ],
  },
  {
    id: 'ribs',
    label: 'Ribs',
    roles: ['competitor', 'guestReferee'],
    weeks: 5,
    lines: [
      '{name} got folded clean in half and could not draw a full breath for the rest of the match.',
      "Something gave way in {name}'s ribs, and they worked the last five minutes of this thing on one lung.",
    ],
  },
  {
    id: 'back',
    label: 'Back',
    roles: ['competitor'],
    weeks: 11,
    lines: [
      '{name} got dropped right on the back of the neck and stayed down a long, long time.',
      "{name}'s back locked up solid, and they had to be helped out of this building.",
    ],
  },
  {
    id: 'ankle',
    label: 'Ankle',
    roles: ['competitor', 'referee', 'guestReferee'],
    weeks: 4,
    lines: [
      '{name} caught a foot in the ropes and that ankle turned a way it was never supposed to turn.',
      '{name} rolled the ankle out on the floor and could not put a single ounce of weight on it afterward.',
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
      '{name} got busted open early, and the ringside doctor spent the entire finish just trying to get a look at it.',
      '{name} lost a lot of blood out there tonight and looked like a ghost by the final bell.',
    ],
  },
  {
    id: 'burn',
    label: 'Burns',
    roles: ['competitor'],
    weeks: 8,
    minViolence: 5,
    lines: [
      '{name} did not get clear in time, and the burns are worse than anybody around here wants to admit.',
      'Whatever that spot was supposed to look like, {name} is the one who is actually wearing it now.',
    ],
  },

  // ------------------------------------------ the gear finally gave out
  //
  // Themed hardware failure, gated to the stipulation it belongs to — see
  // data/stipulations.ts's hardwareGearSensitive. A promotion running these
  // on the bottom of the production ladder is meant to feel it.
  {
    id: 'ladderGaveWay',
    label: 'Bad fall off the ladder',
    roles: ['competitor'],
    weeks: 10,
    minViolence: 3,
    stipulationIds: ['ladder'],
    lines: [
      '{name} felt a rung give out underfoot at the top of that ladder and came down with nothing to grab on the way.',
      "That ladder had no business being in this building — {name} rode the whole thing down and it landed on top of them.",
    ],
  },
  {
    id: 'cageGaveWay',
    label: 'Cage came apart',
    roles: ['competitor'],
    weeks: 9,
    minViolence: 2,
    stipulationIds: ['steelCage'],
    lines: [
      "A panel worked loose right where {name} put their weight on it, and the whole side of that cage came away in their hands.",
      '{name} got driven into the chain-link at the exact spot with the loose hinge, and it did not hold.',
    ],
  },
  {
    id: 'tableNoBreak',
    label: "Table didn't break",
    roles: ['competitor'],
    weeks: 8,
    minViolence: 3,
    stipulationIds: ['tables', 'flamingTables'],
    lines: [
      'That table did not break clean — it ate the impact instead, and {name} took the whole thing on the way down.',
      "{name} went through where the table was supposed to give, and for a long second it just did not.",
    ],
  },

  // ------------------------------------------------ caught in the middle
  {
    id: 'refBump',
    label: 'Referee bump',
    roles: ['referee', 'guestReferee'],
    weeks: 3,
    lines: [
      '{name} took the full brunt of it and was still down on the mat when the finish came.',
      '{name} got absolutely flattened trying to pull these two apart, and was slow getting back up.',
    ],
  },
  {
    id: 'crossfire',
    label: 'Caught in the crossfire',
    roles: ['referee', 'manager', 'guestReferee'],
    weeks: 4,
    lines: [
      '{name} was standing on that apron in the wrong place at the worst possible time, and paid for it.',
      '{name} got dragged into something that had absolutely nothing to do with them.',
    ],
  },
  {
    id: 'thrownOut',
    label: 'Thrown out of the ring',
    roles: ['manager', 'referee', 'guestReferee'],
    weeks: 3,
    lines: [
      '{name} got thrown clean over the top rope and landed on that floor hard.',
      'Somebody had had enough of {name} tonight, and made the point by putting them over the top rope.',
    ],
  },
  {
    id: 'chairShot',
    label: 'Took a chair',
    roles: ['manager', 'guestReferee'],
    weeks: 5,
    minViolence: 3,
    lines: [
      '{name} took a chair shot that was meant for somebody else entirely, and went down hard for it.',
      '{name} stepped in to protect their client — and wore the whole thing instead.',
    ],
  },
];

export function injuryCauseById(id: string): InjuryCause | undefined {
  return INJURY_CAUSES.find((c) => c.id === id);
}

/** Everything that could plausibly happen to this person in this match. */
export function causesFor(role: CasualtyRole, violenceLevel: number, stipulationId?: string | null): InjuryCause[] {
  return INJURY_CAUSES.filter(
    (cause) =>
      cause.roles.includes(role) &&
      violenceLevel >= (cause.minViolence ?? 0) &&
      (!cause.stipulationIds || (stipulationId != null && cause.stipulationIds.includes(stipulationId))),
  );
}
