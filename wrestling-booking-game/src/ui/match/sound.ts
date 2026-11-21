// The sound of a match, made rather than recorded.
//
// The game ships no audio files and makes no network calls, so every sound
// here is synthesised with the Web Audio API at the moment it is needed: a
// burst of filtered noise for a slap, a falling sine for a body hitting the
// mat, a struck partial stack for the bell. That is good enough for things
// that are thumps and cracks. It is not good enough for a human voice, which
// is why there are no grunts here: those want recordings, and `voice()` is
// the place they would be played from if any are ever added.
//
// Nothing here is game state. It is the viewer's, it can be switched off,
// and the preference is remembered on this machine only.

export type Hit = 'punch' | 'kick' | 'slam' | 'chair' | 'kendo' | 'can' | 'cage' | 'table' | 'count';

const KEY = 'match-sound';
let context: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let on = (() => {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
})();

export const soundOn = () => on;
export function setSoundOn(next: boolean): void {
  on = next;
  try {
    localStorage.setItem(KEY, next ? 'on' : 'off');
  } catch {
    // A browser that will not store it just forgets it.
  }
  if (!next && master && context) master.gain.setTargetAtTime(0, context.currentTime, 0.02);
  if (next && master && context) master.gain.setTargetAtTime(0.7, context.currentTime, 0.02);
}

function audio(): { ctx: AudioContext; out: GainNode; noise: AudioBuffer } | null {
  if (!on || typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!context) {
    context = new Ctor();
    master = context.createGain();
    master.gain.value = 0.7;
    master.connect(context.destination);
    // One second of white noise, reused for every slap, crash and crowd.
    noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  // A browser keeps audio suspended until the page has been clicked on.
  if (context.state === 'suspended') void context.resume().catch(() => undefined);
  return { ctx: context, out: master!, noise: noise! };
}

/** A burst of noise through a filter: the body of every slap, crack and crash. */
function burst(a: NonNullable<ReturnType<typeof audio>>, when: number, o: { type: BiquadFilterType; freq: number; q?: number; gain: number; decay: number; to?: number }) {
  const src = a.ctx.createBufferSource();
  src.buffer = a.noise;
  src.loop = true;
  const filter = a.ctx.createBiquadFilter();
  filter.type = o.type;
  filter.frequency.setValueAtTime(o.freq, when);
  if (o.to) filter.frequency.exponentialRampToValueAtTime(o.to, when + o.decay);
  filter.Q.value = o.q ?? 1;
  const gain = a.ctx.createGain();
  gain.gain.setValueAtTime(o.gain, when);
  gain.gain.exponentialRampToValueAtTime(0.0008, when + o.decay);
  src.connect(filter).connect(gain).connect(a.out);
  src.start(when, Math.random() * 0.5);
  src.stop(when + o.decay + 0.05);
}

/** A pitched thump that drops: weight landing. */
function thump(a: NonNullable<ReturnType<typeof audio>>, when: number, o: { from: number; to: number; gain: number; decay: number; type?: OscillatorType }) {
  const osc = a.ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.from, when);
  osc.frequency.exponentialRampToValueAtTime(o.to, when + o.decay);
  const gain = a.ctx.createGain();
  gain.gain.setValueAtTime(o.gain, when);
  gain.gain.exponentialRampToValueAtTime(0.0008, when + o.decay);
  osc.connect(gain).connect(a.out);
  osc.start(when);
  osc.stop(when + o.decay + 0.05);
}

/** One impact, `delayMs` from now. */
export function hit(kind: Hit, delayMs = 0): void {
  const a = audio();
  if (!a) return;
  const t = a.ctx.currentTime + delayMs / 1000;
  switch (kind) {
    case 'punch':
      // A slap of skin: a short bright crack over a small knock.
      burst(a, t, { type: 'bandpass', freq: 1900, q: 0.9, gain: 0.55, decay: 0.07 });
      thump(a, t, { from: 190, to: 90, gain: 0.35, decay: 0.08 });
      break;
    case 'kick':
      // Heavier and lower: a boot, not a hand.
      burst(a, t, { type: 'bandpass', freq: 900, q: 0.8, gain: 0.6, decay: 0.1 });
      thump(a, t, { from: 150, to: 60, gain: 0.6, decay: 0.14 });
      break;
    case 'slam':
      // A body on the mat: a boom from the boards, the canvas slapping, the ring settling.
      thump(a, t, { from: 110, to: 38, gain: 1, decay: 0.42 });
      burst(a, t, { type: 'lowpass', freq: 1400, to: 220, gain: 0.7, decay: 0.3 });
      thump(a, t + 0.06, { from: 62, to: 34, gain: 0.45, decay: 0.5 });
      break;
    case 'count':
      // A hand on the canvas.
      burst(a, t, { type: 'lowpass', freq: 900, gain: 0.5, decay: 0.09 });
      thump(a, t, { from: 130, to: 70, gain: 0.5, decay: 0.12 });
      break;
    case 'chair':
      // Steel on a skull: a clang with a couple of ringing partials.
      burst(a, t, { type: 'highpass', freq: 2400, gain: 0.5, decay: 0.12 });
      for (const f of [520, 1310, 2140]) thump(a, t, { from: f, to: f * 0.98, gain: 0.22, decay: 0.45, type: 'triangle' });
      break;
    case 'can':
      // Thinner steel, and hollow: it booms and rattles.
      burst(a, t, { type: 'bandpass', freq: 1500, q: 2.5, gain: 0.7, decay: 0.3 });
      for (const f of [240, 390, 870]) thump(a, t, { from: f, to: f * 0.9, gain: 0.2, decay: 0.5, type: 'square' });
      break;
    case 'kendo':
      // A stick: all crack, no ring.
      burst(a, t, { type: 'highpass', freq: 3000, gain: 0.8, decay: 0.05 });
      thump(a, t, { from: 900, to: 300, gain: 0.25, decay: 0.05, type: 'triangle' });
      break;
    case 'cage':
      // Mesh taking a body: a long rattle.
      for (let i = 0; i < 5; i++) burst(a, t + i * 0.045, { type: 'bandpass', freq: 2600 + i * 300, q: 6, gain: 0.35 - i * 0.05, decay: 0.16 });
      thump(a, t, { from: 140, to: 60, gain: 0.5, decay: 0.2 });
      break;
    case 'table':
      // Wood giving way: a crack, a splintering tail, and the body going through to the mat.
      burst(a, t, { type: 'bandpass', freq: 1200, q: 0.7, gain: 0.9, decay: 0.09 });
      for (let i = 1; i < 5; i++) burst(a, t + i * 0.035, { type: 'highpass', freq: 1800, gain: 0.3, decay: 0.07 });
      thump(a, t + 0.05, { from: 100, to: 40, gain: 0.8, decay: 0.4 });
      break;
  }
}

/** The ring bell: once to start, three times to finish. */
export function bell(times = 1, delayMs = 0): void {
  const a = audio();
  if (!a) return;
  for (let n = 0; n < times; n++) {
    const t = a.ctx.currentTime + delayMs / 1000 + n * 0.32;
    burst(a, t, { type: 'highpass', freq: 4000, gain: 0.25, decay: 0.03 });
    for (const [f, g, d] of [[660, 0.3, 1.6], [1318, 0.2, 1.2], [1975, 0.12, 0.8], [2640, 0.07, 0.5]] as const) thump(a, t, { from: f, to: f * 0.995, gain: g, decay: d });
  }
}

/** The crowd coming up for something: a swell of noise, bigger for the bigger moments. */
export function crowd(size: 'pop' | 'roar' = 'pop', delayMs = 0): void {
  const a = audio();
  if (!a) return;
  const t = a.ctx.currentTime + delayMs / 1000;
  const long = size === 'roar' ? 2.6 : 1.1;
  const src = a.ctx.createBufferSource();
  src.buffer = a.noise;
  src.loop = true;
  const filter = a.ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(700, t);
  filter.frequency.linearRampToValueAtTime(1300, t + long * 0.3);
  filter.frequency.linearRampToValueAtTime(800, t + long);
  filter.Q.value = 0.6;
  const gain = a.ctx.createGain();
  gain.gain.setValueAtTime(0.0008, t);
  gain.gain.exponentialRampToValueAtTime(size === 'roar' ? 0.34 : 0.2, t + long * 0.22);
  gain.gain.exponentialRampToValueAtTime(0.0008, t + long);
  src.connect(filter).connect(gain).connect(a.out);
  src.start(t);
  src.stop(t + long + 0.1);
}

/**
 * DESIGN: where a wrestler's grunt would go. Deliberately silent — a
 * synthesised voice sounds like a machine, not a person in pain. If recorded
 * grunts are ever supplied, this is the one function to fill in.
 */
/**
 * A building full of voices on one vowel: a chorus of low, slightly
 * detuned tones, each its own person coming in a beat apart, shaped into
 * an "oo" and given breath. Falling, it is a boo; rising, the "ooh" of a
 * two-count. Not a recording, and does not pretend to be one — but it is a
 * crowd telling you how it feels about somebody.
 */
function chorus(a: NonNullable<ReturnType<typeof audio>>, when: number, o: { voices: number; low: number; high: number; long: number; bend: number; gain: number }) {
  const out = a.ctx.createGain();
  out.gain.value = 1;
  // The vowel: a dark "oo" — most of the energy low, a soft second formant.
  const f1 = a.ctx.createBiquadFilter();
  f1.type = 'bandpass';
  f1.frequency.value = 380;
  f1.Q.value = 1.4;
  const f2 = a.ctx.createBiquadFilter();
  f2.type = 'bandpass';
  f2.frequency.value = 820;
  f2.Q.value = 2.2;
  const f2gain = a.ctx.createGain();
  f2gain.gain.value = 0.35;
  const dark = a.ctx.createBiquadFilter();
  dark.type = 'lowpass';
  dark.frequency.value = 1400;
  out.connect(f1).connect(dark);
  out.connect(f2).connect(f2gain).connect(dark);
  const level = a.ctx.createGain();
  level.gain.setValueAtTime(0.0001, when);
  level.gain.exponentialRampToValueAtTime(o.gain, when + Math.min(0.35, o.long * 0.3));
  level.gain.setValueAtTime(o.gain, when + o.long * 0.7);
  level.gain.exponentialRampToValueAtTime(0.0001, when + o.long);
  dark.connect(level).connect(a.out);
  for (let i = 0; i < o.voices; i++) {
    const start = when + Math.random() * 0.22;
    const pitch = o.low + Math.random() * (o.high - o.low);
    const osc = a.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(pitch, start);
    osc.frequency.linearRampToValueAtTime(pitch * o.bend, when + o.long);
    // Everybody wobbles a little, and not together.
    const wobble = a.ctx.createOscillator();
    wobble.frequency.value = 4 + Math.random() * 3;
    const depth = a.ctx.createGain();
    depth.gain.value = pitch * 0.012;
    wobble.connect(depth).connect(osc.frequency);
    const g = a.ctx.createGain();
    g.gain.value = 1 / o.voices;
    osc.connect(g).connect(out);
    osc.start(start);
    wobble.start(start);
    osc.stop(when + o.long + 0.05);
    wobble.stop(when + o.long + 0.05);
  }
  // Breath under it.
  const air = a.ctx.createBufferSource();
  air.buffer = a.noise;
  air.loop = true;
  const airGain = a.ctx.createGain();
  airGain.gain.value = 0.35;
  air.connect(airGain).connect(out);
  air.start(when);
  air.stop(when + o.long + 0.05);
}

/** The crowd booing somebody. */
export function boo(size: 'pop' | 'roar' = 'pop', delayMs = 0): void {
  const a = audio();
  if (!a) return;
  chorus(a, a.ctx.currentTime + delayMs / 1000, { voices: size === 'roar' ? 22 : 14, low: 92, high: 170, long: size === 'roar' ? 2.8 : 1.7, bend: 0.82, gain: size === 'roar' ? 0.42 : 0.3 });
}

/** The "ooh" when a shoulder comes up at two. */
export function ooh(delayMs = 0): void {
  const a = audio();
  if (!a) return;
  chorus(a, a.ctx.currentTime + delayMs / 1000, { voices: 16, low: 120, high: 210, long: 1.1, bend: 1.3, gain: 0.3 });
}

/** The crowd on somebody's side: the roar, and a couple of whistles in it when it is big. */
export function cheer(size: 'pop' | 'roar' = 'pop', delayMs = 0): void {
  crowd(size, delayMs);
  const a = audio();
  if (!a || size !== 'roar') return;
  for (let i = 0; i < 3; i++) {
    const t = a.ctx.currentTime + delayMs / 1000 + 0.2 + Math.random() * 0.9;
    const osc = a.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1700 + Math.random() * 400, t);
    osc.frequency.linearRampToValueAtTime(2500 + Math.random() * 500, t + 0.18);
    osc.frequency.linearRampToValueAtTime(1900, t + 0.36);
    const g = a.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    osc.connect(g).connect(a.out);
    osc.start(t);
    osc.stop(t + 0.42);
  }
}

/** Some for, some against. */
export function mixed(size: 'pop' | 'roar' = 'pop', delayMs = 0): void {
  crowd(size, delayMs);
  const a = audio();
  if (!a) return;
  chorus(a, a.ctx.currentTime + delayMs / 1000, { voices: 9, low: 92, high: 160, long: size === 'roar' ? 2.2 : 1.4, bend: 0.85, gain: 0.18 });
}

export function voice(_gender: 'm' | 'f', _kind: 'effort' | 'pain', _delayMs = 0): void {
  // No recordings exist yet.
}

/** Which sound a move's small impacts make. */
const KICKS: ReadonlySet<string> = new Set(['superkick', 'dropkick', 'missileDropkick', 'kneeLift', 'stomp', 'cornerStomp', 'legDrop']);
export function hitFor(move: string, big: boolean, prop?: string, scene?: string): Hit {
  if (move === 'ladderShot' || move === 'stepsShot') return 'chair';
  if (move === 'chairShot') return prop === 'kendo' ? 'kendo' : prop === 'can' ? 'can' : 'chair';
  if (move === 'intoCage' || move === 'cageTop' || move === 'cageClimb') return big ? 'cage' : 'punch';
  if (big && (scene === 'table' || scene === 'flamingTable')) return 'table';
  if (big) return 'slam';
  return KICKS.has(move) ? 'kick' : 'punch';
}
