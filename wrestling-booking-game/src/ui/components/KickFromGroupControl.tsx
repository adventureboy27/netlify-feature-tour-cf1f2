// Remove one member from a team or faction — quietly, or staged as a turn.
// Shared by RosterScreen's groups panel and WrestlerDetail's partners block
// so the immediate/staged choice only lives in one place.

import { useState } from 'react';
import { useGameStore } from '../../state/store';
import type { Id } from '../../engine/types';

export function KickFromGroupControl({
  stableId,
  memberId,
  memberName,
  alreadyStaged,
}: {
  stableId: Id;
  memberId: Id;
  memberName: string;
  /** True when this member already has a turn scheduled — offers nothing new. */
  alreadyStaged: boolean;
}) {
  const kick = useGameStore((s) => s.kickFromGroup);
  const [open, setOpen] = useState(false);

  if (alreadyStaged) {
    return <span className="text-[10px] text-amber-400">Turning next show</span>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded bg-neutral-800 px-2 py-0.5 text-[10px] text-neutral-400 hover:bg-rose-900/70 hover:text-neutral-200"
      >
        Kick
      </button>
    );
  }

  return (
    <span className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        title={`Remove ${memberName} now, quietly`}
        onClick={() => {
          kick(stableId, memberId, 'immediate');
          setOpen(false);
        }}
        className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-300 hover:bg-rose-900/70"
      >
        Now
      </button>
      <button
        type="button"
        title={`Stage a turn — the rest of the group (and their manager, if signed) jumps ${memberName} the next time they're booked`}
        onClick={() => {
          kick(stableId, memberId, 'staged');
          setOpen(false);
        }}
        className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-amber-300 hover:bg-amber-900/70"
      >
        Stage a turn
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded px-1 py-0.5 text-[10px] text-neutral-600 hover:text-neutral-400"
      >
        ✕
      </button>
    </span>
  );
}
