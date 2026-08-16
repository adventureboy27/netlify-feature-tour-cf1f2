// Ego — the price of making somebody.
//
// Every promotion's real problem is that its own success creates its next
// crisis. You build a wrestler; the wrestler notices; the wrestler starts
// asking. Ego is that loop made mechanical: it rises with the things a booker
// wants to happen (titles, main events, getting over) and it turns into
// money, clauses, and people who will not do what they are told.
//
// It is not a personality flaw. A high-ego draw is usually the best thing on
// your roster — that is precisely why they can ask.
//
// The falling half matters as much as the rising half. Losing, being left off
// cards, and plain time bring it back down, which is why a promotion that
// cools off gets cheaper to run at exactly the moment it needs to be.

import { clamp } from '../rng';
import type { Wrestler, WorldSettings, CareerStatus, Clause } from '../types';

export interface EgoContext {
  /** Highest popularity anyone on the roster has — ego is comparative. */
  rosterPeakPopularity: number;
  currentWeek: number;
  settings: WorldSettings;
}

/**
 * Where a wrestler's ego should sit given who they currently are.
 *
 * Ego chases this rather than jumping to it, so a single main event does not
 * turn somebody into a prima donna and a single loss does not humble them.
 */
export function targetEgo(wrestler: Wrestler, status: CareerStatus, ctx: EgoContext): number {
  const { settings } = ctx;

  // Being over is most of it, measured against the roster rather than in the
  // abstract — the biggest fish in a small pond still knows it.
  const relativeStanding = ctx.rosterPeakPopularity > 0 ? wrestler.popularity / ctx.rosterPeakPopularity : 0;

  const currentReigns = wrestler.titleReigns.filter((r) => r.endWeek === null).length;
  const careerReigns = wrestler.titleReigns.length;

  const target =
    relativeStanding * settings.egoFromStanding +
    Math.min(currentReigns, 2) * settings.egoFromHoldingTitle +
    Math.min(careerReigns, 6) * settings.egoFromCareerTitles +
    (status === 'draw' || status === 'legend' ? settings.egoFromTopStatus : 0) +
    (wrestler.momentum / 100) * settings.egoFromMomentum;

  // A professional keeps their head; a bad attitude inflates faster.
  const temperament = 1 + (1 - wrestler.attitude / 100) * settings.egoAttitudeSwing;

  return clamp(target * temperament, 0, 100);
}

/** Move ego toward its target. Slow on purpose — this is a career arc, not a mood. */
export function driftEgo(currentEgo: number, target: number, settings: WorldSettings): number {
  const rate = target > currentEgo ? settings.egoRiseRate : settings.egoFallRate;
  const step = (target - currentEgo) * rate;
  return clamp(currentEgo + step, 0, 100);
}

/** Words, never a number. */
export type EgoLabel = 'No trouble' | 'Knows their worth' | 'Difficult' | 'Running the place';

export function egoLabel(ego: number): EgoLabel {
  if (ego <= 25) return 'No trouble';
  if (ego <= 50) return 'Knows their worth';
  if (ego <= 75) return 'Difficult';
  return 'Running the place';
}

// ------------------------------------------------------- what they want

/**
 * The clauses a wrestler will ask for, in the order they ask. Higher ego
 * unlocks more of the list, and each one costs the promotion something real.
 */
// Exported because the bidding war picks its sweeteners off the same ladder —
// there should be exactly one list of what a wrestler can be offered, and one
// account of what each thing costs the company that offers it.
export const CLAUSE_LADDER: { clause: Clause; egoRequired: number; label: string; cost: string }[] = [
  {
    clause: 'travelCovered',
    egoRequired: 20,
    label: 'Travel covered',
    cost: 'You pay to get them to every show.',
  },
  {
    clause: 'healthInsurance',
    egoRequired: 35,
    label: 'Injury insurance',
    cost: 'A weekly premium whether they wrestle or not.',
  },
  {
    clause: 'incentive',
    egoRequired: 45,
    label: 'Main-event bonus',
    cost: 'They cost a quarter more every time you top the card with them.',
  },
  {
    clause: 'merchandiseCut',
    egoRequired: 55,
    label: 'A cut of the merchandise',
    cost: 'A slice off the top of every shirt sold.',
  },
  {
    clause: 'noTrade',
    egoRequired: 62,
    label: 'No-trade clause',
    cost: 'You cannot move them on. Whatever they become, they are yours.',
  },
  {
    clause: 'creativeControl',
    egoRequired: 80,
    label: 'Creative control',
    cost: 'They can refuse a finish. The sim still decides — you just lose the lever.',
  },
  {
    clause: 'ironClad',
    egoRequired: 88,
    label: 'Iron-clad guarantee',
    cost: 'Releasing them costs the full remaining term.',
  },
];

/** The player-facing name of a clause. Falls back to the raw key. */
export function clauseLabel(clause: Clause): string {
  return CLAUSE_LADDER.find((entry) => entry.clause === clause)?.label ?? clause;
}


export interface ContractDemand {
  /** What they want per week. */
  weeklyRate: number;
  /** Clauses they are asking for, hardest-won last. */
  clauses: Clause[];
  /** Player-facing description of each clause's cost. */
  clauseCosts: { clause: Clause; label: string; cost: string }[];
  /** 0-1 — how likely they are to walk if the demands are refused outright. */
  walkRisk: number;
}

/**
 * What a wrestler asks for when their deal runs down.
 *
 * The whole point: the better you have booked them, the more this costs. A
 * champion you built is the most expensive person on the roster to keep, and
 * the demands are not all money — the clauses take booking options away, which
 * is often worse.
 */
export function contractDemand(
  wrestler: Wrestler,
  baseRate: number,
  status: CareerStatus,
  settings: WorldSettings,
): ContractDemand {
  const egoFactor = 1 + (wrestler.ego / 100) * settings.egoRateMultiplierMax;
  const weeklyRate = Math.round((baseRate * egoFactor) / 25) * 25;

  const asks = CLAUSE_LADDER.filter((entry) => wrestler.ego >= entry.egoRequired)
    // They ask for the top few things they qualify for, not the whole list.
    .slice(-settings.egoMaxClauseAsks);

  // Somebody who knows they are the draw is likelier to walk over a refusal.
  const leverage = status === 'draw' || status === 'mainEventer' ? 1.4 : 1;
  const walkRisk = clamp((wrestler.ego / 100) * settings.egoWalkRiskMax * leverage, 0, 0.9);

  return {
    weeklyRate,
    clauses: asks.map((a) => a.clause),
    clauseCosts: asks.map((a) => ({ clause: a.clause, label: a.label, cost: a.cost })),
    walkRisk,
  };
}

/** The ongoing weekly cost of the clauses a promotion has agreed to. */
export function clauseUpkeep(wrestler: Wrestler, settings: WorldSettings): number {
  const clauses = wrestler.contract?.clauses ?? [];
  const rate = wrestler.contract?.weeklyRate ?? 0;
  let upkeep = 0;
  if (clauses.includes('healthInsurance')) upkeep += rate * settings.clauseInsuranceRate;
  if (clauses.includes('travelCovered')) upkeep += settings.clauseTravelCost;
  if (clauses.includes('guaranteedDates')) upkeep += rate * settings.clauseGuaranteedDatesRate;
  return upkeep;
}



/**
 * §13's escape hatch, honestly implemented: creative control does NOT let the
 * player script a win. The sim still picks the winner. What it does is take
 * the deck-stacking levers away — you cannot plant a run-in or a crooked
 * official to push the odds for or against them.
 */
export function blocksDeckStacking(wrestler: Wrestler): boolean {
  return (wrestler.contract?.clauses ?? []).includes('creativeControl');
}

/** Locker-room drag from carrying a room full of people who know their worth. */
export function egoFriction(roster: readonly Wrestler[], settings: WorldSettings): number {
  if (roster.length === 0) return 0;
  const meanEgo = roster.reduce((sum, w) => sum + w.ego, 0) / roster.length;
  return (meanEgo / 100) * settings.egoRosterFrictionMax;
}
