// Full appearance editor — §7: "ships in v1, not as a stretch goal — it
// powers both player-created wrestlers and mid-game look changes." Every
// trait in Appearance is editable here.
import { useState } from 'react';
import type { Appearance } from '../../engine/types';
import { generateAppearance, APPEARANCE_TRAIT_RANGES } from '../../engine/generate/appearance';
import { rngFromSeed } from '../../engine/rng';
import { PaperDoll } from '../paperdoll/PaperDoll';

type TraitKey = keyof typeof APPEARANCE_TRAIT_RANGES;

const TRAIT_GROUPS: { title: string; traits: TraitKey[] }[] = [
  { title: 'Body', traits: ['skinTone', 'build', 'height', 'faceShape', 'eyes'] },
  { title: 'Hair', traits: ['hairStyle', 'hairColor', 'facialHair'] },
  { title: 'Attire', traits: ['attireTop', 'attireBottom', 'boots', 'shirt'] },
  { title: 'Accessories', traits: ['mask', 'accessory', 'glasses', 'tattoos', 'beltStyle'] },
  { title: 'Colors', traits: ['primaryColor', 'secondaryColor', 'accentColor'] },
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

  function setTrait(key: TraitKey, value: number) {
    setAppearance((prev) => ({ ...prev, [key]: value }));
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
            <button
              type="button"
              onClick={() => setGender('m')}
              className={`rounded px-3 py-1 text-sm ${gender === 'm' ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300'}`}
            >
              Male
            </button>
            <button
              type="button"
              onClick={() => setGender('f')}
              className={`rounded px-3 py-1 text-sm ${gender === 'f' ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300'}`}
            >
              Female
            </button>
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

        <div className="grid flex-1 gap-6 sm:grid-cols-2">
          {TRAIT_GROUPS.map((group) => (
            <fieldset key={group.title} className="rounded border border-neutral-800 p-3">
              <legend className="px-1 text-sm font-medium text-neutral-300">{group.title}</legend>
              <div className="flex flex-col gap-3 pt-1">
                {group.traits.map((traitKey) => (
                  <TraitSlider
                    key={traitKey}
                    traitKey={traitKey}
                    value={appearance[traitKey]}
                    onChange={(value) => setTrait(traitKey, value)}
                  />
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </div>
    </div>
  );
}
