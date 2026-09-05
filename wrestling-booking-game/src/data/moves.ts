// Move-name grammar components, booking-game-design.md §3.3.
// `[Adjective?] [BodyPart/Concept] [MoveNoun]` — "Crimson Driver," "Steel Trap."
// Target volume is 150+ components at v1; this is a starter set — move names
// are fully renameable by the player, so quantity matters less than variety
// at the seams (adjective x concept x noun already yields thousands of names).

export const MOVE_ADJECTIVES: string[] = [
  'Crimson', 'Steel', 'Midnight', 'Iron', 'Savage', 'Silent', 'Final', 'Broken',
  'Golden', 'Wicked', 'Twisted', 'Sudden', 'Last', 'Cold', 'Burning', 'Shattered',
];

export const MOVE_CONCEPTS: string[] = [
  'Trap', 'Reckoning', 'Judgment', 'Storm', 'Fury', 'Vice', 'Wrath', 'Descent',
  'Crossfire', 'Verdict', 'Exile', 'Nightfall', 'Collapse', 'Backbreaker', 'Sunset', 'Nova',
];

export const MOVE_NOUNS_BY_TYPE: Record<
  'slam' | 'suplex' | 'submission' | 'strike' | 'aerial' | 'driver' | 'stunner' | 'powerbomb' | 'clothesline',
  string[]
> = {
  slam: ['Slam', 'Slammer', 'Impact'],
  suplex: ['Suplex', 'Bridge', 'Throw'],
  submission: ['Lock', 'Hold', 'Clutch', 'Stretch'],
  strike: ['Strike', 'Chop', 'Kick', 'Elbow'],
  aerial: ['Splash', 'Press', 'Dive', 'Plancha'],
  driver: ['Driver', 'Drop', 'Bomb'],
  stunner: ['Stunner', 'Snap'],
  powerbomb: ['Powerbomb', 'Sitout'],
  clothesline: ['Clothesline', 'Lariat'],
};
