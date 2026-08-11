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

import type { Climate, Territory, TerritoryPreferenceTag } from '../engine/types';

export interface TerritoryDefinition {
  /**
   * Where the town sits on the map, 0-100 with north at the top and the
   * coasts on the left and right edges.
   *
   * Hand-placed rather than derived. Two constraints: the position has to
   * agree with the town's `climate`, or the map and the weather system tell
   * the player different things about the same place; and the three towns of
   * a circuit have to be drivable as a loop, because that is what a circuit
   * historically was — a string of towns you could physically tour, which
   * came to share a taste precisely because the same crowds saw the same
   * shows. Taste is still what defines a circuit (see data/circuits.ts); the
   * geography is what makes it a road.
   */
  x: number;
  y: number;
  id: string;
  /** What the sky does here. Gates which weather this town can get. */
  climate: Climate;
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
    climate: 'temperate',
    x: 26,
    y: 58,
    name: 'Mill Valley',
    capacity: 2400,
    revenueMult: 0.8,
    preferenceWeights: { faces: 0.6, hardcore: 0.4, technical: -0.3, starPower: -0.2 },
    blurb: 'Steel town. They want a hero who bleeds and they can smell a phoney.',
  },
  {
    id: 'crescentPort',
    climate: 'coastal',
    x: 82,
    y: 64,
    name: 'Crescent Port',
    capacity: 5200,
    revenueMult: 1.1,
    preferenceWeights: { heels: 0.5, starPower: 0.4, longMatches: -0.3 },
    blurb: 'Dock money and short tempers. The villain is the draw here.',
  },
  {
    id: 'graniteFalls',
    climate: 'mountain',
    x: 22,
    y: 20,
    name: 'Granite Falls',
    capacity: 3100,
    revenueMult: 0.9,
    preferenceWeights: { technical: 0.7, longMatches: 0.5, hardcore: -0.6 },
    blurb: 'Old wrestling country. They will sit through an hour of chain wrestling and complain it was rushed.',
  },
  {
    id: 'sunKingCounty',
    climate: 'desert',
    x: 60,
    y: 74,
    name: 'Sun King County',
    capacity: 8000,
    revenueMult: 1.2,
    preferenceWeights: { starPower: 0.7, highFlying: 0.3, technical: -0.2, longMatches: -0.2 },
    blurb: 'Money, sunshine, and no patience. Give them somebody famous.',
  },
  {
    id: 'lowlandParish',
    climate: 'coastal',
    x: 14,
    y: 76,
    name: 'Lowland Parish',
    capacity: 4400,
    revenueMult: 0.95,
    preferenceWeights: { hardcore: 0.8, heels: 0.3, technical: -0.4 },
    blurb: 'They came to see somebody go through a table and they will not be talked out of it.',
  },
  {
    id: 'northRidge',
    climate: 'northern',
    x: 50,
    y: 12,
    name: 'North Ridge',
    capacity: 6600,
    revenueMult: 1.05,
    preferenceWeights: { womensWrestling: 0.7, highFlying: 0.4, hardcore: -0.3 },
    blurb: 'The women’s division outdraws the men here and everybody knows it but the bookers.',
  },
  {
    id: 'ironbeltCity',
    climate: 'northern',
    x: 78,
    y: 16,
    name: 'Ironbelt City',
    capacity: 26000,
    revenueMult: 1.3,
    preferenceWeights: { starPower: 0.6, heels: 0.3, faces: 0.3, hardcore: -0.25 },
    blurb: 'The big one. Everybody wants it, almost nobody can fill it, and it thinks deathmatches are bush league.',
  },
  {
    id: 'brambleHollow',
    climate: 'mountain',
    x: 34,
    y: 34,
    name: 'Bramble Hollow',
    capacity: 2000,
    revenueMult: 0.8,
    preferenceWeights: { faces: 0.7, longMatches: 0.3, starPower: -0.4, highFlying: -0.2 },
    blurb: 'Small, loyal, and suspicious of anybody with a television deal.',
  },
  {
    id: 'saltMarketPlains',
    climate: 'plains',
    x: 62,
    y: 40,
    name: 'Salt Market Plains',
    capacity: 5800,
    revenueMult: 1.0,
    preferenceWeights: { highFlying: 0.8, technical: 0.3, hardcore: -0.2 },
    blurb: 'They will forgive anything if somebody goes over the top rope.',
  },
  {
    id: 'ashfordHeights',
    climate: 'temperate',
    x: 16,
    y: 44,
    name: 'Ashford Heights',
    capacity: 9500,
    revenueMult: 1.15,
    preferenceWeights: { technical: 0.5, womensWrestling: 0.4, longMatches: 0.4, starPower: -0.3 },
    blurb: 'A college town that read the newsletter and has opinions about workrate.',
  },
  {
    id: 'copperGulch',
    climate: 'desert',
    x: 36,
    y: 86,
    name: 'Copper Gulch',
    capacity: 3600,
    revenueMult: 0.85,
    preferenceWeights: { hardcore: 0.5, faces: 0.4, womensWrestling: -0.3, highFlying: -0.2 },
    blurb: 'Mining money on a Friday. Nothing subtle survives here.',
  },
  {
    id: 'harborlineMetro',
    climate: 'coastal',
    x: 88,
    y: 42,
    name: 'Harborline Metro',
    capacity: 52000,
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
    climate: definition.climate,
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
