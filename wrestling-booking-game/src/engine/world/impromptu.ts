// Shows that were not on the calendar.
//
// world/schedule.ts is the pattern a company announces and lives inside for a
// year. This is the other kind of show — the one nobody planned, added to a
// week because something happened.
//
// Two of them, and they are opposite in shape:
//
//   - A **memorial** is not a decision. Somebody the company mattered to has
//     died, and you run the building that week. The existing `MemoriamShow`
//     turned the *next scheduled* show into a tribute, which is a modifier on
//     a thing that was happening anyway; this is a night that would not
//     otherwise exist, named after him, and the fact that it costs you a
//     night of roster miles is the point rather than a flaw.
//
//   - A **charity night** is a decision, and a small one. Somebody asks. The
//     gate goes elsewhere, so it is a night's work for no money at all — paid
//     back in reputation, in the locker room, and in a town remembering you
//     turned up.
//
// Both land on the week's fixture list beside the pattern, both cost the
// roster the night, and neither can be scheduled in advance. That is what
// makes them impromptu rather than a second calendar.

import type { Rng } from '../rng';
import { chance, pick } from '../rng';
import type { Id, WorldSettings } from '../types';
import type { Day } from './calendar';

export type ImpromptuKind = 'memorial' | 'charity';

export interface ImpromptuShow {
  id: Id;
  kind: ImpromptuKind;
  /** `In Memoriam of Earl Mercer`. Editable, like any show on the calendar. */
  name: string;
  /** The week it runs. Impromptu shows are never scheduled ahead. */
  week: number;
  day: Day;
  /** Who it is for, when it is for somebody. */
  forWrestlerId: Id | null;
  forName: string | null;
  /** One line for the paper, said the week it is announced. */
  announcement: string;
}

/**
 * The night a company would put an unplanned show on.
 *
 * Late in the week, because the pattern already has the good nights and
 * nobody moves television for a benefit.
 */
const SPARE_NIGHTS: Day[] = ['Sunday', 'Thursday', 'Tuesday', 'Saturday'];

export function spareNight(taken: readonly Day[], rng: Rng): Day {
  const free = SPARE_NIGHTS.filter((d) => !taken.includes(d));
  // A company already running every spare night runs this one on top. A
  // memorial does not wait for a gap in the schedule.
  return free.length > 0 ? pick(rng, free) : pick(rng, [...SPARE_NIGHTS]);
}

/**
 * Was this somebody this company would close the doors for?
 *
 * Anybody on the roster, and anybody who spent real time here — a man who
 * gave a company eight years gets a show whether or not he was still under
 * contract when he died, which is the whole difference between a memorial and
 * a press release.
 */
export function worthAMemorial(
  ctx: {
    onOurRoster: boolean;
    weeksWithUs: number;
    wasAChampionHere: boolean;
    hallOfFamer: boolean;
  },
  settings: WorldSettings,
): boolean {
  if (ctx.onOurRoster) return true;
  if (ctx.hallOfFamer && ctx.weeksWithUs > 0) return true;
  if (ctx.wasAChampionHere) return true;
  return ctx.weeksWithUs >= settings.memorialTenureWeeks;
}

/** `In Memoriam of Earl Mercer`. */
export function memorialName(forName: string): string {
  return `In Memoriam of ${forName}`;
}

export function memorialShow(
  rng: Rng,
  forWrestlerId: Id,
  forName: string,
  week: number,
  takenNights: readonly Day[],
  promotionName: string,
): ImpromptuShow {
  return {
    id: `impromptu-memorial-${forWrestlerId}-${week}`,
    kind: 'memorial',
    name: memorialName(forName),
    week,
    day: spareNight(takenNights, rng),
    forWrestlerId,
    forName,
    announcement: `${promotionName} have added a show this week for ${forName}. Ten bells, everybody on the card who can stand, and the gate to ${forName}'s family.`,
  };
}

/**
 * Somebody asks. Rare, and never in a week that already has something on it —
 * a company does not run a benefit the same week it buries somebody.
 */
export function rollCharityNight(
  rng: Rng,
  ctx: { week: number; takenNights: readonly Day[]; promotionName: string; townName: string; alreadyBusy: boolean },
  settings: WorldSettings,
): ImpromptuShow | null {
  if (!settings.charityShowsEnabled || ctx.alreadyBusy) return null;
  if (!chance(rng, settings.charityShowChance)) return null;

  const cause = pick(rng, [...CAUSES]);
  return {
    id: `impromptu-charity-${ctx.week}`,
    kind: 'charity',
    name: `${ctx.townName} Benefit Night`,
    week: ctx.week,
    day: spareNight(ctx.takenNights, rng),
    forWrestlerId: null,
    forName: null,
    announcement: `${ctx.promotionName} have put on a benefit night in ${ctx.townName} for ${cause}. Nobody is getting paid for it.`,
  };
}

const CAUSES = [
  'the volunteer fire service',
  'a children’s hospital',
  'the families of the mill layoffs',
  'a wrestler nobody has heard of who cannot pay for their surgery',
  'the flood relief fund',
  'the local food bank',
];

/**
 * What the night is worth, which is never money.
 *
 * A memorial draws — people turn out for it, and that gate goes to the family
 * rather than to you. A benefit draws less and pays nothing either. Both buy
 * the same two things: a room that thinks better of the company, and a town
 * that remembers.
 */
export interface ImpromptuReturn {
  /** Company reputation. */
  reputation: number;
  /** Locker-room morale, everybody. */
  morale: number;
  /** Standing in the town it ran in. */
  following: number;
  /** What it costs to stage. Real, because the building is real. */
  cost: number;
}

export function returnsFor(show: ImpromptuShow, settings: WorldSettings): ImpromptuReturn {
  const s = settings;
  if (show.kind === 'memorial') {
    return {
      reputation: s.memorialReputation,
      // A company that buries its own properly is a company people want to
      // work for, and one that would not is a company they remember not
      // wanting to work for.
      morale: s.memorialMorale,
      following: s.memorialFollowing,
      cost: s.impromptuShowCost,
    };
  }
  return {
    reputation: s.charityReputation,
    morale: s.charityMorale,
    following: s.charityFollowing,
    cost: s.impromptuShowCost,
  };
}

// ------------------------------------------------------- the gate, and whose

/**
 * A memorial draws, and none of it is yours.
 *
 * The announcement has always said the gate goes to the family. It did not:
 * the night was a flat cost with no gate at all, which made burying somebody
 * properly a fixed fine rather than a gesture. Now the house pays for the
 * house and everything above that leaves the company.
 *
 * The shape that matters: a company that draws well gives more away and is
 * out nothing, and a company that draws badly gives nothing away and eats the
 * building. So the cost of doing right by somebody is highest for exactly the
 * promotion that can least afford it, which is the true and the harder
 * version.
 */
export interface MemorialSettlement {
  /** What the night took at the door. */
  gate: number;
  /** What the promotion is out of pocket, after the gate covered what it could. */
  costToUs: number;
  /** What went out of the door to the family. */
  toTheFamily: number;
  /**
   * 0-1 — how well the night did by them. Scales the goodwill, because a
   * packed building and a cheque is not the same gesture as an empty one.
   */
  generosity: number;
}

export function settleMemorial(drawTonight: number, settings: WorldSettings): MemorialSettlement {
  // Measured against what the company draws in this town this week, because
  // that is the honest answer to "how many people would turn out for this" —
  // an unplanned night late in the week, so less than a card they advertised.
  const gate = Math.max(0, Math.round(drawTonight * settings.memorialGateShare));
  const cost = settings.impromptuShowCost;
  return {
    gate,
    costToUs: Math.max(0, cost - gate),
    toTheFamily: Math.max(0, gate - cost),
    generosity: Math.min(1, Math.max(0, gate - cost) / settings.memorialGenerousGate),
  };
}

/**
 * The goodwill, scaled by what actually reached them.
 *
 * A company that ran the show at all gets some credit — turning up is most of
 * it — and the rest is earned by the size of the cheque.
 */
export function scaleForGenerosity(base: number, generosity: number, settings: WorldSettings): number {
  const floor = settings.memorialGoodwillFloor;
  return base * (floor + (1 - floor) * generosity);
}

/** How the paper reports it afterwards. */
export function afterLine(show: ImpromptuShow): string {
  if (show.kind === 'memorial') {
    return `The building was full for ${show.forName ?? 'them'} and nobody left early.`;
  }
  return `${show.name} drew a decent house for a night nobody was paid for.`;
}

/** And what the family got, which is the point of the night. */
export function familyLine(forName: string, settled: MemorialSettlement): string {
  if (settled.toTheFamily <= 0) {
    return `The house for ${forName} did not cover the building. The company paid for the night and there was nothing left to send on.`;
  }
  return `Every penny above the cost of the night — ${Math.round(settled.toTheFamily).toLocaleString()} — went to ${forName}'s family.`;
}
