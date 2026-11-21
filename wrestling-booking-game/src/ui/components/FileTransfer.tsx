// Getting things in and out of the browser.
//
// Two jobs. The save is the promotion you have run for thirty simulated years,
// which currently lives in one browser's localStorage and is one cleared cache
// from gone; the roster file is the one people actually want, because it is
// how their own wrestlers get in.
//
// Everything here is a Blob and a file input. Fully offline (CLAUDE.md) —
// nothing is uploaded anywhere, and nothing here can be.

import { useRef, useState } from 'react';
import { useGameStore } from '../../state/store';
import { saveFilename } from '../../state/persist';

function download(text: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function FileTransfer() {
  const world = useGameStore((s) => s.world);
  const exportSaveFile = useGameStore((s) => s.exportSaveFile);
  const importSaveFile = useGameStore((s) => s.importSaveFile);
  const exportRosterFile = useGameStore((s) => s.exportRosterFile);
  const importRosterFile = useGameStore((s) => s.importRosterFile);

  const saveInput = useRef<HTMLInputElement>(null);
  const rosterInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);

  if (!world) return null;

  const readFile = async (file: File): Promise<string> => file.text();

  return (
    <section className="mb-4">
      <h2 className="mb-1 text-sm font-medium text-neutral-300">Files</h2>
      <p className="mb-2 text-[11px] text-neutral-500">
        Everything stays right on this device. A save is the entire promotion; a roster is just the people, and it
        can be dropped straight into any game.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          data-testid="export-save"
          onClick={() => {
            const text = exportSaveFile();
            if (text) download(text, saveFilename(world));
          }}
          className="rounded bg-neutral-800 px-3 py-2 text-xs hover:bg-neutral-700"
        >
          Save to a file
        </button>
        <button
          type="button"
          data-testid="import-save"
          onClick={() => saveInput.current?.click()}
          className="rounded bg-neutral-800 px-3 py-2 text-xs hover:bg-neutral-700"
        >
          Load a save
        </button>
        <button
          type="button"
          data-testid="export-roster"
          onClick={() => {
            const text = exportRosterFile();
            if (text) download(text, `${saveFilename(world).replace('.wbg.json', '')}-roster.json`);
          }}
          className="rounded bg-neutral-800 px-3 py-2 text-xs hover:bg-neutral-700"
        >
          Export the roster
        </button>
        <button
          type="button"
          data-testid="import-roster"
          onClick={() => rosterInput.current?.click()}
          className="rounded bg-neutral-800 px-3 py-2 text-xs hover:bg-neutral-700"
        >
          Import a roster
        </button>
      </div>

      {message && (
        <p
          data-testid="file-message"
          className={`mt-2 whitespace-pre-line text-[11px] ${message.bad ? 'text-rose-400' : 'text-emerald-400'}`}
        >
          {message.text}
        </p>
      )}

      {/* Loading a save replaces the running game, which is the one genuinely
          destructive thing on this screen, so it asks first. */}
      <input
        ref={saveInput}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          if (!window.confirm('Loading a save replaces the promotion you are running now. Continue?')) return;
          const result = importSaveFile(await readFile(file));
          setMessage(
            result.ok
              ? { text: 'Save loaded.', bad: false }
              : { text: result.error ?? 'That save could not be read.', bad: true },
          );
        }}
      />

      <input
        ref={rosterInput}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          const { added, problems } = importRosterFile(await readFile(file));
          // Everything that was wrong with the file is said out loud. A silent
          // import that quietly dropped half a roster is worse than a refusal.
          const lines = [
            added > 0 ? `${added} added to the free agent pool. Go and sign them.` : 'Nobody was added.',
            ...problems,
          ];
          setMessage({ text: lines.join('\n'), bad: added === 0 });
        }}
      />
    </section>
  );
}
