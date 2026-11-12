// Turning what the new-game screen collected — a row per promotion, each
// either "generate" or "import", plus at most one uploaded file — into a
// concrete NewGamePlan world.ts can build from.
//
// Pure and framework-free on purpose, even though it lives in state/ rather
// than engine/: nothing here touches React, and keeping it a plain function
// of its inputs is what makes it testable without mounting the screen.

import type { Rng } from '../engine/rng';
import { groupByCompany, splitEvenlyByGender, type RosterEntry } from '../engine/world/roster-io';
import type { NewGamePlan, PromotionPlanSlot } from './world';

export interface SlotDraft {
  name: string;
  mode: 'generate' | 'import';
}

export interface PlanResolution {
  /** Null when a slot needs a file and none (or nothing usable) was given. */
  plan: NewGamePlan | null;
  /** Human-readable, shown to the player. Non-empty problems can still leave `plan` set — a slot that could not be matched falls back to Generate rather than blocking the whole start. */
  problems: string[];
}

/**
 * Match a file's `company` groups to the Import slots by name, split any
 * leftover flat pool (or a fully flat file) evenly across whichever Import
 * slots didn't get a name match, and generate anywhere that still leaves
 * empty rather than ever blocking the game from starting.
 */
export function resolveNewGamePlan(
  slots: readonly SlotDraft[],
  playerIndex: number,
  fileEntries: readonly RosterEntry[] | null,
  rng: Rng,
): PlanResolution {
  const problems: string[] = [];
  const importIndexes = slots
    .map((s, i) => (s.mode === 'import' ? i : -1))
    .filter((i) => i >= 0);

  if (importIndexes.length === 0) {
    return {
      plan: { slots: slots.map((s) => ({ name: s.name, roster: 'generate' })), playerIndex },
      problems,
    };
  }

  if (!fileEntries || fileEntries.length === 0) {
    return {
      plan: null,
      problems: ['Upload a roster file for the promotions marked Import, or switch them to Generate.'],
    };
  }

  const rosterFor = new Map<number, RosterEntry[]>();
  const grouped = groupByCompany(fileEntries);

  if (grouped) {
    const remainingGroups = new Map(grouped.groups);
    const unmatched: number[] = [];
    for (const i of importIndexes) {
      const key = [...remainingGroups.keys()].find(
        (name) => name.trim().toLowerCase() === slots[i]!.name.trim().toLowerCase(),
      );
      if (key) {
        rosterFor.set(i, remainingGroups.get(key)!);
        remainingGroups.delete(key);
      } else {
        unmatched.push(i);
      }
    }

    // Only genuinely untagged entries get redistributed as a flat pool — a
    // named company nobody's slot matched stays out of the game rather than
    // being folded into a differently named promotion's roster.
    if (unmatched.length > 0 && grouped.ungrouped.length > 0) {
      const buckets = splitEvenlyByGender(grouped.ungrouped, unmatched.length, rng);
      unmatched.forEach((i, idx) => rosterFor.set(i, buckets[idx]!));
    }
    for (const i of unmatched) {
      if (!rosterFor.get(i)?.length) {
        problems.push(`No company in the file was named "${slots[i]!.name}" — generated instead.`);
      }
    }
    if (remainingGroups.size > 0) {
      const names = [...remainingGroups.keys()].join(', ');
      problems.push(
        `${names} in the file didn't match any promotion name and ${remainingGroups.size === 1 ? 'was' : 'were'} not imported.`,
      );
    }
  } else {
    const buckets = splitEvenlyByGender(fileEntries, importIndexes.length, rng);
    importIndexes.forEach((i, idx) => rosterFor.set(i, buckets[idx]!));
  }

  const planSlots: PromotionPlanSlot[] = slots.map((s, i) => {
    if (s.mode !== 'import') return { name: s.name, roster: 'generate' };
    const entries = rosterFor.get(i);
    if (entries && entries.length > 0) return { name: s.name, roster: entries };
    if (!problems.some((p) => p.includes(`"${s.name}"`))) {
      problems.push(`Nobody ended up assigned to "${s.name}" — generated instead.`);
    }
    return { name: s.name, roster: 'generate' };
  });

  return { plan: { slots: planSlots, playerIndex }, problems };
}
