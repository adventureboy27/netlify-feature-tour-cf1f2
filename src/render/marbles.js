/**
 * Instanced-in-spirit glass spheres — one MeshPhysicalMaterial mesh per marble slot
 * (five is small enough that real GPU instancing isn't worth the complexity yet), each with
 * a cat's-eye core and, for the player only, the rotating ring + four pips (non-negotiable
 * #6). Opponents instead get a billboard number sprite (content/roster.js) — never a colour,
 * same reasoning as the player's ring. A crack/scorch shell fades in with sim/damage.js's
 * per-marble damage. Reads world.marbles every frame and owns nothing else.
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

      // opponents are identified by a number, never colour — same reasoning as non-negotiable
      // #6 for the player: colour already changes (roulette, powers), a number doesn't.
      if (m.number != null) {
        slot.numberSprite.visible = true;
        slot.numberSprite.material.map = getNumberTexture(m.number);
      } else {
        slot.numberSprite.visible = false;
      }

      // scorch/crack overlay fades in with accumulated damage (sim/damage.js) — never kills
      // by itself here, just shows the wear that's building toward it.
      slot.damageShell.visible = m.damage > 0.02;
      slot.damageShell.material.opacity = m.damage;
    }
  }

  return { group, sync };
}

const numberTextureCache = new Map();
function getNumberTexture(number) {
  let tex = numberTextureCache.get(number);
  if (tex) return tex;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(10,7,5,0.8)';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.46, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(number), size / 2, size / 2 + 1);
  tex = new THREE.CanvasTexture(canvas);
  numberTextureCache.set(number, tex);
  return tex;
}

// One shared crack/scorch texture — cracks are randomly placed but the pattern itself doesn't
// need to be unique per marble, only its opacity (driven by that marble's own damage) does.
let sharedCrackTexture = null;
function getCrackTexture() {
  if (sharedCrackTexture) return sharedCrackTexture;
  const size = 128;
  let s = 5150;
  const rand = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0xffffffff; };
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(20,10,5,0.9)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 16; i++) {
    let x = rand() * size, y = rand() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const segs = 2 + ((rand() * 3) | 0);
    for (let j = 0; j < segs; j++) {
      x += (rand() - 0.5) * size * 0.4;
      y += (rand() - 0.5) * size * 0.4;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 7; i++) {
    const x = rand() * size, y = rand() * size, r = 4 + rand() * 9;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(15,8,4,0.6)');
    grad.addColorStop(1, 'rgba(15,8,4,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  sharedCrackTexture = new THREE.CanvasTexture(canvas);
  return sharedCrackTexture;
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

  // thin shell just outside the glass surface — cracks/scorch fade in with damage, sync()
  const damageShell = new THREE.Mesh(
    new THREE.SphereGeometry(baseR * 1.03, 32, 24),
    new THREE.MeshBasicMaterial({ map: getCrackTexture(), transparent: true, opacity: 0, depthWrite: false })
  );
  damageShell.visible = false;
  root.add(damageShell);

  // opponent number badge — a camera-facing sprite so it's always legible regardless of how
  // the marble has rolled, hidden for the player (identified by the ring instead, never a
  // number, same as never by colour).
  const numberSprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: true }));
  numberSprite.scale.set(baseR * 1.7, baseR * 1.7, 1);
  numberSprite.position.set(0, baseR * 2.3, 0);
  numberSprite.visible = false;
  root.add(numberSprite);

  parent.add(root);
  return { root, material, ring, damageShell, numberSprite, baseR };
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
