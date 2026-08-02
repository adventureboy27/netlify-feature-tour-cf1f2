// Archetype stat-bias table, booking-game-design.md §3 "Archetypes".
// Stat biases are additive modifiers applied after the base tier roll (§6).

import type { ArchetypeDefinition } from '../engine/types';

export const ARCHETYPES: ArchetypeDefinition[] = [
  {
    id: 'powerhouse',
    name: 'Powerhouse',
    statModifiers: { strength: 18, skill: -6, agility: -14, stamina: 4 },
    favoredStipulations: ['hardcore', 'lastManStanding'],
    notes: 'Poor in long time limits.',
  },
  {
    id: 'technician',
    name: 'Technician',
    statModifiers: { strength: -6, skill: 20, agility: 0, stamina: 6 },
    favoredStipulations: ['submissionMatch', 'ironMan', 'sixtyMinute'],
    notes: 'Best long-match performer.',
  },
  {
    id: 'highFlyer',
    name: 'High Flyer',
    statModifiers: { strength: -12, skill: 4, agility: 22, stamina: -4 },
    favoredStipulations: ['ladder', 'multiMan', 'cruiserweight'],
    notes: 'Higher injury rate.',
  },
  {
    id: 'brawler',
    name: 'Brawler',
    statModifiers: { strength: 10, skill: -2, agility: -4, stamina: 8 },
    favoredStipulations: ['hardcore', 'streetFight'],
    notes: 'Thrives without rules.',
  },
  {
    id: 'showman',
    name: 'Showman',
    statModifiers: { strength: -4, skill: 2, agility: 6, stamina: 0 },
    favoredStipulations: [],
    notes: 'Any stipulation; +popularity growth.',
  },
  {
    id: 'monster',
    name: 'Monster',
    statModifiers: { strength: 24, skill: -12, agility: -18, stamina: 10 },
    favoredStipulations: ['squash', 'handicap'],
    notes: 'Rating penalty in long matches.',
  },
  {
    id: 'veteran',
    name: 'Veteran',
    statModifiers: { strength: 0, skill: 14, agility: -10, stamina: -6 },
    favoredStipulations: [],
    notes: 'Ages faster, high attitude.',
  },
  {
    id: 'rookie',
    name: 'Rookie',
    statModifiers: { strength: 0, skill: -10, agility: 4, stamina: 6 },
    favoredStipulations: ['undercard'],
    notes: 'High growth rate.',
  },
];

export function archetypeById(id: string): ArchetypeDefinition {
  const found = ARCHETYPES.find((a) => a.id === id);
  if (!found) throw new Error(`Unknown archetype id: ${id}`);
  return found;
}
