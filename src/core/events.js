/**
 * Tiny pub/sub. Audio, vfx and the HUD react to what happened without the sim reaching
 * back into them — a hook emits, listeners decide what to do with it.
 */
export function createEvents() {
  const listeners = new Map();

  return {
    on(name, fn) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(fn);
      return () => listeners.get(name)?.delete(fn);
    },
    emit(name, data) {
      for (const fn of listeners.get(name) ?? []) fn(data);
    }
  };
}
