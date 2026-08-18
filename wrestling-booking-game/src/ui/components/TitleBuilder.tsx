// Building your own championships.
//
// The new-game screen used to print the belts the house style had decided you
// were getting, as a read-only list. Naming your own titles is one of the
// first things anybody wants from a booking game — a promotion's belts are
// its spine, and being handed five you cannot rename is being handed somebody
// else's company.
//
// Overhauled to match the new-game promotions flow: how many, name them, and
// two per-belt controls (holders, colours) rather than a form with eight
// fields per belt. Division, weight class and signature stipulation used to
// be pickable here too; nobody who wanted a quick set of belts had an opinion
// about any of them, so they are dropped to sensible defaults ('open',
// 'open', none) instead of asked for. A promotion that wants a division-
// locked women's title or a stipulation-bound hardcore belt still gets one —
// house styles still hand those out via `startingBlueprints` — this screen
// just no longer makes typing five belts require five little decisions each.
//
// How many belts exist is the caller's call, not this component's: the
// new-game screen resizes `belts` from its own count dropdown, and the
// mid-game "introduce a title" flow on PromotionScreen only ever hands this
// a single draft. So there is no add/remove control in here — the array
// length IS the count.
//
// Tier is still a real field underneath (it drives how long a belt can go
// undefended, and whether it's read as team-held everywhere from the roster
// screen to a tag split), but the player is never asked for it directly.
// Two holders means a tag belt and three means a trios belt because nothing
// else in the game currently means anything by "held by 2" or "held by 3" —
// see `tierForHolders`. Everything else keeps whatever tier it already had
// (a house style's suggested lineup varies tier on purpose; a blank new row
// starts 'secondary').
//
// Prestige is not editable and deliberately so: a belt's standing is earned
// by who carries it and for how long, and typing 100 into your own world
// title on day one would hand you a promotion's worth of credibility for
// free. It comes from the tier instead.

import { useState } from 'react';
import { defaultHolders, TITLE_COLORWAYS } from '../../data/titles';
import type { TitleBlueprint, TitleTier } from '../../engine/types';

/** A belt the player added themselves, before they have typed anything. */
export function blankTitleBlueprint(): TitleBlueprint {
  return {
    suffix: 'Championship',
    blurb: 'A new championship.',
    tier: 'secondary',
    division: 'open',
    weightClass: 'open',
    signatureStipulationId: null,
  };
}

/**
 * What "held by N" implies about the tier, for the two group sizes the rest
 * of the game actually treats specially (team-title display, tag splits,
 * opening-champion crowning). Anything else keeps whatever tier it already
 * had — so switching a belt from 2 holders back to 1 falls back to a plain
 * singles tier rather than staying permanently "tag", but a house style's
 * 'world' or 'television' pick for a singles belt is never overwritten by
 * this component at all.
 */
function tierForHolders(holders: number, current: TitleTier): TitleTier {
  if (holders === 2) return 'tag';
  if (holders === 3) return 'trios';
  if (current === 'tag' || current === 'trios') return 'secondary';
  return current;
}

const DEFAULT_STRAP = '#3a2214';
const DEFAULT_PLATE = '#f1c40f';

function BeltPreview({ suffix, prefix, strap, plate }: { suffix: string; prefix: string; strap: string; plate: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-950 p-4">
      <div className="relative flex h-10 w-full max-w-[220px] items-center justify-center rounded-full" style={{ backgroundColor: strap }}>
        <div className="h-8 w-16 rounded-md border-2 border-black/30" style={{ backgroundColor: plate }} />
      </div>
      <div className="text-center text-[11px] text-neutral-400">
        {prefix} {suffix || 'Championship'}
      </div>
    </div>
  );
}

function ColorOverlay({
  belt,
  prefix,
  onChange,
  onClose,
}: {
  belt: TitleBlueprint;
  prefix: string;
  onChange: (colorway: { strap: string; plate: string }) => void;
  onClose: () => void;
}) {
  const strap = belt.colorway?.strap ?? DEFAULT_STRAP;
  const plate = belt.colorway?.plate ?? DEFAULT_PLATE;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-lg border border-neutral-700 bg-neutral-900 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 text-sm font-medium text-neutral-200">Strap and plate — {belt.suffix || 'Championship'}</div>

        <BeltPreview suffix={belt.suffix} prefix={prefix} strap={strap} plate={plate} />

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-[10px] uppercase tracking-wider text-neutral-500">
            Strap
            <input
              type="color"
              data-testid="belt-color-strap"
              value={strap}
              onChange={(e) => onChange({ strap: e.target.value, plate })}
              className="mt-1 h-9 w-full cursor-pointer rounded border border-neutral-700 bg-neutral-950"
            />
          </label>
          <label className="text-[10px] uppercase tracking-wider text-neutral-500">
            Plate
            <input
              type="color"
              data-testid="belt-color-plate"
              value={plate}
              onChange={(e) => onChange({ strap, plate: e.target.value })}
              className="mt-1 h-9 w-full cursor-pointer rounded border border-neutral-700 bg-neutral-950"
            />
          </label>
        </div>

        <div className="mt-3 text-[10px] uppercase tracking-wider text-neutral-500">Or start from</div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {TITLE_COLORWAYS.map((c) => (
            <button
              key={c.name}
              type="button"
              data-testid={`belt-swatch-${c.name.replace(/\s+/g, '-')}`}
              title={c.name}
              onClick={() => onChange({ strap: c.strap, plate: c.plate })}
              className="flex h-7 w-7 overflow-hidden rounded border border-neutral-700"
            >
              <span className="h-full w-1/2" style={{ backgroundColor: c.strap }} />
              <span className="h-full w-1/2" style={{ backgroundColor: c.plate }} />
            </button>
          ))}
        </div>

        <button
          type="button"
          data-testid="belt-color-done"
          onClick={onClose}
          className="mt-4 w-full rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          Done
        </button>
      </div>
    </div>
  );
}

export function TitleBuilder({
  belts,
  prefix,
  onChange,
}: {
  belts: TitleBlueprint[];
  /** The short form of the company name that every belt is prefixed with. */
  prefix: string;
  onChange: (next: TitleBlueprint[]) => void;
}) {
  const [colorPickerIndex, setColorPickerIndex] = useState<number | null>(null);
  const update = (index: number, patch: Partial<TitleBlueprint>) =>
    onChange(belts.map((belt, i) => (i === index ? { ...belt, ...patch } : belt)));

  const editing = colorPickerIndex !== null ? belts[colorPickerIndex] : undefined;

  return (
    <div className="flex flex-col gap-2">
      {belts.map((belt, index) => {
        const holders = belt.holdersRequired ?? defaultHolders(belt.tier);
        return (
          <div key={index} className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-950 p-2.5">
            <span className="shrink-0 text-[11px] text-neutral-600">{prefix}</span>
            <input
              type="text"
              aria-label={`Championship ${index + 1} name`}
              data-testid={`belt-name-${index}`}
              value={belt.suffix}
              onChange={(e) => update(index, { suffix: e.target.value })}
              className="min-w-0 flex-1 rounded border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-sm"
            />

            <label className="shrink-0 text-[10px] text-neutral-500">
              Held by
              <select
                aria-label={`How many people hold the ${belt.suffix}`}
                data-testid={`belt-holders-${index}`}
                value={holders}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  update(index, { holdersRequired: next, tier: tierForHolders(next, belt.tier) });
                }}
                className="ml-1 rounded border border-neutral-800 bg-neutral-900 px-1.5 py-1.5 text-xs text-neutral-200"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              aria-label={`Choose colours for ${belt.suffix}`}
              data-testid={`belt-colors-${index}`}
              onClick={() => setColorPickerIndex(index)}
              className="shrink-0 flex items-center gap-1.5 rounded border border-neutral-800 px-2 py-1.5 text-xs text-neutral-300 hover:border-neutral-500"
            >
              <span
                className="inline-block h-3.5 w-3.5 rounded-sm border border-neutral-700"
                style={{ backgroundColor: belt.colorway?.plate ?? DEFAULT_PLATE }}
                aria-hidden
              />
              Colours
            </button>
          </div>
        );
      })}

      {belts.length === 0 && (
        <p className="text-[11px] text-neutral-600">No belts. The card has nothing to build toward.</p>
      )}

      {editing && colorPickerIndex !== null && (
        <ColorOverlay
          belt={editing}
          prefix={prefix}
          onChange={(colorway) => update(colorPickerIndex, { colorway })}
          onClose={() => setColorPickerIndex(null)}
        />
      )}
    </div>
  );
}
