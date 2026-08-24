// The office — §8.1. What the week brings you before a single thing is
// booked: the story that needs a decision, who a rival is talking to, and
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
import { grudgeAgainst, grudgeLine } from '../../engine/world/grudges';
import { leverageReason } from '../../engine/career/leverage';
import { useGameStore } from '../../state/store';
import { cardSizeFor } from '../../state/world';
import { tvVerdict, wonTheNight, playerChartPosition } from '../../engine/world/tvRatings';
import { temptationLabel, approachLine, responseOutcome, type PoachingResponse } from '../../engine/world/poaching';
import { CAREER_STATUS_LABELS } from '../../engine/career/status';
import { mostRecentDeath, stillHeldAgainstUs } from '../../engine/career/onOurWatch';
import { moodBand, moodLabel, moraleSummary, troubleInTheRoom } from '../../engine/career/morale';
import {
  CARD_STATUS_LABELS,
  hotCommodities,
  mainEventPicture,
  trajectoryLabel,
} from '../../engine/career/cardStatus';
import { egoLabel } from '../../engine/career/ego';
import { awardById } from '../../engine/career/awards';
import { strikeWarning } from '../../engine/world/mandates';
import { championInjuryOptions, championCallLine, type ChampionInjuryChoice } from '../../engine/world/titleDefence';
import { TITLE_MEMORIAL_OPTIONS, type TitleMemorialChoiceId } from '../../engine/world/titleMemorial';
import { loanTermsFor, LOAN_TIER_LABELS, type LoanTier } from '../../engine/economy/loan';
import { RIVAL_MOVE_OPTIONS, type RivalMoveChoiceId } from '../../engine/world/rivalMove';
import { CONFRONTATION_CALL_OPTIONS, type ConfrontationCallChoiceId } from '../../engine/world/confrontationCall';
import { broadcasterById } from '../../data/broadcasters';
import { sponsorById } from '../../data/sponsors';
import { GIMMICKS, gimmickCategories } from '../../data/gimmicks';
import { GROUP_GIMMICKS, tagTeamGimmicks, factionGimmicks } from '../../data/groupGimmicks';
import { canFormGroup, groupOf, TEAM_PROBLEM_TEXT } from '../../engine/world/tagTeams';
import { PaperDoll } from '../paperdoll/PaperDoll';
import { Money } from '../components/display';
import { promotionTheme } from '../components/chrome';
import { billedAs } from '../../engine/generate/nickname';
import { DialogueCard } from '../dialogue/DialogueCard';
import type { PendingEvent } from '../../engine/events/types';
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
import { foldRisk, FOLD_RISK_LABELS } from '../../engine/world/rivalEconomy';
import type { Wrestler } from '../../engine/types';
import { contractUrgency } from '../../engine/economy/contracts';
import { severanceOwed, guaranteeLabel, releaseRequestLine } from '../../engine/economy/termination';
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
    (world.pendingFoldPicks ? 1 : 0) +
    (world.pendingLoanOffer ? 1 : 0) +
    (world.pendingBuyoutOffer ? 1 : 0) +
    (world.yearInReview ? 1 : 0) +
    (world.mandate ? 1 : 0) +
    (world.pendingBroadcastOffer ? 1 : 0) +
    world.pendingSponsorOffers.length +
    world.lastDealsLost.length +
    (world.lastMandateOutcome ? 1 : 0) +
    (world.lastEventOutcome ? 1 : 0);
  const inContracts =
    world.pendingRenewals.length +
    world.approachOffers.length +
    world.releaseRequests.length +
    world.renewalTalks.length +
    world.signingTalks.length +
    world.coldMeetings.length;
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
          {world.promotion.name} carries on without you — but every bit of what you built lives on right there on
          the Legacy and Records screens.
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
          {world.promotion.name} closed its doors in week {world.folded.week}. That whole roster is loose in the
          business now, and the full record of what you built lives on the Legacy and Rankings screens.
        </p>
      </section>
    );
  }

  const healthyRoster = world.promotion.rosterIds
    .map((id) => world.wrestlers[id])
    .filter((w) => w && !w.injury && w.health >= world.settings.rivalMinHealthToBook).length;
  const cardSize = cardSizeFor('television', world);
  const thin = healthyRoster < cardSize * 2;

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
          Only {healthyRoster} can work — not enough for a card of {cardSize}
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
  const pickFolded = useGameStore((s) => s.pickFoldedWrestler);
  const finishPicking = useGameStore((s) => s.finishFoldPicking);
  // Keyed to which event it's open for, not a bare boolean: a branching
  // conversation keeps the same eventId across nodes and should stay open,
  // but a brand new event firing later needs its own "Talk it through" tap.
  const [openEventId, setOpenEventId] = useState<string | null>(null);
  if (!world) return null;

  // Everybody unhappy enough to be a problem, worst first. `troubleInTheRoom`
  // has existed since the morale system was written and nothing ever called
  // it, so the one question a booker most wants answered — who is about to
  // become my problem — had no page. Reading it off the roster card meant
  // opening twenty cards.
  const unhappy = troubleInTheRoom(
    world.promotion.rosterIds.map((id) => world.wrestlers[id]).filter((w): w is Wrestler => Boolean(w) && !w!.deceased),
    world.settings,
  ).slice(0, 5);

  // Who is at the top and who is coming. `mainEventPicture` and
  // `hotCommodities` were written with the card-status system and neither ever
  // had a caller, so the view a booker actually plans from — not the roster
  // sorted by a number, but "who is in it" — existed only in the engine.
  const active = world.promotion.rosterIds
    .map((id) => world.wrestlers[id])
    .filter((w): w is Wrestler => Boolean(w) && !w!.deceased);
  const picture = mainEventPicture(active, world.promotion, world.settings).slice(0, 6);
  const inThePicture = new Set(picture.map((c) => c.wrestlerId));
  // Anybody moving who is not already up there. The undercard half of the
  // same question, and the reason to look at somebody early.
  const climbing = hotCommodities(active, world.promotion, world.settings)
    .filter((c) => !inThePicture.has(c.wrestlerId))
    .slice(0, 4);

  return (
    <>
      <ChampionCallPanel />
      <TitleMemorialPanel />
      <RivalMovePanel />
      <ConfrontationCallPanel />
      <LoanOfferPanel />
      <ActiveLoanNotice />
      <BuyoutOfferPanel />

      {picture.length > 0 && (
        <section className="mb-3">
          <h2 className="mb-2 text-sm font-medium text-neutral-300">The main event picture</h2>
          <div className="flex flex-col gap-1">
            {picture.map((c) => {
              const person = world.wrestlers[c.wrestlerId];
              if (!person) return null;
              const going = trajectoryLabel(person, world.settings);
              return (
                <div
                  key={c.wrestlerId}
                  data-testid={`picture-${c.wrestlerId}`}
                  className="flex items-baseline justify-between gap-2 rounded border border-neutral-800 bg-neutral-900 px-2 py-1.5"
                >
                  <span className="truncate text-xs font-medium">{person.name}</span>
                  <span className="shrink-0 text-[10px] text-neutral-500">
                    {CARD_STATUS_LABELS[c.status]}
                    {going && (
                      <span className={going === 'On the way up' ? ' text-emerald-400' : ' text-rose-400'}>
                        {' '}· {going}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
          {climbing.length > 0 && (
            <p className="mt-1 text-[10px] leading-snug text-neutral-500">
              Also moving:{' '}
              {climbing
                .map((c) => world.wrestlers[c.wrestlerId]?.name)
                .filter(Boolean)
                .join(', ')}
              .
            </p>
          )}
        </section>
      )}

      {unhappy.length > 0 && (
        <section className="mb-3">
          <h2 className="mb-2 text-sm font-medium text-neutral-300">Trouble in the room</h2>
          <div className="flex flex-col gap-1">
            {unhappy.map((w) => (
              <div
                key={w.id}
                data-testid={`trouble-${w.id}`}
                className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1.5"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-xs font-medium">{w.name}</span>
                  <span className="shrink-0 text-[10px] text-rose-400">
                    {moodLabel(moodBand(w.morale, world.settings))}
                  </span>
                </div>
                {/* Why, in the words the morale system itself used. One place
                    computes the arithmetic and the sentence, so the page
                    cannot drift from what is actually happening to them. */}
                <div className="text-[10px] leading-snug text-neutral-500">
                  {moraleSummary(w, world.settings)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* A company has closed. Its belts are already vacant — see
          TitleMemorialPanel/the wire — and its roster is here, open for the
          booker to pick through one at a time: anybody they want, and a
          rival wanting them too is what makes it a contest. */}
      {world.pendingFoldPicks && (
        <section className="mb-3 rounded border border-sky-800 bg-sky-950/30 p-3" data-testid="fold-picks">
          <div className="text-xs uppercase tracking-wide text-sky-400">A promotion has closed</div>
          <h2 className="mt-1 text-sm font-semibold">{world.pendingFoldPicks.fromPromotionName} is gone</h2>
          <p className="mt-1 text-xs text-neutral-300">
            {world.pendingFoldPicks.wrestlerIds.length} of their wrestlers are loose in the business right now.
            Pick anybody you want — if a rival wants them too, it goes straight to a bidding war. Whoever is left
            standing when you are done goes to free agency.
          </p>
          {world.foldBidQueue.length > 0 && (
            <p className="mt-1 text-[11px] text-amber-300">
              {world.foldBidQueue.length} contested {world.foldBidQueue.length === 1 ? 'pick is' : 'picks are'}{' '}
              queued for a bidding war, one at a time.
            </p>
          )}

          <div className="mt-2 flex flex-col gap-1">
            {world.pendingFoldPicks.wrestlerIds.map((id) => {
              const person = world.wrestlers[id];
              if (!person) return null;
              return (
                <div
                  key={id}
                  data-testid={`fold-pick-row-${id}`}
                  className="flex items-center justify-between gap-2 rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium">{person.name}</div>
                    <div className="text-[10px] text-neutral-500">{CAREER_STATUS_LABELS[person.careerStatus]}</div>
                  </div>
                  <button
                    type="button"
                    data-testid={`pick-folded-${id}`}
                    onClick={() => pickFolded(id)}
                    className="shrink-0 rounded bg-sky-700 px-2 py-1 text-[11px] font-medium text-white hover:bg-sky-600"
                  >
                    Pick
                  </button>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            data-testid="finish-fold-picking"
            onClick={finishPicking}
            className="mt-3 rounded bg-neutral-800 px-3 py-1.5 text-xs hover:bg-neutral-700"
          >
            Done — the rest go to free agency
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
          <button
            type="button"
            data-testid="event-talk"
            onClick={() => setOpenEventId(world.pendingEvent!.eventId)}
            className="mt-2 rounded bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700"
          >
            Talk it through
          </button>
        </article>
      ) : (
        <p className="rounded border border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-500">
          Dead quiet week around the office. Not a single soul at your door.
        </p>
      )}

      {world.pendingEvent && openEventId === world.pendingEvent.eventId && (
        <PendingEventDialogue
          pending={world.pendingEvent}
          wrestler={
            world.pendingEvent.speaker !== 'narrator'
              ? world.wrestlers[
                  world.pendingEvent.speaker === 'secondary'
                    ? (world.pendingEvent.subjects.secondaryId ?? '')
                    : (world.pendingEvent.subjects.primaryId ?? '')
                ]
              : undefined
          }
          promotionName={world.promotion.name}
          onChoose={choose}
          onClose={() => setOpenEventId(null)}
        />
      )}
    </>
  );
}

/** A creative event, on the conversation screen. Root beat or a follow-up node — same component either way. */
function PendingEventDialogue({
  pending,
  wrestler,
  promotionName,
  onChoose,
  onClose,
}: {
  pending: PendingEvent;
  wrestler: Wrestler | undefined;
  promotionName: string;
  onChoose: (optionId: string) => void;
  onClose: () => void;
}) {
  const theme = promotionTheme(useGameStore((s) => s.world!.promotion.identity));
  return (
    <DialogueCard
      speaker={wrestler ? { kind: 'wrestler', wrestlerId: wrestler.id } : { kind: 'narrator' }}
      wrestler={wrestler}
      speakerName={wrestler ? billedAs(wrestler) : pending.title}
      body={pending.body}
      choices={pending.options}
      onChoose={onChoose}
      history={pending.history.map((h) => ({ body: h.body, choiceLabel: h.choiceLabel }))}
      theme={theme}
      promotionName={promotionName}
      onClose={onClose}
    />
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
  const answerRenewalInterest = useGameStore((s) => s.answerRenewalInterest);
  const answerRenewalWish = useGameStore((s) => s.answerRenewalWish);
  const answerApproach = useGameStore((s) => s.answerApproach);
  const [approachNote, setApproachNote] = useState<string | null>(null);
  const answerReleaseRequest = useGameStore((s) => s.answerReleaseRequest);
  const [openReleaseId, setOpenReleaseId] = useState<string | null>(null);
  const [openApproachId, setOpenApproachId] = useState<string | null>(null);
  const [openRenewalTalkId, setOpenRenewalTalkId] = useState<string | null>(null);
  const chooseSigningGimmick = useGameStore((s) => s.chooseSigningGimmick);
  const declineSigningPairing = useGameStore((s) => s.declineSigningPairing);
  const formSigningGroup = useGameStore((s) => s.formSigningGroup);
  const [openSigningTalkId, setOpenSigningTalkId] = useState<string | null>(null);
  const [pickedGimmickId, setPickedGimmickId] = useState('');
  const [pickedGroupId, setPickedGroupId] = useState('');
  const [pickedPartnerIds, setPickedPartnerIds] = useState<string[]>([]);
  const answerColdMeeting = useGameStore((s) => s.answerColdMeeting);
  const chooseColdMeetingGimmick = useGameStore((s) => s.chooseColdMeetingGimmick);
  const [openColdMeetingId, setOpenColdMeetingId] = useState<string | null>(null);
  const [pickedColdGimmickId, setPickedColdGimmickId] = useState('');
  if (!world) return null;
  const theme = promotionTheme(world.promotion.identity);

  const wrestler = (id?: string): Wrestler | undefined => (id ? world.wrestlers[id] : undefined);

  // What this company did, and how much of it the business is still holding
  // against it at the table. Zero once it has faded, and then this page reads
  // exactly as it did before any of it happened.
  const deathsOnUs = world.promotion.deathsOnOurWatch ?? [];
  const heldAgainstUs = stillHeldAgainstUs(deathsOnUs, world.week, world.settings);
  const buriedByUs = mostRecentDeath(deathsOnUs);

  // Read off the one wire rather than a second list kept alongside it. The
  // results page and this tab now cannot disagree about who left.
  const departures = world.weeklyNews.filter((n) => n.kind === 'departure').map((n) => n.text);

  if (
    world.pendingRenewals.length === 0 &&
    world.approachOffers.length === 0 &&
    world.releaseRequests.length === 0 &&
    world.renewalTalks.length === 0 &&
    world.signingTalks.length === 0 &&
    world.coldMeetings.length === 0 &&
    departures.length === 0
  ) {
    return (
      <p className="rounded border border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-500">
        Every single deal is signed and nobody out there is being courted. Enjoy the quiet while it lasts.
      </p>
    );
  }

  return (
    <>
      {/* Somebody wants out. Granting it costs nothing and puts them on
          ninety days; refusing keeps them, and they get unhappier every week
          you make them stay. */}
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
                        Wants out. Willing to tear up what they are owed —{' '}
                        <Money amount={severanceOwed(person.contract)} /> of guarantees.
                      </div>
                    </div>
                  </div>
                  <div className="mt-2">
                    <button
                      type="button"
                      data-testid={`release-talk-${request.wrestlerId}`}
                      onClick={() => setOpenReleaseId(request.wrestlerId)}
                      className="rounded bg-neutral-800 px-3 py-1 text-[11px] text-neutral-200 hover:bg-neutral-700"
                    >
                      Talk to them
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {world.releaseRequests
        .filter((request) => request.wrestlerId === openReleaseId)
        .map((request) => {
          const person = wrestler(request.wrestlerId);
          if (!person) return null;
          return (
            <DialogueCard
              key={request.wrestlerId}
              speaker={{ kind: 'wrestler', wrestlerId: person.id }}
              wrestler={person}
              speakerName={person.name}
              body={releaseRequestLine(person, request.openedWeek)}
              choices={[
                {
                  id: 'grant',
                  label: 'Let them go',
                  gains: "They're free of what's owed",
                  costs: 'Ninety days, and no company — including this one — can sign them',
                },
                {
                  id: 'refuse',
                  label: 'They honor the deal',
                  gains: 'You keep them on the roster',
                  costs: 'They resent it, and they remember',
                },
              ]}
              onChoose={(choiceId) => {
                answerReleaseRequest(request.wrestlerId, choiceId === 'grant');
                setOpenReleaseId(null);
              }}
              theme={theme}
              promotionName={world.promotion.name}
              onClose={() => setOpenReleaseId(null)}
            />
          );
        })}

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
      {/* The forced cold-meeting — an act has sat ice cold for
          coldMeetingTriggerWeeks running (resolveWeek's weeksIceCold
          clock, engine/sim/freshness.ts). Exactly two ways out: relaunch
          the character, or cut them loose. See state/world.ts's
          ColdMeeting. Listed above "New arrivals" — this is the one that
          actually needs the booker's attention this week. */}
      {world.coldMeetings.length > 0 && (
        <section className="mb-4">
          <h2 className="mb-2 text-sm font-medium text-rose-400">Nobody's buying it anymore</h2>
          <div className="flex flex-col gap-2">
            {world.coldMeetings.map((meeting) => {
              const person = wrestler(meeting.wrestlerId);
              if (!person) return null;
              return (
                <article
                  key={meeting.wrestlerId}
                  data-testid={`cold-meeting-${meeting.wrestlerId}`}
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
                      <div className="text-[11px] text-rose-400">Getting nothing back from the crowd — a decision is due</div>
                    </div>
                  </div>
                  <div className="mt-2">
                    <button
                      type="button"
                      data-testid={`cold-meeting-open-${meeting.wrestlerId}`}
                      onClick={() => {
                        setPickedColdGimmickId(person.gimmick.id);
                        setOpenColdMeetingId(meeting.wrestlerId);
                      }}
                      className="rounded bg-neutral-800 px-3 py-1 text-[11px] text-neutral-200 hover:bg-neutral-700"
                    >
                      Talk to them
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {world.coldMeetings
        .filter((meeting) => meeting.wrestlerId === openColdMeetingId)
        .map((meeting) => {
          const person = wrestler(meeting.wrestlerId);
          if (!person) return null;

          if (meeting.stage === 'decide') {
            return (
              <DialogueCard
                key={`${meeting.wrestlerId}-decide`}
                speaker={{ kind: 'wrestler', wrestlerId: person.id }}
                wrestler={person}
                speakerName={person.name}
                body="I don't know what I'm supposed to be out there anymore. The crowd's not with me and it hasn't been for weeks. What are we doing about this?"
                choices={[
                  {
                    id: 'regimmick',
                    label: 'Try a new direction',
                    gains: 'A real relaunch — a clean slate on the gimmick',
                    costs: 'No guarantee it catches on any better than the last one',
                  },
                  {
                    id: 'release',
                    label: 'Cut them loose',
                    gains: 'One less cold act dragging the card',
                    costs: 'Same terms as any other release',
                  },
                ]}
                onChoose={(choiceId) => {
                  answerColdMeeting(meeting.wrestlerId, choiceId as 'regimmick' | 'release');
                  // "Try a new direction" advances this same conversation to
                  // the relaunch picker — stays open so the next render
                  // picks up the new stage. Only "release" actually ends it.
                  if (choiceId !== 'regimmick') setOpenColdMeetingId(null);
                }}
                theme={theme}
                promotionName={world.promotion.name}
                onClose={() => setOpenColdMeetingId(null)}
              />
            );
          }

          const selected = GIMMICKS.find((g) => g.id === pickedColdGimmickId) ?? person.gimmick;
          return (
            <DialogueCard
              key={`${meeting.wrestlerId}-relaunch`}
              speaker={{ kind: 'booker' }}
              speakerName={world.promotion.name}
              body={`A real relaunch for ${person.name} — what's the new direction?`}
              subtext={selected.concept}
              beforeChoices={
                <select
                  aria-label="Pick a new gimmick"
                  data-testid="cold-meeting-gimmick-pick"
                  value={pickedColdGimmickId}
                  onChange={(e) => setPickedColdGimmickId(e.target.value)}
                  className="w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs text-neutral-100"
                >
                  {gimmickCategories().map((category) => (
                    <optgroup key={category} label={category}>
                      {GIMMICKS.filter((g) => g.category === category).map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              }
              choices={[
                {
                  id: 'confirm',
                  label: pickedColdGimmickId === person.gimmick.id ? 'Relaunch it as-is' : `Relaunch as ${selected.name}`,
                  gains: 'A clean slate on the gimmick meter, starting tonight',
                  costs: 'Nothing — this is what the meeting was for',
                },
              ]}
              onChoose={() => {
                chooseColdMeetingGimmick(meeting.wrestlerId, pickedColdGimmickId || person.gimmick.id);
                setOpenColdMeetingId(null);
              }}
              theme={theme}
              promotionName={world.promotion.name}
              onClose={() => setOpenColdMeetingId(null)}
            />
          );
        })}

      {/* "Meet the booker" — opened once per new signee (signFreeAgent, a
          folded-roster pickup, or winning a bidding war). Every generated
          wrestler already has a random gimmick; this is the booker actually
          deciding instead of living with the roll, and optionally pairing
          them into a tag team or faction. See state/world.ts's SigningTalk. */}
      {world.signingTalks.length > 0 && (
        <section className="mb-4">
          <h2 className="mb-2 text-sm font-medium text-neutral-300">New arrivals</h2>
          <div className="flex flex-col gap-2">
            {world.signingTalks.map((talk) => {
              const person = wrestler(talk.wrestlerId);
              if (!person) return null;
              return (
                <article
                  key={talk.wrestlerId}
                  data-testid={`signing-talk-${talk.wrestlerId}`}
                  className="rounded border border-emerald-900/60 bg-neutral-900 p-2"
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
                        {talk.stage === 'pickGimmick' ? 'Just signed — meet them' : 'Anybody to put them with?'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2">
                    <button
                      type="button"
                      data-testid={`signing-talk-open-${talk.wrestlerId}`}
                      onClick={() => {
                        setPickedGimmickId(person.gimmick.id);
                        setPickedGroupId('');
                        setPickedPartnerIds([]);
                        setOpenSigningTalkId(talk.wrestlerId);
                      }}
                      className="rounded bg-neutral-800 px-3 py-1 text-[11px] text-neutral-200 hover:bg-neutral-700"
                    >
                      Talk to them
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {world.signingTalks
        .filter((talk) => talk.wrestlerId === openSigningTalkId)
        .map((talk) => {
          const person = wrestler(talk.wrestlerId);
          if (!person) return null;

          if (talk.stage === 'pickGimmick') {
            const selected = GIMMICKS.find((g) => g.id === pickedGimmickId) ?? person.gimmick;
            return (
              <DialogueCard
                key={`${talk.wrestlerId}-gimmick`}
                speaker={{ kind: 'booker' }}
                speakerName={world.promotion.name}
                body={`Glad to have ${person.name} in the building. What's the character?`}
                subtext={selected.concept}
                beforeChoices={
                  <select
                    aria-label="Pick a gimmick"
                    data-testid="signing-gimmick-pick"
                    value={pickedGimmickId}
                    onChange={(e) => setPickedGimmickId(e.target.value)}
                    className="w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs text-neutral-100"
                  >
                    {gimmickCategories().map((category) => (
                      <optgroup key={category} label={category}>
                        {GIMMICKS.filter((g) => g.category === category).map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                }
                choices={[
                  {
                    id: 'confirm',
                    label: pickedGimmickId === person.gimmick.id ? 'Keep it as-is' : `Go with ${selected.name}`,
                    gains: 'A settled character to build the debut around',
                    costs: 'Nothing — this is free at signing',
                  },
                ]}
                onChoose={() => chooseSigningGimmick(talk.wrestlerId, pickedGimmickId || person.gimmick.id)}
                theme={theme}
                promotionName={world.promotion.name}
                onClose={() => setOpenSigningTalkId(null)}
              />
            );
          }

          const eligiblePartners = world.promotion.rosterIds
            .map((id) => world.wrestlers[id])
            .filter(
              (w): w is NonNullable<typeof w> =>
                Boolean(w) && w!.id !== person.id && w!.gender === person.gender && !groupOf(world.stables, w!.id),
            );
          const selectedGroup = GROUP_GIMMICKS.find((g) => g.id === pickedGroupId);
          const wantedCount = selectedGroup?.kind === 'tagTeam' ? 1 : 2;
          const countOk = selectedGroup
            ? selectedGroup.kind === 'tagTeam'
              ? pickedPartnerIds.length === 1
              : pickedPartnerIds.length >= wantedCount
            : false;
          const members = selectedGroup ? [person, ...pickedPartnerIds.map((id) => world.wrestlers[id])] : [];
          const check =
            selectedGroup && countOk
              ? canFormGroup(members, world.stables, new Set(world.promotion.rosterIds), selectedGroup.name)
              : null;
          const canForm = Boolean(selectedGroup) && countOk && check?.ok === true;

          return (
            <DialogueCard
              key={`${talk.wrestlerId}-pairing`}
              speaker={{ kind: 'booker' }}
              speakerName={world.promotion.name}
              body={`Anybody you want to put ${person.name} together with — a tag team, a faction?`}
              subtext={selectedGroup?.concept}
              beforeChoices={
                <div className="flex flex-col gap-2">
                  <select
                    aria-label="Pick a shared identity"
                    data-testid="signing-group-pick"
                    value={pickedGroupId}
                    onChange={(e) => {
                      setPickedGroupId(e.target.value);
                      setPickedPartnerIds([]);
                    }}
                    className="w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs text-neutral-100"
                  >
                    <option value="">Keep them solo…</option>
                    <optgroup label="Tag teams">
                      {tagTeamGimmicks().map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Factions">
                      {factionGimmicks().map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>

                  {selectedGroup && eligiblePartners.length === 0 && (
                    <p className="text-[11px] text-rose-400">Nobody on this roster fits — needs the same division, and not already spoken for.</p>
                  )}

                  {selectedGroup && eligiblePartners.length > 0 && (
                    <div className="flex flex-col gap-1 rounded border border-neutral-800 bg-neutral-950 p-2">
                      <p className="text-[11px] text-neutral-500">
                        {selectedGroup.kind === 'tagTeam' ? 'Pick one partner.' : 'Pick at least two.'}
                      </p>
                      {eligiblePartners.map((w) => {
                        const checked = pickedPartnerIds.includes(w.id);
                        return (
                          <label key={w.id} className="flex items-center gap-2 text-xs text-neutral-200">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                if (checked) {
                                  setPickedPartnerIds(pickedPartnerIds.filter((id) => id !== w.id));
                                } else if (selectedGroup.kind === 'tagTeam') {
                                  setPickedPartnerIds([w.id]);
                                } else {
                                  setPickedPartnerIds([...pickedPartnerIds, w.id]);
                                }
                              }}
                            />
                            {w.name}
                          </label>
                        );
                      })}
                      {selectedGroup && countOk && check && !check.ok && (
                        <p className="text-[11px] text-rose-400">{TEAM_PROBLEM_TEXT[check.problem!]}</p>
                      )}
                    </div>
                  )}
                </div>
              }
              choices={[
                {
                  id: 'form',
                  label: selectedGroup ? `Form ${selectedGroup.name}` : 'Form the group',
                  gains: 'A shared identity from night one',
                  costs: 'Splits focus across everyone in it',
                  disabled: !canForm,
                },
                {
                  id: 'solo',
                  label: 'Keep them solo',
                  gains: 'Nothing complicated',
                  costs: 'No shared spotlight to lean on early',
                },
              ]}
              onChoose={(choiceId) => {
                if (choiceId === 'form' && selectedGroup) {
                  formSigningGroup(talk.wrestlerId, selectedGroup.id, pickedPartnerIds);
                } else {
                  declineSigningPairing(talk.wrestlerId);
                }
                setOpenSigningTalkId(null);
              }}
              theme={theme}
              promotionName={world.promotion.name}
              onClose={() => setOpenSigningTalkId(null)}
            />
          );
        })}

      {/* The last renewalWindowWeeks of a deal opens this, and only this — a
          real conversation the booker starts, not an automatic demand once
          the paper runs out. Say no on either side and it plays out to a
          plain, quiet expiry; say yes on both and it goes to the same
          negotiation "Contracts up" below has always run. */}
      {world.renewalTalks.length > 0 && (
        <section className="mb-4">
          <h2 className="mb-2 text-sm font-medium text-neutral-300">Worth keeping?</h2>
          <div className="flex flex-col gap-2">
            {world.renewalTalks.map((talk) => {
              const person = wrestler(talk.wrestlerId);
              if (!person || !person.contract) return null;
              return (
                <article
                  key={talk.wrestlerId}
                  data-testid={`renewal-talk-${talk.wrestlerId}`}
                  className="rounded border border-sky-900/60 bg-neutral-900 p-2"
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
                        {person.contract.weeksRemaining} weeks left on the deal
                      </div>
                    </div>
                  </div>
                  <div className="mt-2">
                    <button
                      type="button"
                      data-testid={`renewal-talk-open-${talk.wrestlerId}`}
                      onClick={() => setOpenRenewalTalkId(talk.wrestlerId)}
                      className="rounded bg-neutral-800 px-3 py-1 text-[11px] text-neutral-200 hover:bg-neutral-700"
                    >
                      Talk to them
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {world.renewalTalks
        .filter((talk) => talk.wrestlerId === openRenewalTalkId)
        .map((talk) => {
          const person = wrestler(talk.wrestlerId);
          if (!person) return null;
          const weeksLeft = person.contract?.weeksRemaining ?? world.settings.renewalWindowWeeks;

          if (talk.stage === 'askInterest') {
            return (
              <DialogueCard
                key={talk.wrestlerId}
                speaker={{ kind: 'booker' }}
                speakerName={world.promotion.name}
                body={`${person.name}'s deal runs out in ${weeksLeft} weeks. Worth trying to keep them?`}
                choices={[
                  {
                    id: 'yes',
                    label: 'Yes — see where they stand',
                    gains: 'Keeps the door open',
                    costs: 'Nothing yet',
                  },
                  {
                    id: 'no',
                    label: 'No — let it run out',
                    gains: 'One less deal to manage',
                    costs: `${person.name} walks free the day it expires`,
                  },
                ]}
                onChoose={(choiceId) => {
                  answerRenewalInterest(talk.wrestlerId, choiceId === 'yes');
                  // A "yes" advances this same conversation to the
                  // wrestler's own choice — stays open so the next render
                  // picks up the new stage. Only "no" actually ends it.
                  if (choiceId !== 'yes') setOpenRenewalTalkId(null);
                }}
                theme={theme}
                promotionName={world.promotion.name}
                onClose={() => setOpenRenewalTalkId(null)}
              />
            );
          }

          return (
            <DialogueCard
              key={talk.wrestlerId}
              speaker={{ kind: 'wrestler', wrestlerId: person.id }}
              wrestler={person}
              speakerName={person.name}
              body="So — are we doing this again?"
              choices={[
                {
                  id: 'stay',
                  label: "Let's talk terms",
                  gains: 'Straight into a real negotiation',
                  costs: 'They will ask for what they think they are worth',
                },
                {
                  id: 'leave',
                  label: 'Let them play it out',
                  gains: 'A clean, no-hard-feelings exit',
                  costs: 'Free agency the day the deal runs out',
                },
                {
                  id: 'explore',
                  label: 'Test the market first',
                  gains: 'Every interested company — including this one — has to actually compete',
                  costs: 'They keep working here until the current deal runs out, whoever wins',
                },
              ]}
              onChoose={(choiceId) => {
                answerRenewalWish(talk.wrestlerId, choiceId as 'stay' | 'leave' | 'explore');
                setOpenRenewalTalkId(null);
              }}
              theme={theme}
              promotionName={world.promotion.name}
              onClose={() => setOpenRenewalTalkId(null)}
            />
          );
        })}

      {world.pendingRenewals.length > 0 && (
        <section className="mb-4">
          <h2 className="mb-2 text-sm font-medium text-neutral-300">Contracts up</h2>
          {/* Why every number on this page is bigger than it should be. Said
              once at the top rather than repeated on each card, and it stops
              being said the week the business lets it go. */}
          {heldAgainstUs > 0 && buriedByUs && (
            <p className="mb-2 rounded bg-rose-950/50 p-2 text-[11px] text-rose-300">
              Everybody is asking for more since {buriedByUs.name} died in this company's ring.
            </p>
          )}
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
                      {/* Why the number is what it is, when it is not simply
                          what they are worth. Stated, never advised on — a
                          booker reading this can still hand them a main-event
                          deal. */}
                      {leverageReason(person, world.settings) && (
                        <div className="text-[11px] text-amber-500/80">
                          {leverageReason(person, world.settings)}
                        </div>
                      )}
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

      {world.approachOffers.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-neutral-300">Somebody has been talking to your talent</h2>
          <div className="flex flex-col gap-2">
            {world.approachOffers.map((offer) => {
              const target = wrestler(offer.wrestlerId);
              const rival = world.rivals.find((r) => r.id === offer.rivalPromotionId);
              if (!target) return null;
              return (
                <button
                  type="button"
                  key={offer.wrestlerId}
                  data-testid={`approach-talk-${offer.id}`}
                  onClick={() => setOpenApproachId(offer.id)}
                  className="flex w-full items-center gap-2 rounded border border-neutral-800 bg-neutral-900 p-2 text-left hover:border-neutral-600"
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
                      {rival?.name ?? 'A rival'} · <span className="text-amber-400">deal running out</span>
                    </div>
                  </div>
                  <span className="shrink-0 rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-300">
                    {temptationLabel(offer.temptation)}
                  </span>
                </button>
              );
            })}
            {approachNote && <p className="text-[11px] text-amber-300">{approachNote}</p>}
          </div>
        </section>
      )}

      {world.approachOffers
        .filter((offer) => offer.id === openApproachId)
        .map((offer) => {
          const target = wrestler(offer.wrestlerId);
          const rival = world.rivals.find((r) => r.id === offer.rivalPromotionId);
          if (!target) return null;
          const answers: { response: PoachingResponse; label: string }[] = [
            { response: { kind: 'matchMoney' }, label: 'Match the money' },
            { response: { kind: 'promiseAPush' }, label: 'Promise the spot' },
            { response: { kind: 'doNothing' }, label: 'Let it ride' },
          ];
          return (
            <DialogueCard
              key={offer.id}
              speaker={{ kind: 'wrestler', wrestlerId: target.id }}
              wrestler={target}
              speakerName={target.name}
              body={approachLine(offer, rival?.name ?? 'a rival')}
              choices={answers.map((a) => {
                const outcome = responseOutcome(a.response, world.settings);
                return { id: a.response.kind, label: a.label, gains: outcome.gains, costs: outcome.costs };
              })}
              onChoose={(choiceId) => {
                const answer = answers.find((a) => a.response.kind === choiceId)!;
                setApproachNote(answerApproach(offer.id, answer.response).reason);
                setOpenApproachId(null);
              }}
              theme={theme}
              promotionName={world.promotion.name}
              onClose={() => setOpenApproachId(null)}
            />
          );
        })}
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
            You have not one soul in a striped shirt. Every match gets counted by one of the boys instead, and
            every single one of them has an opinion about who should be winning.
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
                          ? 'Has not missed a single thing lately.'
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
                    Give them the card
                  </button>
                  {referee.wrestlerId ? (
                    // Taking one of your own out of the shirt is a career
                    // decision, not a release — it happens on the roster,
                    // where the year they owe the job is written down.
                    <span className="self-center text-[10px] text-neutral-600">
                      One of your own — move them back on the roster page
                    </span>
                  ) : (
                    <button
                      type="button"
                      data-testid={`official-release-${referee.id}`}
                      onClick={() => release(referee.id)}
                      className="rounded bg-neutral-800 px-3 py-1 text-[11px] text-rose-300 hover:bg-neutral-700"
                    >
                      Let them go
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
          Their contract goes right along with them. What somebody is genuinely worth here is what they draw at
          the gate, minus every dollar they are still owed.
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
            Nobody is taking your calls this week — every single person you asked has already said no.
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
              Nothing — just move them on
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
        Not one thing has aired yet. Get out there and run a show.
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
  const [open, setOpen] = useState(false);
  if (!world?.pendingChampionCall) return null;

  const call = world.pendingChampionCall;
  const title = world.titles.find((t) => t.id === call.titleId);
  if (!title) return null;

  const options = championInjuryOptions(title);
  const weeksLeft = world.settings.championInjuryGraceWeeks - (world.week - call.raisedWeek);
  const champion = world.wrestlers[call.championIds[0] ?? ''];
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
      <p className="mt-1 text-[11px] text-neutral-500">
        {weeksLeft <= 1
          ? 'Decide this week, or the company vacates that belt for you — no more waiting.'
          : `${weeksLeft} weeks left to decide before the company vacates that belt for you.`}
      </p>
      <button
        type="button"
        data-testid="champion-call-talk"
        onClick={() => setOpen(true)}
        className="mt-2 rounded bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700"
      >
        Talk to them
      </button>

      {open && (
        <DialogueCard
          speaker={champion ? { kind: 'wrestler', wrestlerId: champion.id } : { kind: 'narrator' }}
          wrestler={champion}
          speakerName={champion?.name ?? call.championName}
          body={championCallLine(call.injuryText, call.outFor)}
          choices={options.map((o) => ({
            id: o.id,
            label: o.label,
            gains: o.gains,
            costs: o.costs,
            disabled: o.id === 'interim' && !interimId,
          }))}
          beforeChoices={
            options.some((o) => o.id === 'interim') ? (
              <select
                aria-label="Who holds the interim championship"
                data-testid="interim-pick"
                value={interimId}
                onChange={(e) => setInterimId(e.target.value)}
                className="w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs text-neutral-100"
              >
                <option value="">Choose who carries it…</option>
                {candidates.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            ) : undefined
          }
          onChoose={(optionId) => {
            answer(optionId as ChampionInjuryChoice, interimId || undefined);
            setOpen(false);
          }}
          theme={promotionTheme(world.promotion.identity)}
          promotionName={world.promotion.name}
          onClose={() => setOpen(false)}
        />
      )}
    </section>
  );
}

function TitleMemorialPanel() {
  const world = useGameStore((s) => s.world);
  const answer = useGameStore((s) => s.answerTitleMemorial);
  const [open, setOpen] = useState(false);
  if (!world?.pendingTitleMemorial) return null;

  const memorial = world.pendingTitleMemorial;

  return (
    <section className="mb-3 rounded-lg border border-neutral-700 bg-neutral-900/60 p-3" data-testid="title-memorial">
      <div className="text-xs uppercase tracking-wide text-neutral-400">A champion has died</div>
      <h2 className="mt-1 text-sm font-semibold">
        {memorial.championName} and the {memorial.titleName}
      </h2>
      <p className="mt-1 text-[11px] text-neutral-500">The belt is still listed as theirs. It needs an answer.</p>
      <button
        type="button"
        data-testid="title-memorial-talk"
        onClick={() => setOpen(true)}
        className="mt-2 rounded bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700"
      >
        Decide what happens to the belt
      </button>

      {open && (
        <DialogueCard
          speaker={{ kind: 'narrator' }}
          speakerName={`${memorial.titleName} — in memory of ${memorial.championName}`}
          body={`${memorial.championName} died still holding the ${memorial.titleName}. The office needs a decision on what happens to it.`}
          choices={TITLE_MEMORIAL_OPTIONS.map((o) => ({ id: o.id, label: o.label, gains: o.gains, costs: o.costs }))}
          onChoose={(optionId) => {
            answer(optionId as TitleMemorialChoiceId);
            setOpen(false);
          }}
          theme={promotionTheme(world.promotion.identity)}
          promotionName={world.promotion.name}
          onClose={() => setOpen(false)}
        />
      )}
    </section>
  );
}

/**
 * The bank's offer — three tiers sized against current payroll, plus turning
 * it down. See economy/loan.ts for why the ceiling shrinks and the terms
 * harshen every time this is answered "yes."
 */
function LoanOfferPanel() {
  const world = useGameStore((s) => s.world);
  const answer = useGameStore((s) => s.answerLoanOffer);
  const [open, setOpen] = useState(false);
  if (!world?.pendingLoanOffer) return null;

  const offer = world.pendingLoanOffer;
  const terms = loanTermsFor(offer.attemptNumber, offer.payrollAtOffer, world.settings);
  const ordinal = offer.attemptNumber === 1 ? 'first' : offer.attemptNumber === 2 ? 'second' : `${offer.attemptNumber}th`;

  const tierChoice = (tier: LoanTier) => {
    const borrowed = terms.tiers[tier];
    const totalOwed = Math.round(borrowed * terms.repaymentMultiple);
    const weeklyPayment = Math.max(1, Math.round(totalOwed / terms.repaymentWeeks));
    return {
      id: tier,
      label: LOAN_TIER_LABELS[tier],
      gains: `$${borrowed.toLocaleString()} now`,
      costs: `$${weeklyPayment.toLocaleString()}/wk for ${terms.repaymentWeeks} weeks · $${totalOwed.toLocaleString()} total · ${terms.mandateStrikes} ${terms.mandateStrikes === 1 ? 'strike' : 'strikes'} with the owner`,
    };
  };

  return (
    <section className="mb-3 rounded-lg border border-amber-800 bg-amber-950/20 p-3" data-testid="loan-offer">
      <div className="text-xs uppercase tracking-wide text-amber-400">The bank is calling</div>
      <h2 className="mt-1 text-sm font-semibold">
        {offer.attemptNumber === 1 ? 'A loan is on the table' : `The ${ordinal} loan is on the table`}
      </h2>
      <p className="mt-1 text-[11px] text-neutral-500">
        Sized against your payroll. Cannot be renegotiated once you take it, and cannot be deferred once it starts
        running — no exceptions.
      </p>
      <button
        type="button"
        data-testid="loan-offer-talk"
        onClick={() => setOpen(true)}
        className="mt-2 rounded bg-amber-800/60 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-800"
      >
        Hear the offer
      </button>

      {open && (
        <DialogueCard
          speaker={{ kind: 'narrator' }}
          speakerName="The bank"
          body={
            offer.attemptNumber === 1
              ? "This promotion is bleeding money, plain and simple. A loan buys you real time — but every single dollar comes back with interest, on a fixed weekly bill that absolutely cannot be deferred, and the owner is going to hear about it either way."
              : `This is not the first time, and the bank remembers the last one just fine. This offer is smaller and harsher for it — nothing about needing a ${ordinal} loan reads well to the owner, not one bit.`
          }
          choices={[
            tierChoice('small'),
            tierChoice('medium'),
            tierChoice('large'),
            {
              id: 'decline',
              label: 'Turn it down',
              gains: 'No new obligation, no strikes',
              costs: 'The promotion faces this on its own',
            },
          ]}
          onChoose={(choiceId) => {
            answer(choiceId === 'decline' ? null : (choiceId as LoanTier));
            setOpen(false);
          }}
          theme={promotionTheme(world.promotion.identity)}
          promotionName={world.promotion.name}
          onClose={() => setOpen(false)}
        />
      )}
    </section>
  );
}

/** The loan currently on the books — a standing reminder it cannot be deferred or adjusted. */
function ActiveLoanNotice() {
  const world = useGameStore((s) => s.world);
  if (!world?.activeLoan) return null;
  const loan = world.activeLoan;

  return (
    <section className="mb-3 rounded border border-neutral-800 bg-neutral-900 px-3 py-2" data-testid="active-loan">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-neutral-300">Loan repayment</span>
        <span className="text-neutral-500">
          <Money amount={loan.weeklyPayment} />
          /wk · {loan.weeksRemaining} {loan.weeksRemaining === 1 ? 'week' : 'weeks'} left
        </span>
      </div>
      <p className="mt-1 text-[10px] leading-snug text-neutral-500">
        Withdrawn automatically, every single time. It cannot be deferred, and missing payroll on top of it will
        not stop it.
      </p>
    </section>
  );
}

/**
 * A rival's blind bulk offer — a flat sum for a known number of contracts,
 * identities unknown until the booker says yes. See economy/buyout.ts.
 */
function BuyoutOfferPanel() {
  const world = useGameStore((s) => s.world);
  const answer = useGameStore((s) => s.answerBuyoutOffer);
  const [open, setOpen] = useState(false);
  if (!world?.pendingBuyoutOffer) return null;

  const offer = world.pendingBuyoutOffer;

  return (
    <section className="mb-3 rounded-lg border border-rose-800 bg-rose-950/20 p-3" data-testid="buyout-offer">
      <div className="text-xs uppercase tracking-wide text-rose-400">A rival is circling</div>
      <h2 className="mt-1 text-sm font-semibold">{offer.fromPromotionName} wants {offer.count} contracts</h2>
      <p className="mt-1 text-[11px] text-neutral-500">
        <Money amount={offer.price} /> for {offer.count}, no names attached whatsoever. Could be the bottom of the
        roster. Could genuinely be a champion. This gets answered before a single soul finds out which.
      </p>
      <button
        type="button"
        data-testid="buyout-offer-talk"
        onClick={() => setOpen(true)}
        className="mt-2 rounded bg-rose-800/60 px-3 py-1.5 text-xs font-medium text-rose-100 hover:bg-rose-800"
      >
        Hear the offer
      </button>

      {open && (
        <DialogueCard
          speaker={{ kind: 'narrator' }}
          speakerName={offer.fromPromotionName}
          body={`We will take ${offer.count} contracts clean off your hands — $${offer.price.toLocaleString()}, flat, absolutely no negotiation. We choose who the second you say yes. Could be five names nobody would ever miss. Could be your entire main event picture, gone. That is the whole deal.`}
          choices={[
            {
              id: 'accept',
              label: 'Take the deal',
              gains: `$${offer.price.toLocaleString()} now`,
              costs: `${offer.count} contracts, chosen at random — could include a champion`,
            },
            {
              id: 'decline',
              label: 'Turn it down',
              gains: 'The roster stays exactly as it is',
              costs: 'No money, no matter how badly it is needed',
            },
          ]}
          onChoose={(choiceId) => {
            answer(choiceId === 'accept');
            setOpen(false);
          }}
          theme={promotionTheme(world.promotion.identity)}
          promotionName={world.promotion.name}
          onClose={() => setOpen(false)}
        />
      )}
    </section>
  );
}

function RivalMovePanel() {
  const world = useGameStore((s) => s.world);
  const answer = useGameStore((s) => s.answerRivalMove);
  const [open, setOpen] = useState(false);
  if (!world?.pendingRivalMove) return null;

  const move = world.pendingRivalMove;

  return (
    <section className="mb-3 rounded-lg border border-sky-800 bg-sky-950/20 p-3" data-testid="rival-move">
      <div className="text-xs uppercase tracking-wide text-sky-400">A rival made a move</div>
      <h2 className="mt-1 text-sm font-semibold">
        {move.rivalName} signed {move.wrestlerName}
      </h2>
      <p className="mt-1 text-[11px] text-neutral-500">Worth firing back at, or worth ignoring completely — your call.</p>
      <button
        type="button"
        data-testid="rival-move-talk"
        onClick={() => setOpen(true)}
        className="mt-2 rounded bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700"
      >
        Decide how to respond
      </button>

      {open && (
        <DialogueCard
          speaker={{ kind: 'narrator' }}
          speakerName={`${move.rivalName} signs ${move.wrestlerName}`}
          body={`${move.rivalName} just signed ${move.wrestlerName}, and it is already the talk of the entire locker room. How do you want to answer it?`}
          choices={RIVAL_MOVE_OPTIONS.map((o) => ({ id: o.id, label: o.label, gains: o.gains, costs: o.costs }))}
          onChoose={(optionId) => {
            answer(optionId as RivalMoveChoiceId);
            setOpen(false);
          }}
          theme={promotionTheme(world.promotion.identity)}
          promotionName={world.promotion.name}
          onClose={() => setOpen(false)}
        />
      )}
    </section>
  );
}

function ConfrontationCallPanel() {
  const world = useGameStore((s) => s.world);
  const answer = useGameStore((s) => s.answerConfrontationCall);
  const [open, setOpen] = useState(false);
  if (!world?.pendingConfrontationCall) return null;

  const call = world.pendingConfrontationCall;

  return (
    <section className="mb-3 rounded-lg border border-rose-900/60 bg-rose-950/20 p-3" data-testid="confrontation-call">
      <div className="text-xs uppercase tracking-wide text-rose-400">It went past words</div>
      <h2 className="mt-1 text-sm font-semibold">
        {call.wrestlerName} and {call.otherName}
      </h2>
      <p className="mt-1 text-[11px] text-neutral-500">{call.twistLabel}. The office has not said one word about what happens next.</p>
      <button
        type="button"
        data-testid="confrontation-call-talk"
        onClick={() => setOpen(true)}
        className="mt-2 rounded bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700"
      >
        Decide how far it goes
      </button>

      {open && (
        <DialogueCard
          speaker={{ kind: 'narrator' }}
          speakerName={`${call.wrestlerName} and ${call.otherName}`}
          body={`${call.wrestlerName} and ${call.otherName} went completely past words tonight — ${call.twistLabel.toLowerCase()}. The office can let it play out or pull them apart right now.`}
          choices={CONFRONTATION_CALL_OPTIONS.map((o) => ({ id: o.id, label: o.label, gains: o.gains, costs: o.costs }))}
          onChoose={(optionId) => {
            answer(optionId as ConfrontationCallChoiceId);
            setOpen(false);
          }}
          theme={promotionTheme(world.promotion.identity)}
          promotionName={world.promotion.name}
          onClose={() => setOpen(false)}
        />
      )}
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
    { id: 'monthly', label: 'Every month', blurb: 'Twelve of them a year. Always something huge to build toward.' },
    { id: 'biMonthly', label: 'Every other month', blurb: 'Six a year, and every single one is a bigger deal for being rarer.' },
    { id: 'annual', label: 'Once a year', blurb: 'One massive night the whole entire year points straight at.' },
  ];

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
        <h2 className="mb-1 text-sm font-semibold">The months ahead</h2>
        <p className="mb-2 text-xs text-neutral-500">
          Every single night of every single week. Joint shows land in May and November, and the Crucible hits in
          August.
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
            : 'Not one single person in this company gets a night off.'}
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
                    title="The one the cameras are actually at, and the only one you book. Everything else is a house show the office runs on its own."
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
            ? `${nextBig ?? 'The big one'} is THIS week.`
            : `${nextBig ?? 'The next one'} lands in ${weeksOut} ${weeksOut === 1 ? 'week' : 'weeks'}. It completely replaces the television that week rather than getting added on top of it.`}
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
        One card, both rosters, and every belt stays exactly where it is. This is the single biggest money night
        anybody makes all year — and the sim picks the winners on their half of the card just as ruthlessly as
        yours.
      </p>

      {busy && (
        <p className="rounded border border-neutral-700 bg-neutral-900 p-2 text-[11px] text-neutral-400">
          There is already a joint show sitting on the table. Deal with that one first.
        </p>
      )}
      {!busy && waiting > 0 && (
        <p className="rounded border border-neutral-700 bg-neutral-900 p-2 text-[11px] text-neutral-400">
          You have been making the rounds a lot lately. {waiting} {waiting === 1 ? 'week' : 'weeks'}{' '}
          before anybody out there will even take another call.
        </p>
      )}

      {open.map((rival) => {
        // The standing gap plus whatever they are carrying from the last joint
        // card. Computed the same way the store does it, or the page would
        // promise a mood the phone call does not deliver.
        const grudge = grudgeAgainst(world.grudges, rival.id);
        const resentment = Math.max(
          0,
          Math.min(100, (rival.rating - world.promotion.rating) / 2 + (grudge?.resentment ?? 0)),
        );
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
            {grudge && (
              <p className="mt-0.5 text-[11px] text-amber-500/80">{grudgeLine(grudge, rival.name)}</p>
            )}
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
