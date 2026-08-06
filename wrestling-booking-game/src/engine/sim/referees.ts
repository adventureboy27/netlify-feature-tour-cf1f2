// Officials as signed characters — §10.2.
//
// A referee used to be a row in a price list that every promotion in the
// world could book at once. That made him scenery. He is a person now: you
// sign him, you pay him every week whether he works or not, his deal runs
// out, he gets tired across a card, he gets hurt, and the sheet has an
// opinion about him.
//
// Three things drive every decision in here:
//
//   COMPETENCE is what he sees. A good official is invisible; a poor one
//   misses things, and — this is the part that matters — the write-up says
//   what he missed and who it cost. Cheap officiating is not a hidden
//   modifier on a finish table, it is a visible embarrassment.
//
//   SHARPNESS is what is left of him tonight. It falls with every match he
//   works and comes back between shows. This is the reason to carry four
//   officials instead of one: the sixth match of the night gets whatever is
//   left of whoever you have been leaning on, exactly like a boxing card
//   saving its best referee for the main event.
//
//   BENDABLE is what he will do for money. High means a crooked finish is
//   available and costs a premium at signing, because doing what you are
//   told is a service.
//
// What a referee does NOT get is creative control. He can be bought, he can
// be terrible, he can be the reason your top babyface is furious — but he
// never gets to ask who goes over. That clause is off, permanently, and the
// contract builder here is the only place a referee deal is made.

import type { Rng } from '../rng';
import { chance, clamp, pick, randInt } from '../rng';
import type { Contract, Id, Referee, RefereeMissRecord, WorldSettings } from '../types';
import {
  REFEREE_BLURBS,
  REFEREE_FIRST_NAMES,
  REFEREE_LAST_NAMES,
  REFEREE_SEEDS,
  type RefereeSeed,
} from '../../data/refereePool';
import { missesFor } from '../../data/refereeMisses';

// ------------------------------------------------------------------ making

/** A seed from `data/` as a live, unsigned official. */
export function refereeFromSeed(seed: RefereeSeed): Referee {
  return {
    id: seed.id,
    name: seed.name,
    competence: seed.competence,
    bendable: seed.bendable,
    toughness: seed.toughness,
    age: seed.age,
    experience: seed.experience,
    blurb: seed.blurb,
    promotionId: null,
    contract: null,
    sharpness: 100,
    // Reputation opens where competence is. The business already knows who
    // these people are — the sheet is reporting a career, not starting one.
    reputation: seed.competence,
    matchesTonight: 0,
    careerMatches: seed.experience * 40,
    recentMatches: 0,
    recentMisses: 0,
    injury: null,
    weeksUnsigned: 0,
    // A career official, not one of your wrestlers moonlighting.
    wrestlerId: null,
  };
}

/** The whole hand-written pool, unsigned. */
export function seedRefereePool(): Referee[] {
  return REFEREE_SEEDS.map(refereeFromSeed);
}

function blurbFor(rng: Rng, competence: number, bendable: number): string {
  if (bendable > 60) return pick(rng, REFEREE_BLURBS.crooked);
  if (competence >= 80) return pick(rng, REFEREE_BLURBS.excellent);
  if (competence >= 60) return pick(rng, REFEREE_BLURBS.decent);
  return pick(rng, REFEREE_BLURBS.poor);
}

/**
 * A new official, for when rivals have signed the pool down.
 *
 * Weighted towards the middle and below: the great ones in this business are
 * hand-written, and a generated shirt turning up ready-made at 90 competence
 * would make the named pool pointless.
 */
export function generateReferee(rng: Rng, existingNames: ReadonlySet<string>): Referee {
  let name = '';
  for (let attempt = 0; attempt < 30; attempt++) {
    name = `${pick(rng, REFEREE_FIRST_NAMES)} ${pick(rng, REFEREE_LAST_NAMES)}`;
    if (!existingNames.has(name)) break;
  }

  const experience = randInt(rng, 0, 22);
  // Time in the shirt is most of what makes an official good, which is why
  // the cheap young one is cheap and stays that way for a while.
  const competence = clamp(Math.round(32 + experience * 1.8 + (rng.next() - 0.4) * 30), 25, 88);
  const bendable = randInt(rng, 0, 100) > 75 ? randInt(rng, 55, 90) : randInt(rng, 3, 45);

  return {
    id: `ref-gen-${Math.floor(rng.next() * 1e9).toString(36)}`,
    name,
    competence,
    bendable,
    toughness: randInt(rng, 25, 70),
    age: clamp(24 + experience + randInt(rng, 0, 8), 24, 66),
    experience,
    blurb: blurbFor(rng, competence, bendable),
    promotionId: null,
    contract: null,
    sharpness: 100,
    reputation: competence,
    matchesTonight: 0,
    careerMatches: experience * 40,
    recentMatches: 0,
    recentMisses: 0,
    injury: null,
    weeksUnsigned: randInt(rng, 0, 30),
    wrestlerId: null,
  };
}

// ------------------------------------------------------------------- money

/**
 * What an official asks for per week.
 *
 * Curved off competence so an elite one costs several times a warm body
 * rather than a little more, plus a premium for being purchasable. Even the
 * best of them lands at a fraction of a midcard wrestler — that is the deal
 * the player is being offered: officiating is the cheapest quality you can
 * buy, and neglecting it is therefore a choice rather than an accident.
 */
export function refereeAskingRate(referee: Referee, settings: WorldSettings): number {
  const quality = clamp(referee.competence / 100, 0, 1);
  const crooked = (referee.bendable / 100) * settings.refereeBendablePremium;
  const rate =
    settings.refereeBaseWeeklyRate + quality ** settings.refereeRateCurve * settings.refereeRateRange + crooked;
  return Math.round(rate / 5) * 5;
}

/** Nobody has hired them in a while, so they will take less. */
export function currentRefereeAskingRate(referee: Referee, settings: WorldSettings): number {
  const decay = Math.min(referee.weeksUnsigned * settings.refereeRateDecayPerWeek, settings.refereeMaxDiscount);
  const asking = refereeAskingRate(referee, settings);
  return Math.max(settings.refereeBaseWeeklyRate, Math.round((asking * (1 - decay)) / 5) * 5);
}

/**
 * A referee's deal. One year, no clauses, and specifically no creative
 * control — an official does not get a say in who goes over, and there is no
 * code path anywhere that gives him one.
 */
export function createRefereeContract(referee: Referee, settings: WorldSettings, signedYear: number): Contract {
  return {
    type: 'fullTime',
    weeklyRate: currentRefereeAskingRate(referee, settings),
    weeksRemaining: settings.refereeContractWeeks,
    totalWeeks: settings.refereeContractWeeks,
    clauses: [],
    // An official has no leverage to ask for guarantees, so cutting one is
    // always free. That is part of why officiating is the cheap quality.
    guaranteedPct: 0,
    signedYear,
  };
}

/** Weekly wage bill for the officials. Separate line from the wrestlers. */
export function refereeWageBill(referees: readonly Referee[], promotionId: Id): number {
  return referees
    .filter((r) => r.promotionId === promotionId)
    .reduce((sum, r) => sum + (r.contract?.weeklyRate ?? 0), 0);
}

// ------------------------------------------------------------- how good now

/**
 * What he is actually worth tonight, after however many matches he has
 * already worked.
 *
 * The floor is deliberately high. A worn-out Earl Hollis is still better than
 * a fresh Norm Whitfield — fatigue is a penalty, not a personality
 * transplant — but the gap closes enough that the sixth match of the night is
 * a genuinely worse match than the first.
 */
export function effectiveCompetence(referee: Referee, settings: WorldSettings): number {
  const floor = settings.refereeSharpnessFloor;
  return referee.competence * (floor + (1 - floor) * (referee.sharpness / 100));
}

/** How fresh he is, in words. Never a number — CLAUDE.md. */
export type SharpnessLabel = 'Fresh' | 'Sharp' | 'Working hard' | 'Fading' | 'Burned out';

export function sharpnessLabel(referee: Referee): SharpnessLabel {
  if (referee.sharpness >= 90) return 'Fresh';
  if (referee.sharpness >= 70) return 'Sharp';
  if (referee.sharpness >= 45) return 'Working hard';
  if (referee.sharpness >= 22) return 'Fading';
  return 'Burned out';
}

/** What the business makes of him. Also words. */
export type RefereeGrade = 'As good as they come' | 'Excellent' | 'Reliable' | 'Passable' | 'A liability';

export function refereeGrade(referee: Referee): RefereeGrade {
  // Deliberately a tier and not a superlative: three officials can all be
  // as good as they come, and which of them is actually top is what the
  // sheet's ranking is for.
  if (referee.reputation >= 88) return 'As good as they come';
  if (referee.reputation >= 75) return 'Excellent';
  if (referee.reputation >= 60) return 'Reliable';
  if (referee.reputation >= 42) return 'Passable';
  return 'A liability';
}

/** Can he work tonight at all? */
export function isAvailable(referee: Referee): boolean {
  return !referee.injury || referee.injury.weeksRemaining <= 0;
}

// -------------------------------------------------------------- the misses

export interface MissContext {
  referee: Referee;
  /** Wrestlers who could be wronged by a blown call, in the match. */
  competitorIds: readonly Id[];
  hasTags: boolean;
  hadInterference: boolean;
  settings: WorldSettings;
}

/**
 * Did the official miss something, and what was it.
 *
 * Chance runs off what is left of his competence tonight, so the same referee
 * in the opener and in the main event is two different propositions. Capped,
 * because even the worst official in the business does not blow every match —
 * a guaranteed disaster is not a decision, it is a punishment.
 */
export function missChance(referee: Referee, settings: WorldSettings): number {
  const shortfall = 1 - effectiveCompetence(referee, settings) / 100;
  return Math.min(
    settings.refereeMissChanceCap,
    settings.refereeMissBaseChance + shortfall * settings.refereeMissIncompetenceWeight,
  );
}

export function rollRefereeMiss(rng: Rng, ctx: MissContext): RefereeMissRecord | null {
  if (!chance(rng, missChance(ctx.referee, ctx.settings))) return null;

  const options = missesFor(ctx.hasTags, ctx.hadInterference).filter(
    (m) => !m.needsVictim || ctx.competitorIds.length > 0,
  );
  if (options.length === 0) return null;

  const miss = pick(rng, options);
  const victimId = miss.needsVictim && ctx.competitorIds.length > 0 ? pick(rng, ctx.competitorIds) : null;

  return {
    refereeId: ctx.referee.id,
    refereeName: ctx.referee.name,
    missId: miss.id,
    // {victim} stays a placeholder until the caller resolves the id to a name.
    text: pick(rng, miss.lines).replace(/\{ref\}/g, ctx.referee.name),
    victimId,
  };
}

/**
 * Fill the {victim} placeholder once the caller knows the name.
 *
 * Split out because the miss is rolled inside the sim, which works in ids,
 * and the sentence is read by the player, who works in names. A record that
 * reaches the screen with a brace still in it is a bug the tests check for.
 */
export function nameTheVictim(record: RefereeMissRecord, victimName: string | null): RefereeMissRecord {
  return { ...record, text: record.text.replace(/\{victim\}/g, victimName ?? 'the wrong man') };
}

// --------------------------------------------------------------- the night

/** He worked one. Tired, and one more on the career total. */
export function workedMatch(referee: Referee, settings: WorldSettings): void {
  referee.sharpness = clamp(referee.sharpness - settings.refereeSharpnessPerMatch, 0, 100);
  referee.matchesTonight += 1;
  referee.careerMatches += 1;
  referee.recentMatches += 1;
}

/**
 * What the night did to his standing.
 *
 * Misses cost him a lot and cleanly-worked matches earn him a little back,
 * which is the right asymmetry: an official builds a reputation over years
 * and loses it in one bad main event.
 */
export function applyNightToReputation(referee: Referee, misses: number, settings: WorldSettings): void {
  referee.recentMisses += misses;
  const clean = Math.max(0, referee.matchesTonight - misses);

  // Reputation converges on what he can actually do. Without this ceiling
  // every official who works a full card every week drifts to a perfect
  // score inside a year and the sheet's ranking flattens into a list of who
  // is booked most — a busy mediocrity is not the best in the business.
  const ceiling = Math.min(100, referee.competence + settings.refereeReputationCeiling);
  const earned = referee.reputation < ceiling ? clean * settings.refereeCleanNightReputationGain : 0;

  referee.reputation = clamp(
    referee.reputation - misses * settings.refereeMissReputationCost + earned,
    0,
    100,
  );
}

/** Between shows: rest, heal, and run the deal down a week. */
export function tickRefereeWeek(referee: Referee, settings: WorldSettings): void {
  referee.matchesTonight = 0;
  referee.sharpness = clamp(referee.sharpness + settings.refereeSharpnessRecoveryPerWeek, 0, 100);
  if (referee.injury) {
    referee.injury.weeksRemaining -= 1;
    if (referee.injury.weeksRemaining <= 0) referee.injury = null;
  }
  if (referee.contract) referee.contract.weeksRemaining -= 1;
  if (!referee.promotionId) referee.weeksUnsigned += 1;
}

// -------------------------------------------------------------- the ladder

/**
 * What the sheet ranks officials on.
 *
 * Reputation is most of it, but an official who never works cannot climb —
 * being brilliant and unbooked is not a career. The miss rate over the recent
 * window is the correction that keeps a well-regarded veteran from coasting
 * on a reputation he is actively wrecking.
 */
export function refereeStanding(referee: Referee): number {
  const workload = Math.min(1, referee.recentMatches / 20);
  const missRate = referee.recentMatches > 0 ? referee.recentMisses / referee.recentMatches : 0;
  return referee.reputation * (0.7 + 0.3 * workload) - missRate * 40;
}

export function rankReferees(referees: readonly Referee[]): Referee[] {
  return [...referees].sort((a, b) => refereeStanding(b) - refereeStanding(a));
}

/** Everybody this promotion has under contract, best first. */
export function signedReferees(referees: readonly Referee[], promotionId: Id): Referee[] {
  return rankReferees(referees.filter((r) => r.promotionId === promotionId));
}

/**
 * Everybody available to sign, best first.
 *
 * Converted wrestlers are never in here even when they are not currently
 * officiating. They are somebody's signed talent — you cannot hire another
 * promotion's wrestler out of the referee pool, and you cannot hire your own
 * twice.
 */
export function availableReferees(referees: readonly Referee[]): Referee[] {
  return rankReferees(referees.filter((r) => r.promotionId === null && !r.wrestlerId));
}

/**
 * Who is counting this match: the one booked for it, else the card default.
 *
 * A single call so every screen and the sim agree on the answer. This is what
 * lets the player name one official for the whole night and override him on
 * the two matches that matter.
 */
export function officialFor(
  segmentRefereeId: Id | null | undefined,
  defaultRefereeId: Id | null,
  referees: readonly Referee[],
  promotionId: Id,
): Referee | null {
  const usable = (id: Id | null | undefined) => {
    if (!id) return null;
    const referee = referees.find((r) => r.id === id);
    if (!referee || referee.promotionId !== promotionId || !isAvailable(referee)) return null;
    return referee;
  };
  return usable(segmentRefereeId) ?? usable(defaultRefereeId);
}

/**
 * Spread a crew across a card the way a boxing office does it: the best
 * official takes the main event fresh, and the rest of the night is shared
 * out so nobody works themselves into the ground.
 *
 * Returned per slot, last slot being the main event. Null means nobody is
 * available and a wrestler ends up in the shirt.
 *
 * This is a *tool*, not an automation — the player presses it, and can still
 * override any single match. Doing it silently inside "Fill the card" would
 * take away the one genuinely interesting decision officiating has.
 */
export function spreadOfficials(crew: readonly Referee[], matchCount: number): (Id | null)[] {
  const fit = crew.filter(isAvailable);
  if (matchCount <= 0) return [];
  if (fit.length === 0) return Array.from({ length: matchCount }, () => null);

  const byQuality = [...fit].sort((a, b) => b.competence - a.competence);
  const best = byQuality[0]!;
  const assignments: (Id | null)[] = Array.from({ length: matchCount }, () => null);

  // The main event is the one match that has to be right.
  assignments[matchCount - 1] = best.id;

  // Everything under it goes to the others in rotation, cheapest work to the
  // people whose night it is not going to ruin. With only one official signed
  // there is nobody to rotate to and he works the lot — which is the state
  // that teaches the player to sign a second one.
  const undercard = byQuality.length > 1 ? byQuality.slice(1) : byQuality;
  for (let slot = 0; slot < matchCount - 1; slot++) {
    assignments[slot] = undercard[slot % undercard.length]!.id;
  }

  return assignments;
}

// ---------------------------------------------------------------- the pool

export interface RefereePoolTick {
  referees: readonly Referee[];
  playerPromotionId: Id;
  /** Combined pull of the AI promotions, 0-1. */
  rivalDemand: number;
  settings: WorldSettings;
}

/**
 * A week in the pool. Rivals sign the good ones you left sitting there, and
 * the business keeps producing new shirts so it never runs dry.
 *
 * Leaving Earl Hollis unsigned because you are saving money is a decision
 * with a deadline, same as any free agent.
 */
export function tickRefereePool(
  rng: Rng,
  ctx: RefereePoolTick,
): { signedAway: Id[]; newcomers: Referee[] } {
  const signedAway: Id[] = [];
  // Same rule as the signing pool: a wrestler in a shirt is not for sale.
  const available = ctx.referees.filter((r) => r.promotionId === null && !r.wrestlerId);

  for (const referee of available) {
    const desirability = referee.competence / 100;
    if (chance(rng, desirability * ctx.rivalDemand * ctx.settings.refereeRivalSigningChance)) {
      signedAway.push(referee.id);
    }
  }

  const remaining = available.length - signedAway.length;
  const newcomers: Referee[] = [];
  if (remaining < ctx.settings.refereePoolSize) {
    const names = new Set(ctx.referees.map((r) => r.name));
    // One at a time. The pool refilling instantly would make signing away
    // somebody's officials meaningless.
    if (chance(rng, 0.25)) newcomers.push(generateReferee(rng, names));
  }

  return { signedAway, newcomers };
}
