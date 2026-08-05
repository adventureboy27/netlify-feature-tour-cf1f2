// The end-of-year awards.
//
// Good and bad, deliberately. An awards night that only hands out trophies is
// a press release; one that also names the Worst Match and the Downfall of
// the Year is the thing people actually argue about for the next twelve
// months. Both halves move the needle: winning Wrestler of the Year makes
// somebody, and being named the year's biggest flop costs them.
//
// Everything is judged on the year that just finished, not on a career — a
// twenty-year legend who had a quiet year does not win Wrestler of the Year,
// and that is the point of having the award at all.
//
// The effects are the reason this is in engine/ rather than in the UI. An
// award nobody feels is decoration.

import type { Id, WorldSettings, Wrestler } from '../types';

/**
 * The top of the popularity scale. Not a tunable — it is the definition of
 * the scale itself, the same way 100 is the top of a percentage — but the
 * awards have to know about it, because "did not grow" means something very
 * different for somebody already sitting on it.
 */
const POPULARITY_CEILING = 100;

export type AwardId =
  | 'wrestlerOfTheYear'
  | 'matchOfTheYear'
  | 'comebackOfTheYear'
  | 'mostImproved'
  | 'tagTeamOfTheYear'
  | 'worstMatchOfTheYear'
  | 'downfallOfTheYear'
  | 'biggestDisappointment';

export interface AwardDefinition {
  id: AwardId;
  name: string;
  blurb: string;
  /** Good awards lift; bad ones cost. */
  good: boolean;
}

export const AWARDS: AwardDefinition[] = [
  {
    id: 'wrestlerOfTheYear',
    name: 'Wrestler of the Year',
    blurb: 'The one everybody had to talk about.',
    good: true,
  },
  {
    id: 'matchOfTheYear',
    name: 'Match of the Year',
    blurb: 'The one people will still be arguing about next year.',
    good: true,
  },
  {
    id: 'comebackOfTheYear',
    name: 'Comeback of the Year',
    blurb: 'Written off, and then not.',
    good: true,
  },
  {
    id: 'mostImproved',
    name: 'Most Improved',
    blurb: 'Walked in a nobody and walked out somebody.',
    good: true,
  },
  {
    id: 'tagTeamOfTheYear',
    name: 'Tag Team of the Year',
    blurb: 'The team that carried a division.',
    good: true,
  },
  {
    id: 'worstMatchOfTheYear',
    name: 'Worst Match of the Year',
    blurb: 'Somebody has to win this one.',
    good: false,
  },
  {
    id: 'downfallOfTheYear',
    name: 'Downfall of the Year',
    blurb: 'The furthest anybody fell in twelve months.',
    good: false,
  },
  {
    id: 'biggestDisappointment',
    name: 'Biggest Disappointment',
    blurb: 'Everything in place, and it went nowhere.',
    good: false,
  },
];

export function awardById(id: AwardId): AwardDefinition | undefined {
  return AWARDS.find((a) => a.id === id);
}

/** One award, handed out. */
export interface AwardWinner {
  awardId: AwardId;
  /** Two ids for a tag award, one otherwise. */
  wrestlerIds: Id[];
  year: number;
  /** The line the announcement reads. */
  citation: string;
}

/**
 * A year's worth of what happened, gathered as it happens because none of it
 * can be reconstructed afterwards: popularity a year ago is gone the moment
 * it changes.
 */
export interface YearRecord {
  year: number;
  /** Popularity for everybody as the year opened. */
  popularityAtStart: Record<Id, number>;
  /** Best and worst rated matches anywhere in the world this year. */
  bestMatch: MatchNote | null;
  worstMatch: MatchNote | null;
  /** This year's tag team results only. Their lifetime records are elsewhere. */
  teamWins: Record<Id, number>;
  teamLosses: Record<Id, number>;
  /** Matches worked this year, so a one-match cameo cannot win anything. */
  matches: Record<Id, number>;
}

export interface MatchNote {
  wrestlerIds: Id[];
  rating: number;
  week: number;
  /** Where it happened, so the citation can say so. */
  promotionName: string;
}

export function emptyYearRecord(year: number, wrestlers: readonly Wrestler[]): YearRecord {
  const popularityAtStart: Record<Id, number> = {};
  for (const w of wrestlers) popularityAtStart[w.id] = w.popularity;
  return {
    year,
    popularityAtStart,
    bestMatch: null,
    worstMatch: null,
    teamWins: {},
    teamLosses: {},
    matches: {},
  };
}

/**
 * Note a match against the year. Only the two extremes are kept — a year does
 * not need a list of every match in it, it needs the best one and the worst
 * one, and those are the only two anybody argues about in December.
 */
export function noteMatch(record: YearRecord, entry: MatchNote): void {
  if (!record.bestMatch || entry.rating > record.bestMatch.rating) record.bestMatch = entry;
  if (!record.worstMatch || entry.rating < record.worstMatch.rating) record.worstMatch = entry;
  for (const id of entry.wrestlerIds) record.matches[id] = (record.matches[id] ?? 0) + 1;
}

/** Note a tag team's night against the year. */
export function noteTeamResult(record: YearRecord, teamId: Id, outcome: 'win' | 'loss' | 'draw'): void {
  if (outcome === 'win') record.teamWins[teamId] = (record.teamWins[teamId] ?? 0) + 1;
  if (outcome === 'loss') record.teamLosses[teamId] = (record.teamLosses[teamId] ?? 0) + 1;
}

export interface AwardContext {
  year: number;
  wrestlers: readonly Wrestler[];
  record: YearRecord;
  /** Tag teams still going, for the team award. */
  teams: { id: Id; name: string; memberIds: Id[] }[];
  settings: WorldSettings;
}

/** How far somebody moved this year, positive or negative. */
export function yearMovement(w: Wrestler, record: YearRecord): number {
  const before = record.popularityAtStart[w.id];
  if (before === undefined) return 0;
  return w.popularity - before;
}

function active(w: Wrestler): boolean {
  return !w.deceased && w.careerStatus !== 'retired' && w.promotionId !== null;
}

/**
 * Hand out the year. Every award is optional — a year with no comeback in it
 * simply does not have a Comeback of the Year, which is better than inventing
 * one.
 */
export function decideAwards(ctx: AwardContext): AwardWinner[] {
  const winners: AwardWinner[] = [];
  const worked = ctx.wrestlers
    .filter(active)
    .filter((w) => (ctx.record.matches[w.id] ?? 0) >= ctx.settings.awardMinMatches);
  const say = (awardId: AwardId, wrestlerIds: Id[], citation: string) =>
    winners.push({ awardId, wrestlerIds, year: ctx.year, citation });

  const nameOf = (id: Id) => ctx.wrestlers.find((w) => w.id === id)?.name ?? 'Somebody';
  const versus = (ids: readonly Id[]) => ids.map(nameOf).join(' vs ');
  const moved = (w: Wrestler) => Math.round(yearMovement(w, ctx.record));

  // Nobody wins two of the individual awards — they are different readings of
  // the same year and one person collecting several of them reads as a bug.
  // Membership is by *winning*, not by topping a list: being the least-worst
  // candidate for an award that went unclaimed must not disqualify anybody
  // from the next one.
  const claimed = new Set<Id>();

  // --- Wrestler of the Year: standing plus the year's movement. A legend who
  //     coasted loses this to somebody who climbed, which is the whole reason
  //     the award is worth having.
  const best = [...worked]
    .map((w) => ({ w, score: w.popularity + yearMovement(w, ctx.record) * ctx.settings.awardMovementWeight }))
    .sort((a, b) => b.score - a.score)[0];
  if (best && best.w.popularity >= ctx.settings.awardWrestlerOfYearFloor) {
    const climb = moved(best.w);
    say(
      'wrestlerOfTheYear',
      [best.w.id],
      climb > 0
        ? `Carried the business for twelve months, and finished the year bigger than they started it.`
        : `Nobody drew more eyes this year.`,
    );
    claimed.add(best.w.id);
  }

  // --- Match and Worst Match of the Year. Both come off the year's extremes,
  //     both are allowed to go unclaimed.
  const bestMatch = ctx.record.bestMatch;
  if (bestMatch && bestMatch.rating >= ctx.settings.awardMatchOfYearFloor) {
    say(
      'matchOfTheYear',
      bestMatch.wrestlerIds,
      `${versus(bestMatch.wrestlerIds)} in ${bestMatch.promotionName}. Nobody got near it.`,
    );
  }
  const worstMatch = ctx.record.worstMatch;
  if (worstMatch && worstMatch.rating <= ctx.settings.awardWorstMatchCeiling) {
    say(
      'worstMatchOfTheYear',
      worstMatch.wrestlerIds,
      `${versus(worstMatch.wrestlerIds)}. Everybody involved would like it forgotten.`,
    );
  }

  // --- Comeback: the biggest climb by somebody who had fallen far enough to
  //     need one.
  const comeback = [...worked]
    .filter((w) => !claimed.has(w.id))
    .filter((w) => (ctx.record.popularityAtStart[w.id] ?? 100) <= ctx.settings.awardComebackFromBelow)
    .map((w) => ({ w, gain: yearMovement(w, ctx.record) }))
    .sort((a, b) => b.gain - a.gain)[0];
  if (comeback && comeback.gain >= ctx.settings.awardComebackGain) {
    say('comebackOfTheYear', [comeback.w.id], `Written off in January. Not written off now.`);
    claimed.add(comeback.w.id);
  }

  // --- Most improved: the biggest climb by anybody else. A different story
  //     from a comeback — this one was never up there to fall from.
  const improved = [...worked]
    .filter((w) => !claimed.has(w.id))
    .map((w) => ({ w, gain: yearMovement(w, ctx.record) }))
    .sort((a, b) => b.gain - a.gain)[0];
  if (improved && improved.gain >= ctx.settings.awardImprovementGain) {
    say('mostImproved', [improved.w.id], `Not the same wrestler they were twelve months ago.`);
    claimed.add(improved.w.id);
  }

  // --- Tag Team of the Year, on this year's record rather than a lifetime of
  //     one.
  const teamRow = ctx.teams
    .map((t) => ({
      team: t,
      wins: ctx.record.teamWins[t.id] ?? 0,
      losses: ctx.record.teamLosses[t.id] ?? 0,
    }))
    .sort((a, b) => b.wins - b.losses - (a.wins - a.losses))[0];
  if (teamRow && teamRow.wins >= ctx.settings.awardTeamMinWins) {
    say(
      'tagTeamOfTheYear',
      teamRow.team.memberIds,
      `${teamRow.team.name} went ${teamRow.wins}-${teamRow.losses} and held the division up.`,
    );
  }

  // --- Downfall: the biggest fall, and it has to be a real one.
  const downfall = [...worked]
    .filter((w) => !claimed.has(w.id))
    .map((w) => ({ w, drop: -yearMovement(w, ctx.record) }))
    .sort((a, b) => b.drop - a.drop)[0];
  if (downfall && downfall.drop >= ctx.settings.awardDownfallDrop) {
    say('downfallOfTheYear', [downfall.w.id], `A long way down in a short year.`);
    claimed.add(downfall.w.id);
  }

  // --- Biggest disappointment: was already a big deal and went backwards
  //     while the rest of the top of the business did not. Distinct from a
  //     downfall, which is an absolute fall off a cliff.
  //
  //     Measured against their peers rather than against zero, and this is
  //     the whole trick. Somebody at the top of the card has nowhere left to
  //     climb — popularity has a ceiling — so "did not get any bigger" is a
  //     property of the scale, not of their year, and judging it absolutely
  //     hands this award to the biggest name in the world every December.
  //     Against the field, a year where everybody at the top drifted down a
  //     little is simply a flat year for the business, and nobody is to blame
  //     for it.
  const contenders = worked
    .filter((w) => !claimed.has(w.id))
    .filter((w) => (ctx.record.popularityAtStart[w.id] ?? 0) >= ctx.settings.awardDisappointmentFloor)
    .map((w) => ({
      w,
      movement: yearMovement(w, ctx.record),
      // How much further up there was to go in January.
      room: POPULARITY_CEILING - (ctx.record.popularityAtStart[w.id] ?? 0),
    }))
    .sort((a, b) => a.movement - b.movement);
  const median = contenders.length > 0 ? contenders[Math.floor(contenders.length / 2)]!.movement : 0;
  // The worst year among those who could actually have matched the field. Set
  // against somebody sitting on the ceiling, "everybody else grew and you did
  // not" is a fact about the scale, not about them.
  const disappointment = contenders.find((c) => c.room >= median);
  if (disappointment && median - disappointment.movement >= ctx.settings.awardDisappointmentDrop) {
    say('biggestDisappointment', [disappointment.w.id], `Everything in place, and a year spent going backwards.`);
  }

  return winners;
}

/** What an award does to the people who won it. */
export interface AwardEffect {
  wrestlerId: Id;
  popularity: number;
  momentum: number;
  morale: number;
}

export function awardEffects(winner: AwardWinner, settings: WorldSettings): AwardEffect[] {
  const definition = awardById(winner.awardId);
  const good = definition?.good ?? true;

  // The headline awards are worth more than the rest, in both directions.
  const headline = winner.awardId === 'wrestlerOfTheYear' || winner.awardId === 'downfallOfTheYear';
  const scale = headline ? settings.awardHeadlineScale : 1;

  return winner.wrestlerIds.map((wrestlerId) => ({
    wrestlerId,
    popularity: (good ? settings.awardPopularityGain : -settings.awardPopularityLoss) * scale,
    momentum: (good ? settings.awardMomentumGain : -settings.awardMomentumLoss) * scale,
    morale: (good ? settings.awardMoraleGain : -settings.awardMoraleLoss) * scale,
  }));
}
