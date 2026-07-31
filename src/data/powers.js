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
 *   onMarbleHit(m, other, world, force)
 *   onSettle(m, world)
 *   onDeath(m, world) -> true to veto the death
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
/* THE REST — metadata complete, hooks to implement                    */
/* Implement in the order given in docs/BUILD-ORDER.md M7.             */
/* ------------------------------------------------------------------ */

export const rest = [
  { id:'lead', name:'Lead', blurb:'Short roll. Devastating shoulder.', exclusive:false,
    stats:{ launchMul:0.6, decelMul:1.8, mass:4 },
    spec:'Barely travels, but anything it touches goes flying.',
    sfx:{ voice:'massive dull rumble', hit:'enormous low impact, room shake' } },

  { id:'cork', name:'Cork', blurb:'Nearly perfect bounce.', exclusive:false,
    stats:{ wallE:0.98, ballE:0.99, decelMul:0.9 },
    spec:'Ricochets off rails for days. Trajectories become unreadable after two bounces.',
    sfx:{ voice:'light hollow tone', hit:'rubbery boing, pitch per force' } },

  { id:'ghost', name:'Ghost', blurb:'Marbles pass through each other.', exclusive:false,
    stats:{}, spec:'Disable marble-marble collision entirely. Pure terrain game — nobody can ' +
    'interfere with anybody. Pairs beautifully with rot and fault.',
    sfx:{ voice:'airy hollow whoosh on each pass-through' } },

  { id:'hollow', name:'Hollow', blurb:'One hard hit shatters you.', exclusive:false,
    stats:{ mass:0.4 },
    spec:'Collisions above a force threshold are lethal in both directions. Everyone is ' +
         'suddenly terrified of everyone.',
    sfx:{ voice:'thin brittle ring', death:'full glass shatter' } },

  { id:'magnetic', name:'Magnetic', blurb:'Marbles pull toward each other.', exclusive:false,
    stats:{}, spec:'Continuous inverse-square attraction between marbles in onStep. They clump.',
    sfx:{ voice:'deep hum that intensifies with proximity' } },

  { id:'repulsor', name:'Repulsor', blurb:'Marbles shove each other away.', exclusive:false,
    stats:{}, spec:'Inverse of magnetic. Nobody can get near anybody. Brutal on a shrinking board.',
    sfx:{ voice:'bass thump on each repulsion event' } },

  { id:'sticky', name:'Sticky', blurb:'First thing you touch, you are stuck to.', exclusive:false,
    stats:{}, spec:'Marbles weld into chains and move as one body. Chains inherit combined mass.',
    sfx:{ voice:'tar squelch on contact, low drag drone while joined' } },

  { id:'english', name:'English', blurb:'Everything curves.', exclusive:false,
    stats:{}, spec:'Constant lateral acceleration perpendicular to velocity. Sign per marble, ' +
    'fixed for the level. Aim line must show the arc, not a straight line.',
    sfx:{ voice:'tonal whistle bending with the curve' } },

  { id:'splitshot', name:'Splitshot', blurb:'You become two.', exclusive:true,
    stats:{ radius:0.75 },
    spec:'On first wall contact the marble splits into two half-size marbles, both yours. ' +
         'Exclusive — changes the marble count, so it cannot stack with other powers.',
    sfx:{ voice:'sharp fission crack, then two voices' } },

  { id:'greased', name:'Greased', blurb:'Nothing transfers.', exclusive:false,
    stats:{ ballE:0.15 },
    spec:'Collisions barely move anyone. You slide off each other. Removes the whole ' +
         'knock-them-out strategy for a level.',
    sfx:{ voice:'slick frictionless squeal on contact' } },

  { id:'feather', name:'Feather', blurb:'Everyone is weightless.', exclusive:false,
    stats:{ mass:0.25, decelMul:0.7 },
    spec:'Light and thrown around by everything. Bumpers and conveyors become dominant.',
    sfx:{ voice:'hollow high ping' } },

  { id:'nitro', name:'Nitro', blurb:'A second kick mid-roll.', exclusive:false,
    stats:{}, spec:'At roughly 45% of the roll, a burst re-accelerates the marble to ~70% of ' +
    'launch speed. Wrecks everyone\'s distance judgement, including yours.',
    sfx:{ voice:'turbo spool then blowoff valve' } },

  { id:'rewind', name:'Rewind', blurb:'One death per level does not count.', exclusive:true,
    stats:{}, spec:'onDeath returns true once per level and snaps the marble back to its ' +
    'position at the start of the turn. Exclusive — too strong stacked.',
    sfx:{ voice:'tape rewind, reversed reverb' } },

  { id:'bomb', name:'Bomb', blurb:'You detonate where you stop.', exclusive:false,
    stats:{}, spec:'On settle, a shockwave shoves every marble within radius. Can push others ' +
    'into hazards — which means it can win the level for you or lose it.',
    sfx:{ voice:'fuse hiss while rolling', settle:'blast + pressure wave' } },

  { id:'anchor', name:'Anchor', blurb:'Plant once. Nothing moves you.', exclusive:false,
    stats:{}, spec:'One use per level: infinite mass for a turn. Immovable object on a ' +
    'shrinking board.',
    sfx:{ voice:'heavy clamp, then a dead solid thud on every impact' } },

  { id:'blink', name:'Blink', blurb:'You jump before you roll.', exclusive:false,
    stats:{}, spec:'On launch, teleport a short hop in the aim direction, then roll normally. ' +
    'Lets you cross a hazard you could not roll over.',
    sfx:{ voice:'electric snap, brief silence, then the roll' } },

  { id:'drill', name:'Drill', blurb:'You go through terrain.', exclusive:false,
    stats:{}, spec:'Pass through pillars and bumpers, and fill small holes you cross — ' +
    'repairing the board as you go. The only constructive power.',
    sfx:{ voice:'whirring bore, pitch per speed' } },

  { id:'frost', name:'Frost', blurb:'You leave ice behind you.', exclusive:false,
    stats:{}, spec:'Your path becomes an ice trail with local friction override. Reshapes the ' +
    'board for everyone, permanently.',
    sfx:{ voice:'freezing crackle laid down behind the marble' } },

  { id:'siphon', name:'Siphon', blurb:'You steal speed.', exclusive:false,
    stats:{}, spec:'On contact, take a share of the other marble\'s velocity instead of ' +
    'exchanging it. They stop, you keep going.',
    sfx:{ voice:'draining downward sweep on contact' } },

  { id:'boomerang', name:'Boomerang', blurb:'You come back.', exclusive:false,
    stats:{}, spec:'Constant acceleration toward the launch point. The roll curves home. ' +
    'Aim line must show the loop.',
    sfx:{ voice:'rotating hum, doppler as it turns' } },

  { id:'shield', name:'Shield', blurb:'Survive one lethal hit.', exclusive:false,
    stats:{}, spec:'onDeath returns true once per level. Show the shield visually so the ' +
    'player knows whether they still have it.',
    sfx:{ voice:'bell chime absorbing the hit, glass ring decaying' } },

  { id:'comet', name:'Comet', blurb:'You burn a trail.', exclusive:false,
    stats:{ launchMul:1.4 },
    spec:'A burning trail behind you becomes lethal terrain that fades over two turns. ' +
    'Molten\'s aggressive sibling.',
    sfx:{ voice:'roaring flame, gain tracks speed' } },

  { id:'shockwave', name:'Shockwave', blurb:'Your first wall hit moves everyone.', exclusive:false,
    stats:{}, spec:'First rail contact per turn emits an expanding ring that shoves every ' +
    'marble it passes. Turns a bank shot into a board-wide event.',
    sfx:{ voice:'deep sonic boom, sub-bass ring expanding' } }
];
