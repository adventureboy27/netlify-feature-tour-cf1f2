// Shared draw primitives for every paper-doll part: hard-edged two-tone
// "cel shading" plus a bold ink outline on every silhouette, rather than a
// soft alpha gradient — this pairing is what actually reads as a
// Genesis/16-bit sports-game sprite instead of flat modern vector art.

import { shadeColor, OUTLINE_COLOR } from './palette';

export const OUTLINE_WIDTH = 0.9;

export function taperedQuad(topX: number, topY: number, topW: number, botX: number, botY: number, botW: number): Path2D {
  const p = new Path2D();
  p.moveTo(topX - topW / 2, topY);
  p.lineTo(topX + topW / 2, topY);
  p.lineTo(botX + botW / 2, botY);
  p.lineTo(botX - botW / 2, botY);
  p.closePath();
  return p;
}

export interface ShadeBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Fill `path` with a hard-edged two-tone shade (a darker band on the right
 * ~45%, a lighter sliver on the left ~20%, both solid colors rather than
 * alpha blends) then stroke its silhouette in near-black ink.
 */
export function fillShaded(ctx: CanvasRenderingContext2D, path: Path2D, color: string, bounds: ShadeBounds): void {
  ctx.fillStyle = color;
  ctx.fill(path);

  ctx.save();
  ctx.clip(path);
  ctx.fillStyle = shadeColor(color, -32);
  ctx.fillRect(bounds.x + bounds.w * 0.55, bounds.y, bounds.w * 0.45, bounds.h);
  ctx.fillStyle = shadeColor(color, 22);
  ctx.fillRect(bounds.x, bounds.y, bounds.w * 0.2, bounds.h);
  ctx.restore();

  ctx.lineWidth = OUTLINE_WIDTH;
  ctx.strokeStyle = OUTLINE_COLOR;
  ctx.stroke(path);
}

/** Same two-tone + outline treatment for an ellipse/arc (heads, hair caps, hands, masks). */
export function fillShadedEllipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string,
  startAngle = 0,
  endAngle = Math.PI * 2,
): void {
  const path = new Path2D();
  path.ellipse(cx, cy, rx, ry, 0, startAngle, endAngle);
  if (endAngle - startAngle < Math.PI * 2 - 0.01) path.closePath();

  ctx.fillStyle = color;
  ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  ctx.fillStyle = shadeColor(color, -32);
  ctx.fillRect(cx, cy - ry, rx * 1.5, ry * 2);
  ctx.fillStyle = shadeColor(color, 22);
  ctx.fillRect(cx - rx * 1.5, cy - ry, rx * 0.6, ry * 2);
  ctx.restore();

  ctx.lineWidth = OUTLINE_WIDTH;
  ctx.strokeStyle = OUTLINE_COLOR;
  ctx.stroke(path);
}
