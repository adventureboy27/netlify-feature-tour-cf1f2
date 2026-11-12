// Ring intelligence: knowing what to do out there.
//
// The sim already knew how good somebody was — `skill` is workrate, the moves
// they can do and how cleanly. What it had no word for is the other thing, the
// one every locker room can name in about four seconds: does this person know
// what they are doing in a match.
//
// They are genuinely different. A green kid can have a beautiful sense of
// timing and a twenty-year veteran can still be lost out there, so `skill`
// only leans on ring IQ at generation rather than deciding it. And it does two
// things that nothing else in the sim does:
//
//   Botches. A blown spot is not a wrestler being bad, it is a wrestler being
//   lost — a moment where somebody did not know where to be. It costs the
//   match, it is reported, and at the sharp end it hurts somebody. Nothing in
//   the game modelled a match going wrong for a reason other than the two
//   people in it being poor.
//
//   Carrying. The one everybody actually means by ring IQ. Somebody with it
//   can take a limited opponent and make the match look like the opponent's
//   best night — Bret Hart's whole reputation, and something the sim actively
//   could not express, because match quality was a blend of two numbers and a
//   bad number dragged a good one down no matter who was holding it.
//
// Which is the point: with carrying in, the worst wrestler on your roster is
// worth something opposite the right partner, and the right partner is worth
// more than his own star rating. That is a booking decision the game did not
// previously have.

import type { Rng } from '../rng';
import { chance, clamp } from '../rng';
import type { Wrestler, WorldSettings } from '../types';

/** Everything either half of this needs. Structural, so anybody can call it. */
export type Worker = Pick<Wrestler, 'id' | 'name' | 'ringIQ' | 'skill' | 'stamina' | 'health'>;

// ---------------------------------------------------------------- carrying

/**
 * How much of a match this person can carry on their own.
 *
 * Zero below the threshold — carrying is a real skill and most of the roster
 * simply does not have it. Above it, it climbs to a cap, because nobody makes
 * a match out of nothing and a system where one worker's number swamped the
 * other's would make the opponent irrelevant, which is the opposite of what
 * carrying means.
 */
export function carryStrength(worker: Worker, settings: WorldSettings): number {
  const over = worker.ringIQ - settings.carryRingIQFloor;
  if (over <= 0) return 0;
  const room = Math.max(1, 100 - settings.carryRingIQFloor);
  return clamp((over / room) * settings.carryMax, 0, settings.carryMax);
}

export interface Carried {
  /** Each worker's contribution after the best hand in the match got hold of it. */
  contributions: number[];
  /** Who did the carrying, when anybody did. */
  strongestId: string | null;
  /** How much was added in total. Zero when nobody carried anything. */
  lift: number;
}

/**
 * What a match is actually worth once somebody in it knows how to work.
 *
 * Takes the contributions the rating already computed and pulls everybody
 * below the best of them up toward it, by the best worker's carry.
 * Deliberately a pull rather than a bonus: a great worker opposite another
 * great worker gains almost nothing, because there is nothing to carry. The
 * whole value is in being put opposite somebody who needs it.
 *
 * Order is preserved, so the caller can map straight back onto its own list.
 */
export function carried(
  workers: readonly Worker[],
  contributions: readonly number[],
  settings: WorldSettings,
): Carried {
  const flat = { contributions: [...contributions], strongestId: null, lift: 0 };
  if (workers.length < 2 || workers.length !== contributions.length) return flat;

  // Whoever is holding the match together is the best *worker* in it, not the
  // highest contribution — those come apart exactly in the case this exists
  // for, a technician opposite a star who cannot go.
  let best = 0;
  for (let i = 1; i < workers.length; i++) {
    if (carryStrength(workers[i]!, settings) > carryStrength(workers[best]!, settings)) best = i;
  }
  const strength = carryStrength(workers[best]!, settings);
  if (strength <= 0) return flat;

  // Everybody in the match is pulled toward the best work in it — including the
  // carrier. That last part is not a rounding decision, it is the model: ring
  // IQ is not workrate, so a veteran with a beautiful sense of timing and a
  // body that has stopped cooperating can genuinely be the best hand in a
  // match while contributing the least raw work. Skipping him produced exactly
  // that bug — a general opposite a star who could go lifted nobody at all,
  // because the only person below the ceiling was the man doing the carrying.
  const ceiling = Math.max(...contributions);
  const out = [...contributions];
  let lift = 0;
  for (let i = 0; i < out.length; i++) {
    const gap = ceiling - out[i]!;
    if (gap <= 0) continue;
    const added = gap * strength;
    out[i] = out[i]! + added;
    lift += added;
  }

  return { contributions: out, strongestId: lift > 0 ? workers[best]!.id : null, lift };
}

/**
 * Said out loud when somebody genuinely dragged a match up.
 *
 * Only above a threshold, because "carried it slightly" is not a thing anybody
 * says, and §0 wants the write-up to report what happened rather than narrate
 * every arithmetic term.
 */
export function carryLine(
  strong: Worker,
  weak: Worker,
  lift: number,
  settings: WorldSettings,
): string | null {
  if (lift < settings.carryWorthSaying) return null;
  return `${strong.name} led ${weak.name} through that one and made it look like ${weak.name}'s best night in months.`;
}

// ----------------------------------------------------------------- botching

export type Botch = {
  /** Who lost their place. */
  workerId: string;
  workerName: string;
  /** What the crowd saw, in the write-up's words. */
  text: string;
  /** Rating cost, already scaled by how bad it was. */
  ratingCost: number;
  /** Whether somebody got hurt on it. `rules.ts` still owns the injury. */
  hurtSomebody: boolean;
};

const BLOWN = [
  '{who} went for it and got nowhere near it. The crowd saw the whole thing.',
  '{who} lost their footing on the top rope and the spot died right there.',
  'A reversal that neither of them seemed to have agreed on, and {who} came off worst.',
  '{who} called for something, got a blank look back, and the two of them stood there for a beat too long.',
  '{who} landed it wrong. Everybody in the building winced.',
];

/**
 * Did somebody lose their place out there, and how badly.
 *
 * Ring IQ is most of it. Being exhausted or hurt is the rest, because the
 * spots that go wrong are the ones at the end of a long match by somebody with
 * nothing left — which is also why this scales with how long the match went.
 *
 * Returns at most one per match. Two botches in one match is a comedy, and the
 * write-up has other things to say.
 */
export function rollBotch(
  rng: Rng,
  workers: readonly Worker[],
  minutes: number,
  settings: WorldSettings,
): Botch | null {
  if (workers.length === 0) return null;

  // Whoever is most likely to be the one. Lowest ring IQ, worn down hardest.
  const risk = (w: Worker) =>
    (100 - w.ringIQ) / 100 +
    ((100 - w.health) / 100) * settings.botchFromCondition +
    ((100 - w.stamina) / 100) * settings.botchFromStamina;

  const worst = [...workers].sort((x, y) => risk(y) - risk(x))[0]!;
  const long = clamp(minutes / Math.max(1, settings.botchReferenceMinutes), 0.5, 2);
  const odds = clamp(risk(worst) * settings.botchPerRiskPoint * long, 0, settings.botchMaxChance);

  if (!chance(rng, odds)) return null;

  const phrasing = BLOWN[Math.floor(rng.next() * BLOWN.length)]!;
  // How badly it went. Most are ugly; a few hurt somebody.
  const severity = rng.next();
  const hurtSomebody = severity > 1 - settings.botchInjuryShare;

  return {
    workerId: worst.id,
    workerName: worst.name,
    text: phrasing.replace('{who}', worst.name),
    ratingCost: settings.botchRatingCost * (hurtSomebody ? settings.botchBadOneMultiplier : 1),
    hurtSomebody,
  };
}

// ------------------------------------------------------------------- words

/** Ring IQ in words, never a number (§0). */
export function ringcraftLabel(worker: Pick<Wrestler, 'ringIQ'>, settings: WorldSettings): string {
  if (worker.ringIQ >= settings.ringcraftGeneralAt) return 'Generals the match';
  if (worker.ringIQ >= settings.ringcraftSafeAt) return 'Safe pair of hands';
  if (worker.ringIQ >= settings.ringcraftGreenAt) return 'Still learning out there';
  return 'Gets lost out there';
}

/** What the locker room makes of them. Nothing to do with the crowd. */
export function likeabilityLabel(
  worker: Pick<Wrestler, 'likeability'>,
  settings: WorldSettings,
): string {
  if (worker.likeability >= settings.likedBelovedAt) return 'Everybody wants to travel with them';
  if (worker.likeability >= settings.likedFineAt) return 'Gets on with everybody';
  if (worker.likeability >= settings.likedAwkwardAt) return 'Rubs a few people up the wrong way';
  return 'The room has had enough of them';
}
