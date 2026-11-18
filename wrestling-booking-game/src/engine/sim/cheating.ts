// Anything at all, used when the referee is not looking.
//
// In a match with disqualifications on, a weapon is cheating — a chair from
// under the ring, the steps off the corner, whatever a manager can reach
// from the floor. Who tries it is about who they are: a heel far more than a
// face, and a devious manager in the corner on top of either. Whether it is
// seen is the official's: how sharp he is, how straight. A guest referee
// with an agenda sees exactly what suits him.
//
// Seen, that is the match: disqualified, and the one it was used on wins.
// Unseen, it stands, and it is a real lean toward the side that did it.
//
// Decided before the match is simulated, on its own seeded stream
// (store.ts), so the shared stream is never drawn from (CLAUDE.md).
import { clamp, pick, type Rng } from '../rng';
import type { Id, Referee, Wrestler, WorldSettings } from '../types';
import type { Manager } from './ringside';
import { effectiveCompetence } from './referees';
import { CHEAP_SHOT_LINES, CHEAT_WEAPON_NAMES, SAW_IT_LINES } from '../../data/cheating';

export type CheatWeapon = keyof typeof CHEAT_WEAPON_NAMES;

export interface CheatPlan {
  /** The side that cheated, and the side it was done to. */
  side: number;
  victimSide: number;
  /** Who did it: a wrestler's id, or a manager's (`byManager`). */
  actorId: Id;
  actorName: string;
  byManager: boolean;
  weapon: CheatWeapon;
  /** The official saw it: disqualified. */
  seen: boolean;
}

export interface CheatContext {
  sides: readonly { side: number; wrestlers: readonly Wrestler[]; managers: readonly Manager[] }[];
  /** The assigned official, if anybody is in the shirt who is not a wrestler. */
  referee: Referee | null;
  /** A guest referee is officiating, and which side he favours (null: neither). */
  guest: { favoursSide: number | null } | null;
  settings: WorldSettings;
}

/** How likely one side is to try it, and who would be the one to. */
function temptation(entry: CheatContext['sides'][number], s: WorldSettings) {
  const who: { id: Id; name: string; byManager: boolean; p: number }[] = [];
  for (const w of entry.wrestlers) {
    const heel = clamp(-w.alignment / 100, 0, 1);
    who.push({ id: w.id, name: w.name, byManager: false, p: s.cheatChanceBase + s.cheatChanceHeel * heel });
  }
  for (const m of entry.managers) who.push({ id: m.id, name: m.name, byManager: true, p: s.cheatChanceManager * (m.deviousness / 100) });
  const none = who.reduce((acc, x) => acc * (1 - x.p), 1);
  return { p: 1 - none, who };
}

/** Whether the official sees it. */
function seenBy(ctx: CheatContext, side: number, rng: Rng): boolean {
  const s = ctx.settings;
  if (ctx.guest) {
    if (ctx.guest.favoursSide === side) return false;
    if (ctx.guest.favoursSide !== null) return true;
  }
  const ref = ctx.referee;
  if (!ref) return false;
  const sharp = effectiveCompetence(ref, s) / 100;
  const odds = clamp(s.cheatSeenBase + sharp * s.cheatSeenSharp - (ref.bendable / 100) * s.cheatSeenBent, s.cheatSeenMin, s.cheatSeenMax);
  return rng.next() < odds;
}

/** Whether anybody cheats in this match, who, with what, and whether it was seen. Two sides only. */
export function planCheat(rng: Rng, ctx: CheatContext): CheatPlan | null {
  if (ctx.sides.length !== 2) return null;
  // Either side may be first to try it; at most one does.
  const order = rng.next() < 0.5 ? [0, 1] : [1, 0];
  for (const i of order) {
    const entry = ctx.sides[i]!;
    const { p, who } = temptation(entry, ctx.settings);
    if (who.length === 0 || rng.next() >= p) continue;
    const total = who.reduce((acc, x) => acc + x.p, 0);
    let roll = rng.next() * total;
    const actor = who.find((x) => (roll -= x.p) <= 0) ?? who[who.length - 1]!;
    // A manager cannot carry the steps up onto the apron.
    const weapon = pick(rng, actor.byManager ? (['chair', 'kendo', 'can'] as const) : (['chair', 'chair', 'kendo', 'can', 'steps'] as const));
    return {
      side: entry.side,
      victimSide: ctx.sides[1 - i]!.side,
      actorId: actor.id,
      actorName: actor.name,
      byManager: actor.byManager,
      weapon,
      seen: seenBy(ctx, entry.side, rng),
    };
  }
  return null;
}

/** The write-up's sentence for it. */
export function cheatLine(plan: CheatPlan, victimName: string, n: number): string {
  const pool = (plan.seen ? SAW_IT_LINES : CHEAP_SHOT_LINES)[plan.byManager ? 'manager' : 'wrestler'];
  return pool[n % pool.length]!
    .replace(/\{actor\}/g, plan.actorName)
    .replace(/\{victim\}/g, victimName)
    .replace(/\{weapon\}/g, CHEAT_WEAPON_NAMES[plan.weapon]);
}
