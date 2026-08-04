// Turning a gimmick into an outfit, and a stable into a matching set.
//
// Two jobs, both about the same thing — a wrestler's look should follow from
// who they are, not be a separate thing the player has to maintain:
//
//   applyGimmickLook   grant a gimmick change (§20) and they come out next
//                      week dressed for it. A Luchador puts a mask on. A
//                      Rich Snob is suddenly in gold. The booker approved a
//                      character change, not a costume-fitting appointment.
//
//   effectiveAppearance  members of a stable wrestle in matching colours.
//                        The group's palette is layered *over* the
//                        wrestler's own rather than written into it, so
//                        leaving the group gives them their own look back.
//
// Gimmicks describe themselves semantically (GimmickLook) because `data/`
// must not know what cells the sprite atlas cuts. This file is the only
// place that translates intent into trait numbers.

import type { Appearance, Gimmick, Stable, Wrestler } from '../types';
import type { Rng } from '../rng';
import { pick, randInt } from '../rng';

// Trait values, chosen against the mapping tables in
// ui/paperdoll/atlas/traits.ts. Kept as small named sets so a change to the
// atlas means editing these lists rather than hunting magic numbers.
const ATTIRE_TOPS = {
  flashy: [1, 6, 10, 14], // singlet
  plain: [2, 7, 11], // tank
  formal: [5, 12, 13], // vest / long sleeve
  brawler: [3, 9, 15], // tee
  athletic: [1, 10, 14], // singlet
  savage: [0, 8], // bare
} as const;

const ATTIRE_BOTTOMS = {
  flashy: [2, 6, 10, 14], // tights
  plain: [0, 4, 8, 12], // trunks
  formal: [5, 15], // jeans
  brawler: [3, 9], // shorts
  athletic: [1, 7, 13], // trunks + pads
  savage: [0, 8], // trunks
} as const;

const BOOTS = {
  flashy: [1, 5], // high boots
  plain: [0, 3, 7],
  formal: [2, 6], // low boots
  brawler: [4, 8], // sneakers
  athletic: [0, 3],
  savage: [9], // barefoot
} as const;

// Indices into ATTIRE_PALETTE (ui/paperdoll/palette.ts).
const PALETTES = {
  bright: [0, 1, 2, 3, 13, 14],
  dark: [5, 8, 11, 17],
  monochrome: [17, 18, 19],
  gold: [1, 14, 2, 18],
  blood: [0, 12, 17],
  earthy: [7, 8, 9, 19],
} as const;

const HAIR = {
  long: [4, 8, 12, 16],
  short: [1, 2, 6, 14],
  wild: [11, 20, 7, 17], // afro / mohawk
  bald: [0],
  any: [] as number[],
} as const;

/**
 * Restyle a wrestler's appearance to fit a gimmick. Only touches what the
 * gimmick actually specifies — skin tone, build, face and every other part of
 * who they are is left exactly alone, because a gimmick change is a change of
 * character, not of person.
 */
export function applyGimmickLook(appearance: Appearance, gimmick: Gimmick, rng: Rng): Appearance {
  const look = gimmick.look;
  if (!look) return appearance;

  const next: Appearance = { ...appearance };

  if (look.masked === 'required' && next.mask === 0) next.mask = randInt(rng, 1, 11);
  if (look.masked === 'forbidden') next.mask = 0;

  if (look.attire) {
    next.attireTop = pick(rng, ATTIRE_TOPS[look.attire] as unknown as number[]);
    next.attireBottom = pick(rng, ATTIRE_BOTTOMS[look.attire] as unknown as number[]);
    next.boots = pick(rng, BOOTS[look.attire] as unknown as number[]);
  }

  if (look.palette) {
    const options = PALETTES[look.palette] as unknown as number[];
    next.primaryColor = pick(rng, options);
    next.secondaryColor = pick(rng, options);
    // The accent is allowed off-palette — a gimmick that is all one colour
    // reads as a uniform, not as a character.
    next.accentColor = randInt(rng, 0, 19);
  }

  if (look.hair && look.hair !== 'any') {
    const options = HAIR[look.hair];
    if (options.length > 0) next.hairStyle = pick(rng, options as unknown as number[]);
  }

  return next;
}

/**
 * The appearance a wrestler actually wrestles in tonight, with their stable's
 * colours applied if they're in one that dresses alike.
 *
 * Non-destructive on purpose: `wrestler.appearance` keeps their own colours
 * the whole time they're in the group, so disbanding the stable — or throwing
 * them out of it — restores their look with no bookkeeping.
 */
export function effectiveAppearance(wrestler: Wrestler, stables: readonly Stable[]): Appearance {
  const group = stables.find(
    (s) => s.disbandedWeek === null && s.unifiedLook && s.colors !== null && s.memberIds.includes(wrestler.id),
  );
  if (!group?.colors) return wrestler.appearance;

  return {
    ...wrestler.appearance,
    primaryColor: group.colors.primary,
    secondaryColor: group.colors.secondary,
    accentColor: group.colors.accent,
  };
}

/**
 * Pick colours for a new group. Takes them from the leader (or the first
 * member) so a stable formed around someone looks like an extension of that
 * person rather than an unrelated new palette.
 */
export function stableColorsFrom(founder: Wrestler): NonNullable<Stable['colors']> {
  return {
    primary: founder.appearance.primaryColor,
    secondary: founder.appearance.secondaryColor,
    accent: founder.appearance.accentColor,
  };
}

/** Everyone whose look the group is currently overriding. */
export function membersWearingColors(stable: Stable): readonly string[] {
  if (stable.disbandedWeek !== null || !stable.unifiedLook || !stable.colors) return [];
  return stable.memberIds;
}
