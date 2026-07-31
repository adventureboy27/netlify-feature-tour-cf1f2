/**
 * Web Audio graph and the six buses (docs/DESIGN.md audio architecture):
 * master -> [bed, roll, voice, impact, ui]. Every voice/bed connects into one of the five
 * sub-buses, never straight to master, so all mixing lives in one place.
 *
 * bed and voice are silent in M5 — environment beds need an environment (M6) and power
 * voices need a power (M7). The graph exists now so those milestones only add content,
 * never restructure the graph.
 */
const BUS_NAMES = ['bed', 'roll', 'voice', 'impact', 'ui'];

export function createAudioEngine() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();

  const master = ctx.createGain();
  master.gain.value = 0.7;
  master.connect(ctx.destination);

  const buses = {};
  for (const name of BUS_NAMES) {
    const gain = ctx.createGain();
    gain.gain.value = 1;
    gain.connect(master);
    buses[name] = gain;
  }

  // "Duck the beds about 4 dB during a death" — a temporary dip on the bus gain itself,
  // independent of whatever a bed's own dynamic gain (e.g. rolling speed) is doing.
  function duck(busNames, amountDb = 4, ms = 400) {
    const factor = 10 ** (-amountDb / 20);
    const now = ctx.currentTime;
    for (const name of busNames) {
      const bus = buses[name];
      if (!bus) continue;
      const base = bus.gain.value;
      bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(bus.gain.value, now);
      bus.gain.linearRampToValueAtTime(base * factor, now + 0.05);
      bus.gain.linearRampToValueAtTime(base, now + ms / 1000);
    }
  }

  function resume() {
    if (ctx.state === 'suspended') ctx.resume();
  }

  return { ctx, master, buses, duck, resume };
}
