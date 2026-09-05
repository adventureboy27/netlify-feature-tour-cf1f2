// The weekly sheet.
//
// Every wrestling era had one: a newsletter that ranked the top ten, listed
// every champion in every territory, and argued about the tag division. It is
// the one place in the game where the whole business is visible at once,
// across every company, and it is published whether or not the player had a
// good week.
//
// Six lists, because the divisions genuinely are separate and merging them
// throws away information: singles and tag, and men's and women's for each,
// plus the full championship roll for both divisions.
//
// Rankings here are the *world* score — a career measure — rather than the
// contender score, because this is a sheet arguing about who is the best
// wrestler alive, not who is next for a belt.

import type { Id, Stable, Title, Wrestler, WorldSettings } from '../types';
import { worldScore, type RankingContext } from './rankings';
import { teamStrength, weeksTogether } from './tagTeams';

export interface RankedWrestler {
  rank: number;
  wrestlerId: Id;
  promotionId: Id | null;
  score: number;
  /** The most prestigious belt they hold, if any. */
  titleId: Id | null;
}

export interface RankedTeam {
  rank: number;
  teamId: Id;
  memberIds: Id[];
  promotionId: Id | null;
  score: number;
  titleId: Id | null;
}

export interface ChampionEntry {
  titleId: Id;
  promotionId: Id;
  holderIds: Id[];
  /** Weeks the current reign has run. */
  reignWeeks: number;
}

export interface DivisionLists {
  wrestlers: RankedWrestler[];
  teams: RankedTeam[];
  champions: ChampionEntry[];
}

export interface Publication {
  week: number;
  mens: DivisionLists;
  womens: DivisionLists;
}

export interface PublicationContext extends RankingContext {
  wrestlers: readonly Wrestler[];
  stables: readonly Stable[];
  settings: WorldSettings;
}

/** Somebody the sheet will consider: signed, alive, and not retired. */
function eligible(w: Wrestler): boolean {
  return w.promotionId !== null && !w.deceased && w.careerStatus !== 'retired';
}

/** The best belt somebody is holding, by prestige. */
function bestTitleFor(titles: readonly Title[], holderId: Id): Title | null {
  let best: Title | null = null;
  for (const title of titles) {
    if (title.vacant || !title.currentHolderIds.includes(holderId)) continue;
    if (!best || title.prestige > best.prestige) best = title;
  }
  return best;
}

function rankWrestlers(people: readonly Wrestler[], ctx: PublicationContext, limit: number): RankedWrestler[] {
  return people
    .filter(eligible)
    .map((w) => ({
      wrestlerId: w.id,
      promotionId: w.promotionId,
      score: worldScore(w, ctx),
      titleId: bestTitleFor(ctx.titles, w.id)?.id ?? null,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));
}

function rankTeams(gender: 'm' | 'f', ctx: PublicationContext, limit: number): RankedTeam[] {
  const byId = new Map(ctx.wrestlers.map((w) => [w.id, w]));

  return ctx.stables
    .filter((s) => s.kind === 'tagTeam' && s.disbandedWeek === null && s.memberIds.length === 2)
    .map((team) => {
      const members = team.memberIds.map((id) => byId.get(id)).filter((w): w is Wrestler => Boolean(w));
      return { team, members };
    })
    .filter(({ members }) => members.length === 2 && members.every((w) => w.gender === gender && eligible(w)))
    .map(({ team, members }) => ({
      teamId: team.id,
      memberIds: [...team.memberIds],
      promotionId: members[0]!.promotionId,
      // Longevity counts for something: a team that has been together five
      // years is an act, and the sheet knows the difference.
      score:
        teamStrength(team, members, ctx.settings.publicationTeamRecordWeight) +
        Math.min(1, weeksTogether(team, ctx.currentWeek) / ctx.settings.publicationTeamLongevityWeeks) *
          ctx.settings.publicationTeamLongevityBonus,
      titleId: bestTitleFor(ctx.titles, team.memberIds[0]!)?.id ?? null,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));
}

/**
 * Every belt currently held in that division, most prestigious first. Vacant
 * titles are left off — a vacancy is news, but it is not a champion.
 */
function championsFor(gender: 'm' | 'f', ctx: PublicationContext): ChampionEntry[] {
  const byId = new Map(ctx.wrestlers.map((w) => [w.id, w]));

  return ctx.titles
    .filter((title) => {
      if (title.vacant || title.currentHolderIds.length === 0) return false;
      // A title's own division decides where it is listed, except for the
      // open-division belts (tag, hardcore), which follow their holders.
      if (title.division === 'womens') return gender === 'f';
      if (title.division === 'mens') return gender === 'm';
      return title.currentHolderIds.every((id) => byId.get(id)?.gender === gender);
    })
    .sort((a, b) => b.prestige - a.prestige)
    .map((title) => ({
      titleId: title.id,
      promotionId: title.promotionId,
      holderIds: [...title.currentHolderIds],
      reignWeeks: Math.max(0, ctx.currentWeek - title.reignStartWeek),
    }));
}

function listsFor(gender: 'm' | 'f', ctx: PublicationContext): DivisionLists {
  const people = ctx.wrestlers.filter((w) => w.gender === gender);
  return {
    wrestlers: rankWrestlers(people, ctx, ctx.settings.publicationWrestlerListSize),
    teams: rankTeams(gender, ctx, ctx.settings.publicationTeamListSize),
    champions: championsFor(gender, ctx),
  };
}

/** This week's sheet. Derived from the world, so it is never stale. */
export function publish(ctx: PublicationContext): Publication {
  return {
    week: ctx.currentWeek,
    mens: listsFor('m', ctx),
    womens: listsFor('f', ctx),
  };
}

/**
 * Just the positions, for week-on-week movement.
 *
 * The full sheet builds belt lookups, tag rankings and champion lists, none of
 * which the movement arrows need — and building all of it every single week
 * made the weekly tick several times more expensive than the entire match
 * simulation. This ranks the wrestlers and nothing else.
 */
export interface PublicationPositions {
  week: number;
  mens: Record<Id, number>;
  womens: Record<Id, number>;
}

export function publishPositions(ctx: PublicationContext): PublicationPositions {
  const rankOne = (gender: 'm' | 'f'): Record<Id, number> => {
    const positions: Record<Id, number> = {};
    ctx.wrestlers
      .filter((w) => w.gender === gender && eligible(w))
      .map((w) => ({ id: w.id, score: worldScore(w, ctx) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, ctx.settings.publicationWrestlerListSize)
      .forEach((entry, i) => {
        positions[entry.id] = i + 1;
      });
    return positions;
  };

  return { week: ctx.currentWeek, mens: rankOne('m'), womens: rankOne('f') };
}

/** Where somebody sits on their division's list, or null if they are off it. */
export function rankingOf(publication: Publication, wrestlerId: Id, gender: 'm' | 'f'): number | null {
  const lists = gender === 'f' ? publication.womens : publication.mens;
  return lists.wrestlers.find((r) => r.wrestlerId === wrestlerId)?.rank ?? null;
}

/** How a position moved since last week's sheet. */
export function movement(
  current: Publication,
  previous: PublicationPositions | null,
  wrestlerId: Id,
  gender: 'm' | 'f',
): 'new' | 'up' | 'down' | 'same' | null {
  const now = rankingOf(current, wrestlerId, gender);
  if (now === null) return null;
  if (!previous) return 'same';

  const before = (gender === 'f' ? previous.womens : previous.mens)[wrestlerId];
  if (before === undefined) return 'new';
  if (now < before) return 'up';
  if (now > before) return 'down';
  return 'same';
}
