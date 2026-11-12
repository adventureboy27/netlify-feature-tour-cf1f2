// Loose keyword hints, matched against a prop asset's own file-name id, so
// wrestlers in a given Gimmick.category prefer a themed accessory when the
// prop library happens to have one. Adding "both-military-cap.png" to
// assets/prop is the entire way to wire it up here — nothing in code has to
// know that file exists. A category with no entry just never gets a themed
// prop, which is fine; assignLook.ts falls back to no accessory.
//
// Deliberately keyed by the 24 broad categories in data/gimmicks.ts, not the
// ~200 individual gimmicks — curating per-gimmick would mean hand-picking an
// accessory for 200 entries, most of which (Gimmick.prop) are hand-held ring
// props like a wrench or a lasso that would not even be visible inside the
// bust crop. Categories keep this to a size a person can actually maintain.
export const GIMMICK_CATEGORY_PROP_KEYWORDS: Record<string, readonly string[]> = {
  'Military and paramilitary': ['military', 'army', 'camo'],
  'Law and disorder': ['badge', 'shades', 'sunglasses', 'cuffs'],
  'Rural and outlaw': ['cowboy', 'bandana', 'eye-patch'],
  'More rural and agricultural': ['strawhat', 'bandana'],
  'Mystical and supernatural': ['hood', 'veil', 'wizard', 'skull', 'corpse', 'devil', 'halo'],
  'Historical and mythic': ['crown', 'laurel', 'helmet', 'war-mask', 'robe'],
  'Sci-fi and speculative': ['visor', 'goggles'],
  'Weather and disaster': ['goggles', 'bandana'],
  'Sports crossovers': ['headband', 'towel', 'medal', 'number-one', 'cheek-stripes'],
  'More combat sports': ['headband', 'towel', 'nose-bandage', 'karate', 'ninja'],
  'Showbiz and entertainment': ['shades', 'sunglasses', 'top-hat', 'boa', 'glam', 'star', 'clown', 'jester'],
  'Music, beyond the one rock-star slot': ['bandana', 'shades', 'headphones', 'star-eye', 'lightning', 'chain', 'spikes'],
  'Corporate, political, and media': ['tie', 'glasses', 'top-hat', 'monocle'],
  'More corporate and pop culture': ['tie', 'glasses'],
  'Blue collar': ['hardhat'],
  'More everyday jobs': ['cap', 'beanie'],
  // Not "mask" — assignLook.ts treats any prop id containing "mask" as a
  // full face-covering reserved for Wrestler.masked === true, so a medical
  // prop must avoid that substring or it would silently stop being offered
  // to anyone who isn't supposed to be masked. Name the actual file
  // something like "both-surgical-covering--tint.png".
  'Medical': ['surgical', 'lab-coat'],
  'Animal and nature acts': ['hood', 'bunny', 'whiskers', 'paw', 'dog-collar'],
  'Tech and modern': ['visor', 'glasses'],
  'School and education': ['glasses'],
  'Food and hospitality': ['chef', 'bowtie'],
  'Travel and exploration': ['sombrero', 'lei', 'fez', 'strawhat', 'goggles', 'hawaiian', 'long-coat'],
  'Intellectual and eccentric': ['monocle', 'bowtie', 'glasses', 'wizard', 'beret', 'fez', 'lab-coat'],
  'Everyman-with-an-edge': ['beanie', 'cap', 'nose-bandage'],
  Classic: ['robe', 'towel'],
};

// A whole costume, keyed by one word. When a gimmick's NAME matches (see
// NAME_THEMES), every slot prefers pieces from that one theme, so a pirate
// gets the hat, the shirt, the coat and the eye patch together instead of
// one piece each from four different ideas.
export const THEMES: Record<string, readonly string[]> = {
  pirate: ['pirate', 'eye-patch'],
  karate: ['karate', 'headband'],
  ninja: ['ninja'],
  chef: ['chef'],
  monster: ['monster', 'hockey', 'corpse', 'skull', 'black-tears'],
  cowboy: ['cowboy', 'outlaw-bandana', 'long-coat'],
  science: ['lab-coat', 'glasses', 'goggles'],
  royal: ['robe', 'crown', 'fur-coat'],
  showman: ['robe', 'top-hat', 'boa', 'glam', 'fur-coat'],
  mystic: ['wizard', 'hood', 'robe-black', 'robe-purple', 'veil'],
  holy: ['robe-white', 'robe-black', 'halo'],
  viking: ['viking', 'war-mask', 'fur-coat'],
  party: ['party', 'hawaiian', 'lei', 'heart-shades'],
  biker: ['bandana', 'sunglasses', 'chain', 'long-coat'],
};

// Lower-cased substring of Gimmick.name -> theme. First match wins.
export const NAME_THEMES: readonly (readonly [string, keyof typeof THEMES])[] = [
  ['corsair', 'pirate'], ['stowaway', 'pirate'], ['pirate', 'pirate'],
  ['ninja', 'ninja'], ['ronin', 'karate'], ['dohyo', 'karate'], ['low kick', 'karate'], ['karate', 'karate'],
  ['chef', 'chef'], ['line cook', 'chef'], ['butcher', 'chef'],
  ['monster', 'monster'], ['old bones', 'monster'], ['blackout', 'monster'],
  ['sheriff', 'cowboy'], ['wrangler', 'cowboy'], ['rattler', 'cowboy'], ['dust bowl', 'cowboy'], ['honky tonk', 'cowboy'],
  ['mad science', 'science'], ['surgeon', 'science'], ['dentist', 'science'], ['anesthesiologist', 'science'], ['professor', 'science'],
  ['aristocrat', 'royal'], ['rich snob', 'royal'], ['pharaoh', 'royal'], ['founder', 'royal'], ['franchise', 'royal'],
  ['showbiz', 'showman'], ['headliner', 'showman'], ['ringmaster', 'showman'], ['marquee', 'showman'], ['prime time', 'showman'], ['center stage', 'showman'],
  ['hex', 'mystic'], ['shaman', 'mystic'], ['hypnotist', 'mystic'], ['cult leader', 'mystic'],
  ['preacher', 'holy'], ['reverend', 'holy'],
  ['northland', 'viking'], ['highland', 'viking'], ['iron age', 'viking'],
  ['party animal', 'party'], ['good times', 'party'], ['happy hour', 'party'],
  ['biker', 'biker'], ['long haul', 'biker'],
];

// Costume pieces that only make sense on the act they belong to. Never
// handed out at random.
export const THEMED_ONLY_IDS: readonly string[] = [
  'karate-gi', 'ninja-gi', 'pirate-shirt', 'pirate-coat', 'pirate-hat', 'pirate-headscarf', 'pirate-earring',
  'lab-coat', 'chef-hat',
];

// Played for laughs. Still themed onto the acts that ask for one (a chef
// gets the chef hat), but when a piece is being handed out at random these
// are mostly held back, so the roster is not half traffic cones.
export const GOOFY_IDS: readonly string[] = [
  'chef-hat', 'party-hat', 'propeller-beanie', 'traffic-cone', 'jester-hat', 'bunny-ears', 'halo', 'santa-hat',
  'fez', 'sombrero', 'wizard-hat', 'ten-gallon-cowboy-hat', 'viking-helmet', 'devil-horns',
  'clown-nose', 'groucho-glasses', '3d-glasses', 'heart-shades', 'cat-whiskers', 'monocle',
  'clown-paint', 'cheek-hearts', 'rosy-cheeks',
  'lei', 'feather-boa',
  'combover', 'friar-bald', 'bowl', 'beehive', 'liberty-spikes',
  'smiley', 'paw',
  'hearts', 'leopard', 'sequins',
  'monster-mask-pumpkin', 'hawaiian-shirt', 'fur-coat',
];
