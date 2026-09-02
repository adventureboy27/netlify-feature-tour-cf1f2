// A wrestler's portrait — a real uploaded photo, or an initials placeholder
// if nobody has given them one yet. See README.md for what this replaced.

export type PaperDollSize = 'large' | 'bust' | 'thumb' | 'tiny';

const SIZE_PX: Record<PaperDollSize, number> = {
  large: 120,
  bust: 80,
  thumb: 48,
  // For a strip of "these people are associated" chips — small enough that
  // a row of them reads as a group at a glance, not a list to scan.
  tiny: 24,
};

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
}

export function PaperDoll({ photoDataUrl, name, size, className, flip = false }: PaperDollProps) {
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
