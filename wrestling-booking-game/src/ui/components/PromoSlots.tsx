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

import { billedAs } from '../../engine/generate/nickname';
import { Select } from './Select';
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
        Talking does not use up a match spot. It is the only way to start a feud on purpose — and a confrontation
        is the one and only segment where somebody else actually gets to answer back.
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

              <Select
                testId={`promo-speaker-${index}`}
                value={slot.promoSpeakerId ?? ''}
                onChange={(v) => setPromo(index, { speakerId: v || null })}
                placeholder="Nobody"
                className="mb-1 w-full"
                options={roster.map((w) => ({ value: w.id, label: billedAs(w) }))}
              />

              {slot.kind === 'confrontation' ? (
                <ConfrontationCast index={index} />
              ) : (
                <>
              <Select
                testId={`promo-topic-${index}`}
                value={slot.promoTopicId ?? ''}
                onChange={(v) => setPromo(index, { topicId: v || null })}
                placeholder="No topic"
                className="mb-1 w-full"
                options={PROMO_TOPICS.filter((t) => !t.needsChampion || holdsTitle).map((t) => ({
                  value: t.id,
                  label: t.name,
                }))}
              />

              {topic?.needsTarget && (
                <Select
                  testId={`promo-target-${index}`}
                  value={slot.promoTargetId ?? ''}
                  onChange={(v) => setPromo(index, { targetId: v || null })}
                  placeholder="Aimed at nobody"
                  className="mb-1 w-full"
                  options={roster
                    .filter((w) => w.id !== slot.promoSpeakerId)
                    .map((w) => ({ value: w.id, label: billedAs(w) }))}
                />
              )}

              {/* The mouthpiece. A monster who cannot talk can be paired with
                  somebody who can, and it rates off *their* mic work. */}
              {speaker && (
                <Select
                  testId={`promo-mouthpiece-${index}`}
                  value={slot.promoMouthpieceId ?? ''}
                  onChange={(v) => setPromo(index, { mouthpieceId: v || null })}
                  placeholder="They speak for themselves"
                  className="w-full"
                  options={world.staffManagers.map((m) => ({ value: m.id, label: `${m.name} speaks for them` }))}
                />
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
    <Select
      testId={id}
      value={value ?? ''}
      onChange={(v) => onChange(v || null)}
      placeholder={label}
      className="mb-1 w-full"
      options={roster.filter((w) => w.id !== slot.promoSpeakerId).map((w) => ({ value: w.id, label: billedAs(w) }))}
    />
  );

  return (
    <>
      {pick(`confrontation-opposite-${index}`, 'Against nobody', slot.confrontationOppositeId ?? null, (v) =>
        setConfrontation(index, { oppositeId: v }),
      )}

      <Select
        testId={`confrontation-kind-${index}`}
        value={slot.confrontationId ?? ''}
        onChange={(v) => setConfrontation(index, { confrontationId: v || null })}
        className="mb-1 w-full"
        options={offered.map((c) => ({ value: c.id, label: c.name }))}
      />

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
