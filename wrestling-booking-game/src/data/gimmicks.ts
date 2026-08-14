// Gimmick catalogue, booking-game-design.md §3.4.
// Target volume is 40+ at v1 (§0 content budget); this is a starter set
// covering the examples named in the spec plus enough variety for M0 rosters.
// territoryFit is left empty here — territories don't exist until M6 data
// lands; generation treats a missing entry as neutral (0) affinity.

import type { Gimmick } from '../engine/types';

export const GIMMICKS: Gimmick[] = [
  { id: 'grizzledVeteran', name: 'Grizzled Veteran', alignmentLean: 'either', popularityCeiling: 78, growthRateMultiplier: 0.8, territoryFit: {}, merchMultiplier: 0.9, look: { attire: 'plain', palette: 'earthy', hair: 'short' } },
  { id: 'cultLeader', name: 'Cult Leader', alignmentLean: 'heel', popularityCeiling: 82, growthRateMultiplier: 1.0, territoryFit: {}, merchMultiplier: 1.1, look: { attire: 'savage', palette: 'dark', hair: 'long' } },
  { id: 'corporateStooge', name: 'Corporate Stooge', alignmentLean: 'heel', popularityCeiling: 70, growthRateMultiplier: 0.9, territoryFit: {}, merchMultiplier: 0.7, look: { attire: 'formal', palette: 'monochrome', hair: 'short' } },
  { id: 'backwoodsBrawler', name: 'Backwoods Brawler', alignmentLean: 'either', popularityCeiling: 75, growthRateMultiplier: 1.0, territoryFit: {}, merchMultiplier: 0.9, look: { attire: 'brawler', palette: 'earthy', hair: 'wild' } },
  { id: 'luchadorGimmick', name: 'Luchador', alignmentLean: 'either', popularityCeiling: 88, growthRateMultiplier: 1.15, territoryFit: {}, merchMultiplier: 1.3, look: { masked: 'required', attire: 'flashy', palette: 'bright' } },
  { id: 'richSnob', name: 'Rich Snob', alignmentLean: 'heel', popularityCeiling: 80, growthRateMultiplier: 1.0, territoryFit: {}, merchMultiplier: 1.0, look: { attire: 'formal', palette: 'gold', hair: 'short' } },
  { id: 'silentMonster', name: 'Silent Monster', alignmentLean: 'heel', popularityCeiling: 85, growthRateMultiplier: 0.85, territoryFit: {}, merchMultiplier: 1.0, look: { attire: 'savage', palette: 'dark', hair: 'bald' } },
  { id: 'partyAnimal', name: 'Party Animal', alignmentLean: 'face', popularityCeiling: 76, growthRateMultiplier: 1.1, territoryFit: {}, merchMultiplier: 1.1, look: { attire: 'brawler', palette: 'bright', hair: 'wild' } },
  { id: 'conspiracyTheorist', name: 'Conspiracy Theorist', alignmentLean: 'heel', popularityCeiling: 68, growthRateMultiplier: 0.95, territoryFit: {}, merchMultiplier: 0.8, look: { attire: 'plain', palette: 'earthy', hair: 'wild' } },
  { id: 'failedAthlete', name: 'Failed Athlete', alignmentLean: 'either', popularityCeiling: 65, growthRateMultiplier: 0.9, territoryFit: {}, merchMultiplier: 0.75, look: { attire: 'athletic', palette: 'monochrome' } },
  { id: 'prodigy', name: 'Prodigy', alignmentLean: 'face', popularityCeiling: 92, growthRateMultiplier: 1.25, territoryFit: {}, merchMultiplier: 1.2, look: { attire: 'athletic', palette: 'bright', hair: 'short' } },
  { id: 'mercenary', name: 'Mercenary', alignmentLean: 'heel', popularityCeiling: 78, growthRateMultiplier: 1.0, territoryFit: {}, merchMultiplier: 0.95, look: { attire: 'plain', palette: 'earthy', hair: 'short' } },
  { id: 'preacher', name: 'Preacher', alignmentLean: 'either', popularityCeiling: 74, growthRateMultiplier: 1.0, territoryFit: {}, merchMultiplier: 0.9, look: { attire: 'formal', palette: 'monochrome', hair: 'short' } },
  { id: 'rockstar', name: 'Rockstar', alignmentLean: 'either', popularityCeiling: 90, growthRateMultiplier: 1.2, territoryFit: {}, merchMultiplier: 1.35, look: { attire: 'flashy', palette: 'bright', hair: 'long' } },
  { id: 'biker', name: 'Biker', alignmentLean: 'either', popularityCeiling: 77, growthRateMultiplier: 1.0, territoryFit: {}, merchMultiplier: 1.0, look: { attire: 'brawler', palette: 'dark', hair: 'long' } },
  { id: 'everyman', name: 'Everyman', alignmentLean: 'face', popularityCeiling: 82, growthRateMultiplier: 1.05, territoryFit: {}, merchMultiplier: 1.0, look: { attire: 'plain', palette: 'bright', hair: 'short' } },
  { id: 'masterTactician', name: 'Master Tactician', alignmentLean: 'heel', popularityCeiling: 79, growthRateMultiplier: 0.95, territoryFit: {}, merchMultiplier: 0.85, look: { attire: 'athletic', palette: 'monochrome', hair: 'short' } },
  { id: 'hometownHero', name: 'Hometown Hero', alignmentLean: 'face', popularityCeiling: 85, growthRateMultiplier: 1.1, territoryFit: {}, merchMultiplier: 1.15, look: { attire: 'athletic', palette: 'bright' } },
  { id: 'mysteriousOutsider', name: 'Mysterious Outsider', alignmentLean: 'either', popularityCeiling: 80, growthRateMultiplier: 1.05, territoryFit: {}, merchMultiplier: 1.05, look: { masked: 'required', attire: 'plain', palette: 'dark' } },
  { id: 'streetTough', name: 'Street Tough', alignmentLean: 'either', popularityCeiling: 73, growthRateMultiplier: 0.95, territoryFit: {}, merchMultiplier: 0.9, look: { attire: 'brawler', palette: 'dark', hair: 'wild' } },
  { id: 'showbizVeteran', name: 'Showbiz Veteran', alignmentLean: 'either', popularityCeiling: 84, growthRateMultiplier: 1.05, territoryFit: {}, merchMultiplier: 1.1, look: { attire: 'flashy', palette: 'gold', hair: 'long' } },
  { id: 'militaryEnforcer', name: 'Military Enforcer', alignmentLean: 'either', popularityCeiling: 76, growthRateMultiplier: 0.9, territoryFit: {}, merchMultiplier: 0.85, look: { attire: 'plain', palette: 'earthy', hair: 'bald' } },
  { id: 'wildCard', name: 'Wild Card', alignmentLean: 'either', popularityCeiling: 81, growthRateMultiplier: 1.1, territoryFit: {}, merchMultiplier: 1.0, look: { attire: 'flashy', palette: 'bright', hair: 'wild' } },
  { id: 'aristocrat', name: 'Aristocrat', alignmentLean: 'heel', popularityCeiling: 79, growthRateMultiplier: 0.95, territoryFit: {}, merchMultiplier: 1.05, look: { attire: 'formal', palette: 'gold', hair: 'long' } },
  { id: 'undergroundLegend', name: 'Underground Legend', alignmentLean: 'either', popularityCeiling: 83, growthRateMultiplier: 1.0, territoryFit: {}, merchMultiplier: 1.0, look: { attire: 'savage', palette: 'blood', hair: 'long' } },
  { id: 'corporateOwner', name: "Owner's Favorite", alignmentLean: 'heel', popularityCeiling: 71, growthRateMultiplier: 0.9, territoryFit: {}, merchMultiplier: 0.8, look: { attire: 'formal', palette: 'gold', hair: 'short' } },
  { id: 'daredevil', name: 'Daredevil', alignmentLean: 'face', popularityCeiling: 87, growthRateMultiplier: 1.15, territoryFit: {}, merchMultiplier: 1.2, look: { masked: 'forbidden', attire: 'flashy', palette: 'bright' } },
  { id: 'iceCold', name: 'Ice Cold Professional', alignmentLean: 'either', popularityCeiling: 78, growthRateMultiplier: 0.9, territoryFit: {}, merchMultiplier: 0.9, look: { attire: 'athletic', palette: 'monochrome', hair: 'bald' } },
];

