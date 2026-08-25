// One wrestler, on their own screen — the real destination for a name tapped
// from somewhere that isn't one of the three master-detail lists (Roster,
// Free Agents, The competition), which embed the same content in a right-
// hand pane instead of navigating to it. A booking slot's cast, a tag
// partner who isn't in whatever list happens to be on screen — this is
// where they land.
//
// All the actual content lives in `WrestlerDetailBody` (`ui/components/
// WrestlerDetail.tsx`); this file is just that body under a `ScreenHeader`,
// with `editable` computed from roster membership rather than assumed, so a
// stray reach into this screen for a non-roster wrestler hides the
// consequential actions instead of acting on a contract that isn't there.

import { useGameStore } from '../../state/store';
import { WrestlerDetailBody } from '../components/WrestlerDetail';
import { ScreenHeader } from '../components/ScreenHeader';
import type { Id } from '../../engine/types';

export function WrestlerDetailScreen({
  wrestlerId,
  onBack,
  onNavigateWrestler,
  onRepackage,
}: {
  wrestlerId: Id;
  onBack: () => void;
  /** Tap a tag partner or manager row — lands on their copy of this screen. */
  onNavigateWrestler: (id: Id) => void;
  onRepackage?: (id: Id) => void;
}) {
  const world = useGameStore((s) => s.world);

  if (!world) return null;
  const w = world.wrestlers[wrestlerId];
  if (!w) {
    // Released, retired, or otherwise gone since whatever row linked here —
    // rare, but a bare screen beats a crash on a stale id.
    return (
      <div className="p-6 text-neutral-100">
        <ScreenHeader title="Not found" onBack={onBack} />
        <p className="text-sm text-neutral-500">This wrestler is no longer on file.</p>
      </div>
    );
  }

  return (
    <div className="p-6 text-neutral-100">
      <ScreenHeader title={w.name} onBack={onBack} />
      <div className="mt-3 max-w-2xl">
        <WrestlerDetailBody
          wrestler={w}
          editable={world.promotion.rosterIds.includes(w.id)}
          onNavigateWrestler={onNavigateWrestler}
          onRepackage={onRepackage}
        />
      </div>
    </div>
  );
}
