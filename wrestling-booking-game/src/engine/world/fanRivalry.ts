// A heel woman mocks and slaps somebody in the front row, proud of it — and
// the fan fights back. See docs/BACKLOG.md for the full story. The short
// version: a rare incident during a resolved match can start this rather
// than the usual crowd/wire flavor, and once it does, the next two weeks are
// locked in, no booker choice, the same way engine/world/factionDestroyer.ts
// locks in its own countdown payoff:
//
//   week N   — the incident itself (store.ts's trigger hook, next to the
//              ordinary rollIncident call). A Rivalry and Storyline start
//              here; this module only decides eligibility and builds the
//              fan.
//   week N+1 — the wrestler is forced into a 'challenge' promo aimed at the
//              fan (buildFanCalloutPromo).
//   week N+2 — the two of them fight for real, unsanctioned
//              (buildFanRivalryMatchSegment) — the sim decides who wins, not
//              this story.
//
// Both scheduled weeks are fixed at trigger time rather than counted down,
// unlike Faction Destroyer's countdown: there's no "does a qualifying week
// happen" question here, just two fixed follow-up beats.
//
// What makes the fan's stats good is entirely engine/world/walkOns.ts's
// existing 'gem' path — nothing new is rolled for that here.

import type { Id, Wrestler, WorldSettings, Segment, MatchRules, DeckStacking } from '../types';
import type { Rng } from '../rng';
import { generateWrestler } from '../generate/wrestler';
import { asWalkOn } from './walkOns';
import { DEFAULT_PACE } from '../../data/pacing';

export interface FanRivalryStory {
  wrestlerId: Id;
  wrestlerName: string;
  fanId: Id;
  fanName: string;
  rivalryId: Id;
  triggeredWeek: number;
  /** Fixed at trigger time: triggeredWeek + 1. */
  calloutWeek: number;
  /** Fixed at trigger time: triggeredWeek + 2. */
  matchWeek: number;
  /** Guards against forcing the promo twice if card-build ever runs again for the same week. */
  calloutDone: boolean;
}

/**
 * Same heel test data/incidents.ts's winnersAreHeels already uses — a plain
 * wrestler (not a manager, not a referee), a woman, playing heel. No new
 * threshold invented for this.
 */
export function canTriggerFanIncident(wrestler: Wrestler): boolean {
  return wrestler.role === 'wrestler' && wrestler.gender === 'f' && wrestler.alignment < 0;
}

/**
 * Somebody who was sitting in the crowd five minutes ago. Reuses
 * walkOns.ts's 'gem' path wholesale — untrained, but the whole business can
 * see it. Nothing about her stats is rolled here.
 */
export function generateRingsideFan(
  rng: Rng,
  currentYear: number,
  settings: WorldSettings,
  existingNames: Set<string>,
): Wrestler {
  const person = generateWrestler(rng, existingNames, { gender: 'f', currentYear });
  return asWalkOn(rng, person, 'gem', currentYear, settings);
}

export function beginFanRivalryStory(
  wrestler: Wrestler,
  fan: Wrestler,
  rivalryId: Id,
  week: number,
): FanRivalryStory {
  return {
    wrestlerId: wrestler.id,
    wrestlerName: wrestler.name,
    fanId: fan.id,
    fanName: fan.name,
    rivalryId,
    triggeredWeek: week,
    calloutWeek: week + 1,
    matchWeek: week + 2,
    calloutDone: false,
  };
}

/** Week N+1's forced promo slot — the wrestler calling the fan out, no twist system to derail it. */
export function buildFanCalloutPromo(
  slot: number,
  wrestlerId: Id,
  fanId: Id,
): Pick<Segment, 'slot' | 'kind' | 'promoTopicId' | 'promoSpeakerId' | 'promoTargetId' | 'promoMouthpieceId' | 'promoResult' | 'systemForced'> {
  return {
    slot,
    kind: 'promo',
    promoTopicId: 'challenge',
    promoSpeakerId: wrestlerId,
    promoTargetId: fanId,
    promoMouthpieceId: null,
    promoResult: null,
    systemForced: 'fanRivalry',
  };
}

/** Week N+2's forced payoff — a real 1v1, unsanctioned, no booker choice in it. */
export function buildFanRivalryMatchSegment(
  slot: number,
  wrestlerId: Id,
  fanId: Id,
): Pick<Segment, 'slot' | 'kind' | 'participants' | 'rules' | 'stipulation' | 'titleIds' | 'deckStacking' | 'result' | 'systemForced'> {
  return {
    slot,
    kind: 'match',
    participants: [
      { wrestlerId, side: 0, role: 'competitor' as const },
      { wrestlerId: fanId, side: 1, role: 'competitor' as const },
    ],
    rules: {
      preset: 'singles',
      format: 'individuals',
      ruleStrictness: 'none',
      aim: 'firstFall',
      falls: 'anyMeans',
      timeLimit: 15,
      stoppage: 'referee',
      countOuts: 'none',
      reward: 'stipulation',
      pace: DEFAULT_PACE,
    } satisfies MatchRules,
    stipulation: 'unsanctioned',
    titleIds: [],
    deckStacking: {
      favoredSideIndex: null,
      assignedReferee: null,
      ringsideManagers: [],
      plannedRunIn: null,
      lumberjacks: [],
      preMatchAngle: 'none',
      instructions: 'callItInTheRing',
    } satisfies DeckStacking,
    result: null,
    systemForced: 'fanRivalry',
  };
}
