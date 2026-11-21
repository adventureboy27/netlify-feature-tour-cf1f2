// A wrestler's portrait — a real uploaded photo, a composited look built
// from the paperdoll asset library, or an initials placeholder if neither
// exists yet. See README.md for what this replaced.

import { assignLook, type LookSubject } from './assignLook';

export { lookSubjectOf } from './assignLook';
import { ComposedPortrait, type PortraitFraming } from './ComposedPortrait';

export type PaperDollSize = 'large' | 'bust' | 'thumb' | 'tiny';

const SIZE_PX: Record<PaperDollSize, number> = {
  large: 120,
  bust: 80,
  thumb: 48,
  // For a strip of "these people are associated" chips — small enough that
  // a row of them reads as a group at a glance, not a list to scan.
  tiny: 24,
};

// The art is head-to-waist. That reads at card size and turns into a blob
// in a list thumbnail, so the small sizes push in on the head instead.
const FRAMING: Record<PaperDollSize, PortraitFraming> = {
  large: 'waist',
  bust: 'waist',
  thumb: 'shoulders',
  tiny: 'head',
};

/** A dim studio backdrop in the same per-person hue the initials placeholder uses. */
function backdrop(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return `radial-gradient(120% 90% at 50% 16%, hsl(${hue}, 30%, 30%) 0%, hsl(${hue}, 28%, 15%) 60%, hsl(${hue}, 30%, 8%) 100%)`;
}

/** First letter of up to two words — the same idea as the commentator avatars in the match viewer. */
function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase());
  return letters.join('') || '?';
}

/** A stable color per wrestler, so the same person's placeholder always looks the same. */
function placeholderColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return `hsl(${hue}, 45%, 32%)`;
}

export interface PaperDollProps {
  /** A real photo, as a data URI. Absent for almost everyone. */
  photoDataUrl?: string;
  /** For the initials placeholder, and the alt text either way. */
  name: string;
  size: PaperDollSize;
  className?: string;
  /** Mirror horizontally, so two people billed against each other face inward rather than the same way. */
  flip?: boolean;
  /**
   * Only what the composited fallback needs to pick a look — not the whole
   * Wrestler type, so call sites without one (managers, commentators) don't
   * have to fake one. Omit it and a wrestler with no photo just gets the
   * plain initials placeholder, same as before this existed.
   */
  lookSubject?: LookSubject;
}

export function PaperDoll({ photoDataUrl, name, size, className, flip = false, lookSubject }: PaperDollProps) {
  const px = SIZE_PX[size];
  const style: React.CSSProperties = {
    width: px,
    height: px,
    ...(flip ? { transform: 'scaleX(-1)' } : {}),
  };

  if (photoDataUrl) {
    return (
      <img
        src={photoDataUrl}
        alt={name}
        width={px}
        height={px}
        className={`rounded object-cover ${className ?? ''}`}
        style={style}
      />
    );
  }

  const look = lookSubject ? assignLook(lookSubject) : null;
  if (look) {
    return (
      <div
        style={{ ...style, backgroundImage: backdrop(lookSubject!.id) }}
        className={`shrink-0 overflow-hidden rounded ring-1 ring-white/10 ${className ?? ''}`}
      >
        <ComposedPortrait look={look} alt={name} framing={FRAMING[size]} />
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={name}
      className={`flex items-center justify-center rounded font-bold text-neutral-100 ${className ?? ''}`}
      style={{
        ...style,
        backgroundColor: placeholderColor(name),
        fontSize: px * 0.36,
      }}
    >
      {initials(name)}
    </div>
  );
}
