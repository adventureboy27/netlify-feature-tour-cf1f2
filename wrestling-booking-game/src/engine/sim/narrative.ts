// Highlight-reel narrative — booking-game-design.md §11.5.
// "The player never watches a match... what they get is a highlight reel."
//
// Which means this text *is* the match, and a two-line write-up cannot carry
// a story. The reel now scales with what the match was worth: a squash gets
// two beats, a five-star title main event gets eight, and everything between
// is chosen from what was actually true of that match — who was in it, how
// they wrestle, what was on the line, and whether the two of them genuinely
// hate each other.
//
// The order is fixed, because a match has a shape: opening, stakes, control,
// hope, near-fall, the big one, the finish, the aftermath. What varies is
// which of those appear. The lines themselves live in data/matchBeats.ts.

import type { Rng } from '../rng';
import { pick, chance } from '../rng';
import type { Wrestler, MatchBeat, MatchBeatKind, FinishType, Stipulation, Title } from '../types';
import {
  OPENING_BEATS,
  CONTROL_BEATS,
  HOPE_SPOT_BEATS,
  NEAR_FALL_BEATS,
  BIG_SPOT_BEATS,
  TITLE_BEATS,
  GRUDGE_BEATS,
  AFTERMATH_BEATS,
  WEAPONS,
  type BeatTemplate,
} from '../../data/matchBeats';

const FINISH_LINES: Record<FinishType, (winner: string, loser: string) => string> = {
  cleanPin: (w, l) => `${w} hit the finish clean and got the three count on ${l}.`,
  submission: (w, l) => `${w} locked in the finisher, and ${l} had no choice but to tap.`,
  knockout: (w, l) => `${w} knocked ${l} out cold for the finish.`,
  rollup: (w, l) => `${l} nearly had it, but ${w} reversed a rollup for the shock win.`,
  interference: (w, _l) => `Interference turned the tide, and ${w} capitalized on the chaos.`,
  disqualification: (w, l) => `The match broke down and ${w} won by disqualification over ${l}.`,
  countOut: (w, l) => `${l} couldn't beat the count, and ${w} won by count-out.`,
  timeLimitDraw: (w, l) => `The bell rang with both ${w} and ${l} still standing — a time-limit draw.`,
  doubleKO: (w, l) => `${w} and ${l} went down together. No winner tonight.`,
  refereeStoppage: (w, l) => `The referee waved it off — ${w} wins by stoppage over ${l}.`,
  injuryStoppage: (_w, l) => `${l} went down badly and did not get up. The match was stopped and the room went quiet.`,
};

export interface NarrativeContext {
  winnerMembers: Wrestler[];
  loserMembers: Wrestler[];
  finish: FinishType;
  stars: number;
  /** The match rating, 0-100 — what decides how long the reel runs. */
  rating: number;
  /**
   * A gimmick match describes its own finish. "Knocked them out cold" is
   * wrong for a tables match — the whole point is that someone went through
   * a table, and the write-up is the only place the player ever sees it
   * happen.
   */
  stipulation?: Stipulation | null;
  /** Belts on the line, so the reel can say what it was for. */
  titles?: readonly Title[];
  /** Real animosity, 0-100. Above the threshold the match reads as a fight. */
  shootHeat?: number;
  /** True for the last match on the card. */
  isMainEvent?: boolean;
}

/**
 * How many beats a match of this quality earns, including the opening and
 * the finish. A bad match is short because there is nothing to say about it;
 * a great one earns the room, and the main event earns a little more again.
 */
export function beatCount(ctx: NarrativeContext): number {
  const fromRating = ctx.rating >= 80 ? 5 : ctx.rating >= 65 ? 4 : ctx.rating >= 45 ? 3 : ctx.rating >= 25 ? 2 : 1;
  const bonus = (ctx.isMainEvent ? 1 : 0) + ((ctx.titles?.length ?? 0) > 0 ? 1 : 0);
  return Math.min(MAX_BEATS, 2 + fromRating + bonus);
}

const MAX_BEATS = 8;
/** Shoot heat above this and the match reads as a genuine fight. */
const GRUDGE_THRESHOLD = 40;
/** Not every match gets a closing line — it lands harder for not being automatic. */
const AFTERMATH_CHANCE = 0.55;

/** Templates whose rating window includes this match. */
function usable(templates: readonly BeatTemplate[], rating: number): BeatTemplate[] {
  return templates.filter(
    (t) => (t.minRating === undefined || rating >= t.minRating) && (t.maxRating === undefined || rating <= t.maxRating),
  );
}

/**
 * `usedAcrossCard` is every beat line already spent tonight, on any match —
 * without it, `used` only guarded against a beat repeating inside its own
 * match, and `CONTROL_BEATS` carries just 2 lines per style. A card with
 * two matches won by wrestlers of the same style (routine on a real
 * roster) could and did read the identical control-segment sentence
 * twice. Defaults to a fresh set so a caller resolving one match in
 * isolation (a test, a one-off sim) is unaffected.
 */
export function generateBeats(rng: Rng, ctx: NarrativeContext, usedAcrossCard: Set<string> = new Set()): MatchBeat[] {
  const winner = ctx.winnerMembers[0];
  const loser = ctx.loserMembers[0];
  const winnerName = winner?.name ?? 'The winner';
  const loserName = loser?.name ?? 'their opponent';

  const fill = (text: string): string =>
    text
      .replace(/\{winner\}/g, winnerName)
      .replace(/\{loser\}/g, loserName)
      .replace(/\{other\}/g, ctx.winnerMembers[1]?.name ?? winnerName)
      .replace(/\{finisher\}/g, winner?.moveSet?.finisher?.name ?? 'the finish')
      .replace(/\{title\}/g, ctx.titles?.[0]?.name ?? 'the championship')
      .replace(/\{weapon\}/g, pick(rng, WEAPONS));

  const beats: MatchBeat[] = [];
  const used = usedAcrossCard;
  const push = (kind: MatchBeatKind, templates: readonly BeatTemplate[]): void => {
    const options = usable(templates, ctx.rating).filter((t) => !used.has(t.text));
    if (options.length === 0) return;
    const template = pick(rng, options);
    used.add(template.text);
    beats.push({ kind, text: fill(template.text), significant: true });
  };

  // The opening is always there.
  push('openingExchange', OPENING_BEATS);

  const budget = beatCount(ctx);
  // One slot is always reserved for the finish.
  const room = () => beats.length < budget - 1;
  const grudge = (ctx.shootHeat ?? 0) >= GRUDGE_THRESHOLD;

  // What it was for, first — it frames everything after it.
  if ((ctx.titles?.length ?? 0) > 0 && room()) push('signature', TITLE_BEATS);

  // Real animosity changes what the match *is*, so it outranks the craft.
  if (grudge && room()) push('control', GRUDGE_BEATS);

  // The control segment, in the winner's own style.
  if (room() && winner) {
    const styled = (CONTROL_BEATS[winner.style] ?? []).map((text) => ({ text }));
    if (styled.length > 0) push('control', styled);
  }

  // The other one gets their moment back — only in a match good enough to
  // have had one.
  if (room() && ctx.rating >= 45) push('hopeSpot', HOPE_SPOT_BEATS);
  if (room() && ctx.rating >= 50) push('nearFall', NEAR_FALL_BEATS);
  if (room() && ctx.rating >= 60) push('signature', BIG_SPOT_BEATS);

  // The finish, always.
  const flavor = ctx.stipulation?.finishFlavor?.[ctx.finish];
  const finishLine = flavor
    ? `${winnerName} ${flavor.replace('{loser}', loserName).replace('{winner}', winnerName)}.`
    : FINISH_LINES[ctx.finish](winnerName, loserName);
  beats.push({ kind: 'finish', text: finishLine, significant: true });

  // And how the room felt about it, if there is anything left to say.
  if (beats.length < budget && chance(rng, AFTERMATH_CHANCE)) push('control', AFTERMATH_BEATS);

  return beats;
}
