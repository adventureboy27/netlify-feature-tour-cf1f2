// One wrestler, as a portrait-forward tile for a dense browsing grid — the
// picker reached from a card slot (SlotRosterPicker.tsx) is the reason this
// exists. WrestlerRow is shaped for a wide row; a row can only ever fit 2-3
// across a real desktop window before it runs out of horizontal space. A
// tile is shaped to fit many more, the way Wrestling Empire's own picker
// does, without dropping the information that makes it useful — this reuses
// WrestlerRow's own Tag styling and MiniStats's StatusPips (already built to
// be "the six things a booker asks about somebody before anything else")
// rather than inventing a second, thinner readout just for this screen.

import { alignmentLabel } from '../../engine/career/scouting';
import { billedAs } from '../../engine/generate/nickname';
import { StatusPips } from './MiniStats';
import { PaperDoll } from '../paperdoll/PaperDoll';
import { Tag, GENDER_LABEL } from './WrestlerRow';
import type { Title, Wrestler, WorldSettings } from '../../engine/types';

const ALIGNMENT_STYLE: Record<string, string> = {
  Face: 'border-emerald-900 bg-emerald-950/40 text-emerald-300',
  Heel: 'border-purple-900 bg-purple-950/40 text-purple-300',
  Tweener: 'border-neutral-800 bg-neutral-900 text-neutral-400',
};

const GENDER_STYLE: Record<Wrestler['gender'], string> = {
  m: 'border-sky-900 bg-sky-950/40 text-sky-300',
  f: 'border-pink-900 bg-pink-950/40 text-pink-300',
};

export function WrestlerTile({
  wrestler,
  settings,
  onClick,
  titles,
  trailing,
}: {
  wrestler: Wrestler;
  settings: WorldSettings;
  onClick?: () => void;
  titles?: readonly Title[];
  /** The picker's own Add button — sits under the status strip, full width. */
  trailing?: React.ReactNode;
}) {
  const alignment = alignmentLabel(wrestler.alignment);

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded border border-neutral-800 bg-neutral-900 p-2 text-center ${
        onClick ? 'cursor-pointer transition hover:border-neutral-600' : ''
      }`}
    >
      <PaperDoll photoDataUrl={wrestler.photoDataUrl} name={wrestler.name} size="bust" />
      <span className="w-full truncate text-xs font-medium text-neutral-100">{billedAs(wrestler)}</span>
      <div className="flex flex-wrap items-center justify-center gap-1">
        <Tag className={GENDER_STYLE[wrestler.gender]}>{GENDER_LABEL[wrestler.gender]}</Tag>
        <Tag className={ALIGNMENT_STYLE[alignment] ?? ALIGNMENT_STYLE.Tweener!}>{alignment}</Tag>
      </div>
      <StatusPips wrestler={wrestler} settings={settings} titles={titles} />
      {trailing && (
        <div className="mt-0.5 w-full" onClick={(e) => e.stopPropagation()}>
          {trailing}
        </div>
      )}
    </div>
  );
}
