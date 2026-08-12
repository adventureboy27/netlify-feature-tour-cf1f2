// Factions — the group that gets bigger than the show.
//
// A stable in this game was a tag team with extra members: shared colours, a
// shared record, and no reason for anybody to care that it existed. What made
// the invasion angle the most valuable thing wrestling ever did was not that
// four men wore the same shirt. It was that the group kept taking people, the
// audience stopped being able to predict who was in it, and for about two
// years the company's own programme looked like it was losing.
//
// So a faction has three things an ordinary stable does not:
//
//   Momentum. It draws as a unit. A faction running through the card is worth
//   more than the sum of the people in it, and a faction losing every week is
//   worth less than nothing.
//
//   Recruitment. It takes people — off your own roster, and off somebody
//   else's. Every turn and every secret signing can feed it, which is what
//   makes the angle escalate instead of repeating.
//
//   Danger. Past a point it is bigger than the company housing it. The owner
//   notices. The people in it start believing it. And it can be the thing
//   that ends a promotion rather than the thing that saves it — which is the
//   honest version of the story, not the highlight reel.

import type { Rng } from '../rng';
import { chance } from '../rng';
import type { Id, Stable, Wrestler, WorldSettings } from '../types';

/**
 * How much the group is drawing, 0-100.
 *
 * Not stored — read from the people in it and what they have been doing, so
 * it can never be stale and there is nothing to keep in sync. A faction is
 * only as hot as its members are.
 */
export function factionHeat(
  faction: Stable,
  wrestlers: Record<Id, Wrestler | undefined>,
  settings: WorldSettings,
): number {
  const members = faction.memberIds.map((id) => wrestlers[id]).filter((w): w is Wrestler => Boolean(w));
  if (members.length === 0) return 0;

  const draw = members.reduce((sum, w) => sum + w.popularity, 0) / members.length;
  const form = members.reduce((sum, w) => sum + w.momentum, 0) / members.length;
  // A group is more than the people in it, and the bonus grows with size —
  // which is the whole reason recruiting is the engine of the angle.
  const scale = Math.min(
    settings.factionSizeBonusCap,
    Math.max(0, members.length - 2) * settings.factionSizeBonus,
  );

  return Math.min(
    100,
    draw * settings.factionDrawWeight + form * settings.factionFormWeight + scale,
  );
}

/**
 * Is the group bigger than the company it is in?
 *
 * The point at which the angle stops being an angle. Measured against the
 * promotion's own rating rather than an absolute, so a small territory can be
 * overrun by four men and a national cannot.
 */
export function overshadowsCompany(heat: number, companyRating: number, settings: WorldSettings): boolean {
  return heat > companyRating + settings.factionOvershadowMargin;
}

export type FactionStanding = 'forming' | 'established' | 'running the place' | 'out of control';

export function factionStanding(
  heat: number,
  size: number,
  companyRating: number,
  settings: WorldSettings,
): FactionStanding {
  if (overshadowsCompany(heat, companyRating, settings) && size >= settings.factionOutOfControlSize) {
    return 'out of control';
  }
  if (overshadowsCompany(heat, companyRating, settings)) return 'running the place';
  if (size >= settings.factionEstablishedSize) return 'established';
  return 'forming';
}

export interface RecruitmentTarget {
  wrestlerId: Id;
  name: string;
  /** 0-1. How likely they are to go for it if asked. */
  appeal: number;
  /** Why they would. Shown to the booker, because it is the interesting part. */
  reason: string;
}

/**
 * Who would join, and why.
 *
 * The reasons matter more than the number: somebody unhappy, somebody being
 * wasted, somebody whose ego has outgrown their spot, and somebody who is
 * simply friends with a member. A faction that only ever recruits the
 * disgruntled tells one story; one that can take a company man tells a much
 * better one.
 */
export function recruitmentTargets(
  faction: Stable,
  candidates: readonly Wrestler[],
  settings: WorldSettings,
): RecruitmentTarget[] {
  const inside = new Set(faction.memberIds);

  return candidates
    .filter((w) => !inside.has(w.id) && !w.deceased && w.careerStatus !== 'retired' && w.role === 'wrestler')
    .map((w) => {
      const unhappy = (100 - w.morale) / 100;
      const ego = w.ego / 100;
      const overlooked = Math.max(0, w.hype - w.popularity) / 100;

      const appeal = Math.min(
        1,
        unhappy * settings.factionRecruitMoraleWeight +
          ego * settings.factionRecruitEgoWeight +
          overlooked * settings.factionRecruitOverlookedWeight,
      );

      const reason =
        unhappy > 0.55
          ? 'Miserable where they are, and everybody backstage knows it.'
          : overlooked > 0.2
            ? 'Better than the spot they are in, and aware of it.'
            : ego > 0.7
              ? 'Thinks they should be the biggest thing in the company. Might be right.'
              : 'Nothing obviously wrong. Which is what makes it a story.';

      return { wrestlerId: w.id, name: w.name, appeal, reason };
    })
    .sort((a, b) => b.appeal - a.appeal);
}

export function rollRecruit(rng: Rng, target: RecruitmentTarget, standing: FactionStanding, settings: WorldSettings): boolean {
  // Nobody wants to be the fourth man in a group nobody is talking about, and
  // everybody wants to be in the one running the place.
  const pull =
    standing === 'out of control'
      ? settings.factionPullOutOfControl
      : standing === 'running the place'
        ? settings.factionPullRunning
        : standing === 'established'
          ? settings.factionPullEstablished
          : settings.factionPullForming;
  return chance(rng, Math.min(0.95, target.appeal * pull));
}

/**
 * Somebody in the group who might walk.
 *
 * A faction is held together by it being worth being in. When it stops
 * drawing, the people whose egos brought them start looking at the door —
 * and a defection is a better story than a slow fade, so the game would
 * rather have one.
 */
export function defectionRisk(
  member: Wrestler,
  standing: FactionStanding,
  settings: WorldSettings,
): number {
  if (standing === 'out of control' || standing === 'running the place') return 0;
  const ego = member.ego / 100;
  const unhappy = (100 - member.morale) / 100;
  return Math.min(
    settings.factionDefectionCap,
    (ego + unhappy) * settings.factionDefectionWeight * (standing === 'forming' ? 1.6 : 1),
  );
}

/**
 * What holding a faction does to the people in it.
 *
 * Being in the group that is running the place is very good for a career and
 * very bad for a locker room. The ego inflation is the cost, and it is what
 * eventually turns the angle into a problem — the same way it did in life.
 */
export function factionEgoDrift(standing: FactionStanding, settings: WorldSettings): number {
  if (standing === 'out of control') return settings.factionEgoDriftOutOfControl;
  if (standing === 'running the place') return settings.factionEgoDriftRunning;
  return 0;
}
