// Where a save begins.
//
// Two ways in: start your own company and name it, or take over one of the
// ones already out there. Taking over an existing promotion means it is no
// longer a rival — you are running it, and its house style comes with it.
//
// The name matters more than it looks: every belt in the company is named
// after it, so this screen is also where you decide what your world title is
// called.

import { useState } from 'react';
import { useGameStore } from '../../state/store';
import { RIVAL_PROMOTIONS } from '../../state/world';
import { savedGameSummary } from '../../state/persist';
import { identityOf, PROMOTION_ARCHETYPES } from '../../data/promotionIdentity';
import { startingBlueprints } from '../../data/titles';
import { beltPrefix } from '../../data/promotionIdentity';
import { TitleBuilder } from '../components/TitleBuilder';
import { worldSettingsFromPreset } from '../../engine/world/settings';
import { WORLD_PRESET_INFO } from '../../data/worldPresets';
import type { PromotionArchetype, TitleBlueprint, WorldPresetName } from '../../engine/types';

/** Enough for a company with divisions; past this no belt means anything. */
const MAX_BELTS = 10;

export function NewGameScreen() {
  const newGame = useGameStore((s) => s.newGame);
  const continueGame = useGameStore((s) => s.continueGame);

  const [preset, setPreset] = useState<Exclude<WorldPresetName, 'custom'>>('standard');
  const defaults = worldSettingsFromPreset(preset);
  const [name, setName] = useState(defaults.promotionName);
  const [archetype, setArchetype] = useState<PromotionArchetype>(defaults.promotionArchetype);
  const [confirmingOverwrite, setConfirmingOverwrite] = useState(false);
  // The house style's suggestion, until the player edits it. `touched` is what
  // keeps switching house style from quietly wiping work: before you have
  // changed anything, the lineup follows the style; after, it is yours.
  const [belts, setBelts] = useState<TitleBlueprint[]>(() => startingBlueprints(archetype));
  const [touched, setTouched] = useState(false);
  const saved = savedGameSummary();

  const identity = identityOf(archetype);
  const prefix = beltPrefix(name || 'Your Promotion');

  function chooseArchetype(next: PromotionArchetype) {
    setArchetype(next);
    if (!touched) setBelts(startingBlueprints(next));
  }

  function editBelts(next: TitleBlueprint[]) {
    setTouched(true);
    setBelts(next);
  }

  // Picking a preset fills in the name and house style it comes with rather
  // than overriding them at start time, so the player can see what they got
  // and type over it.
  function choosePreset(id: Exclude<WorldPresetName, 'custom'>) {
    const next = worldSettingsFromPreset(id);
    setPreset(id);
    setName(next.promotionName);
    chooseArchetype(next.promotionArchetype);
  }

  function start() {
    newGame({
      ...defaults,
      promotionName: name.trim() || defaults.promotionName,
      promotionArchetype: archetype,
      // Drop belts the player emptied the name out of rather than creating a
      // championship called "". Running none at all is allowed — the game does
      // not warn you out of a decision, and a promotion with no belts is a
      // real, if hard, way to run one.
      startingTitles: belts
        .filter((b) => b.suffix.trim().length > 0)
        .map((b) => ({ ...b, suffix: b.suffix.trim(), blurb: b.blurb.trim() || 'A championship.' })),
    });
  }

  return (
    <div className="mx-auto max-w-2xl p-4 text-neutral-100">
      <h1 className="text-lg font-semibold">Take over a wrestling promotion</h1>
      <p className="mb-4 text-xs text-neutral-500">
        You are the booker. You will never wrestle a match — you decide who is on the card, and the business decides the
        rest.
      </p>

      {saved && (
        <section className="mb-4 rounded border border-emerald-800 bg-emerald-950/30 p-3">
          <div className="text-sm font-medium">{saved.promotionName}</div>
          <div className="text-xs text-neutral-400">Saved at week {saved.week}</div>
          <button
            type="button"
            data-testid="continue-game"
            onClick={() => continueGame()}
            className="mt-2 rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Continue
          </button>
        </section>
      )}

      <section className="mb-4">
        <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Where you come in</div>
        <div className="flex flex-col gap-1">
          {WORLD_PRESET_INFO.map((option) => {
            const chosen = preset === option.id;
            const s = worldSettingsFromPreset(option.id);
            return (
              <button
                key={option.id}
                type="button"
                data-testid={`preset-${option.id}`}
                onClick={() => choosePreset(option.id)}
                className={`rounded border p-2 text-left ${
                  chosen
                    ? 'border-emerald-500 bg-emerald-950/40'
                    : 'border-neutral-800 bg-neutral-900 hover:border-neutral-600'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{option.label}</span>
                  <span className="shrink-0 font-mono text-[10px] text-neutral-500">
                    ${s.startingCash.toLocaleString()} · {s.startingRosterSize} on the payroll
                  </span>
                </div>
                <div className={`text-[11px] ${chosen ? 'text-neutral-200' : 'text-neutral-400'}`}>{option.blurb}</div>
                {chosen && <div className="mt-1 text-[11px] text-amber-300">{option.theSqueeze}</div>}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mb-4">
        <label className="mb-1 block text-xs uppercase tracking-wide text-neutral-500" htmlFor="promotion-name">
          Name the company
        </label>
        <input
          id="promotion-name"
          data-testid="new-promotion-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm"
        />
      </section>

      <section className="mb-4">
        <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Or take over one that exists</div>
        <div className="flex flex-wrap gap-1">
          {RIVAL_PROMOTIONS.map((p) => (
            <button
              key={p.name}
              type="button"
              data-testid={`takeover-${p.archetype}`}
              onClick={() => {
                setName(p.name);
                chooseArchetype(p.archetype);
              }}
              className={`rounded px-2 py-1 text-[11px] ${
                name === p.name ? 'bg-sky-700 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-neutral-600">
          Take one over and it stops being your competition. The other companies carry on as normal.
        </p>
      </section>

      <section className="mb-4">
        <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">House style</div>
        <div className="flex flex-wrap gap-1">
          {PROMOTION_ARCHETYPES.map((option) => (
            <button
              key={option}
              type="button"
              data-testid={`house-style-${option}`}
              onClick={() => chooseArchetype(option)}
              className={`rounded px-2 py-1 text-[11px] ${
                archetype === option ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              {identityOf(option).label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-neutral-400">{identity.knownFor}.</p>
      </section>

      <section className="mb-5">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Your championships</div>
          {touched && (
            <button
              type="button"
              data-testid="belts-reset"
              onClick={() => {
                setTouched(false);
                setBelts(startingBlueprints(archetype));
              }}
              className="text-[11px] text-neutral-500 underline hover:text-neutral-300"
            >
              Back to the house lineup
            </button>
          )}
        </div>
        <p className="mb-2 text-[11px] text-neutral-500">
          Name them what you want. These are what every card you ever book will be built toward.
        </p>
        <TitleBuilder belts={belts} prefix={prefix} onChange={editBelts} maxBelts={MAX_BELTS} />
      </section>

      {saved && !confirmingOverwrite ? (
        <button
          type="button"
          data-testid="start-new-game"
          onClick={() => setConfirmingOverwrite(true)}
          className="rounded bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700"
        >
          Start a new promotion
        </button>
      ) : (
        <button
          type="button"
          data-testid="confirm-new-game"
          onClick={start}
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          {saved ? `Replace the ${saved.promotionName} save and start` : 'Open the doors'}
        </button>
      )}
    </div>
  );
}
