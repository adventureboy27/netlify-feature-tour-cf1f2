// Where somebody sits on the card — and how they move.
//
// `cardStatus` existed from the beginning and was a lie. It was stamped once
// at generation, written exactly once more in the whole codebase (retirement
// forcing `enhancement`), and read by nothing at all. A man generated as a
// main eventer was still a main eventer after eight years of losing openers,
// and a prospect who became the biggest draw in the business was still
// labelled a prospect on the day he retired.
//
// So it is derived now, not stored — the same call the office makes, made from
// what is actually true about somebody rather than from what was true the day
// they were invented.
//
// ---------------------------------------------------------------------------
// It is a read of *this* room
//
// The key thing, and the reason this could not be a plain popularity sort:
// status is per-promotion. Somebody is a main eventer *here*. The same man in
// a company that does not want what he does is an upper midcarder, and the
// company that signs him away can find that out the expensive way.
//
// So the input is `overnessIn` — how over somebody can get in this particular
// building (career/fit.ts) — rather than raw popularity. Stars are not stars
// everywhere, and a status ladder that ignored that would quietly contradict
// the system next door.
//
// ---------------------------------------------------------------------------
// It moves, and it can move fast
//
// Two ways up, and they are different in kind.
//
// The slow way is the ladder: get over, stay over, climb. That is most
// careers, and the bands are wide enough that somebody does not flicker
// between midcard and upper midcard on a good week.
//
// The fast way is that somebody catches fire. A lower-carder having the year
// of his life — winning, working good matches, and climbing hard — jumps a
// band without waiting to earn it slowly, because that is what actually
// happens: the crowd decides somebody is a star and the office finds out
// afterwards. Rare, and never announced in advance (§0).
//
// And it falls. A main eventer who stops drawing comes down, with a stickiness
// on the way down that the way up does not get — a company does not
// un-main-event somebody the first bad month, and the audience remembers who
// you were for a while after you stop being it.

import { clamp } from '../rng';
import type { CardStatus, Promotion, Wrestler, WorldSettings } from '../types';
import { overnessIn } from './fit';

/** Top of the card first. The order is the ladder. */
export const CARD_STATUS_LADDER: CardStatus[] = [
  'mainEventer',
  'upperMidcard',
  'midcard',
  'lowerCard',
  'enhancement',
];

export const CARD_STATUS_LABELS: Record<CardStatus, string> = {
  mainEventer: 'Main eventer',
  upperMidcard: 'Upper midcard',
  midcard: 'Midcard',
  lowerCard: 'Lower card',
  enhancement: 'Enhancement',
  prospect: 'Prospect',
};

/** How high somebody is on the ladder, 0 being the top. `prospect` sits out. */
export function ladderIndex(status: CardStatus): number {
  const i = CARD_STATUS_LADDER.indexOf(status);
  return i === -1 ? CARD_STATUS_LADDER.length : i;
}

export function isAbove(a: CardStatus, b: CardStatus): boolean {
  return ladderIndex(a) < ladderIndex(b);
}

/**
 * The band somebody's standing puts them in, before any stickiness.
 *
 * Thresholds are on `overnessIn`, so this is a read of how over they are in
 * *this* company rather than of their national number.
 */
export function bandFor(standing: number, settings: WorldSettings): CardStatus {
  const s = settings;
  if (standing >= s.cardMainEventAt) return 'mainEventer';
  if (standing >= s.cardUpperMidcardAt) return 'upperMidcard';
  if (standing >= s.cardMidcardAt) return 'midcard';
  if (standing >= s.cardLowerCardAt) return 'lowerCard';
  return 'enhancement';
}

export interface StatusContext {
  /** Where they are now. */
  current: CardStatus;
  /** How over they are here — `overnessIn`. */
  standing: number;
  /** What have you done lately, 0-100. */
  momentum: number;
  /** Nobody with no matches is anything yet. */
  matches: number;
}

/**
 * Has somebody caught fire?
 *
 * The Austin case. Not a random roll — it is a specific, legible state: a
 * lower-carder whose momentum is through the roof and who is already climbing
 * out of his band. What makes it feel like an overnight thing is that the
 * jump is two bands rather than one, so the office goes from not booking him
 * to building around him without the year in between.
 *
 * Deliberately *not* available to somebody already at the top: a main eventer
 * cannot catch fire, he can only stop being one.
 */
export function caughtFire(ctx: StatusContext, settings: WorldSettings): boolean {
  const s = settings;
  if (ctx.matches < s.cardMinMatches) return false;
  if (isAbove(ctx.current, 'midcard')) return false;
  if (ctx.momentum < s.cardBreakoutMomentum) return false;
  // Momentum alone is a hot streak. The crowd has to have moved too, or this
  // is just somebody the booker has been protecting.
  return ctx.standing >= s.cardBreakoutStanding;
}

/**
 * Where the office would put somebody this week.
 *
 * Sticky on the way down and honest on the way up, with one exception for
 * somebody who has caught fire.
 */
export function statusFor(ctx: StatusContext, settings: WorldSettings): CardStatus {
  const s = settings;

  // Nobody is anything until they have worked. A signing with no matches
  // stays a prospect however good the scouting report was.
  if (ctx.matches < s.cardMinMatches) return 'prospect';

  const earned = bandFor(ctx.standing, settings);

  if (caughtFire(ctx, settings)) {
    // Two bands at once, which is what makes it read as overnight.
    const target = Math.max(0, ladderIndex(ctx.current) - 2);
    const jumped = CARD_STATUS_LADDER[target]!;
    // Never past what the crowd will actually carry — catching fire moves
    // somebody up the queue, it does not invent a main eventer out of a man
    // nobody has heard of.
    return isAbove(jumped, earned) ? earned : jumped;
  }

  // Coming down is slower than going up. A promotion does not take somebody
  // off the top of the card the first month they cool off, and the audience
  // remembers who they were for a while after they stop being it.
  if (isAbove(ctx.current, earned)) {
    const cushion = s.cardFallCushion;
    const stillAbove = bandFor(ctx.standing + cushion, settings);
    return stillAbove;
  }

  return earned;
}

/** Convenience: the read for a real wrestler at a real company. */
export function statusOf(
  wrestler: Wrestler,
  promotion: Pick<Promotion, 'id' | 'identity'>,
  settings: WorldSettings,
): CardStatus {
  return statusFor(
    {
      current: wrestler.cardStatus,
      standing: overnessIn(wrestler, promotion, settings),
      momentum: wrestler.momentum,
      matches: wrestler.career.matches,
    },
    settings,
  );
}

// ---------------------------------------------------------------------------
// Saying it

export type StatusMove =
  | { kind: 'rose'; note: string }
  | { kind: 'caughtFire'; note: string }
  | { kind: 'fell'; note: string }
  | { kind: 'none' };

/**
 * A move on the card, said out loud once.
 *
 * §0: nothing happens to a person off-screen, and somebody being quietly
 * dropped out of the main event scene is absolutely something that happened to
 * them. The player should never find out by noticing a label changed.
 */
export function statusMove(
  wrestler: Pick<Wrestler, 'name'>,
  before: CardStatus,
  after: CardStatus,
  fire: boolean,
): StatusMove {
  if (before === after) return { kind: 'none' };

  if (isAbove(after, before)) {
    if (fire) {
      return {
        kind: 'caughtFire',
        note: `Something has happened with ${wrestler.name}. The crowd has decided, and the office is catching up — he has gone from nowhere on the card to somebody they have to build around.`,
      };
    }
    return {
      kind: 'rose',
      note: `${wrestler.name} has moved up the card. ${CARD_STATUS_LABELS[after]} now.`,
    };
  }

  return {
    kind: 'fell',
    note: `${wrestler.name} has come down the card. ${CARD_STATUS_LABELS[after]} — the spots are going to other people.`,
  };
}

// ---------------------------------------------------------------------------
// Who is in the picture

export interface Contender {
  wrestlerId: string;
  status: CardStatus;
  standing: number;
  momentum: number;
  /** Climbing hard — the ones worth building a story on now. */
  hot: boolean;
}

/**
 * The main event picture: who is at the top, and who is coming.
 *
 * This is the view a booker actually plans from — not the roster sorted by a
 * number, but "who is in it". Includes people a band below the top who are
 * climbing, because those are exactly the people worth putting in the title
 * scene *before* they arrive.
 */
export function mainEventPicture(
  roster: readonly Wrestler[],
  promotion: Pick<Promotion, 'id' | 'identity'>,
  settings: WorldSettings,
): Contender[] {
  const s = settings;
  return roster
    .filter((w) => !w.deceased && w.role === 'wrestler' && !w.injury)
    .map((w) => {
      const standing = overnessIn(w, promotion, settings);
      return {
        wrestlerId: w.id,
        status: w.cardStatus,
        standing,
        momentum: w.momentum,
        // Climbing hard, and already established enough for it to mean
        // something. Gating this at upper midcard made it dead code — anybody
        // who cleared it was in the picture on status alone.
        hot: w.momentum >= s.cardHotMomentum && standing >= s.cardMidcardAt,
      };
    })
    .filter((c) => c.status === 'mainEventer' || c.status === 'upperMidcard' || c.hot)
    .sort((a, b) => b.standing + b.momentum * 0.3 - (a.standing + a.momentum * 0.3));
}

/** Somebody worth a look right now, wherever they sit on the card. */
export function hotCommodities(
  roster: readonly Wrestler[],
  promotion: Pick<Promotion, 'id' | 'identity'>,
  settings: WorldSettings,
): Contender[] {
  const s = settings;
  return roster
    .filter((w) => !w.deceased && w.role === 'wrestler')
    .map((w) => ({
      wrestlerId: w.id,
      status: w.cardStatus,
      standing: overnessIn(w, promotion, settings),
      momentum: w.momentum,
      hot: true,
    }))
    .filter((c) => c.momentum >= s.cardHotMomentum)
    .sort((a, b) => b.momentum - a.momentum);
}

/** How the sheet describes somebody's direction, in words (§0). */
export function trajectoryLabel(
  wrestler: Pick<Wrestler, 'momentum' | 'cardStatus'>,
  settings: WorldSettings,
): string | null {
  const s = settings;
  if (wrestler.momentum >= s.cardHotMomentum) return 'On the way up';
  if (wrestler.momentum <= s.cardColdMomentum) return 'Going backwards';
  return null;
}

/** Clamp a standing into the range the bands are defined on. */
export function standingIn(wrestler: Wrestler, promotion: Pick<Promotion, 'id' | 'identity'>, settings: WorldSettings): number {
  return clamp(overnessIn(wrestler, promotion, settings), 0, 100);
}
