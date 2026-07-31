/**
 * Canvas 2D truth-check renderer (docs/BUILD-ORDER.md M1/M4). Reads world state and the
 * current drag, owns nothing. Board-width units map to pixels 1:1 via `scale`.
 */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function resize(scale) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  }

  function draw(world, alpha, drag) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    // floor
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(0, 0, world.w, world.h);
    ctx.strokeStyle = '#6b4a2a';
    ctx.lineWidth = 0.01;
    ctx.strokeRect(0.005, 0.005, world.w - 0.01, world.h - 0.01);

    for (const m of world.marbles) {
      if (!m.alive) continue;
      const x = m.px + (m.x - m.px) * alpha;
      const y = m.py + (m.y - m.py) * alpha;
      drawMarble(ctx, x, y, m.r);
      // non-negotiable #6: the player is identified by a marker OUTSIDE the ball, never
      // by colour — a slowly rotating white ring with four orbiting pips.
      if (m.isPlayer) drawPlayerRing(ctx, x, y, m.r, world.time);
    }

    if (drag) drawAim(ctx, drag);
  }

  return { resize, draw };
}

function drawMarble(ctx, x, y, r) {
  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  grad.addColorStop(0, '#eaf6ff');
  grad.addColorStop(0.5, '#9fd0e8');
  grad.addColorStop(1, '#3f6b82');
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = r * 0.06;
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.stroke();
}

const RING_R_MUL = 1.6;
const RING_ROT_SPEED = 0.6; // rad/s, "slowly rotating"
const PIP_COUNT = 4;

function drawPlayerRing(ctx, x, y, r, time) {
  const ringR = r * RING_R_MUL;
  ctx.beginPath();
  ctx.arc(x, y, ringR, 0, Math.PI * 2);
  ctx.lineWidth = r * 0.12;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.stroke();

  const angle = time * RING_ROT_SPEED;
  for (let i = 0; i < PIP_COUNT; i++) {
    const a = angle + (i / PIP_COUNT) * Math.PI * 2;
    const px = x + Math.cos(a) * ringR;
    const py = y + Math.sin(a) * ringR;
    ctx.beginPath();
    ctx.arc(px, py, r * 0.16, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
}

function drawAim(ctx, { originX, originY, x, y }) {
  ctx.beginPath();
  ctx.moveTo(originX, originY);
  ctx.lineTo(x, y);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 0.008;
  ctx.setLineDash([0.015, 0.01]);
  ctx.stroke();
  ctx.setLineDash([]);
}
