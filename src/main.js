import { createWorld, addMarble, setBoardHeight } from './core/world.js';
import { createLoop } from './core/loop.js';
import { stepPhysics } from './sim/physics.js';
import { createTurnMachine } from './sim/turn.js';
import { generateTerrain } from './sim/terrain.js';
import { level, levelCount } from './content/levels.js';
import { createRenderer } from './render/canvas2d.js';
import { createRenderer3D } from './render/scene.js';
import { createHud } from './render/hud.js';
import { createMenu, createEndOverlay } from './render/menu.js';
import { createAudioEngine } from './audio/engine.js';
import { createRollingBed } from './audio/beds.js';
import { createImpactVoices } from './audio/impacts.js';
import { createPowerVoices } from './audio/voices.js';

const SENSITIVITY = 3.0; // drag length in board-widths -> launch speed multiplier
const MARBLE_R = 0.035;
const MARBLE_COUNT = 5;

// ---- one-time setup: renderers, hud, audio graph — all persist across level changes ----

const canvas3d = document.getElementById('board3d');
const canvas2d = document.getElementById('board2d');
const renderer3d = createRenderer3D(canvas3d);
const renderer2d = createRenderer(canvas2d);
const hud = createHud(document.getElementById('hud'));

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

// current holds everything specific to the level in progress — null while the menu or the
// end-of-level overlay is up. Every callback below checks it rather than assuming a level
// is always running, since M9 made that no longer true.
let current = null; // { world, turn, player, marbles, levelIndex }

function resize() {
  const aspect = canvas3d.clientHeight / canvas3d.clientWidth;
  if (current) setBoardHeight(current.world, aspect);
  renderer2d.resize(canvas2d.clientWidth);
  renderer3d.resize(canvas3d.clientWidth, canvas3d.clientHeight);
}
window.addEventListener('resize', resize);

// M5: six-bus audio graph. AudioContext starts suspended under browser autoplay policy —
// resumed on the player's first pointerdown below. Nodes persist across levels; only the
// world.events listeners routing into them change.
const audio = createAudioEngine();
const rollingBed = createRollingBed(audio.ctx, audio.buses.roll);
const impactVoices = createImpactVoices(audio.ctx, audio.buses.impact);
const powerVoices = createPowerVoices(audio.ctx, audio.buses.voice);

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
  return current !== null && current.turn.phase === 'AIM' && current.player.alive;
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
    const speed = Math.min(current.world.maxSpeed, len * SENSITIVITY);
    current.turn.launch((dx / len) * speed, (dy / len) * speed);
  });
}

const loop = createLoop({
  update: (dt) => {
    if (!current) return;
    stepPhysics(current.world, dt);
    current.turn.afterPhysicsStep();
  },
  render: (alpha) => {
    if (!current) return;
    const { world, player } = current;
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

// ---- menu and end-of-level overlay ----

const endOverlay = createEndOverlay(document.getElementById('end-overlay'), {
  onNext: () => {
    endOverlay.hide();
    startLevel(current.levelIndex + 1);
  },
  onMenu: () => {
    endOverlay.hide();
    showMenu();
  }
});

const menu = createMenu(document.getElementById('menu'), {
  levelCount,
  onSelect: (n) => { menu.hide(); startLevel(n); },
  onEndless: () => { menu.hide(); startLevel(levelCount + Math.floor(Math.random() * 100)); }
});

function showMenu() {
  loop.stop();
  current = null;
  menu.show();
}

// ---- per-level setup ----
// A level is a seed (docs/DESIGN.md) — level index doubles as the seed, so "level 3" is the
// same board, environment, power and surface every time it's chosen, and the CPU/terrain
// randomness downstream of it stays deterministic too.
function startLevel(n) {
  const lvl = level(n, n);

  const world = createWorld(n, { rng: lvl.rng });
  setBoardHeight(world, canvas3d.clientHeight / canvas3d.clientWidth);

  world.environment = lvl.environment;
  world.power = lvl.power;
  world.surface = lvl.surface;
  hud.setEnvironment(world.environment);
  hud.setPower(world.power);

  // A power applies to ALL FIVE marbles, not just the player — stats resolved once here and
  // baked into each marble (core/world.js), not looked up from world.power every tick.
  const powerStats = world.power?.stats ?? {};
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

  generateTerrain(world, marbles.map((m) => ({ x: m.x, y: m.y })));
  world.environment?.onLevelStart?.(world);
  renderer3d.buildTerrain(world); // static per level — rebuilt on 'degrade', not read fresh like canvas2d
  world.events.on('degrade', () => renderer3d.buildTerrain(world));

  const turn = createTurnMachine(world);
  world.events.on('phase', ({ turn: t, phase }) => hud.setPhase(t, phase));
  world.events.on('win', ({ winner }) => {
    hud.setWinner(winner);
    if (winner.isPlayer && n < levelCount - 1) menu.unlock(n + 1);
    loop.stop();
    endOverlay.show(winner, true);
  });

  // world.events is a fresh bus per level — these route into the same persistent audio
  // nodes created once above.
  world.events.on('impact', (data) => impactVoices.playImpact(data));
  world.events.on('voice', (data) => powerVoices.handleVoice(data));
  world.events.on('death', ({ cause }) => {
    impactVoices.playDeath(cause);
    audio.duck(['bed', 'roll'], 4, 400);
  });

  current = { world, turn, player, marbles, levelIndex: n };
  drag = null;
  loop.start();
}

resize();
menu.show();

if (import.meta.env.DEV) {
  window.__TAW__ = {
    get world() { return current?.world; },
    get marbles() { return current?.marbles; },
    get player() { return current?.player; },
    get turn() { return current?.turn; },
    audio, impactVoices, powerVoices, renderer3d, startLevel, menu
  };
}
