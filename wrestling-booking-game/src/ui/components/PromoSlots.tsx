// Casting the talking — §9.
//
// Sits under the match card rather than inside it, because promo slots do not
// consume match spots and putting them in the same list would imply they do.
//
// Both halves of every topic are shown, the same as a creative event: what it
// does and what it costs. What is not shown is how *well* it will go — that is
// the speaker's mic work against the crowd, and the player finds out on the
// night like everybody else.

import { useGameStore } from '../../state/store';
import { PROMO_TOPICS, promoTopicById } from '../../data/promoTopics';
import { MANAGERS } from '../../data/ringsidePool';
import { billedAs } from '../../engine/generate/nickname';
import type { Wrestler } from '../../engine/types';

export function PromoSlots() {
  const world = useGameStore((s) => s.world);
  const setPromo = useGameStore((s) => s.setPromo);
  if (!world) return null;

  const roster = world.promotion.rosterIds
    .map((id) => world.wrestlers[id])
    .filter((w): w is Wrestler => Boolean(w) && !w!.deceased);

  return (
    <section className="mt-4">
      <h2 className="mb-1 text-sm font-medium text-neutral-300">On the microphone</h2>
      <p className="mb-2 text-[11px] text-neutral-500">
        Talking does not use a match spot. It is the only way to start a feud on purpose.
      </p>

      <div className="flex flex-col gap-2">
        {world.currentPromos.map((slot, index) => {
          const topic = slot.promoTopicId ? promoTopicById(slot.promoTopicId) : null;
          const speaker = slot.promoSpeakerId ? world.wrestlers[slot.promoSpeakerId] : null;
          const holdsTitle = Boolean(
            speaker &&
              world.titles.some(
                (t) => t.promotionId === world.promotion.id && t.currentHolderIds.includes(speaker.id),
              ),
          );

          return (
            <div
              key={index}
              data-testid={`promo-slot-${index}`}
              className="rounded border border-neutral-800 bg-neutral-900 p-2"
            >
              <div className="mb-1 text-[10px] uppercase tracking-wide text-neutral-500">Promo {index + 1}</div>

              <select
                data-testid={`promo-speaker-${index}`}
                value={slot.promoSpeakerId ?? ''}
                onChange={(e) => setPromo(index, { speakerId: e.target.value || null })}
                className="mb-1 w-full rounded bg-neutral-950 px-2 py-1 text-xs outline-none ring-1 ring-neutral-800"
              >
                <option value="">Nobody</option>
                {roster.map((w) => (
                  <option key={w.id} value={w.id}>
                    {billedAs(w)}
                  </option>
                ))}
              </select>

              <select
                data-testid={`promo-topic-${index}`}
                value={slot.promoTopicId ?? ''}
                onChange={(e) => setPromo(index, { topicId: e.target.value || null })}
                className="mb-1 w-full rounded bg-neutral-950 px-2 py-1 text-xs outline-none ring-1 ring-neutral-800"
              >
                <option value="">No topic</option>
                {PROMO_TOPICS.filter((t) => !t.needsChampion || holdsTitle).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>

              {topic?.needsTarget && (
                <select
                  data-testid={`promo-target-${index}`}
                  value={slot.promoTargetId ?? ''}
                  onChange={(e) => setPromo(index, { targetId: e.target.value || null })}
                  className="mb-1 w-full rounded bg-neutral-950 px-2 py-1 text-xs outline-none ring-1 ring-neutral-800"
                >
                  <option value="">Aimed at nobody</option>
                  {roster
                    .filter((w) => w.id !== slot.promoSpeakerId)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {billedAs(w)}
                      </option>
                    ))}
                </select>
              )}

              {/* The mouthpiece. A monster who cannot talk can be paired with
                  somebody who can, and it rates off *their* mic work. */}
              {speaker && (
                <select
                  data-testid={`promo-mouthpiece-${index}`}
                  value={slot.promoMouthpieceId ?? ''}
                  onChange={(e) => setPromo(index, { mouthpieceId: e.target.value || null })}
                  className="w-full rounded bg-neutral-950 px-2 py-1 text-xs outline-none ring-1 ring-neutral-800"
                >
                  <option value="">They speak for themselves</option>
                  {MANAGERS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} speaks for them
                    </option>
                  ))}
                </select>
              )}

              {topic && (
                <div className="mt-1">
                  <div className="text-[11px] text-emerald-400">↑ {topic.effect}</div>
                  <div className="text-[11px] text-rose-400">↓ {topic.cost}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
