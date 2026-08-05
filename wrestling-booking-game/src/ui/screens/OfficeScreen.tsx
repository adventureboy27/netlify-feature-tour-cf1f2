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
import { identityOf } from '../../data/promotionIdentity';
import { BID_LEVEL_LABELS, playerBidAmount, type PlayerBidLevel } from '../../engine/world/auction';
import { foldRisk, FOLD_RISK_LABELS } from '../../engine/world/rivalEconomy';
import type { Wrestler } from '../../engine/types';

export function OfficeScreen() {
  const world = useGameStore((s) => s.world);
  const choose = useGameStore((s) => s.chooseEventOption);
  const dismiss = useGameStore((s) => s.dismissEventOutcome);
  const dismissYear = useGameStore((s) => s.dismissYearInReview);
  const bid = useGameStore((s) => s.bidOnAuction);
  const dismissAuction = useGameStore((s) => s.dismissAuctionResult);
  const answerRenewal = useGameStore((s) => s.answerRenewal);
  if (!world) return null;

  const latestTv = world.tvHistory[0];
  const latestChart = world.ratingsChart[0];
  const playerRow = latestChart ? playerChartPosition(latestChart.rows) : undefined;
  const wrestler = (id?: string): Wrestler | undefined => (id ? world.wrestlers[id] : undefined);

  // Enough bodies to put a show on? Two per segment, and the hurt do not count.
  const healthyRoster = world.promotion.rosterIds
    .map((id) => world.wrestlers[id])
    .filter((w) => w && !w.injury && w.health >= world.settings.rivalMinHealthToBook).length;

  // What each company on the chart is known for. The chart is where you see
  // the competition, so it is where their house style belongs.
  const houseStyles = new Map(
    [world.promotion, ...world.rivals].map((p) => [p.name, identityOf(p.identity)]),
  );
  // And how they are doing, which is the other half of reading a chart.
  const health = new Map(world.rivals.map((p) => [p.name, foldRisk(p.weeksInTheRed, world.settings)]));

  return (
    <div className="p-3 pb-24 text-neutral-100">
      <h1 className="mb-3 text-base font-semibold">The office — week {world.week}</h1>

      {/* The two ways a save actually dies: no money, or nobody to book. */}
      {world.folded ? (
        <section className="mb-3 rounded border border-rose-800 bg-rose-950/40 p-3" data-testid="folded">
          <div className="text-xs uppercase tracking-wide text-rose-400">Out of business</div>
          <p className="mt-1 text-sm">{world.folded.reason}</p>
          <p className="mt-1 text-xs text-neutral-400">
            {world.promotion.name} closed in week {world.folded.week}. The roster is loose in the business and the
            record of what you built is on the Legacy and Rankings screens.
          </p>
        </section>
      ) : (
        world.weeksInTheRed > 0 && (
          <section className="mb-3 rounded border border-rose-900 bg-rose-950/30 p-3" data-testid="in-the-red">
            <div className="text-xs uppercase tracking-wide text-rose-400">In the red</div>
            <p className="mt-1 text-sm">
              {world.weeksInTheRed} {world.weeksInTheRed === 1 ? 'week' : 'weeks'} under water.{' '}
              {world.settings.bankruptcyGraceWeeks + 1 - world.weeksInTheRed} left before the creditors close you.
            </p>
          </section>
        )
      )}

      {healthyRoster < world.settings.segmentsPerTV * 2 && !world.folded && (
        <section className="mb-3 rounded border border-amber-900 bg-amber-950/20 p-3" data-testid="roster-thin">
          <div className="text-xs uppercase tracking-wide text-amber-500">Thin roster</div>
          <p className="mt-1 text-sm">
            {healthyRoster} of your people can work this week — not enough to fill a card of{' '}
            {world.settings.segmentsPerTV}. Sign somebody.
          </p>
        </section>
      )}

      {/* A company has closed, and everything it had is on the table. */}
      {world.pendingAuction && (
        <section className="mb-3 rounded border border-sky-800 bg-sky-950/30 p-3" data-testid="auction">
          <div className="text-xs uppercase tracking-wide text-sky-400">Fire sale</div>
          <h2 className="mt-1 text-sm font-semibold">
            {world.pendingAuction.lot.fromPromotionName} has closed
          </h2>
          <p className="mt-1 text-xs text-neutral-300">
            Everything goes as one lot: {world.pendingAuction.lot.wrestlerIds.length} contracts,{' '}
            {world.pendingAuction.lot.titleIds.length} championships
            {world.pendingAuction.lot.cash > 0 && (
              <>
                , and <Money amount={world.pendingAuction.lot.cash} /> left in the account
              </>
            )}
            . Sealed bids — one round, and everybody still open is bidding.
          </p>
          <p className="mt-1 text-[11px] text-neutral-500">
            Appraised at <Money amount={world.pendingAuction.lot.appraisal} />. You have{' '}
            <Money amount={world.promotion.bankBalance} />.
          </p>

          <ul className="mt-2 flex flex-wrap gap-1 text-[10px] text-neutral-400">
            {world.pendingAuction.lot.titleIds
              .map((id) => world.titles.find((t) => t.id === id))
              .filter(Boolean)
              .map((title) => (
                <li
                  key={title!.id}
                  className="rounded px-1 py-px"
                  style={{ backgroundColor: title!.colorway.strap, color: title!.colorway.plate }}
                >
                  {title!.name}
                </li>
              ))}
          </ul>

          <div className="mt-3 flex flex-col gap-1">
            {(['aggressive', 'fair', 'lowball', 'pass'] as PlayerBidLevel[]).map((level) => (
              <button
                key={level}
                type="button"
                data-testid={`bid-${level}`}
                onClick={() => bid(level)}
                className="flex items-center justify-between rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-left text-xs hover:border-neutral-600"
              >
                <span>{BID_LEVEL_LABELS[level]}</span>
                <span className="text-neutral-500">
                  {level === 'pass' ? (
                    '—'
                  ) : (
                    <Money amount={playerBidAmount(level, world.pendingAuction!.lot, world.settings)} />
                  )}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {world.lastAuction && (
        <section className="mb-3 rounded border border-neutral-800 bg-neutral-900 p-3" data-testid="auction-result">
          <div className="text-xs uppercase tracking-wide text-neutral-500">The lot went to</div>
          <p className="mt-1 text-sm">
            <span className="font-medium">{world.lastAuction.wonByName}</span>
            {world.lastAuction.result.winnerId ? (
              <>
                {' '}
                took {world.lastAuction.lot.fromPromotionName} for{' '}
                <Money amount={world.lastAuction.result.winningBid} />.
              </>
            ) : (
              <> met the reserve. The contracts lapsed and the roster is loose in the business.</>
            )}
          </p>
          <button
            type="button"
            onClick={dismissAuction}
            className="mt-2 rounded bg-neutral-800 px-3 py-1 text-xs hover:bg-neutral-700"
          >
            Understood
          </button>
        </section>
      )}

      {world.yearInReview && (
        <section className="mb-3 rounded border border-amber-900 bg-neutral-900 p-3">
          <div className="text-xs uppercase tracking-wide text-amber-500">The year turns — {world.yearInReview.year}</div>

          {world.yearInReview.retirements.length > 0 && (
            <div className="mt-2">
              <div className="text-[11px] text-neutral-400">Out of the business</div>
              <ul className="text-xs">
                {world.yearInReview.retirements.map((r) => (
                  <li key={r.wrestlerId}>
                    <span className="font-medium">{world.wrestlers[r.wrestlerId]?.name}</span>{' '}
                    <span className="text-neutral-500">{r.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {world.yearInReview.comebacks.length > 0 && (
            <div className="mt-2">
              <div className="text-[11px] text-neutral-400">Back in it</div>
              <ul className="text-xs">
                {world.yearInReview.comebacks.map((c) => (
                  <li key={c.wrestlerId}>
                    <span className="font-medium">{world.wrestlers[c.wrestlerId]?.name}</span>
                    {c.overId && (
                      <span className="text-neutral-500">
                        {' '}
                        — with something to settle with {world.wrestlers[c.overId]?.name}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {world.yearInReview.passings.length > 0 && (
            <div className="mt-2">
              <div className="text-[11px] text-neutral-400">Passed away</div>
              <ul className="text-xs">
                {world.yearInReview.passings.map((p) => (
                  <li key={p.wrestlerId} className="text-neutral-300">
                    {world.wrestlers[p.wrestlerId]?.name}, {p.age}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {world.yearInReview.inductions.length > 0 && (
            <div className="mt-2">
              <div className="text-[11px] text-amber-400">Into the hall</div>
              <ul className="text-xs">
                {world.yearInReview.inductions.map((entry) => (
                  <li key={entry.wrestlerId}>
                    <span className="font-medium">{world.wrestlers[entry.wrestlerId]?.name}</span>{' '}
                    <span className="text-neutral-500">— {entry.citation}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {world.yearInReview.graduates.length > 0 && (
            <div className="mt-2 text-xs text-neutral-400">
              <span className="text-[11px] text-neutral-500">Out of the schools: </span>
              {world.yearInReview.graduates.map((id) => world.wrestlers[id]?.name).filter(Boolean).join(', ')}
            </div>
          )}

          {world.yearInReview.vacatedTitleIds.length > 0 && (
            <div className="mt-2 text-xs text-rose-400">
              Vacant:{' '}
              {world.yearInReview.vacatedTitleIds
                .map((id) => world.titles.find((t) => t.id === id)?.name)
                .filter(Boolean)
                .join(', ')}
            </div>
          )}

          <button
            type="button"
            data-testid="dismiss-year"
            onClick={dismissYear}
            className="mt-3 rounded bg-neutral-800 px-3 py-1 text-xs hover:bg-neutral-700"
          >
            Onward
          </button>
        </section>
      )}

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
                {health.get(row.name) && health.get(row.name) !== 'healthy' && (
                  <span
                    className={`shrink-0 rounded px-1 text-[9px] ${
                      health.get(row.name) === 'closing'
                        ? 'bg-rose-900 text-rose-200'
                        : health.get(row.name) === 'inTrouble'
                          ? 'bg-rose-950 text-rose-300'
                          : 'bg-amber-950 text-amber-400'
                    }`}
                  >
                    {FOLD_RISK_LABELS[health.get(row.name)!]}
                  </span>
                )}
                {houseStyles.get(row.name) && (
                  <span
                    className="shrink-0 rounded bg-neutral-800 px-1 text-[9px] text-neutral-400"
                    title={houseStyles.get(row.name)!.knownFor}
                  >
                    {houseStyles.get(row.name)!.label}
                  </span>
                )}
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
