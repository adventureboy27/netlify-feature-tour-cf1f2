// The office — §8.1. What the week brings you before a single thing is
// booked: the story that needs a decision, who is being tampered with, and
// where you finished in the ratings.
//
// The event card is the centrepiece. Both halves of every option are shown —
// what you hope for and what it costs — because an option whose downside is
// hidden is not a decision, it is a trick. What is *not* shown is how big
// either half is, or which option is correct.

import { useGameStore } from '../../state/store';
import { tvVerdict, wonTheNight, playerChartPosition } from '../../engine/world/tvRatings';
import { temptationLabel } from '../../engine/world/tampering';
import { CAREER_STATUS_LABELS } from '../../engine/career/status';
import { egoLabel } from '../../engine/career/ego';
import { PaperDoll } from '../paperdoll/PaperDoll';
import { Money } from '../components/display';
import type { Wrestler } from '../../engine/types';

export function OfficeScreen() {
  const world = useGameStore((s) => s.world);
  const choose = useGameStore((s) => s.chooseEventOption);
  const dismiss = useGameStore((s) => s.dismissEventOutcome);
  const answerRenewal = useGameStore((s) => s.answerRenewal);
  if (!world) return null;

  const latestTv = world.tvHistory[0];
  const latestChart = world.ratingsChart[0];
  const playerRow = latestChart ? playerChartPosition(latestChart.rows) : undefined;
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

      {world.pendingRenewals.length > 0 && (
        <section className="mb-4">
          <h2 className="mb-2 text-sm font-medium text-neutral-300">Contracts up</h2>
          <div className="flex flex-col gap-2">
            {world.pendingRenewals.map((renewal) => {
              const person = wrestler(renewal.wrestlerId);
              if (!person) return null;
              return (
                <article
                  key={renewal.wrestlerId}
                  className="rounded border border-amber-900/60 bg-neutral-900 p-2"
                >
                  <div className="flex items-center gap-2">
                    <PaperDoll appearance={person.appearance} gender={person.gender} alignment={person.alignment} size="thumb" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">{person.name}</div>
                      <div className="text-[11px] text-neutral-500">
                        {CAREER_STATUS_LABELS[person.careerStatus]} · {egoLabel(person.ego)}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-xs">
                      <Money amount={renewal.demand.weeklyRate} />
                      <span className="text-neutral-600">/wk</span>
                    </div>
                  </div>

                  {renewal.demand.clauseCosts.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-0.5 border-l-2 border-amber-900/60 pl-2 text-[11px]">
                      {renewal.demand.clauseCosts.map((entry) => (
                        <li key={entry.clause}>
                          <span className="text-amber-300">{entry.label}</span>
                          <span className="ml-1 text-neutral-500">{entry.cost}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      data-testid={`renew-accept-${renewal.wrestlerId}`}
                      onClick={() => answerRenewal(renewal.wrestlerId, true)}
                      className="rounded bg-emerald-600 px-3 py-1 text-[11px] text-white hover:bg-emerald-500"
                    >
                      Give them what they want
                    </button>
                    <button
                      type="button"
                      data-testid={`renew-refuse-${renewal.wrestlerId}`}
                      onClick={() => answerRenewal(renewal.wrestlerId, false)}
                      className="rounded bg-neutral-800 px-3 py-1 text-[11px] text-neutral-300 hover:bg-neutral-700"
                    >
                      Refuse
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
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

      {latestChart && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-neutral-300">
            The week in television — week {latestChart.week}
            {latestTv && wonTheNight(latestTv.results, world.promotion.id) && (
              <span className="ml-2 text-[11px] text-emerald-400">you won the wrestling night</span>
            )}
          </h2>
          {playerRow && (
            <p className="mb-2 text-xs text-neutral-400">
              You finished <span className="font-medium text-neutral-100">#{playerRow.rank}</span> on the whole dial with
              a {playerRow.rating.toFixed(1)} — {tvVerdict(playerRow.rating, world.settings)}.
            </p>
          )}
          <div className="flex flex-col gap-0.5">
            {latestChart.rows.map((row) => (
              <div
                key={`${row.rank}-${row.name}`}
                className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${
                  row.kind === 'yours'
                    ? 'bg-emerald-950/50 ring-1 ring-emerald-800'
                    : row.kind === 'rivalWrestling'
                      ? 'bg-neutral-900 text-neutral-300'
                      : 'bg-neutral-950 text-neutral-500'
                }`}
              >
                <span className="w-6 shrink-0 text-right font-mono text-neutral-600">{row.rank}</span>
                <span className="w-12 shrink-0 font-mono">{row.rating.toFixed(1)}</span>
                <span className="min-w-0 flex-1 truncate">{row.name}</span>
                <span className="shrink-0 text-[10px] text-neutral-600">{row.network}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-neutral-600">
            Bank <Money amount={world.promotion.bankBalance} />
          </p>
        </section>
      )}
    </div>
  );
}
