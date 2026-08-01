// Pixel-art paper-doll renderer, booking-game-design.md §7.
//
// §2's tech table says "Inline SVG components... no asset pipeline" for art,
// but §7 (later in the document, and specifically about this system) calls
// for sprites "rendered to a canvas at a low internal resolution and scaled
// with nearest-neighbor," and the §2 performance budget itself says to
// "render sprites to cached canvases once and reuse the bitmaps." Per §0,
// "the later section wins" — this renders to canvas, not SVG. Flagging per
// the working agreement.
//
// Shape vocabulary: tapered torso/limb polygons + arcs, each clipped and
// shaded with a translucent overlay to fake directional light — the classic
// way 16-bit sports games read as "modeled" without actual 3D. Per §21,
// "the only pixel art in the game is the wrestler sprites" — chunky and
// nearest-neighbor-scaled, not a photoreal or 3D look (explicitly locked:
// "do not imitate their worn-paper or 3D look").
//
// DESIGN: hand-authored art for all 24 hair styles, 12 masks, etc. would be
// its own large content project. This draws a small procedural kit of
// silhouettes (picked by `trait % variantCount`) so every documented index
// is renderable and every wrestler is recolored independently — every color
// slot (skin tone, hair color, primary/secondary/accent) already maps 1:1
// to the full range in Appearance, so distinct wrestlers really do look
// distinct today. Growing the shape vocabulary itself is future art-content
// work, the same way §0 treats name/gimmick lists as ongoing content rather
// than an M0/M1 blocker.

import type { Appearance } from '../../engine/types';
import { skinToneColor, hairColorValue, attireColor } from './palette';

export const GRID_W = 32;
export const GRID_H = 48;

const CENTER_X = GRID_W / 2;

// build: 0 slim, 1 athletic, 2 thick, 3 heavy, 4 massive, 5 tall
const SHOULDER_WIDTH = [13, 15, 18, 21, 24, 16];
const WAIST_WIDTH = [8, 9, 11, 13, 15, 9];
const ARM_WIDTH = [2.2, 2.6, 3.1, 3.6, 4.2, 2.6];
const THIGH_WIDTH = [3.8, 4.3, 5.2, 6.2, 7.2, 4.3];
const CALF_WIDTH = [2.8, 3.2, 3.8, 4.4, 5, 3.2];

interface Geometry {
  shoulderWidth: number;
  waistWidth: number;
  armWidth: number;
  thighWidth: number;
  calfWidth: number;
  headTop: number;
  headCenterY: number;
  headRadius: number;
  headBottom: number;
  neckY: number;
  shoulderY: number;
  waistY: number;
  hipY: number;
  ankleY: number;
  footY: number;
}

function computeGeometry(appearance: Appearance): Geometry {
  const b = appearance.build % 6;
  const heightBoost = appearance.height + (appearance.build === 5 ? 2.5 : 0); // "tall" build adds extra length

  const headRadius = 4.6;
  const headCenterY = 6;
  const headTop = headCenterY - headRadius;
  const headBottom = headCenterY + headRadius;
  const neckY = headBottom + 1.4;
  const shoulderY = neckY + 1.2;
  const waistY = shoulderY + 12 + heightBoost * 0.7;
  const hipY = waistY + 2.5;
  const ankleY = hipY + 15.5 + heightBoost * 1.1;
  const footY = ankleY + 2.2;

  return {
    shoulderWidth: SHOULDER_WIDTH[b]!,
    waistWidth: WAIST_WIDTH[b]!,
    armWidth: ARM_WIDTH[b]!,
    thighWidth: THIGH_WIDTH[b]!,
    calfWidth: CALF_WIDTH[b]!,
    headTop,
    headCenterY,
    headRadius,
    headBottom,
    neckY,
    shoulderY,
    waistY,
    hipY,
    ankleY,
    footY,
  };
}

// Fill `path`, then re-fill the right-hand ~45% of its bounding box with a
// translucent dark overlay (clipped to the same path) to fake a light
// source from the upper-left — the cheap trick that makes flat pixel-art
// shapes read as modeled.
function fillShaded(ctx: CanvasRenderingContext2D, path: Path2D, color: string, bounds: { x: number; w: number; y: number; h: number }) {
  ctx.fillStyle = color;
  ctx.fill(path);

  ctx.save();
  ctx.clip(path);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(bounds.x + bounds.w * 0.55, bounds.y, bounds.w * 0.45, bounds.h);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(bounds.x, bounds.y, bounds.w * 0.22, bounds.h);
  ctx.restore();
}

function taperedQuad(topX: number, topY: number, topW: number, botX: number, botY: number, botW: number): Path2D {
  const p = new Path2D();
  p.moveTo(topX - topW / 2, topY);
  p.lineTo(topX + topW / 2, topY);
  p.lineTo(botX + botW / 2, botY);
  p.lineTo(botX - botW / 2, botY);
  p.closePath();
  return p;
}

function drawShadow(ctx: CanvasRenderingContext2D, geo: Geometry) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(CENTER_X, geo.footY + 0.5, geo.shoulderWidth * 0.55, 1.3, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawArm(ctx: CanvasRenderingContext2D, geo: Geometry, side: 'rear' | 'front', appearance: Appearance) {
  const sign = side === 'rear' ? -1 : 1;
  const skin = skinToneColor(appearance.skinTone);
  const topStyle = appearance.attireTop % 4;
  const sleeveColor = attireColor(appearance.primaryColor);

  const shoulderX = CENTER_X + sign * (geo.shoulderWidth / 2 - geo.armWidth * 0.3);
  const elbowX = CENTER_X + sign * (geo.shoulderWidth / 2 + geo.armWidth * 0.15);
  const elbowY = geo.shoulderY + (geo.waistY - geo.shoulderY) * 0.5;
  const wristX = CENTER_X + sign * (geo.shoulderWidth / 2 - geo.armWidth * 0.1);
  const wristY = geo.waistY - 0.5;

  const upperArm = taperedQuad(shoulderX, geo.shoulderY, geo.armWidth * 1.15, elbowX, elbowY, geo.armWidth * 0.85);
  const forearm = taperedQuad(elbowX, elbowY, geo.armWidth * 0.85, wristX, wristY, geo.armWidth * 0.65);
  const boundsUpper = { x: Math.min(shoulderX, elbowX) - geo.armWidth, y: geo.shoulderY, w: geo.armWidth * 2.5, h: elbowY - geo.shoulderY };
  const boundsFore = { x: Math.min(elbowX, wristX) - geo.armWidth, y: elbowY, w: geo.armWidth * 2.5, h: wristY - elbowY };

  const sleeveEndY = geo.shoulderY + (geo.waistY - geo.shoulderY) * (topStyle >= 2 ? 0.55 : 0);
  fillShaded(ctx, upperArm, sleeveEndY > geo.shoulderY ? sleeveColor : skin, boundsUpper);
  fillShaded(ctx, forearm, skin, boundsFore);

  // hand
  ctx.beginPath();
  ctx.ellipse(wristX, wristY + 0.8, geo.armWidth * 0.42, geo.armWidth * 0.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = skin;
  ctx.fill();

  if (side === 'front' && appearance.accessory !== 0) {
    ctx.fillStyle = attireColor(appearance.accentColor);
    ctx.fillRect(Math.round(elbowX - geo.armWidth * 0.6), Math.round(elbowY - 0.3), Math.round(geo.armWidth * 1.2), 1.2);
  }
  if (side === 'front' && appearance.tattoos !== 0) {
    ctx.fillStyle = 'rgba(20,20,30,0.5)';
    const marks = (appearance.tattoos % 3) + 1;
    for (let i = 0; i < marks; i++) {
      ctx.fillRect(Math.round(elbowX - 0.6), Math.round(geo.shoulderY + 1 + i * 1.6), 1.2, 0.7);
    }
  }
}

function drawLegs(ctx: CanvasRenderingContext2D, geo: Geometry, appearance: Appearance) {
  const bottomStyle = appearance.attireBottom % 4;
  const skin = skinToneColor(appearance.skinTone);
  const legColor = bottomStyle === 0 ? skin : attireColor(appearance.secondaryColor);
  const gap = 1.1;
  const kneeY = geo.hipY + (geo.ankleY - geo.hipY) * 0.55;

  for (const sign of [-1, 1]) {
    const hipX = CENTER_X + sign * (geo.thighWidth / 2 + gap / 2);
    const kneeX = CENTER_X + sign * (geo.calfWidth / 2 + gap / 2 + 0.3);
    const ankleX = kneeX;

    const thigh = taperedQuad(hipX, geo.hipY, geo.thighWidth, kneeX, kneeY, geo.calfWidth * 1.15);
    const calf = taperedQuad(kneeX, kneeY, geo.calfWidth * 1.05, ankleX, geo.ankleY, geo.calfWidth * 0.8);
    const boundsThigh = { x: Math.min(hipX, kneeX) - geo.thighWidth, y: geo.hipY, w: geo.thighWidth * 2, h: kneeY - geo.hipY };
    const boundsCalf = { x: ankleX - geo.calfWidth, y: kneeY, w: geo.calfWidth * 2, h: geo.ankleY - kneeY };

    fillShaded(ctx, thigh, legColor, boundsThigh);
    fillShaded(ctx, calf, bottomStyle === 0 ? skin : legColor, boundsCalf);

    // boot
    const bootColor = appearance.boots % 2 === 0 ? attireColor(appearance.primaryColor) : attireColor(appearance.secondaryColor);
    const bootHeight = 4.2 + (appearance.boots % 3) * 0.6;
    const bootTop = geo.ankleY - bootHeight * 0.35;
    const bootPath = new Path2D();
    bootPath.moveTo(ankleX - geo.calfWidth * 0.55, bootTop);
    bootPath.lineTo(ankleX + geo.calfWidth * 0.55, bootTop);
    bootPath.lineTo(ankleX + geo.calfWidth * 0.55, geo.footY - 1);
    bootPath.lineTo(ankleX + geo.calfWidth * 0.9 + 1.2, geo.footY);
    bootPath.lineTo(ankleX - geo.calfWidth * 0.9, geo.footY);
    bootPath.closePath();
    fillShaded(ctx, bootPath, bootColor, { x: ankleX - geo.calfWidth * 1.5, y: bootTop, w: geo.calfWidth * 3, h: geo.footY - bootTop });
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(Math.round(ankleX - geo.calfWidth * 0.4), Math.round(bootTop + 1), Math.round(geo.calfWidth * 0.8), 0.5);
  }
}

function drawTorso(ctx: CanvasRenderingContext2D, geo: Geometry, appearance: Appearance) {
  const topStyle = appearance.attireTop % 4;
  const skin = skinToneColor(appearance.skinTone);
  const primary = attireColor(appearance.primaryColor);
  const torsoColor = topStyle === 0 ? skin : primary;

  const torso = taperedQuad(CENTER_X, geo.shoulderY, geo.shoulderWidth, CENTER_X, geo.waistY, geo.waistWidth);
  const bounds = { x: CENTER_X - geo.shoulderWidth / 2, y: geo.shoulderY, w: geo.shoulderWidth, h: geo.waistY - geo.shoulderY };
  fillShaded(ctx, torso, torsoColor, bounds);

  // pec/ab shading — a faint centerline + a chest line reads as musculature
  // at this resolution without needing real anatomy.
  ctx.save();
  ctx.clip(torso);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(CENTER_X - 0.35, geo.shoulderY, 0.7, geo.waistY - geo.shoulderY);
  ctx.fillRect(CENTER_X - geo.shoulderWidth / 2, geo.shoulderY + (geo.waistY - geo.shoulderY) * 0.32, geo.shoulderWidth, 0.5);
  ctx.restore();

  if (topStyle === 1) {
    // singlet straps
    const strapColor = attireColor(appearance.secondaryColor);
    ctx.fillStyle = strapColor;
    ctx.fillRect(CENTER_X - geo.shoulderWidth / 2 + 1, geo.shoulderY - 0.5, 1.3, 3.5);
    ctx.fillRect(CENTER_X + geo.shoulderWidth / 2 - 2.3, geo.shoulderY - 0.5, 1.3, 3.5);
  }
  if (topStyle === 3) {
    // jacket: open front accent stripe
    ctx.fillStyle = attireColor(appearance.accentColor);
    ctx.fillRect(CENTER_X - 0.5, geo.shoulderY, 1, geo.waistY - geo.shoulderY);
  }

  // DESIGN: `shirt` (§7 Appearance) isn't placed in §7's numbered layer list.
  // Treated as an optional overlay worn over the attire-top layer.
  if (appearance.shirt !== 0) {
    const shirtColor = attireColor(appearance.secondaryColor);
    const shirtBottom = geo.shoulderY + (geo.waistY - geo.shoulderY) * 0.7;
    const shirt = taperedQuad(CENTER_X, geo.shoulderY, geo.shoulderWidth * 0.95, CENTER_X, shirtBottom, geo.waistWidth * 1.05);
    fillShaded(ctx, shirt, shirtColor, { x: CENTER_X - geo.shoulderWidth / 2, y: geo.shoulderY, w: geo.shoulderWidth, h: shirtBottom - geo.shoulderY });
    ctx.fillStyle = attireColor(appearance.accentColor);
    ctx.fillRect(CENTER_X - 0.6, geo.shoulderY + (shirtBottom - geo.shoulderY) * 0.4, 1.2, 1.2);
  }

  // trunks — a distinct hip garment rather than a color band, per the brief.
  const trunksTop = geo.waistY - 1.5;
  const trunksColor = attireColor(appearance.primaryColor);
  const trunks = new Path2D();
  trunks.moveTo(CENTER_X - geo.waistWidth / 2 - 0.8, trunksTop);
  trunks.lineTo(CENTER_X + geo.waistWidth / 2 + 0.8, trunksTop);
  trunks.lineTo(CENTER_X + geo.waistWidth / 2 + 1.2, geo.hipY);
  trunks.lineTo(CENTER_X + 1.2, geo.hipY + 1.6);
  trunks.lineTo(CENTER_X, geo.hipY + 0.6);
  trunks.lineTo(CENTER_X - 1.2, geo.hipY + 1.6);
  trunks.lineTo(CENTER_X - geo.waistWidth / 2 - 1.2, geo.hipY);
  trunks.closePath();
  fillShaded(ctx, trunks, trunksColor, { x: CENTER_X - geo.waistWidth / 2 - 1.2, y: trunksTop, w: geo.waistWidth + 2.4, h: geo.hipY - trunksTop + 1.6 });
  ctx.fillStyle = attireColor(appearance.secondaryColor);
  ctx.fillRect(CENTER_X - geo.waistWidth / 2 - 0.8, trunksTop, geo.waistWidth + 1.6, 0.6);
}

function drawHead(ctx: CanvasRenderingContext2D, geo: Geometry, appearance: Appearance) {
  const skin = skinToneColor(appearance.skinTone);
  const shape = appearance.faceShape % 4; // 0 round, 1 square, 2 oval, 3 broad
  const radiusScale = [1, 0.96, 0.92, 1.08][shape]!;
  const rx = geo.headRadius * radiusScale;
  const ry = geo.headRadius * (shape === 2 ? 1.12 : 1);

  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(CENTER_X, geo.headCenterY, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  // neck
  ctx.fillStyle = skin;
  ctx.fillRect(CENTER_X - 1.2, geo.headBottom - 0.5, 2.4, geo.neckY - geo.headBottom + 1.5);

  // soft shading on the right side of the face
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(CENTER_X, geo.headCenterY, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  ctx.fillRect(CENTER_X + rx * 0.15, geo.headTop, rx, ry * 2.2);
  ctx.restore();

  // eyes + brows
  const eyeStyle = appearance.eyes % 3;
  const eyeY = geo.headCenterY + ry * 0.05;
  ctx.fillStyle = '#1a1a1a';
  if (eyeStyle !== 2) {
    ctx.fillRect(CENTER_X - rx * 0.55, eyeY, 0.8, 0.7);
    ctx.fillRect(CENTER_X + rx * 0.15, eyeY, 0.8, 0.7);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(CENTER_X - rx * 0.6, eyeY - 0.9, 1, 0.5);
    ctx.fillRect(CENTER_X + rx * 0.1, eyeY - 0.9, 1, 0.5);
  } else {
    // narrow/intense eyes: a single connected brow line
    ctx.fillRect(CENTER_X - rx * 0.6, eyeY, rx * 1.2, 0.5);
  }

  // nose + mouth for a bit of dimension
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(CENTER_X - 0.3, eyeY + 0.8, 0.6, 1.6);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(CENTER_X - rx * 0.35, eyeY + 2.8, rx * 0.7, 0.5);
}

function drawFacialHair(ctx: CanvasRenderingContext2D, geo: Geometry, appearance: Appearance) {
  if (appearance.facialHair === 0) return;
  const style = appearance.facialHair % 4; // 1 mustache, 2 goatee, 3 full beard
  const color = hairColorValue(appearance.hairColor);
  const jawY = geo.headBottom - 2;
  ctx.fillStyle = color;
  if (style === 1) ctx.fillRect(CENTER_X - 1.6, jawY, 3.2, 0.8);
  if (style === 2) ctx.fillRect(CENTER_X - 1, jawY, 2, 2);
  if (style === 3) {
    ctx.beginPath();
    ctx.ellipse(CENTER_X, jawY + 0.5, geo.headRadius * 0.75, 2.6, 0, 0, Math.PI);
    ctx.fill();
  }
}

function drawHair(ctx: CanvasRenderingContext2D, geo: Geometry, appearance: Appearance) {
  if (appearance.hairStyle === 0 || appearance.mask !== 0) return; // 0 = bald; suppressed under a mask, §7
  const style = appearance.hairStyle % 6;
  const color = hairColorValue(appearance.hairColor);
  ctx.fillStyle = color;
  const r = geo.headRadius;
  switch (style) {
    case 1: // crew cut
      ctx.beginPath();
      ctx.ellipse(CENTER_X, geo.headCenterY - r * 0.55, r * 1.02, r * 0.55, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      break;
    case 2: // mohawk
      ctx.fillRect(CENTER_X - 0.6, geo.headTop - 2, 1.2, r * 1.6);
      break;
    case 3: // long / flowing
      ctx.beginPath();
      ctx.ellipse(CENTER_X, geo.headCenterY - r * 0.6, r * 1.05, r * 0.6, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(CENTER_X - r * 1.05, geo.headCenterY - r * 0.2, 1.6, r * 1.8);
      ctx.fillRect(CENTER_X + r * 1.05 - 1.6, geo.headCenterY - r * 0.2, 1.6, r * 1.8);
      break;
    case 4: // ponytail
      ctx.beginPath();
      ctx.ellipse(CENTER_X, geo.headCenterY - r * 0.55, r * 1.02, r * 0.55, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(CENTER_X + r * 0.9, geo.headCenterY - r * 0.3, 1.4, r * 1.6);
      break;
    case 5: // afro
      ctx.beginPath();
      ctx.ellipse(CENTER_X, geo.headCenterY - r * 0.3, r * 1.35, r * 1.25, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = skinToneColor(appearance.skinTone);
      ctx.beginPath();
      ctx.ellipse(CENTER_X, geo.headCenterY, geo.headRadius, geo.headRadius, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(CENTER_X, geo.headCenterY - r * 0.3, r * 1.35, r * 1.25, 0, Math.PI * 1.05, Math.PI * 1.95);
      ctx.fill();
      break;
    default:
      ctx.beginPath();
      ctx.ellipse(CENTER_X, geo.headCenterY - r * 0.6, r * 1.02, r * 0.45, 0, Math.PI, Math.PI * 2);
      ctx.fill();
  }
}

function drawMask(ctx: CanvasRenderingContext2D, geo: Geometry, appearance: Appearance) {
  if (appearance.mask === 0) return;
  const primary = attireColor((appearance.mask * 3) % 20);
  const trim = attireColor(appearance.secondaryColor);
  const r = geo.headRadius;

  ctx.fillStyle = primary;
  ctx.beginPath();
  ctx.ellipse(CENTER_X, geo.headCenterY, r * 1.08, r * 1.05, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = trim;
  ctx.fillRect(CENTER_X - r, geo.headCenterY - 0.4, r * 2, 0.8);
  ctx.fillRect(CENTER_X - 0.5, geo.headTop - 0.5, 1, r * 2.2);

  ctx.fillStyle = '#0a0a0a';
  ctx.beginPath();
  ctx.ellipse(CENTER_X - r * 0.4, geo.headCenterY, 0.9, 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(CENTER_X + r * 0.4, geo.headCenterY, 0.9, 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawGlasses(ctx: CanvasRenderingContext2D, geo: Geometry, appearance: Appearance) {
  if (appearance.glasses === 0) return;
  const r = geo.headRadius;
  ctx.fillStyle = 'rgba(10,10,15,0.85)';
  ctx.fillRect(CENTER_X - r * 0.65, geo.headCenterY - 0.3, r * 1.3, 1);
}

/**
 * Draw a wrestler's full-body sprite into `ctx` at the fixed GRID_W x GRID_H
 * internal resolution. Caller owns sizing/scaling — see PaperDoll.tsx.
 */
export function drawPaperDoll(ctx: CanvasRenderingContext2D, appearance: Appearance): void {
  ctx.clearRect(0, 0, GRID_W, GRID_H);
  ctx.imageSmoothingEnabled = false;

  const geo = computeGeometry(appearance);

  drawShadow(ctx, geo); // 1
  drawArm(ctx, geo, 'rear', appearance); // 2
  drawLegs(ctx, geo, appearance); // 3
  drawTorso(ctx, geo, appearance); // 4
  drawArm(ctx, geo, 'front', appearance); // 5
  drawHead(ctx, geo, appearance); // 6
  drawFacialHair(ctx, geo, appearance); // 7
  drawHair(ctx, geo, appearance); // 8
  drawMask(ctx, geo, appearance); // 9
  drawGlasses(ctx, geo, appearance); // 10 (headwear accessory)
  // 11: championship belt — drawn by callers that know title state (M3+), not here.
}

/** Vertical crop window (in grid units, as a fraction of GRID_H) used by the `bust` and `thumb` PaperDoll sizes. */
export function bustCropWindow(): { y: number; height: number } {
  return { y: 0, height: Math.round(GRID_H * 0.42) };
}
