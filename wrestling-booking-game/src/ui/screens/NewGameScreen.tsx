// Where a save begins.
//
// Three steps, in order: how many promotions are in this world, what each
// one is called and whether it's generated or imported from a file, then
// which one you're booking. The same three steps apply whether every
// promotion is invented from scratch or the whole thing came out of a
// roster file — importing was never a second, different way to start a
// game, just this same flow with some of the "generate" switches flipped
// to "import".
//
// The name of your own promotion matters more than it looks: every belt in
// the company is named after it, so step 3 is also where you decide what
// your world title is called.

import { useState } from 'react';
import { useGameStore } from '../../state/store';
import { RIVAL_PROMOTIONS } from '../../state/world';
import { resolveNewGamePlan, type SlotDraft } from '../../state/newGamePlan';
import { savedGameSummary } from '../../state/persist';
import { identityOf, PROMOTION_ARCHETYPES } from '../../data/promotionIdentity';
import { startingBlueprints } from '../../data/titles';
import { beltPrefix } from '../../data/promotionIdentity';
import { TitleBuilder, blankTitleBlueprint } from '../components/TitleBuilder';
import { PromotionMark } from '../components/PromotionMark';
import { Select } from '../components/Select';
import { worldSettingsFromPreset, worldSettingsFromCustom } from '../../engine/world/settings';
import { WORLD_PRESET_INFO, CUSTOM_PRESET_BOUNDS, customSqueezeLine } from '../../data/worldPresets';
import { rngFromSeed } from '../../engine/rng';
import { parseRoster, type RosterEntry } from '../../engine/world/roster-io';
import type { PromotionArchetype, TitleBlueprint, WorldPresetName } from '../../engine/types';

/** Enough for a company with divisions; past this no belt means anything. */
const MAX_BELTS = 10;
const MIN_PROMOTIONS = 1;
const MAX_PROMOTIONS = 7;

function freshSlots(count: number, previous: SlotDraft[]): SlotDraft[] {
  const next = Array.from({ length: count }, (_, i) => previous[i] ?? { name: '', mode: 'generate' as const });
  return next;
}

/** Grow or shrink the belt list to match a chosen count, keeping what's already there. */
function resizeBelts(count: number, previous: TitleBlueprint[]): TitleBlueprint[] {
  if (count <= previous.length) return previous.slice(0, count);
  const next = [...previous];
  while (next.length < count) next.push(blankTitleBlueprint());
  return next;
}

export function NewGameScreen() {
  const newGame = useGameStore((s) => s.newGame);
  const newGameFromPlan = useGameStore((s) => s.newGameFromPlan);
  const continueGame = useGameStore((s) => s.continueGame);

  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [preset, setPreset] = useState<WorldPresetName>('backyard');
  const [customCash, setCustomCash] = useState(CUSTOM_PRESET_BOUNDS.cash.default);
  const [customRosterSize, setCustomRosterSize] = useState(CUSTOM_PRESET_BOUNDS.rosterSize.default);
  const [customCompanyRating, setCustomCompanyRating] = useState(CUSTOM_PRESET_BOUNDS.companyRating.default);
  const [customTerritoryFollowing, setCustomTerritoryFollowing] = useState(CUSTOM_PRESET_BOUNDS.territoryFollowing.default);
  const defaults =
    preset === 'custom'
      ? worldSettingsFromCustom({
          startingCash: customCash,
          startingRosterSize: customRosterSize,
          startingCompanyRating: customCompanyRating,
          startingTerritoryFollowing: customTerritoryFollowing,
        })
      : worldSettingsFromPreset(preset);
  const [promotionCount, setPromotionCount] = useState(1);

  const [slots, setSlots] = useState<SlotDraft[]>([{ name: '', mode: 'generate' }]);
  const [playerIndex, setPlayerIndex] = useState(0);

  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const [fileEntries, setFileEntries] = useState<RosterEntry[] | null>(null);
  const [fileProblems, setFileProblems] = useState<string[]>([]);
  const [pastedText, setPastedText] = useState('');

  const [archetype, setArchetype] = useState<PromotionArchetype>(defaults.promotionArchetype);
  const [belts, setBelts] = useState<TitleBlueprint[]>(() => startingBlueprints(defaults.promotionArchetype));
  const [touched, setTouched] = useState(false);

  const [confirmingOverwrite, setConfirmingOverwrite] = useState(false);
  const [startProblems, setStartProblems] = useState<string[]>([]);
  const saved = savedGameSummary();

  const anyImporting = slots.some((s) => s.mode === 'import');
  const playerSlot = slots[playerIndex];
  const identity = identityOf(archetype);
  const prefix = beltPrefix((playerSlot?.name || 'Your Promotion').trim() || 'Your Promotion');

  function chooseArchetype(next: PromotionArchetype) {
    setArchetype(next);
    if (!touched) setBelts(startingBlueprints(next));
  }

  function editBelts(next: TitleBlueprint[]) {
    setTouched(true);
    setBelts(next);
  }

  function choosePromotionCount(count: number) {
    setPromotionCount(count);
    setSlots((prev) => freshSlots(count, prev));
    if (playerIndex >= count) setPlayerIndex(0);
  }

  function updateSlot(index: number, patch: Partial<SlotDraft>) {
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function surpriseName(index: number) {
    const used = new Set(slots.map((s) => s.name));
    const available = RIVAL_PROMOTIONS.map((p) => p.name).filter((n) => !used.has(n));
    const pick = available[Math.floor(Math.random() * available.length)] ?? `Promotion ${index + 1}`;
    updateSlot(index, { name: pick });
  }

  function loadRosterText(raw: string, label: string) {
    const result = parseRoster(raw);
    setFileLabel(label);
    setFileEntries(result.entries);
    setFileProblems(result.problems);
  }

  function handleFilePicked(file: File) {
    const reader = new FileReader();
    reader.onload = () => loadRosterText(String(reader.result ?? ''), file.name);
    reader.readAsText(file);
  }

  function applyPastedText() {
    if (!pastedText.trim()) return;
    loadRosterText(pastedText, 'pasted roster');
  }

  function goToStep3() {
    setStartProblems([]);
    setStep(3);
  }

  function readyForStep3(): string | null {
    if (slots.some((s) => !s.name.trim())) return 'Every promotion needs a name before you continue.';
    const names = slots.map((s) => s.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) return 'Two promotions can’t share the same name.';
    if (anyImporting && (!fileEntries || fileEntries.length === 0)) {
      return 'Load a roster file for the promotions marked Import, or switch them to Generate.';
    }
    return null;
  }

  function start() {
    const finalSlots = slots.map((s) => ({ ...s, name: s.name.trim() }));

    if (promotionCount === 1 && finalSlots[0]!.mode === 'generate') {
      // The plain path — unchanged from before this feature existed, byte
      // for byte, so every existing save and test built on it keeps working.
      newGame({
        ...defaults,
        promotionName: finalSlots[0]!.name || defaults.promotionName,
        promotionArchetype: archetype,
        startingTitles: belts
          .filter((b) => b.suffix.trim().length > 0)
          .map((b) => ({ ...b, suffix: b.suffix.trim(), blurb: b.blurb.trim() || 'A championship.' })),
      });
      return;
    }

    const rng = rngFromSeed(`${defaults.seed}-import-split`);
    const { plan, problems } = resolveNewGamePlan(finalSlots, playerIndex, fileEntries, rng);
    if (!plan) {
      setStartProblems(problems);
      return;
    }

    // The player's own slot: fold in the archetype and belts chosen in step
    // 3 (only meaningful when it's a generated company — an imported one
    // keeps whatever house style its own file implies).
    const withPlayerChoices = {
      ...plan,
      slots: plan.slots.map((s, i) =>
        i === playerIndex && s.roster === 'generate' ? { ...s, archetype } : s,
      ),
    };

    newGameFromPlan(withPlayerChoices, {
      ...defaults,
      startingTitles: belts
        .filter((b) => b.suffix.trim().length > 0)
        .map((b) => ({ ...b, suffix: b.suffix.trim(), blurb: b.blurb.trim() || 'A championship.' })),
    });
  }

  const step2Error = readyForStep3();

  return (
    // Rendered before a world exists, so — like TitleScreen and
    // SettingsScreen — this has no App-level wrapper above it to supply a
    // background. Without its own, the heading was near-invisible pale text
    // on the browser's white default.
    <div className="min-h-screen bg-neutral-950 p-4 text-neutral-100">
      <div className="mx-auto max-w-2xl">
      <h1 className="text-lg font-semibold">Take over a wrestling promotion</h1>
      <p className="mb-4 text-xs text-neutral-500">
        You are the booker, plain and simple. You will never wrestle a single match — you decide exactly who is on
        the card, and this business decides absolutely everything else.
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

      <div className="mb-4 flex gap-2 text-[11px] text-neutral-500">
        <span className={step === 1 ? 'text-emerald-400' : ''}>1. How many</span>
        <span>›</span>
        <span className={step === 2 ? 'text-emerald-400' : ''}>2. Name them</span>
        <span>›</span>
        <span className={step === 3 ? 'text-emerald-400' : ''}>3. Play as</span>
      </div>

      {step === 1 && (
        <>
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
                    onClick={() => setPreset(option.id)}
                    className={`rounded border p-2 text-left ${
                      chosen
                        ? 'border-emerald-500 bg-emerald-950/40'
                        : 'border-neutral-800 bg-neutral-900 hover:border-neutral-600'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium">{option.label}</span>
                      <span className="shrink-0 font-mono text-[10px] text-neutral-500">
                        ${s.startingCash.toLocaleString()} ·{' '}
                        {s.startingPlayerRosterSize ?? s.startingRosterSize} on the payroll
                      </span>
                    </div>
                    <div className={`text-[11px] ${chosen ? 'text-neutral-200' : 'text-neutral-400'}`}>{option.blurb}</div>
                    {chosen && <div className="mt-1 text-[11px] text-amber-300">{option.theSqueeze}</div>}
                  </button>
                );
              })}

              <div
                className={`rounded border p-2 ${
                  preset === 'custom'
                    ? 'border-emerald-500 bg-emerald-950/40'
                    : 'border-neutral-800 bg-neutral-900 hover:border-neutral-600'
                }`}
              >
                <button
                  type="button"
                  data-testid="preset-custom"
                  onClick={() => setPreset('custom')}
                  className="block w-full text-left"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">Custom</span>
                    <span className="shrink-0 font-mono text-[10px] text-neutral-500">
                      ${customCash.toLocaleString()} · {customRosterSize} on the payroll
                    </span>
                  </div>
                  <div className={`text-[11px] ${preset === 'custom' ? 'text-neutral-200' : 'text-neutral-400'}`}>
                    Build your own starting position instead of picking one off the shelf.
                  </div>
                </button>
                {preset === 'custom' && (
                  <div className="mt-2 flex flex-col gap-2">
                    <label className="block text-[10px] uppercase tracking-wider text-neutral-500">
                      Starting cash — ${customCash.toLocaleString()}
                      <input
                        type="range"
                        data-testid="custom-cash"
                        min={CUSTOM_PRESET_BOUNDS.cash.min}
                        max={CUSTOM_PRESET_BOUNDS.cash.max}
                        step={CUSTOM_PRESET_BOUNDS.cash.step}
                        value={customCash}
                        onChange={(e) => setCustomCash(Number(e.target.value))}
                        className="mt-1 w-full"
                      />
                    </label>
                    <label className="block text-[10px] uppercase tracking-wider text-neutral-500">
                      Starting roster size — {customRosterSize}
                      <input
                        type="range"
                        data-testid="custom-roster-size"
                        min={CUSTOM_PRESET_BOUNDS.rosterSize.min}
                        max={CUSTOM_PRESET_BOUNDS.rosterSize.max}
                        step={CUSTOM_PRESET_BOUNDS.rosterSize.step}
                        value={customRosterSize}
                        onChange={(e) => setCustomRosterSize(Number(e.target.value))}
                        className="mt-1 w-full"
                      />
                    </label>
                    <label className="block text-[10px] uppercase tracking-wider text-neutral-500">
                      How credible you already are, nationally
                      <input
                        type="range"
                        data-testid="custom-company-rating"
                        min={CUSTOM_PRESET_BOUNDS.companyRating.min}
                        max={CUSTOM_PRESET_BOUNDS.companyRating.max}
                        step={CUSTOM_PRESET_BOUNDS.companyRating.step}
                        value={customCompanyRating}
                        onChange={(e) => setCustomCompanyRating(Number(e.target.value))}
                        className="mt-1 w-full"
                      />
                    </label>
                    <label className="block text-[10px] uppercase tracking-wider text-neutral-500">
                      How loved you already are at home
                      <input
                        type="range"
                        data-testid="custom-territory-following"
                        min={CUSTOM_PRESET_BOUNDS.territoryFollowing.min}
                        max={CUSTOM_PRESET_BOUNDS.territoryFollowing.max}
                        step={CUSTOM_PRESET_BOUNDS.territoryFollowing.step}
                        value={customTerritoryFollowing}
                        onChange={(e) => setCustomTerritoryFollowing(Number(e.target.value))}
                        className="mt-1 w-full"
                      />
                    </label>
                    <div className="text-[11px] text-amber-300" data-testid="custom-squeeze">
                      {customSqueezeLine(customCash, customRosterSize, customCompanyRating, customTerritoryFollowing)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="mb-5">
            <label className="mb-1 block text-xs uppercase tracking-wide text-neutral-500" htmlFor="promotion-count">
              How many promotions are in this world?
            </label>
            <Select
              id="promotion-count"
              testId="promotion-count"
              value={String(promotionCount)}
              onChange={(v) => choosePromotionCount(Number(v))}
              className="w-20"
              options={Array.from({ length: MAX_PROMOTIONS - MIN_PROMOTIONS + 1 }, (_, i) => i + MIN_PROMOTIONS).map(
                (n) => ({ value: String(n), label: String(n) }),
              )}
            />
            <p className="mt-1 text-[10px] text-neutral-600">
              One means it is just you out there. More than one means every other slot is a real, running rival
              company from week one.
            </p>
          </section>

          <button
            type="button"
            data-testid="step1-next"
            onClick={() => setStep(2)}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Next
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <section className="mb-4">
            <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Name every promotion</div>
            <p className="mb-2 text-[11px] text-neutral-500">
              Generate builds you a full roster right on the spot. Import fills that promotion straight from a
              roster file below — either tag wrestlers with a <code>company</code> matching the name typed here, or
              leave a file untagged and it gets divided evenly across whichever promotions here are set to Import.
            </p>
            <div className="flex flex-col gap-2">
              {slots.map((slot, i) => (
                <div key={i} className="flex items-center gap-2 rounded border border-neutral-800 bg-neutral-900 p-2">
                  <input
                    type="text"
                    data-testid={`slot-name-${i}`}
                    value={slot.name}
                    placeholder={`Promotion ${i + 1}`}
                    onChange={(e) => updateSlot(i, { name: e.target.value })}
                    className="flex-1 rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-sm"
                  />
                  <button
                    type="button"
                    data-testid={`slot-surprise-${i}`}
                    onClick={() => surpriseName(i)}
                    className="rounded bg-neutral-800 px-2 py-1 text-[11px] text-neutral-300 hover:bg-neutral-700"
                  >
                    Surprise me
                  </button>
                  <div className="flex overflow-hidden rounded border border-neutral-800">
                    <button
                      type="button"
                      data-testid={`slot-generate-${i}`}
                      onClick={() => updateSlot(i, { mode: 'generate' })}
                      className={`px-2 py-1 text-[11px] ${
                        slot.mode === 'generate' ? 'bg-emerald-600 text-white' : 'bg-neutral-900 text-neutral-400'
                      }`}
                    >
                      Generate
                    </button>
                    <button
                      type="button"
                      data-testid={`slot-import-${i}`}
                      onClick={() => updateSlot(i, { mode: 'import' })}
                      className={`px-2 py-1 text-[11px] ${
                        slot.mode === 'import' ? 'bg-sky-600 text-white' : 'bg-neutral-900 text-neutral-400'
                      }`}
                    >
                      Import
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {anyImporting && (
            <section className="mb-5 rounded border border-sky-900 bg-sky-950/20 p-3">
              <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Roster file</div>
              <input
                type="file"
                accept="application/json,.json"
                data-testid="roster-file-input"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFilePicked(file);
                }}
                className="mb-2 block text-xs text-neutral-400"
              />
              <p className="mb-1 text-[10px] text-neutral-600">Or paste the file's contents:</p>
              <textarea
                data-testid="roster-paste"
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                rows={4}
                className="w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-1 font-mono text-[11px]"
              />
              <button
                type="button"
                data-testid="roster-paste-apply"
                onClick={applyPastedText}
                className="mt-1 rounded bg-neutral-800 px-2 py-1 text-[11px] text-neutral-300 hover:bg-neutral-700"
              >
                Load pasted text
              </button>

              {fileEntries && (
                <p className="mt-2 text-[11px] text-emerald-400" data-testid="roster-load-summary">
                  {fileLabel}: {fileEntries.length} wrestler{fileEntries.length === 1 ? '' : 's'} read.
                </p>
              )}
              {fileProblems.length > 0 && (
                <ul className="mt-1 list-disc pl-4 text-[10px] text-amber-400">
                  {fileProblems.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {step2Error && (
            <p className="mb-3 text-xs text-amber-400" data-testid="step2-error">
              {step2Error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700"
            >
              Back
            </button>
            <button
              type="button"
              data-testid="step2-next"
              disabled={Boolean(step2Error)}
              onClick={goToStep3}
              className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <section className="mb-4">
            <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Which one do you book?</div>
            <div className="flex flex-wrap gap-1">
              {slots.map((slot, i) => (
                <button
                  key={i}
                  type="button"
                  data-testid={`play-as-${i}`}
                  onClick={() => setPlayerIndex(i)}
                  className={`rounded px-2 py-1 text-[11px] ${
                    playerIndex === i ? 'bg-sky-700 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                  }`}
                >
                  {slot.name || `Promotion ${i + 1}`}
                  {slot.mode === 'import' ? ' (import)' : ''}
                </button>
              ))}
            </div>
          </section>

          {playerSlot?.mode === 'generate' ? (
            <>
              <section className="mb-4">
                <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">House style</div>
                <div className="mb-2 flex items-center gap-2">
                  <PromotionMark name={playerSlot?.name || 'Your Promotion'} archetype={archetype} size="medium" />
                  <p className="text-[11px] text-neutral-500">
                    No logo to upload — this mark is generated from the name and the house style below, and updates
                    the moment either one changes.
                  </p>
                </div>
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
                  Name them whatever you want. These are what every single card you ever book is built toward.
                </p>
                <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-wider text-neutral-500">
                  How many championships?
                  <Select
                    testId="belt-count"
                    value={String(belts.length)}
                    onChange={(v) => {
                      setTouched(true);
                      setBelts((prev) => resizeBelts(Number(v), prev));
                    }}
                    className="w-16 normal-case tracking-normal"
                    options={Array.from({ length: MAX_BELTS + 1 }, (_, n) => n).map((n) => ({
                      value: String(n),
                      label: String(n),
                    }))}
                  />
                </div>
                <TitleBuilder belts={belts} prefix={prefix} onChange={editBelts} />
              </section>
            </>
          ) : (
            <p className="mb-5 text-xs text-neutral-500">
              Your roster is coming straight off the file — the house style and every belt follow exactly what
              that company already was.
            </p>
          )}

          {startProblems.length > 0 && (
            <ul className="mb-3 list-disc pl-4 text-[11px] text-amber-400" data-testid="start-problems">
              {startProblems.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700"
            >
              Back
            </button>
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
        </>
      )}
      </div>
    </div>
  );
}
