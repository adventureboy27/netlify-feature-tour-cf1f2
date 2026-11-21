// Who is watching, and what they want.
//
// One number per company, 0 (families and kids) to 100 (grown-ups), neutral in
// the middle. The sponsors on the banner set where it is heading: a cereal
// brings families in, a sports drink an older, louder crowd, and a local
// business nobody in particular. It drifts toward that a little every week,
// so changing sponsors changes the crowd over a couple of months, not
// overnight — and it drifts back once they are gone.
//
// It does not add to a match; it tilts it. The same match rates a little
// higher in front of the crowd it suits and a little lower in front of the one
// it does not: flyers, masks and good guys for the families, brawlers,
// hardcore and villains for the grown-ups. So a sponsor is a booking decision,
// not just the biggest cheque.

import { AUDIENCE, AUDIENCE_WORDS, STYLE_AUDIENCE } from '../../data/audience';
import type { Sponsor } from '../../data/sponsors';
import { clamp } from '../rng';
import type { Wrestler } from '../types';

/** Where the crowd is heading, given who is on the banner. */
export function audienceTarget(sponsors: readonly Pick<Sponsor, 'audience'>[]): number {
  const pull = sponsors.reduce((sum, s) => sum + (s.audience === 'family' ? -1 : s.audience === 'grownUp' ? 1 : 0), 0);
  return clamp(AUDIENCE.neutral + pull * AUDIENCE.sponsorPush, AUDIENCE.floor, AUDIENCE.ceiling);
}

/** A week passes: the crowd moves part of the way toward the sponsors' target. */
export function driftAudience(current: number, sponsors: readonly Pick<Sponsor, 'audience'>[]): number {
  return current + (audienceTarget(sponsors) - current) * AUDIENCE.driftRate;
}

/**
 * Rating points for how well a match suits who is watching: positive when it
 * is what they came for, negative when it is not, zero with a mixed crowd.
 * `violenceLevel` is the stipulation's (0 for none).
 */
export function audienceRatingBonus(
  participants: readonly Pick<Wrestler, 'style' | 'alignment'>[],
  violenceLevel: number,
  audienceAge: number,
): number {
  if (participants.length === 0) return 0;
  // -1 all families, +1 all grown-ups.
  const lean = (audienceAge - AUDIENCE.neutral) / AUDIENCE.neutral;
  if (lean === 0) return 0;
  const appeal =
    participants.reduce((sum, w) => {
      // A heel is the grown-ups' (they love to hate them); a face is the families'.
      const villain = -clamp(w.alignment / AUDIENCE.alignmentScale, -1, 1);
      return sum + STYLE_AUDIENCE[w.style] + villain * AUDIENCE.alignmentWeight;
    }, 0) /
      participants.length +
    clamp(violenceLevel / AUDIENCE.maxViolence, 0, 1);
  return lean * clamp(appeal, -1.5, 1.5) * AUDIENCE.ratingWeight;
}

/** The crowd in words. */
export function audienceWords(audienceAge: number): string {
  return (AUDIENCE_WORDS.find((band) => audienceAge <= band.upTo) ?? AUDIENCE_WORDS[AUDIENCE_WORDS.length - 1]!).words;
}
