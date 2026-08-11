// The circuits — the towns grouped by what they want.
//
// A single global ranking is the usual thing and it is flat: everybody is
// compared to everybody, so the list is just the biggest company's roster in
// order and a territory act never appears on it. The interesting question is
// not "who is the best in the world", which nobody can settle, but "whose
// scene is this" — which is answerable, contested, and changes when you
// change what you book.
//
// So the towns are grouped by taste rather than by geography. This is not a
// map of anywhere; Bramble Hollow is not in a country. A circuit is a set of
// towns that would agree on a main event, and the whole point is that the
// circuits disagree with each other. engine/world/circuits.test.ts holds that
// as a measured property: if a change to the taste data ever collapses the
// four lists back into one, the suite fails.
//
// Membership is by what the towns actually want, cross-checked against the
// preference weights in territories.ts:
//
//   The Hard Road   hardcore +0.4..0.8, technical negative everywhere
//   Old Country     technical and long matches up, star power down
//   The Big Rooms   star power +0.4..0.8, hardcore negative
//   The High Wire   high-flying up in all three, hardcore down

import type { Id } from '../engine/types';

export interface CircuitDefinition {
  id: Id;
  name: string;
  /** One line, for the head of a ranking list. */
  blurb: string;
  /** What this scene will not forgive — the reason it is a separate list. */
  hardSell: string;
  territoryIds: Id[];
}

export const CIRCUITS: CircuitDefinition[] = [
  {
    id: 'hardRoad',
    name: 'The Hard Road',
    blurb: 'Steel towns, mining money and a table nobody talked them out of.',
    hardSell: 'They can smell a phoney, and chain wrestling empties the room.',
    territoryIds: ['millValley', 'lowlandParish', 'copperGulch'],
  },
  {
    id: 'oldCountry',
    name: 'Old Country',
    blurb: 'Wrestling country. They will sit through an hour and call it rushed.',
    hardSell: 'A television deal is a strike against you until proven otherwise.',
    territoryIds: ['graniteFalls', 'ashfordHeights', 'brambleHollow'],
  },
  {
    id: 'bigRooms',
    name: 'The Big Rooms',
    blurb: 'The buildings everybody wants and almost nobody can fill.',
    hardSell: 'Bring somebody famous or bring nothing. Deathmatches are bush league here.',
    territoryIds: ['harborlineMetro', 'ironbeltCity', 'crescentPort'],
  },
  {
    id: 'highWire',
    name: 'The High Wire',
    blurb: 'They forgive anything if somebody goes over the top rope.',
    hardSell: 'Ground-bound and heavy does not draw a dollar on this loop.',
    territoryIds: ['saltMarketPlains', 'northRidge', 'sunKingCounty'],
  },
];

export function circuitById(id: Id): CircuitDefinition | undefined {
  return CIRCUITS.find((c) => c.id === id);
}

/** Which scene a town belongs to. Every town is on exactly one circuit. */
export function circuitForTerritory(territoryId: Id): CircuitDefinition | undefined {
  return CIRCUITS.find((c) => c.territoryIds.includes(territoryId));
}
