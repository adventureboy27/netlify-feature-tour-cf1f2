// A rival's lawyers find real holes in a run of your wrestlers' contracts
// and sign them away outright — a real, one-sided loss that has already
// happened by the time the promoter hears about it. What is left to decide
// is how the office responds: tighten every contract in the building (real
// money, real reassurance), go after the rival for it (spends goodwill,
// buys a real grudge against them), or eat it and say nothing.
//
// Reuses ownershipShakeup.ts's pickShakeupReleases for who goes — the same
// "how many, who" logic already built for a weak heir's panic cuts fits this
// exactly: pick some real number off the roster. This raid releases them to
// free agency (the same shape as any other release) rather than deciding who
// signs them next — see the scope note in docs/BACKLOG.md.
//
// Pure: rolls whether it happens and who it happens to, and resolves
// whatever the promoter picked into consequences the store applies. Nothing
// here touches the world.

import type { Rng } from '../rng';
import { chance, pick } from '../rng';
import type { Id, Promotion, WorldSettings } from '../types';
import { pickShakeupReleases } from './ownershipShakeup';

export type ContractRaidOptionId = 'overhaul' | 'retaliate' | 'doNothing';

export interface ContractRaidCall {
  week: number;
  rivalId: Id;
  rivalName: string;
  raidedIds: Id[];
  raidedNames: string[];
}

export function eligibleForContractRaid(
  week: number,
  rosterSize: number,
  livingRivals: readonly Promotion[],
  settings: WorldSettings,
): boolean {
  return (
    week >= settings.contractRaidEarliestWeek &&
    rosterSize >= settings.contractRaidMinRoster &&
    livingRivals.length > 0
  );
}

/** Who found the holes, and who they took. Doesn't touch the world — the caller applies the release. */
export function rollContractRaid(
  rng: Rng,
  week: number,
  rosterIds: readonly Id[],
  livingRivals: readonly Promotion[],
  settings: WorldSettings,
): { rival: Promotion; raidedIds: Id[] } | null {
  if (!eligibleForContractRaid(week, rosterIds.length, livingRivals, settings)) return null;
  if (!chance(rng, settings.contractRaidChancePerWeek)) return null;
  const rival = pick(rng, livingRivals);
  const raidedIds = pickShakeupReleases(rng, rosterIds, settings);
  if (raidedIds.length === 0) return null;
  return { rival, raidedIds };
}

export const CONTRACT_RAID_OPTIONS: { id: ContractRaidOptionId; label: string; gains: string; costs: string }[] = [
  {
    id: 'overhaul',
    label: 'Overhaul every contract in the building',
    gains: 'The roster sees real proof the office is protecting them, and the holes actually close',
    costs: 'Lawyers and renegotiation across a whole roster do not come cheap',
  },
  {
    id: 'retaliate',
    label: 'Go after them right back',
    gains: 'The locker room sees the office fight back instead of just taking it',
    costs: 'It costs real goodwill with a rival you may need to work with again someday',
  },
  {
    id: 'doNothing',
    label: 'Eat it and move on',
    gains: 'Costs nothing today',
    costs: 'The locker room notices the office did not do a single thing about it',
  },
];

export interface ContractRaidOutcome {
  moneyDelta: number;
  moraleDelta: number;
  reputationDelta: number;
  /** Added to the raiding rival's grudge against you — see engine/world/grudges.ts. */
  grudgeDelta: number;
  line: string;
}

export function resolveContractRaid(choice: ContractRaidOptionId, settings: WorldSettings): ContractRaidOutcome {
  switch (choice) {
    case 'overhaul':
      return {
        moneyDelta: -settings.contractRaidOverhaulCost,
        moraleDelta: settings.contractRaidOverhaulMorale,
        reputationDelta: 0,
        grudgeDelta: 0,
        line: 'Every contract in the building got a second look this week — an expensive week, but a locker room that trusts the office a little more for it.',
      };
    case 'retaliate':
      return {
        moneyDelta: 0,
        moraleDelta: settings.contractRaidRetaliateMorale,
        reputationDelta: -settings.contractRaidRetaliateReputationCost,
        grudgeDelta: settings.contractRaidRetaliateGrudge,
        line: 'The office went right back after them for it — the boys noticed, and so did the rival on the other end of it.',
      };
    case 'doNothing':
    default:
      return {
        moneyDelta: 0,
        moraleDelta: settings.contractRaidDoNothingMorale,
        reputationDelta: 0,
        grudgeDelta: 0,
        line: 'Nothing came of it. The locker room clocked that too.',
      };
  }
}
