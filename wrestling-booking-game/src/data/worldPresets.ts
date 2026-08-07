// The four ways to start a career.
//
// WORLD_PRESETS in engine/world/settings.ts carries the numbers; this carries
// what the player is told about them. Split because the numbers are engine
// config and the prose is content, and because the prose is the only part of
// a preset the player ever actually reads.
//
// These existed for months as settings nobody could reach — worldSettingsFromPreset
// had no callers outside the file that defined it, so every save ever started
// was Standard. Worse, when they were finally measured they barely differed:
// all four opened in the same building at the same price, because the presets
// moved cash and roster size and nothing else, and cash turns out to be almost
// irrelevant once a promotion is running. They now move the starting position
// itself — how well known you are, how over you are at home, and how many
// people are on the payroll — which is what actually decides the first year.

import type { WorldPresetName } from '../engine/types';

export interface WorldPresetInfo {
  id: Exclude<WorldPresetName, 'custom'>;
  label: string;
  /** One line on the fantasy. */
  blurb: string;
  /** One line on where the difficulty actually comes from. */
  theSqueeze: string;
}

export const WORLD_PRESET_INFO: WorldPresetInfo[] = [
  {
    id: 'territoryDays',
    label: 'Territory days',
    blurb: 'An institution in one town and a rumour everywhere else.',
    theSqueeze:
      'You sell out the armoury every week and it still is not quite enough. Getting known outside your own county is the whole job.',
  },
  {
    id: 'standard',
    label: 'Standard',
    blurb: 'A going concern with room in the building and money in the bank.',
    theSqueeze: 'Nothing is urgent, which means every mistake is one you chose to make.',
  },
  {
    id: 'bigMoney',
    label: 'Big money',
    blurb: 'You have inherited a real company: forty on the payroll and an arena to fill.',
    theSqueeze:
      'The money is not the problem and never will be. The owner already thinks the company is big, and has almost no patience left for a booker who cannot keep it that way.',
  },
  {
    id: 'sinkOrSwim',
    label: 'Sink or swim',
    blurb: 'Fourteen wrestlers, a hall that holds nine hundred, and one month of rent.',
    theSqueeze:
      'Opening night roughly breaks even. There is no cushion at all, so one bad card or one injury to the wrong person is the whole promotion.',
  },
];

export function presetInfo(id: Exclude<WorldPresetName, 'custom'>): WorldPresetInfo {
  return WORLD_PRESET_INFO.find((p) => p.id === id) ?? WORLD_PRESET_INFO[1]!;
}
