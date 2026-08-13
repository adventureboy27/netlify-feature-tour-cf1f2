// What a match does to the people who worked it.
//
// Before this, a match produced a rating and a winner and then nothing
// happened to anybody: momentum never moved, records were never kept, and
// working six nights a week cost the same as sitting at home. So wins meant
// nothing, and there was no basis for ranking anyone.
//
// One module, used by the player's show and by every rival's, so the world is
// consistent: a win in Atlas Pro moves a wrestler exactly as much as a win in
// your company, and the rankings can compare them.
//
// The shape of it:
//   - Winning moves momentum up, losing moves it down, and a draw does very
//     little. Momentum is volatile by design — it is "what have you done
//     lately", not a rating.
//   - Popularity follows the *match*, not the result. A great match makes
//     both people, which is why a strong loss is a real booking tool.
//   - Everybody leaves a match in worse condition than they went in, and a
//     violent stipulation costs more.

import { clamp } from '../rng';
import { perkExposure, perkFatigueRelief, perkRecovery } from '../economy/perks';
import { promotionFit } from '../career/fit';
import type { FinishType, Promotion, Stipulation, Wrestler, WorldSettings } from '../types';
import { creditMatch, type Outcome } from '../career/ledger';
import { ledgerOf } from '../career/ledgerAccess';

export interface AftermathContext {
  participants: Wrestler[];
  winnerIds: readonly string[];
  finish: FinishType;
  /** The match rating, 0-100. */
  rating: number;
  stipulation: Stipulation | null;
  /** True for a main event — the spot amplifies everything. */
  isMainEvent: boolean;
  /**
   * Anybody who could not continue. Their night is a DNF rather than a loss:
   * a man carried out on a stretcher did not lose, and scoring it as one has
   * been quietly lying about every injury in the game. Per person rather than
   * per match — the man standing still takes the win, which is how every
   * combat sport on earth records it. See career/ledger.ts.
   */
  couldNotContinueIds?: readonly string[];
  /**
   * The company whose show this is. Optional only so the older tests can call
   * this without one; every real caller has it, and without it nobody's fit
   * with the room is felt at all.
   */
  promotion?: Pick<Promotion, 'id' | 'identity'>;
  /**
   * What the pace they were asked to work costs their bodies. An all-out
   * match takes nearly twice what a sprint does — see sim/pacing.ts.
   */
  healthCostMultiplier?: number;
  energyCostMultiplier?: number;
  settings: WorldSettings;
}

export interface AftermathChange {
  wrestlerId: string;
  momentum: number;
  popularity: number;
  health: number;
  energy: number;
  outcome: Outcome;
}

/**
 * How much the match itself was worth to the person who worked it.
 *
 * Popularity chases the quality of the matches you are in. Somebody who works
 * four-star matches every week drifts toward being a four-star draw; somebody
 * carried through openers drifts down to what those openers are worth.
 *
 * Written as a chase rather than a flat swing on purpose: a flat swing
 * compounds, and over a few hundred weeks it pins every wrestler in the world
 * at 0 or 100. This converges instead — which is also the truer model, since
 * how over you are and how good your matches are should be the same question
 * asked twice.
 */
function popularityChase(rating: number, current: number, settings: WorldSettings): number {
  return (rating - current) * settings.matchPopularityChase;
}

/**
 * What the same match is worth *here*.
 *
 * Fit moves the target rather than the movement, which is the whole design of
 * career/fit.ts: a signing does not lose anything the week they arrive, they
 * just stop climbing somewhere short of what their work says they are worth —
 * or keep climbing past it, in a room that suits them.
 */
function ratingHere(ctx: AftermathContext, wrestler: Wrestler): number {
  if (!ctx.settings.fitEnabled || !ctx.promotion) return ctx.rating;
  return ctx.rating * promotionFit(wrestler, ctx.promotion, ctx.settings);
}

export function computeAftermath(ctx: AftermathContext): AftermathChange[] {
  const s = ctx.settings;
  const winners = new Set(ctx.winnerIds);
  const decisive = ctx.winnerIds.length > 0;
  const spot = ctx.isMainEvent ? s.mainEventAftermathMultiplier : 1;

  // The night's work, felt by everybody: a hard match takes more out of you.
  const violence = ctx.stipulation?.violenceLevel ?? 0;
  const cost = (s.matchHealthCost + violence * s.matchHealthCostPerViolence) * (ctx.healthCostMultiplier ?? 1);
  const energyCost = s.matchEnergyCost * (ctx.energyCostMultiplier ?? 1);

  const stopped = new Set(ctx.couldNotContinueIds ?? []);

  return ctx.participants.map((w) => {
    const outcome: Outcome = stopped.has(w.id)
      ? 'dnf'
      : !decisive
        ? 'draw'
        : winners.has(w.id)
          ? 'win'
          : 'loss';

    const momentum =
      outcome === 'win'
        ? s.momentumPerWin * spot
        : outcome === 'loss'
          ? -s.momentumPerLoss * spot
          : // A draw is not a loss, but nobody's stock rose either — and
            // neither is a night that got stopped, however it looked.
            -s.momentumPerDraw;

    // Popularity moves with the quality of the match for everyone, then the
    // winner takes a little extra on top — going over is worth something.
    // The win bonus is scaled by headroom, so beating people is how you climb
    // out of the midcard and not how you get from 95 to 100.
    const headroom = (100 - w.popularity) / 100;
    const popularity =
      popularityChase(ratingHere(ctx, w), w.popularity, s) * spot +
      (outcome === 'win' ? s.popularityPerWin * headroom : 0);

    return {
      wrestlerId: w.id,
      momentum,
      popularity,
      health: -cost,
      energy: -energyCost,
      outcome,
    };
  });
}

/**
 * Apply a change in place. The store hands it the live wrestler.
 *
 * `matchRating` and `age` are taken here rather than looked up later because
 * this is the only moment they are true: a healed injury and a birthday both
 * erase the evidence, and the records page needs the mark as it stood.
 */
export function applyAftermath(
  w: Wrestler,
  change: AftermathChange,
  settings: WorldSettings,
  matchRating?: number,
): void {
  w.momentum = clamp(w.momentum + change.momentum, 0, 100);
  w.popularity = clamp(w.popularity + change.popularity, 0, 100);
  w.health = clamp(w.health + change.health, 0, 100);
  w.energy = clamp(w.energy + change.energy, 0, 100);
  w.consecutiveWeeksWorked += 1;
  w.fatigueDebt = clamp(w.fatigueDebt + settings.matchFatiguePerMatch, 0, 100);

  // The old three-number record, kept because a great deal reads it, and the
  // ledger, which is the one that knows *where* it happened.
  if (change.outcome === 'win') w.record.wins += 1;
  else if (change.outcome === 'loss') w.record.losses += 1;
  else if (change.outcome === 'draw') w.record.draws += 1;
  creditMatch(ledgerOf(w), change.outcome);

  if (w.popularity > w.careerHighPopularity) w.careerHighPopularity = w.popularity;

  markCareer(w, change.outcome, matchRating);
}

/** The running marks a match leaves on somebody's career. */
function markCareer(w: Wrestler, outcome: AftermathChange['outcome'], matchRating?: number): void {
  const marks = w.career;
  marks.matches += 1;

  // A draw does not extend a run either way, but it does not break one either
  // — a wrestler on a nine-match win streak who goes to a draw has not lost.
  if (outcome === 'win') marks.streak = marks.streak > 0 ? marks.streak + 1 : 1;
  else if (outcome === 'loss') marks.streak = marks.streak < 0 ? marks.streak - 1 : -1;

  marks.bestWinStreak = Math.max(marks.bestWinStreak, marks.streak);
  marks.worstLosingStreak = Math.min(marks.worstLosingStreak, marks.streak);

  marks.youngestMatchAge = marks.youngestMatchAge === null ? w.age : Math.min(marks.youngestMatchAge, w.age);
  marks.oldestMatchAge = marks.oldestMatchAge === null ? w.age : Math.max(marks.oldestMatchAge, w.age);

  if (matchRating !== undefined) {
    marks.bestMatchRating = marks.bestMatchRating === null ? matchRating : Math.max(marks.bestMatchRating, matchRating);
    marks.worstMatchRating =
      marks.worstMatchRating === null ? matchRating : Math.min(marks.worstMatchRating, matchRating);
  }
}

/**
 * The week off. Everybody who did not work recovers a little, and momentum
 * bleeds back toward nothing — being over is not a resting state.
 */
export function restWeek(
  w: Wrestler,
  worked: boolean,
  settings: WorldSettings,
  /**
   * How much of a week off this promotion's schedule actually leaves them —
   * 1 for a company running one night, well under it for one on the road five.
   * A roster that is never home does not heal, which is what turns a heavy
   * pattern into an injury list rather than merely a tired locker room.
   * See engine/world/schedule.ts.
   */
  recoveryScale = 1,
): void {
  if (!worked) {
    w.consecutiveWeeksWorked = 0;
    w.health = clamp(w.health + settings.weeklyHealthRecovery * recoveryScale, 0, 100);
    w.energy = clamp(w.energy + settings.weeklyEnergyRecovery * recoveryScale, 0, 100);
    w.fatigueDebt = clamp(w.fatigueDebt - settings.weeklyFatigueRecovery * recoveryScale, 0, 100);
  }

  // What the contract bought them. A jet and a trainer are the difference
  // between a body that lasts and one that does not, and they apply on the
  // weeks somebody worked as much as the weeks they did not — that is the
  // whole point of not sleeping on a bus. See economy/perks.ts.
  if (settings.perksEnabled) {
    w.fatigueDebt = clamp(w.fatigueDebt - perkFatigueRelief(w), 0, 100);
    w.health = clamp(w.health + perkRecovery(w), 0, 100);
    w.popularity = clamp(w.popularity + perkExposure(w), 0, 100);
  }

  // Momentum decays toward 50 — the middle of the card is where you end up
  // if nothing is happening to you.
  const drift = (50 - w.momentum) * settings.momentumDecayPerWeek;
  w.momentum = clamp(w.momentum + drift, 0, 100);
}
