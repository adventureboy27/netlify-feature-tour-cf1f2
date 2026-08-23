// The mystery opponent, promoted from a silent swap to a real decision.
//
// misfortune.ts already rolls ordinary, low-stakes absences every week and
// quietly slots a replacement in — that stays exactly as it is. This is the
// rarer, business-wide cousin: the catastrophe system (catastrophe.ts) can
// decide tonight is the night somebody simply never turns up, and when it
// lands on the player, that is a real decision instead of a line in the
// newsfeed — build a mystery match around it, make it a handicap, or pull
// the segment outright. Same shape as weatherCall.ts: roll once, carry it,
// resolve into consequences the store applies.

import type { Rng } from '../rng';
import { pick, rngFromSeed } from '../rng';
import type { Id, Wrestler, WorldSettings } from '../types';
import { MISFORTUNES } from '../../data/misfortunes';
import { pickReplacement } from './misfortune';

const NO_SHOW_LINES = MISFORTUNES.filter((m) => m.kind === 'absence').flatMap((m) => m.lines);

/**
 * How each choice gets written up. Several lines apiece rather than one
 * fixed sentence per choice — this event is rare enough in a single save
 * (a couple of times a year, business-wide) that a hand-tuned draw could
 * plausibly get away with one line, but a long save sees it many times
 * over, and every single one would read identically.
 */
const PULL_SEGMENT_LINES = [
  '{name} never made the building. Rather than throw a match together, the office pulled it from the card.',
  'No sign of {name} by bell time. Rather than force it, the segment came off the card entirely.',
  '{name} was a no-show and there was nothing worth building around it. The spot just disappeared from the card.',
  'The office waited as long as it could for {name}. When nothing came, the segment went with it.',
];

const HANDICAP_LINES = [
  '{name} never made the building. Rather than scratch the whole match, the office sent the other side out alone against the field.',
  'With no sign of {name}, the match went on anyway — the other side against the field, uneven and worse for it.',
  '{name} was a no-show, so the segment ran anyway, minus the one name it needed.',
  'The office chose not to scratch the whole thing over {name}. The other side worked it alone instead.',
];

const MYSTERY_OPPONENT_LINES = [
  '{name} never made the building. {replacement} got the call an hour before bell time and the crowd had no idea what they were about to see.',
  'No sign of {name} all night. {replacement} was pulled off catering duty and thrown into the spot instead.',
  '{name} was a no-show, and {replacement} found out they were wrestling tonight about the same time the crowd did.',
  'With {name} nowhere to be found, {replacement} got the surprise call — and gave the building one right back.',
];

export interface NoShowCall {
  week: number;
  promotionId: Id;
  absentId: Id;
  absentName: string;
  /** The excuse, in the newsfeed's own voice — the ordinary absence pool. */
  warning: string;
  /** Rolled up front so the booker's choice can't reach backward into who was ever available. */
  suggestedReplacementId: Id | null;
  suggestedReplacementName: string | null;
}

/** Build the decision. `candidates` is everyone on the promotion's roster not already on the card tonight. */
export function noShowCallFrom(
  rng: Rng,
  week: number,
  promotionId: Id,
  absent: Wrestler,
  candidates: readonly Wrestler[],
  settings: WorldSettings,
): NoShowCall {
  const replacement = pickReplacement(rng, absent, candidates, settings);
  return {
    week,
    promotionId,
    absentId: absent.id,
    absentName: absent.name,
    warning: pick(rng, NO_SHOW_LINES).replace(/\{name\}/g, absent.name),
    suggestedReplacementId: replacement?.id ?? null,
    suggestedReplacementName: replacement?.name ?? null,
  };
}

export type NoShowChoiceId = 'mysteryOpponent' | 'handicapMatch' | 'pullSegment';

export interface NoShowChoiceOption {
  id: NoShowChoiceId;
  label: string;
  gains: string;
  costs: string;
}

/** Only three choices, so kept as one small fixed set rather than a growing data/ bank like weather's. */
export const NO_SHOW_CALL_OPTIONS: NoShowChoiceOption[] = [
  {
    id: 'mysteryOpponent',
    label: 'Throw in a mystery opponent',
    gains: 'Nobody planned this match, and the surprise itself is a draw',
    costs: 'Whoever gets the call has no time to prepare for it either',
  },
  {
    id: 'handicapMatch',
    label: 'Send the other side out alone',
    gains: 'The segment stays on the card exactly as billed, minus the one name',
    costs: 'One side goes in against the field, and it shows',
  },
  {
    id: 'pullSegment',
    label: 'Pull it from the card',
    gains: 'No half-built match limping through the night',
    costs: 'A hole in the card with no time left to fill it',
  },
];

export interface NoShowOutcome {
  /** Which slot participant to swap the absent wrestler for, if any. */
  replacementId: Id | null;
  /** Drop the segment from the card entirely rather than replace anyone. */
  pullSegment: boolean;
  /** Move on the town's following — a mystery opponent draws, a cancelled segment doesn't. */
  following: number;
  extraCost: number;
  line: string;
}

/**
 * Seeded from the call itself rather than drawn from the shared stream —
 * this resolves mid-`resolveWeek`, after the booker has answered, and a
 * shared-stream draw here would shift every seeded roll after it (the
 * documented trap). Stable and replay-safe: the same call and choice
 * always writes up the same way.
 */
function outcomeRng(call: NoShowCall, choice: NoShowChoiceId): Rng {
  return rngFromSeed(`noShowOutcome:${call.absentId}:${call.week}:${choice}`);
}

export function resolveNoShowCall(call: NoShowCall, choice: NoShowChoiceId, settings: WorldSettings): NoShowOutcome {
  if (choice === 'pullSegment') {
    return {
      replacementId: null,
      pullSegment: true,
      following: settings.calledOffWronglyFollowing,
      extraCost: 0,
      line: pick(outcomeRng(call, choice), PULL_SEGMENT_LINES).replace(/\{name\}/g, call.absentName),
    };
  }

  if (choice === 'handicapMatch' || !call.suggestedReplacementId) {
    return {
      replacementId: null,
      pullSegment: false,
      following: settings.movedShowFollowing,
      extraCost: settings.movedShowScrambleCost,
      line: pick(outcomeRng(call, choice), HANDICAP_LINES).replace(/\{name\}/g, call.absentName),
    };
  }

  return {
    replacementId: call.suggestedReplacementId,
    pullSegment: false,
    following: settings.ranThroughItFollowing,
    extraCost: settings.movedShowScrambleCost,
    line: pick(outcomeRng(call, choice), MYSTERY_OPPONENT_LINES)
      .replace(/\{name\}/g, call.absentName)
      .replace(/\{replacement\}/g, call.suggestedReplacementName ?? 'somebody'),
  };
}
