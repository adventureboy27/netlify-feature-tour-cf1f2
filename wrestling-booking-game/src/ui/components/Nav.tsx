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
import { usePref } from './Hint';
import type { ReactNode } from 'react';

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
  badges = {},
}: {
  /** Other destinations with something waiting. */
  badges?: Partial<Record<Screen, boolean>>;
  screen: Screen;
  onNavigate: (screen: Screen) => void;
  theme: PromotionTheme;
  /** A story or an offer waiting on an answer. */
  officeBadge: boolean;
}) {
  return (
    <nav className="flex h-screen w-48 shrink-0 flex-col overflow-y-auto border-r border-white/5 bg-gradient-to-b from-neutral-900/90 to-black py-3">
      {SIDEBAR_GROUPS.map((group) => (
        <SidebarGroup key={group.label} label={group.label} holdsCurrent={group.items.some((item) => item.id === screen)}>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = screen === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  aria-current={active ? 'page' : undefined}
                  // The description is still here — on hover, and for a screen
                  // reader — it just no longer takes three lines of the list.
                  title={item.blurb}
                  className={`relative w-full rounded-lg px-2.5 py-1.5 text-left transition ${
                    active
                      ? `${theme.ink} bg-gradient-to-r from-white/10 to-transparent shadow-panel before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-current`
                      : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-100'
                  }`}
                >
                  <span className="flex items-center gap-2 text-[13px] font-semibold">
                    <NavIcon id={item.id} />
                    {item.label}
                    {((item.id === 'office' && officeBadge) || badges[item.id]) && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400 shadow-[0_0_6px_1px_rgba(251,191,36,0.7)]" />
                    )}
                  </span>
                  <span className="sr-only">{item.blurb}</span>
                </button>
              );
            })}
          </div>
        </SidebarGroup>
      ))}
    </nav>
  );
}

/** One small line drawing per destination, so the list can be found by shape as well as by reading. */
const ICONS: Partial<Record<Screen, string>> = {
  office: 'M3 20V9l9-6 9 6v11h-6v-6H9v6z',
  booking: 'M5 3h14v18H5z M8 8h8 M8 12h8 M8 16h5',
  results: 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6L3.4 9.3l6-.7z',
  roster: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M2 20c0-3 3-5 6-5s6 2 6 5 M14 15c3 0 8 1 8 5',
  freeAgents: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21c0-4 4-6 8-6 M18 14v7 M14.5 17.5h7',
  rivalRosters: 'M4 4l16 16 M20 4L4 20 M4 4h5 M4 4v5 M20 4h-5 M20 4v5',
  contactSheet: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  promotion: 'M2 10h20v6H2z M9 6h6v14H9z M12 11.5v3',
  finance: 'M12 2v20 M17 6c-1-1.5-3-2-5-2-3 0-5 1.5-5 4s2 3.5 5 4 5 1.500 5 4-2 4-5 4c-2 0-4-.5-5-2',
  territories: 'M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.500 7 12 7 12z M12 11.500a2.500 2.500 0 1 0 0-5 2.500 2.500 0 0 0 0 5z',
  rankings: 'M4 21V11h4v10z M10 21V3h4v18z M16 21v-7h4v7z',
  sheet: 'M5 3h11l3 3v15H5z M8 9h8 M8 13h8 M8 17h5',
  records: 'M7 3h10v6a5 5 0 0 1-10 0z M7 5H3c0 4 2 5 4 5 M17 5h4c0 4-2 5-4 5 M12 14v4 M8 21h8',
  legacy: 'M3 21h18 M5 21V10 M9 21V10 M15 21V10 M19 21V10 M2 10l10-7 10 7z',
  crucible: 'M3 18l2-10 5 5 2-8 2 8 5-5 2 10z M3 21h18',
  allTimeRivals: 'M13 2L4 14h7l-1 8 9-12h-7z',
  classicRivalries: 'M12 21C5 16 3 12 3 8.500A4.500 4.500 0 0 1 12 6a4.500 4.500 0 0 1 9 2.500C21 12 19 16 12 21z',
  secrets: 'M6 11V8a6 6 0 1 1 12 0v3 M4 11h16v10H4z M12 15v3',
  editor: 'M4 20l1-5L16 4l4 4L9 19z M14 6l4 4',
  settings: 'M12 15.500a3.500 3.500 0 1 0 0-7 3.500 3.500 0 0 0 0 7z M12 2v3 M12 19v3 M2 12h3 M19 12h3 M4.900 4.900l2.100 2.100 M17 17l2.100 2.100 M19.100 4.900L17 7 M7 17l-2.100 2.100',
};
function NavIcon({ id }: { id: Screen }) {
  const d = ICONS[id];
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 opacity-80" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {d ? <path d={d} /> : <circle cx={12} cy={12} r={3} />}
    </svg>
  );
}

/** The weekly loop and the roster stay open; the archive and the admin fold away until wanted. */
const FOLDED_BY_DEFAULT = new Set(['History', 'Admin']);

function SidebarGroup({ label, holdsCurrent, children }: { label: string; holdsCurrent: boolean; children: ReactNode }) {
  const [folded, setFolded] = usePref(`nav.folded.${label}`, FOLDED_BY_DEFAULT.has(label));
  // Never hide the screen you are on.
  const open = !folded || holdsCurrent;
  return (
    <div className="mb-3 px-2.5">
      <button
        type="button"
        onClick={() => setFolded(!folded)}
        aria-expanded={open}
        className="mb-1 flex w-full items-center justify-between px-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-600 hover:text-neutral-400"
      >
        {label}
        <span aria-hidden>{open ? '–' : '+'}</span>
      </button>
      {open && children}
    </div>
  );
}
