// Every pairing that has told two genuinely great stories together.
//
// Earned, not handed out — see engine/sim/pairChemistry.ts's legendStatus().
// A single great match makes a memorable night. Two makes a rivalry the
// business still talks about.

import { useGameStore } from '../../state/store';
import { PaperDoll } from '../paperdoll/PaperDoll';
import { billedAs } from '../../engine/generate/nickname';
import { allPairingHistories, legendStatus } from '../../engine/sim/pairChemistry';
import type { Id, Wrestler } from '../../engine/types';

export function AllTimeRivalsScreen({ onNavigate }: { onNavigate?: (wrestlerId: Id) => void } = {}) {
  const world = useGameStore((s) => s.world);
  if (!world) return null;

  const groups = allPairingHistories(world.storylines).filter(
    (g) => legendStatus(g.history, world.settings) === 'allTime',
  );

  const nameOf = (id: Id): Wrestler | undefined => world.wrestlers[id];

  const citationFor = (participantIds: Id[]) => {
    const best = world.storylines
      .filter(
        (s) =>
          s.stage === 'blownOff' &&
          s.blowOffQuality !== undefined &&
          s.participantIds.length === participantIds.length &&
          s.participantIds.every((id) => participantIds.includes(id)),
      )
      .sort((a, b) => (b.blowOffQuality ?? 0) - (a.blowOffQuality ?? 0))[0];
    return best ?? null;
  };

  return (
    <div className="p-3 pb-6 text-neutral-100">
      <h1 className="mb-1 text-base font-semibold">All-Time Rivals</h1>
      <p className="mb-3 max-w-xl text-[11px] text-neutral-500">
        The rare pairings that told more than one genuinely great story together — the kind a save still talks about
        years after the last one aired.
      </p>

      {groups.length === 0 ? (
        <p className="text-xs text-neutral-500">
          Nobody has earned this yet. It takes two real, great blow-offs between the same two people — most feuds
          never get there, and that is the point.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {groups.map((g) => {
            const people = g.participantIds.map(nameOf).filter((w): w is Wrestler => Boolean(w));
            if (people.length < 2) return null;
            const story = citationFor(g.participantIds);
            const key = g.participantIds.join('-');
            return (
              <article
                key={key}
                data-testid={`all-time-rival-${key}`}
                className="flex gap-2 rounded border border-amber-900/60 bg-amber-950/20 p-2"
              >
                <div className="flex -space-x-3">
                  {people.slice(0, 2).map((w) => (
                    <PaperDoll key={w.id} photoDataUrl={w.photoDataUrl} name={w.name} size="bust" />
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {people.map((w, i) => (
                      <span key={w.id}>
                        {i > 0 && ' vs. '}
                        <button
                          type="button"
                          onClick={() => onNavigate?.(w.id)}
                          className="underline-offset-2 hover:underline"
                        >
                          {billedAs(w)}
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="text-[10px] text-amber-500/80">
                    {g.history.length} {g.history.length === 1 ? 'chapter' : 'chapters'} told
                  </div>
                  {story && <p className="mt-1 text-[11px] text-neutral-400">{story.payoff}</p>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
