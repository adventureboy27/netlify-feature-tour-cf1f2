// The joint show, from handshake to bell.
//
// Two things are checked here that cannot be checked anywhere else, because
// they are properties of the whole night rather than of any one function:
//
//   - §16's hard rule. The belts do not move. This used to be tested through a
//     `titleCanTravel` predicate nobody called, which proved only that a dead
//     function had an opinion; it is enforced by the card being given no
//     titles to put on the line, so the card is where it has to be tested.
//   - The card both offices signed off on is the card that gets worked. The
//     whole point of the negotiation is that the show is not re-booked behind
//     the player's back afterwards.

import { describe, expect, it } from 'vitest';
import { draftSupershow, runSupershow, type SupershowRunContext } from './supershowRun';
import { strikeMatch } from './supershowCard';
import { openingOffer } from './supershow';
import { generateWrestlers } from '../generate/wrestler';
import { defaultWorldSettings } from './settings';
import { rngFromSeed } from '../rng';
import type { Promotion, Title, Wrestler } from '../types';

const settings = defaultWorldSettings();

function company(id: string, name: string, rating: number): Promotion {
  return {
    id,
    name,
    rating,
    reputation: 50,
    bankBalance: 250_000,
    rosterIds: [],
    identity: 'territory',
    hardcoreSaturation: 0,
    bookingCredibility: 50,
  } as unknown as Promotion;
}

function roster(seed: string, prefix: string, size: number): Wrestler[] {
  return generateWrestlers(rngFromSeed(seed), size, { settings }).map((w, n) => ({
    ...w,
    id: `${prefix}${n}`,
    role: 'wrestler',
    health: 100,
    injury: null,
    leave: null,
    deceased: null,
  })) as unknown as Wrestler[];
}

/** A belt on each side, so a champion is genuinely in the pool. */
function belts(ours: Wrestler[], theirs: Wrestler[]): Title[] {
  return [
    {
      id: 'b1',
      name: 'Our Heavyweight Championship',
      promotionId: 'p1',
      currentHolderIds: [ours[0]!.id],
      prestige: 70,
      lineageProtected: false,
    },
    {
      id: 'b2',
      name: 'Their Heavyweight Championship',
      promotionId: 'p2',
      currentHolderIds: [theirs[0]!.id],
      prestige: 70,
      lineageProtected: false,
    },
  ] as unknown as Title[];
}

function context(seed: string): SupershowRunContext {
  const player = company('p1', 'Ironbelt Wrestling', 60);
  const partner = company('p2', 'Atlas Championship', 52);
  const ours = roster(`${seed}-us`, 'o', 16);
  const theirs = roster(`${seed}-them`, 't', 16);
  return {
    player,
    partner,
    deal: openingOffer(player, partner, 't1', 40, settings),
    playerRoster: ours,
    partnerRoster: theirs,
    titles: belts(ours, theirs),
    stables: [],
    territories: [],
    week: 40,
    settings,
  };
}

describe('the belts stay where they came from', () => {
  it('puts no title on the line anywhere on the joint card', () => {
    // §16 is a hard rule, not a tendency, and this is the whole reason
    // champion vs champion can be booked at all. Note the fixture: both belts
    // are `lineageProtected: false`, which is what almost every belt in the
    // game actually is — the rule cannot depend on that flag being set.
    const ctx = context('belts');
    const booking = draftSupershow(rngFromSeed('belts-draft'), ctx)!;
    expect(booking).not.toBeNull();
    const result = runSupershow(rngFromSeed('belts-run'), ctx, booking)!;
    expect(result).not.toBeNull();
    for (const match of result.show.matches) {
      expect(match.titleIds).toHaveLength(0);
      expect(match.titleOutcomes).toHaveLength(0);
    }
  });
});

describe('the card both offices signed off on', () => {
  it('is the card that gets worked', () => {
    const ctx = context('same');
    const booking = draftSupershow(rngFromSeed('same-draft'), ctx)!;
    const result = runSupershow(rngFromSeed('same-run'), ctx, booking)!;

    const agreed = booking.card.matches.map((m) => [...m.sides[0], ...m.sides[1]].sort().join('|')).sort();
    const worked = result.show.matches.map((m) => [...m.participantIds].sort().join('|')).sort();
    expect(worked).toEqual(agreed);
  });

  it('runs one fewer match for every strike past the standbys', () => {
    const ctx = context('short');
    let booking = draftSupershow(rngFromSeed('short-draft'), ctx)!;
    const agreed = booking.card.agreedSize;
    // Burn the standbys, then keep going.
    const strikes = booking.card.standbys.length + 2;
    for (let i = 0; i < strikes; i++) {
      booking = {
        ...booking,
        card: strikeMatch(booking.card, booking.card.matches[0]!.id, 'p1', 'no'),
      };
    }
    const result = runSupershow(rngFromSeed('short-run'), ctx, booking)!;
    expect(result.matchesRun).toBe(agreed - 2);
    expect(result.agreedSize).toBe(agreed);
  });

  it('draws less for a card that came up short', () => {
    const ctx = context('gate');
    const full = draftSupershow(rngFromSeed('gate-draft'), ctx)!;
    let cut = full;
    for (let i = 0; i < full.card.standbys.length + 3; i++) {
      cut = { ...cut, card: strikeMatch(cut.card, cut.card.matches[0]!.id, 'p1', 'no') };
    }
    const whole = runSupershow(rngFromSeed('gate-run'), ctx, full)!;
    const short = runSupershow(rngFromSeed('gate-run'), ctx, cut)!;
    expect(short.purse.totalGate).toBeLessThan(whole.purse.totalGate);
  });
});

describe('the money that reaches people', () => {
  it('pays everybody who worked, and the winners more', () => {
    const ctx = context('pay');
    const booking = draftSupershow(rngFromSeed('pay-draft'), ctx)!;
    const result = runSupershow(rngFromSeed('pay-run'), ctx, booking)!;

    const winners = new Set([...result.playerWinnerIds, ...result.partnerWinnerIds]);
    const paid = Object.entries(result.payouts);
    expect(paid.length).toBeGreaterThan(0);
    for (const [, amount] of paid) expect(amount).toBeGreaterThan(0);

    const won = paid.find(([id]) => winners.has(id))?.[1] ?? 0;
    const lost = paid.find(([id]) => !winners.has(id))?.[1] ?? 0;
    expect(won).toBeGreaterThan(lost);
    // But a loser still goes home paid — §16 already took his popularity.
    expect(lost).toBeGreaterThan(0);
  });

  it('says which side everybody was on', () => {
    const ctx = context('sides');
    const booking = draftSupershow(rngFromSeed('sides-draft'), ctx)!;
    const result = runSupershow(rngFromSeed('sides-run'), ctx, booking)!;
    for (const id of Object.keys(result.payouts)) {
      expect(['p1', 'p2']).toContain(result.sideOf[id]);
    }
    expect(result.playerWinnerIds.every((id) => result.sideOf[id] === 'p1')).toBe(true);
    expect(result.partnerWinnerIds.every((id) => result.sideOf[id] === 'p2')).toBe(true);
  });
});

describe('when there is nobody to put on', () => {
  it('does not draft a show a company cannot field', () => {
    const ctx = context('thin');
    const thin = { ...ctx, partnerRoster: ctx.partnerRoster.slice(0, 1) };
    expect(draftSupershow(rngFromSeed('thin'), thin)).toBeNull();
  });
});
