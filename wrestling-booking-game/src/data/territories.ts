// The map — §4, twelve territories.
//
// A territory is a market with an opinion. Capacity is how many people could
// ever care; revenueMult is what they will pay; the preference weights are
// what they want to see, and they are the reason the same card is a hit in one
// town and dies in the next.
//
// Preferences are deliberately opinionated rather than balanced. A territory
// that likes everything a little is a territory the player never thinks about.
// Every one of these has at least one thing it loves and one it will not sit
// through, so "where do we run this week" is a real question about the card
// you have built.

import type { Territory, TerritoryPreferenceTag } from '../engine/types';

export interface TerritoryDefinition {
  id: string;
  name: string;
  /** How big the market could ever get. Gates which buildings make sense. */
  capacity: number;
  /** What a ticket is worth here. */
  revenueMult: number;
  preferenceWeights: Partial<Record<TerritoryPreferenceTag, number>>;
  blurb: string;
}

export const TERRITORIES: TerritoryDefinition[] = [
  {
    id: 'millValley',
    name: 'Mill Valley',
    capacity: 2400,
    revenueMult: 0.8,
    preferenceWeights: { faces: 0.6, hardcore: 0.4, technical: -0.3, starPower: -0.2 },
    blurb: 'Steel town. They want a hero who bleeds and they can smell a phoney.',
  },
  {
    id: 'crescentPort',
    name: 'Crescent Port',
    capacity: 5200,
    revenueMult: 1.1,
    preferenceWeights: { heels: 0.5, starPower: 0.4, longMatches: -0.3 },
    blurb: 'Dock money and short tempers. The villain is the draw here.',
  },
  {
    id: 'graniteFalls',
    name: 'Granite Falls',
    capacity: 3100,
    revenueMult: 0.9,
    preferenceWeights: { technical: 0.7, longMatches: 0.5, hardcore: -0.6 },
    blurb: 'Old wrestling country. They will sit through an hour of chain wrestling and complain it was rushed.',
  },
  {
    id: 'sunKingCounty',
    name: 'Sun King County',
    capacity: 8000,
    revenueMult: 1.2,
    preferenceWeights: { starPower: 0.7, highFlying: 0.3, technical: -0.2, longMatches: -0.2 },
    blurb: 'Money, sunshine, and no patience. Give them somebody famous.',
  },
  {
    id: 'lowlandParish',
    name: 'Lowland Parish',
    capacity: 4400,
    revenueMult: 0.95,
    preferenceWeights: { hardcore: 0.8, heels: 0.3, technical: -0.4 },
    blurb: 'They came to see somebody go through a table and they will not be talked out of it.',
  },
  {
    id: 'northRidge',
    name: 'North Ridge',
    capacity: 6600,
    revenueMult: 1.05,
    preferenceWeights: { womensWrestling: 0.7, highFlying: 0.4, hardcore: -0.3 },
    blurb: 'The women’s division outdraws the men here and everybody knows it but the bookers.',
  },
  {
    id: 'ironbeltCity',
    name: 'Ironbelt City',
    capacity: 14000,
    revenueMult: 1.3,
    preferenceWeights: { starPower: 0.6, heels: 0.3, faces: 0.3, hardcore: -0.25 },
    blurb: 'The big one. Everybody wants it, almost nobody can fill it, and it thinks deathmatches are bush league.',
  },
  {
    id: 'brambleHollow',
    name: 'Bramble Hollow',
    capacity: 2000,
    revenueMult: 0.8,
    preferenceWeights: { faces: 0.7, longMatches: 0.3, starPower: -0.4, highFlying: -0.2 },
    blurb: 'Small, loyal, and suspicious of anybody with a television deal.',
  },
  {
    id: 'saltMarketPlains',
    name: 'Salt Market Plains',
    capacity: 5800,
    revenueMult: 1.0,
    preferenceWeights: { highFlying: 0.8, technical: 0.3, hardcore: -0.2 },
    blurb: 'They will forgive anything if somebody goes over the top rope.',
  },
  {
    id: 'ashfordHeights',
    name: 'Ashford Heights',
    capacity: 9500,
    revenueMult: 1.15,
    preferenceWeights: { technical: 0.5, womensWrestling: 0.4, longMatches: 0.4, starPower: -0.3 },
    blurb: 'A college town that read the newsletter and has opinions about workrate.',
  },
  {
    id: 'copperGulch',
    name: 'Copper Gulch',
    capacity: 3600,
    revenueMult: 0.85,
    preferenceWeights: { hardcore: 0.5, faces: 0.4, womensWrestling: -0.3, highFlying: -0.2 },
    blurb: 'Mining money on a Friday. Nothing subtle survives here.',
  },
  {
    id: 'harborlineMetro',
    name: 'Harborline Metro',
    capacity: 18000,
    revenueMult: 1.4,
    preferenceWeights: { starPower: 0.8, highFlying: 0.3, longMatches: -0.4, hardcore: -0.3 },
    blurb: 'The biggest building in the world and the shortest attention span.',
  },
];

export function territoryDefinitionById(id: string): TerritoryDefinition | undefined {
  return TERRITORIES.find((t) => t.id === id);
}

/** The map at the start of a save: nobody owns anything, nobody is over anywhere. */
export function createTerritories(): Territory[] {
  return TERRITORIES.map((definition) => ({
    id: definition.id,
    name: definition.name,
    capacity: definition.capacity,
    revenueMult: definition.revenueMult,
    preferenceWeights: { ...definition.preferenceWeights },
    // Filled in per promotion as shows are run. An empty map means nobody is
    // over anywhere, which is where a new promotion starts — callers read it
    // through followingOf(), which supplies the default.
    following: {},
    ownerPromotionId: null,
  }));
}
