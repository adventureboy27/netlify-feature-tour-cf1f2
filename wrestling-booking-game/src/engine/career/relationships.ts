// Who gets on with whom — §18.
//
// A locker room is not thirty independent contractors; it is a web of people
// who travel together, trained together, or cannot stand each other. It
// matters on the roster screen (you should be able to see at a glance that
// your champion hates your challenger) and it matters in the sim: friends
// work better together, enemies work stiffer.
//
// Relationships are undirected — if A is B's friend, B is A's friend — so
// everything here normalises the pair before storing or looking up.

import type { Rng } from '../rng';
import { chance, pick, randInt } from '../rng';
import type { Id, Wrestler, Relationship, RelationshipType, WorldSettings } from '../types';

/** Order-independent key for a pair. */
function relationshipKey(a: Id, b: Id): string {
  return [a, b].sort().join('~');
}

export function findRelationship(
  relationships: readonly Relationship[],
  a: Id,
  b: Id,
): Relationship | undefined {
  const key = relationshipKey(a, b);
  return relationships.find((r) => relationshipKey(r.aId, r.bId) === key);
}

/** Everyone this wrestler has any kind of history with. */
export function relationshipsFor(relationships: readonly Relationship[], wrestlerId: Id): Relationship[] {
  return relationships.filter((r) => r.aId === wrestlerId || r.bId === wrestlerId);
}

/** The other person in a relationship. */
export function otherParty(relationship: Relationship, wrestlerId: Id): Id {
  return relationship.aId === wrestlerId ? relationship.bId : relationship.aId;
}

const POSITIVE: RelationshipType[] = ['friend', 'mentor', 'protege', 'sibling', 'parentChild', 'married', 'dating'];
const NEGATIVE: RelationshipType[] = ['enemy', 'divorced', 'exPartner'];

export function isAlly(relationship: Relationship): boolean {
  return POSITIVE.includes(relationship.type);
}

export function isEnemy(relationship: Relationship): boolean {
  return NEGATIVE.includes(relationship.type);
}

export const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  friend: 'Friend',
  enemy: 'Enemy',
  mentor: 'Mentor',
  protege: 'Protégé',
  sibling: 'Sibling',
  parentChild: 'Family',
  married: 'Married',
  dating: 'Together',
  divorced: 'Divorced',
  exPartner: 'Ex-partner',
};

/**
 * Seed a locker room's history.
 *
 * Weighted toward friendships and mentorships, because most people in a
 * business get along and the ones who do not are the interesting exception.
 * Age gaps produce mentor/protégé pairs; contemporaries produce friends and
 * enemies.
 */
export function seedRelationships(rng: Rng, roster: readonly Wrestler[], settings: WorldSettings): Relationship[] {
  const relationships: Relationship[] = [];
  const seen = new Set<string>();

  const target = Math.round(roster.length * settings.relationshipsPerWrestler);

  for (let attempt = 0; attempt < target * 6 && relationships.length < target; attempt++) {
    const a = pick(rng, roster as Wrestler[]);
    const b = pick(rng, roster as Wrestler[]);
    if (a.id === b.id) continue;

    const key = relationshipKey(a.id, b.id);
    if (seen.has(key)) continue;

    const ageGap = Math.abs(a.age - b.age);
    let type: RelationshipType;

    if (ageGap >= 12 && chance(rng, 0.55)) {
      // The older one taught the younger one. Stored from A's perspective.
      type = a.age > b.age ? 'mentor' : 'protege';
    } else if (chance(rng, settings.relationshipEnemyChance)) {
      type = 'enemy';
    } else if (chance(rng, 0.12)) {
      type = pick(rng, ['sibling', 'married', 'dating', 'exPartner'] as RelationshipType[]);
    } else {
      type = 'friend';
    }

    seen.add(key);
    relationships.push({
      aId: a.id,
      bId: b.id,
      type,
      strength: randInt(rng, 35, 95),
      history: [],
    });
  }

  return relationships;
}

/**
 * A tie that formed because two people kept being put in the same ring.
 *
 * `seedRelationships` runs once, on the starting roster, and that was the only
 * place a relationship had ever come from. Measured on a played save: 21 ties,
 * frozen, covering 23 of 155 people — everybody who debuted after week one had
 * no friends and no enemies for their whole career, the ranked circles were
 * dead weight for 85% of the business, and the seeded ties decayed (64 -> 59
 * average strength over two years) toward lapsing entirely.
 *
 * Mirrors the rivalry rule the game already has (§12.5 route 3: repeat matches
 * make a feud on their own). The difference is what each one models — a
 * rivalry is the feud the crowd sees, this is what the two of them actually
 * think of each other. Partners become friends; opponents who keep being fed
 * each other become enemies. Both then move on the ordinary circle drift.
 */
export function rollNewTie(
  rng: Rng,
  a: Wrestler,
  b: Wrestler,
  sameSide: boolean,
  meetings: number,
  existing: readonly Relationship[],
  settings: WorldSettings,
): Relationship | null {
  if (a.id === b.id) return null;
  if (meetings < settings.tieFormMinMeetings) return null;
  if (findRelationship(existing, a.id, b.id)) return null;

  // Blood and marriage aside, nobody carries an unlimited number of these.
  // The circle is capped, and a full circle is a person whose life is already
  // full rather than one who cannot meet anybody new.
  const full = (id: Id) => relationshipsFor(existing, id).length >= settings.circleMax;
  if (full(a.id) || full(b.id)) return null;

  if (!chance(rng, settings.tieFormChancePerMeeting)) return null;

  // Working with somebody is not the same as hating them. Treating every
  // opponent pairing as an enemy produced 140 enemies to 20 friends over two
  // years, which is not a locker room, it is a riot. Opponents roll enmity at
  // the same rate the seeded ties use and otherwise come out of it friendly —
  // people who can trust each other out there tend to like each other.
  // Partners never come out of it enemies; that is what a split is for.
  const ageGap = Math.abs(a.age - b.age);
  const hostile = !sameSide && chance(rng, settings.relationshipEnemyChance);
  const type: RelationshipType = hostile
    ? 'enemy'
    : ageGap >= settings.tieFormMentorAgeGap
      ? a.age > b.age
        ? 'mentor'
        : 'protege'
      : 'friend';

  return {
    aId: a.id,
    bId: b.id,
    type,
    strength: randInt(rng, settings.tieFormStartMin, settings.tieFormStartMax),
    history: [],
  };
}

/**
 * What a pair's history does to a match between them.
 *
 * Friends have chemistry and protect each other; enemies work stiff, which is
 * more compelling to watch and more likely to hurt somebody. Both are real
 * booking information, which is why the roster screen shows them.
 */
export interface RelationshipMatchEffect {
  ratingBonus: number;
  injuryMultiplier: number;
}

export function relationshipMatchEffect(
  relationship: Relationship | undefined,
  settings: WorldSettings,
): RelationshipMatchEffect {
  if (!relationship) return { ratingBonus: 0, injuryMultiplier: 1 };

  const intensity = relationship.strength / 100;

  if (isAlly(relationship)) {
    return {
      ratingBonus: intensity * settings.relationshipAllyRatingBonus,
      injuryMultiplier: 1 - intensity * settings.relationshipAllyInjuryReduction,
    };
  }

  if (isEnemy(relationship)) {
    return {
      ratingBonus: intensity * settings.relationshipEnemyRatingBonus,
      injuryMultiplier: 1 + intensity * settings.relationshipEnemyInjuryIncrease,
    };
  }

  return { ratingBonus: 0, injuryMultiplier: 1 };
}

/** Would these two refuse to work together at all? */
export function refusesToWorkWith(relationship: Relationship | undefined, settings: WorldSettings): boolean {
  return Boolean(relationship && isEnemy(relationship) && relationship.strength >= settings.relationshipRefusalThreshold);
}
