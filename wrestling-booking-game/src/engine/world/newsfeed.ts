// The lede.
//
// A results screen that opens with attendance and the gate is an accounting
// report. What a reader wants first is what happened: a belt changed hands,
// somebody turned, the main event was the best thing all year. The rest of
// the page already has every match, every highlight, and what the fans made
// of it — this is the two or three lines at the top that say which of those
// mattered.
//
// Ordered by what a wrestling newsletter would actually lead with, not by
// where it fell on the card: a title change in the opener beats a good main
// event, and something nobody booked beats both.

export type NewsKind = 'titleChange' | 'incident' | 'match' | 'verdict';

export interface NewsItem {
  kind: NewsKind;
  text: string;
}

export interface NewsContext {
  /** Belts that moved tonight, with who has them now. */
  titleChanges: { titleName: string; championNames: string[] }[];
  /** Headlines from anything that was not on the card. */
  incidents: string[];
  /** The best match of the night, if there was a show at all. */
  bestMatch: { winnerNames: string[]; loserNames: string[]; stars: number } | null;
  showRating: number;
  showStars: number;
  settings: { newsLedeLength: number; newsGreatShowRating: number; newsPoorShowRating: number };
}

function list(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? 'nobody';
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

/** One line on how the night went overall. Always available as a fallback. */
export function verdictLine(ctx: NewsContext): string {
  if (ctx.showRating >= ctx.settings.newsGreatShowRating) {
    return `A ${ctx.showStars}-star night. People will be talking about this one.`;
  }
  if (ctx.showRating <= ctx.settings.newsPoorShowRating) {
    return `A ${ctx.showStars}-star night, and that is being generous.`;
  }
  return `A ${ctx.showStars}-star night.`;
}

/**
 * What the night led with. At most `newsLedeLength` items, most important
 * first, and never empty — a show where nothing happened still gets a line
 * saying so, because a blank lede reads as a bug rather than as a quiet week.
 */
export function showLede(ctx: NewsContext): NewsItem[] {
  const items: NewsItem[] = [];

  for (const change of ctx.titleChanges) {
    items.push({
      kind: 'titleChange',
      text: `NEW CHAMPION — ${list(change.championNames)} took the ${change.titleName}.`,
    });
  }

  for (const headline of ctx.incidents) {
    items.push({ kind: 'incident', text: headline });
  }

  // A genuinely great match leads only when nothing bigger happened, but it
  // is always worth a line when it was the best thing on the show.
  if (ctx.bestMatch && ctx.bestMatch.stars >= 4) {
    items.push({
      kind: 'match',
      text: `${list(ctx.bestMatch.winnerNames)} over ${list(ctx.bestMatch.loserNames)} — ${ctx.bestMatch.stars} stars, and the match of the night.`,
    });
  }

  if (items.length === 0) items.push({ kind: 'verdict', text: verdictLine(ctx) });

  return items.slice(0, ctx.settings.newsLedeLength);
}
