// The five ways to start a career.
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
    blurb: 'Twenty-four wrestlers, a hall that holds nine hundred souls, and exactly one month of rent.',
    theSqueeze:
      'Opening night roughly breaks even, no more. There is zero cushion here, so one bad card or one injury to the wrong person is the whole promotion, gone.',
  },
  {
    id: 'backyard',
    label: 'Backyard',
    blurb: 'Just you and one other name signed, a tarp over plywood in somebody’s yard, and a folding table standing in for an apron.',
    theSqueeze:
      'Nobody hands you a locker room here — the rest of the cast is a free-agent pool full of people working for almost nothing, and hiring them is the first real decision you make. Everything you own is worse than it should be until you buy your way out of it, and nobody outside the block has heard of you yet.',
  },
];

export function presetInfo(id: Exclude<WorldPresetName, 'custom'>): WorldPresetInfo {
  return WORLD_PRESET_INFO.find((p) => p.id === id) ?? WORLD_PRESET_INFO[1]!;
}

// ---------------------------------------------------------------------------
// Custom — the sixth way in, built by hand instead of picked off the shelf.
//
// Every slider is clamped to the exact span the five presets above already
// cover, never past it in either direction — Backyard's floor, Big money's
// ceiling. That means Custom can only ever recombine numbers this game has
// already balance-tested individually; the untested part is only which
// *combination* the player lands on, which is the whole point of a builder.
// See NewGameScreen.tsx and engine/world/settings.ts's worldSettingsFromCustom.

export interface SliderBounds {
  min: number;
  max: number;
  step: number;
  default: number;
}

export const CUSTOM_PRESET_BOUNDS: {
  cash: SliderBounds;
  rosterSize: SliderBounds;
  companyRating: SliderBounds;
  territoryFollowing: SliderBounds;
} = {
  cash: { min: 8_000, max: 400_000, step: 2_000, default: 75_000 },
  // Below Territory Days' 26, above Backyard's 10 — Backyard's real floor
  // only survives because startingPlayerRosterSize hands most of the roster
  // to a cheap free-agent pool instead of the payroll directly (see that
  // field's own doc comment in engine/types.ts); Custom doesn't build that
  // pipeline, so its floor sits high enough that startingRosterSize can
  // safely be the whole payroll on day one.
  rosterSize: { min: 14, max: 44, step: 2, default: 26 },
  companyRating: { min: 12, max: 62, step: 2, default: 55 },
  territoryFollowing: { min: 10, max: 60, step: 2, default: 55 },
};

/**
 * The squeeze, generated instead of hand-written — a plain, honest read of
 * the combination the player just built, same voice as the five fixed
 * presets' own theSqueeze. Never a warning, never a number: just what kind
 * of first year this is going to be.
 */
export function customSqueezeLine(cash: number, rosterSize: number, companyRating: number, territoryFollowing: number): string {
  const cashPerHead = cash / rosterSize;
  const fame = (companyRating + territoryFollowing) / 2;

  const money =
    cashPerHead < 1_500
      ? 'The payroll on a roster this size eats the bank fast — this one is thin from the opening bell.'
      : cashPerHead < 3_500
        ? 'Enough to open the doors and cover a bad week, not much past that.'
        : cashPerHead < 7_000
          ? 'Real breathing room behind this roster.'
          : 'Money was never going to be the problem here.';

  const reputation =
    fame < 25
      ? 'Nobody outside your own block has heard of you yet.'
      : fame < 45
        ? 'Known enough to draw a curious crowd — nothing has been proven beyond that.'
        : fame < 58
          ? 'A real, respected name walking in.'
          : 'A company people already take seriously before you book a single card.';

  return `${money} ${reputation}`;
}
