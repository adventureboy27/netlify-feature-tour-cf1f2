// The week, as the four things you do in it.
//
// The game has always been a loop — see who is at your door, book the card,
// run the show, read what happened — and the shell showed it as three equal
// links in a list of twenty. This puts the loop across the top of every
// screen: where you are in it, what is still outstanding, and one button
// for the next thing.
//
// DESIGN: it reports and it navigates; it never advises. "2 of 6 booked" is
// a fact about the card. Whether an empty slot is a mistake is the player's
// to find out — the game does not warn anybody before a bad decision, and a
// half-booked card can still be run from here.

import type { Screen } from './Nav';

export interface WeekState {
  /** Calls and offers waiting on an answer. */
  officeWaiting: number;
  booked: number;
  slots: number;
  /** A show has run and its results have not been opened yet. */
  resultsUnread: boolean;
  /** There is a last show to read at all. */
  hasResults: boolean;
  folded: boolean;
}

export function WeekStrip({ state, screen, onNavigate, onRunShow, accent }: { state: WeekState; screen: Screen; onNavigate: (screen: Screen) => void; onRunShow: () => void; accent: string }) {
  const steps: { id: Screen; label: string; note: string; attention: boolean }[] = [
    { id: 'office', label: 'Office', note: state.officeWaiting > 0 ? `${state.officeWaiting} waiting` : 'quiet', attention: state.officeWaiting > 0 },
    { id: 'booking', label: 'Card', note: `${state.booked} of ${state.slots} booked`, attention: false },
    { id: 'results', label: 'Results', note: state.resultsUnread ? 'unread' : state.hasResults ? 'last show' : 'none yet', attention: state.resultsUnread },
  ];
  // The next thing, in the order the week actually goes.
  const next: { label: string; go: () => void } = state.resultsUnread
    ? { label: 'Read the results', go: () => onNavigate('results') }
    : state.officeWaiting > 0 && screen !== 'office'
      ? { label: 'Answer the office', go: () => onNavigate('office') }
      : screen !== 'booking'
        ? { label: 'Go to the card', go: () => onNavigate('booking') }
        : { label: 'Run the show', go: onRunShow };
  return (
    <div data-testid="week-strip" className="flex items-center gap-1 border-t border-white/5 bg-black/30 px-4 py-2">
      <span className="font-display mr-3 text-[13px] text-neutral-500">This week</span>
      {steps.map((step, i) => {
        const here = screen === step.id;
        return (
          <div key={step.id} className="flex items-center gap-1">
            {i > 0 && <span className="h-px w-6 bg-neutral-700" aria-hidden />}
            <button
              type="button"
              onClick={() => onNavigate(step.id)}
              aria-current={here ? 'step' : undefined}
              className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-left transition ${here ? 'border-amber-400/60 bg-neutral-800 text-neutral-50' : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200'}`}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-black ${here ? 'step-here bg-amber-400 text-neutral-950' : step.attention ? 'bg-amber-500/90 text-neutral-950' : 'bg-neutral-800 text-neutral-400'}`}>{i + 1}</span>
              <span className="text-[12px] font-bold">{step.label}</span>
              <span className={`text-[10.5px] ${step.attention ? 'font-semibold text-amber-300' : 'text-neutral-500'}`}>{step.note}</span>
            </button>
          </div>
        );
      })}
      <button
        type="button"
        data-testid="week-next"
        onClick={next.go}
        disabled={state.folded}
        className={`font-display ml-auto flex items-center gap-2 rounded-lg px-4 py-2 text-[15px] text-white shadow-lg shadow-black/50 transition hover:brightness-110 disabled:opacity-40 ${accent}`}
      >
        {next.label}
        <span aria-hidden>→</span>
      </button>
    </div>
  );
}
