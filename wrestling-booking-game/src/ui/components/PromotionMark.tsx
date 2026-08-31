// A promotion's own mark — initials on a house-style-coloured badge. Same
// idea as PaperDoll's placeholder for a wrestler with no photo: no art
// asset, just a name and a shape, generated rather than uploaded. Every
// house style gets its own colour (chrome.tsx's promotionTheme) and its own
// badge shape, so two promotions never read as the same logo before either
// one has run a single show — and the mark updates live as the booker types
// a name or changes house style, in NewGameScreen and everywhere else it's
// shown.

import { promotionTheme } from './chrome';
import type { PromotionArchetype } from '../../engine/types';

export type MarkSize = 'small' | 'medium' | 'large';

const SIZE_PX: Record<MarkSize, number> = {
  small: 28,
  medium: 48,
  large: 88,
};

/** One shape per house style. `undefined` means "no clip — just a rounded square." */
const SHAPE_CLIP: Record<PromotionArchetype, string | undefined> = {
  // A plain circle — the classic hometown badge.
  territory: 'circle(50%)',
  // A rough eight-point burst — the one shape here that isn't a clean polygon on purpose.
  hardcore:
    'polygon(50% 0%, 61% 20%, 85% 8%, 78% 32%, 100% 40%, 78% 55%, 92% 78%, 65% 68%, 55% 92%, 45% 68%, 20% 85%, 30% 55%, 5% 48%, 25% 30%, 12% 8%, 40% 22%)',
  // A hexagon — precise, geometric.
  technical: 'polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%)',
  // A five-point star — the flashiest shape in the set on purpose.
  sportsEntertainment: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
  // A rotated square.
  lucha: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
  // A heraldic shield.
  oldSchool: 'polygon(50% 0%, 100% 15%, 100% 55%, 50% 100%, 0% 55%, 0% 15%)',
  // No clip at all — a plain rounded square, the cleanest shape in the set.
  athletic: undefined,
};

/** First letter of up to three words. */
function markInitials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part[0]!.toUpperCase());
  return letters.join('') || '?';
}

export function PromotionMark({
  name,
  archetype,
  size = 'medium',
  className,
}: {
  /** The promotion's own name — initials are pulled straight from it, live. */
  name: string;
  archetype: PromotionArchetype | undefined;
  size?: MarkSize;
  className?: string;
}) {
  const theme = promotionTheme(archetype);
  const px = SIZE_PX[size];
  const clip = archetype ? SHAPE_CLIP[archetype] : undefined;

  return (
    <div
      role="img"
      aria-label={`${name.trim() || 'This promotion'}'s mark`}
      className={`flex shrink-0 items-center justify-center font-black text-white ${theme.solid} ${clip ? '' : 'rounded-xl'} ${className ?? ''}`}
      style={{ width: px, height: px, fontSize: px * 0.34, clipPath: clip }}
    >
      {markInitials(name)}
    </div>
  );
}
