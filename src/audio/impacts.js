/**
 * Collision and death sounds — every one-shot voice in the game. Pitch and brightness scale
 * with force for impacts (docs/DESIGN.md layer 4); deaths are distinct per cause (layer 6).
 * Pure synthesis throughout, per docs/ASSETS.md — no sample playback anywhere here.
 */
import { makeNoiseBuffer } from './beds.js';

const IMPACT_PROFILES = {
  marble: { type: 'triangle', freqBase: 260, filterFreq: 1800, decay: 0.10 },
  rail:   { type: 'sine',     freqBase: 130, filterFreq: 900,  decay: 0.16 },
  bumper: { type: 'square',   freqBase: 520, filterFreq: 3200, decay: 0.14 },
  dome:   { type: 'sine',     freqBase: 110, filterFreq: 650,  decay: 0.20 }
};

// force is a raw speed-like magnitude (board-widths/sec); this just needs a sane 0..1ish
// normalization to shape pitch/gain, not a physically exact one.
const FORCE_NORM = 0.9;
const MIN_IMPACT_FORCE = 0.02; // a resting nudge shouldn't buzz the impact bus

export function createImpactVoices(ctx, destination) {
  const noiseBuffer = makeNoiseBuffer(ctx, 1);

  function playTone({ freq, freqEnd, type = 'sine', decay = 0.15, filterFreq = 1200, gain = 0.4 }) {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freqEnd && freqEnd !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + decay);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(gain, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, now + decay);

    osc.connect(filter);
    filter.connect(g);
    g.connect(destination);
    osc.start(now);
    osc.stop(now + decay + 0.05);
  }

  function playNoise({ decay = 0.3, filterType = 'bandpass', freqStart = 2000, freqEnd = 2000, q = 1, gain = 0.4 }) {
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(freqStart, now);
    if (freqEnd !== freqStart) filter.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + decay);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(gain, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, now + decay);

    src.connect(filter);
    filter.connect(g);
    g.connect(destination);
    src.start(now);
    src.stop(now + decay + 0.05);
  }

  function playImpact({ kind, force }) {
    if (force < MIN_IMPACT_FORCE) return;
    const profile = IMPACT_PROFILES[kind] ?? IMPACT_PROFILES.rail;
    const norm = Math.min(1, force / FORCE_NORM);
    playTone({
      freq: profile.freqBase * (0.85 + norm * 0.6),
      type: profile.type,
      decay: profile.decay,
      filterFreq: profile.filterFreq * (0.6 + norm * 0.8),
      gain: 0.12 + norm * 0.45
    });
  }

  function playDeath(cause) {
    switch (cause) {
      case 'burned':
        playNoise({ decay: 0.5, filterType: 'highpass', freqStart: 1500, freqEnd: 4000, gain: 0.5 });
        break;
      case 'drowned':
        playNoise({ decay: 0.6, filterType: 'lowpass', freqStart: 2000, freqEnd: 150, gain: 0.45 });
        playTone({ freq: 220, freqEnd: 90, type: 'sine', decay: 0.5, filterFreq: 400, gain: 0.2 });
        break;
      case 'fell':
        playTone({ freq: 500, freqEnd: 110, type: 'sine', decay: 0.4, filterFreq: 900, gain: 0.3 });
        playNoise({ decay: 0.2, filterType: 'lowpass', freqStart: 400, freqEnd: 100, gain: 0.25 });
        break;
      case 'shattered':
        playNoise({ decay: 0.35, filterType: 'highpass', freqStart: 3000, freqEnd: 6000, gain: 0.5 });
        playTone({ freq: 1800, type: 'triangle', decay: 0.4, filterFreq: 5000, gain: 0.25 });
        break;
      case 'knocked out':
        playTone({ freq: 90, type: 'square', decay: 0.08, filterFreq: 500, gain: 0.6 });
        break;
      case 'crushed':
        playNoise({ decay: 0.4, filterType: 'lowpass', freqStart: 300, freqEnd: 80, gain: 0.6 });
        playTone({ freq: 60, type: 'sine', decay: 0.4, filterFreq: 200, gain: 0.4 });
        break;
      default:
        playTone({ freq: 200, type: 'sine', decay: 0.2, filterFreq: 800, gain: 0.3 });
    }
  }

  return { playImpact, playDeath };
}
