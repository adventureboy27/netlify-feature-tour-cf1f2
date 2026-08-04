// <PaperDoll size="full|bust|thumb" /> — §7 "Requirements".
//
// The sprite itself comes from the indexed atlas (atlas/); this component
// only decides which window of the frame to show, at what scale, and applies
// the container-level heel/face palette shift.
import { useEffect, useRef } from 'react';
import type { Appearance } from '../../engine/types';
import { getSourceCanvas } from './spriteCache';
import { cropSpec, type PaperDollSize } from './crops';
import { useAtlasSheets } from './useAtlasSheets';
import { ALIGNMENT_FILTER, alignmentBucket } from './palette';

export type { PaperDollSize };

export interface PaperDollProps {
  appearance: Appearance;
  gender: 'm' | 'f'; // not part of Appearance (§3); picks the atlas body frame
  alignment: number; // -100..100, drives the heel/face palette shift (§7)
  size: PaperDollSize;
  className?: string;
}

export function PaperDoll({ appearance, gender, alignment, size, className }: PaperDollProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sheets = useAtlasSheets();
  const spec = cropSpec(size);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sheets) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      getSourceCanvas(sheets, appearance, gender),
      spec.sourceX,
      spec.sourceY,
      spec.sourceWidth,
      spec.sourceHeight,
      0,
      0,
      spec.displayWidth,
      spec.displayHeight,
    );
  }, [sheets, appearance, gender, spec]);

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
