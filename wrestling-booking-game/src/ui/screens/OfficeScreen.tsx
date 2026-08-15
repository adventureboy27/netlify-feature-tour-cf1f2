// The office — §8.1. What the week brings you before a single thing is
// booked: the story that needs a decision, who is being tampered with, and
// where you finished in the ratings.
//
// The event card is the centrepiece. Both halves of every option are shown —
// what you hope for and what it costs — because an option whose downside is
// hidden is not a decision, it is a trick. What is *not* shown is how big
// either half is, or which option is correct.
//
// Laid out in tabs because the office grew: a fire sale, the turn of the
// year, a creative decision, a stack of contract renewals and the television
// chart could all land in the same week, and stacked end to end that is a
// screen nobody reads to the bottom of. Anything that needs an answer carries
// a badge on its tab, so tabbing cannot hide a decision from you — and the
// two things that end a save (no money, nobody to book) stay pinned above the
// tabs where they cannot be missed at all.

import { useState } from 'react';
import { CalendarStrip } from '../components/CalendarStrip';
import { coopAppetite, moodFor, moodLine } from '../../engine/world/supershow';
import { useGameStore } from '../../state/store';
import { tvVerdict, wonTheNight, playerChartPosition } from '../../engine/world/tvRatings';
import { temptationLabel } from '../../engine/world/tampering';
import { CAREER_STATUS_LABELS } from '../../engine/career/status';
import { egoLabel } from '../../engine/career/ego';
import { awardById } from '../../engine/career/awards';
import { strikeWarning } from '../../engine/world/mandates';
import { championInjuryOptions } from '../../engine/world/titleDefence';
import { broadcasterById } from '../../data/broadcasters';
import { sponsorById } from '../../data/sponsors';
import { PaperDoll } from '../paperdoll/PaperDoll';
import { Money } from '../components/display';
import { DAYS, weekLine } from '../../engine/world/calendar';
import {
  bigShowName,
  nightsOff,
  scheduleLine,
  scheduleOf,
  showsPerWeek,
  weeksUntilBigShow,
  type PPVCadence,
} from '../../engine/world/schedule';
import { identityOf } from '../../data/promotionIdentity';
import { BID_LEVEL_LABELS, playerBidAmount, type PlayerBidLevel } from '../../engine/world/auction';
import { foldRisk, FOLD_RISK_LABELS } from '../../engine/world/rivalEconomy';
import type { Wrestler } from '../../engine/types';
import { contractUrgency } from '../../engine/economy/contracts';
import { severanceOwed, guaranteeLabel } from '../../engine/economy/termination';
import { canBeTraded, tradeWorth, tradePartners } from '../../engine/world/trades';
import {
  signedReferees,
  availableReferees,
  refereeWageBill,
  currentRefereeAskingRate,
  refereeGrade,
  sharpnessLabel,
  isAvailable,
} from '../../engine/sim/referees';

type Tab = 'desk' | 'contracts' | 'officials' | 'trades' | 'television' | 'schedule' | 'joint';

export function OfficeScreen() {
  const world = useGameStore((s) => s.world);
  const [tab, setTab] = useState<Tab>('desk');
  if (!world) return null;

  // What is waiting on each tab. Decisions and notices both count — the badge
  // is there so you never have to guess whether tabbing away lost something.
  const onTheDesk =
    (world.pendingEvent ? 1 : 0) +
    (world.pendingAuction ? 1 : 0) +
    (world.yearInReview ? 1 : 0) +
    (world.mandate ? 1 : 0) +
    (world.pendingBroadcastOffer ? 1 : 0) +
    world.pendingSponsorOffers.length +
    world.lastDealsLost.length +
    (world.lastMandateOutcome ? 1 : 0) +
    (world.lastEventOutcome ? 1 : 0) +
    (world.lastAuction ? 1 : 0);
  const inContracts =
    world.pendingRenewals.length + world.tamperingOffers.length + world.releaseRequests.length;
  // A promotion with nobody in a striped shirt is a promotion where a
  // wrestler counts every fall, so that is worth a badge on its own.
  const officialsNeedYou =
    world.weeklyNews.filter((n) => n.kind === 'official').length +
    (world.referees.some((r) => r.promotionId === world.promotion.id) ? 0 : 1);

  const tabs: { id: Tab; label: string; badge: number }[] = [
    { id: 'desk', label: 'Desk', badge: onTheDesk },
    { id: 'contracts', label: 'Contracts', badge: inContracts },
    { id: 'officials', label: 'Officials', badge: officialsNeedYou },
    { id: 'trades', label: 'Trades', badge: 0 },
    { id: 'television', label: 'Television', badge: 0 },
    { id: 'schedule', label: 'Schedule', badge: 0 },
    { id: 'joint', label: 'Joint shows', badge: 0 },
  ];

  return (
    <div className="p-3 pb-24 text-neutral-100">
      {/* The bank is in the app header on every screen; no need to repeat it. */}
      <h1 className="mb-2 text-base font-semibold">The office — {weekLine(world.week, world.settings)}</h1>

      <StatusStrip />

      {/* Six tabs do not fit a phone. The strip scrolls inside itself —
          letting it push the body wide instead shifts the header off screen. */}
      <div className="-mx-3 mb-3 flex gap-1 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((option) => (
          <button
            key={option.id}
            type="button"
            data-testid={`office-tab-${option.id}`}
            onClick={() => setTab(option.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded px-3 py-1 text-xs ${
              tab === option.id
                ? 'bg-emerald-600 text-white'
                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
            }`}
          >
            {option.label}
            {option.badge > 0 && (
              <span
                className={`rounded-full px-1.5 text-[10px] font-semibold ${
                  tab === option.id ? 'bg-emerald-800 text-white' : 'bg-amber-600 text-white'
                }`}
              >
                {option.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'desk' && <DeskTab />}
      {tab === 'contracts' && <ContractsTab />}
      {tab === 'officials' && <OfficialsTab />}
      {tab === 'trades' && <TradesTab />}
      {tab === 'television' && <TelevisionTab />}
      {tab === 'schedule' && <ScheduleTab />}
      {tab === 'joint' && <JointShowsTab />}
    </div>
  );
}

/**
 * The two things that end a save. Pinned above the tabs and never inside one,
 * because a promotion four weeks from the creditors should not be discoverable
 * only by tabbing.
 */
function StatusStrip() {
  const world = useGameStore((s) => s.world);
  if (!world) return null;

  if (world.fired) {
    return (
      <section className="mb-3 rounded border border-rose-800 bg-rose-950/40 p-3" data-testid="fired">
        <div className="text-xs uppercase tracking-wide text-rose-400">Fired</div>
        <p className="mt-1 text-sm">{world.fired.reason}</p>
        <p className="mt-1 text-xs text-neutral-400">
          You were let go in week {world.fired.week}, after {world.mandateStrikes} missed mandates.{' '}
          {world.promotion.name} carries on without you. What you built is on the Legacy and Records screens.
        </p>
      </section>
    );
  }

  if (world.folded) {
    return (
      <section className="mb-3 rounded border border-rose-800 bg-rose-950/40 p-3" data-testid="folded">
        <div className="text-xs uppercase tracking-wide text-rose-400">Out of business</div>
        <p className="mt-1 text-sm">{world.folded.reason}</p>
        <p className="mt-1 text-xs text-neutral-400">
          {world.promotion.name} closed in week {world.folded.week}. The roster is loose in the business and the record
          of what you built is on the Legacy and Rankings screens.
        </p>
      </section>
    );
  }

  const healthyRoster = world.promotion.rosterIds
    .map((id) => world.wrestlers[id])
    .filter((w) => w && !w.injury && w.health >= world.settings.rivalMinHealthToBook).length;
  const thin = healthyRoster < world.settings.segmentsPerTV * 2;

  if (world.weeksInTheRed === 0 && !thin) return null;

  return (
    <div className="mb-3 flex flex-wrap gap-1">
      {world.weeksInTheRed > 0 && (
        <span
          className="rounded border border-rose-900 bg-rose-950/40 px-2 py-1 text-[11px] text-rose-300"
          data-testid="in-the-red"
        >
          In the red {world.weeksInTheRed}w —{' '}
          {world.settings.bankruptcyGraceWeeks + 1 - world.weeksInTheRed} until the creditors close you
        </span>
      )}
      {thin && (
        <span
          className="rounded border border-amber-900 bg-amber-950/30 px-2 py-1 text-[11px] text-amber-300"
          data-testid="roster-thin"
        >
          Only {healthyRoster} can work — not enough for a card of {world.settings.segmentsPerTV}
        </span>
      )}
    </div>
  );
}

/** Everything waiting on an answer, and everything reporting one back. */
function DeskTab() {
  const world = useGameStore((s) => s.world);
  const choose = useGameStore((s) => s.chooseEventOption);
  const dismiss = useGameStore((s) => s.dismissEventOutcome);
  const dismissYear = useGameStore((s) => s.dismissYearInReview);
  const bid = useGameStore((s) => s.bidOnAuction);
  const dismissAuction = useGameStore((s) => s.dismissAuctionResult);
  if (!world) return null;

  return (
    <>
      <ChampionCallPanel />

      {/* A company has closed, and everything it had is on the table. */}
      {world.pendingAuction && (
        <section className="mb-3 rounded border border-sky-800 bg-sky-950/30 p-3" data-testid="auction">
          <div className="text-xs uppercase tracking-wide text-sky-400">Fire sale</div>
          <h2 className="mt-1 text-sm font-semibold">{world.pendingAuction.lot.fromPromotionName} has closed</h2>
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

      <Mandate />
      <DealOffers />
      {world.yearInReview && <YearInReview onDismiss={dismissYear} />}

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
        <article className="rounded border border-amber-800 bg-neutral-900 p-3">
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
        <p className="rounded border border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-500">
          Quiet week. Nobody is at your door.
        </p>
      )}
    </>
  );
}

/**
 * Somebody wants to pay you, and somebody has stopped.
 *
 * Offers are answered rather than taken automatically: a national deal you
 * cannot honour is worse than no deal, because the conditions constrain every
 * card you book afterwards and losing it later is a hole rather than a
 * setback. That has to be the booker's call.
 */
function DealOffers() {
  const world = useGameStore((s) => s.world);
  const answerBroadcast = useGameStore((s) => s.answerBroadcastOffer);
  const signSponsor = useGameStore((s) => s.signSponsor);
  if (!world) return null;

  const offer = world.pendingBroadcastOffer ? broadcasterById(world.pendingBroadcastOffer) : null;
  const sponsorOffers = world.pendingSponsorOffers
    .map((id) => sponsorById(id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));
  const lost = world.lastDealsLost;

  if (!offer && sponsorOffers.length === 0 && lost.length === 0) return null;

  return (
    <>
      {lost.map((gone) => (
        <section
          key={gone.name}
          data-testid={`deal-lost-${gone.name}`}
          className="mb-3 rounded border border-rose-800 bg-rose-950/30 p-3"
        >
          <div className="text-xs uppercase tracking-wide text-rose-400">Gone</div>
          <p className="mt-1 text-sm font-medium">{gone.name} has pulled out.</p>
          <p className="mt-1 text-xs text-neutral-400">“{gone.reason}”</p>
        </section>
      ))}

      {offer && (
        <section data-testid="broadcast-offer" className="mb-3 rounded border border-sky-800 bg-sky-950/30 p-3">
          <div className="text-xs uppercase tracking-wide text-sky-400">Television</div>
          <h2 className="mt-1 text-sm font-semibold">{offer.name} wants the show</h2>
          <p className="mt-1 text-xs text-neutral-400">{offer.blurb}</p>
          <p className="mt-2 text-sm text-emerald-400">
            <Money amount={offer.weeklyFee} /> a week
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {offer.demands.map((demand) => (
              <li key={demand.kind} className="text-[11px] text-amber-400">
                ↓ {demand.text}
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              data-testid="accept-broadcast"
              onClick={() => answerBroadcast(true)}
              className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500"
            >
              Sign it
            </button>
            <button
              type="button"
              data-testid="decline-broadcast"
              onClick={() => answerBroadcast(false)}
              className="rounded bg-neutral-800 px-3 py-1 text-xs hover:bg-neutral-700"
            >
              Not yet
            </button>
          </div>
        </section>
      )}

      {sponsorOffers.length > 0 && (
        <section className="mb-3 rounded border border-neutral-800 bg-neutral-900 p-3">
          <div className="text-xs uppercase tracking-wide text-neutral-400">Sponsors interested</div>
          <div className="mt-2 flex flex-col gap-1.5">
            {sponsorOffers.map((sponsor) => (
              <div key={sponsor.id} className="rounded border border-neutral-800 bg-neutral-950 p-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-xs font-medium">{sponsor.name}</span>
                  <span className="shrink-0 text-[11px] text-emerald-400">
                    <Money amount={sponsor.weeklyFee} />
                  </span>
                </div>
                <p className="text-[10px] text-neutral-500">{sponsor.blurb}</p>
                {sponsor.conditions.map((condition) => (
                  <div key={condition.kind} className="text-[10px] text-amber-400">
                    ↓ {condition.text}
                  </div>
                ))}
                <button
                  type="button"
                  data-testid={`sign-sponsor-${sponsor.id}`}
                  onClick={() => signSponsor(sponsor.id)}
                  className="mt-1 rounded bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-200 hover:bg-neutral-700"
                >
                  Take the money
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/**
 * What the owner wants.
 *
 * Deliberately just the demand and the clock. It does not say whether you can
 * do it, how close you are, or what it is worth — the game does not warn you
 * before a bad decision and it does not hold your hand through a good one.
 * What it does say, loudly, is how much rope is left.
 */
function Mandate() {
  const world = useGameStore((s) => s.world);
  const dismissMandateOutcome = useGameStore((s) => s.dismissMandateOutcome);
  if (!world || world.fired) return null;

  const warning = strikeWarning(world.mandateStrikes, world.settings);
  const outcome = world.lastMandateOutcome;

  return (
    <>
      {outcome && (
        <section
          data-testid="mandate-outcome"
          className={`mb-3 rounded border p-3 ${
            outcome.met ? 'border-emerald-800 bg-emerald-950/30' : 'border-rose-800 bg-rose-950/30'
          }`}
        >
          <div className={`text-xs uppercase tracking-wide ${outcome.met ? 'text-emerald-400' : 'text-rose-400'}`}>
            {outcome.met ? 'Mandate met' : 'Mandate missed'}
          </div>
          <p className="mt-1 text-sm">“{outcome.description}”</p>
          <p className="mt-1 text-xs text-neutral-400">{outcome.verdict}</p>
          <button
            type="button"
            data-testid="dismiss-mandate-outcome"
            onClick={dismissMandateOutcome}
            className="mt-2 rounded bg-neutral-800 px-3 py-1 text-xs hover:bg-neutral-700"
          >
            Understood
          </button>
        </section>
      )}

      {world.mandate && (
        <section data-testid="mandate" className="mb-3 rounded border border-amber-800 bg-amber-950/20 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs uppercase tracking-wide text-amber-500">The owner wants</span>
            <span className="shrink-0 text-[10px] text-neutral-500">
              {Math.max(0, world.mandate.deadlineWeek - world.week)} weeks
            </span>
          </div>
          <p className="mt-1 text-sm font-medium">“{world.mandate.description}”</p>
          {warning && <p className="mt-1 text-[11px] text-rose-400">{warning}</p>}
        </section>
      )}

      {!world.mandate && warning && (
        <p className="mb-3 text-[11px] text-rose-400" data-testid="strike-warning">
          {warning}
        </p>
      )}
    </>
  );
}

/** The turn of the year, in one panel. */
function YearInReview({ onDismiss }: { onDismiss: () => void }) {
  const world = useGameStore((s) => s.world);
  const review = world?.yearInReview;
  if (!world || !review) return null;

  const nameOf = (id: string) => world.wrestlers[id]?.name;

  return (
    <section className="mb-3 rounded border border-amber-900 bg-neutral-900 p-3">
      <div className="text-xs uppercase tracking-wide text-amber-500">The year turns — {review.year}</div>

      {review.awards.length > 0 && (
        <div className="mt-2 flex flex-col gap-1" data-testid="year-awards">
          {review.awards.map((winner) => {
            const definition = awardById(winner.awardId);
            const good = definition?.good ?? true;
            return (
              <div
                key={winner.awardId}
                className={`rounded border px-2 py-1.5 ${
                  good ? 'border-amber-900/60 bg-amber-950/20' : 'border-rose-900/60 bg-rose-950/20'
                }`}
              >
                <div className={`text-[10px] uppercase tracking-wide ${good ? 'text-amber-500' : 'text-rose-400'}`}>
                  {definition?.name ?? winner.awardId}
                </div>
                <div className="text-xs font-medium">
                  {winner.wrestlerIds.map(nameOf).filter(Boolean).join(' & ')}
                </div>
                <p className="text-[11px] text-neutral-400">{winner.citation}</p>
              </div>
            );
          })}
        </div>
      )}

      {review.retirements.length > 0 && (
        <YearGroup title="Out of the business" total={review.retirements.length}>
          {review.retirements.slice(0, YEAR_GROUP_LIMIT).map((r) => (
            <li key={r.wrestlerId}>
              <span className="font-medium">{nameOf(r.wrestlerId)}</span>{' '}
              <span className="text-neutral-500">{r.reason}</span>
            </li>
          ))}
        </YearGroup>
      )}

      {review.comebacks.length > 0 && (
        <YearGroup title="Back in it" total={review.comebacks.length}>
          {review.comebacks.slice(0, YEAR_GROUP_LIMIT).map((c) => (
            <li key={c.wrestlerId}>
              <span className="font-medium">{nameOf(c.wrestlerId)}</span>
              {c.overId && (
                <span className="text-neutral-500"> — with something to settle with {nameOf(c.overId)}</span>
              )}
            </li>
          ))}
        </YearGroup>
      )}

      {review.passings.length > 0 && (
        <YearGroup title="Passed away" total={review.passings.length}>
          {review.passings.slice(0, YEAR_GROUP_LIMIT).map((p) => (
            <li key={p.wrestlerId} className="text-neutral-300">
              {nameOf(p.wrestlerId)}, {p.age}
            </li>
          ))}
        </YearGroup>
      )}

      {review.inductions.length > 0 && (
        <YearGroup title="Into the hall" tone="text-amber-400" total={review.inductions.length}>
          {review.inductions.slice(0, YEAR_GROUP_LIMIT).map((entry) => (
            <li key={entry.wrestlerId}>
              <span className="font-medium">{nameOf(entry.wrestlerId)}</span>{' '}
              <span className="text-neutral-500">— {entry.citation}</span>
            </li>
          ))}
        </YearGroup>
      )}

      {review.graduates.length > 0 && (
        <div className="mt-2 text-xs text-neutral-400">
          <span className="text-[11px] text-neutral-500">Out of the schools: </span>
          {review.graduates.slice(0, YEAR_GROUP_LIMIT).map(nameOf).filter(Boolean).join(', ')}
          {review.graduates.length > YEAR_GROUP_LIMIT && (
            <span className="text-neutral-600"> and {review.graduates.length - YEAR_GROUP_LIMIT} more</span>
          )}
        </div>
      )}

      {review.vacatedTitleIds.length > 0 && (
        <div className="mt-2 text-xs text-rose-400">
          Vacant:{' '}
          {review.vacatedTitleIds
            .map((id) => world.titles.find((t) => t.id === id)?.name)
            .filter(Boolean)
            .join(', ')}
        </div>
      )}

      <button
        type="button"
        data-testid="dismiss-year"
        onClick={onDismiss}
        className="mt-3 rounded bg-neutral-800 px-3 py-1 text-xs hover:bg-neutral-700"
      >
        Onward
      </button>
    </section>
  );
}

/**
 * One group in the year's summary, capped. A bad year can retire eighteen
 * people at once, and eighteen names is a wall — the count in the heading
 * carries the scale, the list carries the ones worth reading.
 */
function YearGroup({
  title,
  tone = 'text-neutral-400',
  total,
  children,
}: {
  title: string;
  tone?: string;
  total: number;
  children: React.ReactNode;
}) {
  const shown = Array.isArray(children) ? children.length : 1;
  return (
    <div className="mt-2">
      <div className={`text-[11px] ${tone}`}>
        {title}
        {total > 1 && <span className="ml-1 text-neutral-600">{total}</span>}
      </div>
      <ul className="text-xs">{children}</ul>
      {total > shown && <div className="text-[11px] text-neutral-600">and {total - shown} more</div>}
    </div>
  );
}

/** How many names any one group prints before it starts summarising. */
const YEAR_GROUP_LIMIT = 6;

/** Deals running out, and rivals sniffing around the ones that are not. */
function ContractsTab() {
  const world = useGameStore((s) => s.world);
  const answerRenewal = useGameStore((s) => s.answerRenewal);
  const answerReleaseRequest = useGameStore((s) => s.answerReleaseRequest);
  if (!world) return null;

  const wrestler = (id?: string): Wrestler | undefined => (id ? world.wrestlers[id] : undefined);

  // Read off the one wire rather than a second list kept alongside it. The
  // results page and this tab now cannot disagree about who left.
  const departures = world.weeklyNews.filter((n) => n.kind === 'departure').map((n) => n.text);

  if (
    world.pendingRenewals.length === 0 &&
    world.tamperingOffers.length === 0 &&
    world.releaseRequests.length === 0 &&
    departures.length === 0
  ) {
    return (
      <p className="rounded border border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-500">
        Every deal is signed and nobody is being courted. Enjoy it.
      </p>
    );
  }

  return (
    <>
      {/* Somebody wants out. Granting it costs nothing and puts him on
          ninety days; refusing keeps him, and he gets unhappier every week
          you make him stay. */}
      {world.releaseRequests.length > 0 && (
        <section className="mb-4">
          <h2 className="mb-2 text-sm font-medium text-neutral-300">Asking to leave</h2>
          <div className="flex flex-col gap-2">
            {world.releaseRequests.map((request) => {
              const person = wrestler(request.wrestlerId);
              if (!person) return null;
              return (
                <article
                  key={request.wrestlerId}
                  data-testid={`release-request-${request.wrestlerId}`}
                  className="rounded border border-rose-900/60 bg-neutral-900 p-2"
                >
                  <div className="flex items-center gap-2">
                    <PaperDoll
                      appearance={person.appearance}
                      gender={person.gender}
                      alignment={person.alignment}
                      size="thumb"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">{person.name}</div>
                      <div className="text-[11px] text-neutral-500">
                        Wants out. Says he will tear up what he is owed —{' '}
                        <Money amount={severanceOwed(person.contract)} /> of guarantees.
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      data-testid={`release-grant-${request.wrestlerId}`}
                      onClick={() => answerReleaseRequest(request.wrestlerId, true)}
                      className="rounded bg-neutral-800 px-3 py-1 text-[11px] text-neutral-200 hover:bg-neutral-700"
                    >
                      Let him go — ninety days
                    </button>
                    <button
                      type="button"
                      data-testid={`release-refuse-${request.wrestlerId}`}
                      onClick={() => answerReleaseRequest(request.wrestlerId, false)}
                      className="rounded bg-neutral-800 px-3 py-1 text-[11px] text-neutral-300 hover:bg-neutral-700"
                    >
                      He honours the deal
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* How people left. Nobody drops off the roster in silence. */}
      {departures.length > 0 && (
        <section className="mb-4">
          <h2 className="mb-2 text-sm font-medium text-neutral-300">Comings and goings</h2>
          <ul className="flex flex-col gap-1 rounded border border-neutral-800 bg-neutral-900 p-2">
            {departures.map((line, i) => (
              <li key={i} className="text-[11px] text-neutral-400">
                {line}
              </li>
            ))}
          </ul>
        </section>
      )}
      {world.pendingRenewals.length > 0 && (
        <section className="mb-4">
          <h2 className="mb-2 text-sm font-medium text-neutral-300">Contracts up</h2>
          <div className="flex flex-col gap-2">
            {world.pendingRenewals.map((renewal) => {
              const person = wrestler(renewal.wrestlerId);
              if (!person) return null;
              return (
                <article key={renewal.wrestlerId} className="rounded border border-amber-900/60 bg-neutral-900 p-2">
                  <div className="flex items-center gap-2">
                    <PaperDoll
                      appearance={person.appearance}
                      gender={person.gender}
                      alignment={person.alignment}
                      size="thumb"
                    />
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

                  {/* What they want guaranteed, which is the part that binds
                      you long after the wage stops looking big. */}
                  {guaranteeLabel(person.ego, world.settings) && (
                    <div className="mt-1 text-[11px] text-amber-300">
                      {guaranteeLabel(person.ego, world.settings)}
                    </div>
                  )}

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
        <section>
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
                  <PaperDoll
                    appearance={target.appearance}
                    gender={target.gender}
                    alignment={target.alignment}
                    size="thumb"
                  />
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
    </>
  );
}

/** Where you finished on the dial, and how the competition is holding up. */
/**
 * The officials.
 *
 * They are signed characters with contracts, so they get a roster of their
 * own — who is on the books, how worn they are, what the business makes of
 * them, and who is available to sign. Everything a booker actually decides
 * about officiating is on this one page: pay for somebody who sees
 * everything, or save the money and watch a cheap one cost your top babyface
 * a match in front of a full house.
 *
 * No creative control anywhere on it. An official never gets a say in who
 * goes over, so there is no clause to negotiate and nothing to read twice.
 */
function OfficialsTab() {
  const world = useGameStore((s) => s.world);
  const sign = useGameStore((s) => s.signReferee);
  const release = useGameStore((s) => s.releaseReferee);
  const setDefault = useGameStore((s) => s.setDefaultReferee);
  const [refused, setRefused] = useState<string | null>(null);
  if (!world) return null;

  const officialNews = world.weeklyNews.filter((n) => n.kind === 'official').map((n) => n.text);
  const crew = signedReferees(world.referees, world.promotion.id);
  const pool = availableReferees(world.referees);
  const wageBill = refereeWageBill(world.referees, world.promotion.id);

  return (
    <>
      {/* What happened to them this week. Nothing about a person changes
          off-screen — CLAUDE.md — and that includes an official whose deal
          quietly ran out. */}
      {officialNews.length > 0 && (
        <section className="mb-4">
          <h2 className="mb-2 text-sm font-medium text-neutral-300">From the officials</h2>
          <ul className="flex flex-col gap-1 rounded border border-neutral-800 bg-neutral-900 p-2">
            {officialNews.map((line, i) => (
              <li key={i} className="text-[11px] text-neutral-400">
                {line}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-neutral-300">Under contract</h2>
          <span className="text-[11px] text-neutral-500">
            <Money amount={wageBill} />
            <span className="text-neutral-600">/wk</span>
          </span>
        </div>

        {crew.length === 0 ? (
          <p className="rounded border border-amber-900/60 bg-neutral-900 p-3 text-[11px] text-amber-300">
            You have nobody in a striped shirt. Every match will be counted by one of the boys, and every
            one of them has an opinion about who should win.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {crew.map((referee) => (
              <article
                key={referee.id}
                data-testid={`official-${referee.id}`}
                className="rounded border border-neutral-800 bg-neutral-900 p-2"
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-medium">{referee.name}</span>
                      {world.defaultRefereeId === referee.id && (
                        <span className="rounded bg-emerald-900 px-1.5 py-0.5 text-[10px] text-emerald-300">
                          Card official
                        </span>
                      )}
                      {referee.injury && (
                        <span className="rounded bg-rose-950 px-1.5 py-0.5 text-[10px] text-rose-300">
                          {referee.injury.description}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      {refereeGrade(referee)} · {sharpnessLabel(referee)} · {referee.blurb}
                    </div>
                    {referee.recentMatches > 0 && (
                      <div className="text-[10px] text-neutral-600">
                        {referee.recentMisses === 0
                          ? 'Has not missed a thing lately.'
                          : `Blown calls lately: ${referee.recentMisses} in ${referee.recentMatches} matches.`}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right text-xs">
                    {referee.wrestlerId ? (
                      // One of your own. His wage is already on the roster
                      // payroll — and it is a wrestler's wage until his deal
                      // runs out, which is the cost of converting your top guy.
                      <>
                        <span className="text-sky-400">On the roster</span>
                        <div className="text-[10px] text-neutral-600">paid as a wrestler</div>
                      </>
                    ) : (
                      <>
                        <Money amount={referee.contract?.weeklyRate ?? 0} />
                        <span className="text-neutral-600">/wk</span>
                        <div className="text-[10px] text-neutral-600">
                          {contractUrgency(referee.contract).toLowerCase()}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    data-testid={`official-default-${referee.id}`}
                    disabled={!isAvailable(referee) || world.defaultRefereeId === referee.id}
                    onClick={() => setDefault(referee.id)}
                    className="rounded bg-neutral-800 px-3 py-1 text-[11px] text-neutral-300 hover:bg-neutral-700 disabled:opacity-40"
                  >
                    Give him the card
                  </button>
                  {referee.wrestlerId ? (
                    // Taking one of your own out of the shirt is a career
                    // decision, not a release — it happens on the roster,
                    // where the year he owes the job is written down.
                    <span className="self-center text-[10px] text-neutral-600">
                      One of your own — move him back on the roster page
                    </span>
                  ) : (
                    <button
                      type="button"
                      data-testid={`official-release-${referee.id}`}
                      onClick={() => release(referee.id)}
                      className="rounded bg-neutral-800 px-3 py-1 text-[11px] text-rose-300 hover:bg-neutral-700"
                    >
                      Let him go
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-neutral-300">Available</h2>
        {refused && <p className="mb-2 text-[11px] text-amber-400">{refused}</p>}
        <div className="flex flex-col gap-2">
          {pool.slice(0, 12).map((referee) => (
            <article
              key={referee.id}
              data-testid={`free-official-${referee.id}`}
              className="flex items-start gap-2 rounded border border-neutral-800 bg-neutral-900 p-2"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">{referee.name}</div>
                <div className="text-[11px] text-neutral-500">
                  {refereeGrade(referee)} · {referee.blurb}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-xs">
                  <Money amount={currentRefereeAskingRate(referee, world.settings)} />
                  <span className="text-neutral-600">/wk</span>
                </div>
                <button
                  type="button"
                  data-testid={`sign-official-${referee.id}`}
                  onClick={() => {
                    const outcome = sign(referee.id);
                    setRefused(outcome.ok ? null : outcome.reason);
                  }}
                  className="mt-1 rounded bg-emerald-600 px-3 py-1 text-[11px] text-white hover:bg-emerald-500"
                >
                  Sign
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

/**
 * Trades.
 *
 * The contract goes with the wrestler, which is the whole reason this is
 * interesting: a deal you regret is a thing you can try to make somebody
 * else's problem, and they can see you doing it. A star on a fully guaranteed
 * long deal is worth *less than nothing* on this page, and that is correct.
 *
 * A refusal always says which half of the deal was wrong, because "no" on its
 * own is not information.
 */
function TradesTab() {
  const world = useGameStore((s) => s.world);
  const propose = useGameStore((s) => s.proposeTrade);
  const [mineId, setMineId] = useState<string | null>(null);
  const [rivalId, setRivalId] = useState<string | null>(null);
  const [theirsId, setTheirsId] = useState<string | null>(null);
  const [answer, setAnswer] = useState<{ accepted: boolean; reason: string } | null>(null);
  if (!world) return null;

  const mine = world.promotion.rosterIds
    .map((id) => world.wrestlers[id])
    .filter((w): w is Wrestler => Boolean(w) && canBeTraded(w!).ok);
  const partners = tradePartners(world.rivals, world.tradeRefusals, world.week, world.settings);
  const rival = partners.find((r) => r.id === rivalId) ?? null;
  const theirRoster = rival
    ? rival.rosterIds.map((id) => world.wrestlers[id]).filter((w): w is Wrestler => Boolean(w) && canBeTraded(w!).ok)
    : [];

  const chosen = mineId ? world.wrestlers[mineId] : null;

  return (
    <>
      <section className="mb-4">
        <h2 className="mb-1 text-sm font-medium text-neutral-300">Who you are offering</h2>
        <p className="mb-2 text-[11px] text-neutral-500">
          Their contract goes with them. What somebody is worth here is what they draw, less what they are
          owed.
        </p>
        <div className="flex flex-wrap gap-1">
          {mine.map((w) => (
            <button
              key={w.id}
              type="button"
              data-testid={`trade-mine-${w.id}`}
              onClick={() => {
                setMineId(w.id);
                setAnswer(null);
              }}
              className={`rounded px-2 py-1 text-[11px] ${
                mineId === w.id ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              {w.name}
              <span className="ml-1 text-neutral-500">{tradeWorth(w, world.settings)}</span>
            </button>
          ))}
        </div>
        {chosen && (
          <p className="mt-1 text-[11px] text-neutral-500">
            {chosen.name} is owed <Money amount={severanceOwed(chosen.contract)} /> guaranteed
            {chosen.contract && <> on {chosen.contract.weeksRemaining} weeks</>}.
          </p>
        )}
      </section>

      <section className="mb-4">
        <h2 className="mb-2 text-sm font-medium text-neutral-300">Who you are calling</h2>
        {partners.length === 0 ? (
          <p className="text-[11px] text-amber-400">
            Nobody is taking your calls this week. Everybody you asked has already said no.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {partners.map((r) => (
              <button
                key={r.id}
                type="button"
                data-testid={`trade-rival-${r.id}`}
                onClick={() => {
                  setRivalId(r.id);
                  setTheirsId(null);
                  setAnswer(null);
                }}
                className={`rounded px-2 py-1 text-[11px] ${
                  rivalId === r.id ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                }`}
              >
                {r.name}
              </button>
            ))}
          </div>
        )}
      </section>

      {rival && (
        <section className="mb-4">
          <h2 className="mb-2 text-sm font-medium text-neutral-300">What you want back</h2>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => {
                setTheirsId(null);
                setAnswer(null);
              }}
              className={`rounded px-2 py-1 text-[11px] ${
                !theirsId ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300'
              }`}
            >
              Nothing — just move him on
            </button>
            {theirRoster.slice(0, 24).map((w) => (
              <button
                key={w.id}
                type="button"
                data-testid={`trade-theirs-${w.id}`}
                onClick={() => {
                  setTheirsId(w.id);
                  setAnswer(null);
                }}
                className={`rounded px-2 py-1 text-[11px] ${
                  theirsId === w.id
                    ? 'bg-emerald-600 text-white'
                    : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                }`}
              >
                {w.name}
                <span className="ml-1 text-neutral-500">{tradeWorth(w, world.settings)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <button
        type="button"
        data-testid="trade-propose"
        disabled={!mineId || !rivalId}
        onClick={() => setAnswer(propose(mineId!, rivalId!, theirsId, 0))}
        className="w-full rounded bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-500 disabled:bg-neutral-800 disabled:text-neutral-600"
      >
        Make the call
      </button>

      {answer && (
        <p
          data-testid="trade-answer"
          className={`mt-2 text-xs ${answer.accepted ? 'text-emerald-400' : 'text-amber-400'}`}
        >
          {answer.reason}
        </p>
      )}
    </>
  );
}

function TelevisionTab() {
  const world = useGameStore((s) => s.world);
  if (!world) return null;

  const latestTv = world.tvHistory[0];
  const latestChart = world.ratingsChart[0];
  const playerRow = latestChart ? playerChartPosition(latestChart.rows) : undefined;

  const houseStyles = new Map([world.promotion, ...world.rivals].map((p) => [p.name, identityOf(p.identity)]));
  // And how they are doing, which is the other half of reading a chart.
  const health = new Map(world.rivals.map((p) => [p.name, foldRisk(p.weeksInTheRed, world.settings)]));

  if (!latestChart) {
    return (
      <p className="rounded border border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-500">
        Nothing has aired yet. Run a show.
      </p>
    );
  }

  return (
    <section>
      <h2 className="mb-2 text-sm font-medium text-neutral-300">
        The week in television — week {latestChart.week}
        {latestTv && wonTheNight(latestTv.results, world.promotion.id) && (
          <span className="ml-2 text-[11px] text-emerald-400">you won the wrestling night</span>
        )}
      </h2>
      {playerRow && (
        <p className="mb-2 text-xs text-neutral-400">
          You finished <span className="font-medium text-neutral-100">#{playerRow.rank}</span> on the whole dial with a{' '}
          {playerRow.rating.toFixed(1)} — {tvVerdict(playerRow.rating, world.settings)}.
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
    </section>
  );
}

/**
 * A champion is hurt and the belt is waiting on a decision.
 *
 * Deliberately not a warning: every option states plainly what it gains and
 * what it costs, and none of them says which one to take. It also does not
 * hold the week open the way a weather call does — the show goes on — but it
 * does expire, and the panel says so, because a decision that decides itself
 * without the player knowing it was running out is the kind of thing
 * CLAUDE.md exists to prevent.
 */
function ChampionCallPanel() {
  const world = useGameStore((s) => s.world);
  const answer = useGameStore((s) => s.answerChampionCall);
  const [interimId, setInterimId] = useState<string>('');
  if (!world?.pendingChampionCall) return null;

  const call = world.pendingChampionCall;
  const title = world.titles.find((t) => t.id === call.titleId);
  if (!title) return null;

  const options = championInjuryOptions(title);
  const weeksLeft = world.settings.championInjuryGraceWeeks - (world.week - call.raisedWeek);
  // Anybody fit, in the right division, who is not the champion.
  const candidates = world.promotion.rosterIds
    .map((id) => world.wrestlers[id])
    .filter(
      (w): w is NonNullable<typeof w> =>
        Boolean(w) &&
        !w!.injury &&
        w!.role === 'wrestler' &&
        !call.championIds.includes(w!.id) &&
        (title.division === 'open' ||
          (title.division === 'womens' ? w!.gender === 'f' : w!.gender === 'm')),
    )
    .sort((a, b) => b.popularity - a.popularity);

  return (
    <section className="mb-3 rounded-lg border border-amber-800 bg-amber-950/30 p-3" data-testid="champion-call">
      <div className="text-xs uppercase tracking-wide text-amber-400">The champion is hurt</div>
      <h2 className="mt-1 text-sm font-semibold">
        {call.championName} and the {call.titleName}
      </h2>
      <p className="mt-1 text-xs text-neutral-300">
        {call.injuryText}. Out {call.outFor}.
      </p>
      <p className="mt-1 text-[11px] text-neutral-500">
        {weeksLeft <= 1
          ? 'Decide this week, or the company vacates it for you.'
          : `${weeksLeft} weeks to decide before the company vacates it for you.`}
      </p>

      <div className="mt-2 flex flex-col gap-1.5">
        {options.map((option) => (
          <div key={option.id} className="rounded border border-neutral-800 bg-neutral-900 p-2">
            <div className="text-xs font-medium">{option.label}</div>
            <div className="mt-0.5 text-[11px] text-emerald-300/80">{option.gains}</div>
            <div className="text-[11px] text-rose-300/80">{option.costs}</div>

            {option.id === 'interim' && (
              <select
                aria-label="Who holds the interim championship"
                data-testid="interim-pick"
                value={interimId}
                onChange={(e) => setInterimId(e.target.value)}
                className="mt-1.5 w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs"
              >
                <option value="">Choose who carries it…</option>
                {candidates.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              data-testid={`champion-call-${option.id}`}
              onClick={() => answer(option.id, interimId || undefined)}
              disabled={option.id === 'interim' && !interimId}
              className="mt-1.5 w-full rounded bg-neutral-800 px-3 py-2 text-xs font-medium hover:bg-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600"
            >
              {option.label}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * The pattern — what the company runs, on which nights, and how often the big
 * one comes round.
 *
 * The one screen in the game where the player decides how hard everybody
 * works. §0 applies with force here: the office describes what the pattern
 * feels like from the locker room and never says which one is correct, because
 * the fifth night a week is a real strategy that a deep enough roster can
 * survive and a mistake for everybody else.
 */
function ScheduleTab() {
  const world = useGameStore((s) => s.world);
  const setShowsPerWeek = useGameStore((s) => s.setShowsPerWeek);
  const setPPVCadence = useGameStore((s) => s.setPPVCadence);
  const renameShow = useGameStore((s) => s.renameShow);
  const setShowDay = useGameStore((s) => s.setShowDay);
  if (!world) return null;

  const schedule = scheduleOf(world.promotion, world.settings);
  const count = showsPerWeek(schedule);
  const off = nightsOff(schedule);
  const weeksOut = weeksUntilBigShow(world.week, schedule, world.settings);
  const nextBig = bigShowName(world.week + weeksOut, schedule, world.settings);

  const cadences: { id: PPVCadence; label: string; blurb: string }[] = [
    { id: 'monthly', label: 'Every month', blurb: 'Twelve a year. Something to build to, always.' },
    { id: 'biMonthly', label: 'Every other month', blurb: 'Six a year, and each one is a bigger deal for being rarer.' },
    { id: 'annual', label: 'Once a year', blurb: 'One night the whole year points at.' },
  ];

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
        <h2 className="mb-1 text-sm font-semibold">The months ahead</h2>
        <p className="mb-2 text-xs text-neutral-500">
          Every night of every week. Joint shows in May and November, the Crucible in August.
        </p>
        <CalendarStrip months={2} />
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
        <h2 className="mb-1 text-sm font-semibold">Nights a week</h2>
        <p className="mb-2 text-xs text-neutral-500">{scheduleLine(schedule, world.settings)}</p>
        <div className="flex gap-1">
          {Array.from({ length: world.settings.scheduleMaxShows }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              data-testid={`shows-per-week-${n}`}
              onClick={() => setShowsPerWeek(n)}
              className={`flex-1 rounded px-2 py-2 text-sm font-semibold ${
                n === count ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-neutral-600">
          {off.length > 0
            ? `Dark on ${off.join(', ')}.`
            : 'Nobody in this company has a night off.'}
        </p>
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
        <h2 className="mb-2 text-sm font-semibold">The shows</h2>
        <div className="space-y-2">
          {schedule.shows.map((show) => (
            <div key={show.id} className="rounded border border-neutral-800 bg-neutral-950 p-2">
              <div className="mb-1 flex items-center gap-2">
                <input
                  value={show.name}
                  onChange={(e) => renameShow(show.id, e.target.value)}
                  data-testid={`show-name-${show.id}`}
                  className="min-w-0 flex-1 rounded bg-neutral-800 px-2 py-1 text-sm text-neutral-100"
                />
                {show.televised && (
                  <span
                    className="shrink-0 rounded bg-sky-900 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-300"
                    title="The one the cameras are at, and the only one you book. Everything else is a house show the office runs."
                  >
                    TV
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {DAYS.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setShowDay(show.id, day)}
                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                      show.day === day
                        ? 'bg-neutral-200 text-neutral-900'
                        : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                    }`}
                  >
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
        <h2 className="mb-2 text-sm font-semibold">The big one</h2>
        <div className="space-y-1">
          {cadences.map((option) => (
            <button
              key={option.id}
              type="button"
              data-testid={`ppv-cadence-${option.id}`}
              onClick={() => setPPVCadence(option.id)}
              className={`w-full rounded px-2 py-2 text-left ${
                schedule.ppvCadence === option.id
                  ? 'bg-amber-900/40 ring-1 ring-amber-600'
                  : 'bg-neutral-800 hover:bg-neutral-700'
              }`}
            >
              <div className="text-xs font-semibold text-neutral-100">{option.label}</div>
              <div className="text-[11px] text-neutral-500">{option.blurb}</div>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-neutral-600">
          {weeksOut === 0
            ? `${nextBig ?? 'The big one'} is this week.`
            : `${nextBig ?? 'The next one'} in ${weeksOut} ${weeksOut === 1 ? 'week' : 'weeks'}. It replaces the television that week rather than being added to it.`}
        </p>
      </section>
    </div>
  );
}

/**
 * Putting a joint pay-per-view to somebody yourself (§16).
 *
 * The moods are shown because a booker would know the lay of the land — who is
 * above him, who resents him, who would jump at it. That is information about
 * the business, not a warning about the decision: what the game still will not
 * tell you is how the night goes, and that is the part that can ruin you.
 */
function JointShowsTab() {
  const world = useGameStore((s) => s.world)!;
  const propose = useGameStore((s) => s.proposeSupershow);

  const cooldown = world.settings.supershowProposalCooldownWeeks;
  const since =
    world.lastSupershowApproachWeek === null
      ? Infinity
      : world.week - world.lastSupershowApproachWeek;
  const waiting = Math.max(0, cooldown - since);
  const busy = Boolean(world.pendingSupershow || world.lastSupershow);

  const open = world.rivals.filter((r) => r.closedWeek === null && r.rosterIds.length >= 4);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] text-neutral-400">
        One card, both rosters, and the belts stay where they are. It is the most money anybody
        makes all year — and the sim picks the winners, on their half of the card as much as yours.
      </p>

      {busy && (
        <p className="rounded border border-neutral-700 bg-neutral-900 p-2 text-[11px] text-neutral-400">
          There is already a joint show on the table. Deal with that one first.
        </p>
      )}
      {!busy && waiting > 0 && (
        <p className="rounded border border-neutral-700 bg-neutral-900 p-2 text-[11px] text-neutral-400">
          You have been round the houses recently. {waiting} {waiting === 1 ? 'week' : 'weeks'}{' '}
          before anybody will take another call.
        </p>
      )}

      {open.map((rival) => {
        const resentment = Math.max(0, Math.min(100, (rival.rating - world.promotion.rating) / 2));
        const mood = moodFor(coopAppetite(world.promotion, rival, resentment, world.settings), resentment, world.settings);
        return (
          <div key={rival.id} className="rounded border border-neutral-700 bg-neutral-900 p-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-neutral-200">{rival.name}</span>
              <span className="text-[10px] uppercase tracking-wide text-neutral-500">
                rating {Math.round(rival.rating)}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-neutral-400">{moodLine(mood, rival.name)}</p>
            <button
              type="button"
              disabled={busy || waiting > 0}
              onClick={() => propose(rival.id)}
              className={`mt-2 w-full rounded px-3 py-1.5 text-xs font-medium ${
                busy || waiting > 0
                  ? 'bg-neutral-800 text-neutral-600'
                  : 'bg-amber-600 text-black'
              }`}
            >
              Put a show to them
            </button>
          </div>
        );
      })}
    </div>
  );
}
