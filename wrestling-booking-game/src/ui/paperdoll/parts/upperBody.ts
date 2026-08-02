// Arms + torso — the "upper body" part. `gender` isn't part of Appearance
// (it's a separate Wrestler field per §3) but the shirtless/sports-bra
// branch of attireTop style 0 needs it, so it's threaded in here rather
// than guessed from any trait.
//
// Two entry points: `drawArm` (called once per side, interleaved around the
// legs+waist and torso so the rear arm sits behind them and the front arm
// sits in front — §7's layer order) and `drawTorso`.

import type { Appearance } from '../../../engine/types';
import type { Geometry } from '../skeleton';
import { CENTER_X } from '../skeleton';
import { taperedQuad, fillShaded, fillShadedEllipse } from '../shapes';
import { skinToneColor, attireColor } from '../palette';

/** attireTop % 4 — 0 shirtless/sports-bra, 1 singlet, 2 tee, 3 jacket. */
export function topStyleOf(appearance: Appearance): number {
  return appearance.attireTop % 4;
}

export function drawArm(ctx: CanvasRenderingContext2D, geo: Geometry, side: 'rear' | 'front', appearance: Appearance): void {
  const sign = side === 'rear' ? -1 : 1;
  const skin = skinToneColor(appearance.skinTone);
  const topStyle = topStyleOf(appearance);
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

  const hasSleeve = topStyle >= 2; // tee/jacket cover the upper arm; shirtless/singlet don't
  fillShaded(ctx, upperArm, hasSleeve ? sleeveColor : skin, boundsUpper);
  fillShaded(ctx, forearm, skin, boundsFore);

  // hand
  fillShadedEllipse(ctx, wristX, wristY + 0.8, geo.armWidth * 0.42, geo.armWidth * 0.5, skin);

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

export function drawTorso(ctx: CanvasRenderingContext2D, geo: Geometry, appearance: Appearance, gender: 'm' | 'f'): void {
  const topStyle = topStyleOf(appearance);
  const skin = skinToneColor(appearance.skinTone);
  const primary = attireColor(appearance.primaryColor);
  const bare = topStyle === 0;
  const torsoColor = bare ? skin : primary;

  const torso = taperedQuad(CENTER_X, geo.shoulderY, geo.shoulderWidth, CENTER_X, geo.waistY, geo.waistWidth);
  const bounds = { x: CENTER_X - geo.shoulderWidth / 2, y: geo.shoulderY, w: geo.shoulderWidth, h: geo.waistY - geo.shoulderY };
  fillShaded(ctx, torso, torsoColor, bounds);

  // pec/ab shading — a faint centerline + a chest line reads as musculature
  // at this resolution without needing real anatomy.
  ctx.save();
  ctx.clip(torso);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(CENTER_X - 0.35, geo.shoulderY, 0.7, geo.waistY - geo.shoulderY);
  ctx.fillRect(CENTER_X - geo.shoulderWidth / 2, geo.shoulderY + (geo.waistY - geo.shoulderY) * 0.32, geo.shoulderWidth, 0.5);
  ctx.restore();

  if (bare && gender === 'f') {
    // sports bra — a distinct band over the chest, bare midriff below it.
    const braColor = primary;
    const braTop = geo.shoulderY + (geo.waistY - geo.shoulderY) * 0.12;
    const braBottom = geo.shoulderY + (geo.waistY - geo.shoulderY) * 0.42;
    const bra = taperedQuad(CENTER_X, braTop, geo.shoulderWidth * 0.92, CENTER_X, braBottom, geo.shoulderWidth * 0.8);
    fillShaded(ctx, bra, braColor, { x: CENTER_X - geo.shoulderWidth / 2, y: braTop, w: geo.shoulderWidth, h: braBottom - braTop });
    ctx.fillStyle = attireColor(appearance.accentColor);
    ctx.fillRect(CENTER_X - geo.shoulderWidth * 0.46, geo.shoulderY, 1.1, braTop - geo.shoulderY + 1);
    ctx.fillRect(CENTER_X + geo.shoulderWidth * 0.36, geo.shoulderY, 1.1, braTop - geo.shoulderY + 1);
  }

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
}
