// M2 shell — the playable loop. Book a card, run the show, read the results,
// advance a week. §8's full weekly order (the office, travel, the world tick)
// arrives with the milestones that own those systems; this is the spine they
// hang on.
import { useEffect, useState } from 'react';
import { useGameStore } from './state/store';
import { BookingScreen } from './ui/screens/BookingScreen';
import { OfficeScreen } from './ui/screens/OfficeScreen';
import { PromotionScreen } from './ui/screens/PromotionScreen';
import { FreeAgentsScreen } from './ui/screens/FreeAgentsScreen';
import { RosterScreen } from './ui/screens/RosterScreen';
import { ShowResults } from './ui/screens/ShowResults';
import { ContactSheet } from './ui/screens/ContactSheet';
import { WrestlerEditor } from './ui/screens/WrestlerEditor';
import { NewGameScreen } from './ui/screens/NewGameScreen';
import { LegacyScreen } from './ui/screens/LegacyScreen';
import { RecordsScreen } from './ui/screens/RecordsScreen';
import { RankingsScreen } from './ui/screens/RankingsScreen';
import { SheetScreen } from './ui/screens/SheetScreen';
import { Money } from './ui/components/display';

type Screen =
  | 'office'
  | 'booking'
  | 'promotion'
  | 'roster'
  | 'freeAgents'
  | 'results'
  | 'rankings'
  | 'sheet'
  | 'records'
  | 'legacy'
  | 'contactSheet'
  | 'editor';

const TABS: { id: Screen; label: string }[] = [
  { id: 'office', label: 'Office' },
  { id: 'booking', label: 'Card' },
  { id: 'promotion', label: 'Promotion' },
  { id: 'roster', label: 'Roster' },
  { id: 'freeAgents', label: 'Free agents' },
  { id: 'results', label: 'Results' },
  { id: 'rankings', label: 'Rankings' },
  { id: 'sheet', label: 'The Sheet' },
  { id: 'records', label: 'Records' },
  { id: 'legacy', label: 'Legacy' },
  { id: 'contactSheet', label: 'Contact sheet' },
  { id: 'editor', label: 'Editor' },
];

export default function App() {
  const world = useGameStore((s) => s.world);
  const resolveWeek = useGameStore((s) => s.resolveWeek);
  const saveNow = useGameStore((s) => s.saveNow);
  const [screen, setScreen] = useState<Screen>('booking');

  // Autosave. The world is plain data, so this is cheap; debounced so that
  // typing in a text field does not write a save on every keystroke.
  useEffect(() => {
    if (!world) return;
    const handle = setTimeout(() => saveNow(), 800);
    return () => clearTimeout(handle);
  }, [world, saveNow]);

  if (!world) return <NewGameScreen />;

  const lastShow = world.showHistory[world.showHistory.length - 1] ?? null;

  function runShow() {
    if (world?.folded) {
      setScreen('office');
      return;
    }
    resolveWeek();
    setScreen('results');
  }

  // A story waiting on a decision is worth a badge — it's easy to miss a tab.
  const officeBadge = world.pendingEvent !== null || world.tamperingOffers.length > 0;

  return (
    <div className="min-h-screen bg-neutral-950">
      <header className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-900">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="text-sm">
            <span className="font-semibold text-neutral-100">Week {world.week}</span>
            <span className="ml-2 text-neutral-500">
              <Money amount={world.promotion.bankBalance} />
            </span>
          </div>
          <div className="text-[11px] text-neutral-500">
            company rating {Math.round(world.promotion.rating)}
            {world.promotion.hardcoreSaturation > 25 && (
              <span className="ml-2 text-amber-500" title="Booked violence is wearing the audience down">
                crowd desensitised
              </span>
            )}
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setScreen(tab.id)}
              className={`shrink-0 rounded px-3 py-1.5 text-xs ${screen === tab.id ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300'}`}
            >
              {tab.label}
              {tab.id === 'office' && officeBadge && <span className="ml-1 text-amber-400">●</span>}
            </button>
          ))}
        </nav>
      </header>

      {screen === 'office' && <OfficeScreen />}
      {screen === 'booking' && <BookingScreen onRunShow={runShow} />}
      {screen === 'promotion' && <PromotionScreen />}
      {screen === 'roster' && <RosterScreen />}
      {screen === 'freeAgents' && <FreeAgentsScreen />}
      {screen === 'results' &&
        (lastShow ? (
          <ShowResults show={lastShow} onContinue={() => setScreen('booking')} />
        ) : (
          <p className="p-6 text-center text-sm text-neutral-500">No show has run yet.</p>
        ))}
      {screen === 'rankings' && <RankingsScreen />}
      {screen === 'sheet' && <SheetScreen />}
      {screen === 'records' && <RecordsScreen />}
      {screen === 'legacy' && <LegacyScreen />}
      {screen === 'contactSheet' && <ContactSheet />}
      {screen === 'editor' && <WrestlerEditor />}
    </div>
  );
}
