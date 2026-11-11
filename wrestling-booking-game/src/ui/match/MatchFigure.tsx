// A wrestler, head to boots, for the match viewer.
//
// The portrait art stops at the waist — right for a card, useless for a
// body slam. This stands the same composited portrait on a pair of drawn
// legs (trunks, kneepads, boots) in the wrestler's own skin tone and gear
// color, so the whole figure can be lifted, tipped and dropped as one piece.

import { memo } from 'react';
import { assignLook, lookSubjectOf } from '../paperdoll/assignLook';
import { ComposedPortrait } from '../paperdoll/ComposedPortrait';
import type { Wrestler } from '../../engine/types';

/** Figure height as a multiple of its width: a square portrait plus the legs. */
export const FIGURE_ASPECT = 1.81;

function Legs({ skin, trunks, female }: { skin: string; trunks: string; female: boolean }) {
  const boot = '#15151a';
  // Half a pair, mirrored. 100 wide to match the portrait box above it.
  const leg = (
    <>
      <path d="M 30,14 L 49.6,20 L 47,46 L 32.5,46 Z" fill={skin} />
      <path d="M 31.5,41 L 47.6,41 L 47,53 L 32.5,53 Z" fill="#1c1c22" />
      <path d="M 33,53 L 46.6,53 L 46,58 L 33.6,58 Z" fill={skin} />
      <path d="M 33,56 L 46.8,56 L 46,78 L 46.5,84 L 26.5,84 C 26,80 29.5,78.5 33.8,78 Z" fill={boot} />
      <path d="M 33,56 L 46.8,56 L 46.6,60 L 33.2,60 Z" fill={trunks} />
      <path d="M 44,20 L 49.6,20 L 47,46 L 44.5,46 Z" fill="#000" opacity={0.18} />
    </>
  );
  return (
    <svg viewBox="0 0 100 84" className="block w-full" style={{ marginTop: '-3.5%' }} aria-hidden>
      {leg}
      <g transform="translate(100 0) scale(-1 1)">{leg}</g>
      <path d={female ? 'M 32.5,0 L 67.5,0 L 70.5,14 L 54,23 L 50,18 L 46,23 L 29.5,14 Z' : 'M 31.5,0 L 68.5,0 L 70.5,16 L 52.5,24 L 50,20 L 47.5,24 L 29.5,16 Z'} fill={trunks} />
      <path d="M 32,0 L 68,0 L 68.4,4 L 31.6,4 Z" fill="#000" opacity={0.25} />
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
  const trunks = look.waistband?.color ?? look.top?.color ?? '#1d1d24';
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
      <Legs skin={look.skinColor} trunks={trunks} female={wrestler.gender === 'f'} />
    </div>
  );
});
