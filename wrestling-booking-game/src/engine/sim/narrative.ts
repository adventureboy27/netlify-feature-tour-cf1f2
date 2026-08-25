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
import type { Id, Wrestler, MatchBeat, MatchBeatKind, FinishType, Stipulation, Title } from '../types';
import {
  OPENING_BEATS,
  CONTROL_BEATS,
  HOPE_SPOT_BEATS,
  NEAR_FALL_BEATS,
  BIG_SPOT_BEATS,
  TITLE_BEATS,
  GRUDGE_BEATS,
  AFTERMATH_BEATS,
  BATTLE_ROYAL_ELIMINATION_BEATS,
  BATTLE_ROYAL_ELIMINATION_BY_BEATS,
  BATTLE_ROYAL_FINAL_BEATS,
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
  escape: (w, l) => `${w} hit the floor first and left ${l} still climbing — a Steel Cage win by escape.`,
  equipmentFailure: (w, l) => `The gear gave out on ${w} and ${l} both, and there was no honest way to call a winner out of that.`,
};

/**
 * Battle royal only — one wrestler going out, and who put them there (if
 * anybody decided did). See engine/sim/battleRoyal.ts's pickEliminators.
 */
export interface EliminationEvent {
  eliminatedId: Id;
  eliminatedName: string;
  eliminatorId: Id | null;
  eliminatorName: string | null;
}

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
  /**
   * Battle royal only — every elimination, in the order it happened (winner
   * excluded; the finish beat already covers them). See
   * engine/sim/battleRoyal.ts. Undefined for every other match.
   */
  eliminations?: EliminationEvent[];
  /**
   * The one wrestler who actually took the fall/tap/knockout/count, and the
   * one who delivered it — decided once, off a side that may have more than
   * one member, rather than always reading as the first-listed name. Absent
   * for a finish with no winner/loser roles (a draw).
   */
  pinnedId?: Id;
  pinnerId?: Id;
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
/**
 * A twenty-man field has nineteen eliminations. The reel is a highlight, not
 * a play-by-play (§11.5) — so even a maximal-budget match only ever names a
 * handful, spread evenly across the whole order.
 */
const ELIMINATION_BEATS_MAX = 4;

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

  // Who the beat is "about," structurally — mirrors the same flip-at-hopeSpot,
  // reset-at-finish rule already duplicated independently in commentary.ts
  // (its own prose momentum) and matchPlayback.ts (its rotation-guess
  // fallback). A third small copy here, purely to stamp real ids as beats are
  // created — none of the existing text generation below changes.
  let onTop: readonly Wrestler[] = ctx.winnerMembers;
  let inTrouble: readonly Wrestler[] = ctx.loserMembers;

  /**
   * `extra` runs after fill(), for placeholders (like battle royal's
   * {eliminated}) that vary per beat rather than per match. `idOverride`
   * stamps a specific actor/target instead of the current momentum pair —
   * used for beats (eliminations, the finish) that already know exactly who
   * did what.
   */
  const pushCustom = (
    kind: MatchBeatKind,
    templates: readonly BeatTemplate[],
    extra?: (text: string) => string,
    idOverride?: { actorId: Id | null; targetId: Id | null },
  ): boolean => {
    const options = usable(templates, ctx.rating).filter((t) => !used.has(t.text));
    if (options.length === 0) return false;
    const template = pick(rng, options);
    used.add(template.text);
    const text = extra ? extra(fill(template.text)) : fill(template.text);
    const actorId = idOverride ? idOverride.actorId : (onTop[0]?.id ?? null);
    const targetId = idOverride ? idOverride.targetId : (inTrouble[0]?.id ?? null);
    beats.push({ kind, text, significant: true, actorId, targetId });
    return true;
  };
  const push = (kind: MatchBeatKind, templates: readonly BeatTemplate[]): void => {
    if (kind === 'hopeSpot') {
      const nextOnTop = inTrouble;
      inTrouble = onTop;
      onTop = nextOnTop;
    }
    pushCustom(kind, templates);
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

  // Battle royal only: real eliminations, spread evenly across the whole
  // order rather than one beat per fall — a twenty-man field has nineteen of
  // them, and the reel is a highlight, not a play-by-play (§11.5). Placed
  // ahead of the rating-gated hopeSpot/nearFall/bigSpot below and not
  // rating-gated themselves — eliminations are structural to this match
  // type, not a bonus only a great one earns, so they claim the budget first.
  // The final-two milestone below wants its own slot — reserved here so a
  // full house of elimination beats can't crowd out the one line that says
  // the field has actually narrowed.
  const finalTwoReserved = ctx.eliminations && ctx.eliminations.length > 1 ? 1 : 0;
  const roomForEliminations = () => beats.length < budget - 1 - finalTwoReserved;
  if (ctx.eliminations && ctx.eliminations.length > 0) {
    const events = ctx.eliminations;
    const slots = Math.min(ELIMINATION_BEATS_MAX, events.length);
    const chosen = new Set<number>();
    for (let i = 0; i < slots; i++) {
      // Evenly spread indices across the order, e.g. 4 slots over 10 events
      // picks roughly 0, 3, 6, 9 rather than clustering at the start.
      const index = Math.min(events.length - 1, Math.floor((i * events.length) / slots));
      chosen.add(index);
    }
    for (const index of [...chosen].sort((a, b) => a - b)) {
      if (!roomForEliminations()) break;
      const event = events[index]!;
      const pool = event.eliminatorName ? BATTLE_ROYAL_ELIMINATION_BY_BEATS : BATTLE_ROYAL_ELIMINATION_BEATS;
      pushCustom(
        'elimination',
        pool,
        (t) => t.replace(/\{eliminated\}/g, event.eliminatedName).replace(/\{eliminatedBy\}/g, event.eliminatorName ?? ''),
        { actorId: event.eliminatorId, targetId: event.eliminatedId },
      );
    }
  }
  // The field narrowing to its final two is its own milestone, separate from
  // any one elimination.
  if (room() && ctx.eliminations && ctx.eliminations.length > 1) {
    pushCustom('control', BATTLE_ROYAL_FINAL_BEATS);
  }

  // The other one gets their moment back — only in a match good enough to
  // have had one.
  if (room() && ctx.rating >= 45) push('hopeSpot', HOPE_SPOT_BEATS);
  if (room() && ctx.rating >= 50) push('nearFall', NEAR_FALL_BEATS);
  if (room() && ctx.rating >= 60) push('signature', BIG_SPOT_BEATS);

  // The finish, always. Flavor text runs through the same fill() as every
  // other beat, so a stipulation's finish line can use {weapon}/{finisher}/
  // {title} too, not just {winner}/{loser} — no reason a hardcore finish
  // couldn't name the weapon just because the pool line beside it can.
  const flavor = ctx.stipulation?.finishFlavor?.[ctx.finish];
  const finishLine = flavor ? `${winnerName} ${fill(flavor)}.` : FINISH_LINES[ctx.finish](winnerName, loserName);
  beats.push({
    kind: 'finish',
    text: finishLine,
    significant: true,
    actorId: ctx.pinnerId ?? null,
    targetId: ctx.pinnedId ?? null,
  });

  // And how the room felt about it, if there is anything left to say.
  if (beats.length < budget && chance(rng, AFTERMATH_CHANCE)) push('control', AFTERMATH_BEATS);

  return beats;
}
