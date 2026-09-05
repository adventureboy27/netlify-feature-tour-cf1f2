// Stacks a wrestler's assigned look into one picture: base body, tinted to
// their skin tone, then hair, then facial hair, then a prop — in that order,
// each layer filling the same square frame. Every layer is expected to
// share one canvas size and head position (see assets/README.md) so
// stacking them takes no per-asset alignment logic at all.
//
// A tinted layer (base body always; hair/facial/prop only when their file
// opted in with a `--tint` suffix, see paperdollAssets.ts) is rendered as a
// flat color cut to that asset's own alpha shape via a CSS mask — not a
// color-blend filter over the original art. A blend mode like
// mix-blend-mode: color takes its lightness from whatever's underneath and
// only shifts hue, which cannot produce black, white or grey at all (there's
// no hue to grab onto) and washes out everything else toward the backdrop's
// own brightness — confirmed the hard way when every skin tone and hair
// color came out pale regardless of which one was assigned. A flat masked
// fill always renders exactly the requested color. An untinted layer (the
// default) is just drawn exactly as painted, no mask involved.

import type { CSSProperties } from 'react';
import type { ComposedLook } from './assignLook';

const LAYER_CLASS = 'absolute inset-0 h-full w-full object-contain';

function maskedFill(url: string, color: string): CSSProperties {
  return {
    backgroundColor: color,
    WebkitMaskImage: `url(${url})`,
    maskImage: `url(${url})`,
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
  };
}

function Layer({ url, color }: { url: string; color: string | null }) {
  return color ? (
    <div className={LAYER_CLASS} style={maskedFill(url, color)} />
  ) : (
    <img src={url} alt="" className={LAYER_CLASS} />
  );
}

export function ComposedPortrait({
  look,
  alt,
  className,
}: {
  look: ComposedLook;
  alt: string;
  className?: string;
}) {
  return (
    <div role="img" aria-label={alt} className={`relative h-full w-full overflow-hidden ${className ?? ''}`}>
      <Layer url={look.baseUrl} color={look.skinColor} />
      {look.hair && <Layer url={look.hair.url} color={look.hairColor} />}
      {look.facial && <Layer url={look.facial.url} color={look.facialColor} />}
      {look.prop && <Layer url={look.prop.url} color={look.propColor} />}
    </div>
  );
}
