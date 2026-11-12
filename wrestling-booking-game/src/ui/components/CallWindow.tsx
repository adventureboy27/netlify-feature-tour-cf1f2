// The live window.
//
// The match is over and the result is already on the screen above this — §0's
// "results appear all at once" is not being bent. What this is, is a replay:
// the two announcers walking you through a night you already know the ending
// of, the way you would watch a match back.
//
// So the reveal is a presentation choice and never a way of withholding
// anything. It runs at a readable pace, and one tap anywhere puts the whole
// call on screen instantly. Nothing in here is information the player does not
// already have.
//
// It is collapsed by default. A booker running six matches a week does not
// want to sit through six calls every single week, and something you have to
// choose to open is something that stays a treat rather than becoming a toll.

import { useEffect, useRef, useState } from 'react';
import type { CommentaryLine } from '../../engine/sim/commentary';

/** Milliseconds a line sits on screen before the next one arrives. */
const PACE_MS = 750;

export function CallWindow({ lines, matchLabel }: { lines: readonly CommentaryLine[]; matchLabel: string }) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(0);
  const endRef = useRef<HTMLDivElement | null>(null);

  // The reveal. Cleared on unmount and on close, so a player who collapses it
  // halfway through does not leave a timer running.
  useEffect(() => {
    if (!open || shown >= lines.length) return;
    const handle = setTimeout(() => setShown((n) => n + 1), PACE_MS);
    return () => clearTimeout(handle);
  }, [open, shown, lines.length]);

  // Follow the call down, but only while it is still arriving — otherwise
  // scrolling back up to re-read a line would yank you to the bottom again.
  useEffect(() => {
    if (!open || shown === 0 || shown >= lines.length) return;
    endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [open, shown, lines.length]);

  if (lines.length === 0) return null;

  const done = shown >= lines.length;

  if (!open) {
    return (
      <button
        type="button"
        data-testid="open-call"
        onClick={() => {
          setOpen(true);
          setShown(1);
        }}
        className="mb-2 flex w-full items-center gap-2 rounded border border-neutral-800 bg-neutral-950 px-2.5 py-2 text-left transition hover:border-neutral-600"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-600/20 text-rose-400">
          {/* A headset. Inline, like every other icon — the game ships as one
              offline file. */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
            <path d="M4 14v-2a8 8 0 0 1 16 0v2" strokeLinecap="round" />
            <rect x="2.5" y="13" width="4" height="6" rx="1.5" />
            <rect x="17.5" y="13" width="4" height="6" rx="1.5" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold text-neutral-200">Listen to the call</span>
          <span className="block truncate text-[10px] text-neutral-500">{matchLabel}</span>
        </span>
        <span className="shrink-0 text-neutral-600">›</span>
      </button>
    );
  }

  return (
    <div
      data-testid="call-window"
      className="mb-2 overflow-hidden rounded border border-rose-900/50 bg-neutral-950"
    >
      <div className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-900/60 px-2.5 py-1.5">
        <span className="relative flex h-2 w-2 shrink-0">
          <span
            className={`absolute inline-flex h-2 w-2 rounded-full bg-rose-500 ${done ? '' : 'animate-ping'}`}
          />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-600" />
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
          {done ? 'Off air' : 'On air'}
        </span>
        <span className="min-w-0 flex-1 truncate text-[10px] text-neutral-500">{matchLabel}</span>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setShown(0);
          }}
          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-neutral-500 hover:text-neutral-300"
        >
          close
        </button>
      </div>

      {/* Tapping the transcript finishes it. Nothing here is being withheld,
          so nobody should ever have to wait for it. */}
      <div
        role={done ? undefined : 'button'}
        tabIndex={done ? undefined : 0}
        data-testid="call-body"
        onClick={() => !done && setShown(lines.length)}
        onKeyDown={(e) => {
          if (!done && (e.key === 'Enter' || e.key === ' ')) setShown(lines.length);
        }}
        className="flex flex-col gap-1.5 px-2.5 py-2"
      >
        {lines.slice(0, shown).map((line, i) => (
          <p key={i} className="text-xs leading-snug">
            <span
              className={`mr-1 font-semibold ${
                line.speaker === 'play' ? 'text-sky-400' : 'text-amber-400'
              }`}
            >
              {line.name}:
            </span>
            <span className={line.speaker === 'play' ? 'text-neutral-200' : 'text-neutral-400'}>
              {line.text}
            </span>
          </p>
        ))}
        <div ref={endRef} />
        {!done && (
          <p className="pt-0.5 text-[10px] italic text-neutral-600">tap to hear the rest</p>
        )}
      </div>
    </div>
  );
}
