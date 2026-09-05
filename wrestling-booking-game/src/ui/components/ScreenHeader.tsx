// The one header every drill-down screen shares.
//
// Before this, a screen reached one level in from a list — the wrestler
// editor, Settings — hand-rolled its own "← Back" button and heading, each
// slightly different. That was fine at one or two screens; the UX overhaul
// adds several more (a wrestler's own detail page, a roster picker, a match
// setup screen), and each one inventing its own header again is exactly the
// inconsistent chrome the player called out. One component, so "how do I get
// back" always looks and sits in the same place.

/**
 * `onBack` is always the navigation stack's `goBack` in practice — this
 * component doesn't know or care what "back" means, it just renders the
 * button and calls whatever it's given.
 */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  /** A small action or stat, sat at the far right of the row. */
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="shrink-0 rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs font-semibold text-neutral-400 transition hover:text-neutral-200"
      >
        ← Back
      </button>
      <div className="min-w-0 flex-1">
        {/* Wraps rather than truncates — a repackaged wrestler's full name
            in the title is more useful than a title that reads "Repackag…"
            on a phone-width screen with two buttons sat next to it. */}
        <h1 className="text-lg font-black leading-tight tracking-tight text-neutral-100">{title}</h1>
        {subtitle && <p className="text-xs text-neutral-500">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
