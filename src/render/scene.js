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

const MAX_MARBLES = 5;
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

  const aim = buildAimLine();
  scene.add(aim.line);

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

  function draw(world, alpha, drag) {
    if (world.w !== lastW || world.h !== lastH) fitCamera(world);

    marbles.sync(world, alpha);

    if (drag) {
      const [ox, oz] = boardToScene(drag.originX, drag.originY, world.w, world.h);
      const [tx, tz] = boardToScene(drag.x, drag.y, world.w, world.h);
      aim.update(ox, oz, tx, tz);
      aim.line.visible = true;
    } else {
      aim.line.visible = false;
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

function buildAimLine() {
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const mat = new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.02, gapSize: 0.015, transparent: true, opacity: 0.7 });
  const line = new THREE.Line(geo, mat);
  line.visible = false;

  function update(ox, oz, tx, tz) {
    const positions = line.geometry.attributes.position;
    positions.setXYZ(0, ox, 0.01, oz);
    positions.setXYZ(1, tx, 0.01, tz);
    positions.needsUpdate = true;
    line.computeLineDistances();
  }

  return { line, update };
}
