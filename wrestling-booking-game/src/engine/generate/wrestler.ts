// Wrestler generation, booking-game-design.md §6, plus the hidden-talent
// model from §3.8. Where §6 doesn't specify a formula (attitude, charisma,
// coachability, toughness, weight, height, gender ratio, initial card
// status), a reasonable default is used and flagged // DESIGN.

import type { Rng } from '../rng';
import { clamp, gaussian, randInt, weightedPick, pick, chance } from '../rng';
import type { Appearance, Archetype, CardStatus, Id, Wrestler } from '../types';
import { ARCHETYPES, archetypeById } from '../../data/archetypes';
import { WRESTLING_STYLES } from '../../data/styles';
import { GIMMICKS } from '../../data/gimmicks';
import { generateName } from './name';
import { generateDistinctAppearance } from './appearance';
import { generateMoveSet } from './moveset';

export type Tier = 'jobber' | 'midcarder' | 'upper' | 'mainEventer';

const TIER_WEIGHTS: readonly (readonly [Tier, number])[] = [
  ['jobber', 0.3],
  ['midcarder', 0.45],
  ['upper', 0.18],
  ['mainEventer', 0.07],
];

const TIER_BASE_MEAN: Record<Tier, number> = {
  jobber: 38,
  midcarder: 55,
  upper: 70,
  mainEventer: 82,
};

const TIER_TO_CARD_STATUS: Record<Tier, CardStatus> = {
  jobber: 'enhancement',
  midcarder: 'midcard',
  upper: 'upperMidcard',
  mainEventer: 'mainEventer',
};

function rollTier(rng: Rng): Tier {
  return weightedPick(rng, TIER_WEIGHTS);
}

function randomId(rng: Rng, prefix: string): string {
  let hex = '';
  for (let i = 0; i < 12; i++) hex += randInt(rng, 0, 15).toString(16);
  return `${prefix}-${hex}`;
}

function rollArchetype(rng: Rng): Archetype {
  return pick(rng, ARCHETYPES).id;
}

function rollAge(rng: Rng, archetype: Archetype): number {
  // DESIGN: §6 ties "rookies skew 19-25, veterans skew 35-52" to the overall
  // distribution; interpreting it as archetype-conditioned is the more
  // interesting read — it makes the Rookie/Veteran archetypes mean something
  // at generation time, not just as a stat-bias label.
  if (archetype === 'rookie') return clamp(Math.round(gaussian(rng, 22, 2.5)), 19, 25);
  if (archetype === 'veteran') return clamp(Math.round(gaussian(rng, 42, 5)), 35, 52);
  return clamp(Math.round(gaussian(rng, 30, 7)), 19, 52);
}

function rollAlignment(rng: Rng): number {
  // 45% face, 45% heel, 10% tweener (§6). Tweener = |alignment| < 15.
  const bucket = weightedPick(rng, [
    ['face', 0.45],
    ['heel', 0.45],
    ['tweener', 0.1],
  ] as const);
  if (bucket === 'tweener') return randInt(rng, -14, 14);
  if (bucket === 'face') return randInt(rng, 15, 100);
  return randInt(rng, -100, -15);
}

// §3.8 — potentialPerStat = clamp(currentStat + (talent - 40) * 0.9 + gaussian(0, 8), 5, 99)
function rollPotential(rng: Rng, currentStat: number, talent: number): number {
  return clamp(Math.round(currentStat + (talent - 40) * 0.9 + gaussian(rng, 0, 8)), 5, 99);
}

export interface GenerateWrestlerOptions {
  homeTerritoryId?: Id;
  currentYear?: number;
  /** Appearances already in the roster — new wrestlers stay visually distinct from these, §7. */
  existingAppearances?: Appearance[];
}

export function generateWrestler(
  rng: Rng,
  existingNames: Set<string>,
  options: GenerateWrestlerOptions = {},
): Wrestler {
  const tier = rollTier(rng);
  const tierMean = TIER_BASE_MEAN[tier];
  const archetype = archetypeById(rollArchetype(rng));

  const strength = clamp(Math.round(gaussian(rng, tierMean, 10) + archetype.statModifiers.strength), 5, 99);
  const skill = clamp(Math.round(gaussian(rng, tierMean, 10) + archetype.statModifiers.skill), 5, 99);
  const agility = clamp(Math.round(gaussian(rng, tierMean, 10) + archetype.statModifiers.agility), 5, 99);
  const stamina = clamp(Math.round(gaussian(rng, tierMean, 10) + archetype.statModifiers.stamina), 5, 99);
  // popularity is rolled separately per §6: correlated with tier but imperfectly.
  const popularity = clamp(Math.round(gaussian(rng, tierMean - 5, 14)), 5, 99);

  // DESIGN: §6 doesn't give formulas for attitude/charisma/coachability/toughness.
  // Rolled as independent personal traits, tier-agnostic — a jobber can be a great
  // talker or a main eventer can be a locker-room problem.
  const attitude = clamp(Math.round(gaussian(rng, 55, 18)), 5, 99);
  const charisma = clamp(Math.round(gaussian(rng, 50, 20)), 5, 99);
  const coachability = clamp(Math.round(gaussian(rng, 55, 18)), 5, 99);
  const toughness = clamp(Math.round(gaussian(rng, 55, 16)), 5, 99);

  // §3.8 — talent is hidden, fixed at generation, governs ceiling and growth rate.
  const talent = clamp(Math.round(gaussian(rng, 50, 20)), 5, 99);
  const growthRate = 0.4 + (talent / 100) * 1.2;

  const age = rollAge(rng, archetype.id);
  const currentYear = options.currentYear ?? new Date().getFullYear();
  // DESIGN: debut age isn't specified in §6; a plausible in-ring debut age
  // (16-35, mean 22) is rolled and used to back into a debut year.
  const debutAge = clamp(Math.round(gaussian(rng, 22, 4)), 16, 35);
  const debutYear = currentYear - Math.max(0, age - debutAge);

  const alignment = rollAlignment(rng);
  const style = pick(rng, WRESTLING_STYLES);
  const secondaryStyle = chance(rng, 0.25)
    ? pick(rng, WRESTLING_STYLES.filter((s) => s !== style))
    : undefined;

  const compatibleGimmicks = GIMMICKS.filter((g) => {
    if (g.alignmentLean === 'either') return true;
    if (alignment >= 15) return g.alignmentLean === 'face';
    if (alignment <= -15) return g.alignmentLean === 'heel';
    return true; // tweeners can wear anything
  });
  const gimmick = pick(rng, compatibleGimmicks.length > 0 ? compatibleGimmicks : GIMMICKS);

  // DESIGN: gender ratio isn't specified by §6; skewed toward men to match
  // the reference genre while keeping the women's division well-populated.
  // Rolled before the name, because the name follows from it.
  const gender: 'm' | 'f' = chance(rng, 0.78) ? 'm' : 'f';

  const name = generateName(rng, existingNames, gender);
  existingNames.add(name.trim().toLowerCase());
  // DESIGN: no weight/height formula given; plausible pro-wrestling ranges.
  const weightLbs = clamp(Math.round(gaussian(rng, gender === 'm' ? 235 : 155, 35)), 105, 380);
  const heightIn = clamp(Math.round(gaussian(rng, gender === 'm' ? 71 : 66, 3.5)), 60, 84);

  const wrestler: Wrestler = {
    id: randomId(rng, 'w'),
    name,

    popularity,
    strength,
    skill,
    agility,
    stamina,
    attitude,
    charisma,
    talent,
    coachability,
    toughness,

    potentials: {
      strength: rollPotential(rng, strength, talent),
      skill: rollPotential(rng, skill, talent),
      agility: rollPotential(rng, agility, talent),
      stamina: rollPotential(rng, stamina, talent),
      charisma: rollPotential(rng, charisma, talent),
    },
    growthRate,

    health: 100,
    energy: 100,
    morale: 65,
    momentum: 50,
    cardStatus: TIER_TO_CARD_STATUS[tier],
    // Placeholder — derived properly by engine/career/status.ts once the
    // wrestler is in a roster it can be measured against. A career standing
    // is relative to the promotion, and generation doesn't know the roster.
    careerStatus: 'midcarder',
    careerHighWeek: 0,
    // Nobody starts believing they run the place; it is earned.
    ego: 15,
    crowdReaction: alignment,
    mood: 'content',

    gimmickFreshness: 100,
    fatigueDebt: 0,
    consecutiveWeeksWorked: 0,

    age,
    debutYear,
    gender,
    weightLbs,
    weightTarget: null,
    heightIn,
    archetype: archetype.id,
    style,
    secondaryStyle,
    gimmick,
    moveSet: generateMoveSet(rng, style),
    isCreated: false,
    homeTerritoryId: options.homeTerritoryId ?? 'territory-unassigned',
    appearance: generateDistinctAppearance(rng, options.existingAppearances ?? []),

    promotionId: null,
    contract: null,
    role: 'wrestler',

    record: { wins: 0, losses: 0, draws: 0 },
    titleReigns: [],
    injury: null,
    careerHighPopularity: popularity,
    alignment,
  };

  return wrestler;
}

export function generateWrestlers(rng: Rng, count: number, options: GenerateWrestlerOptions = {}): Wrestler[] {
  const existingNames = new Set<string>();
  const existingAppearances = options.existingAppearances ?? [];
  const wrestlers: Wrestler[] = [];
  for (let i = 0; i < count; i++) {
    const wrestler = generateWrestler(rng, existingNames, { ...options, existingAppearances });
    existingAppearances.push(wrestler.appearance);
    wrestlers.push(wrestler);
  }
  return wrestlers;
}
