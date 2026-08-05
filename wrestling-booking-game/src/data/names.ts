// Name-generation word lists, booking-game-design.md §6.
//
// Target volume per §0's content budget is 400+ first names, 400+ surnames,
// 200+ epithet nouns/adjectives. This is a starter set sized to make 300
// distinct wrestlers comfortably (first x last alone is 14,000+ combinations)
// — growing it toward the full target is ongoing content work, not an M0
// blocker (see CLAUDE.md "Content to author").

export const MASCULINE_FIRST_NAMES: string[] = [
  'Buddy', 'Duke', 'Reggie', 'Mack', 'Vic', 'Lonnie', 'Hollis', 'Gus', 'Earl', 'Wade',
  'Frankie', 'Sonny', 'Rusty', 'Deke', 'Cal', 'Boone', 'Tuck', 'Rocco', 'Grady', 'Hank',
  'Ozzie', 'Slater', 'Doyle', 'Bram', 'Coy', 'Walt', 'Denny', 'Griff', 'Shane', 'Lou',
  'Marv', 'Otto', 'Pike', 'Reid', 'Sarge', 'Tex', 'Wyatt', 'Zeb', 'Ansel', 'Bo',
  'Cutter', 'Dallas', 'Ed', 'Fenner', 'Gaines', 'Hoyt', 'Ike', 'Jethro', 'Knox', 'Lem',
  'Moss', 'Nash', 'Odell', 'Pace', 'Quill', 'Rance', 'Silas', 'Tobin', 'Uriah', 'Vance',
  'Wes', 'Yance', 'Zane', 'Ace', 'Bram', 'Cole', 'Dutch', 'Ellis', 'Flint', 'Gable',
  'Hutch', 'Ives', 'Judd', 'Kirby', 'Lyle', 'Monte', 'Nolan', 'Orin', 'Perch', 'Quade',
  'Rex', 'Slim', 'Trent', 'Ulric', 'Vern', 'Weston', 'Yates', 'Zeke', 'Abel', 'Briar',
  'Cash', 'Dash', 'Emory', 'Fisk', 'Gunnar', 'Holt', 'Irv', 'Jax', 'Kip', 'Lars',
];

/** Feminine and unisex first names, for the women's division. */
export const FEMININE_FIRST_NAMES: string[] = [
  'Roxy', 'Delilah', 'Marlowe', 'Sable', 'Vesper', 'Harlow', 'Junie', 'Cricket', 'Blaze', 'Ember',
  'Frankie', 'Reyna', 'Dutchess', 'Coral', 'Wren', 'Scout', 'Nova', 'Zara', 'Piper', 'Sasha',
  'Vixen', 'Talon', 'Raine', 'Josie', 'Lux', 'Mabel', 'Odessa', 'Priss', 'Quinn', 'Rowan',
  'Sable', 'Tamsin', 'Ursa', 'Valentina', 'Winnie', 'Xiomara', 'Yolanda', 'Zelda', 'Agatha', 'Birdie',
];

/**
 * Both pools together, for anything that does not care — the ring-name
 * blocklist check, the editor's random button, and so on.
 */
export const FIRST_NAMES: string[] = [...MASCULINE_FIRST_NAMES, ...FEMININE_FIRST_NAMES];

export const SURNAMES: string[] = [
  'Buchanan', 'McCready', 'Vance', 'Holloway', 'Sutter', 'Kincaid', 'Dressler', 'Malone', 'Ferris', 'Odom',
  'Boone', 'Crane', 'Dunmore', 'Ellison', 'Farrow', 'Gantry', 'Halloran', 'Ingram', 'Jessup', 'Kessler',
  'Lassiter', 'Marsh', 'Nettles', 'Orson', 'Prentice', 'Quarles', 'Rutledge', 'Stroud', 'Tolliver', 'Utley',
  'Vandermeer', 'Whitlock', 'Yarrow', 'Zellner', 'Ashworth', 'Brannigan', 'Culpepper', 'Draven', 'Eastman', 'Fenwick',
  'Gallows', 'Hargrove', 'Ives', 'Jorgensen', 'Kavanagh', 'Lockwood', 'Mercer', 'Nakamura', 'Ostrander', 'Paxton',
  'Quiller', 'Ravenscroft', 'Steadman', 'Thackeray', 'Underhill', 'Voss', 'Wexford', 'Yancey', 'Ziegler', 'Ambrose',
  'Blackwood', 'Cartwright', 'Delacroix', 'Emerson', 'Fairbanks', 'Grissom', 'Hatcher', 'Isley', 'Jarrett', 'Kirkland',
  'Lambert', 'Montague', 'Norwood', 'Ogden', 'Pruitt', 'Quintero', 'Radcliffe', 'Sinclair', 'Thorne', 'Upton',
  'Vaughn', 'Wallace', 'Xander', 'Yates', 'Zane', 'Applewhite', 'Bramwell', 'Cockburn', 'Dinsmore', 'Everhart',
  'Fitch', 'Gables', 'Hollis', 'Ipswich', 'Jencks', 'Kettering', 'Lowry', 'Mabry', 'Nixon', 'Overstreet',
  'Pemberton', 'Quaid', 'Rourke', 'Stillwater', 'Tanner', 'Usher', 'Vantage', 'Winters', 'Yeager', 'Zorn',
  'Ashby', 'Blythe', 'Corliss', 'Duvall', 'Eldridge', 'Frost', 'Gunderson', 'Haywood', 'Ivers', 'Jessop',
  'Killian', 'Lachance', 'Merritt', 'Nesbitt', 'Orwell', 'Pelham', 'Quist', 'Ruskin', 'Stavros', 'Tremaine',
];

// Pattern B — epithet nouns and adjective+noun combos.
export const EPITHET_NOUNS: string[] = [
  'Midwinter', 'Boomtown', 'Needles', 'Cyclone', 'Ironside', 'Blackout', 'Sundown', 'Fever',
  'Rampage', 'Vandal', 'Riptide', 'Grit', 'Havoc', 'Wildfire', 'Bulldog', 'Sledge',
  'Wreckage', 'Thornapple', 'Backlash', 'Crossfire', 'Grimstone', 'Longshot', 'Payback', 'Redline',
  'Stormfront', 'Undertow', 'Warpath', 'Zero', 'Ashcroft', 'Bonecrusher', 'Cutthroat', 'Doomsday',
];

export const EPITHET_ADJECTIVES: string[] = [
  'Iron', 'Crimson', 'Wild', 'Midnight', 'Diamond', 'Savage', 'Steel', 'Golden',
  'Rogue', 'Copper', 'Neon', 'Silver', 'Wicked', 'Solar', 'Frost', 'Vicious',
  'Royal', 'Toxic', 'Velvet', 'Granite',
];

// Pattern C — title prefixes.
export const NAME_TITLES: string[] = [
  'Sergeant', 'Major', 'Doctor', 'Colonel', 'Captain', 'Reverend', 'Professor', 'Deacon',
  'Marshal', 'Commander', 'Baron', 'Duke', 'General', 'Cardinal', 'Ambassador', 'Judge',
];
