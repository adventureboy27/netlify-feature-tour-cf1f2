// What each promotion IS — and therefore what its belts are called.
//
// A wrestling company is not a generic box with a rating attached. It has a
// house style, a thing it is known for, and a naming convention that follows
// from both. The territory outfit running armories calls its belt the
// "Mid-South Heavyweight Title"; the glossy national calls it the "World
// Championship". Both are correct, and which one you are looking at tells you
// what kind of company you are dealing with.
//
// The identity also feeds the sim: a hardcore promotion draws better with
// violence, a technical one with workrate, and a wrestler whose style fits
// the house style is worth more there than elsewhere.

import type { Id, PromotionArchetype, TitleTier, WrestlingStyle, StyleProfile } from '../engine/types';

export type { PromotionArchetype };

/**
 * The belt a company is known for beyond the world title — the one that only
 * makes sense *here*. A hardcore promotion's deathmatch title would be
 * absurd in a technical company, and that is the point.
 */
export interface SignatureBelt {
  qualifier: string;
  blurb: string;
  tier: TitleTier;
  prestige: number;
  /** Traditionally defended under this stipulation. */
  stipulationId: Id;
}

export interface PromotionIdentity {
  archetype: PromotionArchetype;
  /** The house style, in two or three words, for a chart row. */
  label: string;
  /** One line for the ratings board and the database screen. */
  knownFor: string;
  /** Styles that thrive here. Wrestlers matching these are worth more. */
  favouredStyles: WrestlingStyle[];
  /** 0-100 — how much violence the audience will take before it sours. */
  violenceTolerance: number;
  /** 0-100. High means workrate draws; low means star power draws. */
  workrateVsStarPower: number;
  /** Word used for a championship. "Title" and "Championship" read differently. */
  beltWord: 'Championship' | 'Title';
  /** Geographic or grandiose qualifier for the top belt. */
  topBeltQualifier: string;
  /** What the top belt means here. */
  topBeltBlurb: string;
  /** Qualifier for the secondary belt. */
  secondaryBeltQualifier: string;
  /** What the secondary belt is for. Every promotion answers this differently. */
  secondaryBeltBlurb: string;
  /** Tier of that secondary belt — a TV title and a cruiserweight title differ. */
  secondaryBeltTier: TitleTier;
  signatureBelt: SignatureBelt;
}

export const PROMOTION_IDENTITIES: Record<PromotionArchetype, PromotionIdentity> = {
  territory: {
    archetype: 'territory',
    label: 'Territory',
    knownFor: 'Armories, dead-loyal regulars, and a card that barely changes week to week',
    favouredStyles: ['bruiser', 'oldSchool', 'technical'],
    violenceTolerance: 55,
    workrateVsStarPower: 45,
    beltWord: 'Title',
    topBeltQualifier: 'Heavyweight',
    topBeltBlurb: 'The one every regular in this building knows by heart. Whoever holds it headlines, no argument.',
    secondaryBeltQualifier: 'Junior Heavyweight',
    secondaryBeltBlurb: 'For the smaller men, and exactly the place a future main eventer gets made.',
    secondaryBeltTier: 'secondary',
    signatureBelt: {
      qualifier: 'Brass Knuckles',
      blurb: 'Settled out on the street. Nobody has ever won this one without bleeding for it.',
      tier: 'tertiary',
      prestige: 40,
      stipulationId: 'streetFight',
    },
  },
  hardcore: {
    archetype: 'hardcore',
    label: 'Hardcore',
    knownFor: 'Weapons, blood, and an audience that flat-out expects both, every single week',
    favouredStyles: ['hardcore', 'bruiser', 'striker'],
    violenceTolerance: 95,
    workrateVsStarPower: 40,
    beltWord: 'Championship',
    topBeltQualifier: 'Heavyweight',
    topBeltBlurb: 'Held by whoever is still standing when the smoke clears at the end of the night.',
    secondaryBeltQualifier: 'Television',
    secondaryBeltBlurb: 'Defended every single week on television, whatever shape the champion happens to be in.',
    secondaryBeltTier: 'television',
    signatureBelt: {
      qualifier: 'Deathmatch',
      blurb: 'Tables, and then whatever else the crowd brought in with them. Careers end over this one.',
      tier: 'hardcore',
      prestige: 55,
      stipulationId: 'flamingTables',
    },
  },
  technical: {
    archetype: 'technical',
    label: 'Technical',
    knownFor: 'Long matches, clean finishes, and a crowd that genuinely counts holds along with them',
    favouredStyles: ['technical', 'submission', 'allRounder'],
    violenceTolerance: 30,
    workrateVsStarPower: 85,
    beltWord: 'Championship',
    topBeltQualifier: 'World',
    topBeltBlurb: 'Won right there on the mat, in front of people who can genuinely tell the difference.',
    secondaryBeltQualifier: 'Pure',
    secondaryBeltBlurb: 'Rope breaks are strictly limited and this referee does not budge. No shortcuts, period.',
    secondaryBeltTier: 'secondary',
    signatureBelt: {
      qualifier: 'Iron Man',
      blurb: 'Sixty grueling minutes, most falls wins. You do not walk away with this one by getting lucky.',
      tier: 'tertiary',
      prestige: 52,
      stipulationId: 'ironMan',
    },
  },
  sportsEntertainment: {
    archetype: 'sportsEntertainment',
    label: 'Sports entertainment',
    knownFor: 'Massive screens, even bigger characters, and actual wrestling squeezed in somewhere between it all',
    favouredStyles: ['showman', 'powerhouse', 'giant'],
    violenceTolerance: 45,
    workrateVsStarPower: 25,
    beltWord: 'Championship',
    topBeltQualifier: 'World Heavyweight',
    topBeltBlurb: 'The face of this entire company carries it, whether or not they can actually wrestle a lick.',
    secondaryBeltQualifier: 'Intercontinental',
    secondaryBeltBlurb: 'The workers’ belt, through and through. It has stolen more shows than the world title ever has.',
    secondaryBeltTier: 'secondary',
    signatureBelt: {
      qualifier: 'Hardcore',
      blurb: 'Defended anywhere, any time, as long as somebody can scrounge up a referee.',
      tier: 'hardcore',
      prestige: 38,
      stipulationId: 'hardcore',
    },
  },
  lucha: {
    archetype: 'lucha',
    label: 'Lucha libre',
    knownFor: 'Masks, high-flying dives, and mask-versus-mask matches that genuinely mean something',
    favouredStyles: ['luchador', 'highFlyer', 'technical'],
    violenceTolerance: 50,
    workrateVsStarPower: 75,
    beltWord: 'Championship',
    topBeltQualifier: 'Universal',
    topBeltBlurb: 'The single biggest prize in the building, and by far the hardest one to unmask.',
    secondaryBeltQualifier: 'Cruiserweight',
    secondaryBeltBlurb: 'This is where the dives happen. Half this crowd came here just for this match.',
    secondaryBeltTier: 'cruiserweight',
    signatureBelt: {
      qualifier: 'Máscara de Oro',
      blurb: 'Only ever defended mask against mask. Losing this one costs a whole lot more than a belt.',
      tier: 'tertiary',
      prestige: 60,
      stipulationId: 'maskVsMask',
    },
  },
  oldSchool: {
    archetype: 'oldSchool',
    label: 'Old school',
    knownFor: 'Sixty-minute draws, clean breaks, and absolutely no nonsense whatsoever',
    favouredStyles: ['oldSchool', 'technical', 'bruiser'],
    violenceTolerance: 25,
    workrateVsStarPower: 70,
    beltWord: 'Title',
    topBeltQualifier: 'World Heavyweight',
    topBeltBlurb: 'Travels with the champion and gets defended strictly on merit. This one has a real lineage.',
    secondaryBeltQualifier: 'National',
    secondaryBeltBlurb: 'One step below the world title, and the very last stop before it.',
    secondaryBeltTier: 'secondary',
    signatureBelt: {
      qualifier: 'Texas Death',
      blurb: 'No count, no bell, no mercy. You finish it, or you simply do not get back up.',
      tier: 'tertiary',
      prestige: 45,
      stipulationId: 'lastManStanding',
    },
  },
  athletic: {
    archetype: 'athletic',
    label: 'Athletic',
    knownFor: 'Athletes first, characters a distant second, and a fast-moving card start to finish',
    favouredStyles: ['highFlyer', 'allRounder', 'striker'],
    violenceTolerance: 40,
    workrateVsStarPower: 90,
    beltWord: 'Championship',
    topBeltQualifier: 'Grand',
    topBeltBlurb: 'Won right there in the ring by whoever is having the best year of their life. No politics involved.',
    secondaryBeltQualifier: 'Openweight',
    secondaryBeltBlurb: 'No divisions, no excuses — anybody on this roster can step up and challenge for it.',
    secondaryBeltTier: 'secondary',
    signatureBelt: {
      qualifier: 'Ladder',
      blurb: 'Hung high above that ring at every single defense. Climb for it, or hand it right over.',
      tier: 'tertiary',
      prestige: 48,
      stipulationId: 'ladder',
    },
  },
};

/** The identity table entry for a promotion. */
export function identityOf(archetype: PromotionArchetype): PromotionIdentity {
  return PROMOTION_IDENTITIES[archetype];
}

export const PROMOTION_ARCHETYPES = Object.keys(PROMOTION_IDENTITIES) as PromotionArchetype[];

/**
 * A short prefix for belt names. "Continental Championship Wrestling" becomes
 * "Continental"; an acronym-shaped name is left alone.
 */
export function beltPrefix(promotionName: string): string {
  const words = promotionName.split(/\s+/);
  const first = words[0] ?? promotionName;
  // Drop the generic tail words a promotion name usually ends in.
  const generic = /^(wrestling|championship|pro|federation|alliance|league|combat|grappling)$/i;
  if (words.length > 1 && !generic.test(first)) return first;
  return words.filter((word) => !generic.test(word))[0] ?? first;
}

/** How much this promotion values a given wrestling style, -1..1. */
export function styleFit(identity: PromotionIdentity, style: WrestlingStyle): number {
  if (identity.favouredStyles.includes(style)) return 1;
  // A hardcore company has no use for a pure technician, and vice versa.
  const opposed: Partial<Record<PromotionArchetype, WrestlingStyle[]>> = {
    hardcore: ['technical', 'submission'],
    technical: ['hardcore'],
    oldSchool: ['hardcore', 'showman'],
    athletic: ['giant'],
  };
  return opposed[identity.archetype]?.includes(style) ? -0.6 : 0;
}

/**
 * A promotion books what it is known for.
 *
 * Lives here rather than in state/world.ts because engine/world/newPromotions.ts
 * needs it to found a company mid-save, and engine/ is not allowed to reach
 * into the store. It is pure identity content either way.
 */
export function styleProfileFor(archetype: PromotionArchetype): StyleProfile {
  const identity = identityOf(archetype);
  return {
    preferredStyles: [...identity.favouredStyles],
    violenceTolerance: identity.violenceTolerance,
    workrateVsStarPower: identity.workrateVsStarPower,
    divisionFocus: ['mens'],
    promoHeavy: identity.workrateVsStarPower < 40,
  };
}
