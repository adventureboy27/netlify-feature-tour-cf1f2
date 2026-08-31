// The ring gives out — a real, foreseeable risk once it's been pushed past
// its lifespan, resolved the same shape as a severe-weather call: a
// warning, a real decision, an outcome that stays genuinely uncertain
// either way.
//
// Pure: builds the decision from how worn the ring actually is, and
// resolves whatever the promoter picked into consequences the store
// applies. Nothing here touches the world.

import type { Rng } from '../rng';
import { chance, pick } from '../rng';
import type { Id, WorldSettings } from '../types';

export type RingCallOptionId = 'playItSafe' | 'goNuclear';
export type RingCallStrength = 'likely' | 'even';

export interface RingCall {
  week: number;
  territoryId: Id;
  territoryName: string;
  warning: string;
  strength: RingCallStrength;
  /** Rolled up front and carried — answering the call must not change whether it was ever going to give out. */
  willFail: boolean;
}

const WARNING_LINES = [
  'The ring crew flagged it again this week — {town} is the same ring that has been complaining since spring, and nobody has gotten around to replacing it.',
  'One more night on that ring in {town}, the crew says, and they will not promise it holds.',
  'The boards in {town} have been groaning under every show for a month now. Somebody was always going to have to make a call on it.',
];

/** Build the decision from how worn the ring is. Returns null when it's in good enough shape not to raise it. */
export function ringCallFrom(
  rng: Rng,
  week: number,
  territoryId: Id,
  territoryName: string,
  ringCondition: number,
  settings: WorldSettings,
): RingCall | null {
  if (ringCondition >= settings.ringCallConditionFloor) return null;

  const strength: RingCallStrength = chance(rng, settings.ringCallLikelyShare) ? 'likely' : 'even';
  const failChance = strength === 'likely' ? settings.ringCallLikelyFailChance : settings.ringCallEvenFailChance;

  return {
    week,
    territoryId,
    territoryName,
    warning: pick(rng, WARNING_LINES).replace(/\{town\}/g, territoryName),
    strength,
    willFail: chance(rng, failChance),
  };
}

export const RING_CALL_OPTIONS: {
  id: RingCallOptionId;
  label: string;
  gains: string;
  costs: string;
}[] = [
  {
    id: 'playItSafe',
    label: 'Play it safe',
    gains: 'Nobody works on a ring that might fail under them',
    costs: 'No contest, refunded — real morale and merch losses for a night that never happened',
  },
  {
    id: 'goNuclear',
    label: 'Go nuclear',
    gains: 'The show runs, and a bare-floor night can genuinely pop the house',
    costs: 'Real, elevated injury risk for whoever is still out there, and the crowd could just as easily turn on it',
  },
];

export interface RingCallOutcome {
  /** Did the show run as a real card, or get called as a no-contest? */
  ran: boolean;
  /** Share of committed costs still owed when it's called off. */
  costShare: number;
  moraleDelta: number;
  /** Multiplies merch revenue on the "play it safe" path. 1 means unaffected. */
  merchShare: number;
  /** Extra danger on the "go nuclear" path — feeds into the same casualty roll skill-injury reads. */
  injuryMultiplier: number;
  /** Positive or negative — this is a real gamble, never a guaranteed pop. */
  ratingSwing: number;
  line: string;
}

/**
 * What the call cost.
 *
 * Playing it safe is a known, moderate cost — refunded, no contest, real
 * but ordinary morale and merch losses. Going nuclear is a real swing
 * either way: worse danger for whoever's still out there, and a rating
 * that can land big or flop, decided honestly rather than guaranteed to
 * reward the gamble.
 */
export function resolveRingCall(
  call: RingCall,
  choice: RingCallOptionId,
  rng: Rng,
  settings: WorldSettings,
): RingCallOutcome {
  const town = call.territoryName;

  if (choice === 'playItSafe') {
    return {
      ran: false,
      costShare: 1,
      moraleDelta: settings.ringCallSafeMoraleDelta,
      merchShare: settings.ringCallSafeMerchShare,
      injuryMultiplier: 1,
      ratingSwing: 0,
      line: `The ring in ${town} never got fixed in time, and the office wasn't willing to risk it. No contest, refunds all around — the safe call, and an expensive one.`,
    };
  }

  const swing = (chance(rng, 0.5) ? 1 : -1) * settings.ringCallNuclearRatingSwing;
  return {
    ran: true,
    costShare: 0,
    moraleDelta: 0,
    merchShare: 1,
    injuryMultiplier: settings.ringCallNuclearInjuryMultiplier,
    ratingSwing: swing,
    line:
      swing >= 0
        ? `The ring in ${town} gave out and the show went on anyway — bare cement, real danger, and this building has never been louder for it.`
        : `The ring in ${town} gave out and the office pushed through it regardless. It read exactly like what it was: a promotion working scared on a broken floor.`,
  };
}
