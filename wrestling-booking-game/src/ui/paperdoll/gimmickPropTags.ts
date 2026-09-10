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
  'Rural and outlaw': ['cowboy', 'bandana'],
  'More rural and agricultural': ['strawhat', 'bandana'],
  'Mystical and supernatural': ['hood', 'veil'],
  'Historical and mythic': ['crown', 'laurel', 'helmet'],
  'Sci-fi and speculative': ['visor', 'goggles'],
  'Weather and disaster': ['goggles', 'bandana'],
  'Sports crossovers': ['headband'],
  'More combat sports': ['headband'],
  'Showbiz and entertainment': ['shades', 'sunglasses'],
  'Music, beyond the one rock-star slot': ['bandana', 'shades'],
  'Corporate, political, and media': ['tie', 'glasses'],
  'More corporate and pop culture': ['tie', 'glasses'],
  'Blue collar': ['hardhat'],
  'More everyday jobs': ['cap'],
  // Not "mask" — assignLook.ts treats any prop id containing "mask" as a
  // full face-covering reserved for Wrestler.masked === true, so a medical
  // prop must avoid that substring or it would silently stop being offered
  // to anyone who isn't supposed to be masked. Name the actual file
  // something like "both-surgical-covering--tint.png".
  'Medical': ['surgical'],
  'Animal and nature acts': ['hood'],
  'Tech and modern': ['visor', 'glasses'],
  'School and education': ['glasses'],
};
