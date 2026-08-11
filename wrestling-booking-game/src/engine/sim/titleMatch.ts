// Putting a belt on the line — §3.1.
//
// Three bookings live in one mechanism, and the difference between them is
// only which belts you drag into `Segment.titleIds`:
//
//   nothing on the line   -> a non-title match. Champions wrestle all the
//                            time without defending; the crowd knows the
//                            difference and so does the sim.
//   one belt              -> a title defence.
//   two or more belts     -> title for title. Winner takes everything in the
//                            match, which is how a belt gets unified.
//
// A wrestler can hold as many championships at once as they can win. That is
// a booking problem, not a rule — see egoFromHoldingTitle.
//
// The one hard rule is old and worth keeping: **the belt does not change
// hands on a disqualification or a count-out.** The champion can walk out,
// lose the match, and keep the title. It is the most useful screwjob in
// wrestling and the sim should let you book it deliberately.

import type { FinishType, Id, Stipulation, Title, WorldSettings, Wrestler } from '../types';
import { isUnificationMatch, needsUnification } from '../world/titleDefence';

/** Finishes that actually move a championship. */
export function titleCanChangeHands(finish: FinishType, stipulation: Stipulation | null): boolean {
  if (finish === 'disqualification' || finish === 'countOut') {
    // Unless the stipulation was built to stop exactly this — a match with no
    // disqualifications cannot produce a disqualification finish anyway, but
    // "title changes on a DQ" is a real stipulation and this is where it goes.
    return stipulation?.titleChangesOnDQ === true;
  }
  // A draw leaves the champion holding it. Nobody beat them.
  if (finish === 'timeLimitDraw' || finish === 'doubleKO') return false;
  return true;
}

export interface TitleEligibilityContext {
  /** Everyone in the match, by side. */
  participants: { wrestler: Wrestler; side: number }[];
  /** Only belts this promotion owns can be booked on its show. */
  promotionId: Id;
  /**
   * What the match is booked as. Read only by belts that *require* a
   * stipulation; optional so the many callers that do not care are unchanged,
   * and a belt with a hard requirement is simply not offered when it is
   * missing rather than being wrongly allowed.
   */
  stipulationId?: Id | null;
}

/**
 * Which belts can legally be put on this match. A belt is eligible if it is
 * vacant (somebody has to win it) or if its champion is in the match — you
 * cannot defend a title its holder is not wrestling for.
 */
export function eligibleTitles(
  titles: readonly Title[],
  ctx: TitleEligibilityContext,
): Title[] {
  const ids = new Set(ctx.participants.map((p) => p.wrestler.id));
  const sideSizes = new Map<number, number>();
  for (const p of ctx.participants) sideSizes.set(p.side, (sideSizes.get(p.side) ?? 0) + 1);

  return titles.filter((title) => {
    if (title.promotionId !== ctx.promotionId) return false;
    // A retired championship is not defended. It keeps its lineage and stays
    // on the records; it just cannot be put on a card again until the company
    // brings it back.
    if (title.retiredWeek) return false;

    // The division is locked at creation and never moves (§3.1).
    if (title.division === 'womens' && ctx.participants.some((p) => p.wrestler.gender !== 'f')) return false;
    if (title.division === 'mens' && ctx.participants.some((p) => p.wrestler.gender !== 'm')) return false;

    // A belt only goes on the line under the stipulation it demands. A
    // Battle Royal Trophy that can be won in a singles match is not a Battle
    // Royal Trophy.
    if (title.stipulationRequired && ctx.stipulationId !== title.signatureStipulationId) return false;

    // However many people carry it, that is how many have to be on each side.
    // Taken off the title rather than guessed from the tier, so "held by two"
    // is a thing a booker can say about any belt they invent.
    const required = title.holdersRequired || (title.tier === 'tag' ? 2 : title.tier === 'trios' ? 3 : 1);
    if ([...sideSizes.values()].some((size) => size !== required)) return false;

    if (title.vacant) return true;

    // A belt with two claimants can only be in the match that settles it.
    // That is what makes the unification mandatory rather than optional: the
    // defence clock keeps running the whole time, so ducking it eventually
    // strips the thing off both of them.
    if (needsUnification(title)) return isUnificationMatch(title, [...ids]);

    // A team defends together or not at all: one half of the champions in a
    // singles match is not a title defence, and letting it be one is what
    // turns tag belts into hot potatoes.
    if (required > 1) {
      const sideOf = new Map(ctx.participants.map((p) => [p.wrestler.id, p.side]));
      const sides = title.currentHolderIds.map((id) => sideOf.get(id));
      return sides.every((side) => side !== undefined && side === sides[0]);
    }

    return title.currentHolderIds.some((holder) => ids.has(holder));
  });
}

export interface TitleOutcome {
  titleId: Id;
  /** Null when nobody won it — a retain, or a finish that cannot move a belt. */
  newHolderIds: Id[] | null;
  changed: boolean;
  /** Prestige after the match. A belt is worth what its matches are worth. */
  prestige: number;
}

export interface ResolveTitlesContext {
  /** The belts this match was contested for. */
  titles: readonly Title[];
  winnerIds: readonly Id[];
  finish: FinishType;
  stipulation: Stipulation | null;
  matchRating: number;
  settings: WorldSettings;
}

/**
 * What happens to every belt in the match. Pure — the caller commits it.
 *
 * Prestige moves with the match whether or not the belt changed hands: put
 * the world title in a five-star main event and it means more next week; put
 * it in the opener against a jobber and it means less.
 */
export function resolveTitleOutcomes(ctx: ResolveTitlesContext): TitleOutcome[] {
  const canChange = ctx.winnerIds.length > 0 && titleCanChangeHands(ctx.finish, ctx.stipulation);

  return ctx.titles.map((title) => {
    const held = new Set(title.currentHolderIds);
    const retained = !title.vacant && ctx.winnerIds.every((id) => held.has(id)) && ctx.winnerIds.length === held.size;
    const changed = canChange && !retained;

    return {
      titleId: title.id,
      newHolderIds: changed ? [...ctx.winnerIds] : null,
      changed,
      prestige: prestigeAfterMatch(title, ctx.matchRating, ctx.settings),
    };
  });
}

/**
 * A championship is worth exactly what the matches for it are worth. Drifts
 * toward the rating of its last defence, slowly enough that one bad night
 * does not devalue a belt and one good one does not make it.
 */
/**
 * How much the crowd cares that a belt was defended the way it is meant to
 * be, in rating points.
 *
 * A belt with no tradition is neutral. Honouring one is worth something;
 * ignoring one costs more than honouring it pays, because a Deathmatch
 * Championship in a normal match is a broken promise and a normal belt in a
 * cage is just a good match.
 */
export function signatureStipulationFit(
  titles: readonly Title[],
  stipulationId: Id | null,
  settings: WorldSettings,
): number {
  let total = 0;
  for (const title of titles) {
    if (!title.signatureStipulationId) continue;
    total +=
      title.signatureStipulationId === stipulationId
        ? settings.titleSignatureHonoured
        : -settings.titleSignatureIgnored;
  }
  return total;
}

export function prestigeAfterMatch(title: Title, matchRating: number, settings: WorldSettings): number {
  const drift = (matchRating - title.prestige) * settings.titlePrestigeDrift;
  return Math.max(0, Math.min(100, title.prestige + drift));
}

/**
 * The prestige the sim should treat this match as carrying. The most
 * important belt on the line sets the tone; a second one adds to it, because
 * title-for-title is a bigger night than a defence.
 */
export function matchTitlePrestige(titles: readonly Title[], settings: WorldSettings): number | null {
  if (titles.length === 0) return null;
  const highest = Math.max(...titles.map((t) => t.prestige));
  const extras = titles.length - 1;
  return Math.min(100, highest + extras * settings.titleForTitleBonus);
}

/** Human-readable summary for the card — "Non-title" is information too. */
export function titleStakesLabel(titles: readonly Title[], championInMatch: boolean): string | null {
  if (titles.length > 1) return 'Title for title';
  if (titles.length === 1) return titles[0]!.vacant ? 'For the vacant title' : 'Title match';
  return championInMatch ? 'Non-title' : null;
}
