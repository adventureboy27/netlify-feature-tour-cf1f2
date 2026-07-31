/**
 * TAW — marble powers.
 *
 * A power is announced before the level starts and applies to ALL FIVE marbles, not just
 * the player. It changes how marbles move. It never eliminates anyone directly — if a power
 * ends a marble (cannonball, bomb), it sets `lethalCause` and sim/rules.js decides.
 *
 * Roughly 30% of levels should have no power at all. Some environments are soloOnly and
 * never get one.
 *
 * `stats` are multipliers applied at launch, all optional:
 *   launchMul, decelMul, wallE, ballE, mass, radius
 *
 * Hooks (all optional):
 *   onLaunch(m, world)
 *   onStep(m, world, dt)
 *   onWallHit(m, world, force)
 *   onMarbleHit(m, other, world, force)   called for BOTH marbles in a collision, each from
 *                                         its own side — a mutual hit between two marbles
 *                                         sharing the power fires it twice
 *   onSettle(m, world)
 *   onDeath(m, world) -> true to veto the death
 *
 * `noCollide: true` (top-level, alongside `exclusive`) disables marble-marble collision
 * resolution entirely for the level — sim/physics.js checks this before running the elastic
 * collision at all, since by the time two marbles are touching it's too late for a hook to
 * un-happen a collision. Only `ghost` uses it.
 *
 * `passThroughTerrain: true` (same idea, same reason) skips dome/bumper collision in
 * sim/terrain.js. Only `drill` uses it.
 *
 * `sfx.voice` is bound to the PLAYER's marble specifically, so you can hear yourself apart
 * from the pack. Anything speed-driven must be synthesised, not sampled.
 */

/* ------------------------------------------------------------------ */
/* THREE FULLY IMPLEMENTED EXEMPLARS — follow these patterns           */
/* ------------------------------------------------------------------ */

export const turbo = {
  id: 'turbo',
  name: 'Turbo',
  blurb: 'Every marble is overpowered.',
  exclusive: false,
  stats: { launchMul: 2.0, decelMul: 0.85 },
  sfx: {
    voice: 'engine roar. revs hard on launch, pitch and filter cutoff both track THIS ' +
           'marble\'s own speed, settles into an idle burble as it slows. synthesised: ' +
           'sawtooth stack + lowpass, freq = 60 + 340 * (speed/max)'
  },
  onLaunch(m, world) {
    world.events.emit('voice', { id: 'turbo', marble: m, action: 'rev' });
  },
  onStep(m, world) {
    const sp = Math.hypot(m.vx, m.vy);
    world.events.emit('voice', { id: 'turbo', marble: m, speed: sp / world.maxSpeed });
  }
};

export const cannonball = {
  id: 'cannonball',
  name: 'Cannonball',
  blurb: 'You destroy what you hit. Then you stop dead.',
  exclusive: false,
  stats: { mass: 3.0, ballE: 0.05 },
  sfx: {
    voice: 'low iron rumble while rolling',
    hit: 'cannon crack, then a beat of total silence before the room comes back'
  },
  onMarbleHit(m, other, world, force) {
    // only a real hit counts, not a nudge at rest
    if (force < world.maxSpeed * 0.25) return;
    other.lethalCause = 'knocked out';   // rules.js decides, per non-negotiable #5
    m.vx = 0; m.vy = 0;                  // and you pay for it by stopping where you are
    world.events.emit('impact', { id: 'cannonball', x: m.x, y: m.y, force });
  }
};

export const molten = {
  id: 'molten',
  name: 'Molten',
  blurb: 'Wherever you stop, you burn a mark.',
  exclusive: false,
  stats: {},
  sfx: {
    voice: 'continuous sizzle, gain tracks speed',
    settle: 'a searing hiss as the mark sets'
  },
  onSettle(m, world) {
    // you wreck the board yourself — the scorch becomes lethal terrain NEXT turn,
    // so you always get one turn of warning about your own mess
    world.terrain.addScorch({
      x: m.x, y: m.y, r: m.r * 2.2,
      armsOnTurn: world.turn + 1,
      source: m.id
    });
    world.events.emit('voice', { id: 'molten', marble: m, action: 'settle' });
  }
};

/* ------------------------------------------------------------------ */
/* M7 — the next three, implemented per docs/BUILD-ORDER.md order      */
/* ------------------------------------------------------------------ */

export const lead = {
  id: 'lead',
  name: 'Lead',
  blurb: 'Short roll. Devastating shoulder.',
  exclusive: false,
  // No hooks needed: mass:4 alone is enough. The existing inverse-mass collision math in
  // physics.js already gives a heavy marble the "shoulder" — it barely moves, everything it
  // touches goes flying — for free.
  stats: { launchMul: 0.6, decelMul: 1.8, mass: 4 },
  sfx: {
    voice: 'massive dull rumble',
    hit: 'enormous low impact, room shake'
  }
};

export const cork = {
  id: 'cork',
  name: 'Cork',
  blurb: 'Nearly perfect bounce.',
  exclusive: false,
  // Also hookless: wallE/ballE here are the marble's effective restitution, not a multiplier
  // on the surface's — that's what makes 0.98/0.99 actually read as "nearly perfect."
  stats: { wallE: 0.98, ballE: 0.99, decelMul: 0.9 },
  sfx: {
    voice: 'light hollow tone',
    hit: 'rubbery boing, pitch per force'
  }
};

export const ghost = {
  id: 'ghost',
  name: 'Ghost',
  blurb: 'Marbles pass through each other.',
  exclusive: false,
  stats: {},
  noCollide: true, // sim/physics.js skips marble-marble collision resolution for the level
  sfx: {
    voice: 'airy hollow whoosh on each pass-through'
  }
};

/* ------------------------------------------------------------------ */
/* M8 — the rest, all 20                                               */
/* ------------------------------------------------------------------ */

export const hollow = {
  id: 'hollow', name: 'Hollow', blurb: 'One hard hit shatters you.', exclusive: false,
  stats: { mass: 0.4 },
  onMarbleHit(m, other, world, force) {
    if (force < world.maxSpeed * 0.5) return;
    m.lethalCause = 'shattered';
    other.lethalCause = 'shattered';
  },
  sfx: { voice: 'thin brittle ring', death: 'full glass shatter' }
};

// Inverse-square, but distSq is floored rather than just skipped below it — an unfloored
// 1/distSq blows up as marbles close in, easily exceeding rolling resistance at contact
// range and leaving a cluster that never fully damps out (found by testing magnet+magnetic
// together: 40+ seconds and still not settled). The floor caps the force at close range
// instead, so decay always eventually wins.
const CLUMP_DIST_SQ_FLOOR = 0.01; // ~0.1 board-widths, well above two marbles' contact distance

export const magnetic = {
  id: 'magnetic', name: 'Magnetic', blurb: 'Marbles pull toward each other.', exclusive: false,
  stats: {},
  onStep(m, world, dt) {
    for (const other of world.marbles) {
      if (other === m || !other.alive) continue;
      const dx = other.x - m.x, dy = other.y - m.y;
      const distSq = Math.max(dx * dx + dy * dy, CLUMP_DIST_SQ_FLOOR);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1e-6) continue;
      const strength = 0.006 / distSq;
      m.vx += (dx / dist) * strength * dt;
      m.vy += (dy / dist) * strength * dt;
    }
  },
  sfx: { voice: 'deep hum that intensifies with proximity' }
};

export const repulsor = {
  id: 'repulsor', name: 'Repulsor', blurb: 'Marbles shove each other away.', exclusive: false,
  stats: {},
  onStep(m, world, dt) {
    for (const other of world.marbles) {
      if (other === m || !other.alive) continue;
      const dx = m.x - other.x, dy = m.y - other.y;
      const distSq = Math.max(dx * dx + dy * dy, CLUMP_DIST_SQ_FLOOR);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1e-6) continue;
      const strength = 0.006 / distSq;
      m.vx += (dx / dist) * strength * dt;
      m.vy += (dy / dist) * strength * dt;
    }
  },
  sfx: { voice: 'bass thump on each repulsion event' }
};

export const sticky = {
  id: 'sticky', name: 'Sticky', blurb: 'First thing you touch, you are stuck to.', exclusive: false,
  stats: {},
  // Simplified weld: not full rigid-chain physics, a stiff spring holding the contact
  // distance once welded — reads as "stuck together" without a rotation/chain solver.
  onMarbleHit(m, other, world, force) {
    if (m.stuckTo || force < 0.05) return;
    m.stuckTo = other;
  },
  onStep(m, world, dt) {
    if (!m.stuckTo || !m.stuckTo.alive) { m.stuckTo = null; return; }
    const other = m.stuckTo;
    const dx = other.x - m.x, dy = other.y - m.y;
    const dist = Math.hypot(dx, dy) || 1;
    const stretch = dist - (m.r + other.r);
    m.vx += (dx / dist) * stretch * 8 * dt;
    m.vy += (dy / dist) * stretch * 8 * dt;
  },
  sfx: { voice: 'tar squelch on contact, low drag drone while joined' }
};

export const english = {
  id: 'english', name: 'English', blurb: 'Everything curves.', exclusive: false,
  stats: {},
  onLaunch(m, world) {
    if (m.englishSign === undefined) m.englishSign = world.rng.next() < 0.5 ? 1 : -1;
  },
  onStep(m, world, dt) {
    const speed = Math.hypot(m.vx, m.vy);
    if (speed < 1e-4) return;
    const px = -m.vy / speed, py = m.vx / speed;
    const sign = m.englishSign ?? 1;
    m.vx += px * 0.35 * sign * dt;
    m.vy += py * 0.35 * sign * dt;
  },
  sfx: { voice: 'tonal whistle bending with the curve' }
};

export const splitshot = {
  id: 'splitshot', name: 'Splitshot', blurb: 'You become two.', exclusive: true,
  stats: { radius: 0.75 },
  // Doesn't call core/world.js's addMarble directly — content mutates world/marble state,
  // it doesn't reach into the sim layer's constructors (docs/CLAUDE.md hook rules). Flags
  // the split; sim/physics.js does the actual roster change once per tick.
  onWallHit(m, world) {
    if (m.hasSplit) return;
    m.hasSplit = true;
    world.pendingSplit = m;
  },
  sfx: { voice: 'sharp fission crack, then two voices' }
};

export const greased = {
  id: 'greased', name: 'Greased', blurb: 'Nothing transfers.', exclusive: false,
  stats: { ballE: 0.15 },
  sfx: { voice: 'slick frictionless squeal on contact' }
};

export const feather = {
  id: 'feather', name: 'Feather', blurb: 'Everyone is weightless.', exclusive: false,
  stats: { mass: 0.25, decelMul: 0.7 },
  sfx: { voice: 'hollow high ping' }
};

export const nitro = {
  id: 'nitro', name: 'Nitro', blurb: 'A second kick mid-roll.', exclusive: false,
  stats: {},
  onLaunch(m) {
    m.nitroLaunchSpeed = Math.hypot(m.vx, m.vy);
    m.nitroFired = false;
  },
  onStep(m) {
    if (m.nitroFired || !m.nitroLaunchSpeed) return;
    const speed = Math.hypot(m.vx, m.vy);
    if (speed <= 0 || speed > m.nitroLaunchSpeed * 0.45) return;
    m.nitroFired = true;
    const scale = (m.nitroLaunchSpeed * 0.7) / speed;
    m.vx *= scale;
    m.vy *= scale;
  },
  sfx: { voice: 'turbo spool then blowoff valve' }
};

export const rewind = {
  id: 'rewind', name: 'Rewind', blurb: 'One death per level does not count.', exclusive: true,
  stats: {},
  // "start of the turn" position is snapshotted in sim/turn.js's beginAim for every marble.
  onDeath(m) {
    if (m.rewindUsed) return false;
    m.rewindUsed = true;
    m.x = m.turnStartX ?? m.x;
    m.y = m.turnStartY ?? m.y;
    m.vx = 0;
    m.vy = 0;
    return true;
  },
  sfx: { voice: 'tape rewind, reversed reverb' }
};

export const bomb = {
  id: 'bomb', name: 'Bomb', blurb: 'You detonate where you stop.', exclusive: false,
  stats: {},
  onSettle(m, world) {
    const RADIUS = 0.18, STRENGTH = 0.4;
    for (const other of world.marbles) {
      if (other === m || !other.alive) continue;
      const dx = other.x - m.x, dy = other.y - m.y;
      const dist = Math.hypot(dx, dy);
      if (dist > RADIUS || dist < 1e-6) continue;
      const falloff = 1 - dist / RADIUS;
      other.vx += (dx / dist) * STRENGTH * falloff;
      other.vy += (dy / dist) * STRENGTH * falloff;
    }
    world.events.emit('impact', { kind: 'bumper', force: STRENGTH, x: m.x, y: m.y });
  },
  sfx: { voice: 'fuse hiss while rolling', settle: 'blast + pressure wave' }
};

export const anchor = {
  id: 'anchor', name: 'Anchor', blurb: 'Plant once. Nothing moves you.', exclusive: false,
  stats: {},
  // The one-flick-per-turn input model has no separate "plant" gesture, so this reads as a
  // one-time automatic buff on a marble's second turn rather than a deliberate player choice.
  onLaunch(m, world) {
    if (m.anchorUsed) { m.mass = 1; return; }
    if (world.turn < 1) return;
    m.anchorUsed = true;
    m.mass = 1e6;
  },
  sfx: { voice: 'heavy clamp, then a dead solid thud on every impact' }
};

export const blink = {
  id: 'blink', name: 'Blink', blurb: 'You jump before you roll.', exclusive: false,
  stats: {},
  onLaunch(m) {
    const speed = Math.hypot(m.vx, m.vy);
    if (speed < 1e-4) return;
    const HOP = 0.06;
    m.x += (m.vx / speed) * HOP;
    m.y += (m.vy / speed) * HOP;
    m.px = m.x;
    m.py = m.y; // avoid a visible interpolation snap-line from the pre-hop position
  },
  sfx: { voice: 'electric snap, brief silence, then the roll' }
};

export const drill = {
  id: 'drill', name: 'Drill', blurb: 'You go through terrain.', exclusive: false,
  stats: {},
  passThroughTerrain: true, // sim/terrain.js skips dome/bumper collision for the level
  onStep(m, world) {
    const FILL_MAX_R = 0.045;
    const holes = world.terrain.holes;
    for (let i = holes.length - 1; i >= 0; i--) {
      const h = holes[i];
      if (h.r > FILL_MAX_R) continue;
      if (Math.hypot(m.x - h.x, m.y - h.y) < h.r + m.r) holes.splice(i, 1);
    }
  },
  sfx: { voice: 'whirring bore, pitch per speed' }
};

export const frost = {
  id: 'frost', name: 'Frost', blurb: 'You leave ice behind you.', exclusive: false,
  stats: {},
  onStep(m, world, dt) {
    const speed = Math.hypot(m.vx, m.vy);
    if (speed < 0.05) return;
    m.frostTimer = (m.frostTimer ?? 0) + dt;
    if (m.frostTimer < 0.08) return;
    m.frostTimer = 0;
    world.terrain.addIcePatch({ x: m.x, y: m.y, r: m.r * 1.5 });
  },
  sfx: { voice: 'freezing crackle laid down behind the marble' }
};

export const siphon = {
  id: 'siphon', name: 'Siphon', blurb: 'You steal speed.', exclusive: false,
  stats: {},
  onMarbleHit(m, other, world, force) {
    if (force < 0.05) return;
    const stolen = Math.hypot(other.vx, other.vy) * 0.6;
    const base = Math.hypot(m.vx, m.vy) > 1e-4 ? m : other;
    const baseLen = Math.hypot(base.vx, base.vy) || 1;
    m.vx += (base.vx / baseLen) * stolen;
    m.vy += (base.vy / baseLen) * stolen;
    other.vx *= 0.15;
    other.vy *= 0.15;
  },
  sfx: { voice: 'draining downward sweep on contact' }
};

export const boomerang = {
  id: 'boomerang', name: 'Boomerang', blurb: 'You come back.', exclusive: false,
  stats: {},
  onLaunch(m) {
    m.boomerangHome = { x: m.x, y: m.y };
  },
  onStep(m, world, dt) {
    if (!m.boomerangHome) return;
    const dx = m.boomerangHome.x - m.x, dy = m.boomerangHome.y - m.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-4) return;
    m.vx += (dx / dist) * 0.25 * dt;
    m.vy += (dy / dist) * 0.25 * dt;
  },
  sfx: { voice: 'rotating hum, doppler as it turns' }
};

export const shield = {
  id: 'shield', name: 'Shield', blurb: 'Survive one lethal hit.', exclusive: false,
  stats: {},
  onDeath(m) {
    if (m.shieldUsed) return false;
    m.shieldUsed = true;
    return true;
  },
  sfx: { voice: 'bell chime absorbing the hit, glass ring decaying' }
};

export const comet = {
  id: 'comet', name: 'Comet', blurb: 'You burn a trail.', exclusive: false,
  stats: { launchMul: 1.4 },
  onStep(m, world, dt) {
    const speed = Math.hypot(m.vx, m.vy);
    if (speed >= 0.1) {
      m.cometTimer = (m.cometTimer ?? 0) + dt;
      if (m.cometTimer >= 0.06) {
        m.cometTimer = 0;
        const trail = world.terrain.addLava({ x: m.x, y: m.y, r: m.r * 1.3 });
        trail.expiresOnTurn = world.turn + 2;
      }
    }
    // powers have no onTurnStart, so expiry cleanup piggybacks on this per-tick hook —
    // redundant across the 5 marbles calling it each tick, harmless given the array size
    const lavas = world.terrain.lavas;
    for (let i = lavas.length - 1; i >= 0; i--) {
      if (lavas[i].expiresOnTurn !== undefined && world.turn >= lavas[i].expiresOnTurn) lavas.splice(i, 1);
    }
  },
  sfx: { voice: 'roaring flame, gain tracks speed' }
};

export const shockwave = {
  id: 'shockwave', name: 'Shockwave', blurb: 'Your first wall hit moves everyone.', exclusive: false,
  stats: {},
  onLaunch(m) { m.shockwaveFiredThisTurn = false; },
  onWallHit(m, world) {
    if (m.shockwaveFiredThisTurn) return;
    m.shockwaveFiredThisTurn = true;
    const RADIUS = 0.3, STRENGTH = 0.5;
    for (const other of world.marbles) {
      if (other === m || !other.alive) continue;
      const dx = other.x - m.x, dy = other.y - m.y;
      const dist = Math.hypot(dx, dy);
      if (dist > RADIUS || dist < 1e-6) continue;
      const falloff = 1 - dist / RADIUS;
      other.vx += (dx / dist) * STRENGTH * falloff;
      other.vy += (dy / dist) * STRENGTH * falloff;
    }
  },
  sfx: { voice: 'deep sonic boom, sub-bass ring expanding' }
};

export const rest = [];
