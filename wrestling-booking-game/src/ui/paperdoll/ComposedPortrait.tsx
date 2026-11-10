// Stacks a wrestler's assigned look into one picture: base body, tinted to
// their skin tone, then the detail overlay, then clothing (top, waistband,
// outer — in that order, so a vest sits over a t-shirt rather than under
// it), then hair, then facial hair, then a prop. Every layer is expected to
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
//
// Three things keep a stack of flat fills from looking like cut paper:
// clothing is clipped to the body's own silhouette (so a garment only has
// to be right along its neckline and the arm gaps, never its outer edge);
// one soft light-and-shadow pass, cut to that same silhouette, goes over
// skin and gear alike; and the anatomical linework is ghosted back over
// clothing, because wrestling gear is tight and the build should still
// read through it.

import type { CSSProperties } from 'react';
import type { ComposedLook } from './assignLook';

const LAYER_CLASS = 'absolute inset-0 h-full w-full object-contain';

function maskOnly(url: string): CSSProperties {
  return {
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

// A faint top-left sheen and bottom-right falloff, so hair and fabric are
// not one dead-flat color. Skin gets BODY_SHADING instead.
const SHEEN = 'linear-gradient(155deg, rgba(255,255,255,0.2), rgba(255,255,255,0) 42%, rgba(0,0,0,0.24))';

const BODY_SHADING = [
  'radial-gradient(60% 38% at 50% 14%, rgba(255,255,255,0.16), rgba(255,255,255,0) 100%)',
  'linear-gradient(to right, rgba(0,0,0,0.26), rgba(0,0,0,0) 26%, rgba(0,0,0,0) 74%, rgba(0,0,0,0.26))',
  'linear-gradient(to bottom, rgba(0,0,0,0) 52%, rgba(0,0,0,0.32))',
].join(', ');

function maskedFill(url: string, color: string, sheen: boolean): CSSProperties {
  return { backgroundColor: color, ...(sheen ? { backgroundImage: SHEEN } : {}), ...maskOnly(url) };
}

function Layer({ url, color, sheen = true }: { url: string; color: string | null; sheen?: boolean }) {
  return color ? (
    <div className={LAYER_CLASS} style={maskedFill(url, color, sheen)} />
  ) : (
    <img src={url} alt="" className={LAYER_CLASS} />
  );
}

// How far to push in for a head-and-shoulders crop. The art is drawn
// head-to-waist, which leaves the head about eight pixels wide in a 48px
// thumbnail — too small to tell two people apart.
const CLOSE_UP_SCALE = { shoulders: 2.1, head: 3 } as const;
export type PortraitFraming = 'waist' | keyof typeof CLOSE_UP_SCALE;

export function ComposedPortrait({
  look,
  alt,
  className,
  framing = 'waist',
}: {
  look: ComposedLook;
  alt: string;
  className?: string;
  framing?: PortraitFraming;
}) {
  const zoom: CSSProperties | undefined =
    framing === 'waist' ? undefined : { transform: `scale(${CLOSE_UP_SCALE[framing]})`, transformOrigin: '50% 0%' };
  const clothed = look.top || look.waistband || look.outer;
  return (
    <div role="img" aria-label={alt} className={`relative h-full w-full overflow-hidden ${className ?? ''}`}>
      <div className="absolute inset-0" style={zoom}>
        <Layer url={look.baseUrl} color={look.skinColor} sheen={false} />
        {look.baseDetailUrl && <img src={look.baseDetailUrl} alt="" className={LAYER_CLASS} />}
        <div className="absolute inset-0" style={maskOnly(look.baseUrl)}>
          {look.top && <Layer url={look.top.url} color={look.topColor} />}
          {look.waistband && <Layer url={look.waistband.url} color={look.waistbandColor} />}
          {look.outer && <Layer url={look.outer.url} color={look.outerColor} />}
          {clothed && look.baseDetailUrl && (
            <img src={look.baseDetailUrl} alt="" className={`${LAYER_CLASS} opacity-25`} />
          )}
          <div className="absolute inset-0" style={{ backgroundImage: BODY_SHADING }} />
        </div>
        {look.face && <img src={look.face.url} alt="" className={LAYER_CLASS} />}
        {look.hair && <Layer url={look.hair.url} color={look.hairColor} />}
        {look.facial && <Layer url={look.facial.url} color={look.facialColor} />}
        {look.prop && <Layer url={look.prop.url} color={look.propColor} />}
      </div>
    </div>
  );
}
