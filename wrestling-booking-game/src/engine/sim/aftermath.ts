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
import type { FinishType, Stipulation, Wrestler, WorldSettings } from '../types';

export interface AftermathContext {
  participants: Wrestler[];
  winnerIds: readonly string[];
  finish: FinishType;
  /** The match rating, 0-100. */
  rating: number;
  stipulation: Stipulation | null;
  /** True for a main event — the spot amplifies everything. */
  isMainEvent: boolean;
  settings: WorldSettings;
}

export interface AftermathChange {
  wrestlerId: string;
  momentum: number;
  popularity: number;
  health: number;
  energy: number;
  outcome: 'win' | 'loss' | 'draw';
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

export function computeAftermath(ctx: AftermathContext): AftermathChange[] {
  const s = ctx.settings;
  const winners = new Set(ctx.winnerIds);
  const decisive = ctx.winnerIds.length > 0;
  const spot = ctx.isMainEvent ? s.mainEventAftermathMultiplier : 1;

  // The night's work, felt by everybody: a hard match takes more out of you.
  const violence = ctx.stipulation?.violenceLevel ?? 0;
  const cost = s.matchHealthCost + violence * s.matchHealthCostPerViolence;

  return ctx.participants.map((w) => {
    const outcome: AftermathChange['outcome'] = !decisive ? 'draw' : winners.has(w.id) ? 'win' : 'loss';

    const momentum =
      outcome === 'win'
        ? s.momentumPerWin * spot
        : outcome === 'loss'
          ? -s.momentumPerLoss * spot
          : // A draw is not a loss, but nobody's stock rose either.
            -s.momentumPerDraw;

    // Popularity moves with the quality of the match for everyone, then the
    // winner takes a little extra on top — going over is worth something.
    // The win bonus is scaled by headroom, so beating people is how you climb
    // out of the midcard and not how you get from 95 to 100.
    const headroom = (100 - w.popularity) / 100;
    const popularity =
      popularityChase(ctx.rating, w.popularity, s) * spot + (outcome === 'win' ? s.popularityPerWin * headroom : 0);

    return {
      wrestlerId: w.id,
      momentum,
      popularity,
      health: -cost,
      energy: -s.matchEnergyCost,
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

  if (change.outcome === 'win') w.record.wins += 1;
  else if (change.outcome === 'loss') w.record.losses += 1;
  else w.record.draws += 1;

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
export function restWeek(w: Wrestler, worked: boolean, settings: WorldSettings): void {
  if (!worked) {
    w.consecutiveWeeksWorked = 0;
    w.health = clamp(w.health + settings.weeklyHealthRecovery, 0, 100);
    w.energy = clamp(w.energy + settings.weeklyEnergyRecovery, 0, 100);
    w.fatigueDebt = clamp(w.fatigueDebt - settings.weeklyFatigueRecovery, 0, 100);
  }

  // Momentum decays toward 50 — the middle of the card is where you end up
  // if nothing is happening to you.
  const drift = (50 - w.momentum) * settings.momentumDecayPerWeek;
  w.momentum = clamp(w.momentum + drift, 0, 100);
}
