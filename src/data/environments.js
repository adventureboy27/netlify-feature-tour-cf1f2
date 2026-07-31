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

import { addHole, addLava, growLava, shrinkRails, addBumper, addIcePatch,
         addCrater, setWaterLine, addFissure, addConveyor } from '../sim/terrain.js';

/* ------------------------------------------------------------------ */
/* THREE FULLY IMPLEMENTED EXEMPLARS — follow these patterns           */
/* ------------------------------------------------------------------ */

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
  onTurnStart(world, turn) {
    // 4% of the original board per side per turn, accelerating slightly
    const bite = 0.04 * (1 + turn * 0.06);
    shrinkRails(world, bite);
    // anything now outside the rails is crushed, not teleported
    for (const m of world.marbles) {
      if (!m.alive) continue;
      if (m.x < world.bounds.l || m.x > world.bounds.r ||
          m.y < world.bounds.t || m.y > world.bounds.b) {
        m.lethalCause = 'crushed';
      }
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
      if (m.colour === world.condemned) m.lethalCause = 'shattered';
    }
  },
  onTurnStart(world, turn) {
    // it gets worse: after turn 3 a second colour is condemned
    if (turn === 3) world.condemned2 = world.rng.pick(
      world.palette.filter(c => c !== world.condemned));
    world.events.emit('degrade', { id: 'roulette', turn });
  }
};

/* ------------------------------------------------------------------ */
/* THE REST — metadata complete, hooks to implement                    */
/* Implement in the order given in docs/BUILD-ORDER.md M6.             */
/* ------------------------------------------------------------------ */

export const rest = [
  { id:'rot', name:'Rot', blurb:'The floor is going soft.', soloOnly:false, severityCurve:10,
    spec:'Holes open every turn, more and wider each time, creeping inward from the edges.',
    sfx:{ bed:'wet splintering, damp low rumble', stinger:'timber giving way' } },

  { id:'crumble', name:'Crumbling Edge', blurb:'The outside is falling away.', soloOnly:false, severityCurve:12,
    spec:'No rails. The outer ring of the board falls away turn by turn. A shrinking island ' +
         'with sheer drops — rectangular cousin of sumo.',
    sfx:{ bed:'distant rubble tumbling into nothing', stinger:'a slab letting go' } },

  { id:'flow', name:'The Flow', blurb:'The lava is spreading.', soloOnly:false, severityCurve:9,
    spec:'One pool grows and sends rivers across the floor, cutting the board into regions ' +
         'that get harder to travel between.',
    sfx:{ bed:'thick bubbling, felt more than heard', stinger:'hiss and surge' } },

  { id:'tide', name:'Rising Tide', blurb:'The water is coming in.', soloOnly:false, severityCurve:10,
    spec:'Water advances from one side as a line. Submerged floor is lethal. Everyone is ' +
         'pushed into a narrowing dry strip.',
    sfx:{ bed:'lapping that gets closer and louder', stinger:'wave surge' } },

  { id:'fault', name:'Fault', blurb:'The ground is cracking.', soloOnly:false, severityCurve:9,
    spec:'Straight jagged chasms open along fault lines rather than round pits. The board ' +
         'becomes a maze of narrow bridges.',
    sfx:{ bed:'tectonic groan', stinger:'sharp crack, hard transient' } },

  { id:'sinkhole', name:'Sinkhole', blurb:'Something opened in the middle.', soloOnly:false, severityCurve:11,
    spec:'A void at dead centre widens relentlessly. Everyone gets squeezed to the ring.',
    sfx:{ bed:'sub-bass drone that deepens each turn', stinger:'collapse' } },

  { id:'freeze', name:'Deep Freeze', blurb:'It is icing over.', soloOnly:false, severityCurve:10,
    spec:'Floor converts to ice patch by patch until the whole board is frictionless and ' +
         'nobody can stop where they want.',
    sfx:{ bed:'crystalline ringing into howling wind', stinger:'sharp freeze crack' } },

  { id:'ashfall', name:'Ashfall', blurb:'Debris is coming down.', soloOnly:false, severityCurve:8,
    spec:'Rubble drops each turn, adding new bumps, pillars and blockers. Not lethal itself ' +
         'but it wrecks every line you had planned.',
    sfx:{ bed:'soft thudding rain of stone', stinger:'a heavy chunk landing' } },

  { id:'rust', name:'Rust', blurb:'The rails are failing.', soloOnly:false, severityCurve:9,
    spec:'Gaps open in the rails and widen. The edges stop being safe to bank off.',
    sfx:{ bed:'metal fatigue creaking', stinger:'a snap, then a section falling' } },

  { id:'split', name:'The Split', blurb:'It is coming apart.', soloOnly:false, severityCurve:10,
    spec:'A chasm opens down the middle and the two halves pull apart, widening every turn.',
    sfx:{ bed:'deep tearing', stinger:'stone shearing' } },

  { id:'magnet', name:'Magnet Core', blurb:'The centre is pulling.', soloOnly:false, severityCurve:11,
    spec:'Continuous force toward the centre, stronger each turn. Vicious paired with ' +
         'sinkhole. Implement in onStep as an acceleration, not a teleport.',
    sfx:{ bed:'electromagnetic hum climbing in pitch', stinger:'coil surge' } },

  { id:'tilt', name:'Tilt', blurb:'The board is leaning.', soloOnly:false, severityCurve:10,
    spec:'Constant acceleration in one direction, increasing each turn, with a rail gap on ' +
         'the low side.',
    sfx:{ bed:'timber straining under load', stinger:'a lurch' } },

  { id:'scorch', name:'Scorch', blurb:'The floor remembers where you stopped.', soloOnly:false, severityCurve:8,
    spec:'Resting in the same region twice burns you. Forces constant movement. Mark regions ' +
         'visibly after each settle.',
    sfx:{ bed:'embers crackling', stinger:'ignition whoosh' } },

  { id:'carousel', name:'Carousel', blurb:'The whole floor is turning.', soloOnly:true, severityCurve:10,
    spec:'The board rotates, faster every turn, flinging marbles outward. Enough chaos alone.',
    sfx:{ bed:'rising rotational whoosh with a doppler edge', stinger:'gear engaging' } },

  { id:'pinball', name:'Pinball', blurb:'Bumpers everywhere.', soloOnly:false, severityCurve:8,
    spec:'Sprung bumpers spawn each turn and get springier. Restitution above 1 on contact.',
    sfx:{ bed:'idle arcade hum', stinger:'spring and bell per bumper spawn' } },

  { id:'shatter', name:'Shatter', blurb:'You are rolling on glass.', soloOnly:false, severityCurve:9,
    spec:'Glass floor. Impacts crack it; cracks accumulate and panes eventually fall out, ' +
         'becoming holes. The player creates their own hazards by playing.',
    sfx:{ bed:'faint tension ring', stinger:'tinkling fracture, then a pane letting go' } },

  { id:'grinder', name:'The Grinder', blurb:'Something is sweeping the board.', soloOnly:true, severityCurve:9,
    spec:'A roller sweeps a line across the board between turns, faster each turn. Anything ' +
         'in its path is out. Telegraph its next path during AIM.',
    sfx:{ bed:'industrial motor, panned to follow the roller', stinger:'gear shift, speed up' } },

  { id:'blackout', name:'Blackout', blurb:'The lights are going.', soloOnly:true, severityCurve:8,
    spec:'Visibility shrinks turn by turn to a pool around your own marble. Hazards stay ' +
         'where they were — you just cannot see them. Never hide the player marble.',
    sfx:{ bed:'hum draining out into near-silence; rolling bed becomes the main information', stinger:'a bank of lights cutting' } },

  { id:'quicksand', name:'Quicksand', blurb:'Patches that swallow.', soloOnly:false, severityCurve:9,
    spec:'Spreading patches. Anything that comes to rest on one, or crosses too slowly, sinks.',
    sfx:{ bed:'sucking gurgle', stinger:'a wet swallow' } },

  { id:'meteor', name:'Meteor', blurb:'Something is coming down.', soloOnly:false, severityCurve:10,
    spec:'Impacts punch new craters. Telegraph each strike one full turn ahead with a marker ' +
         'so it is a decision, not a punishment.',
    sfx:{ bed:'ominous air pressure', stinger:'whistle in, colossal boom, debris' } },

  { id:'conveyor', name:'Conveyor', blurb:'The floor is moving.', soloOnly:false, severityCurve:9,
    spec:'Belt strips push marbles along. More belts each turn, in conflicting directions.',
    sfx:{ bed:'rubber drone, pitch per belt speed', stinger:'motor kicking in' } },

  { id:'windstorm', name:'Windstorm', blurb:'The wind is picking up.', soloOnly:false, severityCurve:10,
    spec:'Directional force curving every roll, strengthening each turn, occasionally ' +
         'changing direction. Show it with drifting particles.',
    sfx:{ bed:'building gale, filtered noise tracking strength', stinger:'a gust' } },

  { id:'vice', name:'The Vice', blurb:'Two walls are closing.', soloOnly:false, severityCurve:10,
    spec:'Two opposite rails close in; the other two never move. Creates a long corridor ' +
         'rather than a shrinking box — plays very differently from closing.',
    sfx:{ bed:'hydraulic press, pressure building', stinger:'ram advancing one notch' } }
];
