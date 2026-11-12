// What somebody's face says when you walk past them backstage.
//
// Morale has been in the simulation since the beginning and was invisible in
// the interface — you could sort a roster by it and that was the whole of it.
// Meanwhile it decided release requests, how temptable somebody was by a
// competitor, what they asked for at contract time, whether a faction member
// would defect, and whether the scouting read called them miserable. A number
// that important being unreadable is the worst kind of hidden rule.
//
// So: a face, and a colour behind it, green through red. Six expressions for
// six bands. Drawn inline because the game ships as one offline file and an
// icon set is not an option — and because six circles and an arc is not worth
// a dependency.
//
// It is never a number. §0: stats are bars and words. The face is the band,
// the arrow is the direction it moved last week, and the sentence beside it
// is the reason — which is stored on the wrestler, so it is always the real
// one rather than a guess reconstructed after the fact.

import { moodBand, moodLabel, type MoodBand } from '../../engine/career/morale';
import type { Wrestler, WorldSettings } from '../../engine/types';

interface MoodLook {
  /** Ring, fill and eyes, dark-background safe.
   *
   * Every class is written out in full and never assembled at runtime —
   * Tailwind scans source text, so a class built by string replacement is a
   * class that does not exist in the stylesheet. */
  ring: string;
  fill: string;
  eyes: string;
  dot: string;
  ink: string;
  /** The mouth, as an SVG path. Eyes are shared. */
  mouth: string;
  /** Brows, for the two ends of the scale. Empty for the middle. */
  brows: string;
}

// The mouth path is the whole expression: a wide arc up for delighted through
// a deep frown for miserable, with a flat line in the middle where somebody
// genuinely has no opinion.
const LOOKS: Record<MoodBand, MoodLook> = {
  delighted: {
    ring: 'stroke-emerald-400',
    eyes: 'fill-emerald-400',
    dot: 'bg-emerald-400',
    fill: 'fill-emerald-500/20',
    ink: 'text-emerald-300',
    mouth: 'M7.5 13.5c1.2 2.4 7.8 2.4 9 0',
    brows: 'M7 8.6l2.4-1M17 8.6l-2.4-1',
  },
  happy: {
    ring: 'stroke-emerald-500',
    eyes: 'fill-emerald-500',
    dot: 'bg-emerald-500',
    fill: 'fill-emerald-500/15',
    ink: 'text-emerald-400',
    mouth: 'M8 14c1 1.6 7 1.6 8 0',
    brows: '',
  },
  content: {
    ring: 'stroke-lime-500',
    eyes: 'fill-lime-500',
    dot: 'bg-lime-500',
    fill: 'fill-lime-500/10',
    ink: 'text-lime-400',
    mouth: 'M8.5 14.4c1 .7 6 .7 7 0',
    brows: '',
  },
  restless: {
    ring: 'stroke-amber-500',
    eyes: 'fill-amber-500',
    dot: 'bg-amber-500',
    fill: 'fill-amber-500/10',
    ink: 'text-amber-400',
    mouth: 'M8.5 14.6h7',
    brows: '',
  },
  unhappy: {
    ring: 'stroke-orange-500',
    eyes: 'fill-orange-500',
    dot: 'bg-orange-500',
    fill: 'fill-orange-500/10',
    ink: 'text-orange-400',
    mouth: 'M8 15.6c1-1.6 7-1.6 8 0',
    brows: 'M7 7.6l2.4 1M17 7.6l-2.4 1',
  },
  miserable: {
    ring: 'stroke-rose-500',
    eyes: 'fill-rose-500',
    dot: 'bg-rose-500',
    fill: 'fill-rose-500/15',
    ink: 'text-rose-400',
    mouth: 'M7.5 16.2c1.2-2.4 7.8-2.4 9 0',
    brows: 'M6.8 7.2l2.8 1.4M17.2 7.2l-2.8 1.4',
  },
};

const SIZES = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-7 w-7' } as const;

/** The face on its own. */
export function MoodFace({
  wrestler,
  settings,
  size = 'md',
}: {
  wrestler: Wrestler;
  settings: WorldSettings;
  size?: keyof typeof SIZES;
}) {
  const band = moodBand(wrestler.morale, settings);
  const look = LOOKS[band];
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${SIZES[size]} shrink-0`}
      role="img"
      aria-label={moodLabel(band)}
    >
      <title>{moodLabel(band)}</title>
      <circle cx="12" cy="12" r="9.5" className={`${look.fill} ${look.ring}`} strokeWidth="1.6" />
      <circle cx="9" cy="10.6" r="1.05" className={look.eyes} />
      <circle cx="15" cy="10.6" r="1.05" className={look.eyes} />
      <path
        d={look.mouth}
        className={look.ring}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      {look.brows && (
        <path
          d={look.brows}
          className={look.ring}
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
        />
      )}
    </svg>
  );
}

/**
 * The face, which way it moved, and why — the whole readable unit.
 *
 * The reason is the point. "Unhappy" tells a booker nothing they can act on;
 * "Fourth week now without a match" tells them exactly what to do about it.
 */
export function MoodLine({
  wrestler,
  settings,
  size = 'md',
}: {
  wrestler: Wrestler;
  settings: WorldSettings;
  size?: keyof typeof SIZES;
}) {
  const band = moodBand(wrestler.morale, settings);
  const look = LOOKS[band];
  const moved = wrestler.moraleLastDelta;
  const reasons = wrestler.moraleReasons ?? [];
  return (
    <div>
      <div className="mt-1 flex items-center gap-1.5">
        <MoodFace wrestler={wrestler} settings={settings} size={size} />
        <span className={`shrink-0 text-[10px] font-semibold ${look.ink}`}>{moodLabel(band)}</span>
        {Math.abs(moved) >= 0.5 && (
          <span
            className={`shrink-0 text-[10px] ${moved > 0 ? 'text-emerald-400' : 'text-rose-400'}`}
            title={moved > 0 ? 'Happier than last week' : 'Unhappier than last week'}
            aria-label={moved > 0 ? 'improving' : 'worsening'}
          >
            {moved > 0 ? '▲' : '▼'}
          </span>
        )}
        {wrestler.moraleNote && (
          <span className="truncate text-[10px] text-neutral-400">{wrestler.moraleNote}</span>
        )}
      </div>
      {/* The rest of what this week actually did to them — weeklyMorale works
          out several things and only the loudest survives as moraleNote
          above. With one reason this would just repeat that line, so it only
          shows once there is something more to say. */}
      {reasons.length > 1 && (
        <details className="mt-0.5" data-testid="morale-breakdown">
          <summary className="cursor-pointer text-[10px] text-neutral-600 hover:text-neutral-400">Why</summary>
          <ul className="mt-0.5 flex flex-col gap-0.5 pl-3">
            {reasons.map((r, i) => (
              <li
                key={i}
                className={`text-[10px] leading-snug ${r.positive ? 'text-emerald-400/80' : 'text-rose-400/80'}`}
              >
                {r.text}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

