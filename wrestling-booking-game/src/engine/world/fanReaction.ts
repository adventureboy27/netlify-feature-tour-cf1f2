// The fans, afterwards.
//
// A show rating tells the player a number. This tells them what the number
// felt like — and those are genuinely different: a 62 carried by a great main
// event reads nothing like a 62 where the main event died and the openers
// saved it.
//
// The mix is the whole design. Tone follows the show, but never unanimously:
// a great night still has somebody calling it overrated, and a disaster still
// has one person defending it. A feed where everybody agrees reads as
// manufactured, which is exactly what it must not read as.
//
// Some of them want things — a rematch, a title change, somebody turned —
// because a feed that only reacts is flat, and one that asks for something
// puts an idea in the booker's head for next week.

import type { Rng } from '../rng';
import { pick, chance } from '../rng';
import type { WorldSettings } from '../types';
import {
  FAN_HANDLES,
  SHOW_TWEETS,
  MATCH_TWEETS,
  TITLE_CHANGE_TWEETS,
  CROWD_VERDICTS,
  type TweetTemplate,
  type TweetTone,
} from '../../data/fanVoices';

export interface Tweet {
  handle: string;
  text: string;
  tone: TweetTone;
  /** Rough engagement, so the feed can look like a feed. */
  likes: number;
}

export interface FanReactionContext {
  showRating: number;
  promotionName: string;
  /** Best and worst match of the night, by rating. */
  bestMatch?: { rating: number; winnerName: string; loserName: string } | null;
  worstMatch?: { rating: number; winnerName: string; loserName: string } | null;
  /** Belts that changed hands tonight. */
  titleChanges?: { titleName: string; championName: string }[];
  settings: WorldSettings;
}

/** One line summarising where the room landed. */
export function crowdVerdict(showRating: number): string {
  return CROWD_VERDICTS.find((entry) => showRating >= entry.minRating)?.verdict ?? CROWD_VERDICTS[0]!.verdict;
}

/** Templates whose rating window includes this show. */
function usable(templates: readonly TweetTemplate[], rating: number): TweetTemplate[] {
  return templates.filter(
    (t) => (t.minRating === undefined || rating >= t.minRating) && (t.maxRating === undefined || rating <= t.maxRating),
  );
}

/**
 * How much of the feed should be positive. Follows the show closely but never
 * reaches either extreme — see the note at the top about unanimity.
 */
export function approvalShare(showRating: number, settings: WorldSettings): number {
  const raw = showRating / 100;
  const floor = settings.fanDissentFloor;
  return Math.min(1 - floor, Math.max(floor, raw));
}

export function generateFanReaction(rng: Rng, ctx: FanReactionContext): Tweet[] {
  const count = ctx.settings.fanTweetsPerShow;
  const approval = approvalShare(ctx.showRating, ctx.settings);
  const handles = [...FAN_HANDLES];
  const tweets: Tweet[] = [];
  const usedText = new Set<string>();

  const fill = (text: string): string =>
    text
      .replace(/\{promotion\}/g, ctx.promotionName)
      .replace(/\{winner\}/g, ctx.bestMatch?.winnerName ?? 'the winner')
      .replace(/\{loser\}/g, ctx.bestMatch?.loserName ?? 'the loser')
      .replace(/\{best\}/g, ctx.bestMatch?.winnerName ?? 'the main eventer')
      .replace(/\{worst\}/g, ctx.worstMatch?.loserName ?? ctx.worstMatch?.winnerName ?? 'half this roster');

  const take = (templates: readonly TweetTemplate[], filter?: (t: TweetTemplate) => boolean): boolean => {
    const options = usable(templates, ctx.showRating)
      .filter((t) => !usedText.has(t.text))
      .filter((t) => !filter || filter(t));
    if (options.length === 0 || handles.length === 0) return false;

    const template = pick(rng, options);
    usedText.add(template.text);
    const handleIndex = Math.floor(rng.next() * handles.length);
    const handle = handles.splice(handleIndex, 1)[0]!;

    tweets.push({
      handle,
      text: fill(template.text),
      tone: template.tone,
      // A contrarian take gets less engagement than the popular one, which is
      // its own small piece of characterisation.
      likes: Math.round(
        (template.tone === 'contrarian' ? 0.25 : 1) * (1 + rng.next() * ctx.settings.fanTweetLikesScale),
      ),
    });
    return true;
  };

  // A belt changing hands is the story, so it leads.
  for (const change of ctx.titleChanges ?? []) {
    if (tweets.length >= count) break;
    const options = TITLE_CHANGE_TWEETS.filter((t) => !usedText.has(t.text));
    if (options.length === 0) continue;
    const template = pick(rng, options);
    usedText.add(template.text);
    const handle = handles.splice(Math.floor(rng.next() * handles.length), 1)[0] ?? 'wrestlingfan';
    tweets.push({
      handle,
      text: template.text.replace(/\{champ\}/g, change.championName).replace(/\{title\}/g, change.titleName),
      tone: template.tone,
      likes: Math.round(1 + rng.next() * ctx.settings.fanTweetLikesScale * 1.5),
    });
  }

  // Then the body of the feed, weighted by how the night went.
  while (tweets.length < count) {
    const wantsPraise = chance(rng, approval);
    const aboutAMatch = chance(rng, ctx.settings.fanMatchTweetShare) && (ctx.bestMatch || ctx.worstMatch);

    const pool = aboutAMatch ? MATCH_TWEETS : SHOW_TWEETS;
    const wanted: TweetTone[] = wantsPraise ? ['praise', 'demand', 'joke'] : ['criticism', 'joke', 'demand'];

    // Try for the tone the night calls for, then anything at all rather than
    // leaving the feed short.
    const placed =
      take(pool, (t) => wanted.includes(t.tone)) ||
      take(pool) ||
      take(aboutAMatch ? SHOW_TWEETS : MATCH_TWEETS);
    if (!placed) break;
  }

  // And somebody who disagrees with all of them — unless one already slipped
  // into the feed on its own.
  const hasDissent = tweets.some((t) => t.tone === 'contrarian');
  if (!hasDissent && tweets.length > 0 && handles.length > 0) {
    take(SHOW_TWEETS, (t) => t.tone === 'contrarian') || take(MATCH_TWEETS, (t) => t.tone === 'contrarian');
  }

  return tweets;
}


