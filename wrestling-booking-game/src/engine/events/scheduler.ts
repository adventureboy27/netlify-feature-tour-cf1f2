// Picking which event fires, and — mostly — making sure none of them fire
// too often.
//
// Three independent brakes, because any one of them alone fails:
//
//   per-event cooldown   an event that just fired cannot fire again for its
//                        own cooldown. Stops the same story repeating.
//
//   global gap           a hard floor of quiet weeks between *any* two
//                        events. Stops the game becoming a soap opera where
//                        something happens every single week.
//
//   category cooldown    a shorter gap per category, so you don't get three
//                        locker-room dramas in a row even though they're
//                        three different events.
//
// On top of that, recency damping: an event's weight is reduced for a while
// after it fires, so even once it is legal again it does not immediately
// come back around. The player should be able to run a decade and still meet
// events they have not seen.

import type { Rng } from '../rng';
import { chance, weightedPick, pick } from '../rng';
import type { Id, Wrestler, Promotion, WorldSettings, CareerStatus } from '../types';
import type { CreativeEvent, PendingEvent, EventCategory, EventSubjects } from './types';

/** What the engine remembers about what has already happened. */
export interface EventHistory {
  /** eventId -> week it last fired. */
  lastFiredByEvent: Record<Id, number>;
  /** category -> week one last fired. */
  lastFiredByCategory: Partial<Record<EventCategory, number>>;
  /** Week any event last fired. */
  lastFiredWeek: number;
  /** eventId -> how many times, ever. Feeds recency damping. */
  timesFired: Record<Id, number>;
}

export function emptyEventHistory(): EventHistory {
  return { lastFiredByEvent: {}, lastFiredByCategory: {}, lastFiredWeek: -Infinity, timesFired: {} };
}

export interface EventRollContext {
  week: number;
  library: readonly CreativeEvent[];
  history: EventHistory;
  roster: readonly Wrestler[];
  statusOf: (wrestler: Wrestler) => CareerStatus;
  promotion: Promotion;
  rivals: readonly Promotion[];
  settings: WorldSettings;
}

/** Has enough quiet passed since the last event of any kind? */
export function globalGapSatisfied(history: EventHistory, week: number, settings: WorldSettings): boolean {
  return week - history.lastFiredWeek >= settings.eventGlobalGapWeeks;
}

function categoryGapSatisfied(history: EventHistory, event: CreativeEvent, week: number, settings: WorldSettings): boolean {
  const last = history.lastFiredByCategory[event.category];
  return last === undefined || week - last >= settings.eventCategoryGapWeeks;
}

function cooldownSatisfied(history: EventHistory, event: CreativeEvent, week: number): boolean {
  const last = history.lastFiredByEvent[event.id];
  return last === undefined || week - last >= event.cooldownWeeks;
}

/**
 * Weight after damping. Each previous firing multiplies the weight down, to
 * a floor — an event you have seen five times becomes rare rather than
 * impossible, so a long save keeps its whole library in play without
 * repeating the same beats.
 */
export function dampedWeight(event: CreativeEvent, history: EventHistory, settings: WorldSettings): number {
  const seen = history.timesFired[event.id] ?? 0;
  const damped = event.weight * settings.eventRepeatDamping ** seen;
  return Math.max(damped, event.weight * settings.eventMinWeightFraction);
}

interface Candidate {
  event: CreativeEvent;
  subjects: EventSubjects;
}

/** Everything that could legally fire this week, with its subjects resolved. */
export function eligibleEvents(ctx: EventRollContext): Candidate[] {
  const { history, week, settings } = ctx;
  const candidates: Candidate[] = [];

  for (const event of ctx.library) {
    if ((event.conditions.minWeek ?? 0) > week) continue;
    if (!cooldownSatisfied(history, event, week)) continue;
    if (!categoryGapSatisfied(history, event, week, settings)) continue;
    if (event.conditions.promotion && !event.conditions.promotion(ctx.promotion)) continue;
    if (event.conditions.needsRival && ctx.rivals.length === 0) continue;

    const primaries = event.conditions.primary
      ? ctx.roster.filter((w) => event.conditions.primary!(w, ctx.statusOf(w)))
      : [undefined];
    if (primaries.length === 0) continue;

    for (const primary of primaries) {
      if (event.conditions.secondary) {
        const seconds = ctx.roster.filter(
          (w) => w.id !== primary?.id && event.conditions.secondary!(w, ctx.statusOf(w)),
        );
        if (seconds.length === 0) continue;
        candidates.push({
          event,
          subjects: { primary, secondary: seconds[0], promotion: ctx.promotion, rival: ctx.rivals[0] },
        });
      } else {
        candidates.push({ event, subjects: { primary, promotion: ctx.promotion, rival: ctx.rivals[0] } });
      }
    }
  }

  return candidates;
}

function substitute(text: string, subjects: EventSubjects): string {
  return text
    .replaceAll('{primary}', subjects.primary?.name ?? 'someone')
    .replaceAll('{secondary}', subjects.secondary?.name ?? 'someone else')
    .replaceAll('{rival}', subjects.rival?.name ?? 'a rival promotion')
    .replaceAll('{promotion}', subjects.promotion.name);
}

/**
 * Roll this week's event, or nothing. Returns at most one — the office
 * handles one story a week, and a queue of five is a chore rather than a
 * decision.
 */
export function rollWeeklyEvent(rng: Rng, ctx: EventRollContext): PendingEvent | null {
  if (!globalGapSatisfied(ctx.history, ctx.week, ctx.settings)) return null;
  if (!chance(rng, ctx.settings.eventWeeklyChance)) return null;

  const candidates = eligibleEvents(ctx);
  if (candidates.length === 0) return null;

  // Weight per *event*, not per candidate, so an event with forty eligible
  // subjects isn't forty times likelier than one with a single subject.
  const byEvent = new Map<Id, Candidate[]>();
  for (const candidate of candidates) {
    const list = byEvent.get(candidate.event.id) ?? [];
    list.push(candidate);
    byEvent.set(candidate.event.id, list);
  }

  const weighted = [...byEvent.entries()].map(
    ([, list]) => [list, dampedWeight(list[0]!.event, ctx.history, ctx.settings)] as [Candidate[], number],
  );
  const chosenList = weightedPick(rng, weighted);
  const chosen = pick(rng, chosenList);
  const { event, subjects } = chosen;

  return {
    eventId: event.id,
    week: ctx.week,
    title: substitute(event.title, subjects),
    body: substitute(pick(rng, event.body), subjects),
    category: event.category,
    subjects: {
      primaryId: subjects.primary?.id,
      secondaryId: subjects.secondary?.id,
      rivalId: subjects.rival?.id,
    },
    options: event.options.map((o) => ({ id: o.id, label: o.label, gains: o.gains, costs: o.costs })),
  };
}

/** Record that an event fired. Pure — returns a new history. */
export function recordFired(history: EventHistory, event: { eventId: Id; category: EventCategory }, week: number): EventHistory {
  return {
    lastFiredByEvent: { ...history.lastFiredByEvent, [event.eventId]: week },
    lastFiredByCategory: { ...history.lastFiredByCategory, [event.category]: week },
    lastFiredWeek: week,
    timesFired: { ...history.timesFired, [event.eventId]: (history.timesFired[event.eventId] ?? 0) + 1 },
  };
}
