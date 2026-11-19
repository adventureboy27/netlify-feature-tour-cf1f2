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
import { pick, chance, rngFromSeed } from '../rng';
import type { Id, Wrestler, MatchBeat, MatchBeatKind, FinishType, Stipulation, Title, MatchRules, MatchSpot, MatchWeapon } from '../types';
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
  SPOT_BEATS,
  LINE_ACTIONS,
  BLEEDING_LINES,
  BLOODY_SPOTS,
  SUMO_SCORE_LINES,
  NOT_IN_SUMO,
  type BeatTemplate,
} from '../../data/matchBeats';
import type { SumoFall } from './sumo';

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
  ringOut: (w, l) => `${w} put ${l} off the edge of the ring for the deciding fall.`,
  equipmentFailure: (w, l) => `The gear gave out on ${w} and ${l} both, and there was no honest way to call a winner out of that.`,
  lastFactionStanding: (w, l) => `${w} was the last one standing once ${l}'s side had nobody left to send out.`,
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
   * Sumo only — the falls before the one that ended it, in order (sim/sumo.ts).
   * Each is written as its own beat; the finish says the final score.
   */
  falls?: SumoFall[];
  /**
   * The one wrestler who actually took the fall/tap/knockout/count, and the
   * one who delivered it — decided once, off a side that may have more than
   * one member, rather than always reading as the first-listed name. Absent
   * for a finish with no winner/loser roles (a draw).
   */
  pinnedId?: Id;
  pinnerId?: Id;
  /**
   * The rules the match was actually fought under (stipulation applied) —
   * what decides which spots it has. Absent: no spots beyond the plain match.
   */
  rules?: MatchRules;
  /**
   * Seeds the spot pass's own generator. The spots are drawn from a stream
   * of their own so that adding them shifts nothing on the shared one.
   */
  spotSeed?: string;
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

  // The weapon is drawn on every fill, named or not (as it always has been —
  // one draw per line, so nothing downstream on the shared stream moves),
  // and remembered: a line that names one records which, for the viewer.
  let lastWeapon: MatchWeapon = 'chair';
  const fill = (text: string): string => {
    const weapon = pick(rng, WEAPONS);
    lastWeapon = weapon.id;
    return text
      .replace(/\{winner\}/g, winnerName)
      .replace(/\{loser\}/g, loserName)
      .replace(/\{other\}/g, ctx.winnerMembers[1]?.name ?? winnerName)
      .replace(/\{finisher\}/g, winner?.moveSet?.finisher?.name ?? 'the finish')
      .replace(/\{title\}/g, ctx.titles?.[0]?.name ?? 'the championship')
      .replace(/\{weapon\}/g, weapon.text);
  };

  const beats: MatchBeat[] = [];
  const used = usedAcrossCard;

  // Who the beat is "about," structurally — mirrors the same flip-at-hopeSpot,
  // reset-at-finish rule already duplicated independently in commentary.ts
  // (its own prose momentum) and matchPlayback.ts (its rotation-guess
  // fallback). A third small copy here, purely to stamp real ids as beats are
  // created — none of the existing text generation below changes.
  // The two a line's {winner} and {loser} name.
  const winnerId = winner?.id ?? null;
  const loserId = loser?.id ?? null;
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
    const options = usable(templates, ctx.rating).filter((t) => !used.has(t.text) && possibleHere(t.text, ctx.stipulation?.id ?? null));
    if (options.length === 0) return false;
    const template = pick(rng, options);
    used.add(template.text);
    const text = extra ? extra(fill(template.text)) : fill(template.text);
    // A line that says what physically happened says who did it, too: the
    // {winner} of the line, or its {loser} where the line is theirs.
    const tagged = LINE_ACTIONS[template.text];
    const doer = tagged?.by === 'loser' ? loserId : winnerId;
    const other = tagged?.by === 'loser' ? winnerId : loserId;
    const actorId = idOverride ? idOverride.actorId : tagged && doer && other ? doer : (onTop[0]?.id ?? null);
    const targetId = idOverride ? idOverride.targetId : tagged && doer && other ? other : (inTrouble[0]?.id ?? null);
    beats.push({ kind, text, significant: true, actorId, targetId, ...spotInLine(template.text, lastWeapon), ...(tagged ? { action: tagged.action } : {}) });
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
  // Sumo's deciding fall is the winner's second: the loser's own falls say
  // whether it went the distance.
  const sumoScore: [number, number] | null =
    ctx.finish === 'ringOut' ? [2, (ctx.falls ?? []).filter((f) => !ctx.winnerMembers.some((w) => w.id === f.byId)).length] : null;
  const finishLine = (flavor ? `${winnerName} ${fill(flavor)}.` : FINISH_LINES[ctx.finish](winnerName, loserName)).replace(
    /\{score\}/g,
    sumoScore ? `two falls to ${sumoScore[1] === 1 ? 'one' : 'none'}` : '',
  );
  beats.push({
    kind: 'finish',
    text: finishLine,
    significant: true,
    actorId: ctx.pinnerId ?? null,
    targetId: ctx.pinnedId ?? null,
    ...(sumoScore ? { score: sumoScore } : {}),
    // Finished with something in the hand: the viewer puts that thing there.
    ...(flavor?.includes('{weapon}') ? { weapon: lastWeapon } : {}),
  });

  // And how the room felt about it, if there is anything left to say.
  if (beats.length < budget && chance(rng, AFTERMATH_CHANCE)) push('control', AFTERMATH_BEATS);

  const reel = withFalls(withSpots(beats, ctx, budget), ctx);
  // A first-blood match ends with the loser bleeding: recorded on the finish.
  if (ctx.rules?.aim === 'firstBlood' && ctx.finish !== 'timeLimitDraw' && ctx.finish !== 'doubleKO') {
    const at = reel.findIndex((b) => b.kind === 'finish');
    const loserId = ctx.pinnedId ?? ctx.loserMembers[0]?.id;
    if (at >= 0 && loserId) reel[at] = { ...reel[at]!, bleeding: loserId };
  }
  return reel;
}

/**
 * Whether a line can be true of this kind of match at all. Nobody leaves a
 * steel cage to brawl in the crowd or dive to the floor; a match on the bare
 * arena floor has no ropes to climb or ring to dive out of.
 */
const NOT_IN_A_CAGE = /dive to the floor|guardrail|into the crowd|first three rows|timekeeper/i;
const NOT_WITHOUT_A_RING = /rope|apron|dive to the floor|turnbuckle|corner of this ring|guardrail/i;
function possibleHere(template: string, stipulation: string | null): boolean {
  if (stipulation === 'sumo') return !NOT_IN_SUMO.test(template);
  if (stipulation === 'steelCage') return !NOT_IN_A_CAGE.test(template);
  if (stipulation === 'arenaFloor') return !NOT_WITHOUT_A_RING.test(template);
  return true;
}

/** A line that describes a spot names it: recorded, so the viewer shows that. */
function spotInLine(template: string, weapon: MatchWeapon): Pick<MatchBeat, 'spot' | 'weapon'> {
  if (template.includes('{weapon}')) return { spot: 'weaponShot', weapon };
  if (/through the timekeeper/i.test(template)) return { spot: 'tableThrough' };
  return {};
}

/**
 * What a special match is built around, and what its near thing looks like.
 * Mirrors ui/match/conduct.ts's reading of the same rules — the two have to
 * agree, or the write-up says one thing and the ring shows another.
 */
export function spotsFor(stipulation: string | null, rules: MatchRules | undefined, teams = false): { control: MatchSpot[]; nearFall: MatchSpot | null; breakdown: boolean } {
  const weapons = rules?.ruleStrictness === 'none';
  const furniture = stipulation === 'ladder' || stipulation === 'tables' || stipulation === 'flamingTables' || stipulation === 'casket';
  const control: MatchSpot[] = [];
  if (stipulation === 'steelCage') control.push('intoCage', 'cageTop');
  if (stipulation === 'ladder') control.push('ladderShot', 'ladderDive');
  if (stipulation === 'blindfoldMatch') control.push('blindSwing');
  if (weapons) {
    control.push('weaponShot', 'stepsShot');
    // Through a table ends a tables match; a ladder match has its own ladder spots.
    if (!furniture) control.push('tableThrough', 'ladderShot');
  }
  const battleRoyal = stipulation === 'battleRoyal' || rules?.preset === 'battleRoyal';
  const knockoutOnly = rules?.falls === 'knockout' || rules?.aim === 'lastStanding';
  const subsOnly = rules?.falls === 'subsOnly' || rules?.aim === 'submissionOnly';
  const nearFall: MatchSpot | null =
    stipulation === 'steelCage' && rules?.aim === 'escape' ? 'cageClimb'
    : stipulation === 'ladder' ? 'ladderPull'
    : stipulation === 'tables' || stipulation === 'flamingTables' ? 'tableFightOff'
    : stipulation === 'casket' ? 'casketNear'
    : battleRoyal ? 'teeter'
    : rules?.aim === 'ringOut' ? 'edgeHold'
    : knockoutOnly ? 'countBeaten'
    : subsOnly ? 'holdEscape'
    : null;
  // A tag match falls apart near the end: they nearly all do. Not where
  // everybody is in at once anyway, or where a cage keeps the partners out.
  const breakdown = teams && !battleRoyal && stipulation !== 'steelCage' && rules?.preset !== 'tornado';
  return { control: [...new Set(control)], nearFall, breakdown };
}

/**
 * The spots, written into the reel: one or two of what the match is built
 * around while the winner is on top (the second, in a long enough match, by
 * the other side once they have fought back), and the near thing in the
 * shape this match has one. Structural, like a battle royal's eliminations —
 * a ladder match gets its ladder however short its write-up.
 */
function withSpots(beats: MatchBeat[], ctx: NarrativeContext, budget: number): MatchBeat[] {
  const teams = ctx.winnerMembers.length > 1 && ctx.loserMembers.length > 1;
  const plan = spotsFor(ctx.stipulation?.id ?? null, ctx.rules, teams);
  if (plan.control.length === 0 && !plan.nearFall && !plan.breakdown) return beats;
  const rng = rngFromSeed(ctx.spotSeed ?? `spots:${ctx.winnerMembers.map((w) => w.id).join(',')}:${ctx.loserMembers.map((w) => w.id).join(',')}:${ctx.rating}`);
  const everybody = [...ctx.winnerMembers, ...ctx.loserMembers];
  const nameOf = (id: Id | null | undefined) => everybody.find((w) => w.id === id)?.name ?? 'their opponent';
  const winnerId = ctx.pinnerId ?? ctx.winnerMembers[0]?.id ?? null;
  const loserId = ctx.pinnedId ?? ctx.loserMembers[0]?.id ?? null;
  const write = (spot: MatchSpot, kind: MatchBeatKind, actorId: Id | null, targetId: Id | null): MatchBeat => {
    const weapon = pick(rng, WEAPONS);
    const text = pick(rng, SPOT_BEATS[spot])
      .replace(/\{actor\}/g, nameOf(actorId))
      .replace(/\{target\}/g, nameOf(targetId))
      .replace(/\{weapon\}/g, weapon.text);
    return { kind, text, significant: true, actorId, targetId, spot, ...(spot === 'weaponShot' ? { weapon: weapon.id } : {}) };
  };
  const out = [...beats];

  // The near thing: the reel's own near fall becomes this match's kind of
  // near thing, or one is added just before the finish. The side that is on
  // top for it (the loser, fighting back) nearly wins it; the other survives.
  if (plan.nearFall) {
    const at = out.findIndex((b) => b.kind === 'nearFall');
    if (at >= 0) {
      const was = out[at]!;
      out[at] = write(plan.nearFall, 'nearFall', was.actorId ?? loserId, was.targetId ?? winnerId);
    } else {
      const finish = out.findIndex((b) => b.kind === 'finish');
      out.splice(finish >= 0 ? finish : out.length, 0, write(plan.nearFall, 'nearFall', loserId, winnerId));
    }
  }

  if (plan.control.length > 0) {
    const pool = [...plan.control];
    const take = () => pool.splice(pool.indexOf(pick(rng, pool)), 1)[0]!;
    // After the winner's control segment if there is one, else after the opening.
    const hope = out.findIndex((b) => b.kind === 'hopeSpot');
    const end = hope >= 0 ? hope : out.findIndex((b) => b.kind === 'nearFall' || b.kind === 'finish');
    let first = 1;
    for (let i = 1; i < (end >= 0 ? end : out.length); i++) if (out[i]!.kind === 'control' && !out[i]!.spot) first = i + 1;
    out.splice(first, 0, write(take(), 'control', winnerId, loserId));
    // And the other side's turn with it, where the match had room for one.
    if (budget >= 6 && pool.length > 0) {
      const back = out.findIndex((b) => b.kind === 'hopeSpot');
      if (back >= 0) out.splice(back + 1, 0, write(take(), 'control', loserId, winnerId));
    }
  }
  // The breakdown: just before the near thing if there is one, else just
  // before the finish — the stretch where a tag match comes apart.
  if (plan.breakdown) {
    const near = out.findIndex((b) => b.kind === 'nearFall');
    const at = near >= 0 ? near : out.findIndex((b) => b.kind === 'finish');
    out.splice(at >= 0 ? at : out.length, 0, write('breakdown', 'control', winnerId, loserId));
  }

  // Blood, last, so it never changes which spots were picked: a spot hard
  // enough to open somebody up sometimes does, more often the more violent
  // the match. Once each, and said. In a first-blood match the only blood
  // is the finish's — anybody bleeding earlier would have ended it.
  const firstBlood = ctx.rules?.aim === 'firstBlood';
  const bled = new Set<Id>();
  if (!firstBlood) {
    const odds = 0.12 + 0.07 * (ctx.stipulation?.violenceLevel ?? 0);
    for (let i = 0; i < out.length; i++) {
      const b = out[i]!;
      if (!b.spot || !BLOODY_SPOTS.includes(b.spot) || !b.targetId || bled.has(b.targetId)) continue;
      if (rng.next() >= odds) continue;
      bled.add(b.targetId);
      out[i] = { ...b, text: `${b.text} ${pick(rng, BLEEDING_LINES).replace(/\{target\}/g, nameOf(b.targetId))}`, bleeding: b.targetId };
    }
  }
  return out;
}

/**
 * Sumo: each fall before the deciding one, written where it happened — spread
 * through the reel ahead of the finish, in order, each followed by where that
 * left it. Structural, like a battle royal's eliminations: every fall is in
 * the write-up however short it is. Its own stream, so it moves nothing else.
 */
function withFalls(beats: MatchBeat[], ctx: NarrativeContext): MatchBeat[] {
  const falls = ctx.falls ?? [];
  if (falls.length === 0) return beats;
  const rng = rngFromSeed(`falls:${ctx.spotSeed ?? ''}:${falls.map((f) => f.outId).join(',')}`);
  const everybody = [...ctx.winnerMembers, ...ctx.loserMembers];
  const nameOf = (id: Id) => everybody.find((w) => w.id === id)?.name ?? 'their opponent';
  const out = [...beats];
  const finishAt = out.findIndex((b) => b.kind === 'finish');
  const end = finishAt >= 0 ? finishAt : out.length;
  // Evenly through the reel before the finish, never ahead of the opening.
  const at = falls.map((_, k) => Math.max(1, Math.round(((k + 1) * end) / (falls.length + 1))));
  falls.forEach((fall, k) => {
    const fill = (t: string) => t.replace(/\{actor\}/g, nameOf(fall.byId)).replace(/\{target\}/g, nameOf(fall.outId));
    const score = SUMO_SCORE_LINES[`${fall.score[0]}-${fall.score[1]}`] ?? [];
    const text = `${fill(pick(rng, SPOT_BEATS.pushedOff))}${score.length > 0 ? ` ${fill(pick(rng, score))}` : ''}`;
    out.splice(at[k]! + k, 0, { kind: 'control', text, significant: true, actorId: fall.byId, targetId: fall.outId, spot: 'pushedOff', score: fall.score });
  });
  return out;
}
