import { createWorld, addMarble, setBoardHeight } from './core/world.js';
import { createLoop } from './core/loop.js';
import { stepPhysics } from './sim/physics.js';
import { createTurnMachine } from './sim/turn.js';
import { createRenderer } from './render/canvas2d.js';
import { createHud } from './render/hud.js';

const SENSITIVITY = 3.0; // drag length in board-widths -> launch speed multiplier
const MARBLE_R = 0.035;
const MARBLE_COUNT = 5;

const canvas = document.getElementById('board');
const renderer = createRenderer(canvas);
const hud = createHud(document.getElementById('hud'));
const world = createWorld(Date.now() >>> 0);

function resize() {
  const aspect = canvas.clientHeight / canvas.clientWidth;
  setBoardHeight(world, aspect);
  renderer.resize(canvas.clientWidth);
}
window.addEventListener('resize', resize);
resize();

// evenly spaced along the horizontal centre line, spacing far wider than 2r so nobody
// starts overlapping regardless of aspect ratio
const marbles = [];
for (let i = 0; i < MARBLE_COUNT; i++) {
  const x = 0.2 + i * 0.15;
  marbles.push(addMarble(world, { x, y: world.h / 2, r: MARBLE_R, isPlayer: i === 0 }));
}
const player = marbles[0];

const turn = createTurnMachine(world);
world.events.on('phase', ({ turn: t, phase }) => hud.setPhase(t, phase));
world.events.on('win', ({ winner }) => hud.setWinner(winner));

// AIM: drag anywhere while it's the player's turn to aim. Direction and length of the
// drag ARE the launch direction and power — a flick, not a slingshot pull-back.
let drag = null;

function toBoard(evt) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (evt.clientX - rect.left) / rect.width,
    y: (evt.clientY - rect.top) / rect.width // same divisor for x and y: one uniform scale
  };
}

function canAim() {
  return turn.phase === 'AIM' && player.alive;
}

canvas.addEventListener('pointerdown', (evt) => {
  if (!canAim()) return;
  const p = toBoard(evt);
  drag = { startX: p.x, startY: p.y, x: p.x, y: p.y };
  canvas.setPointerCapture(evt.pointerId);
});

canvas.addEventListener('pointermove', (evt) => {
  if (!drag) return;
  const p = toBoard(evt);
  drag.x = p.x;
  drag.y = p.y;
});

canvas.addEventListener('pointerup', (evt) => {
  if (!drag) return;
  const dx = drag.x - drag.startX;
  const dy = drag.y - drag.startY;
  const len = Math.hypot(dx, dy);
  drag = null;
  canvas.releasePointerCapture(evt.pointerId);
  if (len <= 0.01 || !canAim()) return;
  const speed = Math.min(world.maxSpeed, len * SENSITIVITY);
  turn.launch((dx / len) * speed, (dy / len) * speed);
});

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
    renderer.draw(world, alpha, aim);
  }
});

loop.start();

if (import.meta.env.DEV) window.__TAW__ = { world, marbles, player, turn };
