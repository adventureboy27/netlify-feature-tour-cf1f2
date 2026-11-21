// The general unlockables check — a weekly sibling to the world-story roll,
// except deterministic: no dice, just real milestones the booker actually
// earned playing the game. See data/unlocks.ts for the conditions and their
// wire text; this only decides which of them just became true.

import { UNLOCK_CONDITIONS, type UnlockContext, type UnlockCondition } from '../../data/unlocks';

export type { UnlockContext, UnlockCondition };

/** Which locked stipulations just became unlockable, if any. */
export function checkUnlocks(alreadyUnlocked: readonly string[], ctx: UnlockContext): UnlockCondition[] {
  return UNLOCK_CONDITIONS.filter((c) => !alreadyUnlocked.includes(c.stipulationId) && c.met(ctx));
}
