// Every pairing that told one real, memorable story — good enough to
// remember, one great chapter short of an all-time rivalry.
//
// See engine/sim/pairChemistry.ts's legendStatus(). This is the wider,
// friendlier tier: a single great night, or a couple of solid ones, earns a
// place here without needing the rarer two-great-nights bar All-Time Rivals
// sets.

import { useGameStore } from '../../state/store';
import { PaperDoll } from '../paperdoll/PaperDoll';
import { billedAs } from '../../engine/generate/nickname';
import { allPairingHistories, legendStatus } from '../../engine/sim/pairChemistry';
import type { Id, Wrestler } from '../../engine/types';

export function ClassicRivalriesScreen({ onNavigate }: { onNavigate?: (wrestlerId: Id) => void } = {}) {
  const world = useGameStore((s) => s.world);
  if (!world) return null;

  const groups = allPairingHistories(world.storylines).filter(
    (g) => legendStatus(g.history, world.settings) === 'notable',
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
      <h1 className="mb-1 text-base font-semibold">Hall of Fame Classic Rivalries</h1>
      <p className="mb-3 max-w-xl text-[11px] text-neutral-500">
        Every pairing the crowd still remembers — one real story short of the rarer All-Time Rivals tier, and no less
        worth having seen.
      </p>

      {groups.length === 0 ? (
        <p className="text-xs text-neutral-500">
          Nothing here yet. It takes at least one genuinely great blow-off, or a couple of solid ones, between the
          same two people.
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
                data-testid={`classic-rivalry-${key}`}
                className="flex gap-2 rounded border border-sky-900/60 bg-sky-950/20 p-2"
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
                  <div className="text-[10px] text-sky-500/80">
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
