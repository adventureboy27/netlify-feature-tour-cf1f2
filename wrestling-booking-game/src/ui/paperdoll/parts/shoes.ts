// Shoes/boots — the "shoes" part. Drawn after legs+waist, layer 3 (§7:
// legs -> tights/pants -> boots are all one numbered layer in the spec;
// boots are their own module here so a future alternate boot style can be
// swapped in without touching leg or hip-garment code).

import type { Appearance } from '../../../engine/types';
import type { Geometry } from '../skeleton';
import { legColumnX } from '../skeleton';
import { fillShaded } from '../shapes';
import { attireColor, shadeColor, OUTLINE_COLOR } from '../palette';

export function drawShoes(ctx: CanvasRenderingContext2D, geo: Geometry, appearance: Appearance): void {
  for (const sign of [-1, 1] as const) {
    const { ankleX } = legColumnX(geo, sign);
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

    // laces
    ctx.fillStyle = OUTLINE_COLOR;
    ctx.fillRect(Math.round(ankleX - geo.calfWidth * 0.4), Math.round(bootTop + 1), Math.round(geo.calfWidth * 0.8), 0.5);
    ctx.fillStyle = shadeColor(bootColor, -45);
    ctx.fillRect(Math.round(ankleX - geo.calfWidth * 0.4), Math.round(bootTop + 2.2), Math.round(geo.calfWidth * 0.8), 0.5);
  }
}
