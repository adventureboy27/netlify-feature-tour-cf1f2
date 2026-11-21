// §16's other negotiation: both offices approve every match.
//
// The rules a booker would notice being broken: a strike does not leave a hole
// while there is anything left to fill it with, it does leave one once there
// is not, the other office refuses the two things §16 says it refuses, and
// nobody's name is against a match they did not put up.

import { describe, expect, it } from 'vitest';
import { defaultWorldSettings } from './settings';
import {
  cardStatusLine,
  draftJointCard,
  finalCard,
  partnerApproval,
  partnerObjection,
  proposedByLine,
  strikeMatch,
  type JointCard,
} from './supershowCard';
import type { RivalCard } from './rivalBooking';
import type { Id, Promotion, Wrestler } from '../types';

const settings = defaultWorldSettings();
const US = 'p1';
const THEM = 'p2';

function partner(): Promotion {
  return { id: THEM, name: 'Atlas', rating: 50 } as Promotion;
}

function man(id: Id, name: string, popularity: number): Wrestler {
  return { id, name, popularity } as Wrestler;
}

/**
 * A card in the shape the booker hands back: opener first, main event last.
 * Ours are o1..oN, theirs t1..tN, paired across so every match is genuinely
 * cross-promotional — which is what the joint pool produces in practice.
 */
function bookedCard(pairs: number): { card: RivalCard; sideOf: Record<Id, Id>; people: Wrestler[] } {
  const people: Wrestler[] = [];
  const sideOf: Record<Id, Id> = {};
  const matches = [];
  for (let i = 0; i < pairs; i++) {
    // Standing rises up the sheet, so the main event is the two biggest names.
    const ours = man(`o${i}`, `Ours ${i}`, 30 + i * 5);
    const theirs = man(`t${i}`, `Theirs ${i}`, 30 + i * 5);
    people.push(ours, theirs);
    sideOf[ours.id] = US;
    sideOf[theirs.id] = THEM;
    matches.push({ sides: [[ours], [theirs]] as [Wrestler[], Wrestler[]] });
  }
  return { card: { matches }, sideOf, people };
}

function draft(pairs: number, agreedSize: number, playerSegments = Math.floor(agreedSize / 2)) {
  const { card, sideOf, people } = bookedCard(pairs);
  const joint = draftJointCard(card, {
    playerId: US,
    partnerId: THEM,
    hostPromotionId: US,
    playerSegments,
    agreedSize,
    sideOf,
  });
  return { joint, sideOf, people };
}

describe('the sheet that comes back', () => {
  it('runs the agreed number of matches and keeps the rest in reserve', () => {
    const { joint } = draft(11, 8);
    expect(joint.matches).toHaveLength(8);
    expect(joint.standbys).toHaveLength(3);
    expect(joint.agreedSize).toBe(8);
  });

  it('keeps the main event on the card and puts the openers on standby', () => {
    // The booker hands back a running order bottom-up. Taking the surplus off
    // the top of that list is what makes a strike cost something: what comes
    // up is an opener, not the match everybody wanted.
    const { joint } = draft(11, 8);
    const main = joint.matches[joint.matches.length - 1]!;
    expect(main.sides[0][0]).toBe('o10');
    expect(joint.standbys.every((m) => Number(m.sides[0][0]!.slice(1)) < 3)).toBe(true);
  });

  it('gives each office the number of segments the deal agreed', () => {
    const { joint } = draft(11, 8, 5);
    const ours = joint.matches.filter((m) => m.proposedBy === US);
    expect(ours).toHaveLength(5);
    expect(joint.matches.filter((m) => m.proposedBy === THEM)).toHaveLength(3);
  });

  it('gives the main event to whoever is hosting', () => {
    const { card, sideOf } = bookedCard(9);
    const away = draftJointCard(card, {
      playerId: US,
      partnerId: THEM,
      hostPromotionId: THEM,
      playerSegments: 4,
      agreedSize: 8,
      sideOf,
    });
    expect(away.matches[away.matches.length - 1]!.proposedBy).toBe(THEM);
  });

  it('says whose call each one was, in words', () => {
    const { joint } = draft(11, 8);
    const ours = joint.matches.find((m) => m.proposedBy === US)!;
    const theirs = joint.matches.find((m) => m.proposedBy === THEM)!;
    expect(proposedByLine(ours, US, 'Atlas')).toBe('Your call');
    expect(proposedByLine(theirs, US, 'Atlas')).toContain('Atlas');
  });
});

describe('striking a match', () => {
  it('backfills from the standbys and keeps the card the agreed length', () => {
    const { joint } = draft(11, 8);
    const target = joint.matches[3]!.id;
    const after = strikeMatch(joint, target, US, 'no');
    expect(after.matches).toHaveLength(8);
    expect(after.standbys).toHaveLength(2);
    expect(after.matches.some((m) => m.id === target)).toBe(false);
  });

  it('leaves the running order alone — the replacement goes in the same slot', () => {
    const { joint } = draft(11, 8);
    const mainBefore = joint.matches[joint.matches.length - 1]!.id;
    const after = strikeMatch(joint, joint.matches[2]!.id, US, 'no');
    expect(after.matches[after.matches.length - 1]!.id).toBe(mainBefore);
  });

  it('shortens the card once there is nothing left to come up', () => {
    // The cost, and the only one. A booker who could strike his way to a
    // better card for free would strike everything.
    let card: JointCard = draft(11, 8).joint;
    for (let i = 0; i < 4; i++) card = strikeMatch(card, card.matches[0]!.id, US, 'no');
    expect(card.standbys).toHaveLength(0);
    expect(card.matches).toHaveLength(7);
    expect(card.matches.length).toBeLessThan(card.agreedSize);
  });

  it('keeps what was struck, and why, rather than losing it', () => {
    // Nothing happens off-screen: a match missing from the sheet says who took
    // it off and what they said about it.
    const { joint } = draft(11, 8);
    const after = strikeMatch(joint, joint.matches[1]!.id, THEM, 'Atlas will not run it.');
    expect(after.struck).toHaveLength(1);
    expect(after.struck[0]!.struckBy).toBe(THEM);
    expect(after.struck[0]!.because).toBe('Atlas will not run it.');
  });

  it('ignores a match that is not on the card', () => {
    const { joint } = draft(11, 8);
    expect(strikeMatch(joint, 'nonsense', US, 'no')).toBe(joint);
  });

  it('is what the show actually runs', () => {
    const { joint } = draft(11, 8);
    expect(finalCard(joint)).toBe(joint.matches);
  });
});

describe('what the other office will not do', () => {
  const { joint, sideOf, people } = draft(11, 8, 8);
  const byId = new Map(people.map((w) => [w.id, w]));
  const base = {
    playerId: US,
    partner: partner(),
    mood: 'cautious' as const,
    championVsChampion: true,
    wrestler: (id: Id) => byId.get(id),
    sideOf,
    championIds: new Set<Id>(),
    settings,
  };

  it('takes a match between two people of roughly equal standing', () => {
    const even = joint.matches.find((m) => m.sides[0][0] === 'o5')!;
    expect(partnerObjection(even, base)).toBeNull();
  });

  it('will not send its man out to be squashed', () => {
    // §16: "it will reject pairings where its champion is badly outmatched."
    const lopsided = {
      ...joint.matches[0]!,
      sides: [['o10'], ['t0']] as [Id[], Id[]],
    };
    const said = partnerObjection(lopsided, base);
    expect(said).toContain('Atlas');
    expect(said).toContain('Theirs 0');
  });

  it('swallows a wider gap when it badly wants to be on the show', () => {
    const lopsided = { ...joint.matches[0]!, sides: [['o7'], ['t3']] as [Id[], Id[]] };
    expect(partnerObjection(lopsided, base)).not.toBeNull();
    expect(partnerObjection(lopsided, { ...base, mood: 'eager' })).toBeNull();
  });

  it('keeps its champion off a card that negotiated champion-vs-champion out', () => {
    // The term the deal already agreed, enforced where it actually bites.
    const withChamp = { ...joint.matches[4]!, sides: [['o5'], ['t5']] as [Id[], Id[]] };
    const ctx = { ...base, championVsChampion: false, championIds: new Set(['t5']) };
    expect(partnerObjection(withChamp, ctx)).toContain('Theirs 5');
    expect(partnerObjection(withChamp, base)).toBeNull();
  });

  it('has no view on a match with none of its people in it', () => {
    const oursOnly = { ...joint.matches[0]!, sides: [['o1'], ['o2']] as [Id[], Id[]] };
    expect(partnerObjection(oursOnly, base)).toBeNull();
  });
});

describe('their pass over the sheet', () => {
  it('strikes what it objects to and backfills the same as anybody else', () => {
    const { joint, sideOf, people } = draft(11, 8, 8);
    const byId = new Map(people.map((w) => [w.id, w]));
    // Every match is ours to propose, and one of them is a squash.
    const rigged: JointCard = {
      ...joint,
      matches: joint.matches.map((m, i) =>
        i === 0 ? { ...m, sides: [['o10'], ['t0']] as [Id[], Id[]] } : m,
      ),
    };
    const after = partnerApproval(rigged, {
      playerId: US,
      partner: partner(),
      mood: 'cautious',
      championVsChampion: true,
      wrestler: (id) => byId.get(id),
      sideOf,
      championIds: new Set(),
      settings,
    });
    expect(after.struck).toHaveLength(1);
    expect(after.struck[0]!.struckBy).toBe(THEM);
    expect(after.matches).toHaveLength(8);
  });

  it('never strikes its own proposals — it has obviously already agreed to those', () => {
    const { joint, sideOf, people } = draft(11, 8, 0);
    const byId = new Map(people.map((w) => [w.id, w]));
    const rigged: JointCard = {
      ...joint,
      matches: joint.matches.map((m) => ({ ...m, sides: [['o10'], ['t0']] as [Id[], Id[]] })),
    };
    const after = partnerApproval(rigged, {
      playerId: US,
      partner: partner(),
      mood: 'cautious',
      championVsChampion: true,
      wrestler: (id) => byId.get(id),
      sideOf,
      championIds: new Set(),
      settings,
    });
    expect(after.struck).toHaveLength(0);
  });
});

describe('what the panel says about the sheet', () => {
  it('gives the count and what is left in reserve', () => {
    const { joint } = draft(11, 8);
    expect(cardStatusLine(joint)).toContain('8 matches');
    expect(cardStatusLine(joint)).toContain('3 pairings');
  });

  it('says the card is short, and does not tell the booker to stop', () => {
    // §0: the game never warns before a bad decision. The count is a fact.
    let card: JointCard = draft(11, 8).joint;
    for (let i = 0; i < 4; i++) card = strikeMatch(card, card.matches[0]!.id, US, 'no');
    const said = cardStatusLine(card);
    expect(said).toContain('7 matches against 8 agreed');
    expect(said.toLowerCase()).not.toMatch(/should|careful|warning|risk/);
  });
});
