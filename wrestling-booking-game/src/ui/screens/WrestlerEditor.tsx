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
import type { Appearance, Id } from '../../engine/types';
import { useGameStore } from '../../state/store';
import { generateAppearance, APPEARANCE_TRAIT_RANGES } from '../../engine/generate/appearance';
import { rngFromSeed } from '../../engine/rng';
import { PaperDoll } from '../paperdoll/PaperDoll';
import { SKIN_TONE_PALETTE, HAIR_COLOR_PALETTE, ATTIRE_PALETTE } from '../paperdoll/palette';
import { DRAW_ORDER, SLOT_CELLS, type AtlasSlot } from '../paperdoll/atlas/manifest';
import { SLOT_TRAIT, selectCells, traitValueForCell } from '../paperdoll/atlas/traits';

type TraitKey = keyof typeof APPEARANCE_TRAIT_RANGES;

const SLOT_LABELS: Record<AtlasSlot, string> = {
  head: 'Head',
  face: 'Facial hair',
  extra: 'Face gear',
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
  bald_beard: 'Bald + beard',
  flattop: 'Flat top',
  dreads: 'Dreads',
  bald: 'Bald',
  undercut: 'Undercut',
  wild: 'Wild',
  bob: 'Bob',
  clean: 'Clean shaven',
  stubble: 'Stubble',
  moustache: 'Moustache',
  goatee: 'Goatee',
  chinstrap: 'Chinstrap',
  beard: 'Beard',
  longbeard: 'Long beard',
  none: 'None',
  shades: 'Shades',
  glasses: 'Glasses',
  eyepatch: 'Eye patch',
  headband: 'Headband',
  warpaint: 'Warpaint',
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

/**
 * The editor, in two modes.
 *
 * With no `wrestlerId` it is the sandbox it has always been: roll a look,
 * push the sliders, nothing is saved. With one, it is a repackage — the
 * wrestler's real name and real look are loaded, the ring name becomes
 * editable, and Save writes both back through the store, which enforces the
 * same distinctness rules generation obeys and refuses the change if the new
 * name or look would read as somebody already in the business.
 */
export function WrestlerEditor({ wrestlerId, onDone }: { wrestlerId?: Id; onDone?: () => void } = {}) {
  const world = useGameStore((s) => s.world);
  const repackageWrestler = useGameStore((s) => s.repackageWrestler);
  const subject = wrestlerId ? world?.wrestlers[wrestlerId] : undefined;

  const [appearance, setAppearance] = useState<Appearance>(
    () => subject?.appearance ?? generateAppearance(rngFromSeed('editor-default')),
  );
  const [alignment, setAlignment] = useState(subject?.alignment ?? 0);
  const [gender, setGender] = useState<'m' | 'f'>(subject?.gender ?? 'm');
  const [ringName, setRingName] = useState(subject?.name ?? '');
  const [nickname, setNickname] = useState(subject?.nickname ?? '');
  const [rejected, setRejected] = useState<string | null>(null);

  function save() {
    if (!subject) return;
    const result = repackageWrestler(subject.id, {
      name: ringName,
      nickname: nickname.trim() ? nickname.trim() : null,
      appearance,
    });
    if (!result.ok) {
      setRejected(result.reason);
      return;
    }
    setRejected(null);
    onDone?.();
  }

  const cells = selectCells(appearance, gender);
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
      <header className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">{subject ? `Repackage ${subject.name}` : 'Wrestler Editor'}</h1>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={randomize}
            className="rounded bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
          >
            Randomize
          </button>
          {subject && (
            <>
              <button
                type="button"
                onClick={onDone}
                className="rounded bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="save-repackage"
                onClick={save}
                className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
              >
                Save
              </button>
            </>
          )}
        </div>
      </header>

      {subject && (
        <div className="mb-4 flex flex-col gap-2 rounded border border-neutral-800 p-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-300">Ring name</span>
            <input
              type="text"
              value={ringName}
              data-testid="ring-name"
              onChange={(e) => {
                setRingName(e.target.value);
                setRejected(null);
              }}
              className="rounded bg-neutral-900 px-2 py-1.5 text-sm outline-none ring-1 ring-neutral-800 focus:ring-emerald-600"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-300">Billed as</span>
            <input
              type="text"
              value={nickname}
              placeholder="No nickname"
              onChange={(e) => setNickname(e.target.value)}
              className="rounded bg-neutral-900 px-2 py-1.5 text-sm outline-none ring-1 ring-neutral-800 focus:ring-emerald-600"
            />
          </label>
          {rejected && (
            <p data-testid="repackage-rejected" className="text-xs text-rose-400">
              {rejected}
            </p>
          )}
          {subject.formerNames && subject.formerNames.length > 0 && (
            <p className="text-[11px] text-neutral-500">
              Previously {subject.formerNames.map((f) => f.name).join(', ')}
            </p>
          )}
        </div>
      )}

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

              {/* No facial hair row on the fem frame — the renderer will not
                  draw it, so offering the chips would be a lie. */}
              {DRAW_ORDER.filter((slot) => slot !== 'head' && !(slot === 'face' && gender === 'f')).map((slot) => (
                <div key={slot} className="flex flex-col gap-1.5">
                  <span className="text-xs text-neutral-300">{SLOT_LABELS[slot]}</span>
                  <div className="flex flex-wrap gap-1">
                    {SLOT_CELLS[slot].map((cell) => (
                      <Chip
                        key={cell}
                        label={CELL_LABELS[cell] ?? cell}
                        selected={cells[slot] === cell}
                        onClick={() =>
                          // `glasses` overrides `accessory` for the extra slot,
                          // so writing accessory alone would silently do nothing
                          // to anybody already wearing shades.
                          slot === 'extra'
                            ? setTraits({ glasses: 0, accessory: traitValueForCell('extra', cell) })
                            : setTrait(SLOT_TRAIT[slot], traitValueForCell(slot, cell))
                        }
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
