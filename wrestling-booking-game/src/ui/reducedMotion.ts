// Whether the settle-in transitions between screens should run.
//
// Defaults to the OS-level `prefers-reduced-motion` signal, and can be
// overridden from Settings — the override is what a player who likes the
// game but not the motion actually wants, rather than making them change an
// OS-wide setting to get it.

const KEY = 'wbg.reduceMotion';

export function getReducedMotionPreference(): boolean {
  if (typeof localStorage === 'undefined') return false;
  const stored = localStorage.getItem(KEY);
  if (stored !== null) return stored === 'true';
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function setReducedMotionPreference(value: boolean): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KEY, String(value));
}
