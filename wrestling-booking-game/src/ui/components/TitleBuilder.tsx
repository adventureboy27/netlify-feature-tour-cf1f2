// Building your own championships.
//
// The new-game screen used to print the belts the house style had decided you
// were getting, as a read-only list. Naming your own titles is one of the
// first things anybody wants from a booking game — a promotion's belts are
// its spine, and being handed five you cannot rename is being handed somebody
// else's company.
//
// It opens pre-filled with the house style's suggestion rather than empty.
// A blank "you have no championships" page is a worse start than five
// sensible ones you can immediately make yours, and it also means a player
// who does not care about this can ignore the whole section.
//
// Prestige is not editable and deliberately so: a belt's standing is earned
// by who carries it and for how long, and typing 100 into your own world
// title on day one would hand you a promotion's worth of credibility for
// free. It comes from the tier instead.

import { useState } from 'react';
import {
  defaultHolders,
  startingPrestige,
  TITLE_COLORWAYS,
  TITLE_PRESETS,
  TITLE_PRESET_FAMILIES,
} from '../../data/titles';
import { STIPULATIONS } from '../../data/stipulations';
import type { TitleBlueprint, TitleDivision, TitleTier, WeightClass } from '../../engine/types';

const TIERS: { id: TitleTier; label: string; hint: string }[] = [
  { id: 'world', label: 'World', hint: 'The top of the company. Main events are built to it.' },
  { id: 'secondary', label: 'Secondary', hint: 'The belt somebody carries on the way up.' },
  { id: 'television', label: 'Television', hint: 'Defended often, on the show rather than the pay-per-view.' },
  { id: 'cruiserweight', label: 'Cruiserweight', hint: 'For the smaller, faster half of the roster.' },
  { id: 'hardcore', label: 'Hardcore', hint: 'Won and lost under whatever the stipulation says.' },
  { id: 'tertiary', label: 'Lower card', hint: 'Something for the people not in the main events yet.' },
  { id: 'tag', label: 'Tag team', hint: 'Two people. Held by a team, not a person.' },
  { id: 'trios', label: 'Trios', hint: 'Three people. Rarer, and harder to book.' },
];

const DIVISIONS: { id: TitleDivision; label: string }[] = [
  { id: 'mens', label: "Men's" },
  { id: 'womens', label: "Women's" },
  { id: 'open', label: 'Open to anybody' },
];

const WEIGHT_CLASSES: { id: WeightClass; label: string }[] = [
  { id: 'open', label: 'Any weight' },
  { id: 'lightweight', label: 'Lightweight' },
  { id: 'juniorHeavy', label: 'Junior heavyweight' },
  { id: 'lightHeavy', label: 'Light heavyweight' },
  { id: 'heavyweight', label: 'Heavyweight' },
  { id: 'superHeavy', label: 'Super heavyweight' },
];

/** A belt the player added themselves, before they have typed anything. */
function blankBelt(): TitleBlueprint {
  return {
    suffix: 'Championship',
    blurb: 'A new championship.',
    tier: 'secondary',
    division: 'open',
    weightClass: 'open',
    signatureStipulationId: null,
  };
}

export function TitleBuilder({
  belts,
  prefix,
  onChange,
  maxBelts,
}: {
  belts: TitleBlueprint[];
  /** The short form of the company name that every belt is prefixed with. */
  prefix: string;
  onChange: (next: TitleBlueprint[]) => void;
  maxBelts: number;
}) {
  const [picking, setPicking] = useState(false);
  const update = (index: number, patch: Partial<TitleBlueprint>) =>
    onChange(belts.map((belt, i) => (i === index ? { ...belt, ...patch } : belt)));

  return (
    <div className="flex flex-col gap-2">
      {belts.map((belt, index) => (
        <div key={index} className="rounded-lg border border-neutral-800 bg-neutral-950 p-2.5">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="shrink-0 text-[11px] text-neutral-600">{prefix}</span>
            <input
              type="text"
              aria-label={`Championship ${index + 1} name`}
              data-testid={`belt-name-${index}`}
              value={belt.suffix}
              onChange={(e) => update(index, { suffix: e.target.value })}
              className="min-w-0 flex-1 rounded border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              aria-label={`Remove ${belt.suffix}`}
              data-testid={`belt-remove-${index}`}
              onClick={() => onChange(belts.filter((_, i) => i !== index))}
              className="shrink-0 rounded border border-neutral-800 px-2 py-1 text-xs text-neutral-500 hover:border-rose-800 hover:text-rose-400"
            >
              Drop
            </button>
          </div>

          <input
            type="text"
            aria-label={`What the ${belt.suffix} is for`}
            value={belt.blurb}
            onChange={(e) => update(index, { blurb: e.target.value })}
            placeholder="What is this belt for?"
            className="mb-2 w-full rounded border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-[11px] text-neutral-300"
          />

          <div className="grid gap-1.5 sm:grid-cols-3">
            <label className="text-[10px] uppercase tracking-wider text-neutral-500">
              Kind
              <select
                aria-label={`${belt.suffix} kind`}
                data-testid={`belt-tier-${index}`}
                value={belt.tier}
                onChange={(e) => update(index, { tier: e.target.value as TitleTier })}
                className="mt-0.5 w-full rounded border border-neutral-800 bg-neutral-900 px-1.5 py-1.5 text-xs normal-case tracking-normal text-neutral-200"
              >
                {TIERS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-[10px] uppercase tracking-wider text-neutral-500">
              Division
              <select
                aria-label={`${belt.suffix} division`}
                data-testid={`belt-division-${index}`}
                value={belt.division}
                onChange={(e) => update(index, { division: e.target.value as TitleDivision })}
                className="mt-0.5 w-full rounded border border-neutral-800 bg-neutral-900 px-1.5 py-1.5 text-xs normal-case tracking-normal text-neutral-200"
              >
                {DIVISIONS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-[10px] uppercase tracking-wider text-neutral-500">
              Weight
              <select
                aria-label={`${belt.suffix} weight class`}
                value={belt.weightClass}
                onChange={(e) => update(index, { weightClass: e.target.value as WeightClass })}
                className="mt-0.5 w-full rounded border border-neutral-800 bg-neutral-900 px-1.5 py-1.5 text-xs normal-case tracking-normal text-neutral-200"
              >
                {WEIGHT_CLASSES.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* The belt that is always defended one way. A deathmatch title
              contested under normal rules is a disappointment and the crowd
              says so, which is the whole reason this is a property. */}
          <label className="mt-1.5 block text-[10px] uppercase tracking-wider text-neutral-500">
            Always defended under
            <select
              aria-label={`${belt.suffix} signature stipulation`}
              value={belt.signatureStipulationId ?? ''}
              onChange={(e) => update(index, { signatureStipulationId: e.target.value || null })}
              className="mt-0.5 w-full rounded border border-neutral-800 bg-neutral-900 px-1.5 py-1.5 text-xs normal-case tracking-normal text-neutral-200"
            >
              <option value="">Nothing in particular</option>
              {STIPULATIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          {/* Only defendable under it, rather than merely suited to it. A
              Battle Royal Trophy that can be won in a singles match is not a
              Battle Royal Trophy. */}
          {belt.signatureStipulationId && (
            <label className="mt-1.5 flex items-center gap-2 text-[11px] text-neutral-400">
              <input
                type="checkbox"
                data-testid={`belt-stip-required-${index}`}
                checked={Boolean(belt.stipulationRequired)}
                onChange={(e) => update(index, { stipulationRequired: e.target.checked })}
                className="h-4 w-4"
              />
              And only under it — it cannot be defended any other way
            </label>
          )}

          <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
            <label className="text-[10px] uppercase tracking-wider text-neutral-500">
              Held by
              <select
                aria-label={`How many people hold the ${belt.suffix}`}
                data-testid={`belt-holders-${index}`}
                value={belt.holdersRequired ?? defaultHolders(belt.tier)}
                onChange={(e) => update(index, { holdersRequired: Number(e.target.value) })}
                className="mt-0.5 w-full rounded border border-neutral-800 bg-neutral-900 px-1.5 py-1.5 text-xs normal-case tracking-normal text-neutral-200"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? 'One person' : `${n} people`}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-[10px] uppercase tracking-wider text-neutral-500">
              Strap and plate
              <select
                aria-label={`${belt.suffix} colours`}
                data-testid={`belt-colorway-${index}`}
                value={belt.colorway ? `${belt.colorway.strap}|${belt.colorway.plate}` : ''}
                onChange={(e) => {
                  const [strap, plate] = e.target.value.split('|');
                  update(index, { colorway: strap && plate ? { strap, plate } : undefined });
                }}
                className="mt-0.5 w-full rounded border border-neutral-800 bg-neutral-900 px-1.5 py-1.5 text-xs normal-case tracking-normal text-neutral-200"
              >
                <option value="">Whatever suits the tier</option>
                {TITLE_COLORWAYS.map((c) => (
                  <option key={c.name} value={`${c.strap}|${c.plate}`}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {belt.colorway && (
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className="inline-block h-4 w-8 rounded-sm border border-neutral-700"
                style={{ backgroundColor: belt.colorway.strap }}
                aria-hidden
              />
              <span
                className="inline-block h-4 w-4 rounded-sm"
                style={{ backgroundColor: belt.colorway.plate }}
                aria-hidden
              />
            </div>
          )}

          <div className="mt-1.5 text-[10px] text-neutral-600">
            {TIERS.find((t) => t.id === belt.tier)?.hint} Opens at{' '}
            {startingPrestige(belt.tier) >= 65
              ? 'high standing'
              : startingPrestige(belt.tier) >= 45
                ? 'decent standing'
                : 'modest standing'}
            .
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="belt-add"
          onClick={() => onChange([...belts, blankBelt()])}
          disabled={belts.length >= maxBelts}
          className="rounded-lg border border-neutral-700 px-3 py-2 text-xs text-neutral-300 hover:border-neutral-500 disabled:border-neutral-900 disabled:text-neutral-700"
        >
          Add a blank one
        </button>
        <button
          type="button"
          data-testid="belt-from-preset"
          onClick={() => setPicking((open) => !open)}
          disabled={belts.length >= maxBelts}
          className="rounded-lg border border-neutral-700 px-3 py-2 text-xs text-neutral-300 hover:border-neutral-500 disabled:border-neutral-900 disabled:text-neutral-700"
        >
          {picking ? 'Never mind' : 'Start from something'}
        </button>
        <span className="text-[10px] text-neutral-600">
          {belts.length === 0
            ? 'No belts. The card has nothing to build toward.'
            : `${belts.length} of ${maxBelts}. A company with too many has none that mean anything.`}
        </span>
      </div>

      {/* Starting points, not a menu — everything is editable the moment it
          is picked, which is the whole reason the presets are safe to offer. */}
      {picking && (
        <div className="mt-2 rounded-lg border border-neutral-800 bg-neutral-950 p-2">
          {TITLE_PRESET_FAMILIES.map((family) => (
            <div key={family} className="mb-2 last:mb-0">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-neutral-500">{family}</div>
              <div className="flex flex-wrap gap-1">
                {TITLE_PRESETS.filter((preset) => preset.family === family).map((preset) => (
                  <button
                    key={preset.suffix}
                    type="button"
                    data-testid={`preset-${preset.suffix.replace(/\s+/g, '-')}`}
                    title={preset.blurb}
                    onClick={() => {
                      if (belts.length >= maxBelts) return;
                      const { family: _family, ...blueprint } = preset;
                      onChange([...belts, blueprint]);
                      setPicking(false);
                    }}
                    className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-[11px] text-neutral-300 hover:border-emerald-700 hover:text-neutral-100"
                  >
                    {preset.suffix}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
