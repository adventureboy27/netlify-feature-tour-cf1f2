// M2 shell — the playable loop. Book a card, run the show, read the results,
// advance a week. §8's full weekly order (the office, travel, the world tick)
// arrives with the milestones that own those systems; this is the spine they
// hang on.
import { useEffect, useState } from 'react';
import type { Id } from './engine/types';
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
import { WrestlerDetailScreen } from './ui/screens/WrestlerDetailScreen';
import { SlotRosterPicker } from './ui/screens/SlotRosterPicker';
import { MatchSetupScreen } from './ui/screens/MatchSetupScreen';
import { MatchViewerScreen } from './ui/screens/MatchViewerScreen';
import { NewGameScreen } from './ui/screens/NewGameScreen';
import { TitleScreen } from './ui/screens/TitleScreen';
import { SettingsScreen } from './ui/screens/SettingsScreen';
import { LegacyScreen } from './ui/screens/LegacyScreen';
import { CrucibleScreen } from './ui/screens/CrucibleScreen';
import { FinanceScreen } from './ui/screens/FinanceScreen';
import { RecordsScreen } from './ui/screens/RecordsScreen';
import { RankingsScreen } from './ui/screens/RankingsScreen';
import { RivalRosterScreen } from './ui/screens/RivalRosterScreen';
import { SheetScreen } from './ui/screens/SheetScreen';
import { SecretsScreen } from './ui/screens/SecretsScreen';
import { Money } from './ui/components/display';
import { promotionTheme } from './ui/components/chrome';
import { Sidebar, type Screen } from './ui/components/Nav';
import { getReducedMotionPreference } from './ui/reducedMotion';

/** Before a world exists, the app is a much smaller state machine — the title screen and its two doors. */
type PreGameView = 'title' | 'newGame' | 'settings';

/** One entry on the navigation stack — which screen, and (for a drill-down screen) which id or slot it's about. */
interface NavTarget {
  screen: Screen;
  params?: { wrestlerId?: Id; slotIndex?: number; matchWeek?: number; matchSlot?: number };
}

export default function App() {
  const world = useGameStore((s) => s.world);
  const resolveWeek = useGameStore((s) => s.resolveWeek);
  const saveNow = useGameStore((s) => s.saveNow);
  // A small typed stack rather than a flat screen id, so a drill-down screen
  // (a wrestler's detail page, say) can navigate to another instance of
  // itself — tapping a tag partner from inside one detail screen needs to
  // push a second one on top, which a single "current screen" variable can't
  // express. Every sidebar destination stays a lateral move (see resetTo
  // below), not a push — only drill-down screens grow this stack.
  const [navStack, setNavStack] = useState<NavTarget[]>([{ screen: 'booking' }]);
  const [preGameView, setPreGameView] = useState<PreGameView>('title');
  const screen = navStack[navStack.length - 1]!.screen;
  const params = navStack[navStack.length - 1]!.params;
  const reduceMotion = getReducedMotionPreference();

  // Autosave. The world is plain data, so this is cheap; debounced so that
  // typing in a text field does not write a save on every keystroke.
  useEffect(() => {
    if (!world) return;
    const handle = setTimeout(() => saveNow(), 800);
    return () => clearTimeout(handle);
  }, [world, saveNow]);

  if (!world) {
    if (preGameView === 'newGame') return <NewGameScreen />;
    if (preGameView === 'settings') return <SettingsScreen onBack={() => setPreGameView('title')} />;
    return <TitleScreen onNewGame={() => setPreGameView('newGame')} onSettings={() => setPreGameView('settings')} />;
  }

  const lastShow = world.showHistory[world.showHistory.length - 1] ?? null;

  function runShow() {
    if (world?.folded) {
      resetTo('office');
      return;
    }
    resolveWeek();
    // Straight to the top of the marquee. Running the show from halfway down
    // the card screen used to drop you halfway down the results.
    resetTo('results');
  }

  // A story waiting on a decision is worth a badge — it's easy to miss a tab.
  const officeBadge = world.pendingEvent !== null || world.approachOffers.length > 0;
  const theme = promotionTheme(world.promotion.identity);

  /** Drill down — push a new screen on top, so a later goBack() returns here. */
  function goTo(target: NavTarget) {
    setNavStack((stack) => [...stack, target]);
    window.scrollTo(0, 0);
  }

  /** Return to whatever pushed the current screen. */
  function goBack() {
    setNavStack((stack) => (stack.length > 1 ? stack.slice(0, -1) : [{ screen: 'booking' }]));
    window.scrollTo(0, 0);
  }

  /**
   * A lateral move — every sidebar destination — replaces the whole stack
   * rather than pushing, so none of those carry a back arrow. A destination
   * reached this way opens at the top, not wherever the previous screen
   * happened to be scrolled to.
   */
  function resetTo(next: Screen) {
    setNavStack([{ screen: next }]);
    window.scrollTo(0, 0);
  }

  return (
    <div className="flex h-screen bg-neutral-950">
      <Sidebar screen={screen} onNavigate={resetTo} theme={theme} officeBadge={officeBadge} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* The status bar: who you are, what week it is, and what is in the
            bank. The promotion's own name appeared nowhere in the shell, which
            for a game about building one is an odd thing to leave out. A
            hairline wash of the house color says whose save this is before a
            single word is read. */}
        <header
          className={`sticky top-0 z-10 border-b border-neutral-800/80 bg-gradient-to-b ${theme.wash} to-neutral-950/95 bg-neutral-950/95 backdrop-blur-md`}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className={`truncate text-base font-black leading-tight tracking-tight ${theme.ink}`}>
                {world.promotion.name}
              </div>
              <div className="mt-0.5 text-[11px] leading-tight text-neutral-500">
                {/* No dates, ever. A promotion thinks in "the week before the
                    pay-per-view", not in the fourteenth of March — so the shell
                    says the month and which week of it. See engine/world/calendar.ts. */}
                {weekLine(world.week, world.settings)}
                <span className="mx-1.5 text-neutral-700">·</span>
                <span className="text-neutral-400">rating {Math.round(world.promotion.rating)}</span>
                {world.promotion.hardcoreSaturation > 25 && (
                  <span className="ml-1.5 text-amber-500" title="Booked violence is wearing the audience down">
                    crowd desensitised
                  </span>
                )}
              </div>
            </div>
            <div className="shrink-0 rounded-lg border border-neutral-800 bg-neutral-900/80 px-2.5 py-1.5 text-right shadow-panel">
              <div className="text-[9px] font-semibold uppercase tracking-wider text-neutral-500">Bank</div>
              <div className="text-sm font-bold tabular-nums text-neutral-50">
                <Money amount={world.promotion.bankBalance} />
              </div>
            </div>
          </div>
        </header>

        {/* Keyed off the *whole* nav target, not just the screen id — a
            drill-down screen can navigate to another instance of itself (a
            wrestler's detail page linking to another wrestler's, or one card
            slot to another), and keying on the screen id alone would leave
            React seeing "the same screen" and refuse to remount, so the
            previous subject's data and scroll position would silently
            linger. Every navigation is a quiet settle-in rather than a hard
            cut — the same beat a broadcast uses between segments. */}
        <main
          key={`${screen}:${params?.wrestlerId ?? ''}:${params?.slotIndex ?? ''}:${params?.matchWeek ?? ''}:${params?.matchSlot ?? ''}`}
          className={`min-h-0 flex-1 overflow-y-auto ${reduceMotion ? '' : 'animate-rise-in'}`}
        >
          {screen === 'settings' && <SettingsScreen onBack={() => resetTo('booking')} />}
          {screen === 'office' && <OfficeScreen />}
          {screen === 'booking' && (
            <BookingScreen
              onRunShow={runShow}
              onOpenSlot={(slotIndex, cast) =>
                goTo({ screen: cast ? 'matchSetup' : 'slotPicker', params: { slotIndex } })
              }
            />
          )}
          {screen === 'promotion' && <PromotionScreen />}
          {screen === 'roster' && (
            <RosterScreen
              onNavigate={(wrestlerId) => goTo({ screen: 'wrestlerDetail', params: { wrestlerId } })}
              onRepackage={(wrestlerId) => goTo({ screen: 'editor', params: { wrestlerId } })}
            />
          )}
          {screen === 'territories' && <TerritoriesScreen />}
          {screen === 'finance' && <FinanceScreen />}
          {screen === 'freeAgents' && (
            <FreeAgentsScreen onNavigate={(wrestlerId) => goTo({ screen: 'wrestlerDetail', params: { wrestlerId } })} />
          )}
          {screen === 'results' &&
            (lastShow ? (
              <ShowResults
                show={lastShow}
                onContinue={() => resetTo('booking')}
                onWatch={(slot) => goTo({ screen: 'matchViewer', params: { matchWeek: lastShow.week, matchSlot: slot } })}
              />
            ) : (
              <p className="p-6 text-center text-sm text-neutral-500">No show has run yet.</p>
            ))}
          {screen === 'rankings' && <RankingsScreen />}
          {screen === 'rivalRosters' && (
            <RivalRosterScreen onNavigate={(wrestlerId) => goTo({ screen: 'wrestlerDetail', params: { wrestlerId } })} />
          )}
          {screen === 'sheet' && <SheetScreen />}
          {screen === 'secrets' && <SecretsScreen />}
          {screen === 'records' && <RecordsScreen />}
          {screen === 'legacy' && <LegacyScreen />}
          {screen === 'crucible' && <CrucibleScreen />}
          {screen === 'contactSheet' && <ContactSheet />}
          {screen === 'editor' && <WrestlerEditor wrestlerId={params?.wrestlerId} onDone={goBack} />}
          {screen === 'wrestlerDetail' && params?.wrestlerId && (
            <WrestlerDetailScreen
              wrestlerId={params.wrestlerId}
              onBack={goBack}
              onNavigateWrestler={(wrestlerId) => goTo({ screen: 'wrestlerDetail', params: { wrestlerId } })}
              onRepackage={(wrestlerId) => goTo({ screen: 'editor', params: { wrestlerId } })}
            />
          )}
          {screen === 'slotPicker' && params?.slotIndex !== undefined && (
            <SlotRosterPicker
              slotIndex={params.slotIndex}
              onBack={goBack}
              onNavigateWrestler={(wrestlerId) => goTo({ screen: 'wrestlerDetail', params: { wrestlerId } })}
            />
          )}
          {screen === 'matchSetup' && params?.slotIndex !== undefined && (
            <MatchSetupScreen
              slotIndex={params.slotIndex}
              onBack={goBack}
              onNavigateWrestler={(wrestlerId) => goTo({ screen: 'wrestlerDetail', params: { wrestlerId } })}
              onAddMore={() => goTo({ screen: 'slotPicker', params: { slotIndex: params.slotIndex! } })}
            />
          )}
          {screen === 'matchViewer' && params?.matchWeek !== undefined && params?.matchSlot !== undefined && (
            <MatchViewerScreen matchWeek={params.matchWeek} matchSlot={params.matchSlot} onBack={goBack} />
          )}
        </main>
      </div>
    </div>
  );
}
