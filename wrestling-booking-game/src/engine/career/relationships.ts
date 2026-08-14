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
export function relationshipKey(a: Id, b: Id): string {
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
