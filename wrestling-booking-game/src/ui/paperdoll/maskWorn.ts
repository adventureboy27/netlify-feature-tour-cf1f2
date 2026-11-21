// The mask a wrestler wears, worked out the same way wherever it is drawn: the
// ring, the mat it falls to, and the trophy wall. A person who has lost their
// mask in a ring still has the one they wore, so the look is forced on here.
import type { Wrestler } from '../../engine/types';
import { lookSubjectOf } from './PaperDoll';
import { assignLook } from './assignLook';

export function maskWorn(w: Wrestler | undefined): { url: string; color: string | null } | null {
  const subject = w ? lookSubjectOf({ ...w, masked: true, unmaskedInRing: false }) : undefined;
  const look = subject ? assignLook(subject) : null;
  return look?.prop ? { url: look.prop.asset.url, color: look.prop.color } : null;
}
