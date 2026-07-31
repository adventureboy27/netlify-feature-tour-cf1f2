/**
 * Instanced-in-spirit glass spheres — one MeshPhysicalMaterial mesh per marble slot
 * (five is small enough that real GPU instancing isn't worth the complexity yet), each with
 * a cat's-eye core and, for the player only, the rotating ring + four pips (non-negotiable
 * #6). Reads world.marbles every frame and owns nothing else.
 */
import * as THREE from 'three';
import { boardToScene } from './board.js';

const RING_R_MUL = 1.6;
const RING_ROT_SPEED = 0.6; // rad/s, "slowly rotating"
const PIP_COUNT = 4;

const COLOUR_HEX = { crimson: 0xc8283c, gold: 0xdcb432, teal: 0x28a0a0, violet: 0x8c50c8 };
const BARE_HEX = 0xcfe8f5;

export function createMarbleSystem(maxCount) {
  const group = new THREE.Group();
  const slots = [];

  for (let i = 0; i < maxCount; i++) slots.push(makeSlot(group));

  function sync(world, alpha) {
    const boardW = world.w, boardH = world.h;
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const m = world.marbles[i];
      if (!m || !m.alive) { slot.root.visible = false; continue; }
      slot.root.visible = true;

      const x = m.px + (m.x - m.px) * alpha;
      const y = m.py + (m.y - m.py) * alpha;
      const [sx, sz] = boardToScene(x, y, boardW, boardH);
      slot.root.position.set(sx, m.r, sz);
      slot.root.scale.setScalar(m.r / slot.baseR);

      const hex = m.colour && m.colour !== 'bare' ? (COLOUR_HEX[m.colour] ?? BARE_HEX) : BARE_HEX;
      slot.material.color.setHex(hex);

      if (m.isPlayer) {
        slot.ring.visible = true;
        slot.ring.rotation.y = world.time * RING_ROT_SPEED;
      } else {
        slot.ring.visible = false;
      }
    }
  }

  return { group, sync };
}

function makeSlot(parent) {
  const baseR = 0.035;
  const root = new THREE.Group();

  const material = new THREE.MeshPhysicalMaterial({
    color: BARE_HEX,
    transmission: 1,
    ior: 1.52,
    thickness: baseR,
    roughness: 0.05,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    metalness: 0
  });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(baseR, 48, 32), material);
  sphere.castShadow = true;
  sphere.receiveShadow = true;
  root.add(sphere);

  // cat's-eye: a small coloured core visible through the glass
  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(baseR * 0.35, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x334455, emissiveIntensity: 0.3 })
  );
  root.add(eye);

  const ring = buildRing(baseR);
  root.add(ring);

  parent.add(root);
  return { root, material, ring, baseR };
}

function buildRing(baseR) {
  const ring = new THREE.Group();
  const ringR = baseR * RING_R_MUL;

  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(ringR, baseR * 0.06, 8, 32),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x888888, emissiveIntensity: 0.4 })
  );
  torus.rotation.x = Math.PI / 2;
  ring.add(torus);

  for (let i = 0; i < PIP_COUNT; i++) {
    const a = (i / PIP_COUNT) * Math.PI * 2;
    const pip = new THREE.Mesh(
      new THREE.SphereGeometry(baseR * 0.16, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xaaaaaa, emissiveIntensity: 0.5 })
    );
    pip.position.set(Math.cos(a) * ringR, 0, Math.sin(a) * ringR);
    ring.add(pip);
  }

  return ring;
}
