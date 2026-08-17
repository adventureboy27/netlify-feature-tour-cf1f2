// Both must approve every match (§16).
//
// The deal is the money. This is the card, and it is a separate negotiation,
// because the terms of a joint show say nothing about who actually walks
// through the curtain opposite whom.
//
// §16's table has a row that never got built: "Named matches — each side
// proposes pairings — both must approve every match." Without it, signing the
// deal ran the show, which meant the biggest night of the year was one button
// and no decisions. With it, signing the deal produces a running order with
// both companies' names against it, and then two bookers argue about it.
//
// What makes it a decision rather than a rubber stamp:
//
//   - Striking a match does not leave a hole. A standby comes up off the
//     bottom of the sheet, and the standbys are the weakest pairings drafted,
//     so every strike trades a match you did not want for a match nobody
//     wanted very much.
//   - There are only so many standbys. Past that the card is simply shorter,
//     and a shorter card is a smaller gate — see `cardSizeMultiplier`.
//   - The other booker strikes too, and he strikes first. He is protecting his
//     champion and he is not sending anybody out to be embarrassed, which is
//     exactly what you are doing when you strike one of his.
//
// §0 applies throughout: this panel states who is in what and who put it up.
// It does not tell the player that a pairing is dangerous, and it does not ask
// anybody to confirm that they meant it.

import type { CoopMood } from './supershow';
import type { RivalCard } from './rivalBooking';
import type { Id, Promotion, Wrestler, WorldSettings } from '../types';

/** One pairing on the joint card, before anybody has agreed to it. */
export interface ProposedMatch {
  /** Stable across strikes and promotions, so the UI can address one row. */
  id: string;
  /** Wrestler ids, by side. */
  sides: [Id[], Id[]];
  /** Which company put this pairing up. */
  proposedBy: Id;
  /** The company that struck it, once somebody has. */
  struckBy: Id | null;
  /** Why, in the striker's words. Null while the match is live. */
  because: string | null;
}

export interface JointCard {
  partnerId: Id;
  /** What the deal said the card would be. The gate is priced off this. */
  agreedSize: number;
  /** The running order, opener first. */
  matches: ProposedMatch[];
  /** What comes up when something is struck. Weakest first. */
  standbys: ProposedMatch[];
  /** Everything either side has killed, kept so the panel can say so. */
  struck: ProposedMatch[];
}

// ---------------------------------------------------------------- drafting

export interface DraftContext {
  playerId: Id;
  partnerId: Id;
  hostPromotionId: Id;
  /** From the deal: how many of the segments the player's office books. */
  playerSegments: number;
  agreedSize: number;
  /** Which company each competitor belongs to. */
  sideOf: Record<Id, Id>;
}

/**
 * Turn a booked card into a proposal sheet.
 *
 * The booker hands back a running order bottom-up, main event last, so the
 * matches over the agreed size come off the *bottom* — the standbys are the
 * openers nobody would have led with, which is what makes a strike cost
 * something rather than shuffle the deck for free.
 *
 * Who proposed what is settled by the segment allocation the deal already
 * agreed, not by a roll. The host takes the main event — it is his building
 * and his crowd goes home on whatever closes it — and the rest alternates down
 * the sheet until each side's count is used up.
 */
export function draftJointCard(card: RivalCard, ctx: DraftContext): JointCard {
  const drafted: ProposedMatch[] = card.matches.map((match, index) => ({
    id: `js${index}`,
    sides: [match.sides[0].map((w) => w.id), match.sides[1].map((w) => w.id)] as [Id[], Id[]],
    proposedBy: ctx.playerId,
    struckBy: null,
    because: null,
  }));

  const spare = Math.max(0, drafted.length - ctx.agreedSize);
  const standbys = drafted.slice(0, spare);
  const matches = drafted.slice(spare);

  // The allocation. Main event to the host, then alternate downward, and
  // whichever side runs out of segments first stops being offered any.
  let oursLeft = Math.max(0, Math.min(ctx.playerSegments, matches.length));
  let theirsLeft = matches.length - oursLeft;
  const order = [...matches].reverse(); // main event first
  let ourTurn = ctx.hostPromotionId === ctx.playerId;
  for (const match of order) {
    const canBeOurs = oursLeft > 0;
    const canBeTheirs = theirsLeft > 0;
    const ours = canBeOurs && (ourTurn || !canBeTheirs);
    match.proposedBy = ours ? ctx.playerId : ctx.partnerId;
    if (ours) oursLeft -= 1;
    else theirsLeft -= 1;
    ourTurn = !ourTurn;
  }
  // A standby carries the proposer of the match it replaces, so leave them on
  // the side that drafted the bottom of the sheet: the host's office.
  for (const standby of standbys) standby.proposedBy = ctx.hostPromotionId;

  return {
    partnerId: ctx.partnerId,
    agreedSize: ctx.agreedSize,
    matches,
    standbys,
    struck: [],
  };
}

// ---------------------------------------------------------------- striking

/**
 * Kill a pairing and backfill it.
 *
 * The strongest remaining standby comes up into the struck slot, so the
 * running order keeps its shape. When there is nothing left to come up the
 * card is one segment shorter, permanently — nothing regenerates it, because
 * a booker who could strike his way to a better card for free would strike
 * everything.
 */
export function strikeMatch(card: JointCard, matchId: string, by: Id, because: string): JointCard {
  const index = card.matches.findIndex((m) => m.id === matchId);
  if (index < 0) return card;

  const killed: ProposedMatch = { ...card.matches[index]!, struckBy: by, because };
  const standbys = [...card.standbys];
  const replacement = standbys.pop() ?? null;

  const matches = [...card.matches];
  if (replacement) matches[index] = replacement;
  else matches.splice(index, 1);

  return { ...card, matches, standbys, struck: [...card.struck, killed] };
}

/** What the card actually is, once both offices have had their say. */
export function finalCard(card: JointCard): ProposedMatch[] {
  return card.matches;
}

// ---------------------------------------------------------------- their say

export interface ApprovalContext {
  playerId: Id;
  partner: Promotion;
  mood: CoopMood;
  /** Whether the deal permits champion-vs-champion at all. */
  championVsChampion: boolean;
  wrestler: (id: Id) => Wrestler | undefined;
  sideOf: Record<Id, Id>;
  /** The partner's champions. A belt is what he is protecting. */
  championIds: ReadonlySet<Id>;
  settings: WorldSettings;
}

/** Standing, for the purpose of "would this look like a squash". */
function standingOf(w: Wrestler | undefined): number {
  return w ? w.popularity : 0;
}

function theirBest(match: ProposedMatch, ctx: ApprovalContext): Wrestler | undefined {
  return match.sides
    .flat()
    .filter((id) => ctx.sideOf[id] === ctx.partner.id)
    .map((id) => ctx.wrestler(id))
    .filter((w): w is Wrestler => Boolean(w))
    .sort((a, b) => standingOf(b) - standingOf(a))[0];
}

function ourBest(match: ProposedMatch, ctx: ApprovalContext): Wrestler | undefined {
  return match.sides
    .flat()
    .filter((id) => ctx.sideOf[id] === ctx.playerId)
    .map((id) => ctx.wrestler(id))
    .filter((w): w is Wrestler => Boolean(w))
    .sort((a, b) => standingOf(b) - standingOf(a))[0];
}

/**
 * Why the other booker will not do this one, or null if he will.
 *
 * Two reasons, and they are the two §16 gives him. He protects the belt — a
 * cautious partner negotiated champion-vs-champion out of the deal and this is
 * where that term is actually enforced. And he does not send anybody out to be
 * beaten in front of both audiences, which is the same instinct the player is
 * about to exercise on his card.
 */
export function partnerObjection(match: ProposedMatch, ctx: ApprovalContext): string | null {
  const mine = theirBest(match, ctx);
  const yours = ourBest(match, ctx);
  // Nothing of theirs in it, or nothing of yours: not their business.
  if (!mine || !yours) return null;

  const championIn = match.sides.flat().some((id) => ctx.championIds.has(id));
  if (championIn && !ctx.championVsChampion) {
    return `${ctx.partner.name} want ${mine.name} kept out of it. Their champion is not on this card.`;
  }

  const gap = standingOf(yours) - standingOf(mine);
  const tolerance =
    ctx.mood === 'eager'
      ? ctx.settings.supershowOutmatchedGap * ctx.settings.supershowEagerTolerance
      : ctx.settings.supershowOutmatchedGap;
  if (gap >= tolerance) {
    return `${ctx.partner.name} will not send ${mine.name} out against ${yours.name}.`;
  }

  return null;
}

/**
 * Their office goes through your proposals before you see the sheet.
 *
 * Deliberately only their pass over *your* matches: the ones they proposed
 * they have obviously already approved, and the point of showing the player a
 * card with strikes already on it is that the negotiation has visibly started
 * without them.
 */
export function partnerApproval(card: JointCard, ctx: ApprovalContext): JointCard {
  let out = card;
  // Snapshot the ids first — striking rebuilds the list under us.
  const theirs = card.matches.filter((m) => m.proposedBy === ctx.playerId).map((m) => m.id);
  for (const id of theirs) {
    const match = out.matches.find((m) => m.id === id);
    if (!match) continue;
    const objection = partnerObjection(match, ctx);
    if (objection) out = strikeMatch(out, id, ctx.partner.id, objection);
  }
  return out;
}

// ---------------------------------------------------------------- read-out

/** Who put this up, said the way the panel says it. */
export function proposedByLine(match: ProposedMatch, playerId: Id, partnerName: string): string {
  return match.proposedBy === playerId ? 'Your call' : `${partnerName}'s call`;
}

/**
 * How the sheet stands, in one line.
 *
 * States the count against the agreed count and stops there — a card that has
 * shrunk is a smaller gate and the player is entitled to know the number, but
 * §0 does not let this line tell them to stop striking.
 */
export function cardStatusLine(card: JointCard): string {
  const short = card.agreedSize - card.matches.length;
  const spare = card.standbys.length;
  if (short > 0) {
    return `${card.matches.length} matches against ${card.agreedSize} agreed. Nothing left to fill the gaps with.`;
  }
  return `${card.matches.length} matches. ${spare} ${spare === 1 ? 'pairing' : 'pairings'} on standby.`;
}
