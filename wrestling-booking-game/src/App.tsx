// M2 shell — the playable loop. Book a card, run the show, read the results,
// advance a week. §8's full weekly order (the office, travel, the world tick)
// arrives with the milestones that own those systems; this is the spine they
// hang on.
import { useEffect, useState } from 'react';
import { weekLine } from './engine/world/calendar';
import { useGameStore } from './state/store';
import { BookingScreen } from './ui/screens/BookingScreen';
import { OfficeScreen } from './ui/screens/OfficeScreen';
import { PromotionScreen } from './ui/screens/PromotionScreen';
import { FreeAgentsScreen } from './ui/screens/FreeAgentsScreen';
import { RosterScreen } from './ui/screens/RosterScreen';
import { TerritoriesScreen } from './ui/screens/TerritoriesScreen';
import { ShowResults } from './ui/screens/ShowResults';
import { ContactSheet } from './ui/screens/ContactSheet';
import { WrestlerEditor } from './ui/screens/WrestlerEditor';
import { NewGameScreen } from './ui/screens/NewGameScreen';
import { LegacyScreen } from './ui/screens/LegacyScreen';
import { CrucibleScreen } from './ui/screens/CrucibleScreen';
import { FinanceScreen } from './ui/screens/FinanceScreen';
import { RecordsScreen } from './ui/screens/RecordsScreen';
import { RankingsScreen } from './ui/screens/RankingsScreen';
import { SheetScreen } from './ui/screens/SheetScreen';
import { SecretsScreen } from './ui/screens/SecretsScreen';
import { Money } from './ui/components/display';
import { promotionTheme } from './ui/components/chrome';
import { BottomNav, MoreScreen, BEHIND_MORE, type Screen } from './ui/components/Nav';

export default function App() {
  const world = useGameStore((s) => s.world);
  const resolveWeek = useGameStore((s) => s.resolveWeek);
  const saveNow = useGameStore((s) => s.saveNow);
  const [screen, setScreen] = useState<Screen>('booking');
  /** Who the editor is currently repackaging, if anybody. */
  const [repackaging, setRepackaging] = useState<string | null>(null);

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
      navigate('office');
      return;
    }
    resolveWeek();
    // Straight to the top of the marquee. Running the show from halfway down
    // the card screen used to drop you halfway down the results.
    navigate('results');
  }

  // A story waiting on a decision is worth a badge — it's easy to miss a tab.
  const officeBadge = world.pendingEvent !== null || world.approachOffers.length > 0;
  const theme = promotionTheme(world.promotion.identity);

  function navigate(next: Screen) {
    if (next !== 'editor') setRepackaging(null);
    setScreen(next);
    // A destination reached from More opens at the top, not wherever the
    // previous screen happened to be scrolled to.
    window.scrollTo(0, 0);
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* The status bar: who you are, what week it is, and what is in the
          bank. The promotion's own name appeared nowhere in the shell, which
          for a game about building one is an odd thing to leave out. */}
      <header className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-900/95 backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <div className="min-w-0">
            <div className={`truncate text-sm font-bold leading-tight ${theme.ink}`}>{world.promotion.name}</div>
            <div className="text-[11px] leading-tight text-neutral-500">
              {/* No dates, ever. A promotion thinks in "the week before the
                  pay-per-view", not in the fourteenth of March — so the shell
                  says the month and which week of it. See engine/world/calendar.ts. */}
              {weekLine(world.week, world.settings)}
              <span className="mx-1 text-neutral-700">·</span>
              company rating {Math.round(world.promotion.rating)}
              {world.promotion.hardcoreSaturation > 25 && (
                <span className="ml-1.5 text-amber-500" title="Booked violence is wearing the audience down">
                  crowd desensitised
                </span>
              )}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[10px] uppercase tracking-wider text-neutral-600">Bank</div>
            <div className="text-sm font-semibold tabular-nums">
              <Money amount={world.promotion.bankBalance} />
            </div>
          </div>
        </div>
      </header>

      {/* Room for the bar, so the last row of any screen is reachable rather
          than sitting underneath it. */}
      <main className="pb-16">
        {screen === 'more' && <MoreScreen onNavigate={navigate} />}
        {screen === 'office' && <OfficeScreen />}
        {screen === 'booking' && <BookingScreen onRunShow={runShow} />}
        {screen === 'promotion' && <PromotionScreen />}
        {screen === 'roster' && (
          <RosterScreen
            onRepackage={(wrestlerId) => {
              setRepackaging(wrestlerId);
              navigate('editor');
            }}
          />
        )}
        {screen === 'territories' && <TerritoriesScreen />}
        {screen === 'finance' && <FinanceScreen />}
        {screen === 'freeAgents' && <FreeAgentsScreen />}
        {screen === 'results' &&
          (lastShow ? (
            <ShowResults show={lastShow} onContinue={() => navigate('booking')} />
          ) : (
            <p className="p-6 text-center text-sm text-neutral-500">No show has run yet.</p>
          ))}
        {screen === 'rankings' && <RankingsScreen />}
        {screen === 'sheet' && <SheetScreen />}
        {screen === 'secrets' && <SecretsScreen />}
        {screen === 'records' && <RecordsScreen />}
        {screen === 'legacy' && <LegacyScreen />}
        {screen === 'crucible' && <CrucibleScreen />}
        {screen === 'contactSheet' && <ContactSheet />}
        {screen === 'editor' && (
          <WrestlerEditor
            // Keyed so switching to a different wrestler reloads the form
            // rather than keeping the last one's name in the fields.
            key={repackaging ?? 'sandbox'}
            wrestlerId={repackaging ?? undefined}
            onDone={() => {
              setRepackaging(null);
              navigate('roster');
            }}
          />
        )}
      </main>

      <BottomNav
        screen={screen}
        onNavigate={navigate}
        theme={theme}
        officeBadge={officeBadge}
        moreBadge={BEHIND_MORE.has(screen)}
      />
    </div>
  );
}
