// The record books.
//
// A save that runs thirty years accumulates a genuine history, and almost all
// of it is already sitting in the data — every title reign carries the weeks
// it lasted and the company it happened in, every wrestler carries their
// record and the marks their career left on them. This module reads that
// history back out; it stores nothing of its own, so a record can never drift
// out of sync with what actually happened.
//
// The brief was "fun stuff good or bad", and the bad half matters. A hall of
// fame is a list of people who did well. A record book has the shortest reign
// in history in it, and the man who lost eleven in a row, and that is the half
// people actually read out to each other.

import type { Id, Title, TitleReignRecord, Wrestler } from '../types';

/** One line in the book. */
export interface RecordEntry {
  /** Who it belongs to. More than one for a tag reign. */
  wrestlerIds: Id[];
  /** The number itself, already in its display unit. */
  value: number;
  /** How to read the number. */
  unit: 'days' | 'weeks' | 'matches' | 'reigns' | 'times' | 'years' | 'stars' | 'people';
  /** Company, belt, or whatever else gives the number meaning. */
  detail?: string;
  /** When it happened, if it was a moment rather than a total. */
  week?: number;
}

export interface RecordSection {
  id: string;
  title: string;
  /** One line saying what is being measured. */
  blurb: string;
  entries: RecordEntry[];
}

export interface RecordsContext {
  wrestlers: readonly Wrestler[];
  titles: readonly Title[];
  currentWeek: number;
  /** How many names each record lists. */
  limit: number;
}

/** Weeks are the game's clock; days are how wrestling talks about reigns. */
export function reignDays(reign: TitleReignRecord, currentWeek: number): number {
  return Math.max(0, (reign.endWeek ?? currentWeek) - reign.startWeek) * 7;
}

/** Everybody who could plausibly appear in the book. */
function everyone(ctx: RecordsContext): Wrestler[] {
  return ctx.wrestlers.filter((w) => w.role === 'wrestler');
}

/**
 * How old a holder was when they won a belt.
 *
 * Read off the reign rather than reconstructed from their age today. The
 * reconstruction (age minus the years since) looks equivalent and is not: it
 * assumes an unbroken life in the world, and anybody who arrived mid-save,
 * came out of the academy, or came back from retirement breaks that
 * assumption — which is how the record book ended up claiming a twelve-year-old
 * champion. The reign knows; ask the reign.
 */
export function ageWhenWon(reign: TitleReignRecord, holderId: Id): number | null {
  const index = reign.holderIds.indexOf(holderId);
  const age = index >= 0 ? reign.holderAges[index] : undefined;
  return age === undefined || age <= 0 ? null : age;
}

function top(
  people: readonly Wrestler[],
  value: (w: Wrestler) => number,
  limit: number,
  unit: RecordEntry['unit'],
  detail?: (w: Wrestler) => string | undefined,
): RecordEntry[] {
  return people
    .map((w) => ({ w, value: value(w) }))
    .filter(({ value: v }) => v > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
    .map(({ w, value: v }) => ({ wrestlerIds: [w.id], value: v, unit, detail: detail?.(w) }));
}

/** Total days somebody has spent carrying any championship. */
export function daysAsChampion(w: Wrestler, currentWeek: number): number {
  return w.titleReigns.reduce((sum, reign) => sum + reignDays(reign, currentWeek), 0);
}

/** Their single longest reign, in days. */
export function longestReign(w: Wrestler, currentWeek: number): number {
  return w.titleReigns.reduce((best, reign) => Math.max(best, reignDays(reign, currentWeek)), 0);
}

function winPercentage(w: Wrestler): number {
  const total = w.record.wins + w.record.losses + w.record.draws;
  return total === 0 ? 0 : (w.record.wins / total) * 100;
}

// ---------------------------------------------------------------- the book

/** Championship records — the ones people argue about. */
export function championshipRecords(ctx: RecordsContext, nameOfPromotion: (id: Id) => string): RecordSection[] {
  const people = everyone(ctx);

  return [
    {
      id: 'mostReigns',
      title: 'Most championships won',
      blurb: 'Every belt, every company, counted once per reign.',
      entries: top(people, (w) => w.titleReigns.length, ctx.limit, 'reigns', (w) => {
        const companies = new Set(w.titleReigns.map((r) => nameOfPromotion(r.promotionId)));
        return companies.size > 1 ? `across ${companies.size} companies` : [...companies][0];
      }),
    },
    {
      id: 'mostDays',
      title: 'Most days as champion',
      blurb: 'Time carrying something, added up across a career.',
      entries: top(people, (w) => daysAsChampion(w, ctx.currentWeek), ctx.limit, 'days'),
    },
    {
      id: 'longestReign',
      title: 'Longest single reign',
      blurb: 'One belt, one run, held longer than anybody else has managed.',
      entries: top(people, (w) => longestReign(w, ctx.currentWeek), ctx.limit, 'days', (w) => {
        const best = [...w.titleReigns].sort((a, b) => reignDays(b, ctx.currentWeek) - reignDays(a, ctx.currentWeek))[0];
        if (!best) return undefined;
        const title = ctx.titles.find((t) => t.id === best.titleId);
        return title?.name;
      }),
    },
  ];
}

/** Per-belt lineage records: the longest run with it, and who has held it most. */
export interface TitleRecord {
  titleId: Id;
  titleName: string;
  promotionId: Id;
  reigns: number;
  longest: { holderIds: Id[]; days: number } | null;
  shortest: { holderIds: Id[]; days: number } | null;
  mostReigns: { holderIds: Id[]; count: number } | null;
  currentHolderIds: Id[];
}

export function titleRecords(ctx: RecordsContext): TitleRecord[] {
  return ctx.titles
    .map((title) => {
      const history = title.history;
      const withDays = history.map((reign) => ({ reign, days: reignDays(reign, ctx.currentWeek) }));

      const longest = [...withDays].sort((a, b) => b.days - a.days)[0];
      // A reign that ended the same week it started is a real record and a
      // funny one, so completed reigns only — an ongoing one is not "short".
      const completed = withDays.filter(({ reign }) => reign.endWeek !== null);
      const shortest = [...completed].sort((a, b) => a.days - b.days)[0];

      const counts = new Map<string, { holderIds: Id[]; count: number }>();
      for (const reign of history) {
        const key = [...reign.holderIds].sort().join('~');
        const entry = counts.get(key) ?? { holderIds: reign.holderIds, count: 0 };
        entry.count += 1;
        counts.set(key, entry);
      }
      const mostReigns = [...counts.values()].sort((a, b) => b.count - a.count)[0];

      return {
        titleId: title.id,
        titleName: title.name,
        promotionId: title.promotionId,
        reigns: history.length,
        longest: longest ? { holderIds: longest.reign.holderIds, days: longest.days } : null,
        shortest: shortest ? { holderIds: shortest.reign.holderIds, days: shortest.days } : null,
        mostReigns: mostReigns ?? null,
        currentHolderIds: title.vacant ? [] : title.currentHolderIds,
      };
    })
    .sort((a, b) => b.reigns - a.reigns);
}

/** In-ring records, the good half and the bad half. */
export function ringRecords(ctx: RecordsContext): RecordSection[] {
  const people = everyone(ctx);

  return [
    {
      id: 'mostWins',
      title: 'Most wins',
      blurb: 'Hands raised, anywhere, ever.',
      entries: top(people, (w) => w.record.wins, ctx.limit, 'times', (w) => `${w.career.matches} matches`),
    },
    {
      id: 'mostLosses',
      title: 'Most losses',
      blurb: 'Somebody has to do the job, and these are the people who did it most.',
      entries: top(people, (w) => w.record.losses, ctx.limit, 'times', (w) => `${w.career.matches} matches`),
    },
    {
      id: 'bestStreak',
      title: 'Longest winning streak',
      blurb: 'Consecutive wins. A draw does not end one; a loss does.',
      entries: top(people, (w) => w.career.bestWinStreak, ctx.limit, 'matches'),
    },
    {
      id: 'worstStreak',
      title: 'Longest losing streak',
      blurb: 'The other side of the same coin.',
      entries: top(people, (w) => Math.abs(w.career.worstLosingStreak), ctx.limit, 'matches'),
    },
    {
      id: 'winPct',
      title: 'Best win percentage',
      blurb: 'Anybody with enough matches for the number to mean something.',
      entries: top(
        people.filter((w) => w.career.matches >= 20),
        winPercentage,
        ctx.limit,
        'times',
        (w) => `${w.record.wins}-${w.record.losses} in ${w.career.matches}`,
      ).map((entry) => ({ ...entry, value: Math.round(entry.value), unit: 'times' as const })),
    },
    {
      id: 'mostMatches',
      title: 'Most matches worked',
      blurb: 'Nobody gets this without staying healthy for a very long time.',
      entries: top(people, (w) => w.career.matches, ctx.limit, 'matches'),
    },
  ];
}

/** The oddities. Ages, injuries, and the best and worst nights anybody had. */
export function oddityRecords(ctx: RecordsContext, nameOfTitle: (id: Id) => string | undefined): RecordSection[] {
  const people = everyone(ctx);

  // Age at the moment a belt was won, as recorded on the day.
  const titleWins = people.flatMap((w) =>
    w.titleReigns
      .map((reign) => ({ w, reign, age: ageWhenWon(reign, w.id) }))
      .filter((entry): entry is { w: Wrestler; reign: TitleReignRecord; age: number } => entry.age !== null),
  );

  const byAge = [...titleWins].sort((a, b) => b.age - a.age);
  const oldestChampions = byAge.slice(0, ctx.limit);
  const youngestChampions = [...titleWins].sort((a, b) => a.age - b.age).slice(0, ctx.limit);

  const asChampionEntry = (entry: (typeof titleWins)[number]): RecordEntry => ({
    wrestlerIds: [entry.w.id],
    value: entry.age,
    unit: 'years',
    detail: nameOfTitle(entry.reign.titleId),
    week: entry.reign.startWeek,
  });

  return [
    {
      id: 'oldestChampion',
      title: 'Oldest champion',
      blurb: 'How old they were the day they won it.',
      entries: oldestChampions.map(asChampionEntry),
    },
    {
      id: 'youngestChampion',
      title: 'Youngest champion',
      blurb: 'Same question, other end.',
      entries: youngestChampions.map(asChampionEntry),
    },
    {
      id: 'oldestInAMatch',
      title: 'Oldest wrestler in a match',
      blurb: 'Still lacing them up when everybody else had stopped.',
      entries: top(people, (w) => w.career.oldestMatchAge ?? 0, ctx.limit, 'years'),
    },
    {
      id: 'youngestInAMatch',
      title: 'Youngest wrestler in a match',
      blurb: 'Straight out of the school and onto the card.',
      entries: people
        .filter((w) => w.career.youngestMatchAge !== null)
        .sort((a, b) => (a.career.youngestMatchAge ?? 99) - (b.career.youngestMatchAge ?? 99))
        .slice(0, ctx.limit)
        .map((w) => ({ wrestlerIds: [w.id], value: w.career.youngestMatchAge!, unit: 'years' as const })),
    },
    {
      id: 'longestInjury',
      title: 'Longest spell on the shelf',
      blurb: 'The worst single injury anybody has come back from.',
      entries: top(people, (w) => w.career.longestInjuryWeeks, ctx.limit, 'weeks'),
    },
    {
      id: 'bestMatch',
      title: 'Best match anybody has had',
      blurb: 'The highest-rated match on anybody’s record.',
      entries: top(people, (w) => w.career.bestMatchRating ?? 0, ctx.limit, 'stars').map((entry) => ({
        ...entry,
        value: Math.round((entry.value / 20) * 4) / 4,
      })),
    },
    {
      id: 'worstMatch',
      title: 'Worst match anybody has had',
      blurb: 'Everybody has one. These are the ones nobody lived down.',
      entries: people
        .filter((w) => w.career.worstMatchRating !== null && w.career.matches > 0)
        .sort((a, b) => (a.career.worstMatchRating ?? 100) - (b.career.worstMatchRating ?? 100))
        .slice(0, ctx.limit)
        .map((w) => ({
          wrestlerIds: [w.id],
          value: Math.round((w.career.worstMatchRating! / 20) * 4) / 4,
          unit: 'stars' as const,
        })),
    },
  ];
}

/** Longevity: the careers that simply would not end. */
export function careerRecords(ctx: RecordsContext, currentYear: number): RecordSection[] {
  const people = everyone(ctx);

  return [
    {
      id: 'longestCareer',
      title: 'Longest career',
      blurb: 'Years between the debut and now, or between the debut and the end.',
      entries: top(people, (w) => Math.max(0, currentYear - w.debutYear), ctx.limit, 'years', (w) =>
        w.deceased ? 'posthumous' : w.careerStatus === 'retired' ? 'retired' : undefined,
      ),
    },
    {
      id: 'highestPeak',
      title: 'Biggest draw there has ever been',
      blurb: 'Career-high popularity, whether or not they still have it.',
      entries: top(people, (w) => Math.round(w.careerHighPopularity), ctx.limit, 'times', (w) =>
        Math.round(w.popularity) < Math.round(w.careerHighPopularity) ? 'past it now' : 'still there',
      ),
    },
  ];
}
