// Who is allowed what, what it costs, and what everybody else makes of it.
//
// The content is in data/perks.ts. This is the part with rules in it:
//
//   eligibility   age, years in the business, standing, and never on a first
//                 contract with this company
//   cost          a weekly bill the payroll pays whether they work or not
//   effect        fatigue, recovery, exposure — real numbers the weekly tick
//                 reads, not flavour
//   resentment    what the rest of the roster thinks about the door that shuts
//
// The last one is the reason perks exist rather than being a second clause
// ladder. A perk with no downside is a slider the player always maxes, and
// there is no decision in that. Every status perk here buys one person's
// happiness with a slice of everybody else's.

import type { CareerStatus, Wrestler, WorldSettings } from '../types';
import type { Perk } from '../../data/perks';
import { PERKS, STANDING, perkById } from '../../data/perks';

export interface PerkContext {
  currentYear: number;
  /** Whether this is a renewal with the same company rather than a signing. */
  isRenewal: boolean;
}

function yearsPro(wrestler: Wrestler, currentYear: number): number {
  return Math.max(0, currentYear - wrestler.debutYear);
}

export function standingOf(status: CareerStatus): number {
  return STANDING[status] ?? 0;
}

/** Why somebody cannot have this yet, or null if they can. */
export function blockedBecause(
  perk: Perk,
  wrestler: Wrestler,
  ctx: PerkContext,
): string | null {
  if (perk.renewalOnly && !ctx.isRenewal) {
    return 'not in a first contract';
  }
  if (wrestler.age < perk.minAge) return `not before ${perk.minAge}`;
  const years = yearsPro(wrestler, ctx.currentYear);
  if (years < perk.minYearsPro) return `needs ${perk.minYearsPro} years in the business`;
  if (standingOf(wrestler.careerStatus) < perk.minStanding) return 'not at their level';
  return null;
}

export function canHave(perk: Perk, wrestler: Wrestler, ctx: PerkContext): boolean {
  return blockedBecause(perk, wrestler, ctx) === null;
}

/** Everything this person could be offered, in the order the sheet shows them. */
export function availablePerks(wrestler: Wrestler, ctx: PerkContext): Perk[] {
  return PERKS.filter((perk) => canHave(perk, wrestler, ctx));
}

/** What they actually have, resolved from the ids on the contract. */
export function perksOf(wrestler: Wrestler): Perk[] {
  return (wrestler.contract?.perks ?? [])
    .map((id) => perkById(id))
    .filter((perk): perk is Perk => Boolean(perk));
}


// ---------------------------------------------------------------------------
// What they cost and what they do

/** The weekly bill. Paid whether they are booked or not, like a retainer. */
export function perkUpkeep(wrestler: Wrestler): number {
  return perksOf(wrestler).reduce((sum, perk) => sum + perk.weeklyCost, 0);
}

/** Fatigue debt cleared per week on top of the ordinary recovery. */
export function perkFatigueRelief(wrestler: Wrestler): number {
  return perksOf(wrestler).reduce((sum, perk) => sum + perk.fatigueRelief, 0);
}

/** Health recovered per week on top of the ordinary. */
export function perkRecovery(wrestler: Wrestler): number {
  return perksOf(wrestler).reduce((sum, perk) => sum + perk.recovery, 0);
}

/** Popularity drift per week from being on camera all year. */
export function perkExposure(wrestler: Wrestler): number {
  return perksOf(wrestler).reduce((sum, perk) => sum + perk.exposure, 0);
}

/** What having them does for the person who has them, per week. */
export function perkMorale(wrestler: Wrestler): number {
  return perksOf(wrestler).reduce((sum, perk) => sum + perk.moraleGain, 0);
}

// ---------------------------------------------------------------------------
// What everybody else makes of it

/**
 * How much the room resents what one person is being given, per week, spread
 * across everybody who is not getting it.
 *
 * Two things stop this being a flat tax. It only counts the people the rest of
 * the roster can actually see being treated differently, and it is divided by
 * how many of them there are — a company where half the locker room has a
 * private room has no pecking order to resent, which is exactly right and also
 * an expensive way to solve the problem.
 *
 * Somebody's own perks never make them resent themselves, so the caller passes
 * the person being read.
 */
export function resentmentToward(
  wrestler: Wrestler,
  roster: readonly Wrestler[],
  settings: WorldSettings,
): number {
  // Somebody who is not in that locker room does not mind what is in it.
  // Filtering only the audience and not the reader had a retired man resenting
  // a jet he would never see.
  if (wrestler.deceased || wrestler.careerStatus === 'retired') return 0;

  const others = roster.filter((w) => w.id !== wrestler.id && !w.deceased && w.careerStatus !== 'retired');
  if (others.length === 0) return 0;

  let total = 0;
  for (const other of others) {
    for (const perk of perksOf(other)) total += perk.lockerRoomCost;
  }
  // Divided by the size of the room: one jet in a company of six is a scandal,
  // one jet in a company of forty is a rumour.
  const spread = total / Math.max(1, others.length);

  // Somebody who has their own perks is in no position to complain, and the
  // game says so — resentment is scaled down by what they were given.
  const own = perksOf(wrestler).reduce((sum, perk) => sum + perk.lockerRoomCost, 0);
  const insulation = Math.max(0, 1 - own * settings.perkInsulation);

  return spread * insulation * settings.perkResentmentScale;
}

/**
 * The loudest perk somebody on this roster has, for the sentence the morale
 * note needs. §0: nothing happens to a person off-screen — if the room is
 * unhappy about a jet, the room says "a jet".
 */
export function loudestPerk(roster: readonly Wrestler[]): { name: string; holder: string } | null {
  let best: { name: string; holder: string; weight: number } | null = null;
  for (const person of roster) {
    for (const perk of perksOf(person)) {
      if (perk.lockerRoomCost <= 0) continue;
      if (!best || perk.lockerRoomCost > best.weight) {
        best = { name: perk.name, holder: person.name, weight: perk.lockerRoomCost };
      }
    }
  }
  return best ? { name: best.name, holder: best.holder } : null;
}
