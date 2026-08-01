/**
 * Floor mesh, rails, and terrain decals. Board-width units map 1:1 to three.js world units;
 * the board is centred on the origin so the camera in scene.js can stay fixed while the
 * board's own height (world.h) changes with the window's aspect ratio.
 *
 * No real PBR texture set is reachable from this environment (Poly Haven / ambientCG are
 * network-blocked here) — the oak floor is a procedurally painted CanvasTexture instead.
 * Swapping in a real albedo/normal/roughness set later is just replacing loadOakTextures().
 */
import * as THREE from 'three';

const RAIL_HEIGHT = 0.03;
const RAIL_THICKNESS = 0.02;
const BLACKOUT_TEX_HOLE_FRAC = 0.12; // the hole's radius as a fraction of the 6x6 plane

export function boardToScene(x, y, w, h) {
  return [x - w / 2, y - h / 2];
}

// THREE.Group.clear() only detaches children from the scene graph — it never frees their
// GPU-side geometry/material buffers. Anything rebuilt repeatedly (most terrain, every turn)
// has to dispose explicitly or it leaks for the rest of the session.
function disposeGeometry(group) {
  for (const child of group.children) child.geometry?.dispose();
}

// dispose() on a material frees the material itself but NOT any textures assigned to it
// (map, emissiveMap, ...) — those are separate GPU resources with their own dispose(). Now
// that lava/ice/water carry painted CanvasTextures and get rebuilt every turn like the rest
// of terrain, skipping this would just be the M10 geometry leak again, for textures instead.
const TEXTURE_PROPS = ['map', 'roughnessMap', 'normalMap', 'emissiveMap', 'metalnessMap'];
function disposeMaterial(material) {
  for (const prop of TEXTURE_PROPS) material[prop]?.dispose();
  material.dispose();
}

function disposeGeometryAndMaterial(group) {
  for (const child of group.children) {
    child.geometry?.dispose();
    if (Array.isArray(child.material)) child.material.forEach(disposeMaterial);
    else if (child.material) disposeMaterial(child.material);
  }
}

export function createBoard() {
  const group = new THREE.Group();

  const { map, roughnessMap, normalMap } = paintOakTextures();
  const floorMat = new THREE.MeshStandardMaterial({
    map, roughnessMap, normalMap, normalScale: new THREE.Vector2(0.6, 0.6), metalness: 0.05
  });
  const floorGeo = new THREE.PlaneGeometry(1, 1);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  const railMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.6, metalness: 0.1 });
  const rails = new THREE.Group();
  group.add(rails);

  const terrain = new THREE.Group();
  group.add(terrain);

  let boardW = 1, boardH = 1;

  function layout(world) {
    boardW = world.w;
    boardH = world.h;
    floor.scale.set(boardW, boardH, 1);
    floor.position.set(0, 0, 0);
    rebuildRails(world);
  }

  // Rails follow world.bounds, not the fixed board extent — closing shrinks bounds every
  // turn without changing world.w/h, so the rails need re-laying whenever bounds move too,
  // not just on resize. sumo (and anything else with rails:false) hides them entirely.
  function rebuildRails(world) {
    // rails share railMat (created once above), so only geometry is per-rail and disposable
    // here — disposing the material would break every rail built after this one.
    disposeGeometry(rails);
    rails.clear();
    if (world.rails === false) return;
    const [l, t] = boardToScene(world.bounds.l, world.bounds.t, boardW, boardH);
    const [r, b] = boardToScene(world.bounds.r, world.bounds.b, boardW, boardH);
    const cx = (l + r) / 2, cz = (t + b) / 2;
    addRail(rails, railMat, cx, t, r - l, RAIL_THICKNESS); // top
    addRail(rails, railMat, cx, b, r - l, RAIL_THICKNESS); // bottom
    addRail(rails, railMat, l, cz, RAIL_THICKNESS, b - t); // left
    addRail(rails, railMat, r, cz, RAIL_THICKNESS, b - t); // right
  }

  // static per level, rebuilt on every 'degrade' — not per frame. Also re-lays rails, since
  // an environment's onTurnStart (shrinkRails, disc shrink) runs right before 'degrade' fires.
  function buildTerrain(world) {
    rebuildRails(world);
    // unlike rails, every terrain mesh gets its own fresh material each rebuild — most
    // environments call this every single turn, so an undisposed geometry+material pair
    // here is a real, compounding GPU memory leak over a play session, not just untidy.
    disposeGeometryAndMaterial(terrain);
    terrain.clear();
    const t = world.terrain;
    const toScene = (x, y) => boardToScene(x, y, boardW, boardH);

    if (world.disc) addDiscRing(terrain, toScene(world.disc.x, world.disc.y), world.disc.r);

    for (const p of t.colourPatches) addDisc(terrain, toScene(p.x, p.y), p.r, colourHex(p.colour), 0.65);
    t.icePatches.forEach((p, i) => addIceDisc(terrain, toScene(p.x, p.y), p.r, i));
    for (const g of t.gutters) addDisc(terrain, toScene(g.x, g.y), g.r, 0x000000, 0.25, 0.001);
    for (const c of t.craters) addDisc(terrain, toScene(c.x, c.y), c.r, 0x000000, 0.35, 0.0015);
    t.lavas.forEach((l, i) => addLavaDisc(terrain, toScene(l.x, l.y), l.r, i));
    for (const h of t.holes) addDisc(terrain, toScene(h.x, h.y), h.r, 0x0a0705, 1, 0.004);

    for (const r of t.ramps) {
      const [sx, sz] = toScene(r.x, r.y);
      addDisc(terrain, [sx, sz], r.r, 0xffffff, 0.08, 0.0005);
    }

    for (const d of t.domes) {
      const [sx, sz] = toScene(d.x, d.y);
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(d.r, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.8 })
      );
      dome.position.set(sx, 0, sz);
      dome.castShadow = true;
      dome.receiveShadow = true;
      terrain.add(dome);
    }

    for (const b of t.bumpers) {
      const [sx, sz] = toScene(b.x, b.y);
      const bumper = new THREE.Mesh(
        new THREE.CylinderGeometry(b.r, b.r, 0.03, 20),
        new THREE.MeshStandardMaterial({ color: 0xc94f4f, roughness: 0.3, metalness: 0.2 })
      );
      bumper.position.set(sx, 0.015, sz);
      bumper.castShadow = true;
      bumper.receiveShadow = true;
      terrain.add(bumper);
    }

    for (const f of t.fissures) {
      const [x1, z1] = toScene(f.x1, f.y1);
      const [x2, z2] = toScene(f.x2, f.y2);
      const len = Math.hypot(x2 - x1, z2 - z1);
      const strip = new THREE.Mesh(
        new THREE.PlaneGeometry(f.width, len),
        new THREE.MeshStandardMaterial({ color: 0x0a0705, roughness: 1 })
      );
      strip.rotation.x = -Math.PI / 2;
      strip.rotation.z = -Math.atan2(z2 - z1, x2 - x1) + Math.PI / 2;
      strip.position.set((x1 + x2) / 2, 0.0005, (z1 + z2) / 2);
      terrain.add(strip);
    }

    for (const c of t.conveyors) {
      const [sx, sz] = toScene(c.x, c.y);
      const belt = new THREE.Mesh(
        new THREE.PlaneGeometry(c.w, c.h),
        new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.7 })
      );
      belt.rotation.x = -Math.PI / 2;
      belt.position.set(sx, 0.0005, sz);
      terrain.add(belt);
    }

    if (t.water) addWater(terrain, t.water, boardW, boardH);

    // the handful of environments whose state doesn't live in world.terrain
    if (world.quicksandPatches) {
      for (const p of world.quicksandPatches) addDisc(terrain, toScene(p.x, p.y), p.r, 0x5a5228, 0.5, 0.0012);
    }
    if (world.meteorNext) {
      addDiscRing(terrain, toScene(world.meteorNext.x, world.meteorNext.y), 0.05, 0xff783c, 0.008);
    }
    if (world.grinderAxis) {
      const gx = world.grinderAxis === 'x'
        ? world.bounds.l + world.grinderPos * (world.bounds.r - world.bounds.l) : world.w / 2;
      const gy = world.grinderAxis === 'y'
        ? world.bounds.t + world.grinderPos * (world.bounds.b - world.bounds.t) : world.h / 2;
      const [sx, sz] = toScene(gx, gy);
      const line = new THREE.Mesh(
        new THREE.PlaneGeometry(world.grinderAxis === 'x' ? 0.015 : boardW, world.grinderAxis === 'x' ? boardH : 0.015),
        new THREE.MeshStandardMaterial({ color: 0xc83c3c, emissive: 0x881010, emissiveIntensity: 0.5 })
      );
      line.rotation.x = -Math.PI / 2;
      line.position.set(sx, 0.003, sz);
      terrain.add(line);
    }
  }

  // "Visibility shrinks to a pool around your own marble." A big dark plane with a radial
  // alpha hole cut into its texture, repositioned each frame to follow the player — cheaper
  // than per-frame shader work, and the hole naturally keeps the player's own marble lit.
  const blackout = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 6),
    new THREE.MeshBasicMaterial({ map: makeBlackoutTexture(), transparent: true, depthWrite: true, depthTest: true })
  );
  blackout.rotation.x = -Math.PI / 2;
  blackout.position.y = 0.2; // clear of marble + ring geometry (~0.11 tall at most), not just the floor
  blackout.renderOrder = 10; // after opaque terrain/marbles, so it reliably composites on top
  blackout.visible = false;
  group.add(blackout);

  function updateBlackout(world, playerScenePos) {
    if (world.blackoutRadius == null || !playerScenePos) { blackout.visible = false; return; }
    blackout.visible = true;
    blackout.position.set(playerScenePos[0], 0.2, playerScenePos[1]);
    // the texture's hole radius is fixed (see makeBlackoutTexture) — scale the plane so
    // that fixed hole maps to the current, shrinking blackoutRadius in world units
    const scale = world.blackoutRadius / BLACKOUT_TEX_HOLE_FRAC;
    blackout.scale.set(scale, scale, 1);
  }

  function updateAnimations(world) { updateAnimatedMaterials(terrain, world); }

  return { group, layout, buildTerrain, updateBlackout, updateAnimations };
}

function addRail(rails, mat, cx, cz, w, d) {
  const rail = new THREE.Mesh(new THREE.BoxGeometry(w, RAIL_HEIGHT, d), mat);
  rail.position.set(cx, RAIL_HEIGHT / 2, cz);
  rail.castShadow = true;
  rail.receiveShadow = true;
  rails.add(rail);
}

function addDiscRing(group, [x, z], r, hex = 0x6b4a2a, tube = RAIL_THICKNESS * 0.6) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(r, tube, 8, 48),
    new THREE.MeshStandardMaterial({ color: hex, roughness: 0.6, metalness: 0.1 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, RAIL_HEIGHT / 2, z);
  ring.castShadow = true;
  ring.receiveShadow = true;
  group.add(ring);
}

function addDisc(group, [x, z], r, hex, opacity, yOffset = 0.001) {
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(r, 32),
    new THREE.MeshStandardMaterial({ color: hex, transparent: opacity < 1, opacity, roughness: 0.6 })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(x, yOffset, z);
  disc.receiveShadow = true;
  group.add(disc);
}

function addWater(group, water, boardW, boardH) {
  const { edge, level } = water;
  let w = boardW, h = boardH, cx = 0, cz = 0;
  if (edge === 'l') { w = level * boardW; cx = -boardW / 2 + w / 2; }
  else if (edge === 'r') { w = level * boardW; cx = boardW / 2 - w / 2; }
  else if (edge === 't') { h = level * boardH; cz = -boardH / 2 + h / 2; }
  else if (edge === 'b') { h = level * boardH; cz = boardH / 2 - h / 2; }
  const map = paintWaterTexture(9001);
  map.repeat.set(w * 4, h * 4);
  const water3d = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map, transparent: true, opacity: 0.72, roughness: 0.15, metalness: 0.1 })
  );
  water3d.rotation.x = -Math.PI / 2;
  water3d.position.set(cx, 0.002, cz);
  water3d.userData.anim = 'water';
  group.add(water3d);
}

// lit-from-within molten pool: emissive glow rides on the same fbm churn as the albedo, and
// both maps drift slowly so the surface reads as live rather than a painted-on still image.
function addLavaDisc(group, [x, z], r, seedIndex) {
  const { map, emissiveMap } = paintLavaTexture(4200 + seedIndex * 733);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(r, 32),
    new THREE.MeshStandardMaterial({
      map, emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.4, roughness: 0.55, metalness: 0
    })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(x, 0.003, z);
  disc.receiveShadow = true;
  disc.userData.anim = 'lava';
  group.add(disc);
}

// pale, cracked, and faintly transmissive rather than a flat blue disc — clearcoat gives the
// facets a hard, brittle highlight instead of the soft sheen the other wet/soft terrain has.
function addIceDisc(group, [x, z], r, seedIndex) {
  const { map, roughnessMap } = paintIceTexture(7700 + seedIndex * 511);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(r, 32),
    new THREE.MeshPhysicalMaterial({
      map, roughnessMap, transparent: true, opacity: 0.75,
      transmission: 0.25, ior: 1.31, clearcoat: 0.6, clearcoatRoughness: 0.3, metalness: 0
    })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(x, 0.002, z);
  disc.receiveShadow = true;
  group.add(disc);
}

// Called once per rendered frame (scene.js draw()) — drifts the UV offset of anything
// tagged userData.anim so lava churns and water ripples instead of sitting frozen between
// terrain rebuilds. Cheap: just a couple of texture.offset writes per animated mesh.
function updateAnimatedMaterials(terrain, world) {
  for (const child of terrain.children) {
    if (child.userData.anim === 'lava') {
      const t = world.time * 0.015;
      child.material.map.offset.set(t, t * 0.6);
      child.material.emissiveMap.offset.set(t, t * 0.6);
    } else if (child.userData.anim === 'water') {
      const t = world.time * 0.006;
      child.material.map.offset.set(t, -t * 0.5);
    }
  }
}

const COLOUR_HEX = { crimson: 0xc8283c, gold: 0xdcb432, teal: 0x28a0a0, violet: 0x8c50c8 };
function colourHex(colour) { return COLOUR_HEX[colour] ?? 0xbebebe; }

// A soft-edged dark disc on transparent, sized so the visible hole is BLACKOUT_TEX_HOLE_FRAC
// of the plane it's mapped onto — the plane is then scaled per frame in updateBlackout() to
// make that fixed hole track blackout's actual (shrinking) radius.
function makeBlackoutTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const holePx = size * BLACKOUT_TEX_HOLE_FRAC / 6; // plane is 6 units wide, texture is size px
  const grad = ctx.createRadialGradient(size / 2, size / 2, holePx * 0.7, size / 2, size / 2, holePx);
  grad.addColorStop(0, 'rgba(5,3,2,0)');
  grad.addColorStop(1, 'rgba(5,3,2,0.985)');
  ctx.fillStyle = grad;
  // canvas radial gradients clamp to the last stop beyond their end radius, so this one
  // fillRect covers the whole canvas: transparent hole in the middle, opaque dark everywhere
  // past it.
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

/* ------------------------------------------------------------------ */
/* Procedural material helpers — no real PBR set is reachable from     */
/* this environment (Poly Haven / ambientCG are network-blocked), so   */
/* "looks like glass / wood / lava" has to come from painted canvas    */
/* textures plus the right material params, not photographed sources.  */
/* ------------------------------------------------------------------ */

// Deterministic value noise (own small seeded PRNG, NOT world.rng — this is cosmetic paint,
// not gameplay state, so it doesn't need to replay identically across seeds). Returns values
// roughly in -1..1.
function makeNoise2D(seed) {
  let s = seed >>> 0;
  const rand = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0xffffffff; };
  const GRID = 16;
  const grad = [];
  for (let i = 0; i < GRID * GRID; i++) {
    const a = rand() * Math.PI * 2;
    grad.push([Math.cos(a), Math.sin(a)]);
  }
  const at = (ix, iy) => grad[((iy % GRID + GRID) % GRID) * GRID + ((ix % GRID + GRID) % GRID)];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + t * (b - a);
  const dot = (ix, iy, x, y) => { const g = at(ix, iy); return g[0] * (x - ix) + g[1] * (y - iy); };
  return function noise(x, y) {
    const x0 = Math.floor(x), y0 = Math.floor(y), x1 = x0 + 1, y1 = y0 + 1;
    const sx = fade(x - x0), sy = fade(y - y0);
    const n0 = lerp(dot(x0, y0, x, y), dot(x1, y0, x, y), sx);
    const n1 = lerp(dot(x0, y1, x, y), dot(x1, y1, x, y), sx);
    return lerp(n0, n1, sy) * 1.4;
  };
}

// fractal sum of the above — more octaves = finer detail riding on top of broad shape
function makeFbm(seed, octaves = 4) {
  const layers = [];
  for (let i = 0; i < octaves; i++) layers.push(makeNoise2D(seed + i * 977));
  return function fbm(x, y) {
    let sum = 0, amp = 0.5, freq = 1;
    for (const n of layers) { sum += n(x * freq, y * freq) * amp; amp *= 0.5; freq *= 2.15; }
    return sum;
  };
}

// Sobel-derived normal map from a grayscale height canvas — the cheap way to get real bump
// relief (grain ridges, ice facets) without a modeled mesh or an external normal-map source.
function heightToNormalMap(heightCanvas, strength = 1.5) {
  const size = heightCanvas.width;
  const hctx = heightCanvas.getContext('2d');
  const h = hctx.getImageData(0, 0, size, size).data;
  const at = (x, y) => h[((((y % size) + size) % size) * size + (((x % size) + size) % size)) * 4] / 255;

  const out = document.createElement('canvas');
  out.width = out.height = size;
  const octx = out.getContext('2d');
  const img = octx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x - 1, y) - at(x + 1, y)) * strength;
      const dy = (at(x, y - 1) - at(x, y + 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      img.data[i] = ((dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}

function tileTexture(canvas, repeat, srgb = false) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Procedural oak: warm streaked grain for albedo, matching noise for roughness variation,
// and a Sobel normal map off the same grain so the ridges actually catch the key light
// instead of reading as a flat painted photo.
function paintOakTextures() {
  const size = 512;
  const albedo = document.createElement('canvas');
  albedo.width = albedo.height = size;
  const actx = albedo.getContext('2d');
  actx.fillStyle = '#5a3d24';
  actx.fillRect(0, 0, size, size);

  const rough = document.createElement('canvas');
  rough.width = rough.height = size;
  const rctx = rough.getContext('2d');
  rctx.fillStyle = '#808080';
  rctx.fillRect(0, 0, size, size);

  const height = document.createElement('canvas');
  height.width = height.height = size;
  const hctx = height.getContext('2d');
  hctx.fillStyle = '#808080';
  hctx.fillRect(0, 0, size, size);

  let seed = 1337;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed / 0x7fffffff); };

  for (let i = 0; i < 90; i++) {
    const y = rand() * size;
    const grainH = 2 + rand() * 5;
    const shade = 0.75 + rand() * 0.5;
    actx.fillStyle = `rgba(${(90 * shade) | 0}, ${(58 * shade) | 0}, ${(30 * shade) | 0}, ${0.3 + rand() * 0.4})`;
    actx.fillRect(0, y, size, grainH);

    const roughShade = 100 + ((rand() * 100) | 0);
    rctx.fillStyle = `rgb(${roughShade},${roughShade},${roughShade})`;
    rctx.fillRect(0, y, size, grainH);

    // grain ridges sit slightly proud of the surface — a raised streak, not a flat stain
    const ridgeShade = 128 + ((shade - 1) * 60) | 0;
    hctx.fillStyle = `rgb(${ridgeShade},${ridgeShade},${ridgeShade})`;
    hctx.fillRect(0, y, size, grainH);
  }

  const map = tileTexture(albedo, 3, true);
  const roughnessMap = tileTexture(rough, 3);
  const normalMap = tileTexture(heightToNormalMap(height, 2), 3);

  return { map, roughnessMap, normalMap };
}

// Molten churn: layered fbm noise mapped through a black -> deep red -> orange -> white-hot
// ramp for albedo, with a thresholded copy as the emissive mask so only the hottest veins
// actually glow instead of the whole pool lighting up flat orange.
function paintLavaTexture(seed) {
  const size = 160;
  const fbm = makeFbm(seed, 4);
  const albedo = document.createElement('canvas');
  albedo.width = albedo.height = size;
  const actx = albedo.getContext('2d');
  const emissive = document.createElement('canvas');
  emissive.width = emissive.height = size;
  const ectx = emissive.getContext('2d');

  const img = actx.createImageData(size, size);
  const eimg = ectx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = (fbm(x * 0.06, y * 0.06) + 1) / 2; // 0..1
      let r, g, b;
      if (n < 0.35) { r = 20 + n * 60; g = 4; b = 2; }
      else if (n < 0.65) { const t = (n - 0.35) / 0.3; r = 40 + t * 160; g = 10 + t * 40; b = 2; }
      else { const t = (n - 0.65) / 0.35; r = 200 + t * 55; g = 50 + t * 150; b = t * 90; }
      const i = (y * size + x) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
      const glow = n > 0.62 ? Math.min(1, (n - 0.62) / 0.2) : 0;
      eimg.data[i] = glow * 255; eimg.data[i + 1] = glow * 130; eimg.data[i + 2] = glow * 30; eimg.data[i + 3] = 255;
    }
  }
  actx.putImageData(img, 0, 0);
  ectx.putImageData(eimg, 0, 0);

  return { map: tileTexture(albedo, 1, true), emissiveMap: tileTexture(emissive, 1, true) };
}

// Cracked ice: pale translucent base with jagged fracture lines scored into it, plus a
// roughness map so the facets catch specular highlights unevenly instead of one smooth sheen.
function paintIceTexture(seed) {
  const size = 160;
  let s = seed >>> 0;
  const rand = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0xffffffff; };

  const albedo = document.createElement('canvas');
  albedo.width = albedo.height = size;
  const actx = albedo.getContext('2d');
  actx.fillStyle = '#cdeeff';
  actx.fillRect(0, 0, size, size);

  const rough = document.createElement('canvas');
  rough.width = rough.height = size;
  const rctx = rough.getContext('2d');
  rctx.fillStyle = '#404040';
  rctx.fillRect(0, 0, size, size);

  actx.strokeStyle = 'rgba(255,255,255,0.85)';
  rctx.strokeStyle = '#dddddd';
  for (let i = 0; i < 9; i++) {
    let x = rand() * size, y = rand() * size;
    actx.beginPath(); actx.moveTo(x, y);
    rctx.beginPath(); rctx.moveTo(x, y);
    const segs = 3 + ((rand() * 3) | 0);
    for (let j = 0; j < segs; j++) {
      x += (rand() - 0.5) * size * 0.5;
      y += (rand() - 0.5) * size * 0.5;
      actx.lineTo(x, y);
      rctx.lineTo(x, y);
    }
    actx.lineWidth = 1 + rand();
    actx.stroke();
    rctx.lineWidth = 2 + rand() * 2;
    rctx.stroke();
  }

  return { map: tileTexture(albedo, 1, true), roughnessMap: tileTexture(rough, 1) };
}

// Slow rolling caustic-ish ripple — coarse fbm banded into a couple of blue shades so the
// surface reads as disturbed water rather than a flat translucent pane.
function paintWaterTexture(seed) {
  const size = 160;
  const fbm = makeFbm(seed, 3);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = (fbm(x * 0.08, y * 0.08) + 1) / 2;
      const band = Math.round(n * 4) / 4;
      const r = 18 + band * 30, g = 70 + band * 60, b = 110 + band * 70;
      const i = (y * size + x) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return tileTexture(canvas, 1, true);
}
