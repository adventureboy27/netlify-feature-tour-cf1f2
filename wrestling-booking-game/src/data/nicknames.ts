// Nicknames — the name the announcer reaches for after a few years.
//
// A nickname is not given out at the door. It is what somebody gets called
// once they have been around long enough for the crowd to have decided what
// they are: the man who will not stay down, the one with the mouth, the guy
// who has never had a bad match. So these pools are keyed by what a wrestler
// is *defined by* — their best stat, their style, their attitude — and the
// engine picks the pool before it picks the name.
//
// They are plain monikers, no quotes and no name attached. The UI renders
// them as "The Enforcer" Ray Colt.

import type { Archetype, WrestlingStyle } from '../engine/types';

/** Which side of somebody the nickname is about. */
export type NicknameSource =
  | 'mic'
  | 'power'
  | 'technique'
  | 'speed'
  | 'toughness'
  | 'ego'
  | 'heel'
  | 'face'
  | 'veteran';

/**
 * The big ones. Reserved for people who are genuinely drawing — a jobber
 * called The Franchise is a joke, and the game should not make it.
 */
export const MAIN_EVENT_NICKNAMES = [
  'The Franchise',
  'The Icon',
  'The Standard',
  'The Main Event',
  'The Chosen One',
  'The Measuring Stick',
  'The Headliner',
  'The Big Deal',
  'The Real Deal',
  'The Ace',
];

export const NICKNAMES_BY_SOURCE: Record<NicknameSource, string[]> = {
  mic: [
    'The Mouth of the South',
    'The Loudest Man Alive',
    'The Silver Tongue',
    'The Living Legend in Their Own Mind',
    'The Voice',
    'The Last Word',
    'The Talker',
  ],
  power: [
    'The Freight Train',
    'The Human Wrecking Ball',
    'The Anvil',
    'The Bulldozer',
    'The Powerhouse',
    'The Wall',
    'The Ox',
  ],
  technique: [
    'The Technician',
    'The Mat General',
    'The Surgeon',
    'The Craftsman',
    'The Professor',
    'The Chain',
    'The Textbook',
  ],
  speed: [
    'The Human Highlight Reel',
    'The Blur',
    'The Comet',
    'The Cat',
    'The Bird of Prey',
    'The Rocket',
    'The Lightning',
  ],
  toughness: [
    'The Man They Cannot Hurt',
    'The Iron Man',
    'The Anvil-Headed',
    'The Bad Man',
    'The Hardest Man in the Business',
    'The Granite',
    'The Unbreakable',
  ],
  ego: [
    'The Self-Proclaimed Greatest',
    'The Golden Boy',
    'The Millionaire',
    'The Genius',
    'The Untouchable',
    'The Crown Prince',
    'The Gift',
  ],
  heel: [
    'The Snake',
    'The Rattlesnake',
    'The Villain',
    'The Cheat',
    'The Most Hated Man in Wrestling',
    'The Bad Guy',
    'The Weasel',
  ],
  face: [
    'The People’s Choice',
    'The Hometown Hero',
    'The Working Man',
    'The Common Man',
    'The One They Came to See',
    'The Heart of the Company',
    'The Favorite Son',
  ],
  veteran: [
    'The Old Lion',
    'The Last of the Old Guard',
    'The Elder Statesman',
    'The Veteran',
    'The Ring General',
    'The Institution',
    'The Survivor',
  ],
};

/** A style says a lot about what somebody gets called. */
export const NICKNAMES_BY_STYLE: Partial<Record<WrestlingStyle, string[]>> = {
  hardcore: ['The King of Hardcore', 'The Death Merchant', 'The Barbed Wire Messiah', 'The Sick Man'],
  luchador: ['El Rayo', 'The Masked Marvel', 'El Fantasma', 'The Flying Saint'],
  highFlyer: ['The High Flyer', 'The Skywalker', 'The Daredevil', 'The Man Without Fear'],
  submission: ['The Human Vice', 'The Executioner', 'The Snapmare Man', 'The Limb Collector'],
  giant: ['The Giant', 'The Monster', 'The Colossus', 'The Mountain'],
  showman: ['The Showstopper', 'The Entertainer', 'The Main Attraction', 'The Spectacle'],
  oldSchool: ['The Old School', 'The Purist', 'The Traditionalist', 'The Throwback'],
  striker: ['The Knockout Artist', 'The Hitman', 'The Sniper', 'The Enforcer'],
  bruiser: ['The Brawler', 'The Barroom King', 'The Bruiser', 'The Junkyard Dog'],
  technical: ['The Technical Wizard', 'The Mechanic', 'The Wrestling Machine', 'The Craft'],
  powerhouse: ['The Strongest Man Alive', 'The Powerlifter', 'The Titan', 'The Beast'],
  allRounder: ['The Complete Package', 'The All-Rounder', 'The Total Package', 'The Best in the World'],
};

/** A fallback keyed on archetype, for anyone the other pools have nothing for. */
export const NICKNAMES_BY_ARCHETYPE: Record<Archetype, string[]> = {
  powerhouse: ['The Big Man', 'The Heavy'],
  technician: ['The Craftsman', 'The Student of the Game'],
  highFlyer: ['The Highspot', 'The Acrobat'],
  brawler: ['The Streetfighter', 'The Tough'],
  showman: ['The Character', 'The Draw'],
  monster: ['The Nightmare', 'The Thing'],
  veteran: ['The Old Hand', 'The Lifer'],
  rookie: ['The Kid', 'The Newcomer'],
};
