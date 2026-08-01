/**
 * TAW — environments.
 *
 * An environment is announced before the level starts and gets one step worse every turn.
 * It is the ONLY thing that eliminates marbles, and it always does so physically: you fell
 * in, you burned, you drowned, you left the board, you were crushed.
 *
 * Hooks (all optional):
 *   onLevelStart(world)          build initial terrain
 *   onTurnStart(world, turn)     THE IMPORTANT ONE — this is where it gets worse
 *   onStep(world, dt)            continuous forces: magnet, wind, conveyor, carousel
 *   onSettle(world)              flag terrain-based eliminations (rules.js does the killing)
 *
 * Rules for authors:
 *   - every random draw goes through world.rng, never Math.random
 *   - never kill directly. add terrain or set marble.lethalCause and let sim/rules.js decide
 *   - severity is turn/severityCurve clamped 0..1; use it to scale everything
 *
 * `sfx` describes intent for audio/beds.js. Prefer synthesis over samples for anything
 * that has to track a continuous value.
 */

import { shrinkRails } from '../sim/terrain.js';
import { accrueDamage } from '../sim/damage.js';

/* ------------------------------------------------------------------ */
/* THREE FULLY IMPLEMENTED EXEMPLARS — follow these patterns           */
/* ------------------------------------------------------------------ */

const CLOSING_MIN_BOX = 0.16; // board-widths — walls stop squeezing once there's still a
                               // little room to maneuver around the lava; it alone finishes
                               // the job from there, not an ever-tightening wall

export const closing = {
  id: 'closing',
  name: 'The Closing',
  blurb: 'The rails are marching inward.',
  soloOnly: false,
  severityCurve: 10,
  sfx: {
    bed: 'mechanical groan, fundamental rises with severity',
    stinger: 'heavy servo clunk + stone grind, one per contraction'
  },
  onLevelStart(world) { world.closingLava = null; },
  onTurnStart(world, turn) {
    // The walls herd you — they don't kill on contact. What's actually lethal is the lava
    // growing in the centre, which the shrinking box leaves less and less room to avoid.
    // (Playtesting: the ring itself being lethal on touch read as "the wall killed me," not
    // "I got squeezed into the thing in the middle" — the walls are pressure, not the blade.)
    const bite = 0.04 * (1 + turn * 0.06);
    if (world.bounds.r - world.bounds.l > CLOSING_MIN_BOX && world.bounds.b - world.bounds.t > CLOSING_MIN_BOX) {
      shrinkRails(world, bite);
    }
    if (!world.closingLava) {
      world.closingLava = world.terrain.addLava({ x: world.w / 2, y: world.h / 2, r: 0.03 });
    } else {
      world.terrain.growLava(world.closingLava, 0.012 * (1 + turn * 0.07));
    }
    world.events.emit('degrade', { id: 'closing', turn });
  }
};

export const sumo = {
  id: 'sumo',
  name: 'Sumo Floor',
  blurb: 'No rails. The disc is shrinking.',
  soloOnly: false,
  severityCurve: 12,
  sfx: {
    bed: 'low taiko pulse, tempo climbs as the disc narrows; stone grinding underneath',
    stinger: 'single deep drum hit + crowd swell, louder each turn'
  },
  onLevelStart(world) {
    world.shape = 'disc';
    world.disc = { x: world.w / 2, y: world.h / 2, r: Math.min(world.w, world.h) * 0.46 };
    world.rails = false;                 // physics.js must skip wall collision entirely
  },
  onTurnStart(world, turn) {
    world.disc.r *= 0.90;                // 10% off the radius every turn
    world.events.emit('degrade', { id: 'sumo', turn });
  },
  onStep(world) {
    // leaving the disc is instant, at any speed. no grace, no bounce.
    for (const m of world.marbles) {
      if (!m.alive) continue;
      const d = Math.hypot(m.x - world.disc.x, m.y - world.disc.y);
      if (d > world.disc.r - m.r * 0.35) m.lethalCause = 'fell';
    }
  }
};

export const roulette = {
  id: 'roulette',
  name: 'Roulette',
  blurb: 'One colour is condemned. Nobody knows whose it will be.',
  soloOnly: true,                        // never paired with a power
  severityCurve: 8,
  sfx: {
    bed: 'rapid mechanical ticking; tick rate is bound to each marble\'s own speed, so the ' +
         'whole board audibly slows down together, like a wheel losing momentum',
    stinger: 'chime per marble as its colour locks in, then a hard detonation on the purge'
  },
  onLevelStart(world) {
    world.condemned = world.rng.pick(world.palette);   // announced up front, on screen always
    world.strobe = true;
  },
  onStep(world, dt) {
    // marbles strobe while rolling; the strobe slows exactly as the marble slows
    for (const m of world.marbles) {
      if (!m.alive) continue;
      const sp = Math.hypot(m.vx, m.vy);
      if (sp <= 0) continue;
      m.strobeT = (m.strobeT || 0) + dt * (2 + 40 * (sp / world.maxSpeed));
      if (m.strobeT > 1) { m.strobeT = 0; m.colour = world.rng.pick(world.palette); }
    }
  },
  onSettle(world) {
    // lock to the patch underneath, chime, then purge
    for (const m of world.marbles) {
      if (!m.alive) continue;
      const patch = world.terrain.patchAt(m.x, m.y);
      m.colour = patch ? patch.colour : 'bare';
      world.events.emit('lock', { marble: m });
      // condemned2 (announced after turn 3, "it gets worse") was being set but never
      // actually checked here — the second colour was purely decorative and the escalation
      // did nothing, which is exactly why roulette could run for hundreds of turns instead
      // of the level actually getting worse the way it announces.
      if (m.colour === world.condemned || (world.condemned2 && m.colour === world.condemned2)) {
        m.lethalCause = 'shattered';
      }
    }
  },
  onTurnStart(world, turn) {
    // it gets worse: after turn 3 a second colour is condemned
    if (turn === 3) world.condemned2 = world.rng.pick(
      world.palette.filter(c => c !== world.condemned));
    // the baseline board only ever has 3 small colour patches total (sim/terrain.js's
    // generateTerrain) — the overwhelming majority of settle spots are bare floor, safe from
    // roulette no matter which colours are condemned. That's what actually made roulette run
    // for hundreds of turns, far more than the missing condemned2 check alone accounted for.
    // More of the floor needs to be colour as the wheel keeps spinning.
    if (turn % 2 === 0) {
      world.terrain.addColourPatch({
        x: world.rng.range(world.bounds.l + 0.06, world.bounds.r - 0.06),
        y: world.rng.range(world.bounds.t + 0.06, world.bounds.b - 0.06),
        r: 0.045, colour: world.rng.pick(world.palette)
      });
    }
    world.events.emit('degrade', { id: 'roulette', turn });
  }
};

/* ------------------------------------------------------------------ */
/* M6 — the next four, implemented per docs/BUILD-ORDER.md order       */
/* ------------------------------------------------------------------ */

export const rot = {
  id: 'rot',
  name: 'Rot',
  blurb: 'The floor is going soft.',
  soloOnly: false,
  severityCurve: 10,
  sfx: {
    bed: 'wet splintering, damp low rumble',
    stinger: 'timber giving way'
  },
  onTurnStart(world, turn) {
    // holes creep in from a random edge each turn, more and wider as it worsens — uncapped,
    // not clamped to 1: severity used to plateau at severityCurve turns and then never get
    // any worse, which let a cautious game stall indefinitely instead of the floor actually
    // finishing the job the way "the board is always getting worse" promises.
    const severity = turn / this.severityCurve;
    const count = 1 + Math.floor(severity * 2);
    for (let i = 0; i < count; i++) {
      const edge = world.rng.pick(['l', 'r', 't', 'b']);
      const inward = 0.03 + severity * 0.12;
      const along = world.rng.range(0.05, 0.95);
      let x, y;
      if (edge === 'l') { x = world.bounds.l + inward; y = world.bounds.t + along * world.h; }
      else if (edge === 'r') { x = world.bounds.r - inward; y = world.bounds.t + along * world.h; }
      else if (edge === 't') { x = world.bounds.l + along * world.w; y = world.bounds.t + inward; }
      else { x = world.bounds.l + along * world.w; y = world.bounds.b - inward; }
      world.terrain.addHole({ x, y, r: 0.03 + severity * 0.04 });
    }
    world.events.emit('degrade', { id: 'rot', turn });
  }
};

export const flow = {
  id: 'flow',
  name: 'The Flow',
  blurb: 'The lava is spreading.',
  soloOnly: false,
  severityCurve: 9,
  sfx: {
    bed: 'thick bubbling, felt more than heard',
    stinger: 'hiss and surge'
  },
  onLevelStart(world) {
    const x = world.rng.range(world.bounds.l + 0.15, world.bounds.r - 0.15);
    const y = world.rng.range(world.bounds.t + 0.15, world.bounds.b - 0.15);
    world.flowPool = world.terrain.addLava({ x, y, r: 0.05 });
  },
  onTurnStart(world, turn) {
    world.terrain.growLava(world.flowPool, 0.02 * (1 + turn * 0.05));
    // every other turn a river breaks off the main pool, cutting a new crossing
    if (turn % 2 === 0) {
      const angle = world.rng.range(0, Math.PI * 2);
      const dist = world.flowPool.r + 0.03;
      world.terrain.addLava({
        x: world.flowPool.x + Math.cos(angle) * dist,
        y: world.flowPool.y + Math.sin(angle) * dist,
        r: 0.02
      });
    }
    world.events.emit('degrade', { id: 'flow', turn });
  }
};

export const sinkhole = {
  id: 'sinkhole',
  name: 'Sinkhole',
  blurb: 'Something opened in the middle.',
  soloOnly: false,
  severityCurve: 11,
  sfx: {
    bed: 'sub-bass drone that deepens each turn',
    stinger: 'collapse'
  },
  onLevelStart(world) {
    world.sinkholeVoid = world.terrain.addHole({ x: world.w / 2, y: world.h / 2, r: 0.04 });
  },
  onTurnStart(world, turn) {
    // starts at 0.04, under drill's (data/powers.js) fill-radius of 0.045 — a drill marble
    // can remove it entirely during the very first roll, before growth ever gets applied.
    // Recreate rather than growing a reference to a hole no longer in world.terrain.holes.
    if (!world.terrain.holes.includes(world.sinkholeVoid)) {
      world.sinkholeVoid = world.terrain.addHole({ x: world.w / 2, y: world.h / 2, r: 0.04 });
    }
    world.sinkholeVoid.r += 0.018 * (1 + turn * 0.08);
    world.events.emit('degrade', { id: 'sinkhole', turn });
  }
};

export const tide = {
  id: 'tide',
  name: 'Rising Tide',
  blurb: 'The water is coming in.',
  soloOnly: false,
  severityCurve: 10,
  sfx: {
    bed: 'lapping that gets closer and louder',
    stinger: 'wave surge'
  },
  onLevelStart(world) {
    world.tideEdge = world.rng.pick(['l', 'r', 't', 'b']);
    world.terrain.setWaterLine({ edge: world.tideEdge, level: 0 });
  },
  onTurnStart(world, turn) {
    // capped short of 1, not at 1 itself: always leaves a dry strip until very late, non-
    // negotiable #5 backstops the rest. The strip does need to keep shrinking though — a
    // flat 0.05/turn hit its old 0.85 ceiling at turn 17 and then just sat there forever,
    // which left a stalemate-sized strip of dry board standing for the rest of the level.
    world.terrain.setWaterLine({ edge: world.tideEdge, level: Math.min(0.97, 0.03 * turn * (1 + turn * 0.02)) });
    world.events.emit('degrade', { id: 'tide', turn });
  }
};

/* ------------------------------------------------------------------ */
/* M8 — the rest, all 19                                               */
/* ------------------------------------------------------------------ */

export const crumble = {
  id: 'crumble', name: 'Crumbling Edge', blurb: 'The outside is falling away.',
  soloOnly: false, severityCurve: 12,
  sfx: { bed: 'distant rubble tumbling into nothing', stinger: 'a slab letting go' },
  onLevelStart(world) { world.rails = false; },
  onTurnStart(world, turn) {
    shrinkRails(world, 0.05 * (1 + turn * 0.05));
    world.events.emit('degrade', { id: 'crumble', turn });
  },
  onStep(world) {
    for (const m of world.marbles) {
      if (!m.alive) continue;
      if (m.x < world.bounds.l || m.x > world.bounds.r || m.y < world.bounds.t || m.y > world.bounds.b) {
        m.lethalCause = 'fell';
      }
    }
  }
};

export const fault = {
  id: 'fault', name: 'Fault', blurb: 'The ground is cracking.',
  soloOnly: false, severityCurve: 9,
  sfx: { bed: 'tectonic groan', stinger: 'sharp crack, hard transient' },
  onTurnStart(world, turn) {
    // uncapped — see rot's comment: capped severity let fault plateau into an unwinnable
    // stalemate once the cracks stopped growing.
    const severity = turn / this.severityCurve;
    const count = 1 + Math.floor(severity * 1.5);
    for (let i = 0; i < count; i++) {
      const x1 = world.rng.range(world.bounds.l + 0.1, world.bounds.r - 0.1);
      const y1 = world.rng.range(world.bounds.t + 0.1, world.bounds.b - 0.1);
      const angle = world.rng.range(0, Math.PI * 2);
      const len = 0.15 + severity * 0.15;
      world.terrain.addFissure({
        x1, y1, x2: x1 + Math.cos(angle) * len, y2: y1 + Math.sin(angle) * len,
        width: 0.02 + severity * 0.02
      });
    }
    world.events.emit('degrade', { id: 'fault', turn });
  }
};

export const freeze = {
  id: 'freeze', name: 'Deep Freeze', blurb: 'It is icing over.',
  soloOnly: false, severityCurve: 10,
  sfx: { bed: 'crystalline ringing into howling wind', stinger: 'sharp freeze crack' },
  onLevelStart(world) { world.freezeVoid = null; },
  onTurnStart(world, turn) {
    const severity = Math.min(1, turn / this.severityCurve);
    world.terrain.addIcePatch({
      x: world.rng.range(world.bounds.l + 0.05, world.bounds.r - 0.05),
      y: world.rng.range(world.bounds.t + 0.05, world.bounds.b - 0.05),
      r: 0.08 + severity * 0.1
    });
    // ice patches are friction, not lethal (docs/DESIGN.md terrain vocabulary) — freeze had
    // nothing that could actually end a level on its own. The thinnest ice is at the centre,
    // and it finally gives way: a real, growing hole, same primitive sinkhole uses.
    // drill (data/powers.js) fills in and removes any hole at/below its own radius 0.045 —
    // that leaves world.freezeVoid pointing at a hole no longer in world.terrain.holes at
    // all, so blindly growing .r on it would silently grow a hole nobody can ever fall in
    // again. Recreate it whenever it's been drilled out instead.
    if (!world.freezeVoid || !world.terrain.holes.includes(world.freezeVoid)) {
      world.freezeVoid = world.terrain.addHole({ x: world.w / 2, y: world.h / 2, r: 0.015 });
    } else {
      world.freezeVoid.r += 0.014 * (1 + turn * 0.08);
    }
    world.events.emit('degrade', { id: 'freeze', turn });
  }
};

export const ashfall = {
  id: 'ashfall', name: 'Ashfall', blurb: 'Debris is coming down.',
  soloOnly: false, severityCurve: 8,
  sfx: { bed: 'soft thudding rain of stone', stinger: 'a heavy chunk landing' },
  onTurnStart(world, turn) {
    const severity = Math.min(1, turn / this.severityCurve);
    const count = 1 + Math.floor(severity * 2);
    for (let i = 0; i < count; i++) {
      world.terrain.addDome({
        x: world.rng.range(world.bounds.l + 0.08, world.bounds.r - 0.08),
        y: world.rng.range(world.bounds.t + 0.08, world.bounds.b - 0.08),
        r: 0.025 + world.rng.range(0, 0.02)
      });
    }
    // domes deflect, they don't kill (docs/DESIGN.md terrain vocabulary) — a soft rain of
    // debris that could never actually end a level. Eventually a chunk is heavy enough to
    // punch clean through: a real hole, growing in odds and size the longer it's been coming
    // down, not just deflecting bumps forever.
    if (turn > this.severityCurve && world.rng.next() < 0.15 + (turn - this.severityCurve) * 0.03) {
      world.terrain.addHole({
        x: world.rng.range(world.bounds.l + 0.08, world.bounds.r - 0.08),
        y: world.rng.range(world.bounds.t + 0.08, world.bounds.b - 0.08),
        r: 0.03 + (turn - this.severityCurve) * 0.004
      });
    }
    world.events.emit('degrade', { id: 'ashfall', turn });
  }
};

// Rust owns its own wall check instead of terrain-based hazards: gaps open at random points
// around the whole perimeter, not fixed to terrain the generic hazard system already knows
// about. world.rails = false disables the normal bounce; this onStep IS the wall now.
function inRustGap(gaps, edge, frac) {
  return gaps.some((g) => g.edge === edge && Math.abs(frac - g.center) < g.half);
}

// Shared by any environment that replaces the normal wall bounce with its own rail-gap check
// (rust, pinball): a genuine bounce still has to go through the same power/damage/impact
// pipeline physics.js's own bounceOffWalls does — it was quietly skipping all three, which
// meant wall-triggered powers (shockwave) never fired here, and damage never accrued off
// these walls either, removing damage's own "everyone eventually shatters" backstop for
// exactly the environments most likely to need it.
function bounceWithGaps(world, gaps) {
  const { l, r, t, b } = world.bounds;
  const wallE = world.surface.wallE;
  const power = world.power;
  for (const m of world.marbles) {
    if (!m.alive || m.lethalCause) continue;
    const effE = m.wallE ?? wallE;
    let force = 0;
    if (m.x - m.r < l) {
      if (inRustGap(gaps, 'l', (m.y - t) / (b - t))) m.lethalCause = 'fell';
      else { force = Math.abs(m.vx); m.x = l + m.r; m.vx = -m.vx * effE; }
    } else if (m.x + m.r > r) {
      if (inRustGap(gaps, 'r', (m.y - t) / (b - t))) m.lethalCause = 'fell';
      else { force = Math.abs(m.vx); m.x = r - m.r; m.vx = -m.vx * effE; }
    }
    if (m.y - m.r < t) {
      if (inRustGap(gaps, 't', (m.x - l) / (r - l))) m.lethalCause = 'fell';
      else { force = Math.max(force, Math.abs(m.vy)); m.y = t + m.r; m.vy = -m.vy * effE; }
    } else if (m.y + m.r > b) {
      if (inRustGap(gaps, 'b', (m.x - l) / (r - l))) m.lethalCause = 'fell';
      else { force = Math.max(force, Math.abs(m.vy)); m.y = b - m.r; m.vy = -m.vy * effE; }
    }
    if (force > 0) {
      world.events.emit('impact', { kind: 'rail', force, x: m.x, y: m.y });
      accrueDamage(m, world, force);
      power?.onWallHit?.(m, world, force);
    }
  }
}

export const rust = {
  id: 'rust', name: 'Rust', blurb: 'The rails are failing.',
  soloOnly: false, severityCurve: 9,
  sfx: { bed: 'metal fatigue creaking', stinger: 'a snap, then a section falling' },
  onLevelStart(world) {
    world.rails = false;
    world.rustGaps = [];
  },
  onTurnStart(world, turn) {
    // uncapped, like rot/fault — and existing gaps widen too, not just new ones spawning at
    // a fixed size. One narrow gap per turn on a four-sided perimeter took a very long time
    // for a marble to actually wander into; a rusting rail should keep failing where it's
    // already failed, not just add more equally-small weak points.
    const severity = turn / this.severityCurve;
    for (const g of world.rustGaps) g.half += 0.006 * (1 + turn * 0.05);
    // more than one failure point per turn once it's been going a while — a single narrow
    // gap on a four-sided perimeter, even widening, was still the slowest hazard in the
    // game by a wide margin (rot/fault/ashfall all already scale count with severity too).
    const count = 1 + Math.floor(severity);
    for (let i = 0; i < count; i++) {
      world.rustGaps.push({
        edge: world.rng.pick(['l', 'r', 't', 'b']),
        center: world.rng.range(0.15, 0.85),
        half: 0.04 + severity * 0.05
      });
    }
    world.events.emit('degrade', { id: 'rust', turn });
  },
  onStep(world) { bounceWithGaps(world, world.rustGaps); }
};

export const split = {
  id: 'split', name: 'The Split', blurb: 'It is coming apart.',
  soloOnly: false, severityCurve: 10,
  sfx: { bed: 'deep tearing', stinger: 'stone shearing' },
  onLevelStart(world) {
    const vertical = world.rng.next() < 0.5;
    const cx = world.w / 2, cy = world.h / 2;
    world.splitChasm = vertical
      ? world.terrain.addFissure({ x1: cx, y1: world.bounds.t, x2: cx, y2: world.bounds.b, width: 0.02 })
      : world.terrain.addFissure({ x1: world.bounds.l, y1: cy, x2: world.bounds.r, y2: cy, width: 0.02 });
  },
  onTurnStart(world, turn) {
    world.splitChasm.width += 0.015 * (1 + turn * 0.06);
    world.events.emit('degrade', { id: 'split', turn });
  }
};

export const magnet = {
  id: 'magnet', name: 'Magnet Core', blurb: 'The centre is pulling.',
  soloOnly: false, severityCurve: 11,
  sfx: { bed: 'electromagnetic hum climbing in pitch', stinger: 'coil surge' },
  onLevelStart(world) { world.magnetStrength = 0; world.magnetCore = null; },
  onTurnStart(world, turn) {
    world.magnetStrength = 0.15 * (1 + turn * 0.15);
    // pulling everyone to the centre was never itself lethal — nothing there to fall into.
    // the core it's pulling toward finally opens: a real, growing hole, exactly where the
    // pull has been aiming the whole time, so it's the least surprising hazard in the game.
    // same drill interaction as freeze's freezeVoid — recreate if it's been drilled out
    // rather than growing a reference to a hole that's no longer in the world.
    if (!world.magnetCore || !world.terrain.holes.includes(world.magnetCore)) {
      world.magnetCore = world.terrain.addHole({ x: world.w / 2, y: world.h / 2, r: 0.02 });
    } else {
      world.magnetCore.r += 0.012 * (1 + turn * 0.1);
    }
    world.events.emit('degrade', { id: 'magnet', turn });
  },
  onStep(world, dt) {
    const cx = world.w / 2, cy = world.h / 2;
    for (const m of world.marbles) {
      if (!m.alive || m.lethalCause) continue;
      const dx = cx - m.x, dy = cy - m.y;
      const d = Math.hypot(dx, dy);
      if (d < 1e-6) continue;
      m.vx += (dx / d) * world.magnetStrength * dt;
      m.vy += (dy / d) * world.magnetStrength * dt;
    }
  }
};

export const tilt = {
  id: 'tilt', name: 'Tilt', blurb: 'The board is leaning.',
  soloOnly: false, severityCurve: 10,
  sfx: { bed: 'timber straining under load', stinger: 'a lurch' },
  onLevelStart(world) {
    const angle = world.rng.pick([0, Math.PI / 2, Math.PI, Math.PI * 1.5]);
    world.tiltDir = { x: Math.cos(angle), y: Math.sin(angle) };
    world.tiltStrength = 0;
    const { l, r, t, b } = world.bounds;
    let seg;
    if (angle === 0) seg = { x1: r, y1: t, x2: r, y2: b };
    else if (Math.abs(angle - Math.PI / 2) < 0.01) seg = { x1: l, y1: b, x2: r, y2: b };
    else if (Math.abs(angle - Math.PI) < 0.01) seg = { x1: l, y1: t, x2: l, y2: b };
    else seg = { x1: l, y1: t, x2: r, y2: t };
    world.tiltGap = world.terrain.addFissure({ ...seg, width: 0.015 });
  },
  onTurnStart(world, turn) {
    world.tiltStrength = 0.12 * (1 + turn * 0.12);
    // was a flat +0.008/turn — linear, unlike every other growing hazard in the game, so it
    // could take an unreasonable number of turns to ever reach anyone. Accelerating, like
    // the tilt force pushing everyone into it already does.
    world.tiltGap.width += 0.008 * (1 + turn * 0.1);
    world.events.emit('degrade', { id: 'tilt', turn });
  },
  onStep(world, dt) {
    for (const m of world.marbles) {
      if (!m.alive || m.lethalCause) continue;
      m.vx += world.tiltDir.x * world.tiltStrength * dt;
      m.vy += world.tiltDir.y * world.tiltStrength * dt;
    }
  }
};

export const scorch = {
  id: 'scorch', name: 'Scorch', blurb: 'The floor remembers where you stopped.',
  soloOnly: false, severityCurve: 8,
  sfx: { bed: 'embers crackling', stinger: 'ignition whoosh' },
  // checkHazards (terrain.js) already runs every tick and catches a marble settling on an
  // existing ARMED mark — this just needs to leave a fresh one so a second visit next time
  // is caught too. Same primitive molten's power uses, just laid by the environment itself.
  onSettle(world) {
    for (const m of world.marbles) {
      if (!m.alive) continue;
      world.terrain.addScorch({ x: m.x, y: m.y, r: m.r * 2, armsOnTurn: world.turn + 1, source: 'scorch' });
    }
  },
  onTurnStart(world, turn) {
    world.events.emit('degrade', { id: 'scorch', turn });
  }
};

export const carousel = {
  id: 'carousel', name: 'Carousel', blurb: 'The whole floor is turning.',
  soloOnly: true, severityCurve: 10,
  sfx: { bed: 'rising rotational whoosh with a doppler edge', stinger: 'gear engaging' },
  // `soloOnly` means this never gets a power alongside it — spin alone was never lethal
  // (rails stayed on, so it just span marbles around inside an ordinary box forever). Being
  // soloOnly and having no kill of its own meant this specific environment could never
  // resolve, full stop, not even the ~70% of the time a paired power might otherwise save
  // one of these. Reuses sumo's exact shrinking-disc mechanism: you get flung outward by
  // the spin, and eventually there's no platform left under you.
  onLevelStart(world) {
    world.shape = 'disc';
    world.disc = { x: world.w / 2, y: world.h / 2, r: Math.min(world.w, world.h) * 0.46 };
    world.rails = false;
    world.carouselOmega = 0;
  },
  onTurnStart(world, turn) {
    world.carouselOmega = 0.3 * (1 + turn * 0.15);
    world.disc.r *= 0.94;
    world.events.emit('degrade', { id: 'carousel', turn });
  },
  onStep(world, dt) {
    const cx = world.w / 2, cy = world.h / 2;
    for (const m of world.marbles) {
      if (!m.alive || m.lethalCause) continue;
      const dx = m.x - cx, dy = m.y - cy;
      m.vx += -dy * world.carouselOmega * dt;
      m.vy += dx * world.carouselOmega * dt;
      if (Math.hypot(dx, dy) > world.disc.r - m.r * 0.35) m.lethalCause = 'fell';
    }
  }
};

export const pinball = {
  id: 'pinball', name: 'Pinball', blurb: 'Bumpers everywhere.',
  soloOnly: false, severityCurve: 8,
  sfx: { bed: 'idle arcade hum', stinger: 'spring and bell per bumper spawn' },
  // bumpers deflect, they don't kill — a table full of them was never actually dangerous on
  // its own. A real pinball table has kicker lanes that launch the ball clean off the table:
  // a strong outward ramp aimed at a matching gap in the rail behind it (rust's exact gap
  // convention, reused via inRustGap), so riding a hard kick far enough sends a marble
  // straight through and off the board instead of just bouncing back in.
  onLevelStart(world) { world.rails = false; world.pinballGaps = []; },
  onTurnStart(world, turn) {
    const severity = Math.min(1, turn / this.severityCurve);
    world.terrain.addBumper({
      x: world.rng.range(world.bounds.l + 0.08, world.bounds.r - 0.08),
      y: world.rng.range(world.bounds.t + 0.08, world.bounds.b - 0.08),
      r: 0.025, restitution: 1.2 + severity * 0.5
    });

    const edge = world.rng.pick(['l', 'r', 't', 'b']);
    const along = world.rng.range(0.2, 0.8);
    let x, y, dirX, dirY;
    if (edge === 'l') { x = world.bounds.l + 0.12; y = world.bounds.t + along * world.h; dirX = -1; dirY = 0; }
    else if (edge === 'r') { x = world.bounds.r - 0.12; y = world.bounds.t + along * world.h; dirX = 1; dirY = 0; }
    else if (edge === 't') { x = world.bounds.l + along * world.w; y = world.bounds.t + 0.12; dirX = 0; dirY = -1; }
    else { x = world.bounds.l + along * world.w; y = world.bounds.b - 0.12; dirX = 0; dirY = 1; }
    world.terrain.addRamp({ x, y, r: 0.09, dirX, dirY, strength: 0.9 + severity * 0.6 });
    world.pinballGaps.push({ edge, center: along, half: 0.035 + severity * 0.03 });

    world.events.emit('degrade', { id: 'pinball', turn });
  },
  // every kicker lane's gap is a place the rail gives way; everywhere else bounces normally
  // through the same shared pipeline rust uses (bounceWithGaps).
  onStep(world) { bounceWithGaps(world, world.pinballGaps); }
};

export const shatter = {
  id: 'shatter', name: 'Shatter', blurb: 'You are rolling on glass.',
  soloOnly: false, severityCurve: 9,
  sfx: { bed: 'faint tension ring', stinger: 'tinkling fracture, then a pane letting go' },
  onLevelStart(world) {
    world.shatterCracks = [];
    world.events.on('impact', ({ kind, force, x, y }) => {
      if ((kind !== 'marble' && kind !== 'rail') || force < 0.15) return;
      world.shatterCracks.push({ x, y });
      if (world.shatterCracks.length % 6 === 0) {
        const recent = world.shatterCracks.slice(-6);
        const cx = recent.reduce((s, c) => s + c.x, 0) / 6;
        const cy = recent.reduce((s, c) => s + c.y, 0) / 6;
        world.terrain.addHole({ x: cx, y: cy, r: 0.035 });
      }
    });
  },
  onTurnStart(world, turn) {
    world.events.emit('degrade', { id: 'shatter', turn });
  }
};

export const grinder = {
  id: 'grinder', name: 'The Grinder', blurb: 'Something is sweeping the board.',
  soloOnly: true, severityCurve: 9,
  sfx: { bed: 'industrial motor, panned to follow the roller', stinger: 'gear shift, speed up' },
  onLevelStart(world) {
    world.grinderAxis = world.rng.next() < 0.5 ? 'x' : 'y';
    world.grinderPos = 0;
    world.grinderDir = 1;
  },
  onTurnStart(world, turn) {
    // telegraphed all through the coming AIM phase — position is on world, renderers draw it
    world.grinderPos += world.grinderDir * 0.12 * (1 + turn * 0.06);
    if (world.grinderPos > 1) { world.grinderPos = 1; world.grinderDir = -1; }
    else if (world.grinderPos < 0) { world.grinderPos = 0; world.grinderDir = 1; }
    const linePos = world.grinderAxis === 'x'
      ? world.bounds.l + world.grinderPos * (world.bounds.r - world.bounds.l)
      : world.bounds.t + world.grinderPos * (world.bounds.b - world.bounds.t);
    for (const m of world.marbles) {
      if (!m.alive) continue;
      const p = world.grinderAxis === 'x' ? m.x : m.y;
      if (Math.abs(p - linePos) < m.r + 0.015) m.lethalCause = 'crushed';
    }
    world.events.emit('degrade', { id: 'grinder', turn });
  }
};

export const blackout = {
  id: 'blackout', name: 'Blackout', blurb: 'The lights are going.',
  soloOnly: true, severityCurve: 8,
  sfx: {
    bed: 'hum draining out into near-silence; rolling bed becomes the main information',
    stinger: 'a bank of lights cutting'
  },
  // soloOnly + vision denial with no hazard of its own meant blackout, like carousel, could
  // never resolve — dimming the view isn't itself lethal. The dark is exactly where the
  // floor gives way first: real, growing holes creeping in from the edges (rot's pattern),
  // hidden by the same lights that are already going out.
  onLevelStart(world) { world.blackoutRadius = 0.5; },
  onTurnStart(world, turn) {
    // never below a floor that still comfortably shows the player's own marble
    world.blackoutRadius = Math.max(0.12, 0.5 - turn * 0.05);
    const severity = turn / this.severityCurve;
    const edge = world.rng.pick(['l', 'r', 't', 'b']);
    const inward = 0.03 + severity * 0.1;
    const along = world.rng.range(0.05, 0.95);
    let x, y;
    if (edge === 'l') { x = world.bounds.l + inward; y = world.bounds.t + along * world.h; }
    else if (edge === 'r') { x = world.bounds.r - inward; y = world.bounds.t + along * world.h; }
    else if (edge === 't') { x = world.bounds.l + along * world.w; y = world.bounds.t + inward; }
    else { x = world.bounds.l + along * world.w; y = world.bounds.b - inward; }
    world.terrain.addHole({ x, y, r: 0.025 + severity * 0.035 });
    world.events.emit('degrade', { id: 'blackout', turn });
  }
};

export const quicksand = {
  id: 'quicksand', name: 'Quicksand', blurb: 'Patches that swallow.',
  soloOnly: false, severityCurve: 9,
  sfx: { bed: 'sucking gurgle', stinger: 'a wet swallow' },
  onLevelStart(world) { world.quicksandPatches = []; },
  onTurnStart(world, turn) {
    const severity = Math.min(1, turn / this.severityCurve);
    world.quicksandPatches.push({
      x: world.rng.range(world.bounds.l + 0.08, world.bounds.r - 0.08),
      y: world.rng.range(world.bounds.t + 0.08, world.bounds.b - 0.08),
      r: 0.05 + severity * 0.03
    });
    world.events.emit('degrade', { id: 'quicksand', turn });
  },
  onStep(world) {
    const SINK_SPEED = 0.12;
    for (const m of world.marbles) {
      if (!m.alive || m.lethalCause) continue;
      for (const p of world.quicksandPatches) {
        if (Math.hypot(m.x - p.x, m.y - p.y) > p.r) continue;
        if (Math.hypot(m.vx, m.vy) < SINK_SPEED) { m.lethalCause = 'drowned'; break; }
      }
    }
  }
};

export const meteor = {
  id: 'meteor', name: 'Meteor', blurb: 'Something is coming down.',
  soloOnly: false, severityCurve: 10,
  sfx: { bed: 'ominous air pressure', stinger: 'whistle in, colossal boom, debris' },
  onLevelStart(world) { world.meteorNext = null; },
  onTurnStart(world, turn) {
    if (world.meteorNext) {
      world.terrain.addCrater({ x: world.meteorNext.x, y: world.meteorNext.y, r: 0.05 });
      world.terrain.addHole({ x: world.meteorNext.x, y: world.meteorNext.y, r: 0.04 });
    }
    // telegraphed one full turn ahead, visible through the coming AIM — a decision, not a
    // punishment
    world.meteorNext = {
      x: world.rng.range(world.bounds.l + 0.1, world.bounds.r - 0.1),
      y: world.rng.range(world.bounds.t + 0.1, world.bounds.b - 0.1)
    };
    world.events.emit('degrade', { id: 'meteor', turn });
  }
};

export const conveyor = {
  id: 'conveyor', name: 'Conveyor', blurb: 'The floor is moving.',
  soloOnly: false, severityCurve: 9,
  sfx: { bed: 'rubber drone, pitch per belt speed', stinger: 'motor kicking in' },
  onLevelStart(world) { world.conveyorPit = null; },
  onTurnStart(world, turn) {
    const severity = Math.min(1, turn / this.severityCurve);
    const horizontal = world.rng.next() < 0.5;
    const dir = world.rng.next() < 0.5 ? 1 : -1;
    const speed = 0.25 + severity * 0.15;
    world.terrain.addConveyor({
      x: world.rng.range(world.bounds.l + 0.1, world.bounds.r - 0.1),
      y: world.rng.range(world.bounds.t + 0.1, world.bounds.b - 0.1),
      w: horizontal ? 0.25 : 0.08, h: horizontal ? 0.08 : 0.25,
      vx: horizontal ? dir * speed : 0, vy: horizontal ? 0 : dir * speed
    });
    // belts push, they don't kill — every belt on this floor already feeds toward the
    // middle by construction, so that's where the actual hazard goes: a growing pit at the
    // centre the whole conveyor system has been funnelling toward.
    // same drill interaction as freeze's freezeVoid — recreate if it's been drilled out
    // rather than growing a reference to a hole that's no longer in the world.
    if (!world.conveyorPit || !world.terrain.holes.includes(world.conveyorPit)) {
      world.conveyorPit = world.terrain.addHole({ x: world.w / 2, y: world.h / 2, r: 0.02 });
    } else {
      world.conveyorPit.r += 0.011 * (1 + turn * 0.09);
    }
    world.events.emit('degrade', { id: 'conveyor', turn });
  }
};

export const windstorm = {
  id: 'windstorm', name: 'Windstorm', blurb: 'The wind is picking up.',
  soloOnly: false, severityCurve: 10,
  sfx: { bed: 'building gale, filtered noise tracking strength', stinger: 'a gust' },
  onLevelStart(world) {
    world.windAngle = world.rng.range(0, Math.PI * 2);
    world.windStrength = 0;
    // a push, however strong, is never lethal by itself. A gale strong enough to matter
    // eventually drives a storm surge in from one edge — water, growing with the wind that's
    // causing it, rather than a bolted-on hazard with no relation to the theme.
    world.windSurgeEdge = world.rng.pick(['l', 'r', 't', 'b']);
    world.terrain.setWaterLine({ edge: world.windSurgeEdge, level: 0 });
  },
  onTurnStart(world, turn) {
    world.windStrength = 0.1 * (1 + turn * 0.12);
    if (world.rng.next() < 0.3) world.windAngle += world.rng.range(-1, 1);
    world.terrain.setWaterLine({ edge: world.windSurgeEdge, level: Math.min(0.97, 0.03 * turn * (1 + turn * 0.02)) });
    world.events.emit('degrade', { id: 'windstorm', turn });
  },
  onStep(world, dt) {
    const fx = Math.cos(world.windAngle) * world.windStrength;
    const fy = Math.sin(world.windAngle) * world.windStrength;
    for (const m of world.marbles) {
      if (!m.alive || m.lethalCause) continue;
      m.vx += fx * dt;
      m.vy += fy * dt;
    }
  }
};

export const vice = {
  id: 'vice', name: 'The Vice', blurb: 'Two walls are closing.',
  soloOnly: false, severityCurve: 10,
  sfx: { bed: 'hydraulic press, pressure building', stinger: 'ram advancing one notch' },
  onLevelStart(world) { world.viceVertical = world.rng.next() < 0.5; world.viceHole = null; },
  onTurnStart(world, turn) {
    // same change as closing: the ram herds you, it doesn't kill on contact. What's actually
    // lethal is the floor finally buckling through in the middle under all that pressure.
    const bite = 0.04 * (1 + turn * 0.07) * world.w;
    if (world.viceVertical) {
      if (world.bounds.r - world.bounds.l > CLOSING_MIN_BOX) { world.bounds.l += bite; world.bounds.r -= bite; }
    } else {
      if (world.bounds.b - world.bounds.t > CLOSING_MIN_BOX) { world.bounds.t += bite; world.bounds.b -= bite; }
    }
    if (!world.viceHole) {
      world.viceHole = world.terrain.addHole({ x: world.w / 2, y: world.h / 2, r: 0.025 });
    } else if (world.terrain.holes.includes(world.viceHole)) {
      world.viceHole.r += 0.013 * (1 + turn * 0.08);
    } else {
      world.viceHole = world.terrain.addHole({ x: world.w / 2, y: world.h / 2, r: 0.025 }); // drilled out — recreate
    }
    world.events.emit('degrade', { id: 'vice', turn });
  }
};

export const rest = [];
