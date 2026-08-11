// Championships — §3.1.
//
// A promotion's belts are its spine: they are what the card is built toward,
// what a wrestler's ego is measured in, and the clearest thing on a roster
// screen. The starting set is deliberately small — a world title, a secondary,
// and a tag championship — because a promotion with six belts has none that
// mean anything.
//
// §3.1 is locked on two points and both are honoured here: a singles title is
// tied to its division at creation and never moves, and tag titles are not.

import type {
  Id,
  PromotionArchetype,
  Title,
  TitleBlueprint,
  TitleTier,
} from '../engine/types';

export type { TitleBlueprint };
import { identityOf, beltPrefix } from './promotionIdentity';

/**
 * What a belt is worth the day it is created, by what kind of belt it is.
 *
 * A world championship opens above a tag championship because the company
 * says it is the top of the mountain, and everything after that is earned.
 */
const PRESTIGE_BY_TIER: Record<TitleTier, number> = {
  world: 70,
  secondary: 45,
  television: 40,
  cruiserweight: 40,
  hardcore: 40,
  tertiary: 30,
  tag: 50,
  trios: 35,
};

export function startingPrestige(tier: TitleTier): number {
  return PRESTIGE_BY_TIER[tier] ?? 35;
}

/** Straps and plates by tier, so a world title never looks like a tag belt. */
const COLORWAYS: Partial<Record<TitleTier, { strap: string; plate: string }>> = {
  world: { strap: '#3a2214', plate: '#f1c40f' },
  secondary: { strap: '#212529', plate: '#adb5bd' },
  television: { strap: '#1b2a3a', plate: '#8fb8de' },
  cruiserweight: { strap: '#2a1b3a', plate: '#b58fde' },
  hardcore: { strap: '#3a1414', plate: '#c0392b' },
  tertiary: { strap: '#1f2b1f', plate: '#a3c586' },
  tag: { strap: '#2b1810', plate: '#c0c0c0' },
  trios: { strap: '#2b1810', plate: '#c0c0c0' },
};

function colorwayFor(tier: TitleTier) {
  return COLORWAYS[tier] ?? COLORWAYS.tertiary!;
}

/**
 * The belts a promotion starts with, named out of its own identity. A
 * hardcore company crowns a Deathmatch Champion; a technical one runs an
 * Iron Man Title. Two companies never have the same lineup, which is the
 * point — the belt tells you what kind of company you are looking at.
 */
export function startingBlueprints(archetype: PromotionArchetype): TitleBlueprint[] {
  const identity = identityOf(archetype);
  const word = identity.beltWord;

  return [
    {
      suffix: `${identity.topBeltQualifier} ${word}`,
      blurb: identity.topBeltBlurb,
      tier: 'world',
      division: 'mens',
      weightClass: 'open',
      signatureStipulationId: null,
    },
    {
      suffix: `${identity.secondaryBeltQualifier} ${word}`,
      blurb: identity.secondaryBeltBlurb,
      tier: identity.secondaryBeltTier,
      division: 'mens',
      weightClass: 'open',
      signatureStipulationId: null,
    },
    {
      suffix: `Women's ${word}`,
      blurb: 'The top of the women’s division, and its whole reason to exist.',
      tier: 'world',
      division: 'womens',
      weightClass: 'open',
      signatureStipulationId: null,
    },
    {
      suffix: `Tag Team ${word}`,
      blurb: 'Two people who trust each other beat two who are better. Usually.',
      tier: 'tag',
      division: 'open',
      weightClass: 'open',
      signatureStipulationId: null,
    },
    {
      suffix: `${identity.signatureBelt.qualifier} ${word}`,
      blurb: identity.signatureBelt.blurb,
      tier: identity.signatureBelt.tier,
      division: 'open',
      weightClass: 'open',
      signatureStipulationId: identity.signatureBelt.stipulationId,
    },
  ];
}

/**
 * Build a promotion's opening belts. Vacant to begin with — a championship
 * nobody won yet is a tournament waiting to happen, which is a better opening
 * than handing one out.
 */
export function createStartingTitles(
  promotionId: string,
  promotionName: string,
  archetype: PromotionArchetype,
  /**
   * The player's own lineup, if they built one on the new-game screen.
   * Omitted, the archetype's suggested set is used — which is what every
   * rival promotion in the world gets.
   */
  blueprints?: readonly TitleBlueprint[],
): Title[] {
  // A short prefix reads better on a roster card than the full promotion name.
  const prefix = beltPrefix(promotionName);

  return (blueprints ?? startingBlueprints(archetype)).map((blueprint, i) => ({
    id: `${promotionId}-title-${i}`,
    promotionId,
    name: `${prefix} ${blueprint.suffix}`,
    blurb: blueprint.blurb,
    tier: blueprint.tier,
    division: blueprint.division,
    weightClass: blueprint.weightClass,
    lineageProtected: true,
    vacant: true,
    prestige: startingPrestige(blueprint.tier),
    currentHolderIds: [],
    reignStartWeek: 0,
    // A belt starts its clock the day the company opens, so a promotion that
    // never puts its titles on the line loses them like anybody else.
    lastDefendedWeek: 0,
    interimHolderIds: [],
    interimSinceWeek: null,
    history: [],
    colorway: colorwayFor(blueprint.tier),
    signatureStipulationId: blueprint.signatureStipulationId,
  }));
}

/**
 * A short label for a card — "Heavyweight", not the whole mouthful. Drops the
 * promotion prefix and the trailing Championship/Title, which are the same on
 * every belt a company owns and so carry no information on a crowded card.
 */
export function shortTitleName(title: Title): string {
  const withoutWord = title.name.replace(/ (Championship|Title)$/, '');
  const words = withoutWord.split(/\s+/);
  return words.length > 1 ? words.slice(1).join(' ') : withoutWord;
}

/** Every belt a given promotion owns. World.titles holds everyone's. */
/** Whether a belt is one the company currently defends. */
export function isActiveTitle(title: Title): boolean {
  return !title.retiredWeek;
}

/**
 * A belt the company retired. It keeps every reign it ever had — that is the
 * whole point of retiring one rather than deleting it — and the records and
 * legacy screens still read it.
 */
export function retiredTitlesOf(titles: readonly Title[], promotionId: Id): Title[] {
  return titles.filter((t) => t.promotionId === promotionId && !isActiveTitle(t));
}

/**
 * A library of championships to start from.
 *
 * The house style suggests a lineup, but a booker who wants to build their
 * own should not be typing every belt from a blank field — and "Championship"
 * is not the only thing a promotion has ever put on the line. A trophy, a
 * crown, a cup and a medal all say something different about a company before
 * anybody has wrestled for them.
 *
 * These are starting points, not a menu: every field is editable the moment
 * it is picked.
 */
export interface TitlePreset extends TitleBlueprint {
  /** Grouping for the picker. */
  family: 'Championships' | 'Trophies and crowns' | 'Divisions' | 'Specialist';
}

export const TITLE_PRESETS: TitlePreset[] = [
  // --- The ordinary spine of a promotion -------------------------------
  {
    family: 'Championships',
    suffix: 'World Heavyweight Championship',
    blurb: 'The top of the mountain. Everything on the card is built toward it.',
    tier: 'world',
    division: 'mens',
    weightClass: 'heavyweight',
    signatureStipulationId: null,
  },
  {
    family: 'Championships',
    suffix: 'Undisputed Championship',
    blurb: 'One belt, no arguments, nobody with a claim to a different one.',
    tier: 'world',
    division: 'open',
    weightClass: 'open',
    signatureStipulationId: null,
  },
  {
    family: 'Championships',
    suffix: 'National Championship',
    blurb: 'The belt that says this company is bigger than the towns it runs.',
    tier: 'secondary',
    division: 'open',
    weightClass: 'open',
    signatureStipulationId: null,
  },
  {
    family: 'Championships',
    suffix: 'Television Championship',
    blurb: 'Defended every week on the show, whether it suits anybody or not.',
    tier: 'television',
    division: 'open',
    weightClass: 'open',
    signatureStipulationId: null,
  },
  {
    family: 'Championships',
    suffix: 'Tag Team Championship',
    blurb: 'Two people who trust each other beat two who are better. Usually.',
    tier: 'tag',
    division: 'open',
    weightClass: 'open',
    signatureStipulationId: null,
  },
  {
    family: 'Championships',
    suffix: 'Six-Man Tag Championship',
    blurb: 'Three a side, and twice the argument about who takes the fall.',
    tier: 'trios',
    division: 'open',
    weightClass: 'open',
    signatureStipulationId: null,
  },

  // --- Not a belt at all ------------------------------------------------
  {
    family: 'Trophies and crowns',
    suffix: 'Cup',
    blurb: 'Won in a tournament and carried for a year. Silver, not leather.',
    tier: 'secondary',
    division: 'open',
    weightClass: 'open',
    signatureStipulationId: null,
  },
  {
    family: 'Trophies and crowns',
    suffix: 'Crown',
    blurb: 'A king, and everybody else on the roster is not.',
    tier: 'secondary',
    division: 'open',
    weightClass: 'open',
    signatureStipulationId: null,
  },
  {
    family: 'Trophies and crowns',
    suffix: 'Trophy',
    blurb: 'It goes in a case, not around a waist, and it still gets fought over.',
    tier: 'tertiary',
    division: 'open',
    weightClass: 'open',
    signatureStipulationId: null,
  },
  {
    family: 'Trophies and crowns',
    suffix: 'Gold Medal',
    blurb: 'For the one who can genuinely wrestle, and everybody knows which one that is.',
    tier: 'tertiary',
    division: 'open',
    weightClass: 'open',
    signatureStipulationId: null,
  },
  {
    family: 'Trophies and crowns',
    suffix: 'Ring',
    blurb: 'Small, expensive, and worn where everybody can see it.',
    tier: 'tertiary',
    division: 'open',
    weightClass: 'open',
    signatureStipulationId: null,
  },
  {
    family: 'Trophies and crowns',
    suffix: 'Briefcase',
    blurb: 'A shot at the top, carried around until whoever holds it decides to use it.',
    tier: 'tertiary',
    division: 'open',
    weightClass: 'open',
    signatureStipulationId: null,
  },

  // --- Who it is for ----------------------------------------------------
  {
    family: 'Divisions',
    suffix: "Women's World Championship",
    blurb: 'The top of the women’s division, and its whole reason to exist.',
    tier: 'world',
    division: 'womens',
    weightClass: 'open',
    signatureStipulationId: null,
  },
  {
    family: 'Divisions',
    suffix: "Women's Tag Team Championship",
    blurb: 'Two of them, and a division deep enough to mean it.',
    tier: 'tag',
    division: 'womens',
    weightClass: 'open',
    signatureStipulationId: null,
  },
  {
    family: 'Divisions',
    suffix: 'Cruiserweight Championship',
    blurb: 'For the ones who move. Nobody heavy is getting near it.',
    tier: 'cruiserweight',
    division: 'open',
    weightClass: 'juniorHeavy',
    signatureStipulationId: null,
  },
  {
    family: 'Divisions',
    suffix: 'Junior Heavyweight Championship',
    blurb: 'The division where the wrestling happens and everybody knows it.',
    tier: 'cruiserweight',
    division: 'mens',
    weightClass: 'juniorHeavy',
    signatureStipulationId: null,
  },
  {
    family: 'Divisions',
    suffix: 'Openweight Championship',
    blurb: 'No divisions, no excuses. Anybody can challenge for it.',
    tier: 'secondary',
    division: 'open',
    weightClass: 'open',
    signatureStipulationId: null,
  },
  {
    family: 'Divisions',
    suffix: 'Rookie Championship',
    blurb: 'For the people who have not done anything yet. Somebody has to be first.',
    tier: 'tertiary',
    division: 'open',
    weightClass: 'open',
    signatureStipulationId: null,
  },

  // --- Belts with a rule attached ---------------------------------------
  {
    family: 'Specialist',
    suffix: 'Hardcore Championship',
    blurb: 'No count-outs, no disqualifications, and no shortage of challengers.',
    tier: 'hardcore',
    division: 'open',
    weightClass: 'open',
    signatureStipulationId: 'hardcore',
  },
  {
    family: 'Specialist',
    suffix: 'Deathmatch Championship',
    blurb: 'They know what they signed for and they came anyway.',
    tier: 'hardcore',
    division: 'open',
    weightClass: 'open',
    signatureStipulationId: 'flamingTables',
  },
  {
    family: 'Specialist',
    suffix: 'Iron Man Championship',
    blurb: 'Sixty minutes, most falls wins, and nobody argues with the result.',
    tier: 'secondary',
    division: 'open',
    weightClass: 'open',
    signatureStipulationId: 'ironMan',
  },
  {
    family: 'Specialist',
    suffix: 'Submission Championship',
    blurb: 'You do not pin anybody for this. They give up or they do not.',
    tier: 'secondary',
    division: 'open',
    weightClass: 'open',
    signatureStipulationId: 'submissionMatch',
  },
  {
    family: 'Specialist',
    suffix: 'Street Championship',
    blurb: 'Defended wherever it gets challenged for, and it usually is not in the ring.',
    tier: 'hardcore',
    division: 'open',
    weightClass: 'open',
    signatureStipulationId: 'streetFight',
  },
  {
    family: 'Specialist',
    suffix: 'Cage Championship',
    blurb: 'Won and lost inside the steel, and nobody has ever walked out of it happy.',
    tier: 'secondary',
    division: 'open',
    weightClass: 'open',
    signatureStipulationId: 'steelCage',
  },
];

export const TITLE_PRESET_FAMILIES = [
  'Championships',
  'Trophies and crowns',
  'Divisions',
  'Specialist',
] as const;

export function titlesOf(titles: readonly Title[], promotionId: Id): Title[] {
  // Active only. A retired belt still exists in world.titles for its lineage,
  // but "the company's championships" means the ones it defends — anything
  // that lists belts to book, defend or rank is asking about those.
  return titles.filter((t) => t.promotionId === promotionId && isActiveTitle(t));
}

/** Every belt this wrestler currently holds. */
export function titlesHeldBy(titles: readonly Title[], wrestlerId: string): Title[] {
  return titles.filter((t) => !t.vacant && t.currentHolderIds.includes(wrestlerId));
}

/**
 * Award a belt. Closes the previous reign and opens a new one.
 *
 * `holderAges` is optional only because the opening champions are crowned
 * before anybody has an age worth recording; everywhere else it is passed.
 */
export function awardTitle(title: Title, holderIds: string[], week: number, holderAges: number[] = []): Title {
  const history = [...title.history];
  const previous = history[history.length - 1];
  if (previous && previous.endWeek === null) {
    history[history.length - 1] = { ...previous, endWeek: week, endMethod: 'lostMatch' };
  }

  history.push({
    titleId: title.id,
    promotionId: title.promotionId,
    holderIds: [...holderIds],
    holderAges: [...holderAges],
    wonFromIds: title.vacant ? null : [...title.currentHolderIds],
    wonByMethod: 'match',
    startWeek: week,
    endWeek: null,
    endMethod: null,
  });

  return { ...title, vacant: false, currentHolderIds: [...holderIds], reignStartWeek: week, history };
}

/** How many weeks the current champion has held it. */
export function reignLength(title: Title, currentWeek: number): number {
  return title.vacant ? 0 : Math.max(0, currentWeek - title.reignStartWeek);
}
