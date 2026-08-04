// M2 shell — the playable loop. Book a card, run the show, read the results,
// advance a week. §8's full weekly order (the office, travel, the world tick)
// arrives with the milestones that own those systems; this is the spine they
// hang on.
import { useEffect, useState } from 'react';
import { useGameStore } from './state/store';
import { BookingScreen } from './ui/screens/BookingScreen';
import { RosterScreen } from './ui/screens/RosterScreen';
import { ShowResults } from './ui/screens/ShowResults';
import { ContactSheet } from './ui/screens/ContactSheet';
import { WrestlerEditor } from './ui/screens/WrestlerEditor';
import { Money } from './ui/components/display';

type Screen = 'booking' | 'roster' | 'results' | 'contactSheet' | 'editor';

const TABS: { id: Screen; label: string }[] = [
  { id: 'booking', label: 'Card' },
  { id: 'roster', label: 'Roster' },
  { id: 'results', label: 'Results' },
  { id: 'contactSheet', label: 'Contact sheet' },
  { id: 'editor', label: 'Editor' },
];

export default function App() {
  const world = useGameStore((s) => s.world);
  const newGame = useGameStore((s) => s.newGame);
  const resolveWeek = useGameStore((s) => s.resolveWeek);
  const [screen, setScreen] = useState<Screen>('booking');

  useEffect(() => {
    if (!world) newGame();
  }, [world, newGame]);

  if (!world) return <div className="min-h-screen bg-neutral-950" />;

  const lastShow = world.showHistory[world.showHistory.length - 1] ?? null;

  function runShow() {
    resolveWeek();
    setScreen('results');
  }

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
            </button>
          ))}
        </nav>
      </header>

      {screen === 'booking' && <BookingScreen onRunShow={runShow} />}
      {screen === 'roster' && <RosterScreen />}
      {screen === 'results' &&
        (lastShow ? (
          <ShowResults show={lastShow} onContinue={() => setScreen('booking')} />
        ) : (
          <p className="p-6 text-center text-sm text-neutral-500">No show has run yet.</p>
        ))}
      {screen === 'contactSheet' && <ContactSheet />}
      {screen === 'editor' && <WrestlerEditor />}
    </div>
  );
}
