// What the audience wants to see.
//
// The fan layer only ever looked backwards: tweets about the show that had
// already happened, which is a reaction and not a signal. A crowd that can
// only tell you how the last one went is a crowd you cannot book toward.
//
// This is the other half — the standing wishlist. It is entirely derived from
// world state, the same discipline as the scouting read and the defence
// watch: nothing new is stored, so a demand can never be stale, and it moves
// on its own as the world moves. Book the thing they are asking for and it
// pays; ignore it long enough and the asking turns into resentment.
//
// The most interesting entry is the one about somebody else's roster. A
// wrestler with more talent than position in a rival company is exactly what
// an audience notices and complains about, and it is exactly what a secret
// signing is for — so the wishlist is where that angle starts, rather than
// the player having to guess who would be worth taking.

import type { BookingMemory } from '../sim/freshness';
import { defenceStatus } from './titleDefence';
import type { Id, Rivalry, Title, Wrestler, WorldSettings } from '../types';

export type DemandKind =
  /** Two names who have never met and both of whom matter. */
  | 'dreamMatch'
  /** Somebody hot who has not been given a shot at anything. */
  | 'titleShot'
  /** That was great; do it again. */
  | 'rematch'
  /** He is wasted where he is. The secret-signing hook. */
  | 'wastedElsewhere'
  /** Enough of him. */
  | 'enoughOfHim'
  /** That belt has not been on the line in months. */
  | 'defendIt'
  /** Over with the crowd and stuck in the opener. */
  | 'pushThem';

export interface FanDemand {
  id: string;
  kind: DemandKind;
  /** Who it is about. One or two people. */
  wrestlerIds: Id[];
  /** The belt, when it is about one. */
  titleId?: Id;
  /** 0-100. How loudly they are asking. */
  heat: number;
  /** What they are saying, in their words. */
  text: string;
  /**
   * Set only when the person the crowd wants is both somewhere else *and*
   * close enough to the end of his deal to be gettable. This is the bridge to
   * world/secretSigning.ts — the audience naming somebody is how the booker
   * finds out who is worth taking, and the flag is what says the crowd's
   * complaint is currently actionable rather than merely true.
   */
  signableFrom?: Id;
}

export interface DemandContext {
  /** Everybody in the business. */
  wrestlers: readonly Wrestler[];
  playerRosterIds: readonly Id[];
  titles: readonly Title[];
  rivalries: readonly Rivalry[];
  /** What has actually been booked lately. */
  memory: BookingMemory;
  currentWeek: number;
  playerPromotionId: Id;
  settings: WorldSettings;
}

function pairKey(a: Id, b: Id): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Everything the audience is currently asking for, loudest first.
 *
 * Capped, because a wishlist of forty things is a wishlist nobody reads. The
 * point is the three or four they are actually shouting about.
 */
export function fanDemands(ctx: DemandContext): FanDemand[] {
  const s = ctx.settings;
  const byId = new Map(ctx.wrestlers.map((w) => [w.id, w]));
  const mine = ctx.playerRosterIds.map((id) => byId.get(id)).filter((w): w is Wrestler => Boolean(w));
  const available = (w: Wrestler) => !w.deceased && w.careerStatus !== 'retired' && w.role === 'wrestler';
  const demands: FanDemand[] = [];

  // --- The match they have never been given -----------------------------
  const stars = mine
    .filter((w) => available(w) && w.popularity >= s.demandDreamMatchPopularity)
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 8);
  for (let i = 0; i < stars.length; i++) {
    for (let j = i + 1; j < stars.length; j++) {
      const a = stars[i]!;
      const b = stars[j]!;
      if ((ctx.memory.pairings.get(pairKey(a.id, b.id)) ?? 0) > 0) continue;
      demands.push({
        id: `dream-${pairKey(a.id, b.id)}`,
        kind: 'dreamMatch',
        wrestlerIds: [a.id, b.id],
        heat: Math.min(100, (a.popularity + b.popularity) / 2),
        text: `${a.name} against ${b.name}. It has never happened and nobody can explain why.`,
      });
    }
  }

  // --- Somebody else's roster -------------------------------------------
  // The audience notices a good hand being wasted somewhere else long before
  // a booker does, and saying so is how the player finds out who to take.
  for (const w of ctx.wrestlers) {
    if (!available(w)) continue;
    if (w.promotionId === null || w.promotionId === ctx.playerPromotionId) continue;
    // The fans' view, which is a view rather than the truth.
    const wasted = w.hype - w.popularity;
    if (wasted < s.demandWastedGap) continue;
    // The crowd complains about a man being misused whether or not he is
    // available; the flag is the separate question of whether anything can be
    // done about it this year. A deal with a year left is not gettable at any
    // price, so pointing the player at the quiet business would be a lie.
    const gettable = (w.contract?.weeksRemaining ?? 0) > 0 &&
      (w.contract?.weeksRemaining ?? 0) <= s.secretSigningWindowWeeks;
    demands.push({
      id: `wasted-${w.id}`,
      kind: 'wastedElsewhere',
      wrestlerIds: [w.id],
      heat: Math.min(100, wasted + w.hype / 3),
      text: `${w.name} is being wasted, and everybody can see it except the people doing the booking.`,
      ...(gettable ? { signableFrom: w.promotionId } : {}),
    });
  }

  // --- The shot nobody has given them ------------------------------------
  const championIds = new Set(
    ctx.titles.filter((t) => !t.vacant).flatMap((t) => t.currentHolderIds),
  );
  for (const w of mine) {
    if (!available(w) || championIds.has(w.id)) continue;
    if (w.momentum < s.demandTitleShotMomentum) continue;
    // A vacant belt counts. "He is the hottest thing here and that title is
    // sitting in a bag" is exactly when a crowd shouts loudest.
    const belt = ctx.titles.find(
      (t) =>
        t.promotionId === ctx.playerPromotionId &&
        !t.retiredWeek &&
        (t.division === 'open' || (t.division === 'womens' ? w.gender === 'f' : w.gender === 'm')),
    );
    if (!belt) continue;
    demands.push({
      id: `shot-${w.id}`,
      kind: 'titleShot',
      wrestlerIds: [w.id],
      titleId: belt.id,
      heat: w.momentum,
      text: `${w.name} has beaten everybody put in front of them. Give them the ${belt.name}.`,
    });
  }

  // --- Do that again ------------------------------------------------------
  for (const rivalry of ctx.rivalries) {
    if (rivalry.resolvedWeek !== null) continue;
    if (rivalry.heat < s.demandRematchHeat) continue;
    const [a, b] = rivalry.participantIds.map((id) => byId.get(id));
    if (!a || !b || !available(a) || !available(b)) continue;
    if (!ctx.playerRosterIds.includes(a.id) && !ctx.playerRosterIds.includes(b.id)) continue;
    demands.push({
      id: `rematch-${rivalry.id}`,
      kind: 'rematch',
      wrestlerIds: [a.id, b.id],
      heat: rivalry.heat,
      text: `${a.name} and ${b.name} have unfinished business and the building knows it.`,
    });
  }

  // --- Enough of him ------------------------------------------------------
  for (const w of mine) {
    const seen = ctx.memory.weeksSeen.get(w.id) ?? 0;
    if (seen < s.demandOverexposedWeeks) continue;
    demands.push({
      id: `enough-${w.id}`,
      kind: 'enoughOfHim',
      wrestlerIds: [w.id],
      heat: Math.min(100, seen * s.demandOverexposedHeatPerWeek),
      text: `${w.name} has been on every single show. People have started leaving to get a drink.`,
    });
  }

  // --- Put it on the line -------------------------------------------------
  for (const title of ctx.titles) {
    if (title.promotionId !== ctx.playerPromotionId || title.vacant || title.retiredWeek) continue;
    const status = defenceStatus(title, ctx.currentWeek, ctx.settings);
    if (status !== 'due' && status !== 'finalWarning') continue;
    demands.push({
      id: `defend-${title.id}`,
      kind: 'defendIt',
      wrestlerIds: [...title.currentHolderIds],
      titleId: title.id,
      heat: status === 'finalWarning' ? 80 : 55,
      text: `Nobody has challenged for the ${title.name} in months. What is it for?`,
    });
  }

  // --- The one stuck in the opener ---------------------------------------
  for (const w of mine) {
    if (!available(w) || championIds.has(w.id)) continue;
    if (w.popularity < s.demandPushPopularity) continue;
    if (w.popularity >= w.careerHighPopularity - 1 && w.momentum >= s.demandTitleShotMomentum) continue;
    if (w.hype - w.popularity < s.demandPushGap) continue;
    demands.push({
      id: `push-${w.id}`,
      kind: 'pushThem',
      wrestlerIds: [w.id],
      heat: Math.min(100, w.popularity),
      text: `${w.name} gets the biggest reaction on the show and goes on first. Somebody explain that.`,
    });
  }

  // Variety, not a leaderboard.
  //
  // A flat sort by heat hands the whole board to whichever kind scores
  // highest — measured, that was six dream matches on week one, because a
  // roster of eight stars produces twenty-eight pairs and every one of them
  // outscores everything else. Worse, it buried the entry about somebody
  // else's roster, so the secret-signing hook never once surfaced. Capping
  // per kind first is what makes this a wishlist rather than a ranking.
  const perKind = new Map<DemandKind, FanDemand[]>();
  for (const demand of [...demands].sort((a, b) => b.heat - a.heat)) {
    const bucket = perKind.get(demand.kind) ?? [];
    if (bucket.length >= s.demandPerKindCap) continue;
    bucket.push(demand);
    perKind.set(demand.kind, bucket);
  }

  return [...perKind.values()]
    .flat()
    .sort((a, b) => b.heat - a.heat)
    .slice(0, s.demandBoardSize);
}

/**
 * Which of tonight's demands the card actually answered.
 *
 * Checked against what was booked rather than against what happened, because
 * the crowd asked for a match and not for a result — giving them the match
 * and having it go badly is a different failure from never giving it to them.
 */
export function demandsDelivered(
  demands: readonly FanDemand[],
  booked: readonly { participantIds: Id[]; titleIds: Id[] }[],
): FanDemand[] {
  return demands.filter((demand) => {
    switch (demand.kind) {
      case 'dreamMatch':
      case 'rematch':
        return booked.some((match) => demand.wrestlerIds.every((id) => match.participantIds.includes(id)));
      case 'titleShot':
        return booked.some(
          (match) =>
            match.participantIds.includes(demand.wrestlerIds[0]!) &&
            (!demand.titleId || match.titleIds.includes(demand.titleId)),
        );
      case 'defendIt':
        return booked.some((match) => demand.titleId && match.titleIds.includes(demand.titleId));
      case 'pushThem':
        // Answered by putting them somewhere that matters, which the caller
        // signals by only passing the top of the card.
        return booked.some((match) => match.participantIds.includes(demand.wrestlerIds[0]!));
      case 'enoughOfHim':
        // The one you answer by *not* doing it.
        return !booked.some((match) => match.participantIds.includes(demand.wrestlerIds[0]!));
      case 'wastedElsewhere':
        return booked.some((match) => match.participantIds.includes(demand.wrestlerIds[0]!));
      default:
        return false;
    }
  });
}

/** What giving them what they asked for is worth to the show. */
export function deliveryBonus(delivered: readonly FanDemand[], settings: WorldSettings): number {
  return delivered.reduce(
    (sum, demand) => sum + (demand.heat / 100) * settings.demandDeliveryRatingBonus,
    0,
  );
}

/** Somebody the audience is asking for who works for a competitor. */
export function signingOpportunities(demands: readonly FanDemand[]): FanDemand[] {
  return demands.filter((d) => d.signableFrom !== undefined);
}
