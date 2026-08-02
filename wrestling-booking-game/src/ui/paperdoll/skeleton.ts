// The shared "rig" every paper-doll part attaches to. Keeping this separate
// from the parts themselves is what makes them swappable independently —
// shoes/legs+waist/upper-body/head each read the joints they need off
// `Geometry` without depending on how any other part is drawn.

import type { Appearance } from '../../engine/types';

export const GRID_W = 32;
export const GRID_H = 48;
export const CENTER_X = GRID_W / 2;

// build: 0 slim, 1 athletic, 2 thick, 3 heavy, 4 massive, 5 tall
const SHOULDER_WIDTH = [13, 15, 18, 21, 24, 16];
const WAIST_WIDTH = [8, 9, 11, 13, 15, 9];
const ARM_WIDTH = [2.2, 2.6, 3.1, 3.6, 4.2, 2.6];
const THIGH_WIDTH = [3.8, 4.3, 5.2, 6.2, 7.2, 4.3];
const CALF_WIDTH = [2.8, 3.2, 3.8, 4.4, 5, 3.2];

export interface Geometry {
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

export function computeGeometry(appearance: Appearance): Geometry {
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

/** X position of a leg's knee/ankle column (shoes and legs+waist both need this to line up). */
export function legColumnX(geo: Geometry, sign: -1 | 1): { hipX: number; ankleX: number } {
  const gap = 1.1;
  return {
    hipX: CENTER_X + sign * (geo.thighWidth / 2 + gap / 2),
    ankleX: CENTER_X + sign * (geo.calfWidth / 2 + gap / 2 + 0.3),
  };
}

export const KNEE_FRACTION = 0.55; // knee sits 55% of the way from hip to ankle
