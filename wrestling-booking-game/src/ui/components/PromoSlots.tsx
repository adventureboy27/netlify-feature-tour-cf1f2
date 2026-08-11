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
import { CONFRONTATIONS, confrontationById } from '../../data/confrontations';
import { confrontationAvailable } from '../../engine/sim/confrontation';
import { MANAGERS } from '../../data/ringsidePool';
import { billedAs } from '../../engine/generate/nickname';
import type { Wrestler } from '../../engine/types';

export function PromoSlots() {
  const world = useGameStore((s) => s.world);
  const setPromo = useGameStore((s) => s.setPromo);
  const setConfrontation = useGameStore((s) => s.setConfrontation);
  if (!world) return null;

  const roster = world.promotion.rosterIds
    .map((id) => world.wrestlers[id])
    .filter((w): w is Wrestler => Boolean(w) && !w!.deceased);

  return (
    <section className="mt-4">
      <h2 className="mb-1 text-sm font-medium text-neutral-300">On the microphone</h2>
      <p className="mb-2 text-[11px] text-neutral-500">
        Talking does not use a match spot. It is the only way to start a feud on purpose — and a confrontation
        is the only segment where somebody else gets to answer back.
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
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wide text-neutral-500">
                  {slot.kind === 'confrontation' ? 'Confrontation' : 'Promo'} {index + 1}
                </span>
                <button
                  type="button"
                  data-testid={`promo-mode-${index}`}
                  onClick={() =>
                    setConfrontation(index, {
                      confrontationId: slot.kind === 'confrontation' ? null : CONFRONTATIONS[0]!.id,
                    })
                  }
                  className="rounded border border-neutral-800 px-1.5 py-1 text-[10px] text-neutral-400 hover:border-neutral-600 hover:text-neutral-200"
                >
                  {slot.kind === 'confrontation' ? 'Make it a promo' : 'Make it a confrontation'}
                </button>
              </div>

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

              {slot.kind === 'confrontation' ? (
                <ConfrontationCast index={index} />
              ) : (
                <>
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
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Casting a confrontation: who, against whom, where, and what kind.
 *
 * Segments the pair cannot plausibly have are not offered — a contract
 * signing is fine between anybody, but two people who are not in the same
 * stable have no cracks to air, and nobody is jealous over a partner who does
 * not exist. That is availability, not advice: what the game will not do is
 * tell you which of the ones you *can* book is a good idea.
 */
function ConfrontationCast({ index }: { index: number }) {
  const world = useGameStore((s) => s.world);
  const setConfrontation = useGameStore((s) => s.setConfrontation);
  if (!world) return null;

  const slot = world.currentPromos[index];
  if (!slot) return null;

  const roster = world.promotion.rosterIds
    .map((id) => world.wrestlers[id])
    .filter((w): w is Wrestler => Boolean(w) && !w!.deceased);
  const speaker = slot.promoSpeakerId ? world.wrestlers[slot.promoSpeakerId] : null;
  const opposite = slot.confrontationOppositeId ? world.wrestlers[slot.confrontationOppositeId] : null;
  const definition = slot.confrontationId ? confrontationById(slot.confrontationId) : null;

  // What the pair actually have between them, which decides what is on offer.
  const sameGroup = Boolean(
    speaker &&
      opposite &&
      world.stables.some(
        (g) =>
          g.disbandedWeek === null && g.memberIds.includes(speaker.id) && g.memberIds.includes(opposite.id),
      ),
  );
  const eitherIsChampion = Boolean(
    [speaker, opposite].some(
      (w) => w && world.titles.some((t) => !t.vacant && t.currentHolderIds.includes(w.id)),
    ),
  );
  const eitherIsSpokenFor = Boolean(
    [speaker, opposite].some(
      (w) =>
        w &&
        world.relationships.some(
          (r) => (r.type === 'married' || r.type === 'dating') && (r.aId === w.id || r.bId === w.id),
        ),
    ),
  );

  const offered =
    speaker && opposite
      ? CONFRONTATIONS.filter((c) =>
          confrontationAvailable(c, {
            speaker,
            opposite,
            allies: sameGroup,
            championship: eitherIsChampion,
            romance: eitherIsSpokenFor,
          }),
        )
      : CONFRONTATIONS.filter((c) => c.requires === 'none');

  const pick = (id: string, label: string, value: string | null, onChange: (v: string | null) => void) => (
    <select
      data-testid={id}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="mb-1 w-full rounded bg-neutral-950 px-2 py-1 text-xs outline-none ring-1 ring-neutral-800"
    >
      <option value="">{label}</option>
      {roster
        .filter((w) => w.id !== slot.promoSpeakerId)
        .map((w) => (
          <option key={w.id} value={w.id}>
            {billedAs(w)}
          </option>
        ))}
    </select>
  );

  return (
    <>
      {pick(`confrontation-opposite-${index}`, 'Against nobody', slot.confrontationOppositeId ?? null, (v) =>
        setConfrontation(index, { oppositeId: v }),
      )}

      <select
        data-testid={`confrontation-kind-${index}`}
        value={slot.confrontationId ?? ''}
        onChange={(e) => setConfrontation(index, { confrontationId: e.target.value || null })}
        className="mb-1 w-full rounded bg-neutral-950 px-2 py-1 text-xs outline-none ring-1 ring-neutral-800"
      >
        {offered.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {/* In the ring is public and moves the feud further either way.
          Backstage is quieter and much likelier to stop being a performance. */}
      {definition && definition.venues.length > 1 && (
        <div className="mb-1 flex gap-1">
          {definition.venues.map((venue) => (
            <button
              key={venue}
              type="button"
              data-testid={`confrontation-venue-${index}-${venue}`}
              onClick={() => setConfrontation(index, { venue })}
              className={`flex-1 rounded px-2 py-1 text-[11px] ${
                (slot.confrontationVenue ?? definition.venues[0]) === venue
                  ? 'bg-emerald-700 text-white'
                  : 'bg-neutral-800 text-neutral-300'
              }`}
            >
              {venue === 'ring' ? 'In the ring' : 'Backstage'}
            </button>
          ))}
        </div>
      )}

      {definition?.needsThird &&
        pick(
          `confrontation-third-${index}`,
          definition.needsThird === 'ally' ? 'And nobody else' : 'Over nobody',
          slot.confrontationThirdId ?? null,
          (v) => setConfrontation(index, { thirdId: v }),
        )}

      {definition && <div className="mt-1 text-[11px] text-neutral-400">{definition.blurb}</div>}
    </>
  );
}
