// Things the interface remembers about this player, on this machine: which
// explanations they have read, which panels they folded away. None of it is
// game state — it does not go in the save, and a second save on the same
// machine shares it, which is right: it is the person who has learned where
// things are, not the promotion.

import { useState, type ReactNode } from 'react';

const KEY = 'wbg.ui.v1';
type Prefs = Record<string, boolean>;

function read(): Prefs {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Prefs;
  } catch {
    return {};
  }
}

/** A remembered yes/no. Returns the value and a setter, like useState. */
export function usePref(id: string, fallback = false): [boolean, (next: boolean) => void] {
  const [value, setValue] = useState(() => read()[id] ?? fallback);
  return [
    value,
    (next) => {
      setValue(next);
      try {
        localStorage.setItem(KEY, JSON.stringify({ ...read(), [id]: next }));
      } catch {
        // A browser that will not store it just forgets it.
      }
    },
  ];
}

/**
 * An explanation that is read once.
 *
 * The first time, it is shown in full with a way to put it away. After that
 * it is a small "?" beside the heading it explains, and opens again on
 * demand. Nothing is removed from the game: the words are all still there,
 * they just stop being in the way every single week.
 */
export function Hint({ id, title, children }: { id: string; title: ReactNode; children: ReactNode }) {
  const [read_, setRead] = usePref(`hint.${id}`);
  const [open, setOpen] = useState(false);
  const showing = !read_ || open;
  return (
    <div className="mb-2">
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-sm font-medium text-neutral-300">{title}</h2>
        {read_ && (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={open ? 'Hide the explanation' : 'What is this?'}
            className="flex h-4 w-4 items-center justify-center rounded-full border border-neutral-700 text-[10px] font-bold leading-none text-neutral-500 hover:border-neutral-500 hover:text-neutral-300"
          >
            ?
          </button>
        )}
      </div>
      {showing && (
        <div className="flex items-start gap-3 text-[11px] text-neutral-500">
          <p className="min-w-0 flex-1">{children}</p>
          {!read_ && (
            <button type="button" onClick={() => setRead(true)} className="shrink-0 rounded bg-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-300 hover:bg-neutral-700">
              Got it
            </button>
          )}
        </div>
      )}
    </div>
  );
}
