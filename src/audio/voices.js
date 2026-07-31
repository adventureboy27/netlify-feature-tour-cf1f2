/**
 * Power voices — bound to the PLAYER's marble specifically (docs/DESIGN.md layer 3), so you
 * hear yourself apart from the pack even though every marble runs the same power and fires
 * the same hook events. CPU marbles' events are simply ignored here.
 *
 * Consumes the 'voice' events turbo and molten already emit from their hooks in
 * data/powers.js — this file doesn't know which power is active, only how to react to the
 * events a power chooses to fire.
 */
import { makeNoiseBuffer } from './beds.js';

// turbo: "sawtooth stack + lowpass, freq = 60 + 340 * (speed/max)" — exact formula from
// turbo's own sfx spec in data/powers.js.
const TURBO_BASE_FREQ = 60;
const TURBO_FREQ_RANGE = 340;
const TURBO_IDLE_GAIN = 0.06;
const TURBO_REV_GAIN = 0.32;
const SMOOTHING = 0.06;

export function createPowerVoices(ctx, destination) {
  let turbo = null;

  function ensureTurbo() {
    if (turbo) return turbo;
    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.detune.value = 9; // "stack" — two saws slightly detuned, not one thin tone

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = TURBO_BASE_FREQ;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    osc1.start();
    osc2.start();

    turbo = { osc1, osc2, filter, gain };
    return turbo;
  }

  function handleTurbo(data) {
    const v = ensureTurbo();
    const now = ctx.currentTime;
    if (data.action === 'rev') {
      v.gain.gain.setTargetAtTime(TURBO_REV_GAIN, now, 0.02);
      v.filter.frequency.setTargetAtTime(2200, now, 0.03);
      return;
    }
    if (typeof data.speed === 'number') {
      const freq = TURBO_BASE_FREQ + TURBO_FREQ_RANGE * data.speed;
      v.osc1.frequency.setTargetAtTime(freq, now, SMOOTHING);
      v.osc2.frequency.setTargetAtTime(freq, now, SMOOTHING);
      v.filter.frequency.setTargetAtTime(300 + 2600 * data.speed, now, SMOOTHING);
      // "settles into an idle burble as it slows" rather than cutting out entirely
      v.gain.gain.setTargetAtTime(TURBO_IDLE_GAIN + (TURBO_REV_GAIN - TURBO_IDLE_GAIN) * data.speed, now, SMOOTHING);
    }
  }

  const moltenNoise = makeNoiseBuffer(ctx, 1);
  function handleMoltenSettle() {
    // "a searing hiss as the mark sets" — short high-passed noise burst
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = moltenNoise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(3500, now + 0.3);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    src.start(now);
    src.stop(now + 0.4);
  }

  function handleVoice(data) {
    if (!data.marble?.isPlayer) return;
    if (data.id === 'turbo') handleTurbo(data);
    else if (data.id === 'molten' && data.action === 'settle') handleMoltenSettle();
  }

  return { handleVoice };
}
