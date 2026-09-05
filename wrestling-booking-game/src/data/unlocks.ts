// The general unlockables list — beyond Arena Floor (won mid-crisis, from
// the truck breaking down), these are earned the ordinary way: keep playing,
// hit a real milestone, and the wire says so. No dice roll decides these —
// see engine/world/unlocks.ts for the check, checked fresh every week.
//
// A condition unlocks a Stipulation.id that already exists in
// data/stipulations.ts with `locked: true` — this table only decides *when*
// it stops being locked, the same separation of "what" and "whether" that
// engine/sim/worldStories.ts keeps between the pool and the roll.

export interface UnlockContext {
  /** The player's own promotion rating, 0-100. */
  companyRating: number;
  /** Total shows the player has ever run. */
  showsRun: number;
}

export interface UnlockCondition {
  /** The Stipulation.id this unlocks. */
  stipulationId: string;
  /** What earned it, for the wire announcement. */
  earnedLine: string;
  met(ctx: UnlockContext): boolean;
}

export const UNLOCK_CONDITIONS: UnlockCondition[] = [
  {
    stipulationId: 'fallsCountAnywhere',
    earnedLine:
      'Falls Count Anywhere is now a bookable match type — the promotion has the standing to let a match spill wherever it wants and still make the count.',
    met: (ctx) => ctx.companyRating >= 85,
  },
  {
    stipulationId: 'blindfoldMatch',
    earnedLine:
      'Blindfold Match is now a bookable match type — a hundred shows in, the promotion has earned the right to try something ridiculous.',
    met: (ctx) => ctx.showsRun >= 100,
  },
];
