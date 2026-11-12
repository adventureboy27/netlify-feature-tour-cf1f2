// The front door.
//
// Booting straight into the three-step new-game wizard was the app's first
// impression for months — no name on screen, no sense of what you were
// opening. A title screen is the cheapest, highest-leverage thing a game can
// have: one static screen the player sees exactly once per sitting, and it
// is the entire first impression.
//
// Inlined as a base64 data URI by Vite's raised assetsInlineLimit (see
// vite.config.ts) rather than fetched at runtime — what keeps `npm run play`
// a single openable file with nothing loaded over the network.

import { useGameStore } from '../../state/store';
import { savedGameSummary } from '../../state/persist';
import { getReducedMotionPreference } from '../reducedMotion';
import titleLogoUrl from '../assets/title-logo.jpg';

function Logo() {
  return (
    // The source frame is a flat charcoal rectangle — a soft mask fade tried
    // to hide that edge and just made it fuzzy instead of gone. Framing it on
    // purpose, like a plaque, reads as a choice rather than a fumbled attempt
    // at transparency: a hairline gold border echoing the belt's own trim,
    // rounded corners, and a shadow that lifts it off the page.
    <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-amber-700/40 shadow-hero">
      <img src={titleLogoUrl} alt="Pro Wrestling: Rival Booker Battle" className="block w-full select-none" />
    </div>
  );
}

export function TitleScreen({
  onNewGame,
  onSettings,
}: {
  onNewGame: () => void;
  onSettings: () => void;
}) {
  const continueGame = useGameStore((s) => s.continueGame);
  const saved = savedGameSummary();
  const reduceMotion = getReducedMotionPreference();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center overflow-hidden bg-neutral-950 px-6 py-10">
      {/* A quiet radial glow behind the wordmark rather than a flat panel —
          depth without a texture asset to bundle. */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 38%, rgba(217,119,6,0.14), transparent 70%)',
        }}
        aria-hidden
      />

      <div className={`relative ${reduceMotion ? '' : 'animate-rise-in'}`}>
        <Logo />
      </div>

      <div className="relative mt-10 flex w-full max-w-xs flex-col gap-2.5">
        {saved && (
          <button
            type="button"
            data-testid="title-continue"
            onClick={() => continueGame()}
            className="group flex flex-col items-center rounded-xl bg-gradient-to-b from-amber-500 to-amber-600 px-4 py-3 font-bold text-neutral-950 shadow-hero transition-transform active:scale-[0.97]"
          >
            <span className="text-sm">Continue</span>
            <span className="text-[11px] font-semibold text-amber-950/70">
              {saved.promotionName} · week {saved.week}
            </span>
          </button>
        )}
        <button
          type="button"
          data-testid="title-new-game"
          onClick={onNewGame}
          className={`rounded-xl border px-4 py-3 text-sm font-bold transition-all active:scale-[0.97] ${
            saved
              ? 'border-neutral-800 bg-neutral-900/80 text-neutral-200 hover:border-neutral-700'
              : 'bg-gradient-to-b from-amber-500 to-amber-600 text-neutral-950 shadow-hero'
          }`}
        >
          New Promotion
        </button>
        <button
          type="button"
          data-testid="title-settings"
          onClick={onSettings}
          className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3 text-sm font-semibold text-neutral-400 transition-all hover:border-neutral-700 hover:text-neutral-200 active:scale-[0.97]"
        >
          Settings
        </button>
      </div>

      <div className="relative mt-10 text-center text-[10px] uppercase tracking-[0.2em] text-neutral-700">
        Fully offline · your save never leaves this device
      </div>
    </div>
  );
}
