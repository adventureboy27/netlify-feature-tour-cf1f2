// A wrestler, head to boots, for the match viewer.
//
// The portrait art stops at the waist — right for a card, useless for a
// body slam. This stands the same composited portrait on a pair of drawn
// legs (trunks, kneepads, boots) in the wrestler's own skin tone and gear
// color, so the whole figure can be lifted, tipped and dropped as one piece.

import { memo } from 'react';
import { assignLook, lookSubjectOf } from '../paperdoll/assignLook';
import { ComposedPortrait } from '../paperdoll/ComposedPortrait';
import { Pelvis, Shin, Thigh, legwearOf, type Legwear } from './legwear';
import type { Wrestler } from '../../engine/types';

/**
 * How big to draw somebody, from their recorded height: six foot is 1, and
 * the roster's range (five foot to seven) runs from a little under 0.9 to a
 * little over 1.1. Enough that a giant looks like one next to a cruiserweight,
 * not so much that the moves — written for one size of body — stop meeting.
 */
export const heightScale = (wrestler: Pick<Wrestler, 'heightIn'>) => Math.min(1.15, Math.max(0.88, 1 + (wrestler.heightIn - 72) * 0.012));

/** Figure height as a multiple of its width: a square portrait plus the legs. */
export const FIGURE_ASPECT = 1.81;

function Legs({ skin, gear, female }: { skin: string; gear: Legwear; female: boolean }) {
  // 100 wide to match the portrait box above it. Mirrored by coordinate, the
  // same way the jointed figure does it, so both draw the identical leg.
  const left = (x: number) => x;
  const right = (x: number) => 100 - x;
  return (
    <svg viewBox="0 0 100 84" className="block w-full" style={{ marginTop: '-3.5%' }} aria-hidden>
      {[left, right].map((m, n) => (
        <g key={n}>
          <Shin m={m} skin={skin} gear={gear} />
          <Thigh m={m} skin={skin} gear={gear} />
        </g>
      ))}
      <Pelvis female={female} gear={gear} />
    </svg>
  );
}

export const MatchFigure = memo(function MatchFigure({ wrestler }: { wrestler: Wrestler }) {
  const subject = lookSubjectOf(wrestler);
  const look = subject ? assignLook(subject) : null;
  if (!look) {
    // No base art for this person at all: a plain block figure, so the
    // choreography still has something to move.
    return (
      <div className="w-full" style={{ aspectRatio: `1 / ${FIGURE_ASPECT}` }}>
        <div className="mx-auto h-full w-1/2 rounded-t-full bg-neutral-600" />
      </div>
    );
  }
  const gear = legwearOf(subject!, look);
  return (
    <div className="w-full select-none" style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.55))' }}>
      <div className="relative aspect-square w-full">
        <ComposedPortrait look={look} alt={wrestler.name} />
        {wrestler.photoDataUrl && (
          // An uploaded photo is the player's own choice of face; wear it.
          <img
            src={wrestler.photoDataUrl}
            alt=""
            className="absolute rounded-full border border-black/60 object-cover"
            style={{ left: '38%', top: '13.5%', width: '24%', height: '24%' }}
          />
        )}
      </div>
      <Legs skin={look.skinColor} gear={gear} female={wrestler.gender === 'f'} />
    </div>
  );
});
