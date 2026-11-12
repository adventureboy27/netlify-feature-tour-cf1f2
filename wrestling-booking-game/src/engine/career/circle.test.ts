// The rule this file holds: a locker room is people with a short list of
// people, the list moves, and it costs something when a name comes off it.

import { describe, expect, it } from 'vitest';
import { defaultWorldSettings } from '../world/settings';
import { rngFromSeed } from '../rng';
import { generateWrestler } from '../generate/wrestler';
import type { Relationship, RelationshipType, Wrestler } from '../types';
import {
  applyDrift,
  bereavements,
  circleOf,
  circleSummary,
  closestFriend,
  hasLapsed,
  mourningLine,
  rankOn,
  tieDrift,
  tieStrengthLabel,
  worstEnemy,
} from './circle';

const settings = defaultWorldSettings();

function person(seed: string, over: Partial<Wrestler> = {}): Wrestler {
  return { ...generateWrestler(rngFromSeed(seed), new Set(), { currentYear: 2030 }), ...over };
}

function tie(aId: string, bId: string, type: RelationshipType, strength: number): Relationship {
  return { aId, bId, type, strength, history: [] };
}

describe('a short, ranked list', () => {
  it('puts the strongest tie first', () => {
    const web = [
      tie('me', 'a', 'friend', 40),
      tie('me', 'b', 'friend', 90),
      tie('me', 'c', 'friend', 65),
    ];
    expect(circleOf(web, 'me', settings).friends.map((t) => t.wrestlerId)).toEqual(['b', 'c', 'a']);
    expect(closestFriend(web, 'me', settings)!.wrestlerId).toBe('b');
  });

  it('keeps friends and enemies on separate lists', () => {
    const web = [tie('me', 'a', 'friend', 80), tie('me', 'b', 'enemy', 95)];
    const circle = circleOf(web, 'me', settings);
    expect(circle.friends.map((t) => t.wrestlerId)).toEqual(['a']);
    expect(circle.enemies.map((t) => t.wrestlerId)).toEqual(['b']);
    expect(worstEnemy(web, 'me', settings)!.wrestlerId).toBe('b');
  });

  it('never keeps more than there are places for', () => {
    const web = Array.from({ length: 12 }, (_, i) => tie('me', `f-${i}`, 'friend', 40 + i));
    expect(circleOf(web, 'me', settings).friends).toHaveLength(settings.circleMax);
  });

  it('does not pad the list with people they barely know', () => {
    // Five places is a place for five, not a quota. Most wrestlers have one or
    // two, and a list padded out with acquaintances is not a list.
    const web = [tie('me', 'a', 'friend', 85), tie('me', 'b', 'friend', settings.circleFloor - 1)];
    expect(circleOf(web, 'me', settings).friends).toHaveLength(1);
  });

  it('lets somebody have nobody at all', () => {
    expect(circleOf([], 'lonely', settings)).toEqual({ friends: [], enemies: [] });
    expect(closestFriend([], 'lonely', settings)).toBeNull();
  });

  it('reads the same list from either end of the pair', () => {
    // Relationships are undirected, so if he is on my list I am on his.
    const web = [tie('me', 'you', 'friend', 88)];
    expect(rankOn(web, 'me', 'you', settings)).toEqual({ kind: 'friend', rank: 1 });
    expect(rankOn(web, 'you', 'me', settings)).toEqual({ kind: 'friend', rank: 1 });
  });

  it('does not reshuffle when an unrelated pair is added', () => {
    // Rank has to be a fact about the person, not about array order.
    const web = [tie('me', 'a', 'friend', 70), tie('me', 'b', 'friend', 70)];
    const before = circleOf(web, 'me', settings).friends.map((t) => t.wrestlerId);
    const after = circleOf([tie('x', 'y', 'friend', 99), ...web], 'me', settings).friends.map(
      (t) => t.wrestlerId,
    );
    expect(after).toEqual(before);
  });

  it('says who somebody is not on a list with at all', () => {
    expect(rankOn([tie('me', 'a', 'friend', 80)], 'me', 'stranger', settings)).toBeNull();
  });
});

describe('the list changes', () => {
  it('takes about a year in each other’s matches to make a friend', () => {
    // Not a week, and not a decade. A bond is built by working.
    let strength = 0;
    let weeks = 0;
    while (strength < settings.circleThickAt && weeks < 500) {
      strength = applyDrift(tie('a', 'b', 'friend', strength), tieDrift({ sharedACard: true, workedTogether: true, bothWorking: true }, settings));
      weeks += 1;
    }
    expect(weeks).toBeGreaterThan(40);
    expect(weeks).toBeLessThan(110);
  });

  it('takes years apart to lose one, so a friendship survives a bad run', () => {
    let strength = settings.circleThickAt;
    let weeks = 0;
    while (strength >= settings.circleFloor && weeks < 2000) {
      strength = applyDrift(tie('a', 'b', 'friend', strength), tieDrift({ sharedACard: false, workedTogether: false, bothWorking: true }, settings));
      weeks += 1;
    }
    expect(weeks).toBeGreaterThan(156);
  });

  it('builds faster than it fades, or nobody would ever be close to anybody', () => {
    const gain = tieDrift({ sharedACard: true, workedTogether: true, bothWorking: true }, settings);
    const fade = tieDrift({ sharedACard: false, workedTogether: false, bothWorking: true }, settings);
    expect(gain).toBeGreaterThan(Math.abs(fade) * 5);
  });

  it('counts being in the match for more than being on the card', () => {
    const inIt = tieDrift({ sharedACard: true, workedTogether: true, bothWorking: true }, settings);
    const nearIt = tieDrift({ sharedACard: true, workedTogether: false, bothWorking: true }, settings);
    expect(inIt).toBeGreaterThan(nearIt);
    expect(nearIt).toBeGreaterThan(0);
  });

  it('stops two retired men drifting apart, because there is no road left', () => {
    expect(tieDrift({ sharedACard: false, workedTogether: false, bothWorking: false }, settings)).toBe(0);
  });

  it('lets a friendship lapse entirely rather than sit at nothing', () => {
    expect(hasLapsed(tie('a', 'b', 'friend', 2), settings)).toBe(true);
    expect(hasLapsed(tie('a', 'b', 'friend', 60), settings)).toBe(false);
  });

  it('never lets blood or marriage lapse', () => {
    // You can stop speaking to your brother. He is still your brother.
    for (const type of ['sibling', 'parentChild', 'married', 'divorced', 'exPartner'] as const) {
      expect(hasLapsed(tie('a', 'b', type, 0), settings)).toBe(false);
    }
  });

  it('never drives a tie outside its range', () => {
    expect(applyDrift(tie('a', 'b', 'friend', 100), 50)).toBe(100);
    expect(applyDrift(tie('a', 'b', 'friend', 0), -50)).toBe(0);
  });
});

describe('when somebody goes', () => {
  const dead = person('dead', { name: 'Earl Mercer' });
  const mate = person('mate', { name: 'Duke Rawlins' });
  const distant = person('distant', { name: 'Kip Mabry' });
  const foe = person('foe', { name: 'Vance Cutler' });
  const stranger = person('stranger', { name: 'Nobody Atall' });
  const everybody = [mate, distant, foe, stranger];

  const web = [
    // The dead man is first on his travelling partner's list...
    tie(mate.id, dead.id, 'friend', 95),
    // ...and second on this one's, behind somebody who is still alive. That
    // gap is what the first test is measuring, so the two lists must not
    // share a tie — an earlier version of this fixture put `mate` on
    // `distant`'s list, which quietly made the dead man rank second on both.
    tie(distant.id, dead.id, 'friend', 95),
    tie(distant.id, stranger.id, 'friend', 99),
    tie(foe.id, dead.id, 'enemy', 90),
  ];

  it('costs the man who travelled with him the most', () => {
    const felt = bereavements(dead, everybody, web, settings);
    const his = felt.find((b) => b.wrestlerId === mate.id)!;
    const theirs = felt.find((b) => b.wrestlerId === distant.id)!;
    expect(his.moraleDelta).toBeLessThan(theirs.moraleDelta);
  });

  it('costs everybody who had him on a list, and nobody who did not', () => {
    const felt = bereavements(dead, everybody, web, settings);
    expect(felt.map((b) => b.wrestlerId).sort()).toEqual([distant.id, foe.id, mate.id].sort());
  });

  it('is never a good week, even for the man who hated him', () => {
    // Nobody in a locker room celebrates a death, and modelling it as a
    // morale gain would be both wrong and slightly grotesque.
    const felt = bereavements(dead, everybody, web, settings);
    for (const b of felt) expect(b.moraleDelta).toBeLessThan(0);
    const enemy = felt.find((b) => b.wrestlerId === foe.id)!;
    const friend = felt.find((b) => b.wrestlerId === mate.id)!;
    expect(enemy.moraleDelta).toBeGreaterThan(friend.moraleDelta);
    expect(enemy.note).toContain('never made it up');
  });

  it('says whose week it was, by name', () => {
    // §0: a death is a thing that happened to the people left as well.
    const felt = bereavements(dead, everybody, web, settings);
    const line = mourningLine(felt)!;
    expect(line).toContain(mate.name);
    expect(line).toContain(dead.name);
  });

  it('says nothing at all when nobody knew him', () => {
    expect(bereavements(dead, [stranger], [], settings)).toEqual([]);
    expect(mourningLine([])).toBeNull();
  });

  it('does not grieve a man who is already dead', () => {
    const alsoGone: Wrestler = {
      ...mate,
      deceased: { wrestlerId: mate.id, week: 40, age: 58, cause: 'heart' },
    };
    const felt = bereavements(dead, [alsoGone], web, settings);
    expect(felt).toEqual([]);
  });
});

describe('what the roster card says', () => {
  it('names the people rather than scoring them', () => {
    const web = [tie('me', 'a', 'friend', 90), tie('me', 'b', 'enemy', 80)];
    const names: Record<string, string> = { a: 'Duke Rawlins', b: 'Vance Cutler' };
    const line = circleSummary(circleOf(web, 'me', settings), (id) => names[id])!;
    expect(line).toContain('Duke Rawlins');
    expect(line).toContain('Vance Cutler');
    expect(line).not.toMatch(/\d/);
  });

  it('says nothing about somebody with nobody', () => {
    expect(circleSummary({ friends: [], enemies: [] }, () => 'x')).toBeNull();
  });

  it('describes how close it is in words, never a number', () => {
    for (const strength of [20, 50, 95]) {
      for (const type of ['friend', 'enemy'] as const) {
        expect(tieStrengthLabel(tie('a', 'b', type, strength), settings)).not.toMatch(/\d/);
      }
    }
    expect(tieStrengthLabel(tie('a', 'b', 'friend', 95), settings)).toBe('Inseparable');
    expect(tieStrengthLabel(tie('a', 'b', 'enemy', 95), settings)).toBe('Real bad blood');
  });
});
