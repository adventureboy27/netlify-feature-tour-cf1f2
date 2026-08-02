// Head — the "head" part. Bundles §7 layers 6-10 (neck/head/face, facial
// hair, hair, mask, headwear accessory) since they're all drawn onto the
// same head silhouette and always paint in that fixed sub-order regardless
// of what's mixed in below the neck.

import type { Appearance } from '../../../engine/types';
import type { Geometry } from '../skeleton';
import { CENTER_X } from '../skeleton';
import { fillShadedEllipse, OUTLINE_WIDTH } from '../shapes';
import { skinToneColor, hairColorValue, attireColor, shadeColor, OUTLINE_COLOR } from '../palette';

function drawFace(ctx: CanvasRenderingContext2D, geo: Geometry, appearance: Appearance) {
  const skin = skinToneColor(appearance.skinTone);
  const shape = appearance.faceShape % 4; // 0 round, 1 square, 2 oval, 3 broad
  const radiusScale = [1, 0.96, 0.92, 1.08][shape]!;
  const rx = geo.headRadius * radiusScale;
  const ry = geo.headRadius * (shape === 2 ? 1.12 : 1);

  // neck (drawn first so the head silhouette + outline sits cleanly on top)
  ctx.fillStyle = skin;
  ctx.fillRect(CENTER_X - 1.2, geo.headBottom - 0.5, 2.4, geo.neckY - geo.headBottom + 1.5);
  ctx.strokeStyle = OUTLINE_COLOR;
  ctx.lineWidth = OUTLINE_WIDTH * 0.7;
  ctx.strokeRect(CENTER_X - 1.2, geo.headBottom - 0.5, 2.4, geo.neckY - geo.headBottom + 1.5);

  fillShadedEllipse(ctx, CENTER_X, geo.headCenterY, rx, ry, skin);

  // eyes + brows
  const eyeStyle = appearance.eyes % 3;
  const eyeY = geo.headCenterY + ry * 0.05;
  ctx.fillStyle = OUTLINE_COLOR;
  if (eyeStyle !== 2) {
    ctx.fillRect(CENTER_X - rx * 0.55, eyeY, 0.8, 0.7);
    ctx.fillRect(CENTER_X + rx * 0.15, eyeY, 0.8, 0.7);
    ctx.fillStyle = shadeColor(hairColorValue(appearance.hairColor), -10);
    ctx.fillRect(CENTER_X - rx * 0.6, eyeY - 0.9, 1, 0.5);
    ctx.fillRect(CENTER_X + rx * 0.1, eyeY - 0.9, 1, 0.5);
  } else {
    // narrow/intense eyes: a single connected brow line
    ctx.fillRect(CENTER_X - rx * 0.6, eyeY, rx * 1.2, 0.5);
  }

  // nose + mouth for a bit of dimension
  ctx.fillStyle = shadeColor(skin, -22);
  ctx.fillRect(CENTER_X - 0.3, eyeY + 0.8, 0.6, 1.6);
  ctx.fillStyle = shadeColor(skin, -38);
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
  const r = geo.headRadius;
  switch (style) {
    case 1: // crew cut
      fillShadedEllipse(ctx, CENTER_X, geo.headCenterY - r * 0.55, r * 1.02, r * 0.55, color, Math.PI, Math.PI * 2);
      break;
    case 2: // mohawk
      ctx.fillStyle = color;
      ctx.fillRect(CENTER_X - 0.6, geo.headTop - 2, 1.2, r * 1.6);
      ctx.strokeStyle = OUTLINE_COLOR;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(CENTER_X - 0.6, geo.headTop - 2, 1.2, r * 1.6);
      break;
    case 3: // long / flowing
      fillShadedEllipse(ctx, CENTER_X, geo.headCenterY - r * 0.6, r * 1.05, r * 0.6, color, Math.PI, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fillRect(CENTER_X - r * 1.05, geo.headCenterY - r * 0.2, 1.6, r * 1.8);
      ctx.fillRect(CENTER_X + r * 1.05 - 1.6, geo.headCenterY - r * 0.2, 1.6, r * 1.8);
      break;
    case 4: // ponytail
      fillShadedEllipse(ctx, CENTER_X, geo.headCenterY - r * 0.55, r * 1.02, r * 0.55, color, Math.PI, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fillRect(CENTER_X + r * 0.9, geo.headCenterY - r * 0.3, 1.4, r * 1.6);
      break;
    case 5: // afro
      fillShadedEllipse(ctx, CENTER_X, geo.headCenterY - r * 0.3, r * 1.35, r * 1.25, color);
      fillShadedEllipse(ctx, CENTER_X, geo.headCenterY, geo.headRadius, geo.headRadius, skinToneColor(appearance.skinTone));
      break;
    default:
      fillShadedEllipse(ctx, CENTER_X, geo.headCenterY - r * 0.6, r * 1.02, r * 0.45, color, Math.PI, Math.PI * 2);
  }
}

function drawMask(ctx: CanvasRenderingContext2D, geo: Geometry, appearance: Appearance) {
  if (appearance.mask === 0) return;
  const primary = attireColor((appearance.mask * 3) % 20);
  const trim = attireColor(appearance.secondaryColor);
  const r = geo.headRadius;

  fillShadedEllipse(ctx, CENTER_X, geo.headCenterY, r * 1.08, r * 1.05, primary);

  ctx.fillStyle = trim;
  ctx.fillRect(CENTER_X - r, geo.headCenterY - 0.4, r * 2, 0.8);
  ctx.fillRect(CENTER_X - 0.5, geo.headTop - 0.5, 1, r * 2.2);

  ctx.fillStyle = OUTLINE_COLOR;
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

export function drawHeadPart(ctx: CanvasRenderingContext2D, geo: Geometry, appearance: Appearance): void {
  drawFace(ctx, geo, appearance); // 6
  drawFacialHair(ctx, geo, appearance); // 7
  drawHair(ctx, geo, appearance); // 8
  drawMask(ctx, geo, appearance); // 9
  drawGlasses(ctx, geo, appearance); // 10 (headwear accessory)
}
