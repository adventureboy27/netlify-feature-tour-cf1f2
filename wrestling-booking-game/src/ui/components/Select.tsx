// A dropdown that looks like it belongs to this game, not to the browser
// chrome around it. Every native `<select>` in the app rendered with the
// OS's own default control — different on every platform, none of them
// matching a single line of this game's own design system, and the single
// biggest "this isn't really a game" tell on any screen that used one.
//
// Every existing call site follows the same shape: a controlled string
// value (empty string for "nothing picked"), an onChange handed the new
// value, and a flat or grouped list of options — so this is one component,
// not sixteen bespoke rebuilds.
//
// Deliberately hand-rolled rather than pulling in a combobox library: this
// project has no UI dependency beyond React itself (Tabs, Panel, Badge are
// all hand-built the same way), and the interaction surface here is small
// enough that a library would be more code to load than to write. Trades
// away full arrow-key roving-focus a native <select> gets for free — click
// and Escape are covered, up/down aren't — a fair trade for a single-user
// desktop game where every one of these lists is short.

import { useEffect, useId, useRef, useState } from 'react';
import { Panel } from './chrome';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectGroup {
  label: string;
  options: SelectOption[];
}

function isGroup(entry: SelectOption | SelectGroup): entry is SelectGroup {
  return 'options' in entry;
}

function flatten(entries: readonly (SelectOption | SelectGroup)[]): SelectOption[] {
  return entries.flatMap((entry) => (isGroup(entry) ? entry.options : [entry]));
}

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Choose…',
  ariaLabel,
  id,
  testId,
  className = '',
  disabled = false,
}: {
  /** Empty string means nothing picked — same convention every existing call site already used. */
  value: string;
  onChange: (value: string) => void;
  options: readonly (SelectOption | SelectGroup)[];
  /** Shown when value is '' or matches nothing in options. */
  placeholder?: string;
  ariaLabel?: string;
  /** For a `<label htmlFor>` pointing at this control, same as it would a native select's id. */
  id?: string;
  testId?: string;
  /** Sizing/width — every call site had its own, same as the native selects did. */
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selected = flatten(options).find((o) => o.value === value);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        data-testid={testId}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 rounded border px-2 py-1.5 text-left text-xs transition ${
          disabled
            ? 'cursor-not-allowed border-neutral-800 bg-neutral-900/60 text-neutral-600'
            : open
              ? 'border-neutral-500 bg-neutral-900 text-neutral-100'
              : 'border-neutral-700 bg-neutral-900 text-neutral-100 shadow-panel hover:border-neutral-500'
        }`}
      >
        <span className={`truncate ${selected ? '' : 'text-neutral-500'}`}>{selected?.label ?? placeholder}</span>
        <span className={`shrink-0 text-[9px] text-neutral-500 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && !disabled && (
        <Panel
          elevation="hero"
          role="listbox"
          id={listId}
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto p-1"
        >
          {options.length === 0 && <div className="px-2 py-1.5 text-xs text-neutral-600">Nothing to pick</div>}
          {options.map((entry, i) =>
            isGroup(entry) ? (
              <div key={`${entry.label}-${i}`} className="mt-1 first:mt-0">
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                  {entry.label}
                </div>
                {entry.options.map((opt) => (
                  <SelectRow key={opt.value} option={opt} active={opt.value === value} onChange={onChange} setOpen={setOpen} />
                ))}
              </div>
            ) : (
              <SelectRow key={entry.value} option={entry} active={entry.value === value} onChange={onChange} setOpen={setOpen} />
            ),
          )}
        </Panel>
      )}
    </div>
  );
}

function SelectRow({
  option,
  active,
  onChange,
  setOpen,
}: {
  option: SelectOption;
  active: boolean;
  onChange: (value: string) => void;
  setOpen: (open: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      disabled={option.disabled}
      onClick={() => {
        onChange(option.value);
        setOpen(false);
      }}
      className={`flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs transition ${
        option.disabled
          ? 'cursor-not-allowed text-neutral-700'
          : active
            ? 'bg-neutral-800 text-neutral-100'
            : 'text-neutral-300 hover:bg-neutral-800/70 hover:text-neutral-100'
      }`}
    >
      <span className={`w-3 shrink-0 ${active ? 'text-emerald-400' : 'text-transparent'}`}>✓</span>
      <span className="truncate">{option.label}</span>
    </button>
  );
}
