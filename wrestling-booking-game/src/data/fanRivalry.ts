// Narration for the fan rivalry story — see engine/world/fanRivalry.ts for
// the mechanics and store.ts for where each of these actually fires.

import type { Rng } from '../engine/rng';
import { pick } from '../engine/rng';

/** Week N: the incident itself. Always the same beats, in order — mock, slap, retaliation, separated. */
export function fanIncidentLine(rng: Rng, wrestlerName: string, fanName: string): string {
  return pick(rng, [
    `${wrestlerName} leaned over the barricade to mock somebody in the front row, slapped them across the face, and turned around grinning like the whole thing was already won. ${fanName} grabbed a fistful of hair and flung ${wrestlerName} flat on the ground before security got anywhere near either of them.`,
    `It wasn't even part of the match. ${wrestlerName} got in a fan's face, cracked them one across the cheek, and stood there proud of it — right up until ${fanName} had a fistful of hair and put ${wrestlerName} on the floor. Security had to pull the two of them apart.`,
    `${wrestlerName} picked the wrong night to run that mouth at the front row. The slap landed clean, the grin lasted about a second, and then ${fanName} had ${wrestlerName} down on the concrete before anyone in a headset could get there.`,
  ]);
}

/** Week N+1: the callout is locked in — a forward-looking announcement, same tone as Faction Destroyer's own. */
export function fanCalloutScheduledLine(wrestlerName: string, fanName: string): string {
  return `${wrestlerName} is getting the microphone next show, and everybody already knows what it's about — a demand for ${fanName}, by name, unsanctioned. No company backing either of them.`;
}

/** Week N+2: the match is officially set. */
export function fanMatchScheduledLine(wrestlerName: string, fanName: string): string {
  return `It's official for next week: ${wrestlerName} against ${fanName}, unsanctioned. No referee's decision to hide behind, no rulebook for either of them to lean on.`;
}

/** After the match, if the fan won it: signed on the spot, cheap, before the rest of the business catches up. */
export function fanSignedCheapLine(fanName: string, wrestlerName: string, promotionName: string): string {
  return `Whatever anybody expected out of ${fanName}, it wasn't that. ${promotionName} had a contract signed before ${fanName} had even left the building — one year, dirt cheap, while nobody else in the business has caught up yet — and ${wrestlerName} is still standing right there waiting.`;
}

/** After the match, if the fan lost it: no contract offered, straight to free agency at a price that already knows what the tape showed. */
export function fanFreeAgencyLine(fanName: string, wrestlerName: string): string {
  return `${fanName} lost that one, but not the argument — every office in the business watched the same tape, and the price just went up. Nobody handed out a contract tonight, but wherever ${fanName} signs next, ${wrestlerName} won't be the only one who remembers how this started.`;
}
