// Stacks a wrestler's assigned look into one picture: base body, tinted to
// their skin tone, then the detail overlay, then clothing (top, waistband,
// outer — in that order, so a vest sits over a t-shirt rather than under
// it, with a logo on the top), neckwear, face makeup, the face, hair,
// facial hair, a face accessory, then headwear. Every layer is expected to
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
import type { ComposedLook, Worn } from './assignLook';

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

// Tattoo ink is cut from the file's shape like any tinted layer, so it can
// be pushed to pure black on the darkest skin tones, where blue-black ink
// all but disappears.
function inkFor(skin: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(skin.slice(i, i + 2), 16)) as [number, number, number];
  return 0.299 * r + 0.587 * g + 0.114 * b < 95 ? '#000000' : '#16242c';
}

// An --xl file is a 640 canvas whose inner 512 square is the normal one:
// 64 of margin each side, 128 on top, none below.
const XL_CLASS = 'absolute left-[-12.5%] top-[-25%] h-[125%] w-[125%] object-contain';

function Layer({ url, color, sheen = true, xl = false }: { url: string; color: string | null; sheen?: boolean; xl?: boolean }) {
  const cls = xl ? XL_CLASS : LAYER_CLASS;
  return color ? <div className={cls} style={maskedFill(url, color, sheen)} /> : <img src={url} alt="" className={cls} />;
}

function Piece({ worn }: { worn: Worn | null }) {
  return worn ? <Layer url={worn.asset.url} color={worn.color} xl={worn.asset.xl} /> : null;
}

// The figure is drawn a little small and sat on the bottom edge, leaving
// headroom above the canvas for hats and tall hair (--xl layers overflow
// upward into it). The close-ups push in on the head instead: the art is
// head-to-waist, which leaves the head about eight pixels wide in a 48px
// thumbnail — too small to tell two people apart.
const FRAMING = {
  waist: { transform: 'scale(0.86)', transformOrigin: '50% 100%' },
  shoulders: { transform: 'translateY(13%) scale(1.85)', transformOrigin: '50% 0%' },
  head: { transform: 'translateY(16%) scale(2.6)', transformOrigin: '50% 0%' },
} as const satisfies Record<string, CSSProperties>;
export type PortraitFraming = keyof typeof FRAMING;

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
  const clothed = look.top || look.waistband || look.outer;
  // A loose garment (coat, robe, gi) is drawn whole, after the body-clipped
  // group, so it can hang past the silhouette.
  const looseTop = look.top?.asset.loose ?? false;
  const looseOuter = look.outer?.asset.loose ?? false;
  const top = look.top && (
    <>
      <Piece worn={look.top} />
      {look.logo && (
        <div className="absolute inset-0" style={maskOnly(look.top.asset.url)}>
          <Layer url={look.logo.asset.url} color={look.logo.color} sheen={false} />
        </div>
      )}
    </>
  );
  return (
    <div role="img" aria-label={alt} className={`relative h-full w-full overflow-hidden ${className ?? ''}`}>
      <div className="absolute inset-0" style={FRAMING[framing]}>
        <Layer url={look.baseUrl} color={look.skinColor} sheen={false} />
        {look.baseDetailUrl && <img src={look.baseDetailUrl} alt="" className={LAYER_CLASS} />}
        <div className="absolute inset-0" style={maskOnly(look.baseUrl)}>
          {look.tattoos.map((t) => (
            <Layer key={t.url} url={t.url} color={inkFor(look.skinColor)} sheen={false} />
          ))}
          {!looseTop && top}
          <Piece worn={look.waistband} />
          {!looseOuter && <Piece worn={look.outer} />}
          {clothed && look.baseDetailUrl && (
            <img src={look.baseDetailUrl} alt="" className={`${LAYER_CLASS} opacity-25`} />
          )}
          <div className="absolute inset-0" style={{ backgroundImage: BODY_SHADING }} />
        </div>
        {looseTop && top}
        {looseOuter && <Piece worn={look.outer} />}
        <Piece worn={look.neck} />
        <Piece worn={look.paint} />
        {look.face && <img src={look.face.url} alt="" className={LAYER_CLASS} />}
        <Piece worn={look.hair} />
        <Piece worn={look.facial} />
        <Piece worn={look.acc} />
        <Piece worn={look.prop} />
      </div>
    </div>
  );
}
