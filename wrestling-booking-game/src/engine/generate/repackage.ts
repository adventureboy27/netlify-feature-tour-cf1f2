// Repackaging somebody.
//
// A booker can change a wrestler's ring name and their whole look at any
// point, which is what promotions actually do when a character is not
// working. The rules are the same ones generation obeys — the reason two
// wrestlers must not read as the same person does not stop applying because
// a human typed the second name instead of the generator picking it.
//
// The old name is kept. A title lineage that says somebody won a belt under
// a name they no longer use is not a bug to paper over, it is the history —
// so the previous names travel with the wrestler and the roster card says who
// they used to be.

import { buildNameIndex, isTooSimilar, normalizeName } from './name';
import type { WorldSettings, Wrestler } from '../types';

/** Why a proposed name cannot be used. Null when it can. */
export type RenameRejection =
  | 'empty'
  | 'tooShort'
  | 'tooLong'
  | 'taken'
  | 'tooSimilar';

export const RENAME_REJECTION_TEXT: Record<RenameRejection, string> = {
  empty: 'Needs a name.',
  tooShort: 'Too short to fit on a poster.',
  tooLong: 'Too long to fit on a poster.',
  taken: 'Somebody in the business already works under that name.',
  tooSimilar: 'Close enough to a name already in use that people would confuse the two.',
};

export interface RenameCheck {
  ok: boolean;
  reason: RenameRejection | null;
}

/**
 * Can this wrestler be called this?
 *
 * `existingNames` is every name in the business. The wrestler's own current
 * name is filtered out here rather than by the caller, so that re-submitting
 * an unchanged name is not rejected as a clash with itself.
 */
export function checkRename(
  proposed: string,
  currentName: string,
  existingNames: Iterable<string>,
  settings: WorldSettings,
): RenameCheck {
  const trimmed = proposed.trim();
  if (trimmed.length === 0) return { ok: false, reason: 'empty' };
  if (trimmed.length < settings.ringNameMinLength) return { ok: false, reason: 'tooShort' };
  if (trimmed.length > settings.ringNameMaxLength) return { ok: false, reason: 'tooLong' };

  // Unchanged is always allowed — the player may only be editing the look.
  if (normalizeName(trimmed) === normalizeName(currentName)) return { ok: true, reason: null };

  const others = [...existingNames].filter((name) => normalizeName(name) !== normalizeName(currentName));
  if (others.some((name) => normalizeName(name) === normalizeName(trimmed))) {
    return { ok: false, reason: 'taken' };
  }
  if (isTooSimilar(trimmed, buildNameIndex(others))) return { ok: false, reason: 'tooSimilar' };

  return { ok: true, reason: null };
}

/** A name somebody used to work under. */
export interface FormerName {
  name: string;
  /** The week they stopped using it. */
  untilWeek: number;
}

/**
 * Apply a repackage. Mutates, like the rest of the career modules — the store
 * hands it a draft.
 *
 * A repackage is a fresh start for the character, so the gimmick is new again.
 * It is deliberately not a reset of anything the wrestler earned: the player
 * is changing what somebody is called and what they look like, not erasing a
 * career, and quietly docking popularity for it would be exactly the kind of
 * hidden punishment the game does not do.
 */
export function repackage(
  w: Wrestler,
  change: { name?: string; nickname?: string | null; photoDataUrl?: string | null },
  week: number,
): void {
  if (change.name !== undefined) {
    const trimmed = change.name.trim();
    if (trimmed && normalizeName(trimmed) !== normalizeName(w.name)) {
      w.formerNames = [...(w.formerNames ?? []), { name: w.name, untilWeek: week }];
      w.name = trimmed;
    }
  }
  if (change.nickname !== undefined) w.nickname = change.nickname ?? undefined;
  if (change.photoDataUrl !== undefined) w.photoDataUrl = change.photoDataUrl ?? undefined;

  // New look, new name, new character — whatever staleness had built up on the
  // old one does not carry over.
  w.gimmickFreshness = 100;
}

/** Every name in use anywhere in the business, for the distinctness check. */
export function namesInUse(everybody: readonly Wrestler[]): string[] {
  return everybody.map((w) => w.name);
}
