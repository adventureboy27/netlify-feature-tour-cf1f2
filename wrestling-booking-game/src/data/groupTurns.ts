// Narration for a staged group turn actually landing — see
// engine/world/teamBreakup.ts for the mechanics. Kept as data, not baked
// into the engine, same reason every other wire line lives outside the pure
// simulation.

/** The beatdown happened for real. */
export function groupTurnLetItHappenLine(
  stableName: string,
  departingName: string,
  attackerNames: readonly string[],
  managerName: string | null,
): string {
  const crew = managerName ? [...attackerNames, managerName] : attackerNames;
  return `${crew.join(' and ')} turned on ${departingName} tonight. ${stableName} is finished, and ${departingName} paid for it.`;
}

/** The office pulled them apart before it went too far. */
export function groupTurnBreakItUpLine(stableName: string, departingName: string): string {
  return `${stableName} came apart tonight — the office stepped in before ${departingName} got hurt.`;
}
