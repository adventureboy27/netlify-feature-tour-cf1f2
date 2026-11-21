// What the line under the stars says (ui/match/StarReveal.tsx), from the
// match's real stars and the real reasons the simulation gave for them.

import { STAR_REASONS, STAR_REASON_MIN, STAR_VERDICTS } from '../../data/starQuotes';
import type { RatingBreakdownEntry } from '../../engine/types';

function hashOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * The verdict for these stars, then — when one term clearly drove it — why:
 * the biggest help for a good match, the biggest hurt for a poor one.
 * `seed` keeps the same match saying the same thing every time it is watched.
 */
export function starQuote(stars: number, breakdown: readonly RatingBreakdownEntry[] | undefined, seed: string): string {
  const h = hashOf(seed);
  const band = STAR_VERDICTS.find((b) => stars < b.below) ?? STAR_VERDICTS[STAR_VERDICTS.length - 1]!;
  const verdict = band.lines[h % band.lines.length]!;
  const good = stars >= 3;
  const candidates = (breakdown ?? [])
    .filter((t) => STAR_REASONS[t.label] && (good ? t.value >= STAR_REASON_MIN : t.value <= -STAR_REASON_MIN))
    .filter((t) => (good ? STAR_REASONS[t.label]!.up : STAR_REASONS[t.label]!.down));
  if (candidates.length === 0) return verdict;
  const top = candidates.reduce((a, b) => (Math.abs(b.value) > Math.abs(a.value) ? b : a));
  const lines = (good ? STAR_REASONS[top.label]!.up : STAR_REASONS[top.label]!.down)!;
  return `${verdict} ${lines[(h >>> 8) % lines.length]!}`;
}
