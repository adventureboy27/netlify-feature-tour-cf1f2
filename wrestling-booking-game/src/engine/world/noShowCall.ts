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
import { pick } from '../rng';
import type { Id, Wrestler, WorldSettings } from '../types';
import { MISFORTUNES } from '../../data/misfortunes';
import { pickReplacement } from './misfortune';

const NO_SHOW_LINES = MISFORTUNES.filter((m) => m.kind === 'absence').flatMap((m) => m.lines);

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

export function resolveNoShowCall(call: NoShowCall, choice: NoShowChoiceId, settings: WorldSettings): NoShowOutcome {
  if (choice === 'pullSegment') {
    return {
      replacementId: null,
      pullSegment: true,
      following: settings.calledOffWronglyFollowing,
      extraCost: 0,
      line: `${call.absentName} never made the building. Rather than throw a match together, the office pulled it from the card.`,
    };
  }

  if (choice === 'handicapMatch' || !call.suggestedReplacementId) {
    return {
      replacementId: null,
      pullSegment: false,
      following: settings.movedShowFollowing,
      extraCost: settings.movedShowScrambleCost,
      line: `${call.absentName} never made the building. Rather than scratch the whole match, the office sent the other side out alone against the field.`,
    };
  }

  return {
    replacementId: call.suggestedReplacementId,
    pullSegment: false,
    following: settings.ranThroughItFollowing,
    extraCost: settings.movedShowScrambleCost,
    line: `${call.absentName} never made the building. ${call.suggestedReplacementName} got the call an hour before bell time and the crowd had no idea what they were about to see.`,
  };
}
