// Options.
//
// Reachable two ways: from the title screen before a save exists, and from
// More once one is running — same screen either way, since "erase my save"
// and "turn off motion" are both things a player wants regardless of which
// door they came through. What differs is only what there is to show: the
// save-file import/export tools need a running world, so they simply don't
// render without one rather than the screen forking into two components.

import { useState } from 'react';
import { useGameStore } from '../../state/store';
import { clearSave, savedGameSummary } from '../../state/persist';
import { FileTransfer } from '../components/FileTransfer';
import { Panel, SectionHead, Badge } from '../components/chrome';
import { getReducedMotionPreference, setReducedMotionPreference } from '../reducedMotion';

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const world = useGameStore((s) => s.world);
  const [reduceMotion, setReduceMotion] = useState(getReducedMotionPreference);
  const [erased, setErased] = useState(false);
  const saved = savedGameSummary();

  return (
    // min-h-screen and the background color are redundant when this renders
    // inside App's own wrapper (reached via More, mid-game) — but load-
    // bearing when it renders before a world exists, from the title screen,
    // where this is the only thing standing between the page and
    // browser-default white.
    <div className="min-h-screen bg-neutral-950 p-3 pb-24 text-neutral-100">
      <div className="mx-auto max-w-lg">
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            data-testid="settings-back"
            className="rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs font-semibold text-neutral-400 transition hover:text-neutral-200"
          >
            ← Back
          </button>
          <h1 className="text-xl font-black tracking-tight">Settings</h1>
        </div>

        <SectionHead>Display</SectionHead>
        <Panel className="p-3">
          <label className="flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-sm font-medium">Reduce motion</span>
              <span className="block text-[11px] text-neutral-500">
                Turns off the settle-in animation between screens. Nothing in the sim itself is timed by it.
              </span>
            </span>
            <input
              type="checkbox"
              data-testid="settings-reduce-motion"
              checked={reduceMotion}
              onChange={(e) => {
                setReduceMotion(e.target.checked);
                setReducedMotionPreference(e.target.checked);
              }}
              className="h-5 w-5 shrink-0 accent-amber-500"
            />
          </label>
        </Panel>

        {world && (
          <>
            <SectionHead>Your save</SectionHead>
            <Panel className="p-3">
              <FileTransfer />
            </Panel>
          </>
        )}

        <SectionHead>Data</SectionHead>
        <Panel className="p-3">
          {saved ? (
            erased ? (
              <p className="text-xs text-emerald-400">
                That save is gone. Closing this screen goes back to a clean title screen.
              </p>
            ) : (
              <>
                <p className="mb-2 text-[11px] text-neutral-500">
                  Erases <span className="font-medium text-neutral-300">{saved.promotionName}</span> (week{' '}
                  {saved.week}) from this device entirely. There is no undo — export it to a file first if there is
                  any chance you want it back.
                </p>
                <button
                  type="button"
                  data-testid="settings-erase-save"
                  onClick={() => {
                    if (!window.confirm(`Permanently erase ${saved.promotionName}? This cannot be undone.`)) return;
                    clearSave();
                    setErased(true);
                  }}
                  className="rounded-lg bg-rose-900/60 px-3 py-2 text-xs font-semibold text-rose-200 ring-1 ring-inset ring-rose-700/50 transition hover:bg-rose-900"
                >
                  Erase saved promotion
                </button>
              </>
            )
          ) : (
            <p className="text-xs text-neutral-600">No save on this device.</p>
          )}
        </Panel>

        <SectionHead>About</SectionHead>
        <Panel className="p-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">Rival Promotions</span>
            <Badge tone="info">Wrestling Booker Edition</Badge>
          </div>
          <p className="mt-1 text-[11px] text-neutral-500">
            Fully offline. Nothing here is ever sent anywhere — your save lives only in this browser unless you
            export it yourself.
          </p>
        </Panel>
      </div>
    </div>
  );
}
