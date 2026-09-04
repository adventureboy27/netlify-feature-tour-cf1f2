// Stacks a wrestler's assigned look into one picture: base body, tinted to
// their skin tone, then hair, then facial hair, then a prop — in that order,
// each layer a plain <img> filling the same square frame. Every layer is
// expected to share one canvas size and head position (see assets/README.md)
// so stacking them takes no per-asset alignment logic at all.
//
// The skin tone is not separate art. A flat-colored layer is masked to the
// base image's own alpha shape (so it only ever tints pixels the base art
// actually drew) and blended with mix-blend-mode: color, which recolors
// whatever's underneath without caring what color it started as. One base
// body file serves every tone.

import type { CSSProperties } from 'react';
import type { ComposedLook } from './assignLook';

export function ComposedPortrait({
  look,
  alt,
  className,
}: {
  look: ComposedLook;
  alt: string;
  className?: string;
}) {
  const tintStyle: CSSProperties = {
    backgroundColor: look.skinColor,
    mixBlendMode: 'color',
    WebkitMaskImage: `url(${look.baseUrl})`,
    maskImage: `url(${look.baseUrl})`,
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
  };

  return (
    <div role="img" aria-label={alt} className={`relative h-full w-full overflow-hidden ${className ?? ''}`}>
      <img src={look.baseUrl} alt="" className="absolute inset-0 h-full w-full object-contain" />
      <div className="absolute inset-0 h-full w-full" style={tintStyle} />
      {look.hair && <img src={look.hair.url} alt="" className="absolute inset-0 h-full w-full object-contain" />}
      {look.facial && <img src={look.facial.url} alt="" className="absolute inset-0 h-full w-full object-contain" />}
      {look.prop && <img src={look.prop.url} alt="" className="absolute inset-0 h-full w-full object-contain" />}
    </div>
  );
}
