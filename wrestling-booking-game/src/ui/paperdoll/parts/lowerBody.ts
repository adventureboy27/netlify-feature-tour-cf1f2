// Legs + waist — the "legs and waist" part. Bundled together (rather than
// legs alone) because the hip garment dictates whether the legs read as
// bare skin or covered fabric: trunks/shorts leave the leg bare below the
// hem, tights/pants cover the whole leg. Splitting those into unrelated
// modules would just force them to import each other's state back out.
//
// Two entry points, not one: `drawLegsBase` paints before the torso (§7
// layer 3, so the torso's tapered bottom edge sits correctly in front of
// the hip) and `drawHipGarment` paints after it (so trunks/shorts sit on
// top of the torso's bottom edge instead of being painted over by it).
// The orchestrator in render.ts calls them at the right points; from a
// mix-and-match standpoint they're still one interchangeable "part."

import type { Appearance } from '../../../engine/types';
import type { Geometry } from '../skeleton';
import { CENTER_X, legColumnX, KNEE_FRACTION } from '../skeleton';
import { taperedQuad, fillShaded } from '../shapes';
import { skinToneColor, attireColor, shadeColor } from '../palette';

/**
 * attireBottom % 4 — 0 trunks (brief, above mid-thigh), 1 shorts (looser,
 * down to knee), 2 tights (full leg, skin-tight), 3 pants (full leg,
 * looser silhouette + cuff). Trunks/shorts leave bare skin below the hem;
 * tights/pants cover the whole leg.
 */
export function bottomStyleOf(appearance: Appearance): number {
  return appearance.attireBottom % 4;
}

function isBareLegStyle(bottomStyle: number): boolean {
  return bottomStyle === 0 || bottomStyle === 1;
}

export function drawLegsBase(ctx: CanvasRenderingContext2D, geo: Geometry, appearance: Appearance): void {
  const bottomStyle = bottomStyleOf(appearance);
  const bareLegs = isBareLegStyle(bottomStyle);
  const skin = skinToneColor(appearance.skinTone);
  const coveredColor = attireColor(appearance.secondaryColor);
  const kneeY = geo.hipY + (geo.ankleY - geo.hipY) * KNEE_FRACTION;

  for (const sign of [-1, 1] as const) {
    const { hipX, ankleX } = legColumnX(geo, sign);
    const kneeX = ankleX;

    const thigh = taperedQuad(hipX, geo.hipY, geo.thighWidth, kneeX, kneeY, geo.calfWidth * 1.15);
    const calf = taperedQuad(kneeX, kneeY, geo.calfWidth * 1.05, ankleX, geo.ankleY, geo.calfWidth * 0.8);
    const boundsThigh = { x: Math.min(hipX, kneeX) - geo.thighWidth, y: geo.hipY, w: geo.thighWidth * 2, h: kneeY - geo.hipY };
    const boundsCalf = { x: ankleX - geo.calfWidth, y: kneeY, w: geo.calfWidth * 2, h: geo.ankleY - kneeY };

    fillShaded(ctx, thigh, bareLegs ? skin : coveredColor, boundsThigh);
    fillShaded(ctx, calf, bareLegs ? skin : coveredColor, boundsCalf);

    if (!bareLegs && bottomStyle === 3) {
      // pants: a cuff line at the hip distinguishes them from skin-tight tights
      ctx.fillStyle = shadeColor(coveredColor, -20);
      ctx.fillRect(Math.round(hipX - geo.thighWidth / 2), Math.round(geo.hipY), Math.round(geo.thighWidth), 0.7);
    }
  }
}

export function drawHipGarment(ctx: CanvasRenderingContext2D, geo: Geometry, appearance: Appearance): void {
  const bottomStyle = bottomStyleOf(appearance);
  const hipGarmentColor = attireColor(appearance.primaryColor);
  const trunksTop = geo.waistY - 1.5;

  if (bottomStyle === 0 || bottomStyle === 1) {
    // shorts (style 1) run down to mid-thigh; trunks (style 0) stop at the hip.
    const hemY = bottomStyle === 1 ? geo.hipY + (geo.ankleY - geo.hipY) * 0.32 : geo.hipY + 1.6;
    const hemWidth = bottomStyle === 1 ? geo.waistWidth * 0.6 : 1.2;

    const garment = new Path2D();
    garment.moveTo(CENTER_X - geo.waistWidth / 2 - 0.8, trunksTop);
    garment.lineTo(CENTER_X + geo.waistWidth / 2 + 0.8, trunksTop);
    garment.lineTo(CENTER_X + geo.waistWidth / 2 + 1.2, geo.hipY);
    garment.lineTo(CENTER_X + hemWidth, hemY);
    garment.lineTo(CENTER_X, geo.hipY + 0.6);
    garment.lineTo(CENTER_X - hemWidth, hemY);
    garment.lineTo(CENTER_X - geo.waistWidth / 2 - 1.2, geo.hipY);
    garment.closePath();
    fillShaded(ctx, garment, hipGarmentColor, { x: CENTER_X - geo.waistWidth / 2 - 1.2, y: trunksTop, w: geo.waistWidth + 2.4, h: hemY - trunksTop });

    ctx.fillStyle = attireColor(appearance.secondaryColor);
    ctx.fillRect(CENTER_X - geo.waistWidth / 2 - 0.8, trunksTop, geo.waistWidth + 1.6, 0.6);

    if (bottomStyle === 1) {
      // side stripe reads as athletic shorts rather than briefs
      ctx.fillStyle = attireColor(appearance.accentColor);
      ctx.fillRect(CENTER_X - geo.waistWidth / 2 - 0.6, trunksTop + 1, 0.8, hemY - trunksTop - 1);
      ctx.fillRect(CENTER_X + geo.waistWidth / 2 - 0.2, trunksTop + 1, 0.8, hemY - trunksTop - 1);
    }
  } else {
    // tights/pants: just a waistband — the legs themselves are covered by drawLegsBase.
    ctx.fillStyle = shadeColor(hipGarmentColor, -10);
    ctx.fillRect(CENTER_X - geo.waistWidth / 2 - 0.8, trunksTop, geo.waistWidth + 1.6, 2);
  }
}
