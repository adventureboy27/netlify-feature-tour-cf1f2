// Production — the things a promotion buys once and hauls to every show, and
// the things it pays for again every single time.
//
// The split is the whole point. A big screen is bought once and travels with
// you forever, so it is a genuine capital decision: an enormous cheque now
// against a small edge on every show for the rest of the save. Pyro is bought
// once (the rig) and then again every time you fire it (the charges). A venue
// is only ever rented.
//
// Nothing here is cheap relative to where the player starts. That is
// deliberate — the first twenty weeks should be spent unable to afford almost
// all of it.

import type { ProductionAsset, ShowExtra } from '../engine/types';

// ---------------------------------------------------------------- one-time
// Bought once, travels to every show, small upkeep to keep it working.

export const PRODUCTION_ASSETS: ProductionAsset[] = [
  {
    id: 'ringUpgrade',
    name: 'Professional Ring',
    cost: 32000,
    upkeepPerShow: 120,
    blurb: 'A real ring instead of the one that arrived on a trailer.',
    effects: { showRating: 3, injuryReduction: 0.12 },
  },
  {
    id: 'soundSystem',
    name: 'Touring Sound System',
    cost: 24000,
    upkeepPerShow: 90,
    blurb: 'Entrance music that does not sound like a phone in a bucket.',
    effects: { showRating: 2, attendanceMultiplier: 1.02 },
  },
  {
    id: 'lightingRig',
    name: 'Lighting Rig',
    cost: 55000,
    upkeepPerShow: 180,
    blurb: 'The difference between a show and a gym with the lights on.',
    effects: { showRating: 4, tvRating: 0.15 },
  },
  {
    id: 'entranceStage',
    name: 'Entrance Stage & Ramp',
    cost: 95000,
    upkeepPerShow: 300,
    blurb: 'Somewhere to come out of. Makes everybody look bigger.',
    effects: { showRating: 5, attendanceMultiplier: 1.04 },
    minVenueCapacity: 900,
  },
  {
    id: 'bigScreen',
    name: 'Big Screen',
    cost: 180000,
    upkeepPerShow: 650,
    blurb: 'Video wall behind the stage. Travels, once you own it.',
    effects: { showRating: 7, attendanceMultiplier: 1.06, tvRating: 0.3, merchMultiplier: 1.05 },
    minVenueCapacity: 1600,
  },
  {
    id: 'pyroRig',
    name: 'Pyro Rig',
    cost: 68000,
    upkeepPerShow: 200,
    blurb: 'The rig itself. The charges are extra, every single time.',
    effects: { showRating: 2 },
    minVenueCapacity: 900,
  },
  {
    id: 'productionTruck',
    name: 'Production Truck & Crew',
    cost: 260000,
    upkeepPerShow: 1400,
    blurb: 'Multi-camera, replays, a director. This is what television looks like.',
    effects: { showRating: 6, tvRating: 0.8 },
  },
  {
    id: 'merchTruck',
    name: 'Merchandise Trailer',
    cost: 38000,
    upkeepPerShow: 150,
    blurb: 'A proper stand instead of a card table by the door.',
    effects: { merchMultiplier: 1.35 },
  },
  {
    id: 'steelBarricades',
    name: 'Steel Barricades',
    cost: 14000,
    upkeepPerShow: 60,
    blurb: 'Keeps the front row in the front row.',
    effects: { showRating: 1, incidentReduction: 0.25 },
  },
  {
    id: 'trainingFacility',
    name: 'Training Facility',
    cost: 130000,
    upkeepPerShow: 400,
    blurb: 'Somewhere for the young talent to actually learn.',
    effects: { injuryReduction: 0.1, talentGrowth: 0.2 },
    // The school, not show-night gear — stays out of the fire sale even
    // during a genuine emergency. See engine/economy/fireSale.ts.
    fireSaleEligible: false,
  },
];

export function productionAssetById(id: string): ProductionAsset | undefined {
  return PRODUCTION_ASSETS.find((a) => a.id === id);
}

// ------------------------------------------------------------- per-show
// Chosen fresh for every show, paid for every time.

export const SHOW_EXTRAS: ShowExtra[] = [
  {
    id: 'pyroCharges',
    name: 'Pyro Charges',
    cost: 3200,
    blurb: 'Fired on entrances and the finish. Gone by the end of the night.',
    requiresAsset: 'pyroRig',
    effects: { showRating: 4, attendanceMultiplier: 1.03 },
  },
  {
    id: 'advertisingLocal',
    name: 'Local Advertising',
    cost: 1800,
    blurb: 'Radio spots, posters in shop windows.',
    effects: { attendanceMultiplier: 1.12 },
  },
  {
    id: 'advertisingRegional',
    name: 'Regional Advertising',
    cost: 9000,
    blurb: 'Television buys across the whole territory.',
    effects: { attendanceMultiplier: 1.3, tvRating: 0.1 },
  },
  {
    id: 'autographSigning',
    name: 'Autograph Signing',
    cost: 900,
    blurb: 'Pre-show meet and greet. The talent works a longer day.',
    effects: { merchMultiplier: 1.25, attendanceMultiplier: 1.05, rosterFatigue: 4 },
  },
  {
    id: 'meetAndGreet',
    name: 'Premium Meet & Greet',
    cost: 2200,
    blurb: 'Ticketed photo package with the top of the card.',
    effects: { merchMultiplier: 1.4, revenuePerHead: 3, rosterFatigue: 7 },
  },
  {
    id: 'security',
    name: 'Professional Security',
    cost: 1600,
    blurb: 'Trained staff instead of whoever was available.',
    effects: { incidentReduction: 0.4 },
  },
  {
    id: 'medicalStaff',
    name: 'Ringside Medical Team',
    cost: 1200,
    blurb: 'A doctor and two paramedics who are actually paying attention.',
    effects: { injuryReduction: 0.3 },
  },
  {
    id: 'catering',
    name: 'Proper Catering',
    cost: 1100,
    blurb: 'Feed the locker room and they notice.',
    effects: { rosterMorale: 4 },
  },
  {
    id: 'liveBand',
    name: 'Live Band',
    cost: 4500,
    blurb: 'Entrances played live. Expensive and completely unnecessary.',
    effects: { showRating: 3, attendanceMultiplier: 1.04 },
  },
  {
    id: 'guestTalent',
    name: 'Guest Talent from Another Promotion',
    cost: 12000,
    blurb: 'A name from outside on a one-night deal.',
    effects: { showRating: 5, attendanceMultiplier: 1.18, tvRating: 0.25, reputation: -2 },
  },
  {
    id: 'streamingProduction',
    name: 'Streaming Production',
    cost: 5500,
    blurb: 'Puts the show online for anyone who is not in the building.',
    effects: { revenuePerHead: 2, tvRating: 0.2 },
  },
  {
    id: 'charityTieIn',
    name: 'Charity Tie-In',
    cost: 2500,
    blurb: 'A local cause on the poster. Good will, thinner margins.',
    effects: { reputation: 5, attendanceMultiplier: 1.06, revenuePerHead: -1 },
  },
];

export function showExtraById(id: string): ShowExtra | undefined {
  return SHOW_EXTRAS.find((e) => e.id === id);
}

/** Extras the promotion can actually run, given what it owns. */
export function availableExtras(ownedAssetIds: readonly string[]): ShowExtra[] {
  return SHOW_EXTRAS.filter((e) => !e.requiresAsset || ownedAssetIds.includes(e.requiresAsset));
}
