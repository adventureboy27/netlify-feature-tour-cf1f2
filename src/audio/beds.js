/**
 * The rolling bed: filtered noise, always running. Gain tracks total board speed, filter
 * frequency tracks the fastest marble (docs/DESIGN.md audio architecture, layer 2).
 * Environment beds (layer 1) arrive in M6 once there's an environment to voice.
 */
const MIN_GAIN = 0;
const MAX_GAIN = 0.5;
const MIN_FREQ = 150;
const MAX_FREQ = 1100;
const SMOOTHING = 0.05; // seconds, setTargetAtTime time constant

export function createRollingBed(ctx, destination) {
  const noise = ctx.createBufferSource();
  noise.buffer = makeNoiseBuffer(ctx, 2);
  noise.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = MIN_FREQ;
  filter.Q.value = 0.6;

  const gain = ctx.createGain();
  gain.gain.value = 0;

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  noise.start();

  function update(world) {
    let totalSpeed = 0;
    let maxSpeed = 0;
    for (const m of world.marbles) {
      if (!m.alive) continue;
      const sp = Math.hypot(m.vx, m.vy);
      totalSpeed += sp;
      if (sp > maxSpeed) maxSpeed = sp;
    }
    const targetGain = MIN_GAIN + (MAX_GAIN - MIN_GAIN) * Math.min(1, totalSpeed / (world.maxSpeed * 2));
    const targetFreq = MIN_FREQ + (MAX_FREQ - MIN_FREQ) * Math.min(1, maxSpeed / world.maxSpeed);

    const now = ctx.currentTime;
    gain.gain.setTargetAtTime(targetGain, now, SMOOTHING);
    filter.frequency.setTargetAtTime(targetFreq, now, SMOOTHING);
  }

  return { update };
}

export function makeNoiseBuffer(ctx, seconds) {
  const length = Math.max(1, Math.floor(seconds * ctx.sampleRate));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}
