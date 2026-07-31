/**
 * Camera, lights, environment map, and the top-level three.js renderer. Reads world state
 * every frame and writes nothing back — same contract as render/canvas2d.js, so main.js can
 * toggle between the two freely (docs/BUILD-ORDER.md M4: "keep the canvas renderer behind a
 * flag — a useful truth check when the 3D looks wrong").
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createBoard, boardToScene } from './board.js';
import { createMarbleSystem } from './marbles.js';

const MAX_MARBLES = 8; // 5 to start, plus headroom for splitshot growing the roster
const FOV = 32;
const ELEVATION = THREE.MathUtils.degToRad(58); // "fixed three-quarter top-down"
const AZIMUTH = THREE.MathUtils.degToRad(-22);  // off-axis so rails read as having depth
const FIT_MARGIN = 1.35;

export function createRenderer3D(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x17130f);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 20);

  addLights(scene);

  const board = createBoard();
  scene.add(board.group);

  const marbles = createMarbleSystem(MAX_MARBLES);
  scene.add(marbles.group);

  const aim = buildAimIndicator();
  scene.add(aim.group);

  let lastW = -1, lastH = -1;

  function fitCamera(world) {
    board.layout(world);
    const viewRadius = Math.hypot(world.w, world.h) / 2 * FIT_MARGIN;
    const distance = viewRadius / Math.sin(THREE.MathUtils.degToRad(FOV / 2));
    const dir = new THREE.Vector3(
      Math.cos(ELEVATION) * Math.sin(AZIMUTH),
      Math.sin(ELEVATION),
      Math.cos(ELEVATION) * Math.cos(AZIMUTH)
    );
    camera.position.copy(dir.multiplyScalar(distance));
    camera.lookAt(0, 0, 0);
    lastW = world.w;
    lastH = world.h;
  }

  function resize(widthPx, heightPx) {
    renderer.setSize(widthPx, heightPx, false);
    camera.aspect = widthPx / heightPx;
    camera.updateProjectionMatrix();
  }

  function buildTerrain(world) {
    board.buildTerrain(world);
  }

  function draw(world, alpha, charge) {
    if (world.w !== lastW || world.h !== lastH) fitCamera(world);

    marbles.sync(world, alpha);
    board.updateAnimations(world);

    const player = world.marbles.find((m) => m.isPlayer && m.alive);
    board.updateBlackout(world, player ? boardToScene(player.x, player.y, world.w, world.h) : null);

    if (charge && player) {
      const [cx, cz] = boardToScene(player.x, player.y, world.w, world.h);
      aim.update(cx, cz, charge.angle, player.r * 2.4, charge.power, charge.overheating);
      aim.group.visible = true;
    } else {
      aim.group.visible = false;
    }

    renderer.render(scene, camera);
  }

  return { resize, draw, buildTerrain };
}

function addLights(scene) {
  const hemi = new THREE.HemisphereLight(0x8899aa, 0x2a1f16, 0.5);
  scene.add(hemi);

  // warm key light, upper left (docs/DESIGN.md art direction)
  const key = new THREE.DirectionalLight(0xfff0d8, 2.4);
  key.position.set(-1.1, 1.6, 0.7);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -1.2;
  key.shadow.camera.right = 1.2;
  key.shadow.camera.top = 1.2;
  key.shadow.camera.bottom = -1.2;
  key.shadow.camera.near = 0.1;
  key.shadow.camera.far = 5;
  key.shadow.bias = -0.0015;
  scene.add(key);

  // cool fill, opposite side, no shadow — fills without fighting the key's shadow direction
  const fill = new THREE.DirectionalLight(0xbcd8ff, 0.6);
  fill.position.set(1.2, 0.8, -0.6);
  scene.add(fill);
}

// Direction is no longer a drag vector the player chooses freely — a marker races around
// the marble and the player commits to wherever it is when they release (or when the
// launcher overheats and commits for them). The marker's angular position on the circle IS
// the direction readout; the radial line just makes that legible at a glance. Color rides
// power: white -> orange -> red as charge builds, flashing red during overheat.
function buildAimIndicator() {
  const group = new THREE.Group();

  const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  const line = new THREE.Line(lineGeo, lineMat);
  group.add(line);

  const tipMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffaa33, emissiveIntensity: 0.9 });
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 8), tipMat);
  group.add(tip);

  group.visible = false;

  function update(cx, cz, angle, radius, power, overheating) {
    const tx = cx + Math.cos(angle) * radius;
    const tz = cz + Math.sin(angle) * radius;
    const pos = line.geometry.attributes.position;
    pos.setXYZ(0, cx, 0.04, cz);
    pos.setXYZ(1, tx, 0.04, tz);
    pos.needsUpdate = true;
    tip.position.set(tx, 0.04, tz);

    const hex = overheating ? 0xff2020
      : power < 0.5 ? lerpHex(0xffffff, 0xffaa33, power * 2)
      : lerpHex(0xffaa33, 0xff2020, (power - 0.5) * 2);
    lineMat.color.setHex(hex);
    tipMat.color.setHex(hex);
    tipMat.emissive.setHex(hex);
  }

  return { group, update };
}

function lerpHex(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
