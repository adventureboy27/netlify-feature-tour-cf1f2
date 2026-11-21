// Narration for the Faction Destroyer story — see engine/world/factionDestroyer.ts
// for the mechanics and store.ts for where each of these actually fires. Kept
// as data, not baked into the engine, same reason every other wire line lives
// outside the pure simulation.

/** Two factions exist at once — the story locks onto this pair and starts counting down. */
export function factionDestroyerTriggeredLine(stableAName: string, stableBName: string, countdownWeeks: number): string {
  return `${stableAName} and ${stableBName} are both full-blown factions now, and the office has seen enough — a Faction Destroyer is on, ${countdownWeeks} weeks out. Every week between now and then needs a member of either side in a match, or the clock simply doesn't move.`;
}

/** The countdown hit zero — the match is forced onto the next show as the main event. */
export function factionDestroyerScheduledLine(stableAName: string, stableBName: string): string {
  return `The wait is over. ${stableAName} and ${stableBName} headline next week, all in, no rules, no time limit — and it doesn't end until one side has nobody left standing.`;
}

/** The losing faction disbands outright, regardless of how many members are left. */
export function factionDestroyerLoserDisbandedLine(stableName: string): string {
  return `${stableName} is finished. Whatever was left of them walked out of that match with nothing.`;
}

/** The winning faction survived with 2-3 members — kept the name, now officially a team instead of a faction. */
export function factionDestroyerWinnerSurvivesAsTeamLine(stableName: string): string {
  return `${stableName} came out the other side smaller, but the name stays — officially a team now, not a faction.`;
}

/** The winning faction was reduced to a single survivor — no group left at all. */
export function factionDestroyerWinnerCollapsedLine(stableName: string, survivorName: string): string {
  return `${stableName} technically won, but there's nobody left to call it. ${survivorName} is standing alone with nothing but the name behind them, and even that's gone now.`;
}
