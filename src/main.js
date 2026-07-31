import { createWorld, addMarble, setBoardHeight } from './core/world.js';
import { createLoop } from './core/loop.js';
import { stepPhysics } from './sim/physics.js';
import { createRenderer } from './render/canvas2d.js';

const SENSITIVITY = 3.0; // drag length in board-widths -> launch speed multiplier
const MARBLE_R = 0.035;

const canvas = document.getElementById('board');
const renderer = createRenderer(canvas);
const world = createWorld(Date.now() >>> 0);

function resize() {
  const aspect = canvas.clientHeight / canvas.clientWidth;
  setBoardHeight(world, aspect);
  renderer.resize(canvas.clientWidth);
}
window.addEventListener('resize', resize);
resize();

const marble = addMarble(world, { x: 0.5, y: world.h / 2, r: MARBLE_R });

// AIM: drag anywhere while the marble is at rest. Direction and length of the drag ARE
// the launch direction and power — a flick, not a slingshot pull-back.
let drag = null;

function toBoard(evt) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (evt.clientX - rect.left) / rect.width,
    y: (evt.clientY - rect.top) / rect.width // same divisor for x and y: one uniform scale
  };
}

function isResting(m) {
  return Math.hypot(m.vx, m.vy) < 1e-3;
}

canvas.addEventListener('pointerdown', (evt) => {
  if (!isResting(marble)) return;
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
  if (len > 0.01) {
    const speed = Math.min(world.maxSpeed, len * SENSITIVITY);
    marble.vx = (dx / len) * speed;
    marble.vy = (dy / len) * speed;
  }
  drag = null;
  canvas.releasePointerCapture(evt.pointerId);
});

const loop = createLoop({
  update: (dt) => stepPhysics(world, dt),
  render: (alpha) => {
    const aim = drag && {
      originX: marble.x,
      originY: marble.y,
      x: marble.x + (drag.x - drag.startX),
      y: marble.y + (drag.y - drag.startY)
    };
    renderer.draw(world, alpha, aim);
  }
});

loop.start();

if (import.meta.env.DEV) window.__TAW__ = { world, marble };
