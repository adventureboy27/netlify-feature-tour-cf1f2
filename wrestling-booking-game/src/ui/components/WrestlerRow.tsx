// One wrestler, readable without opening anything.
//
// This replaces a chip that was a coloured dot and a name. To decide whether
// to put somebody in a match you had to leave the card, open the roster, read
// eight unlabelled bars and come back — thirty-four times. The decision the
// game is about was two screens from where you make it.
//
// A row carries: who they are, whether they can work tonight, the one reason
// to use them, and the one reason not to. Nothing here is a number, per §0 —
// and nothing here is *only* a colour either, which was the other half of the
// problem. Every coloured thing on this row also says its meaning in words,
// so it survives being colourblind or simply new.

import type { Id, Stable, Title, Wrestler, WorldSettings } from '../../engine/types';
import { scout, alignmentLabel, type Availability } from '../../engine/career/scouting';
import { billedAs } from '../../engine/generate/nickname';
import { MoodFace } from './Mood';
import { MiniStats } from './MiniStats';
import { PaperDoll } from '../paperdoll/PaperDoll';
import { motivationLegend } from '../../engine/career/motivation';
import { groupOf } from '../../engine/world/tagTeams';

const AVAILABILITY_STYLE: Record<Availability['tone'], string> = {
  bad: 'border-rose-900 bg-rose-950/50 text-rose-200',
  warn: 'border-amber-900 bg-amber-950/50 text-amber-200',
  good: 'border-emerald-900 bg-emerald-950/50 text-emerald-200',
  neutral: 'border-neutral-800 bg-neutral-900 text-neutral-400',
};

const ALIGNMENT_STYLE: Record<string, string> = {
  Face: 'border-emerald-900 bg-emerald-950/40 text-emerald-300',
  Heel: 'border-purple-900 bg-purple-950/40 text-purple-300',
  Tweener: 'border-neutral-800 bg-neutral-900 text-neutral-400',
};

/** The small word-and-colour badge used for both alignment and condition. */
export function Tag({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`shrink-0 rounded border px-1.5 py-px text-[10px] leading-tight ${className}`}>{children}</span>
  );
}

export function WrestlerRow({
  wrestler,
  settings,
  onClick,
  selected = false,
  trailing,
  compact = false,
  territoryId,
  territoryName,
  titles,
  stables,
}: {
  wrestler: Wrestler;
  settings: WorldSettings;
  onClick?: () => void;
  selected?: boolean;
  /** Anything the calling screen wants on the right — a price, a remove button. */
  trailing?: React.ReactNode;
  /** Drops the pitch and catch, for lists where space is tighter than choice. */
  compact?: boolean;
  /** The town this card is in, so the row can show what they draw *here*. */
  territoryId?: Id;
  territoryName?: string;
  /** Belts in play, so the row can say who is carrying one. */
  titles?: readonly Title[];
  /**
   * Live teams and factions, so the row can say whose act this person is
   * part of — a browsing list is exactly where "these two are a team"
   * changes whether you'd book them separately. Omitted screens (free
   * agents can never be in one; a detail page's own partner list already
   * says the group name once, in its header) just don't pass this.
   */
  stables?: readonly Stable[];
}) {
  const read = scout(wrestler, settings);
  const alignment = alignmentLabel(wrestler.alignment);
  const group = stables ? groupOf(stables, wrestler.id) : undefined;
  const body = (
    <>
      <PaperDoll photoDataUrl={wrestler.photoDataUrl} name={wrestler.name} size="thumb" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* The face goes first, before the name — when you are scanning a
              list to decide who to book, the mood of the room is the thing
              you are scanning for. */}
          <MoodFace wrestler={wrestler} settings={settings} size="sm" />
          <span className="truncate text-sm font-medium text-neutral-100">{billedAs(wrestler)}</span>
          <Tag className={ALIGNMENT_STYLE[alignment] ?? ALIGNMENT_STYLE.Tweener!}>{alignment}</Tag>
          <Tag className={AVAILABILITY_STYLE[read.availability.tone]}>{read.availability.label}</Tag>
        </div>
        {group && (
          <span className="block truncate text-[10px] text-sky-400">
            {group.kind === 'stable' ? 'Faction' : 'Team'}: {group.name}
          </span>
        )}
        {!compact && (
          <div className="mt-0.5 flex flex-col gap-px">
            {/* The meters go in the row itself, not only on the roster card.
                Picking somebody for a slot is exactly the moment you want to
                compare two people without leaving the screen. */}
            <div className="mb-1 max-w-[190px]">
              <MiniStats
                wrestler={wrestler}
                settings={settings}
                titles={titles}
                territoryId={territoryId}
                territoryName={territoryName}
                compact
              />
            </div>
            <span className="text-[11px] leading-snug text-neutral-300">{read.pitch}</span>
            {read.catch ? (
              <span className="text-[11px] leading-snug text-rose-300/80">{read.catch}</span>
            ) : (
              <span className="text-[11px] leading-snug text-emerald-300/70">{read.cleanBill}</span>
            )}
          </div>
        )}
      </div>
      {trailing && <div className="shrink-0 self-center">{trailing}</div>}
    </>
  );

  if (!onClick) {
    return <div className="flex items-start gap-2 rounded border border-neutral-800 bg-neutral-900 p-2">{body}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-start gap-2 rounded border p-2 text-left transition ${
        selected
          ? 'border-emerald-500 bg-emerald-950/40'
          : 'border-neutral-800 bg-neutral-900 hover:border-neutral-600'
      }`}
    >
      {body}
    </button>
  );
}

/**
 * What the badges on a row mean, said once at the top of a list.
 *
 * The player's first complaint about this screen was not knowing what the
 * colours meant, and a key is the cheapest possible answer to that. It is
 * collapsed by default so it stops being clutter the moment it has done its
 * job.
 */
export function RowKey() {
  return (
    <details className="mb-2 rounded border border-neutral-800 bg-neutral-950">
      <summary className="cursor-pointer px-2 py-1.5 text-[11px] text-neutral-500">What the tags mean</summary>
      <div className="flex flex-col gap-1.5 px-2 pb-2 text-[11px] text-neutral-400">
        <p>
          <Tag className={ALIGNMENT_STYLE.Face!}>Face</Tag> the crowd cheers ·{' '}
          <Tag className={ALIGNMENT_STYLE.Heel!}>Heel</Tag> the crowd boos ·{' '}
          <Tag className={ALIGNMENT_STYLE.Tweener!}>Tweener</Tag> neither, yet
        </p>
        <p>
          <Tag className={AVAILABILITY_STYLE.bad}>Out 3w</Tag>
          <Tag className={AVAILABILITY_STYLE.warn}>Banged up</Tag>
          <Tag className={AVAILABILITY_STYLE.good}>On a roll</Tag>
          <Tag className={AVAILABILITY_STYLE.neutral}>Fresh</Tag> — whether they can work tonight, and what the night
          will cost them.
        </p>
        <p>
          Under each name: what they are for, and in red, the reason you might leave them off. A face against a heel
          draws better than two of the same.
        </p>
      </div>
    </details>
  );
}

/**
 * What the icon row under a wrestler's name means, said once at the top of
 * the roster. Traits and motivators share one row and one key — the player
 * never needs to know which system an icon came out of, only what it means
 * for how this person wants to be booked.
 */
export function MotivationKey() {
  const symbols = motivationLegend();
  return (
    <details className="mb-2 rounded border border-neutral-800 bg-neutral-950">
      <summary className="cursor-pointer px-2 py-1.5 text-[11px] text-neutral-500">What the icons mean</summary>
      <div className="grid grid-cols-1 gap-x-3 gap-y-1 px-2 pb-2 text-[11px] text-neutral-400 sm:grid-cols-2">
        {symbols.map((s) => (
          <p key={s.name}>
            <span className="mr-1">{s.icon}</span>
            <span className="text-neutral-200">{s.name}.</span> {s.blurb}
          </p>
        ))}
      </div>
    </details>
  );
}
