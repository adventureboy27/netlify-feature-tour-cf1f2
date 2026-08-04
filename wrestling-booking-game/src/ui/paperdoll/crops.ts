// Which window of the 64x96 frame each <PaperDoll size> shows, and how big
// it draws on screen.
//
// Display sizes are integer multiples of the source crop wherever the layout
// allows it — nearest-neighbour upscaling only stays crisp at whole-number
// scales, and §7 is explicit that staying sharp is the point.

import { FRAME_W, FRAME_H } from './atlas/manifest';

export type PaperDollSize = 'full' | 'bust' | 'thumb';

export interface CropSpec {
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  displayWidth: number;
  displayHeight: number;
}

// Head and shoulders. Wide enough for the afro and ponytail cells (which
// overhang the skull box) and for the deltoids at the frame's widest, x 18-46.
const BUST_CROP = { sourceX: 12, sourceY: 0, sourceWidth: 40, sourceHeight: 40 };

const SPECS: Record<PaperDollSize, CropSpec> = {
  full: {
    sourceX: 0,
    sourceY: 0,
    sourceWidth: FRAME_W,
    sourceHeight: FRAME_H,
    displayWidth: FRAME_W * 2,
    displayHeight: FRAME_H * 2,
  },
  bust: { ...BUST_CROP, displayWidth: 80, displayHeight: 80 }, // 2x
  // §7: "must stay legible at 48px". 40 -> 48 is the one non-integer scale
  // here; at thumb size the uneven pixel doubling is not readable, and
  // matching the documented 48px matters more.
  thumb: { ...BUST_CROP, displayWidth: 48, displayHeight: 48 },
};

export function cropSpec(size: PaperDollSize): CropSpec {
  return SPECS[size];
}
