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
// DESIGN: full hand-authored art for all 24 hair styles, 12 masks, etc.
// would be its own large content project. This draws a small procedural kit
// of silhouettes (picked by `trait % variantCount`) so every documented
// index is renderable and every wrestler is recolored independently — every
// color slot (skin tone, hair color, primary/secondary/accent, 12-20 options
// each) already maps 1:1 to the full range in Appearance, so distinct
// wrestlers really do look distinct today. Growing the shape vocabulary
// itself is future art-content work, the same way §0 treats name/gimmick
// lists as ongoing content rather than an M0/M1 blocker.

import type { Appearance } from '../../engine/types';
import { skinToneColor, hairColorValue, attireColor } from './palette';

export const GRID_W = 24;
export const GRID_H = 32;

const CENTER_X = GRID_W / 2;

// build: 0 slim, 1 athletic, 2 thick, 3 heavy, 4 massive, 5 tall
const BUILD_TORSO_WIDTH = [4, 5, 6, 7, 8, 5];
const BUILD_LEG_WIDTH = [1.5, 2, 2.5, 3, 3.5, 2];

interface Geometry {
  torsoWidth: number;
  legWidth: number;
  headTop: number;
  headBottom: number;
  neckY: number;
  torsoTop: number;
  torsoBottom: number;
  legsBottom: number;
}

function computeGeometry(appearance: Appearance): Geometry {
  const torsoWidth = BUILD_TORSO_WIDTH[appearance.build % 6]!;
  const legWidth = BUILD_LEG_WIDTH[appearance.build % 6]!;
  const heightBoost = appearance.height + (appearance.build === 5 ? 2 : 0); // "tall" build adds extra length

  const headTop = 1;
  const headBottom = 7;
  const neckY = headBottom;
  const torsoTop = neckY + 1;
  const torsoBottom = torsoTop + 9 + Math.floor(heightBoost * 0.6);
  const legsBottom = torsoBottom + 11 + Math.floor(heightBoost * 0.6);

  return { torsoWidth, legWidth, headTop, headBottom, neckY, torsoTop, torsoBottom, legsBottom };
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function drawShadow(ctx: CanvasRenderingContext2D, geo: Geometry) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(CENTER_X, geo.legsBottom + 0.5, geo.torsoWidth * 0.9, 1.1, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawArm(ctx: CanvasRenderingContext2D, geo: Geometry, side: 'rear' | 'front', appearance: Appearance) {
  const armWidth = 2;
  const x = side === 'rear' ? CENTER_X - geo.torsoWidth / 2 - armWidth : CENTER_X + geo.torsoWidth / 2;
  const skin = skinToneColor(appearance.skinTone);
  const topStyle = appearance.attireTop % 4;
  const sleeveColor = attireColor(appearance.primaryColor);
  const armHeight = geo.torsoBottom - geo.torsoTop;

  if (topStyle >= 2) {
    // tee / jacket: sleeve covers the upper half of the arm
    rect(ctx, x, geo.torsoTop, armWidth, armHeight * 0.5, sleeveColor);
    rect(ctx, x, geo.torsoTop + armHeight * 0.5, armWidth, armHeight * 0.5, skin);
  } else {
    rect(ctx, x, geo.torsoTop, armWidth, armHeight, skin);
  }

  if (side === 'front' && appearance.accessory !== 0) {
    rect(ctx, x - 0.25, geo.torsoTop + armHeight * 0.4, armWidth + 0.5, 1.4, attireColor(appearance.accentColor));
  }

  if (side === 'front' && appearance.tattoos !== 0) {
    ctx.fillStyle = 'rgba(20,20,30,0.55)';
    const marks = (appearance.tattoos % 4) + 1;
    for (let i = 0; i < marks; i++) {
      ctx.fillRect(Math.round(x), Math.round(geo.torsoTop + 1 + i * 1.3), armWidth, 0.6);
    }
  }
}

function drawLegs(ctx: CanvasRenderingContext2D, geo: Geometry, appearance: Appearance) {
  const bottomStyle = appearance.attireBottom % 4;
  const legColor = bottomStyle === 0 ? skinToneColor(appearance.skinTone) : attireColor(appearance.secondaryColor);
  const shortsColor = attireColor(appearance.primaryColor);
  const gap = 0.6;
  const legX = [CENTER_X - geo.legWidth - gap / 2, CENTER_X + gap / 2];
  const legsHeight = geo.legsBottom - geo.torsoBottom;

  for (const x of legX) {
    rect(ctx, x, geo.torsoBottom, geo.legWidth, legsHeight, legColor);
    if (bottomStyle === 0) {
      // trunks: colored band over the top third only
      rect(ctx, x, geo.torsoBottom, geo.legWidth, legsHeight * 0.35, shortsColor);
    }
    // boots — last two rows of the leg
    const bootColor = appearance.boots % 2 === 0 ? attireColor(appearance.primaryColor) : attireColor(appearance.secondaryColor);
    const bootHeight = 1.5 + (appearance.boots % 3) * 0.5;
    rect(ctx, x - 0.2, geo.legsBottom - bootHeight, geo.legWidth + 0.4, bootHeight, bootColor);
  }
}

function drawTorso(ctx: CanvasRenderingContext2D, geo: Geometry, appearance: Appearance) {
  const topStyle = appearance.attireTop % 4;
  const skin = skinToneColor(appearance.skinTone);
  const primary = attireColor(appearance.primaryColor);
  const torsoHeight = geo.torsoBottom - geo.torsoTop;
  const x = CENTER_X - geo.torsoWidth / 2;

  rect(ctx, x, geo.torsoTop, geo.torsoWidth, torsoHeight, topStyle === 0 ? skin : primary);

  if (topStyle === 1) {
    // singlet straps
    rect(ctx, x + 0.5, geo.torsoTop, 1, torsoHeight * 0.25, attireColor(appearance.secondaryColor));
    rect(ctx, x + geo.torsoWidth - 1.5, geo.torsoTop, 1, torsoHeight * 0.25, attireColor(appearance.secondaryColor));
  }
  if (topStyle === 3) {
    // jacket: open front accent stripe
    rect(ctx, CENTER_X - 0.4, geo.torsoTop, 0.8, torsoHeight, attireColor(appearance.accentColor));
  }

  // DESIGN: `shirt` (§7 Appearance) isn't placed in §7's numbered layer list.
  // Treated as an optional overlay worn over the attire-top layer.
  if (appearance.shirt !== 0) {
    rect(ctx, x + 0.3, geo.torsoTop + 0.3, geo.torsoWidth - 0.6, torsoHeight * 0.7, attireColor(appearance.secondaryColor));
    rect(ctx, CENTER_X - 0.5, geo.torsoTop + torsoHeight * 0.25, 1, 1, attireColor(appearance.accentColor));
  }
}

function drawHead(ctx: CanvasRenderingContext2D, geo: Geometry, appearance: Appearance) {
  const skin = skinToneColor(appearance.skinTone);
  const shape = appearance.faceShape % 4; // 0 round, 1 square, 2 oval, 3 broad
  const widths = [3.4, 3.8, 3, 4.2];
  const headWidth = widths[shape]!;
  const x = CENTER_X - headWidth / 2;

  rect(ctx, CENTER_X - 0.6, geo.neckY - 0.5, 1.2, 1, skin); // neck
  rect(ctx, x, geo.headTop, headWidth, geo.headBottom - geo.headTop, skin);

  // eyes
  const eyeStyle = appearance.eyes % 3;
  ctx.fillStyle = '#1a1a1a';
  const eyeY = geo.headTop + (geo.headBottom - geo.headTop) * 0.5;
  if (eyeStyle !== 2) {
    ctx.fillRect(Math.round(x + headWidth * 0.25), Math.round(eyeY), 0.6, 0.6);
    ctx.fillRect(Math.round(x + headWidth * 0.65), Math.round(eyeY), 0.6, 0.6);
  } else {
    // narrow/intense eyes: a single connected brow line
    ctx.fillRect(Math.round(x + headWidth * 0.2), Math.round(eyeY), headWidth * 0.6, 0.4);
  }
}

function drawFacialHair(ctx: CanvasRenderingContext2D, geo: Geometry, appearance: Appearance) {
  if (appearance.facialHair === 0) return;
  const style = appearance.facialHair % 4; // 1 mustache, 2 goatee, 3 full beard
  const color = hairColorValue(appearance.hairColor);
  const jawY = geo.headBottom - 1.5;
  if (style === 1) rect(ctx, CENTER_X - 1, jawY, 2, 0.6, color);
  if (style === 2) rect(ctx, CENTER_X - 0.7, jawY, 1.4, 1.4, color);
  if (style === 3) rect(ctx, CENTER_X - 2, jawY - 1, 4, 2.5, color);
}

function drawHair(ctx: CanvasRenderingContext2D, geo: Geometry, appearance: Appearance) {
  if (appearance.hairStyle === 0 || appearance.mask !== 0) return; // 0 = bald; suppressed under a mask, §7
  const style = appearance.hairStyle % 6;
  const color = hairColorValue(appearance.hairColor);
  const top = geo.headTop - 0.5;
  switch (style) {
    case 1: // crew cut
      rect(ctx, CENTER_X - 2, top, 4, 1.2, color);
      break;
    case 2: // mohawk
      rect(ctx, CENTER_X - 0.5, top - 1, 1, 2.5, color);
      break;
    case 3: // long / flowing
      rect(ctx, CENTER_X - 2.2, top, 4.4, 1, color);
      rect(ctx, CENTER_X - 2.2, geo.headTop, 1, 4, color);
      rect(ctx, CENTER_X + 1.2, geo.headTop, 1, 4, color);
      break;
    case 4: // ponytail
      rect(ctx, CENTER_X - 2, top, 4, 1.2, color);
      rect(ctx, CENTER_X + 1.8, geo.headTop, 0.8, 3, color);
      break;
    case 5: // afro
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(CENTER_X, geo.headTop + 0.5, 2.6, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    default:
      rect(ctx, CENTER_X - 2, top, 4, 0.8, color);
  }
}

function drawMask(ctx: CanvasRenderingContext2D, geo: Geometry, appearance: Appearance) {
  if (appearance.mask === 0) return;
  const primary = attireColor((appearance.mask * 3) % 20);
  const trim = attireColor(appearance.secondaryColor);
  const headHeight = geo.headBottom - geo.headTop;
  rect(ctx, CENTER_X - 2, geo.headTop - 0.3, 4, headHeight + 0.6, primary);
  rect(ctx, CENTER_X - 2, geo.headTop + headHeight * 0.4, 4, 0.6, trim);
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(Math.round(CENTER_X - 1.3), Math.round(geo.headTop + headHeight * 0.45), 0.7, 0.5);
  ctx.fillRect(Math.round(CENTER_X + 0.6), Math.round(geo.headTop + headHeight * 0.45), 0.7, 0.5);
}

function drawGlasses(ctx: CanvasRenderingContext2D, geo: Geometry, appearance: Appearance) {
  if (appearance.glasses === 0) return;
  const headHeight = geo.headBottom - geo.headTop;
  rect(ctx, CENTER_X - 1.6, geo.headTop + headHeight * 0.42, 3.2, 0.7, 'rgba(10,10,15,0.85)');
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

/** Vertical crop window (in grid units) used by the `bust` and `thumb` PaperDoll sizes. */
export function bustCropWindow(): { y: number; height: number } {
  return { y: 0, height: 12 };
}
