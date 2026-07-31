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

export function boardToScene(x, y, w, h) {
  return [x - w / 2, y - h / 2];
}

export function createBoard() {
  const group = new THREE.Group();

  const { map, roughnessMap } = paintOakTextures();
  const floorMat = new THREE.MeshStandardMaterial({ map, roughnessMap, metalness: 0.05 });
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
    terrain.clear();
    const t = world.terrain;
    const toScene = (x, y) => boardToScene(x, y, boardW, boardH);

    if (world.disc) addDiscRing(terrain, toScene(world.disc.x, world.disc.y), world.disc.r);

    for (const p of t.colourPatches) addDisc(terrain, toScene(p.x, p.y), p.r, colourHex(p.colour), 0.65);
    for (const p of t.icePatches) addDisc(terrain, toScene(p.x, p.y), p.r, 0xbeebff, 0.35, 0.002);
    for (const g of t.gutters) addDisc(terrain, toScene(g.x, g.y), g.r, 0x000000, 0.25, 0.001);
    for (const c of t.craters) addDisc(terrain, toScene(c.x, c.y), c.r, 0x000000, 0.35, 0.0015);
    for (const l of t.lavas) addDisc(terrain, toScene(l.x, l.y), l.r, 0xff6a1f, 0.9, 0.003);
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
  }

  return { group, layout, buildTerrain };
}

function addRail(rails, mat, cx, cz, w, d) {
  const rail = new THREE.Mesh(new THREE.BoxGeometry(w, RAIL_HEIGHT, d), mat);
  rail.position.set(cx, RAIL_HEIGHT / 2, cz);
  rail.castShadow = true;
  rail.receiveShadow = true;
  rails.add(rail);
}

function addDiscRing(group, [x, z], r) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(r, RAIL_THICKNESS * 0.6, 8, 48),
    new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.6, metalness: 0.1 })
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
  const water3d = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ color: 0x1e5a8c, transparent: true, opacity: 0.6, roughness: 0.15, metalness: 0.1 })
  );
  water3d.rotation.x = -Math.PI / 2;
  water3d.position.set(cx, 0.002, cz);
  group.add(water3d);
}

const COLOUR_HEX = { crimson: 0xc8283c, gold: 0xdcb432, teal: 0x28a0a0, violet: 0x8c50c8 };
function colourHex(colour) { return COLOUR_HEX[colour] ?? 0xbebebe; }

// Procedural oak: warm streaked grain for albedo, matching noise for roughness variation —
// stands in for a real PBR set until one can be loaded from Poly Haven / ambientCG.
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
  }

  const map = new THREE.CanvasTexture(albedo);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 3);
  map.colorSpace = THREE.SRGBColorSpace;

  const roughnessMap = new THREE.CanvasTexture(rough);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(3, 3);

  return { map, roughnessMap };
}
