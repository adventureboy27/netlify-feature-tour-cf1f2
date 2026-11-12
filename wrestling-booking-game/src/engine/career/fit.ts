// Stars are not stars everywhere.
//
// Popularity was a single number attached to a person, and it travelled
// perfectly. Sign the biggest name in the business, and he was the biggest
// name in *your* building on his first night, at full value, forever. Which
// is the one thing about the wrestling business that has never been true.
//
// Somebody gets over *somewhere*. A stiff, silent Japanese-style worker is a
// god in a company that sells workrate and a curiosity in one that sells
// spectacle. A charismatic loudmouth who cannot go is a main eventer in the
// second and gets booed out of the first. And underneath the legible half
// there is the part nobody can explain: some guy just clicks in Memphis and
// dies everywhere else, and nobody — not the booker, not the wrestler — ever
// works out why.
//
// So fit has two halves and they are deliberately different in kind:
//
//   - The **legible** half, which the player can reason about. Style against
//     house style, workrate against star power, how much violence the room
//     will take. Read the promotion, sign accordingly.
//   - The **chemistry**, which they cannot. A hidden per-person-per-company
//     number, worth about as much as the legible half, that exists so that
//     signing correctly is not the same as signing well.
//
// Chemistry is a hash of the two ids rather than stored state or an rng draw.
// That matters three ways: it survives a save with no schema, it is identical
// on every replay of a seed, and it costs no draws — so adding this does not
// shift a single existing world.
//
// ---------------------------------------------------------------------------
// What it does
//
// Fit is a multiplier on the *target* somebody's popularity chases, not on
// their popularity itself. Nothing is confiscated when they sign: a name is
// still a name the week they arrive. What changes is where they end up — a
// bad fit stops climbing well short of what his matches are worth, and drifts
// down toward it if he was a star somewhere else. A good fit overshoots.
//
// Which produces the thing the business actually does: a wrestler leaves,
// goes somewhere he suits, and gets over bigger than he ever was with you.
// You do not get told it is going to happen and you do not get told why.

import { clamp } from '../rng';
import type { Promotion, WrestlingStyle, Wrestler, WorldSettings } from '../types';
import { PROMOTION_ARCHETYPES, identityOf, styleFit } from '../../data/promotionIdentity';

/**
 * The part nobody can explain, in -1..1.
 *
 * A deterministic hash of the pairing. Two wrestlers with identical stats and
 * identical styles have different chemistry with the same company, which is
 * the whole reason this is not just a formula over stats.
 */
export function chemistry(wrestlerId: string, promotionId: string): number {
  // FNV-1a over the pair. Cheap, well-mixed, and stable across engines —
  // which a save loaded on a different browser six months later depends on.
  let hash = 0x811c9dc5;
  const key = `${wrestlerId}~${promotionId}`;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // >>> 0 first: Math.imul returns signed, and a negative here would halve
  // the range and bias every pairing in the game toward one end.
  return ((hash >>> 0) / 0xffffffff) * 2 - 1;
}

/**
 * How much every company in the business, on average, wants somebody who
 * works this style.
 *
 * Fit is a *comparative* question — is this room better for him than rooms in
 * general — and without this baseline it is not. Three of the twelve styles
 * are favoured somewhere, so the raw `styleFit` reads positive on average and
 * folding it in directly made fit a quiet global buff to everybody: measured,
 * the mean across the business came out at 1.08 rather than 1.
 */
const AVERAGE_STYLE_FIT = new Map<WrestlingStyle, number>();
function averageStyleFit(style: WrestlingStyle): number {
  let mean = AVERAGE_STYLE_FIT.get(style);
  if (mean === undefined) {
    mean =
      PROMOTION_ARCHETYPES.reduce((sum, a) => sum + styleFit(identityOf(a), style), 0) /
      PROMOTION_ARCHETYPES.length;
    AVERAGE_STYLE_FIT.set(style, mean);
  }
  return mean;
}

/**
 * The half a booker can see, centred on zero.
 *
 * Two readings of the same question — does this person do the thing this
 * company sells, more than companies in general sell it?
 */
export function legibleFit(
  wrestler: Pick<Wrestler, 'style' | 'secondaryStyle' | 'skill' | 'charisma'>,
  archetype: Promotion['identity'],
  settings: WorldSettings,
): number {
  const identity = identityOf(archetype);
  const s = settings;

  // What they work, against what the average company thinks of somebody who
  // works it. A second style counts for half — it is not what they are known
  // for, but a technician who can also brawl is not lost in a brawling
  // company.
  const advantage = (style: WrestlingStyle) => styleFit(identity, style) - averageStyleFit(style);
  const primary = advantage(wrestler.style);
  const secondary = wrestler.secondaryStyle ? advantage(wrestler.secondaryStyle) * 0.5 : 0;
  const style = clamp(primary + secondary, -1, 1);

  // What the building buys tickets for. A company at 80 workrate wants the
  // best wrestler; one at 20 wants the biggest star. Somebody's own balance
  // of skill against charisma either agrees with that or fights it.
  //
  // A product rather than a distance: agreement in sign is what matters, and
  // it centres on zero for free, which a distance does not.
  const theirs = clamp((wrestler.skill - wrestler.charisma) / 50, -1, 1);
  const room = (identity.workrateVsStarPower - 50) / 50;
  const draw = theirs * room;

  return clamp(style * s.fitStyleWeight + draw * s.fitDrawWeight, -1.5, 1.5);
}

/**
 * How over this person can get *here*, as a multiplier on what their matches
 * are worth. Centred on 1.
 *
 * The spread is not large — a bad fit is a hard ceiling to work under, not an
 * impossibility, and a booker who commits to somebody the room does not want
 * can still get them over by putting them in better matches than everybody
 * else. It just costs more than it would somewhere they suited.
 */
export function promotionFit(
  wrestler: Pick<Wrestler, 'id' | 'style' | 'secondaryStyle' | 'skill' | 'charisma'>,
  promotion: Pick<Promotion, 'id' | 'identity'>,
  settings: WorldSettings,
): number {
  const s = settings;
  const legible = legibleFit(wrestler, promotion.identity, s);
  const luck = chemistry(wrestler.id, promotion.id);
  const combined = legible + luck * s.fitChemistryWeight;
  return clamp(1 + combined * s.fitSpread, s.fitFloor, s.fitCeiling);
}

/**
 * What somebody is worth to *this* crowd — the number that should be feeding
 * a gate, a television rating or a merch table, wherever a raw `popularity`
 * used to.
 *
 * A signing who does not fit does not draw what his name says he draws, and
 * that is felt in the box office before it is ever visible on his card.
 */
export function overnessIn(
  wrestler: Pick<Wrestler, 'id' | 'style' | 'secondaryStyle' | 'skill' | 'charisma' | 'popularity'>,
  promotion: Pick<Promotion, 'id' | 'identity'>,
  settings: WorldSettings,
): number {
  return clamp(wrestler.popularity * promotionFit(wrestler, promotion, settings), 0, 100);
}

/**
 * Whether somebody has more in them somewhere else — the thing a rival scout
 * notices about your midcarder.
 *
 * Reads `hype` rather than `talent`, like every other scouting read (§ hype.ts):
 * a company poaching on fit is still guessing at the ceiling.
 */
export function fitsBetterThan(
  wrestler: Pick<Wrestler, 'id' | 'style' | 'secondaryStyle' | 'skill' | 'charisma'>,
  here: Pick<Promotion, 'id' | 'identity'>,
  there: Pick<Promotion, 'id' | 'identity'>,
  settings: WorldSettings,
): boolean {
  return (
    promotionFit(wrestler, there, settings) - promotionFit(wrestler, here, settings) >=
    settings.fitPoachingGap
  );
}

export type FitRead = 'made for this place' | 'suits the house' | 'never quite fitted here' | null;

/**
 * How the room describes it, in words rather than a number (§0).
 *
 * Only speaks at the ends. Most people are a reasonable fit most places and
 * saying so every week on every card would make the one that matters
 * invisible.
 */
export function fitLabel(
  wrestler: Pick<Wrestler, 'id' | 'style' | 'secondaryStyle' | 'skill' | 'charisma'>,
  promotion: Pick<Promotion, 'id' | 'identity'>,
  settings: WorldSettings,
): FitRead {
  const fit = promotionFit(wrestler, promotion, settings);
  if (fit >= settings.fitLovedAt) return 'made for this place';
  if (fit >= settings.fitSuitsAt) return 'suits the house';
  if (fit <= settings.fitPoorAt) return 'never quite fitted here';
  return null;
}
