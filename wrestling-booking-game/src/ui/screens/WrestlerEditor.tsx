// Full appearance editor — §7: "ships in v1, not as a stretch goal — it
// powers both player-created wrestlers and mid-game look changes." Every
// trait in Appearance is editable here.
//
// Traits the sprite atlas actually cuts get named pickers and color swatches,
// because "mohawk" and a red chip are decisions a player can make and
// "hairStyle: 7" is not. The remaining traits stay as sliders in their own
// group: they're still part of the vector the distinctness check and the save
// file care about, they just have no cell in the current atlas.
import { useState } from 'react';
import type { Appearance } from '../../engine/types';
import { generateAppearance, APPEARANCE_TRAIT_RANGES } from '../../engine/generate/appearance';
import { rngFromSeed } from '../../engine/rng';
import { PaperDoll } from '../paperdoll/PaperDoll';
import { SKIN_TONE_PALETTE, HAIR_COLOR_PALETTE, ATTIRE_PALETTE } from '../paperdoll/palette';
import { DRAW_ORDER, SLOT_CELLS, type AtlasSlot } from '../paperdoll/atlas/manifest';
import { SLOT_TRAIT, selectCells, traitValueForCell } from '../paperdoll/atlas/traits';

type TraitKey = keyof typeof APPEARANCE_TRAIT_RANGES;

const SLOT_LABELS: Record<AtlasSlot, string> = {
  head: 'Head',
  upper: 'Top',
  lower: 'Bottom',
  feet: 'Feet',
};

const CELL_LABELS: Record<string, string> = {
  short: 'Short',
  buzz: 'Buzzed',
  mohawk: 'Mohawk',
  long: 'Long',
  ponytail: 'Ponytail',
  afro: 'Afro',
  mask: 'Mask',
  bald_beard: 'Bald',
  bare: 'Bare',
  singlet: 'Singlet',
  tank: 'Tank',
  tee: 'Tee',
  longsleeve: 'Long sleeve',
  vest: 'Vest',
  trunks: 'Trunks',
  trunks_pads: 'Trunks + pads',
  tights: 'Tights',
  shorts: 'Shorts',
  jeans: 'Jeans',
  skirt: 'Skirt',
  boots_mid: 'Mid boots',
  boots_high: 'High boots',
  boots_low: 'Low boots',
  sneakers: 'Sneakers',
  barefoot: 'Barefoot',
};

// Everything the atlas does not currently cut a cell for. Kept editable and
// kept in the vector — the shapes are generator work (tools/wrestler_atlas.py),
// not data the game should start throwing away.
const UNRENDERED_TRAITS: TraitKey[] = [
  'build',
  'height',
  'faceShape',
  'eyes',
  'facialHair',
  'accessory',
  'glasses',
  'shirt',
  'tattoos',
  'beltStyle',
];

const TRAIT_LABELS: Record<TraitKey, string> = {
  skinTone: 'Skin tone',
  build: 'Build',
  height: 'Height',
  faceShape: 'Face shape',
  eyes: 'Eyes',
  hairStyle: 'Hair style',
  hairColor: 'Hair color',
  facialHair: 'Facial hair',
  attireTop: 'Attire (top)',
  attireBottom: 'Attire (bottom)',
  boots: 'Boots',
  shirt: 'Shirt overlay',
  mask: 'Mask',
  accessory: 'Accessory',
  glasses: 'Glasses',
  tattoos: 'Tattoos',
  beltStyle: 'Belt style',
  primaryColor: 'Primary color',
  secondaryColor: 'Secondary color',
  accentColor: 'Accent color',
};

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`rounded px-2 py-1 text-xs ${selected ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}
    >
      {label}
    </button>
  );
}

function Swatches({
  label,
  palette,
  value,
  onChange,
}: {
  label: string;
  palette: readonly string[];
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-neutral-300">{label}</span>
      <div className="flex flex-wrap gap-1">
        {palette.map((color, index) => (
          <button
            key={color}
            type="button"
            aria-label={`${label} ${index}`}
            aria-pressed={index === value}
            onClick={() => onChange(index)}
            style={{ backgroundColor: color }}
            className={`h-6 w-6 rounded-sm border ${index === value ? 'border-emerald-400 ring-1 ring-emerald-400' : 'border-neutral-700'}`}
          />
        ))}
      </div>
    </div>
  );
}

function TraitSlider({
  traitKey,
  value,
  onChange,
}: {
  traitKey: TraitKey;
  value: number;
  onChange: (next: number) => void;
}) {
  const max = APPEARANCE_TRAIT_RANGES[traitKey];
  return (
    <label className="flex flex-col gap-1 text-sm text-neutral-200">
      <span className="flex justify-between">
        <span>{TRAIT_LABELS[traitKey]}</span>
        <span className="text-neutral-400">
          {value} / {max}
        </span>
      </span>
      <input
        type="range"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-emerald-500"
      />
    </label>
  );
}

export function WrestlerEditor() {
  const [appearance, setAppearance] = useState<Appearance>(() => generateAppearance(rngFromSeed('editor-default')));
  const [alignment, setAlignment] = useState(0);
  const [gender, setGender] = useState<'m' | 'f'>('m');

  const cells = selectCells(appearance);
  const masked = appearance.mask > 0;

  function setTrait(key: TraitKey, value: number) {
    setAppearance((prev) => ({ ...prev, [key]: value }));
  }

  function setTraits(patch: Partial<Appearance>) {
    setAppearance((prev) => ({ ...prev, ...patch }));
  }

  function randomize() {
    setAppearance(generateAppearance(rngFromSeed(`editor-${Date.now()}-${Math.random()}`)));
  }

  return (
    <div className="min-h-screen bg-neutral-950 p-4 text-neutral-100">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Wrestler Editor</h1>
        <button
          type="button"
          onClick={randomize}
          className="rounded bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
        >
          Randomize
        </button>
      </header>

      <div className="flex flex-col gap-6 md:flex-row">
        <div className="flex flex-col items-center gap-3 md:sticky md:top-4 md:h-fit">
          <PaperDoll appearance={appearance} gender={gender} alignment={alignment} size="full" />
          <div className="flex gap-2">
            <Chip label="Masc frame" selected={gender === 'm'} onClick={() => setGender('m')} />
            <Chip label="Fem frame" selected={gender === 'f'} onClick={() => setGender('f')} />
          </div>
          <label className="flex w-48 flex-col gap-1 text-sm">
            <span className="flex justify-between">
              <span>Alignment preview</span>
              <span className="text-neutral-400">{alignment}</span>
            </span>
            <input
              type="range"
              min={-100}
              max={100}
              value={alignment}
              onChange={(e) => setAlignment(Number(e.target.value))}
              className="accent-emerald-500"
            />
          </label>
        </div>

        <div className="flex flex-1 flex-col gap-6">
          <fieldset className="rounded border border-neutral-800 p-3">
            <legend className="px-1 text-sm font-medium text-neutral-300">Look</legend>
            <div className="flex flex-col gap-3 pt-1">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-neutral-300">{SLOT_LABELS.head}</span>
                <div className="flex flex-wrap gap-1">
                  <Chip label="Mask" selected={masked} onClick={() => setTrait('mask', masked ? 0 : 1)} />
                  {SLOT_CELLS.head
                    .filter((cell) => cell !== 'mask')
                    .map((cell) => (
                      <Chip
                        key={cell}
                        label={CELL_LABELS[cell] ?? cell}
                        selected={!masked && cells.head === cell}
                        onClick={() => setTraits({ mask: 0, hairStyle: traitValueForCell('head', cell) })}
                      />
                    ))}
                </div>
              </div>

              {DRAW_ORDER.filter((slot) => slot !== 'head').map((slot) => (
                <div key={slot} className="flex flex-col gap-1.5">
                  <span className="text-xs text-neutral-300">{SLOT_LABELS[slot]}</span>
                  <div className="flex flex-wrap gap-1">
                    {SLOT_CELLS[slot].map((cell) => (
                      <Chip
                        key={cell}
                        label={CELL_LABELS[cell] ?? cell}
                        selected={cells[slot] === cell}
                        onClick={() => setTrait(SLOT_TRAIT[slot], traitValueForCell(slot, cell))}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset className="rounded border border-neutral-800 p-3">
            <legend className="px-1 text-sm font-medium text-neutral-300">Colors</legend>
            <div className="flex flex-col gap-3 pt-1">
              <Swatches
                label="Skin tone"
                palette={SKIN_TONE_PALETTE}
                value={appearance.skinTone}
                onChange={(v) => setTrait('skinTone', v)}
              />
              <Swatches
                label={masked ? 'Hair color — hidden under the mask' : 'Hair color'}
                palette={HAIR_COLOR_PALETTE}
                value={appearance.hairColor}
                onChange={(v) => setTrait('hairColor', v)}
              />
              <Swatches
                label="Primary — top, boots, mask"
                palette={ATTIRE_PALETTE}
                value={appearance.primaryColor}
                onChange={(v) => setTrait('primaryColor', v)}
              />
              <Swatches
                label="Secondary — trunks, tights"
                palette={ATTIRE_PALETTE}
                value={appearance.secondaryColor}
                onChange={(v) => setTrait('secondaryColor', v)}
              />
              <Swatches
                label="Accent — trim, pads, laces, piping"
                palette={ATTIRE_PALETTE}
                value={appearance.accentColor}
                onChange={(v) => setTrait('accentColor', v)}
              />
            </div>
          </fieldset>

          <fieldset className="rounded border border-neutral-800 p-3">
            <legend className="px-1 text-sm font-medium text-neutral-300">Other traits</legend>
            <p className="pb-2 text-xs text-neutral-500">
              Editable and saved, but the current atlas cuts no cells for them — these need new frames from the sprite
              generator before they change the sprite.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {UNRENDERED_TRAITS.map((traitKey) => (
                <TraitSlider
                  key={traitKey}
                  traitKey={traitKey}
                  value={appearance[traitKey]}
                  onChange={(value) => setTrait(traitKey, value)}
                />
              ))}
            </div>
          </fieldset>
        </div>
      </div>
    </div>
  );
}
