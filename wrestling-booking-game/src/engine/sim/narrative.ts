// Highlight-reel narrative — booking-game-design.md §11.5.
// "The player never watches a match... what they get is a highlight reel."
//
// DESIGN: §11.5 calls for archetype-keyed beat templates (a Powerhouse's
// control segment reads differently from a High Flyer's) — a real content
// project on the scale of the name/gimmick lists in data/. This is a small
// functional seed (one flow line, an optional near-fall for good matches,
// a finish line keyed by FinishType) that already satisfies the
// non-negotiable — the player gets a highlight, not a transcript — and
// gives the template system somewhere to plug in later without changing
// the MatchBeat shape callers depend on.

import type { Rng } from '../rng';
import { pick } from '../rng';
import type { Wrestler, MatchBeat, FinishType } from '../types';

const FLOW_LINES = [
  'A cautious feeling-out process to start.',
  'They came out swinging from the opening bell.',
  'A slow, methodical, mat-based build.',
  'A back-and-forth affair that never let up.',
  'A grinding, physical contest from the first lock-up.',
];

const NEAR_FALL_LINES = ['{loser} kicked out at two, and the crowd came unglued.', 'A near-fall had the building on its feet.', 'A shocking reversal nearly ended it early.'];

const FINISH_LINES: Record<FinishType, (winner: string, loser: string) => string> = {
  cleanPin: (w, l) => `${w} hit the finish clean and got the three count on ${l}.`,
  submission: (w, l) => `${w} locked in the finisher, and ${l} had no choice but to tap.`,
  knockout: (w, l) => `${w} knocked ${l} out cold for the finish.`,
  rollup: (w, l) => `${l} nearly had it, but ${w} reversed a rollup for the shock win.`,
  interference: (w, _l) => `Interference turned the tide, and ${w} capitalized on the chaos.`,
  disqualification: (w, l) => `The match broke down and ${w} won by disqualification over ${l}.`,
  countOut: (w, l) => `${l} couldn't beat the count, and ${w} won by count-out.`,
  timeLimitDraw: (w, l) => `The bell rang with both ${w} and ${l} still standing — a time-limit draw.`,
  doubleKO: (w, l) => `${w} and ${l} went down together. No winner tonight.`,
  refereeStoppage: (w, l) => `The referee waved it off — ${w} wins by stoppage over ${l}.`,
};

export interface NarrativeContext {
  winnerMembers: Wrestler[];
  loserMembers: Wrestler[];
  finish: FinishType;
  stars: number;
}

export function generateBeats(rng: Rng, ctx: NarrativeContext): MatchBeat[] {
  const winnerName = ctx.winnerMembers[0]?.name ?? 'The winner';
  const loserName = ctx.loserMembers[0]?.name ?? 'their opponent';

  const beats: MatchBeat[] = [
    { kind: 'openingExchange', text: pick(rng, FLOW_LINES), significant: true },
  ];

  if (ctx.stars >= 3) {
    beats.push({ kind: 'nearFall', text: pick(rng, NEAR_FALL_LINES).replace('{loser}', loserName), significant: true });
  }

  const finishLine = FINISH_LINES[ctx.finish](winnerName, loserName);
  beats.push({ kind: 'finish', text: finishLine, significant: true });

  return beats;
}
