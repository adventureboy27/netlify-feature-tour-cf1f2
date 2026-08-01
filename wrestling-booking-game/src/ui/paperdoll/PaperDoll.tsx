// <PaperDoll size="full|bust|thumb" /> — §7 "Requirements".
import { useEffect, useRef } from 'react';
import type { Appearance } from '../../engine/types';
import { getSourceCanvas } from './spriteCache';
import { GRID_W, GRID_H, bustCropWindow } from './render';
import { ALIGNMENT_FILTER, alignmentBucket } from './palette';

export type PaperDollSize = 'full' | 'bust' | 'thumb';

interface SizeSpec {
  displayWidth: number;
  displayHeight: number;
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
}

const BUST_CROP_X = Math.round(GRID_W * 0.17);
const BUST_CROP_WIDTH = GRID_W - BUST_CROP_X * 2;

function sizeSpec(size: PaperDollSize): SizeSpec {
  if (size === 'full') {
    // GRID_W:GRID_H is 2:3 — keep the display box at the same aspect ratio.
    return { displayWidth: 96, displayHeight: Math.round((96 * GRID_H) / GRID_W), sourceX: 0, sourceY: 0, sourceWidth: GRID_W, sourceHeight: GRID_H };
  }
  const crop = bustCropWindow();
  const source = { sourceX: BUST_CROP_X, sourceY: crop.y, sourceWidth: BUST_CROP_WIDTH, sourceHeight: crop.height };
  if (size === 'bust') {
    return { displayWidth: 96, displayHeight: 96, ...source };
  }
  // thumb — must stay legible at 48px, §7.
  return { displayWidth: 48, displayHeight: 48, ...source };
}

export interface PaperDollProps {
  appearance: Appearance;
  gender: 'm' | 'f'; // not part of Appearance (§3) but the upper-body part needs it
  alignment: number; // -100..100, drives the heel/face palette shift (§7)
  size: PaperDollSize;
  className?: string;
}

export function PaperDoll({ appearance, gender, alignment, size, className }: PaperDollProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spec = sizeSpec(size);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const source = getSourceCanvas(appearance, gender);
    ctx.drawImage(
      source,
      spec.sourceX,
      spec.sourceY,
      spec.sourceWidth,
      spec.sourceHeight,
      0,
      0,
      spec.displayWidth,
      spec.displayHeight,
    );
  }, [appearance, gender, spec.sourceX, spec.sourceY, spec.sourceWidth, spec.sourceHeight, spec.displayWidth, spec.displayHeight]);

  return (
    <canvas
      ref={canvasRef}
      width={spec.displayWidth}
      height={spec.displayHeight}
      className={className}
      style={{
        width: spec.displayWidth,
        height: spec.displayHeight,
        imageRendering: 'pixelated',
        filter: ALIGNMENT_FILTER[alignmentBucket(alignment)],
      }}
    />
  );
}
