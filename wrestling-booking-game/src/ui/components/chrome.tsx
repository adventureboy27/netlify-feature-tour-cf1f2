// The game's visual vocabulary.
//
// There is no match to watch. The player books a card, presses a button, and
// reads what happened — so the reading *is* the spectacle, and it has to earn
// that. The results page was twenty identical grey boxes stacked a phone-and-
// a-half tall: a 2.25-star night, a title change, and somebody's shoulder
// giving out all rendered at the same size, in the same colour, in the same
// frame. Nothing told the eye where to go.
//
// So: three levels of surface, one type scale, section headings that act as
// landmarks in a long scroll, and a per-promotion accent so a save has a
// colour of its own. Everything here is presentational. No screen invents its
// own panel any more.

import type { PromotionArchetype } from '../../engine/types';

// ---------------------------------------------------------------------------
// Promotion accent
// ---------------------------------------------------------------------------

/**
 * Each house style gets a colour.
 *
 * A save is thirty simulated years long and the player picks their company on
 * the first screen; it should not look identical to every other one. The
 * archetype already decides what the belts are called and what the crowd will
 * sit through, so it is the honest thing to hang a colour on — a hardcore
 * outfit reading blood-red and a technical one reading cold blue is the same
 * information the blurb gives, arriving faster.
 *
 * Tailwind cannot see class names built at runtime, so these are whole
 * literal strings rather than interpolated fragments.
 */
export interface PromotionTheme {
  /** Solid fill for the one primary action on a screen. */
  action: string;
  /** The same fill with no hover state — for anything that isn't a button, like PromotionMark. */
  solid: string;
  /** Text colour for headings and accents. */
  ink: string;
  /** Hairline for a heading rule or an active tab. */
  edge: string;
  /** Very dark wash behind a hero. */
  wash: string;
  /**
   * A coloured shadow, for pairing with shadow-glow-sm — the "this is
   * interactive and it's yours" pop on a browsing card (see WrestlerTile.tsx).
   * A literal class, same reason the rest of this object is literal strings.
   */
  glow: string;
  /**
   * The hover-state border — a whole literal `hover:border-...` string, not
   * `edge` reused with a prefix concatenated at render time. Tailwind's JIT
   * only ever sees a class if the complete string appears verbatim somewhere
   * it scans; `` `hover:${edge}` `` would silently compile to nothing.
   */
  hoverEdge: string;
}

const THEMES: Record<PromotionArchetype, PromotionTheme> = {
  territory: {
    action: 'bg-amber-600 hover:bg-amber-500',
    solid: 'bg-amber-600',
    ink: 'text-amber-400',
    edge: 'border-amber-700',
    wash: 'from-amber-950/40',
    glow: 'shadow-amber-500/40',
    hoverEdge: 'hover:border-amber-600',
  },
  hardcore: {
    action: 'bg-red-700 hover:bg-red-600',
    solid: 'bg-red-700',
    ink: 'text-red-400',
    edge: 'border-red-800',
    wash: 'from-red-950/40',
    glow: 'shadow-red-500/40',
    hoverEdge: 'hover:border-red-600',
  },
  technical: {
    action: 'bg-sky-700 hover:bg-sky-600',
    solid: 'bg-sky-700',
    ink: 'text-sky-400',
    edge: 'border-sky-800',
    wash: 'from-sky-950/40',
    glow: 'shadow-sky-500/40',
    hoverEdge: 'hover:border-sky-600',
  },
  sportsEntertainment: {
    action: 'bg-fuchsia-700 hover:bg-fuchsia-600',
    solid: 'bg-fuchsia-700',
    ink: 'text-fuchsia-400',
    edge: 'border-fuchsia-800',
    wash: 'from-fuchsia-950/40',
    glow: 'shadow-fuchsia-500/40',
    hoverEdge: 'hover:border-fuchsia-600',
  },
  lucha: {
    action: 'bg-orange-600 hover:bg-orange-500',
    solid: 'bg-orange-600',
    ink: 'text-orange-400',
    edge: 'border-orange-700',
    wash: 'from-orange-950/40',
    glow: 'shadow-orange-500/40',
    hoverEdge: 'hover:border-orange-600',
  },
  oldSchool: {
    action: 'bg-stone-600 hover:bg-stone-500',
    solid: 'bg-stone-600',
    ink: 'text-stone-300',
    edge: 'border-stone-600',
    wash: 'from-stone-900/50',
    glow: 'shadow-stone-400/30',
    hoverEdge: 'hover:border-stone-500',
  },
  athletic: {
    action: 'bg-emerald-600 hover:bg-emerald-500',
    solid: 'bg-emerald-600',
    ink: 'text-emerald-400',
    edge: 'border-emerald-700',
    wash: 'from-emerald-950/40',
    glow: 'shadow-emerald-500/40',
    hoverEdge: 'hover:border-emerald-600',
  },
};

export function promotionTheme(archetype: PromotionArchetype | undefined): PromotionTheme {
  return THEMES[archetype ?? 'territory'] ?? THEMES.territory;
}

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

/**
 * Three levels, and only three.
 *
 * `sunken` is the page's own ground — a well things sit in. `raised` is the
 * ordinary card. `hero` is the one thing on a screen that gets to shout.
 * Everything used to be `raised`, which is the same as everything being
 * nothing.
 */
export type Elevation = 'sunken' | 'raised' | 'hero';

const SURFACE: Record<Elevation, string> = {
  sunken: 'border border-neutral-900 bg-neutral-950',
  // DESIGN: bumped a step lighter than the original neutral-800 border —
  // against a neutral-950 page and a neutral-900 sidebar, a neutral-800 edge
  // read as barely-there. A card is supposed to look like a card, not a
  // slightly-warmer patch of the same background.
  raised: 'border border-neutral-700 bg-neutral-900 shadow-panel',
  hero: 'border border-neutral-600 bg-neutral-900 shadow-hero',
};

export function Panel({
  children,
  elevation = 'raised',
  className = '',
  animate = false,
  ...rest
}: {
  children: React.ReactNode;
  elevation?: Elevation;
  className?: string;
  /** A quiet settle-in on mount — for the one or two panels a screen actually wants to draw the eye to, not every card in a list. */
  animate?: boolean;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`rounded-xl ${SURFACE[elevation]} ${animate ? 'animate-rise-in' : ''} ${className}`} {...rest}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

/**
 * A segmented control, themed to the promotion.
 *
 * Every screen with more than one view of its data (Rankings, Promotion,
 * Finance) was rolling its own row of `flex-1 rounded px-2 py-1` buttons —
 * same idea, five slightly different implementations, none of them sharing
 * an active state. One component, so "which tab is active" always looks and
 * feels the same everywhere it appears.
 */
export function Tabs<T extends string>({
  options,
  active,
  onChange,
  theme,
  testIdPrefix,
}: {
  options: readonly { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
  theme: PromotionTheme;
  testIdPrefix?: string;
}) {
  return (
    <div className="flex gap-1 rounded-lg border border-neutral-800 bg-neutral-950 p-1" role="tablist">
      {options.map((option) => {
        const isActive = option.id === active;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-testid={testIdPrefix ? `${testIdPrefix}-${option.id}` : undefined}
            onClick={() => onChange(option.id)}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-all duration-150 active:scale-[0.97] ${
              isActive ? `${theme.action} text-white shadow-panel` : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: 'bg-neutral-800 text-neutral-300',
  success: 'bg-emerald-900/60 text-emerald-300 ring-1 ring-inset ring-emerald-700/50',
  warning: 'bg-amber-900/50 text-amber-300 ring-1 ring-inset ring-amber-700/50',
  danger: 'bg-rose-900/50 text-rose-300 ring-1 ring-inset ring-rose-700/50',
  info: 'bg-sky-900/50 text-sky-300 ring-1 ring-inset ring-sky-700/50',
};

/** A small, consistent pill for status/tags — instead of every screen inventing its own `rounded px-1 py-px text-[10px]` combination. */
export function Badge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${BADGE_TONE[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * A landmark in a long scroll.
 *
 * The results page runs to six screen-heights on a phone and its sections
 * were marked with 13px text the same colour as the body copy. A heading has
 * one job — to be findable while your thumb is moving — and a small tracked
 * cap with a rule running off to the right does that at a glance.
 */
export function SectionHead({
  children,
  hint,
  className = '',
}: {
  children: React.ReactNode;
  /** A few words of context, sat on the same line at the right. */
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-2 mt-5 flex items-center gap-3 ${className}`}>
      <h2 className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">{children}</h2>
      <div className="h-px flex-1 bg-neutral-800" />
      {hint && <span className="shrink-0 text-[11px] text-neutral-600">{hint}</span>}
    </div>
  );
}

/**
 * A label above a value. The pair reads as one thing, which is the whole
 * reason the ledger rows kept getting misread as unrelated numbers.
 */
export function Figure({
  label,
  children,
  align = 'left',
}: {
  label: string;
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <div className={align === 'right' ? 'text-right' : ''}>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="text-sm font-semibold tabular-nums text-neutral-100">{children}</div>
    </div>
  );
}

/**
 * The star rating, big enough to be the point.
 *
 * The show's rating is the answer to the only question the player asked when
 * they pressed the button, and it was rendered at 12px in the corner of a
 * header. At `display` size it is the first thing on the page — which is
 * what it is.
 */
const FRACTION_GLYPH: Record<number, string> = { 0: '', 0.25: '¼', 0.5: '½', 0.75: '¾' };

export function BigStars({ stars, className = '' }: { stars: number; className?: string }) {
  const full = Math.floor(stars);
  const fraction = Math.round((stars - full) * 4) / 4;
  const glyph = FRACTION_GLYPH[fraction] ?? '';
  const empty = Math.max(0, 5 - full - (glyph ? 1 : 0));
  return (
    <div
      className={`flex items-baseline font-mono leading-none ${className}`}
      title={`${stars.toFixed(2)} stars`}
      aria-label={`${stars.toFixed(2)} out of 5 stars`}
    >
      <span className="text-3xl text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.25)]">
        {'★'.repeat(full)}
        {glyph}
      </span>
      <span className="text-3xl text-neutral-800">{'★'.repeat(empty)}</span>
    </div>
  );
}
