// What the business thinks somebody is going to be.
//
// `talent` is the hidden ceiling (§3.8) and the player is never shown it. But
// until now every *promotion* read it directly — keenness, market value, the
// prospect label, rival demand in the free agent pool, tampering. Which meant
// the AI was omniscient about the one number the player can never see, and
// meant something worse: nobody could ever be wrong about anybody.
//
// `hype` is the public number. It is what scouts say, what the sheet prints,
// what the office believes, and it is what every one of those systems reads
// now. It is correlated with the truth and it is not the truth.
//
// ---------------------------------------------------------------------------
// Busts and sleepers
//
// Which gives the business the thing it was missing: a bad draft pick.
//
// A phenom comes out of the school with everybody in the room certain, and
// sometimes they cannot do it. A gem walks in off the street at thirty-eight
// with the body and the voice and it turns out there is nothing behind them.
// Both are somebody with high hype and ordinary talent, and neither is
// detectable at the point where the decision is made — by the player *or* by
// the five companies bidding against them.
//
// And it runs the other way, which is the half that makes it fair. Somebody
// nobody rated is occasionally carrying a ninety, and quietly turns into the
// best worker on your roster while the sheet still calls him a journeyman.
//
// ---------------------------------------------------------------------------
// Reality asserts itself
//
// Hype is not fixed. It converges on the truth as somebody works, because the
// business finds out by watching. The convergence is slow — a couple of years
// of matches — so a bust's stock falls the way a real one does: not a
// revelation, a gradual stopping of people bringing him up.
//
// That is also the only honest way the player learns. They do not get told
// the true number; they watch somebody they paid a fortune for fail to become
// anything, at exactly the rate everybody else works it out.

import type { Rng } from '../rng';
import { chance, clamp, gaussian, randInt } from '../rng';
import type { Wrestler, WorldSettings } from '../types';

/**
 * What the business would say about somebody at generation.
 *
 * Most of the time this is roughly right. The tails are the interesting part
 * and they are deliberately fat: a business where scouting is 95% accurate has
 * no draft busts in it.
 */
export function rollHype(rng: Rng, talent: number, settings: WorldSettings): number {
  return clamp(Math.round(talent + gaussian(rng, 0, settings.hypeNoise)), 5, 99);
}

/**
 * Somebody the whole business is certain about — a phenom out of the school,
 * a gem off the street.
 *
 * The certainty is real; whether it is *correct* is a separate roll, and that
 * is the entire feature. `bustChance` of these turn out to have nothing behind
 * the hype.
 */
export function rollStandoutTalent(rng: Rng, floor: number, settings: WorldSettings): number {
  if (chance(rng, settings.hypeBustChance)) {
    // The bad draft pick. Everything that made the room certain was real —
    // the body, the look, the way they move in a drill — and none of it turns
    // into a wrestler.
    return clamp(Math.round(gaussian(rng, settings.hypeBustTalent, 8)), 5, 99);
  }
  return clamp(Math.round(floor + randInt(rng, 0, 12)), 5, 99);
}

// ---------------------------------------------------------------------------
// Finding out

/** Somebody the business rates far above what they have got. */
export function isBust(wrestler: Wrestler, settings: WorldSettings): boolean {
  return wrestler.hype - wrestler.talent >= settings.hypeBustGap;
}

/** ...and somebody it has never rated at all. */
export function isSleeper(wrestler: Wrestler, settings: WorldSettings): boolean {
  return wrestler.talent - wrestler.hype >= settings.hypeSleeperGap;
}

/**
 * How much the market learns this week.
 *
 * Learning is by watching, so it is driven by matches worked rather than by
 * time passing — somebody kept off television keeps their reputation, which is
 * true to the business and is also a real (bad) strategy the player can run.
 */
export function hypeDrift(wrestler: Wrestler, worked: boolean, settings: WorldSettings): number {
  const gap = wrestler.talent - wrestler.hype;
  if (Math.abs(gap) < 0.01) return 0;
  const rate = worked ? settings.hypeLearnWorked : settings.hypeLearnIdle;
  return gap * rate;
}

export type HypeVerdict =
  /** The business has quietly stopped waiting. */
  | { kind: 'writtenOff'; note: string }
  /** ...or has finally noticed somebody it had nothing to say about. */
  | { kind: 'discovered'; note: string }
  | { kind: 'nothing' };

/**
 * The moment the market's opinion crosses a line, said out loud once.
 *
 * §0: nothing happens to a person off-screen. Somebody's stock collapsing over
 * two years is a thing that happened to them, and the paper gets one sentence
 * about it on the week it becomes undeniable — not a weekly drip, and not
 * silence.
 */
export function crossing(
  wrestler: Wrestler,
  hypeBefore: number,
  settings: WorldSettings,
): HypeVerdict {
  const s = settings;
  const wasRated = hypeBefore >= s.hypeRatedAt;
  const isRated = wrestler.hype >= s.hypeRatedAt;

  if (wasRated && !isRated) {
    return {
      kind: 'writtenOff',
      note: `Nobody in the business talks about ${wrestler.name} as a future anything any more. Whatever they were supposed to become, they have not.`,
    };
  }
  if (!wasRated && isRated) {
    return {
      kind: 'discovered',
      note: `People have started talking about ${wrestler.name}. Nobody saw it coming, including whoever signed them.`,
    };
  }
  return { kind: 'nothing' };
}

/** How the sheet describes what the business expects, in words. */
export function hypeLabel(wrestler: Wrestler, settings: WorldSettings): string | null {
  const s = settings;
  if (wrestler.hype >= s.hypePhenomAt) return 'Everybody says they are the next one';
  if (wrestler.hype >= s.hypeRatedAt) return 'Rated highly';
  return null;
}
