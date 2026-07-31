import { createWorld, addMarble, setBoardHeight } from './core/world.js';
import { createLoop } from './core/loop.js';
import { stepPhysics } from './sim/physics.js';
import { createTurnMachine } from './sim/turn.js';
import { generateTerrain } from './sim/terrain.js';
import { getEnvironment, implemented as implementedEnvironments } from './content/environments.js';
import { getPower, implemented as implementedPowers } from './content/powers.js';
import { createRenderer } from './render/canvas2d.js';
import { createRenderer3D } from './render/scene.js';
import { createHud } from './render/hud.js';
import { createAudioEngine } from './audio/engine.js';
import { createRollingBed } from './audio/beds.js';
import { createImpactVoices } from './audio/impacts.js';
import { createPowerVoices } from './audio/voices.js';

const NO_POWER_CHANCE = 0.3; // "roughly 30% of levels have no power at all" — docs/DESIGN.md

const SENSITIVITY = 3.0; // drag length in board-widths -> launch speed multiplier
const MARBLE_R = 0.035;
const MARBLE_COUNT = 5;

const canvas3d = document.getElementById('board3d');
const canvas2d = document.getElementById('board2d');
const renderer3d = createRenderer3D(canvas3d);
const renderer2d = createRenderer(canvas2d);
const hud = createHud(document.getElementById('hud'));
const world = createWorld(Date.now() >>> 0);

// three.js is the real renderer; canvas 2D stays reachable as a truth check when the 3D
// looks wrong (docs/BUILD-ORDER.md M4). Press 2 / 3 to switch.
let mode = '3d';
function setMode(next) {
  mode = next;
  canvas3d.style.visibility = mode === '3d' ? 'visible' : 'hidden';
  canvas2d.style.visibility = mode === '2d' ? 'visible' : 'hidden';
}
setMode('3d');
window.addEventListener('keydown', (evt) => {
  if (evt.key === '2') setMode('2d');
  else if (evt.key === '3') setMode('3d');
});

function resize() {
  const aspect = canvas3d.clientHeight / canvas3d.clientWidth;
  setBoardHeight(world, aspect);
  renderer2d.resize(canvas2d.clientWidth);
  renderer3d.resize(canvas3d.clientWidth, canvas3d.clientHeight);
}
window.addEventListener('resize', resize);
resize();

// M6/M7: non-negotiable #2 — environment and power are both announced before the level
// starts. Level grammar (weighted draws, unlocks) is M9; for now a seeded pick from each
// implemented set, overridable with ?env=<id> / ?power=<id> for testing a specific one.
// Environment first, then power, matching docs/DESIGN.md's level(seed) -> environment,
// power, ... grammar order — both draws go through world.rng, so the seed still determines
// everything downstream (terrain, CPU aim) deterministically.
const params = new URLSearchParams(window.location.search);
world.environment = getEnvironment(params.get('env')) ?? world.rng.pick(implementedEnvironments);
hud.setEnvironment(world.environment);

// soloOnly (roulette) never gets a power — a hard rule, not just a default, so it applies
// even when ?power= is passed explicitly.
world.power = world.environment.soloOnly
  ? null
  : getPower(params.get('power')) ?? (world.rng.next() < NO_POWER_CHANCE ? null : world.rng.pick(implementedPowers));
hud.setPower(world.power);

// A power applies to ALL FIVE marbles, not just the player — stats are resolved once here
// and baked into each marble (core/world.js), not looked up from world.power every tick.
const powerStats = world.power?.stats ?? {};

// evenly spaced along the horizontal centre line, spacing far wider than 2r so nobody
// starts overlapping regardless of aspect ratio
const marbles = [];
for (let i = 0; i < MARBLE_COUNT; i++) {
  const x = 0.2 + i * 0.15;
  marbles.push(addMarble(world, {
    x, y: world.h / 2, isPlayer: i === 0,
    r: MARBLE_R * (powerStats.radius ?? 1),
    mass: powerStats.mass ?? 1,
    decelMul: powerStats.decelMul ?? 1,
    launchMul: powerStats.launchMul ?? 1,
    wallE: powerStats.wallE ?? null,
    ballE: powerStats.ballE ?? null
  }));
}
const player = marbles[0];

// M3: seeded, non-lethal terrain so boards feel authored rather than empty. Lethal terrain
// (holes, lava, water...) is always environment-driven.
generateTerrain(world, marbles.map(m => ({ x: m.x, y: m.y })));
world.environment?.onLevelStart?.(world);
renderer3d.buildTerrain(world); // static per level — rebuilt on 'degrade', not read fresh like canvas2d
world.events.on('degrade', () => renderer3d.buildTerrain(world));

const turn = createTurnMachine(world);
world.events.on('phase', ({ turn: t, phase }) => hud.setPhase(t, phase));
world.events.on('win', ({ winner }) => hud.setWinner(winner));

// M5: six-bus audio graph. AudioContext starts suspended under browser autoplay policy —
// resumed on the player's first pointerdown below.
const audio = createAudioEngine();
const rollingBed = createRollingBed(audio.ctx, audio.buses.roll);
const impactVoices = createImpactVoices(audio.ctx, audio.buses.impact);
const powerVoices = createPowerVoices(audio.ctx, audio.buses.voice);
world.events.on('impact', (data) => impactVoices.playImpact(data));
world.events.on('voice', (data) => powerVoices.handleVoice(data));
world.events.on('death', ({ cause }) => {
  impactVoices.playDeath(cause);
  audio.duck(['bed', 'roll'], 4, 400);
});

// AIM: drag anywhere while it's the player's turn to aim. Direction and length of the
// drag ARE the launch direction and power — a flick, not a slingshot pull-back.
let drag = null;

function toBoard(evt) {
  const rect = canvas3d.getBoundingClientRect(); // both canvases share the same rect
  return {
    x: (evt.clientX - rect.left) / rect.width,
    y: (evt.clientY - rect.top) / rect.width // same divisor for x and y: one uniform scale
  };
}

function canAim() {
  return turn.phase === 'AIM' && player.alive;
}

for (const el of [canvas3d, canvas2d]) {
  el.addEventListener('pointerdown', (evt) => {
    audio.resume();
    if (!canAim()) return;
    const p = toBoard(evt);
    drag = { startX: p.x, startY: p.y, x: p.x, y: p.y };
    el.setPointerCapture(evt.pointerId);
  });

  el.addEventListener('pointermove', (evt) => {
    if (!drag) return;
    const p = toBoard(evt);
    drag.x = p.x;
    drag.y = p.y;
  });

  el.addEventListener('pointerup', (evt) => {
    if (!drag) return;
    const dx = drag.x - drag.startX;
    const dy = drag.y - drag.startY;
    const len = Math.hypot(dx, dy);
    drag = null;
    el.releasePointerCapture(evt.pointerId);
    if (len <= 0.01 || !canAim()) return;
    const speed = Math.min(world.maxSpeed, len * SENSITIVITY);
    turn.launch((dx / len) * speed, (dy / len) * speed);
  });
}

const loop = createLoop({
  update: (dt) => {
    stepPhysics(world, dt);
    turn.afterPhysicsStep();
  },
  render: (alpha) => {
    const aim = drag && {
      originX: player.x,
      originY: player.y,
      x: player.x + (drag.x - drag.startX),
      y: player.y + (drag.y - drag.startY)
    };
    if (mode === '3d') renderer3d.draw(world, alpha, aim);
    else renderer2d.draw(world, alpha, aim);
    rollingBed.update(world);
  }
});

loop.start();

if (import.meta.env.DEV) window.__TAW__ = { world, marbles, player, turn, audio, impactVoices, powerVoices, renderer3d };
