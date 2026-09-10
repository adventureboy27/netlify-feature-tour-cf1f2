// Who somebody's people are — and who they cannot stand.
//
// career/relationships.ts stores the web: undirected pairs, each with a type
// and a strength. What it never had was a *person's own view* of that web.
// Every tie was equal, none of them ever moved, and nothing in the game ever
// asked "who is this man closest to".
//
// Three things follow from that, and this module is all three.
//
// ---------------------------------------------------------------------------
// The list is ranked, and it is short
//
// Nobody has thirty friends in a locker room. They have one or two they travel
// with, a few more they get on with, and one man they will not be in a room
// with. So a circle is the strongest few ties of each kind — up to
// `circleMax`, and often fewer, because a list padded to five with people
// somebody barely knows is not a list.
//
// Ranked rather than a set, because rank is what makes the rest of it mean
// anything: the difference between your best friend leaving and an
// acquaintance leaving is the whole point.
//
// Derived from strength rather than stored separately. Two sources of truth
// for "are these two close" is a bug with a delay on it.
//
// ---------------------------------------------------------------------------
// The list changes
//
// Before this, relationships were seeded at world creation and frozen for
// thirty years. Two men who worked two hundred matches together were exactly
// as close in year eight as the day the save started, and a friendship could
// never end.
//
// Now ties strengthen by working and fade by absence, at rates a decade apart
// — you make a friend over a year on the road and you lose one over five years
// of not seeing them. A friendship that fades far enough stops being one; a
// feud that goes badly enough stops being worked.
//
// ---------------------------------------------------------------------------
// And it costs something when somebody goes
//
// §0: nothing happens to a person off-screen. A wrestler's closest friend
// dying is a thing that happened to *him*, not only to the man who died — and
// until now the memorial wall recorded the death and the locker room did not
// notice. It costs morale, scaled by where the dead man ranked, and it is
// reported.
//
// An enemy dying is not a good week either. Nobody in a locker room celebrates
// it, and modelling it as a morale gain would be both wrong and slightly
// grotesque. It reads as unfinished business instead.

import { clamp } from '../rng';
import type { Id, Relationship, Wrestler, WorldSettings } from '../types';
import { isAlly, isEnemy, otherParty, relationshipsFor } from './relationships';

export interface Tie {
  /** The other person. */
  wrestlerId: Id;
  relationship: Relationship;
  /** 1 is closest, or worst. */
  rank: number;
}

export interface Circle {
  friends: Tie[];
  enemies: Tie[];
}

/**
 * Rank the ties of one kind, strongest first, capped.
 *
 * Sorted by strength and then by id — never by array order, because the order
 * relationships happen to sit in is not a fact about anybody, and a list that
 * reshuffles when an unrelated pair is added is not a ranking.
 */
function ranked(
  ties: readonly Relationship[],
  wrestlerId: Id,
  floor: number,
  cap: number,
): Tie[] {
  return [...ties]
    .filter((r) => r.strength >= floor)
    .sort((a, b) => b.strength - a.strength || relationshipKeyOf(a).localeCompare(relationshipKeyOf(b)))
    .slice(0, cap)
    .map((relationship, i) => ({
      wrestlerId: otherParty(relationship, wrestlerId),
      relationship,
      rank: i + 1,
    }));
}

function relationshipKeyOf(r: Relationship): string {
  return [r.aId, r.bId].sort().join('~');
}

/**
 * Somebody's people, both kinds, ranked.
 *
 * A tie has to be worth something to make the list — `circleFloor` — so a
 * wrestler who genuinely has nobody has an empty list rather than a
 * best friend he has met twice.
 */
export function circleOf(
  relationships: readonly Relationship[],
  wrestlerId: Id,
  settings: WorldSettings,
): Circle {
  const mine = relationshipsFor(relationships, wrestlerId);
  return {
    friends: ranked(mine.filter(isAlly), wrestlerId, settings.circleFloor, settings.circleMax),
    enemies: ranked(mine.filter(isEnemy), wrestlerId, settings.circleFloor, settings.circleMax),
  };
}

/** The one person they would call first. Null when there is nobody. */
export function closestFriend(
  relationships: readonly Relationship[],
  wrestlerId: Id,
  settings: WorldSettings,
): Tie | null {
  return circleOf(relationships, wrestlerId, settings).friends[0] ?? null;
}

/** The one they will not be in a room with. */
export function worstEnemy(
  relationships: readonly Relationship[],
  wrestlerId: Id,
  settings: WorldSettings,
): Tie | null {
  return circleOf(relationships, wrestlerId, settings).enemies[0] ?? null;
}

/** Where somebody sits on another person's list, if they are on it at all. */
export function rankOn(
  relationships: readonly Relationship[],
  ownerId: Id,
  otherId: Id,
  settings: WorldSettings,
): { kind: 'friend' | 'enemy'; rank: number } | null {
  const circle = circleOf(relationships, ownerId, settings);
  const friend = circle.friends.find((t) => t.wrestlerId === otherId);
  if (friend) return { kind: 'friend', rank: friend.rank };
  const enemy = circle.enemies.find((t) => t.wrestlerId === otherId);
  if (enemy) return { kind: 'enemy', rank: enemy.rank };
  return null;
}

// ---------------------------------------------------------------------------
// Lists change

export interface TieWeek {
  /** They were on the same card. */
  sharedACard: boolean;
  /** They were in the same match — the thing that actually builds a bond. */
  workedTogether: boolean;
  /** Whether either of them is still employed anywhere. */
  bothWorking: boolean;
}

/**
 * What a week does to one tie.
 *
 * Deliberately lopsided. A bond is built by working — a year of being in each
 * other's matches is what makes two people close — and lost by nothing
 * happening, at a rate slow enough that a friendship survives a bad run and a
 * feud survives a quiet year. Measured in the tests: about a year on the road
 * to make a friend, about five years apart to lose one.
 */
export function tieDrift(week: TieWeek, settings: WorldSettings): number {
  const s = settings;
  if (week.workedTogether) return s.circleGainWorked;
  if (week.sharedACard) return s.circleGainSharedCard;
  // People who have both left the business stop drifting apart — there is no
  // road to lose each other on any more.
  if (!week.bothWorking) return 0;
  return -s.circleFadePerWeek;
}

/**
 * A tie that has faded past the point of being one.
 *
 * A friendship that decays to nothing is not a lifelong friendship at low
 * strength, it is two people who lost touch — and a feud nobody has fed in
 * five years is not a feud. Returning null means the relationship should be
 * dropped entirely rather than kept at zero.
 */
export function hasLapsed(relationship: Relationship, settings: WorldSettings): boolean {
  // Blood and marriage do not lapse. You can stop speaking to your brother;
  // he is still your brother, and the roster screen should still say so.
  const permanent = ['sibling', 'parentChild', 'married', 'divorced', 'exPartner'];
  if (permanent.includes(relationship.type)) return false;
  return relationship.strength < settings.circleLapseAt;
}

// ---------------------------------------------------------------------------
// When somebody goes

export interface Bereavement {
  wrestlerId: Id;
  /** Morale, always negative. */
  moraleDelta: number;
  /** What it did to them, in their words. */
  note: string;
}

/**
 * What a death does to the people who knew him.
 *
 * Scaled by rank, so losing the man you travelled with for ten years is not
 * the same as losing somebody you got on with. Only people who had him on a
 * list feel it — a locker room of two hundred does not grieve as one.
 */
export function bereavements(
  deceased: Wrestler,
  everybody: readonly Wrestler[],
  relationships: readonly Relationship[],
  settings: WorldSettings,
): Bereavement[] {
  const s = settings;
  const out: Bereavement[] = [];

  for (const person of everybody) {
    if (person.id === deceased.id || person.deceased) continue;
    const place = rankOn(relationships, person.id, deceased.id, s);
    if (!place) continue;

    // First on the list takes the full weight; further down takes less.
    const weight = 1 / place.rank;

    if (place.kind === 'friend') {
      out.push({
        wrestlerId: person.id,
        moraleDelta: -s.circleGriefFriend * weight,
        note:
          place.rank === 1
            ? `${person.name} has not said much since ${deceased.name} died. They travelled together for years.`
            : `${person.name} took the news about ${deceased.name} badly.`,
      });
    } else {
      // Nobody celebrates. It reads as something left unsettled instead.
      out.push({
        wrestlerId: person.id,
        moraleDelta: -s.circleGriefEnemy * weight,
        note: `${person.name} and ${deceased.name} never made it up, and now they never will.`,
      });
    }
  }

  return out;
}

/** How the paper says who is taking it hardest. */
export function mourningLine(mourners: readonly Bereavement[]): string | null {
  if (mourners.length === 0) return null;
  const worst = [...mourners].sort((a, b) => a.moraleDelta - b.moraleDelta)[0]!;
  return `${worst.note} The locker room is quiet this week.`;
}

// ---------------------------------------------------------------------------
// Saying it

export function circleSummary(
  circle: Circle,
  nameOf: (id: Id) => string | undefined,
): string | null {
  const friends = circle.friends.map((t) => nameOf(t.wrestlerId)).filter(Boolean);
  const enemies = circle.enemies.map((t) => nameOf(t.wrestlerId)).filter(Boolean);
  if (friends.length === 0 && enemies.length === 0) return null;

  const parts: string[] = [];
  if (friends.length > 0) parts.push(`Travels with ${friends.join(', ')}`);
  if (enemies.length > 0) parts.push(`Will not work with ${enemies.join(', ')}`);
  return parts.join('. ');
}

/** How close a tie is, in words rather than a number (§0). */
export function tieStrengthLabel(relationship: Relationship, settings: WorldSettings): string {
  const s = settings;
  const close = relationship.strength >= s.circleThickAt;
  if (isEnemy(relationship)) return close ? 'Real bad blood' : 'No love lost';
  return close ? 'Inseparable' : 'Friendly';
}

/** Clamp helper used by the store when applying drift. */
export function applyDrift(relationship: Relationship, delta: number): number {
  return clamp(relationship.strength + delta, 0, 100);
}
