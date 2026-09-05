// Getting around, on a desktop window.
//
// This used to be a bottom tab bar with five destinations and a "More" list
// hiding the other fourteen behind a second tap — the right trade on a phone,
// where a horizontally-scrolling strip of thirteen tabs had clipped eight of
// them off-screen with no indication they existed. The game is not
// phone-tailored any more (see the root of `wrestling-booking-game/CLAUDE.md`):
// it's headed for a desktop window on Steam, which has the room to just show
// every destination at once, grouped, with the one-line blurb that used to
// justify a whole extra screen sitting right there under the label.
//
// So: a persistent left sidebar, always visible, nothing behind anything.

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
  | 'rivalRosters'
  | 'settings'
  /** One wrestler's own screen — the real destination for a name tapped from
   *  somewhere that isn't one of the three master-detail lists below. */
  | 'wrestlerDetail'
  /** One wrestler's whole feud history — current feuds first, then everything settled. */
  | 'feuds'
  /** Every pairing that has earned an all-time rivalry. */
  | 'allTimeRivals'
  /** Every pairing that told a genuinely memorable story, short of all-time. */
  | 'classicRivalries'
  /** Fill an empty or fill-eligible card slot — reached by tapping it from the card overview. */
  | 'slotPicker'
  /** A booked slot's own screen — competitors, stakes, and rules — reached by tapping it from the card overview. */
  | 'matchSetup'
  /** A watch-back of a decided match — reached by the Watch button on the results screen. */
  | 'matchViewer'
  /** One breaking-news story's own page — reached by tapping a card under Breaking News on the results screen. */
  | 'newsStory';

// ---------------------------------------------------------------------------
// The sidebar
// ---------------------------------------------------------------------------

interface SidebarItem {
  id: Screen;
  label: string;
  blurb: string;
}

const SIDEBAR_GROUPS: { label: string; items: SidebarItem[] }[] = [
  {
    label: 'Tonight',
    items: [
      { id: 'office', label: 'Office', blurb: 'Talk to your talent, and answer the calls only you can make.' },
      { id: 'booking', label: 'Card', blurb: "This week's show, slot by slot." },
      { id: 'results', label: 'Results', blurb: 'What actually happened, all at once.' },
    ],
  },
  {
    label: 'Talent',
    items: [
      {
        id: 'roster',
        label: 'Roster',
        blurb: 'Everyone signed here — stats, contracts, and the decisions that change a career.',
      },
      { id: 'freeAgents', label: 'Free agents', blurb: 'Who is out of contract right now, what they genuinely want, and what they actually bring to the table.' },
      {
        id: 'rivalRosters',
        label: 'The competition',
        blurb: "Every other company's full roster, and the career that got each and every one of them there.",
      },
      { id: 'contactSheet', label: 'Contact sheet', blurb: 'Every single face in this entire game, right there on one screen.' },
    ],
  },
  {
    label: 'Business',
    items: [
      { id: 'promotion', label: 'Promotion', blurb: 'Your belts, your teams, your house style, and exactly what the owner expects from you this year.' },
      {
        id: 'finance',
        label: 'Finance',
        blurb: 'Where every last dollar of last week went, and the ring, rig, and truck you are grinding toward.',
      },
      { id: 'territories', label: 'Territories', blurb: 'Every town you can run, the venues waiting in them, and what a ticket is actually worth there.' },
      { id: 'rankings', label: 'Rankings', blurb: 'Exactly where your company stands against every other one in this business.' },
    ],
  },
  {
    label: 'History',
    items: [
      { id: 'sheet', label: 'The Sheet', blurb: "The dirtsheet's weekly lists — who is red-hot, who is buried, who is walking out the door." },
      { id: 'records', label: 'Records', blurb: 'Win-loss records, title histories, and the longest reigns this business has ever seen.' },
      { id: 'legacy', label: 'Legacy', blurb: 'The Hall of Fame, the retired, and the ones who are gone for good.' },
      {
        id: 'crucible',
        label: 'The Crucible',
        blurb: 'Every single winner of the Iron Crown, the year they took it, and exactly who they took it from.',
      },
      {
        id: 'allTimeRivals',
        label: 'All-Time Rivals',
        blurb: 'The rare pairings that told more than one genuinely great story — earned, never handed out.',
      },
      {
        id: 'classicRivalries',
        label: 'Classic Rivalries',
        blurb: 'Every other pairing the crowd still remembers, one real story short of an all-time rivalry.',
      },
    ],
  },
  {
    label: 'Admin',
    items: [
      {
        id: 'secrets',
        label: 'The quiet business',
        blurb: 'Whose deal is running out at a competitor, and being the one holding the pen the second it does.',
      },
      { id: 'editor', label: 'Editor', blurb: 'Rename anybody, repackage them completely, or build somebody brand new from scratch.' },
      { id: 'settings', label: 'Settings', blurb: 'Export or load a save, erase one, and turn the screen transitions off if they are not your thing.' },
    ],
  },
];

export function Sidebar({
  screen,
  onNavigate,
  theme,
  officeBadge,
}: {
  screen: Screen;
  onNavigate: (screen: Screen) => void;
  theme: PromotionTheme;
  /** A story or an offer waiting on an answer. */
  officeBadge: boolean;
}) {
  return (
    <nav className="flex h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-neutral-800/80 bg-neutral-950/95 py-3">
      {SIDEBAR_GROUPS.map((group) => (
        <div key={group.label} className="mb-3 px-2.5">
          <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
            {group.label}
          </div>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = screen === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`w-full rounded-lg px-2.5 py-1.5 text-left transition ${
                    active ? `${theme.ink} bg-neutral-900 shadow-panel` : 'text-neutral-400 hover:bg-neutral-900/70 hover:text-neutral-200'
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-[13px] font-semibold">
                    {item.label}
                    {item.id === 'office' && officeBadge && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400 shadow-[0_0_6px_1px_rgba(251,191,36,0.7)]" />
                    )}
                  </span>
                  <span className="mt-0.5 block text-[10.5px] leading-snug text-neutral-600">{item.blurb}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
