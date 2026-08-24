// Dark matches — §21 extension. Sits under the card and the talking, on the
// same principle as PromoSlots: these do not consume a match spot and never
// touch the TV rating, so putting them inside the card would imply they do.
//
// Kept deliberately small: singles only, no stipulation, no titles, no
// managers, no referee picking. See engine/sim/darkMatch.ts for why.

import { useGameStore } from '../../state/store';
import { billedAs } from '../../engine/generate/nickname';
import { findRivalry } from '../../engine/sim/rivalry';
import { HeatBadge } from './display';
import type { Wrestler } from '../../engine/types';

export function DarkMatchSlots() {
  const world = useGameStore((s) => s.world);
  const setParticipant = useGameStore((s) => s.setDarkMatchParticipant);
  const removeParticipant = useGameStore((s) => s.removeDarkMatchParticipant);
  if (!world) return null;

  const roster = world.promotion.rosterIds
    .map((id) => world.wrestlers[id])
    .filter((w): w is Wrestler => Boolean(w) && !w!.deceased);

  // Off the picker anywhere they are already booked tonight — the main card
  // or any other dark match slot (including the other side of this one).
  const bookedIds = new Set(
    [...world.currentCard, ...world.currentDarkMatches].flatMap((s) => s.participants.map((p) => p.wrestlerId)),
  );

  return (
    <section className="mt-4">
      <h2 className="mb-1 text-sm font-medium text-neutral-300">Dark matches</h2>
      <p className="mb-2 text-[11px] text-neutral-500">
        Optional. These never air and never move the TV rating one bit — but the crowd in the building sees every
        second of them, the people in them develop exactly the same as anybody on the card, and it is a genuinely
        real match: it can go great, it can go horribly wrong, and it can hurt somebody just as badly as anything
        else on the night.
      </p>

      <div className="flex flex-col gap-2">
        {world.currentDarkMatches.map((slot, index) => {
          const sideOf = (side: number) => {
            const p = slot.participants.find((p) => p.side === side);
            return p ? world.wrestlers[p.wrestlerId] : undefined;
          };
          const a = sideOf(0);
          const b = sideOf(1);
          const rivalry = a && b ? findRivalry(world.rivalries, [a.id, b.id]) : undefined;

          const pick = (side: number, current: Wrestler | undefined) => (
            <select
              data-testid={`dark-match-${index}-side-${side}`}
              value={current?.id ?? ''}
              onChange={(e) => {
                if (current) removeParticipant(index, current.id);
                if (e.target.value) setParticipant(index, e.target.value, side);
              }}
              className="w-full rounded bg-neutral-950 px-2 py-1 text-xs outline-none ring-1 ring-neutral-800"
            >
              <option value="">Nobody</option>
              {roster
                .filter((w) => w.id === current?.id || !bookedIds.has(w.id))
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {billedAs(w)}
                  </option>
                ))}
            </select>
          );

          return (
            <div
              key={index}
              data-testid={`dark-match-slot-${index}`}
              className="rounded border border-neutral-800 bg-neutral-900 p-2"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wide text-neutral-500">Dark match {index + 1}</span>
                {rivalry && <HeatBadge heat={rivalry.heat} shootHeat={rivalry.shootHeat} />}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {pick(0, a)}
                {pick(1, b)}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
