// What the crowd has actually come to want.
//
// A promotion's identity (data/promotionIdentity.ts) is the brand the booker
// declared — chosen once, at signing or a rebrand, and otherwise fixed. This
// is different: it is what the room in front of them has actually developed
// a taste for, and it can drift away from the declared identity if the
// booker keeps giving them something else. Run hardcore matches on a
// technical card often enough and the crowd starts wanting hardcore matches,
// whether or not that is what the marquee says.
//
// Reuses the exact drift-toward-a-target shape sim/freshness.ts's
// ageGimmick uses for gimmick heat, for the same reason: a number that
// should chase evidence gradually, not snap to it the moment a card is run.

import type { PromotionArchetype, WorldSettings, WrestlingStyle } from '../types';
import { WRESTLING_STYLES } from '../../data/styles';
import { clamp } from '../rng';
import { identityOf, styleFit } from '../../data/promotionIdentity';

export type FanTaste = Record<WrestlingStyle, number>;

/**
 * Starting taste for a promotion with no booking history yet: a mild lean
 * toward its declared identity, well short of the swing sustained booking
 * can eventually earn — the crowd has not been shown anything yet, they are
 * only going off the marquee.
 */
export function defaultFanTaste(archetype: PromotionArchetype): FanTaste {
  const identity = identityOf(archetype);
  const taste = {} as FanTaste;
  for (const style of WRESTLING_STYLES) {
    taste[style] = 50 + styleFit(identity, style) * 15;
  }
  return taste;
}

/**
 * How much of tonight's card was each style, by competitor appearance —
 * somebody working twice counts twice, which is correct: two matches of a
 * style is twice the evidence one match is. A style nobody worked is simply
 * absent from the result rather than zero, so `driftFanTaste` is the only
 * place that has to decide what "not shown tonight" means.
 */
export function styleRunShare(styles: readonly WrestlingStyle[]): Partial<Record<WrestlingStyle, number>> {
  if (styles.length === 0) return {};
  const counts = new Map<WrestlingStyle, number>();
  for (const style of styles) counts.set(style, (counts.get(style) ?? 0) + 1);
  const share: Partial<Record<WrestlingStyle, number>> = {};
  for (const [style, count] of counts) share[style] = count / styles.length;
  return share;
}

/**
 * A week passes and taste moves toward whatever the card actually ran, style
 * by style. A style run well above its even share of the card climbs toward
 * a real preference; one run at roughly its fair share holds; one that did
 * not appear at all drifts gently down from neglect rather than collapsing —
 * a single quiet week should not read as "the crowd now hates luchador,"
 * only "they haven't seen it in a while."
 *
 * DESIGN: "not run this week" pulling the target *below* neutral, rather
 * than leaving it at neutral, is a judgment call — it means a style that
 * never appears at all eventually reads as mildly cold rather than staying
 * perfectly neutral forever. That matches the spirit of the request (an
 * audience that has opinions about what it is and is not being shown) more
 * than a model where ignoring something indefinitely costs nothing.
 *
 * Mutates, matching ageGimmick — the caller owns the object's lifetime.
 */
export function driftFanTaste(
  taste: FanTaste,
  runShare: Partial<Record<WrestlingStyle, number>>,
  settings: WorldSettings,
): void {
  const neutralShare = 1 / WRESTLING_STYLES.length;
  for (const style of WRESTLING_STYLES) {
    const share = runShare[style] ?? 0;
    const target = clamp(
      settings.fanTasteNeutral + (share - neutralShare) * settings.fanTasteShareScale,
      0,
      100,
    );
    taste[style] = clamp(taste[style] + (target - taste[style]) * settings.fanTasteDriftRate, 0, 100);
  }
}

/** Styles this crowd has genuinely come to love, or gone cold on. Words, not the 0-100 underneath. */
export function fanTasteHighlights(
  taste: FanTaste,
  settings: WorldSettings,
): { loved: WrestlingStyle[]; cold: WrestlingStyle[] } {
  const loved = WRESTLING_STYLES.filter((style) => taste[style] >= settings.fanTasteNeutral + settings.fanTasteNoticeGap);
  const cold = WRESTLING_STYLES.filter((style) => taste[style] <= settings.fanTasteNeutral - settings.fanTasteNoticeGap);
  return { loved, cold };
}
