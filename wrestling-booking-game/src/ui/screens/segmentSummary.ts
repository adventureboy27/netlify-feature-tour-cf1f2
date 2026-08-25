// One match's worth of derived read-outs, shared by the card-overview row
// (BookingScreen) and the match's own screen (MatchSetupScreen). They have
// to agree — the odds, the stakes label, and who is counting cannot say one
// thing on the card and another thing once you tap in, so both screens call
// this instead of each recomputing it their own way.

import { stipulationById, stipulationRequirementsMet, effectiveRules } from '../../data/stipulations';
import { familyById as propFamilyById, type MatchPropFamily } from '../../data/matchProps';
import { usableUnitsForFamily, type OwnedPropUnit } from '../../engine/economy/matchProps';
import { officialFor, sharpnessLabel } from '../../engine/sim/referees';
import { findRivalry } from '../../engine/sim/rivalry';
import { ruleAdjustedWeights, kayfabeScore } from '../../engine/sim/kayfabe';
import { pairWinProbability } from '../../engine/sim/winProbability';
import { eligibleTitles, titleStakesLabel } from '../../engine/sim/titleMatch';
import type { Id, Referee, Rivalry, Segment, Stipulation, Title, Wrestler } from '../../engine/types';
import type { World } from '../../state/world';

/**
 * How worn an official is, as a colour. The player is managing a crew across
 * a card, and the whole decision is legible at a glance or it is not a
 * decision at all. Shared by the "official for the night" panel and every
 * per-match referee picker, so a referee reads the same everywhere they show up.
 */
export function refereeSharpnessTone(referee: Referee): string {
  const label = sharpnessLabel(referee);
  if (label === 'Fresh' || label === 'Sharp') return 'text-emerald-400';
  if (label === 'Working hard') return 'text-neutral-400';
  if (label === 'Fading') return 'text-amber-400';
  return 'text-rose-400';
}

/** Preview odds using the same path the sim will take, so the words don't lie. */
export function previewOdds(segment: Segment, wrestlers: Wrestler[]): number | null {
  const sides = [...new Set(segment.participants.map((p) => p.side))];
  if (sides.length !== 2 || wrestlers.length < 2) return null;

  const stipulation = segment.stipulation ? (stipulationById(segment.stipulation) ?? null) : null;
  const rules = effectiveRules(segment.rules, stipulation);
  const weights = ruleAdjustedWeights(rules, stipulation?.id === 'ladder', false);

  const scoreFor = (side: number) => {
    const members = segment.participants
      .filter((p) => p.side === side)
      .map((p) => wrestlers.find((w) => w.id === p.wrestlerId))
      .filter((w): w is Wrestler => Boolean(w));
    if (members.length === 0) return null;
    return members.reduce((sum, w) => sum + kayfabeScore(w, weights), 0) / members.length;
  };

  const a = scoreFor(sides[0]!);
  const b = scoreFor(sides[1]!);
  if (a === null || b === null) return null;
  return pairWinProbability(a, b, 0, 0.08, 0.92);
}

export interface SegmentSummary {
  participants: { wrestlerId: Id; side: number; wrestler: Wrestler }[];
  sides: number[];
  rivalry: Rivalry | undefined;
  stipulation: Stipulation | null;
  odds: number | null;
  bookable: Title[];
  onTheLine: Title[];
  championInMatch: boolean;
  stakes: string | null;
  assigned: Referee | null;
  guest: Wrestler | null;
  officialLabel: string;
  gearFamily: MatchPropFamily | null;
  usableGearUnits: OwnedPropUnit[];
  requirementsMet: boolean;
}

/** Everything the card-overview row and MatchSetupScreen both need to say about one segment. */
export function summarizeSegment(segment: Segment, roster: Wrestler[], world: World): SegmentSummary {
  const participants = segment.participants
    .map((p) => ({ wrestlerId: p.wrestlerId, side: p.side, wrestler: world.wrestlers[p.wrestlerId] }))
    .filter((p): p is { wrestlerId: Id; side: number; wrestler: Wrestler } => Boolean(p.wrestler));
  const sides = [...new Set(segment.participants.map((p) => p.side))].sort();
  const rivalry = findRivalry(world.rivalries, participants.map((p) => p.wrestler.id));
  const stipulation = segment.stipulation ? (stipulationById(segment.stipulation) ?? null) : null;
  const odds = previewOdds(segment, roster);

  const bookable = eligibleTitles(world.titles, {
    stipulationId: segment.stipulation,
    participants: participants.map((p) => ({ wrestler: p.wrestler, side: p.side })),
    promotionId: world.promotion.id,
  });
  const onTheLine = segment.titleIds
    .map((id) => world.titles.find((t) => t.id === id))
    .filter((t): t is Title => Boolean(t));
  const championInMatch = bookable.some((t) => !t.vacant);
  const stakes = titleStakesLabel(onTheLine, championInMatch);

  const assigned = officialFor(segment.refereeId, world.defaultRefereeId, world.referees, world.promotion.id);
  const guest = segment.guestRefereeId ? (world.wrestlers[segment.guestRefereeId] ?? null) : null;
  const officialLabel = guest
    ? `Ref: ${guest.name} (guest)`
    : assigned
      ? `Ref: ${assigned.name}${segment.refereeId ? '' : ' (card)'}`
      : 'Ref: one of the boys';

  const gearFamily = stipulation?.gearFamilyId ? (propFamilyById(stipulation.gearFamilyId) ?? null) : null;
  const usableGearUnits = gearFamily ? usableUnitsForFamily(world.ownedPropUnits, gearFamily.id, world.settings) : [];

  const requirementsMet =
    stipulation && participants.length >= 2
      ? stipulationRequirementsMet(stipulation, {
          participants: participants.map((p) => p.wrestler),
          rivalryHeat: rivalry?.heat ?? 0,
          matchTimeLimitMinutes: segment.rules.timeLimit,
          ownedGearUnits: usableGearUnits.length,
        })
      : true;

  return {
    participants,
    sides,
    rivalry,
    stipulation,
    odds,
    bookable,
    onTheLine,
    championInMatch,
    stakes,
    assigned,
    guest,
    officialLabel,
    gearFamily,
    usableGearUnits,
    requirementsMet,
  };
}
