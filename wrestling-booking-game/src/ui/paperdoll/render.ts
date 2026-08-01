// Pixel-art paper-doll orchestrator, booking-game-design.md §7.
//
// §2's tech table says "Inline SVG components... no asset pipeline" for art,
// but §7 (later in the document, and specifically about this system) calls
// for sprites "rendered to a canvas at a low internal resolution and scaled
// with nearest-neighbor," and the §2 performance budget itself says to
// "render sprites to cached canvases once and reuse the bitmaps." Per §0,
// "the later section wins" — this renders to canvas, not SVG. Flagging per
// the working agreement.
//
// This file only sequences the paint order; the actual shapes live in
// parts/{shoes,lowerBody,upperBody,head}.ts, each an independently
// swappable "piece" (shared skeleton in skeleton.ts, shared draw
// primitives — hard two-tone shading + ink outlines, the Genesis/16-bit
// look — in shapes.ts). A part is called at whichever point in the
// sequence its z-order requires; legs+waist in particular has two entry
// points (drawLegsBase before the torso, drawHipGarment after it) so
// trunks/shorts sit on top of the torso's bottom edge instead of being
// painted over by it.
//
// DESIGN: hand-authored art for all 24 hair styles, 12 masks, etc. would be
// its own large content project. Each part draws a small procedural kit of
// silhouettes (picked by `trait % variantCount`) so every documented index
// is renderable and every wrestler is recolored independently — every color
// slot (skin tone, hair color, primary/secondary/accent) already maps 1:1
// to the full range in Appearance, so distinct wrestlers really do look
// distinct today. Growing the shape vocabulary itself is future art-content
// work, the same way §0 treats name/gimmick lists as ongoing content rather
// than an M0/M1 blocker.

import type { Appearance } from '../../engine/types';
import { GRID_W, GRID_H, CENTER_X, computeGeometry } from './skeleton';
import { drawShoes } from './parts/shoes';
import { drawLegsBase, drawHipGarment } from './parts/lowerBody';
import { drawArm, drawTorso } from './parts/upperBody';
import { drawHeadPart } from './parts/head';

export { GRID_W, GRID_H };

function drawShadow(ctx: CanvasRenderingContext2D, shoulderWidth: number, footY: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(CENTER_X, footY + 0.5, shoulderWidth * 0.55, 1.3, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draw a wrestler's full-body sprite into `ctx` at the fixed GRID_W x GRID_H
 * internal resolution. Caller owns sizing/scaling — see PaperDoll.tsx.
 * `gender` isn't part of Appearance (it's a separate Wrestler field per §3)
 * but the upper-body part's shirtless/sports-bra branch needs it.
 */
export function drawPaperDoll(ctx: CanvasRenderingContext2D, appearance: Appearance, gender: 'm' | 'f'): void {
  ctx.clearRect(0, 0, GRID_W, GRID_H);
  ctx.imageSmoothingEnabled = false;

  const geo = computeGeometry(appearance);

  drawShadow(ctx, geo.shoulderWidth, geo.footY); // 1
  drawArm(ctx, geo, 'rear', appearance); // 2
  drawLegsBase(ctx, geo, appearance); // 3 (legs)
  drawShoes(ctx, geo, appearance); // 3 (boots)
  drawTorso(ctx, geo, appearance, gender); // 4
  drawHipGarment(ctx, geo, appearance); // 4 (trunks/shorts sit on top of the torso's hem)
  drawArm(ctx, geo, 'front', appearance); // 5
  drawHeadPart(ctx, geo, appearance); // 6-10
  // 11: championship belt — drawn by callers that know title state (M3+), not here.
}

/** Vertical crop window (in grid units, as a fraction of GRID_H) used by the `bust` and `thumb` PaperDoll sizes. */
export function bustCropWindow(): { y: number; height: number } {
  return { y: 0, height: Math.round(GRID_H * 0.42) };
}
