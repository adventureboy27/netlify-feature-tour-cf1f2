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
    blurb: 'A legend in one town, and a whisper everywhere else — for now.',
    theSqueeze:
      'You sell out that armory every single week and it is still not quite enough. Getting your name known outside your own county is the entire job.',
  },
  {
    id: 'standard',
    label: 'Standard',
    blurb: 'A real going concern — room in the building, and real money sitting in the bank.',
    theSqueeze: 'Nothing here is urgent, which means every single mistake is one you flat-out chose to make.',
  },
  {
    id: 'bigMoney',
    label: 'Big money',
    blurb: 'You have inherited a genuine powerhouse company: forty names on the payroll and an arena to fill.',
    theSqueeze:
      'The money was never the problem and never will be. The owner already believes this company is big-time, and has zero patience left for a booker who cannot keep it that way.',
  },
  {
    id: 'sinkOrSwim',
    label: 'Sink or swim',
    blurb: 'Fourteen wrestlers, a hall that holds nine hundred souls, and exactly one month of rent.',
    theSqueeze:
      'Opening night roughly breaks even, no more. There is zero cushion here, so one bad card or one injury to the wrong person is the whole promotion, gone.',
  },
];

export function presetInfo(id: Exclude<WorldPresetName, 'custom'>): WorldPresetInfo {
  return WORLD_PRESET_INFO.find((p) => p.id === id) ?? WORLD_PRESET_INFO[1]!;
}
