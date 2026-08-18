// Dark matches — two optional slots that run before or after the card and
// were never broadcast.
//
// DESIGN: A dark match is real, in every sense the rest of the sim means
// that word — it is simulated the same way, it can be worked well or badly,
// and it can hurt somebody. What it does not get is the full apparatus a TV
// or PPV segment gets: no stipulation, no titles, no managers, no referee
// politics, no overexposure/pace-saturation bookkeeping that assumes it is
// part of the night's broadcast memory. Those all exist to make a televised
// match mean something to an audience that is watching, and nobody outside
// the building is watching this. Scoped down on purpose rather than
// half-built to look complete — see the working agreement in CLAUDE.md on
// picking the harder, more interesting reading rather than stalling.
//
// What it keeps: the sim decides the winner the same way (simulateMatch),
// the people in it develop the same way (computeAftermath), a real feud can
// be tested (rivalry heat still applies), and it can still go wrong
// (rollCasualty still rolls). What it does not do is move the company's
// television rating — callers simply never fold its result into
// computeShowRating, because it was never on the card that mattered for that
// number.

import type { Rng } from '../rng';
import type {
  Id,
  Injury,
  MatchRules,
  PromotionArchetype,
  Rivalry,
  SegmentResult,
  Wrestler,
  WorldSettings,
} from '../types';
import { simulateMatch, type SimParticipant } from './simulateMatch';
import { computeAftermath, type AftermathChange } from './aftermath';
import { rollCasualty, stoppageCasualty, injuryFrom, outFor, type Casualty } from './casualties';
import { houseStyleRatingBonus } from './houseStyle';
import { workingHurtRisk } from '../world/titleDefence';

export interface DarkMatchContext {
  rules: MatchRules;
  matchLengthMinutes: number;
  settings: WorldSettings;
  promotionArchetype: PromotionArchetype;
  /** Real bad blood between these two, if any — a dark match can carry a feud forward. */
  rivalry?: Rivalry | null;
}

export interface DarkMatchOutcome {
  result: SegmentResult;
  /** Momentum, popularity, record — apply with applyAftermath. */
  changes: AftermathChange[];
  /** Who got hurt, if anybody, ready to write onto their Wrestler record. */
  casualties: { casualty: Casualty; injury: Injury }[];
}

/**
 * Run one dark match and everything that follows from it, except the parts
 * that only mean something to a broadcast — see the file note.
 */
export function resolveDarkMatch(
  rng: Rng,
  participants: SimParticipant[],
  wrestlerById: Map<Id, Wrestler>,
  currentWeek: number,
  ctx: DarkMatchContext,
): DarkMatchOutcome {
  const people = participants.map((p) => wrestlerById.get(p.wrestlerId)!);

  const sim = simulateMatch(rng, participants, wrestlerById, {
    rules: ctx.rules,
    stipulation: null,
    requirementsMet: true,
    isPPV: false,
    matchLengthMinutes: ctx.matchLengthMinutes,
    settings: ctx.settings,
    rivalry: ctx.rivalry,
    houseStyleFit: houseStyleRatingBonus(people, ctx.promotionArchetype, ctx.settings),
  });

  const stoppedIds = new Set<Id>();
  const casualties: { casualty: Casualty; injury: Injury }[] = [];

  // A stretcher job still has to be able to say who and why, whether or not
  // anybody outside the building ever finds out.
  if (sim.finish === 'injuryStoppage') {
    const hurt = people.find((p) => !sim.winnerWrestlerIds.includes(p.id));
    if (hurt && !hurt.injury) {
      const casualty = stoppageCasualty(rng, {
        personId: hurt.id,
        name: hurt.name,
        role: 'competitor',
        violenceLevel: 0,
        injuryMultiplier: sim.injuryMultiplier,
        toughness: hurt.toughness,
        settings: ctx.settings,
      });
      casualties.push({ casualty, injury: injuryFrom(casualty, currentWeek) });
      stoppedIds.add(hurt.id);
    }
  }

  for (const person of people) {
    if (stoppedIds.has(person.id)) continue;
    // Already hurt and not cleared means the booker is not sending them out
    // to risk it further tonight — same rule the main card uses.
    if (person.injury && !person.clearedToWorkHurt) continue;
    const casualty = rollCasualty(rng, {
      personId: person.id,
      name: person.name,
      role: 'competitor',
      violenceLevel: 0,
      injuryMultiplier: sim.injuryMultiplier * workingHurtRisk(person, ctx.settings),
      toughness: person.toughness,
      settings: ctx.settings,
    });
    if (casualty) casualties.push({ casualty, injury: injuryFrom(casualty, currentWeek) });
  }

  const changes = computeAftermath({
    participants: people,
    winnerIds: sim.winnerWrestlerIds,
    finish: sim.finish,
    rating: sim.rating,
    stipulation: null,
    isMainEvent: false,
    couldNotContinueIds: [...stoppedIds],
    healthCostMultiplier: sim.healthCostMultiplier,
    energyCostMultiplier: sim.energyCostMultiplier,
    settings: ctx.settings,
  });

  // Off-camera. Word gets around the locker room and a little further, not
  // to a national audience — see darkMatchPopularityShare in settings.ts.
  const scaled = changes.map((c) => ({ ...c, popularity: c.popularity * ctx.settings.darkMatchPopularityShare }));

  const result: SegmentResult = {
    winnerSide: sim.winnerSide,
    winnerWrestlerIds: sim.winnerWrestlerIds,
    finish: sim.finish,
    rating: sim.rating,
    stars: sim.stars,
    ratingBreakdown: sim.ratingBreakdown,
    beats: sim.beats,
    titleChanged: false,
    injuries: casualties.map(({ casualty }) => ({
      wrestlerId: casualty.personId,
      name: casualty.name,
      role: casualty.role,
      text: casualty.text,
      outFor: outFor(casualty.weeks, ctx.settings),
    })),
  };

  return { result, changes: scaled, casualties };
}
