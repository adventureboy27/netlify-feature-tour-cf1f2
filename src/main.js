import { createWorld, addMarble, setBoardHeight } from './core/world.js';
import { createLoop } from './core/loop.js';
import { stepPhysics } from './sim/physics.js';
import { createTurnMachine } from './sim/turn.js';
import { generateTerrain } from './sim/terrain.js';
import { level, levelCount } from './content/levels.js';
import { drawOpponents } from './content/roster.js';
import { recordGame } from './content/stats.js';
import { createRenderer } from './render/canvas2d.js';
import { createRenderer3D } from './render/scene.js';
import { createHud } from './render/hud.js';
import { createMenu, createEndOverlay } from './render/menu.js';
import { createAudioEngine } from './audio/engine.js';
import { createRollingBed } from './audio/beds.js';
import { createImpactVoices } from './audio/impacts.js';
import { createPowerVoices } from './audio/voices.js';

const MARBLE_R = 0.035;
const MARBLE_COUNT = 5;

// launcher tuning — see the "AIM: hold to charge" block below for the mechanic itself
const SWEEP_SPEED = Math.PI * 2 * 0.85; // rad/s the direction marker races around the marble
const CHARGE_MAX_TIME = 1.4;            // seconds held to reach full power
const OVERHEAT_TIME = 2.2;              // seconds held before the launcher forces a shot
const MIN_POWER_FRAC = 0.5;             // launch speed floor as a fraction of maxSpeed — even
                                         // a bare tap-and-release still rolls several marbles' worth

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

// AIM: hold anywhere to charge. A marker races around the marble on its own — direction is
// no longer something you drag out, it's whatever the marker is on when you let go, so aim
// is a timing skill instead of a free choice (think a kicker's meter, not a slingshot pull).
// Power ramps with how long you hold; holding well past full charge overheats the launcher
// and it fires a random, uncontrolled shot for you instead of waiting for release.
let charge = null; // { pointerId, startTime, angle, power, overheating }

function canAim() {
  return current !== null && current.turn.phase === 'AIM' && current.player.alive;
}

function startCharge(evt, el) {
  audio.resume();
  if (!canAim() || charge) return; // a second finger touching down must not hijack the charge
  charge = { pointerId: evt.pointerId, startTime: current.world.time, angle: 0, power: 0, overheating: false };
  el.setPointerCapture(evt.pointerId);
}

// commit=false means the hold was abandoned (pointer cancelled) rather than released — no
// shot fires, same spirit as the old drag's pointercancel handling.
function releaseCharge(commit) {
  if (!charge) return;
  const { angle, power, overheating } = charge;
  charge = null;
  hud.setCharge(null);
  if (!commit || !canAim()) return;

  const world = current.world;
  // overheat's randomness goes through world.rng like every other draw (docs/CLAUDE.md) so
  // a replayed seed reproduces the same "penalty" shot too, not just the deliberate ones.
  const shotAngle = overheating ? world.rng.next() * Math.PI * 2 : angle;
  const speed = overheating
    ? world.maxSpeed * (0.1 + world.rng.next() * 0.9)
    : world.maxSpeed * MIN_POWER_FRAC + world.maxSpeed * (1 - MIN_POWER_FRAC) * power;
  current.turn.launch(Math.cos(shotAngle) * speed, Math.sin(shotAngle) * speed);
}

// runs once per rendered frame (not per physics substep) — driven off world.time so it stays
// in lockstep with however many substeps actually ran this frame, with nothing extra to track.
function updateCharge() {
  if (!charge) return;
  if (!canAim()) { charge = null; hud.setCharge(null); return; } // turn ended mid-hold

  const elapsed = current.world.time - charge.startTime;
  charge.angle = (elapsed * SWEEP_SPEED) % (Math.PI * 2);
  charge.power = Math.min(1, elapsed / CHARGE_MAX_TIME);

  if (elapsed >= OVERHEAT_TIME) {
    charge.overheating = true;
    hud.flashOverheat();
    releaseCharge(true); // forced shot now — greed doesn't get to wait for a better release
    return;
  }
  hud.setCharge(charge.power, charge.overheating);
}

for (const el of [canvas3d, canvas2d]) {
  el.addEventListener('pointerdown', (evt) => startCharge(evt, el));

  el.addEventListener('pointerup', (evt) => {
    if (!charge || evt.pointerId !== charge.pointerId) return;
    el.releasePointerCapture(evt.pointerId);
    releaseCharge(true);
  });

  // mobile: the OS can cancel an in-progress touch (an interrupting system gesture, an
  // incoming call...). Treated as an abandoned hold, not a release.
  el.addEventListener('pointercancel', (evt) => {
    if (!charge || evt.pointerId !== charge.pointerId) return;
    releaseCharge(false);
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
    updateCharge();
    const { world } = current;
    const chargeView = charge && { angle: charge.angle, power: charge.power, overheating: charge.overheating };
    if (mode === '3d') renderer3d.draw(world, alpha, chargeView);
    else renderer2d.draw(world, alpha, chargeView);
    rollingBed.update(world);
  }
});

// ---- landscape lock ----
// The Screen Orientation API's lock() only works in fullscreen/standalone contexts on most
// mobile browsers, so it's a bonus attempt, not the mechanism this actually relies on: the
// real lock is refusing to run the loop and showing this prompt instead. Gated on a
// touch-primary device (matchMedia pointer:coarse) so a desktop window that happens to be
// narrow is never affected — the board itself already adapts to any aspect ratio.
const rotateOverlay = document.getElementById('rotate-overlay');
function blockedByOrientation() {
  return window.matchMedia('(pointer: coarse)').matches && window.innerHeight > window.innerWidth;
}
function updateOrientationGate() {
  const blocked = blockedByOrientation();
  rotateOverlay.style.display = blocked ? 'flex' : 'none';
  if (blocked) loop.stop();
  else if (current) loop.start();
}
window.addEventListener('resize', updateOrientationGate);
window.addEventListener('orientationchange', updateOrientationGate);
screen.orientation?.lock?.('landscape').catch(() => {});

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
  // which 4 recurring opponents show up is drawn from the same seeded stream as everything
  // else about this level (content/roster.js) — a replayed seed gets the same rivals back.
  const opponentNumbers = drawOpponents(world.rng);
  const marbles = [];
  for (let i = 0; i < MARBLE_COUNT; i++) {
    const x = 0.2 + i * 0.15;
    marbles.push(addMarble(world, {
      x, y: world.h / 2, isPlayer: i === 0,
      number: i === 0 ? null : opponentNumbers[i - 1], // the player is never numbered — non-negotiable #6
      r: MARBLE_R * (powerStats.radius ?? 1),
      mass: powerStats.mass ?? 1,
      decelMul: powerStats.decelMul ?? 1,
      launchMul: powerStats.launchMul ?? 1,
      wallE: powerStats.wallE ?? null,
      ballE: powerStats.ballE ?? null
    }));
  }
  const player = marbles[0];
  hud.setOpponents(opponentNumbers);

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

    // round + career stats (content/stats.js) — every marble that was in this level,
    // including the player, gets folded into its own persistent record.
    const participants = world.marbles.map((m) => ({
      number: m.number, isPlayer: m.isPlayer, won: m === winner,
      cause: m.lethalCause, topSpeed: m.topSpeed, damage: m.damage,
      survivedTurns: m.alive ? world.turn : (m.diedAtTurn ?? world.turn)
    }));
    const stats = recordGame(participants);

    endOverlay.show(winner, true, { participants, stats });
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
  charge = null;
  hud.setCharge(null);
  loop.start();
}

resize();
updateOrientationGate();
menu.show();

if (import.meta.env.DEV) {
  window.__TAW__ = {
    get world() { return current?.world; },
    get marbles() { return current?.marbles; },
    get player() { return current?.player; },
    get turn() { return current?.turn; },
    get charge() { return charge; },
    audio, impactVoices, powerVoices, renderer3d, startLevel, menu,
    startCharge, releaseCharge, updateCharge
  };
}
