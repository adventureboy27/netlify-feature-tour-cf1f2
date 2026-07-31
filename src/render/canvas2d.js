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

    // rails follow world.bounds, not the fixed board extent — closing shrinks bounds every
    // turn. sumo (and anything else with rails:false) draws a disc boundary instead.
    if (world.rails !== false) {
      const { l, r, t, b } = world.bounds;
      ctx.strokeStyle = '#6b4a2a';
      ctx.lineWidth = 0.01;
      ctx.strokeRect(l + 0.005, t + 0.005, (r - l) - 0.01, (b - t) - 0.01);
    }
    if (world.disc) {
      ctx.beginPath();
      ctx.arc(world.disc.x, world.disc.y, world.disc.r, 0, Math.PI * 2);
      ctx.strokeStyle = '#6b4a2a';
      ctx.lineWidth = 0.012;
      ctx.stroke();
    }

    drawTerrain(ctx, world);
    drawEnvironmentExtras(ctx, world);

    let playerX = null, playerY = null;
    for (const m of world.marbles) {
      if (!m.alive) continue;
      const x = m.px + (m.x - m.px) * alpha;
      const y = m.py + (m.y - m.py) * alpha;
      drawMarble(ctx, x, y, m.r, m.colour);
      // non-negotiable #6: the player is identified by a marker OUTSIDE the ball, never
      // by colour — a slowly rotating white ring with four orbiting pips.
      if (m.isPlayer) { drawPlayerRing(ctx, x, y, m.r, world.time); playerX = x; playerY = y; }
    }

    if (drag) drawAim(ctx, drag);

    // blackout draws last, over everything except the (already-drawn) player marble+ring —
    // "never hide the player marble"
    if (world.blackoutRadius != null && playerX != null) {
      drawBlackout(ctx, world, playerX, playerY);
    }
  }

  return { resize, draw };
}

const COLOUR_CSS = {
  crimson: [200, 40, 60],
  gold: [220, 180, 50],
  teal: [40, 160, 160],
  violet: [140, 80, 200]
};

function colourToCss(colour, alpha) {
  const rgb = COLOUR_CSS[colour] ?? [190, 190, 190];
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}

function drawMarble(ctx, x, y, r, colour) {
  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  if (colour && colour !== 'bare') {
    const [cr, cg, cb] = COLOUR_CSS[colour] ?? [190, 190, 190];
    grad.addColorStop(0, '#f5f5f5');
    grad.addColorStop(0.5, `rgb(${cr},${cg},${cb})`);
    grad.addColorStop(1, `rgb(${cr * 0.4 | 0},${cg * 0.4 | 0},${cb * 0.4 | 0})`);
  } else {
    grad.addColorStop(0, '#eaf6ff');
    grad.addColorStop(0.5, '#9fd0e8');
    grad.addColorStop(1, '#3f6b82');
  }
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

function drawTerrain(ctx, world) {
  const t = world.terrain;

  if (t.water) drawWater(ctx, world, t.water);

  for (const p of t.colourPatches) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = colourToCss(p.colour, 0.55);
    ctx.fill();
  }

  for (const l of t.lavas) {
    const grad = ctx.createRadialGradient(l.x, l.y, l.r * 0.1, l.x, l.y, l.r);
    grad.addColorStop(0, '#ffdd66');
    grad.addColorStop(0.5, '#ff6a1f');
    grad.addColorStop(1, '#7a1600');
    ctx.beginPath();
    ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  for (const h of t.holes) {
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0705';
    ctx.fill();
    ctx.lineWidth = 0.004;
    ctx.strokeStyle = '#1c130c';
    ctx.stroke();
  }

  for (const c of t.craters) {
    const grad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
    grad.addColorStop(0, 'rgba(0,0,0,0.55)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  for (const p of t.icePatches) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(190,235,255,0.35)';
    ctx.fill();
    ctx.lineWidth = 0.003;
    ctx.strokeStyle = 'rgba(220,245,255,0.6)';
    ctx.stroke();
  }

  for (const r of t.ramps) {
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 0.004;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(r.x, r.y);
    ctx.lineTo(r.x + r.dirX * r.r * 0.8, r.y + r.dirY * r.r * 0.8);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 0.006;
    ctx.stroke();
  }

  for (const d of t.domes) {
    const grad = ctx.createRadialGradient(d.x - d.r * 0.3, d.y - d.r * 0.3, d.r * 0.1, d.x, d.y, d.r);
    grad.addColorStop(0, '#6b5238');
    grad.addColorStop(1, '#3a2a1a');
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  for (const g of t.gutters) {
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fill();
    ctx.setLineDash([0.008, 0.008]);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 0.003;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  for (const b of t.bumpers) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = '#c94f4f';
    ctx.fill();
    ctx.lineWidth = 0.006;
    ctx.strokeStyle = '#ffdede';
    ctx.stroke();
  }

  for (const c of t.conveyors) {
    ctx.fillStyle = 'rgba(90,70,50,0.5)';
    ctx.fillRect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h);
  }

  for (const f of t.fissures) {
    ctx.beginPath();
    ctx.moveTo(f.x1, f.y1);
    ctx.lineTo(f.x2, f.y2);
    ctx.strokeStyle = '#0a0705';
    ctx.lineWidth = f.width;
    ctx.stroke();
  }

  for (const s of t.scorches) {
    const armed = world.turn >= s.armsOnTurn;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = armed ? 'rgba(255,80,20,0.6)' : 'rgba(60,40,30,0.6)';
    ctx.fill();
  }
}

// The handful of environments whose state doesn't live in world.terrain (quicksand's
// patches, meteor's telegraph, grinder's sweep line) — drawn from world directly.
function drawEnvironmentExtras(ctx, world) {
  if (world.quicksandPatches) {
    for (const p of world.quicksandPatches) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(90,80,40,0.5)';
      ctx.fill();
    }
  }

  if (world.meteorNext) {
    ctx.beginPath();
    ctx.arc(world.meteorNext.x, world.meteorNext.y, 0.05, 0, Math.PI * 2);
    ctx.setLineDash([0.01, 0.01]);
    ctx.strokeStyle = 'rgba(255,120,60,0.8)';
    ctx.lineWidth = 0.005;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (world.grinderAxis) {
    ctx.beginPath();
    if (world.grinderAxis === 'x') {
      const x = world.bounds.l + world.grinderPos * (world.bounds.r - world.bounds.l);
      ctx.moveTo(x, world.bounds.t);
      ctx.lineTo(x, world.bounds.b);
    } else {
      const y = world.bounds.t + world.grinderPos * (world.bounds.b - world.bounds.t);
      ctx.moveTo(world.bounds.l, y);
      ctx.lineTo(world.bounds.r, y);
    }
    ctx.strokeStyle = 'rgba(200,60,60,0.85)';
    ctx.lineWidth = 0.015;
    ctx.stroke();
  }
}

// "Visibility shrinks to a pool around your own marble." Punches a hole in a dark overlay
// using the evenodd fill rule rather than compositing tricks, so it stays simple canvas 2D.
function drawBlackout(ctx, world, px, py) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, world.w, world.h);
  ctx.moveTo(px + world.blackoutRadius, py);
  ctx.arc(px, py, world.blackoutRadius, 0, Math.PI * 2, true);
  ctx.fillStyle = 'rgba(5,3,2,0.98)';
  ctx.fill('evenodd');
  ctx.restore();
}

function drawWater(ctx, world, water) {
  const { edge, level } = water;
  ctx.fillStyle = 'rgba(30,90,140,0.55)';
  if (edge === 'l') ctx.fillRect(0, 0, level * world.w, world.h);
  else if (edge === 'r') ctx.fillRect(world.w - level * world.w, 0, level * world.w, world.h);
  else if (edge === 't') ctx.fillRect(0, 0, world.w, level * world.h);
  else if (edge === 'b') ctx.fillRect(0, world.h - level * world.h, world.w, level * world.h);
}
