// Getting around, on a phone.
//
// There were thirteen tabs in a horizontally-scrolling strip at the top of
// the screen. At an iPhone width that shows five and a half of them, clipped
// at both ends, with no edge or shadow to say the row scrolls — so eight
// destinations were invisible unless you happened to drag a row of buttons
// sideways. It also put every navigation target at the far end of the screen
// from the thumb holding the device.
//
// So: the five places you go every single week live in a bottom bar, and
// everything else lives behind More — which is a real screen with a sentence
// under each entry, because "The Sheet" and "Legacy" do not explain
// themselves and nothing else in the game was going to.

import type { PromotionTheme } from './chrome';

export type Screen =
  | 'office'
  | 'booking'
  | 'promotion'
  | 'roster'
  | 'territories'
  | 'finance'
  | 'freeAgents'
  | 'results'
  | 'rankings'
  | 'sheet'
  | 'records'
  | 'legacy'
  | 'crucible'
  | 'contactSheet'
  | 'editor'
  | 'secrets'
  | 'more';

// ---------------------------------------------------------------------------
// Icons
//
// Drawn inline rather than pulled from a set: the game is offline-only and
// ships as a single file, so a webfont or an icon package is not an option.
// Five shapes at 20px is not worth a dependency anyway.
// ---------------------------------------------------------------------------

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const ICONS: Record<string, React.ReactNode> = {
  // A card: the running order of the night.
  booking: (
    <Icon>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 9h10M7 13h10M7 17h6" />
    </Icon>
  ),
  // Two people: the roster.
  roster: (
    <Icon>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5" />
      <path d="M16 5.5a3 3 0 0 1 0 5.8M17 15c2.4.5 4 2.2 4 5" />
    </Icon>
  ),
  // A briefcase: the business end.
  office: (
    <Icon>
      <rect x="2.5" y="7" width="19" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M2.5 12h19" />
    </Icon>
  ),
  // A star: what the night got.
  results: (
    <Icon>
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" />
    </Icon>
  ),
  more: (
    <Icon>
      <circle cx="5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="19" cy="12" r="1.4" />
    </Icon>
  ),
};

// ---------------------------------------------------------------------------
// The bar
// ---------------------------------------------------------------------------

/** The five you touch every week. Everything else is one tap further away. */
const PRIMARY: { id: Screen; label: string }[] = [
  { id: 'booking', label: 'Card' },
  { id: 'roster', label: 'Roster' },
  { id: 'office', label: 'Office' },
  { id: 'results', label: 'Results' },
  { id: 'more', label: 'More' },
];

const ICON_KEY: Record<string, string> = {
  booking: 'booking',
  roster: 'roster',
  office: 'office',
  results: 'results',
  more: 'more',
};

export function BottomNav({
  screen,
  onNavigate,
  theme,
  officeBadge,
  moreBadge,
}: {
  screen: Screen;
  onNavigate: (screen: Screen) => void;
  theme: PromotionTheme;
  /** A story or an offer waiting on an answer. */
  officeBadge: boolean;
  /** The current screen lives behind More, so More shows as the active one. */
  moreBadge: boolean;
}) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-lg">
        {PRIMARY.map((tab) => {
          const active = screen === tab.id || (tab.id === 'more' && moreBadge);
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigate(tab.id)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition ${
                active ? theme.ink : 'text-neutral-500'
              }`}
            >
              {ICONS[ICON_KEY[tab.id]!]}
              {tab.label}
              {tab.id === 'office' && officeBadge && (
                <span className="absolute right-1/2 top-1.5 -mr-3 h-2 w-2 rounded-full bg-amber-400" />
              )}
              {active && <span className={`absolute inset-x-4 top-0 h-0.5 rounded-b ${theme.action.split(' ')[0]}`} />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// More
// ---------------------------------------------------------------------------

/**
 * The rest of the game, with a sentence each.
 *
 * A tab strip gives a screen one or two words and expects them to carry it.
 * "The Sheet", "Legacy" and "Contact sheet" carry nothing at all to somebody
 * who has not already opened them, and there was nowhere in the game that
 * said what any screen was for.
 */
const MORE: { id: Screen; label: string; blurb: string }[] = [
  { id: 'freeAgents', label: 'Free agents', blurb: 'Who is out of contract, what they want, and what they would bring.' },
  { id: 'promotion', label: 'Promotion', blurb: 'Your belts, your teams, your house style, and what the owner expects.' },
  {
    id: 'finance',
    label: 'Finance',
    blurb: 'Where last week went, and the ring, rig and truck you are working towards.',
  },
  { id: 'territories', label: 'Territories', blurb: 'The towns you can run, the venues in them, and what a ticket costs.' },
  { id: 'rankings', label: 'Rankings', blurb: 'Where your company sits against every other one in the business.' },
  { id: 'sheet', label: 'The Sheet', blurb: "The dirtsheet's weekly lists — who is hot, who is buried, who is leaving." },
  { id: 'records', label: 'Records', blurb: 'Win-loss records, title histories, and the longest reigns.' },
  { id: 'legacy', label: 'Legacy', blurb: 'The Hall of Fame, the retired, and the ones who are gone.' },
  {
    id: 'crucible',
    label: 'The Crucible',
    blurb: 'Every winner of the Iron Crown, the year they took it, and who they took it for.',
  },
  { id: 'contactSheet', label: 'Contact sheet', blurb: 'Every face in the game on one screen.' },
  {
    id: 'secrets',
    label: 'The quiet business',
    blurb: 'Whose deal is running out at a competitor, and being the one holding a pen when it does.',
  },
  { id: 'editor', label: 'Editor', blurb: 'Rename anybody, repackage them, or build somebody from scratch.' },
];

export function MoreScreen({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  return (
    <div className="p-3 pb-24">
      <h1 className="mb-3 text-lg font-bold text-neutral-100">Everything else</h1>
      <div className="flex flex-col gap-1.5">
        {MORE.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => onNavigate(entry.id)}
            className="rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-left transition hover:border-neutral-600"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-neutral-100">{entry.label}</span>
              <span className="shrink-0 text-neutral-600">›</span>
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-neutral-400">{entry.blurb}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Which screens sit behind More, so the bar can light the right tab. */
export const BEHIND_MORE = new Set<Screen>(MORE.map((e) => e.id));
