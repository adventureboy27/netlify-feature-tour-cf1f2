/**
 * Fixed-timestep accumulator. Physics always advances in 1/120s ticks regardless of frame
 * rate; rendering interpolates between the last two ticks using the leftover accumulator
 * time (`alpha`), so motion stays smooth even at low frame rates.
 */
const STEP = 1 / 120;
const MAX_SUBSTEPS = 5;

export function createLoop({ update, render }) {
  let accumulator = 0;
  let last = 0;
  let running = false;
  let rafId = null;

  function frame(now) {
    if (!running) return;

    let delta = (now - last) / 1000;
    last = now;
    if (delta > 0.25) delta = 0.25; // clamp huge gaps (e.g. tab was backgrounded)
    accumulator += delta;

    let substeps = 0;
    while (accumulator >= STEP && substeps < MAX_SUBSTEPS) {
      update(STEP);
      accumulator -= STEP;
      substeps++;
    }
    if (substeps === MAX_SUBSTEPS) accumulator = 0; // dropped time beats a spiral of death

    render(accumulator / STEP);
    rafId = requestAnimationFrame(frame);
  }

  return {
    start() {
      if (running) return;
      running = true;
      accumulator = 0;
      last = performance.now();
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      if (rafId !== null) cancelAnimationFrame(rafId);
    }
  };
}
