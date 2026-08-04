// The office — §8.1. What the week brings you before a single thing is
// booked: the story that needs a decision, who is being tampered with, and
// where you finished in the ratings.
//
// The event card is the centrepiece. Both halves of every option are shown —
// what you hope for and what it costs — because an option whose downside is
// hidden is not a decision, it is a trick. What is *not* shown is how big
// either half is, or which option is correct.

import { useGameStore } from '../../state/store';
import { tvVerdict, wonTheNight } from '../../engine/world/tvRatings';
import { temptationLabel } from '../../engine/world/tampering';
import { CAREER_STATUS_LABELS } from '../../engine/career/status';
import { PaperDoll } from '../paperdoll/PaperDoll';
import { Money } from '../components/display';
import type { Wrestler } from '../../engine/types';

export function OfficeScreen() {
  const world = useGameStore((s) => s.world);
  const choose = useGameStore((s) => s.chooseEventOption);
  const dismiss = useGameStore((s) => s.dismissEventOutcome);
  if (!world) return null;

  const latestTv = world.tvHistory[0];
  const wrestler = (id?: string): Wrestler | undefined => (id ? world.wrestlers[id] : undefined);

  return (
    <div className="p-3 pb-24 text-neutral-100">
      <h1 className="mb-3 text-base font-semibold">The office — week {world.week}</h1>

      {world.lastEventOutcome && (
        <div className="mb-3 rounded border border-emerald-800 bg-emerald-950/40 p-3">
          <div className="text-xs uppercase tracking-wide text-emerald-400">How it went</div>
          <p className="mt-1 text-sm">{world.lastEventOutcome.summary}</p>
          <button
            type="button"
            onClick={dismiss}
            className="mt-2 rounded bg-neutral-800 px-3 py-1 text-xs hover:bg-neutral-700"
          >
            Understood
          </button>
        </div>
      )}

      {world.pendingEvent ? (
        <article className="mb-4 rounded border border-amber-800 bg-neutral-900 p-3">
          <div className="mb-1 text-[11px] uppercase tracking-wide text-amber-500">{world.pendingEvent.category}</div>
          <h2 className="text-sm font-semibold">{world.pendingEvent.title}</h2>
          <p className="mt-1 text-sm text-neutral-300">{world.pendingEvent.body}</p>

          <div className="mt-3 flex flex-col gap-2">
            {world.pendingEvent.options.map((option) => (
              <button
                key={option.id}
                type="button"
                data-testid={`event-option-${option.id}`}
                onClick={() => choose(option.id)}
                className="rounded border border-neutral-800 bg-neutral-950 p-2 text-left hover:border-neutral-600"
              >
                <div className="text-sm font-medium">{option.label}</div>
                <div className="mt-1 grid gap-0.5 text-[11px] sm:grid-cols-2">
                  <div className="text-emerald-400">↑ {option.gains}</div>
                  <div className="text-rose-400">↓ {option.costs}</div>
                </div>
              </button>
            ))}
          </div>
        </article>
      ) : (
        <p className="mb-4 rounded border border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-500">
          Quiet week. Nobody is at your door.
        </p>
      )}

      {world.tamperingOffers.length > 0 && (
        <section className="mb-4">
          <h2 className="mb-2 text-sm font-medium text-neutral-300">Somebody has been talking to your talent</h2>
          <div className="flex flex-col gap-2">
            {world.tamperingOffers.map((offer) => {
              const target = wrestler(offer.wrestlerId);
              const rival = world.rivals.find((r) => r.id === offer.rivalPromotionId);
              if (!target) return null;
              return (
                <div
                  key={offer.wrestlerId}
                  className="flex items-center gap-2 rounded border border-neutral-800 bg-neutral-900 p-2"
                >
                  <PaperDoll appearance={target.appearance} gender={target.gender} alignment={target.alignment} size="thumb" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs">
                      {target.name}
                      <span className="ml-1 text-neutral-500">{CAREER_STATUS_LABELS[target.careerStatus]}</span>
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      {rival?.name ?? 'A rival'} ·{' '}
                      <span className={offer.kind === 'tampering' ? 'text-rose-400' : 'text-amber-400'}>
                        {offer.kind === 'tampering' ? 'under contract to you' : 'deal running out'}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-300">
                    {temptationLabel(offer.temptation)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {latestTv && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-neutral-300">
            Ratings, week {latestTv.week}
            {wonTheNight(latestTv.results, world.promotion.id) && (
              <span className="ml-2 text-[11px] text-emerald-400">you won the night</span>
            )}
          </h2>
          <div className="flex flex-col gap-1">
            {[...latestTv.results]
              .sort((a, b) => b.rating - a.rating)
              .map((result) => {
                const isPlayer = result.promotionId === world.promotion.id;
                const name = isPlayer
                  ? world.promotion.name
                  : (world.rivals.find((r) => r.id === result.promotionId)?.name ?? result.promotionId);
                return (
                  <div
                    key={result.promotionId}
                    className={`flex items-center gap-2 rounded p-2 text-xs ${isPlayer ? 'bg-emerald-950/40 ring-1 ring-emerald-800' : 'bg-neutral-900'}`}
                  >
                    <span className="w-12 shrink-0 font-mono text-sm">{result.rating.toFixed(1)}</span>
                    <span className="min-w-0 flex-1 truncate">{name}</span>
                    <span className="shrink-0 text-neutral-500">{tvVerdict(result.rating, world.settings)}</span>
                  </div>
                );
              })}
          </div>
          <p className="mt-2 text-[11px] text-neutral-600">
            Bank <Money amount={world.promotion.bankBalance} />
          </p>
        </section>
      )}
    </div>
  );
}
