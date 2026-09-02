// The card builder — §21's "Match Setup" plus the card view. This is M2's
// main interaction, and per §9 it has no time pressure and no warnings: the
// game will let you book Loser Leaves between two strangers and find out.
//
// One screen, one job: this is the card overview only. Tapping a slot goes
// to a dedicated screen — the roster picker if it isn't cast on both sides
// yet, the match's own Cast/Rules/Stakes screen once it is — rather than
// expanding an accordion in place. The six conditional notice panels (a cup
// invite, a supershow offer, a bidding war, live stories, what the crowd
// wants, belts on the clock) live in a right-hand rail beside the card
// instead of stacking above it, now that there's a whole desktop window to
// use instead of a phone's one column.

import { useMemo } from 'react';
import { useGameStore } from '../../state/store';
import { signedReferees, sharpnessLabel, refereeGrade, isAvailable } from '../../engine/sim/referees';
import { Odds, HeatBadge } from '../components/display';
import {
  bigShowName,
  houseShowsThisWeek,
  isBigShowWeek,
  scheduleOf,
  weeksUntilBigShow,
} from '../../engine/world/schedule';
import { holidayForWeek, seasonForWeek, weeksUntilHoliday, SEASON_LABELS } from '../../engine/world/seasons';
import { PromoSlots } from '../components/PromoSlots';
import { DarkMatchSlots } from '../components/DarkMatchSlots';
import { VignettePanel } from '../components/VignettePanel';
import { ASSIGNMENTS, assignmentOf } from '../../engine/career/assignment';
import { leaveStatusLine } from '../../engine/career/onOurWatch';
import { isSuspended } from '../../engine/career/discipline';
import type { Wrestler, Referee } from '../../engine/types';
import { slotLabel } from '../cardLabels';
import { defenceWatch } from '../../engine/world/titleDefence';
import { fanDemands } from '../../engine/world/fanDemand';
import { recallBookings } from '../../engine/sim/freshness';
import { promotionTheme } from '../components/chrome';
import { DialogueCard } from '../dialogue/DialogueCard';
import type { WeatherCallOptionId } from '../../data/weatherCalls';
import { RING_CALL_OPTIONS, type RingCallOptionId } from '../../engine/world/ringCall';
import { TRUCK_CALL_OPTIONS, type TruckCallOptionId } from '../../engine/world/truckBreakdown';
import { NO_SHOW_CALL_OPTIONS, type NoShowChoiceId } from '../../engine/world/noShowCall';
import { Stories } from '../components/Stories';
import { ThisWeekStrip } from '../components/CalendarStrip';
import { BiddingWarPanel } from '../components/BiddingWar';
import { SupershowPanel } from '../components/Supershow';
import { CupPanel } from '../components/Cup';
import { summarizeSegment, refereeSharpnessTone } from './segmentSummary';

export function BookingScreen({
  onRunShow,
  onOpenSlot,
}: {
  onRunShow: () => void;
  /** A slot tile was tapped — `cast` says whether it already has both sides filled. */
  onOpenSlot: (slotIndex: number, cast: boolean) => void;
}) {
  const world = useGameStore((s) => s.world);
  const setDefaultReferee = useGameStore((s) => s.setDefaultReferee);
  const spreadCrew = useGameStore((s) => s.spreadOfficialsAcrossCard);
  const autoFill = useGameStore((s) => s.autoFillCard);
  const answerWeatherCall = useGameStore((s) => s.answerWeatherCall);
  const answerRingCall = useGameStore((s) => s.answerRingCall);
  const answerTruckCall = useGameStore((s) => s.answerTruckCall);
  const answerNoShowCall = useGameStore((s) => s.answerNoShowCall);

  const roster = useMemo(
    () => (world ? world.promotion.rosterIds.map((id) => world.wrestlers[id]!).filter(Boolean) : []),
    [world],
  );

  // The officials under contract, best first. Fatigue is per night, so this
  // list is also the crew rota — who has worked what, and who is left.
  const crew = useMemo(() => (world ? signedReferees(world.referees, world.promotion.id) : []), [world]);

  if (!world) return null;

  const filledSegments = world.currentCard.filter((s) => new Set(s.participants.map((p) => p.side)).size >= 2).length;

  // What tonight is, and what is coming — a weekly grind needs something to
  // build towards or it is just a grind.
  const schedule = scheduleOf(world.promotion, world.settings);
  const tonightIsPPV = isBigShowWeek(world.week, schedule, world.settings);
  const tonightsName = bigShowName(world.week, schedule, world.settings);
  const weeksToPPV = weeksUntilBigShow(world.week, schedule, world.settings);
  const nextName = bigShowName(world.week + weeksToPPV, schedule, world.settings);
  const televisedShow = schedule.shows.find((show) => show.televised);
  const roadShows = houseShowsThisWeek(world.week, schedule, world.settings);
  const tonightsImpromptu = (world.impromptuShows ?? []).filter((sh) => sh.week === world.week);
  const call = world.pendingWeatherCall;
  const ringCall = world.pendingRingCall;
  const truckCall = world.pendingTruckCall;
  const noShowCall = world.pendingNoShowCall;
  const tonightsHoliday = holidayForWeek(world.week);
  const nextHoliday = weeksUntilHoliday(world.week);
  const season = SEASON_LABELS[seasonForWeek(world.week)];
  // "Run the show" is the one primary action in the game; it wears the
  // company's own colour rather than a generic green.
  const theme = promotionTheme(world.promotion.identity);

  const bookedIds = new Set(world.currentCard.flatMap((s) => s.participants.map((p) => p.wrestlerId)));

  return (
    <div className="p-6 text-neutral-100">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {tonightIsPPV ? (
            <>
              <div className="text-[10px] uppercase tracking-wide text-amber-500">Pay-per-view</div>
              <h1 className="text-lg font-semibold text-amber-400">{tonightsName ?? 'The big one'}</h1>
            </>
          ) : (
            <>
              {/* The show has a name and a night. "This week's card" is what a
                  spreadsheet calls it; a promotion calls it Monday Night
                  Havoc. See engine/world/schedule.ts. */}
              <div className="text-[10px] uppercase tracking-wide text-neutral-500">
                {televisedShow?.day ?? 'Tonight'}
              </div>
              <h1 className="text-lg font-semibold">{televisedShow?.name ?? "This week's card"}</h1>
            </>
          )}
          {tonightsHoliday && (
            <div className="text-[11px] font-medium text-amber-300">
              {tonightsHoliday.name} — {tonightsHoliday.blurb}
            </div>
          )}
          <p className="text-xs text-neutral-500">
            {filledSegments} of {world.currentCard.length} segments booked
            <span className="text-neutral-600"> · {season}</span>
            {!tonightsHoliday && nextHoliday && nextHoliday.weeksAway <= 6 && (
              <span className="text-neutral-600">
                {' '}
                · {nextHoliday.holiday.name} in {nextHoliday.weeksAway}{' '}
                {nextHoliday.weeksAway === 1 ? 'week' : 'weeks'}
              </span>
            )}
            {!tonightIsPPV && weeksToPPV > 0 && (
              <span className="text-neutral-600">
                {' '}
                · {nextName ?? 'the next pay-per-view'} in {weeksToPPV} {weeksToPPV === 1 ? 'week' : 'weeks'}
              </span>
            )}
          </p>
          {tonightsImpromptu.map((extra) => (
            <p key={extra.id} className="text-[11px] font-medium text-violet-300">
              {extra.name} ({extra.day}) — {extra.kind === 'memorial' ? 'the gate goes to the family' : 'nobody is being paid'}
            </p>
          ))}
          {roadShows.length > 0 && (
            <p className="text-[11px] text-neutral-600">
              Also on the road: {roadShows.map((show) => `${show.name} (${show.day})`).join(', ')}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            data-testid="auto-fill"
            onClick={autoFill}
            className="rounded bg-neutral-800 px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-700"
            title="Let the office book the empty slots"
          >
            Fill the card
          </button>
          <button
            type="button"
            onClick={onRunShow}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${theme.action}`}
          >
            Run the show
          </button>
        </div>
      </div>

      {/* The call on the weather. This is the one thing in the game that
          stops the week: the show does not resolve until it is answered,
          because deciding whether to run it *is* running it. */}
      {call && (
        <DialogueCard
          speaker={{ kind: 'narrator' }}
          speakerName={`${call.eventName} — ${call.territoryName}`}
          body={call.warning}
          subtext={call.forecast}
          choices={call.options.map((o) => ({ id: o.id, label: o.label, gains: o.gains, costs: o.costs }))}
          onChoose={(optionId) => answerWeatherCall(optionId as WeatherCallOptionId)}
          theme={theme}
          promotionName={world.promotion.name}
        />
      )}

      {/* The ring gives out — checked before weather, so if both are somehow
          in play the same night, this is the one the promoter answers first. */}
      {ringCall && (
        <DialogueCard
          speaker={{ kind: 'narrator' }}
          speakerName={`The ring in ${ringCall.territoryName}`}
          body={ringCall.warning}
          choices={RING_CALL_OPTIONS.map((o) => ({ id: o.id, label: o.label, gains: o.gains, costs: o.costs }))}
          onChoose={(optionId) => answerRingCall(optionId as RingCallOptionId)}
          theme={theme}
          promotionName={world.promotion.name}
        />
      )}

      {/* The truck never showed — checked before the ring, so it is the one
          the promoter answers first if both are somehow in play. */}
      {truckCall && (
        <DialogueCard
          speaker={{ kind: 'narrator' }}
          speakerName={`The equipment truck for ${truckCall.territoryName}`}
          body={truckCall.warning}
          choices={TRUCK_CALL_OPTIONS.map((o) => ({ id: o.id, label: o.label, gains: o.gains, costs: o.costs }))}
          onChoose={(optionId) => answerTruckCall(optionId as TruckCallOptionId)}
          theme={theme}
          promotionName={world.promotion.name}
        />
      )}

      {noShowCall && (
        <DialogueCard
          speaker={{ kind: 'narrator' }}
          speakerName={`${noShowCall.absentName} never made the building`}
          body={noShowCall.warning}
          choices={NO_SHOW_CALL_OPTIONS.map((o) => ({
            id: o.id,
            label: o.label,
            gains: o.gains,
            costs: o.costs,
            disabled: o.id === 'mysteryOpponent' && !noShowCall.suggestedReplacementId,
          }))}
          onChoose={(optionId) => answerNoShowCall(optionId as NoShowChoiceId)}
          theme={theme}
          promotionName={world.promotion.name}
        />
      )}

      <div className="grid grid-cols-[1fr_320px] gap-6">
        <div className="min-w-0">
          {/* The card's official. Boxing does it this way: one referee named
              for the night, and the good one saved for the fights that
              matter. */}
          <div className="mb-4 rounded border border-neutral-800 bg-neutral-900 p-3">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="text-[11px] uppercase tracking-wide text-neutral-500">Official for the night</span>
              {crew.length > 1 ? (
                <button
                  type="button"
                  data-testid="spread-officials"
                  onClick={spreadCrew}
                  className="rounded bg-neutral-800 px-2 py-1 text-[10px] text-neutral-300 hover:bg-neutral-700"
                  title="Share the card out — best official on the main event, nobody worked into the ground"
                >
                  Share out the card
                </button>
              ) : (
                <span className="text-[10px] text-neutral-600">Any match can name somebody else</span>
              )}
            </div>
            {crew.length === 0 ? (
              <p className="text-[11px] text-amber-400">
                Not one official is under contract. One of the boys will have to count every single match, and every
                last one of them has their own idea about who should win. Sign an official in the office.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {crew.map((referee: Referee) => {
                  const hurt = !isAvailable(referee);
                  return (
                    <button
                      key={referee.id}
                      type="button"
                      data-testid={`card-referee-${referee.id}`}
                      disabled={hurt}
                      onClick={() => setDefaultReferee(referee.id)}
                      title={`${referee.blurb} — ${refereeGrade(referee)}`}
                      className={`rounded px-2 py-1 text-[11px] ${
                        hurt
                          ? 'cursor-not-allowed bg-neutral-900 text-neutral-700'
                          : world.defaultRefereeId === referee.id
                            ? 'bg-emerald-600 text-white'
                            : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                      }`}
                    >
                      {referee.name}
                      <span className={`ml-1 ${hurt ? 'text-neutral-700' : refereeSharpnessTone(referee)}`}>
                        {hurt ? 'injured' : sharpnessLabel(referee)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* The card itself — a grid of slot tiles, each its own screen once
              tapped. */}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            {world.currentCard.map((segment, index) => {
              const summary = summarizeSegment(segment, roster, world);
              const cast = summary.sides.length >= 2;
              return (
                <SlotCard
                  key={segment.slot}
                  index={index}
                  total={world.currentCard.length}
                  summary={summary}
                  locked={segment.systemForced === 'factionDestroyer'}
                  onOpen={() => onOpenSlot(index, cast)}
                />
              );
            })}
          </div>

          <PromoSlots />
          <DarkMatchSlots />
          <VignettePanel />

          {/* And what everybody who is not on it does instead. Here rather
              than on the roster page because it is the same decision, made at
              the same moment: these are exactly the people you have just
              finished leaving off, and the answer can be different next
              week. */}
          <RestOfTheWeek bookedIds={bookedIds} />
        </div>

        {/* The right rail — every notice that competed for attention above
            the card on a phone screen now lives beside it instead. Each of
            these already returns null when nothing's relevant, so most weeks
            this rail simply isn't there. */}
        <div className="flex flex-col gap-3">
          <ThisWeekStrip />
          <CupPanel />
          <SupershowPanel />
          <BiddingWarPanel />
          <Stories />
          <FactionDestroyerPanel />
          <WhatTheyWant />
          <BeltsOnTheClock />
        </div>
      </div>
    </div>
  );
}

/** One match slot on the card overview — a summary tile, not an editor. Tapping it always leaves this screen. */
function SlotCard({
  index,
  total,
  summary,
  locked,
  onOpen,
}: {
  index: number;
  total: number;
  summary: ReturnType<typeof summarizeSegment>;
  /** Forced by the Faction Destroyer story — see Segment.systemForced. Not editable, not tappable. */
  locked?: boolean;
  onOpen: () => void;
}) {
  const scheduledGroupTurns = useGameStore((s) => s.world?.scheduledGroupTurns ?? []);
  const turn = scheduledGroupTurns.find((t) => summary.participants.some((p) => p.wrestler.id === t.departingId));

  const Tag = locked ? 'div' : 'button';

  return (
    <Tag
      {...(locked ? {} : { type: 'button', onClick: onOpen })}
      data-testid={`segment-${index}`}
      className={`flex flex-col gap-1.5 rounded-lg border p-3 text-left transition ${
        locked
          ? 'border-rose-900/60 bg-rose-950/20'
          : 'border-neutral-800 bg-neutral-900 hover:border-neutral-600'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] uppercase tracking-wide text-neutral-500">{slotLabel(index, total)}</div>
        {locked && (
          <span className="rounded bg-rose-950 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-rose-300">
            Faction Destroyer — locked
          </span>
        )}
      </div>
      <div className="text-sm font-medium">
        {summary.participants.length === 0 ? (
          <span className="text-neutral-600">Empty</span>
        ) : (
          summary.sides
            .map((side) => summary.participants.filter((p) => p.side === side).map((p) => p.wrestler.name).join(' & '))
            .join('  vs  ')
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {summary.stipulation && (
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] ${summary.requirementsMet ? 'bg-sky-950 text-sky-300' : 'bg-amber-950 text-amber-300'}`}
            title={summary.requirementsMet ? summary.stipulation.blurb : "Requirements aren't met — this will cost you"}
          >
            {summary.stipulation.name}
            {!summary.requirementsMet && ' ⚠'}
          </span>
        )}
        {summary.stakes && (
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] ${summary.stakes === 'Non-title' ? 'bg-neutral-800 text-neutral-400' : 'bg-amber-950 text-amber-300'}`}
          >
            {summary.stakes}
          </span>
        )}
        {summary.rivalry && <HeatBadge heat={summary.rivalry.heat} shootHeat={summary.rivalry.shootHeat} />}
        {summary.odds !== null && <Odds probability={summary.odds} />}
      </div>
      {summary.storyline && (
        <div className="truncate text-[10px] text-sky-400" title={summary.storyline.name}>
          Advances: {summary.storyline.name}
        </div>
      )}
      {turn && (
        <div className="truncate text-[10px] text-amber-400" title={`${turn.stableName} is set to jump ${turn.departingName} after this one.`}>
          Turn: {turn.departingName} gets jumped after this one
        </div>
      )}
      {summary.participants.length > 0 && <span className="text-[10px] text-neutral-500">{summary.officialLabel}</span>}
    </Tag>
  );
}

/**
 * The weeks nobody is booked for, decided alongside the card.
 *
 * Every row arrives with an answer already in it — the office's, per person —
 * so a booker who does not care can ignore the whole panel and still have a
 * roster that develops. Changing one is a tap, and it lasts until it is
 * changed back, so the same person can be in the gym this week and out on
 * appearances the next.
 *
 * Anybody hurt or away has no selector at all. There is no decision to make
 * about somebody who is not going to be doing any of it, and offering four
 * buttons that all mean "rest" would be a worse lie than saying so.
 */
function RestOfTheWeek({ bookedIds }: { bookedIds: Set<string> }) {
  const world = useGameStore((s) => s.world)!;
  const setAssignment = useGameStore((s) => s.setAssignment);

  const roster = world.promotion.rosterIds
    .map((id) => world.wrestlers[id])
    .filter((w): w is Wrestler => Boolean(w) && !w!.deceased && w!.role === 'wrestler');

  const off = roster.filter((w) => !bookedIds.has(w.id));
  if (off.length === 0) return null;

  const sidelined = (w: Wrestler): string | null => {
    if (w.injury) return `Out ${w.injury.weeksRemaining} ${w.injury.weeksRemaining === 1 ? 'week' : 'weeks'}`;
    if (w.leave) return leaveStatusLine(w.leave);
    if (w.vignette) return `Filming vignettes — ${w.vignette.weeksRemaining} more ${w.vignette.weeksRemaining === 1 ? 'week' : 'weeks'}`;
    if (isSuspended(w.discipline, world.week)) return 'Suspended';
    return null;
  };

  const free = off.filter((w) => !sidelined(w));
  const out = off.filter((w) => sidelined(w));

  return (
    <details className="mt-4 rounded-lg border border-neutral-800 bg-neutral-900/60" data-testid="rest-of-week">
      <summary className="cursor-pointer px-2.5 py-2 text-[11px] text-neutral-300">
        The rest of the week — {free.length} not on the card
      </summary>

      <div className="grid grid-cols-2 gap-1 px-2.5 pb-2.5 xl:grid-cols-3">
        {free.map((w) => {
          const doing = assignmentOf(w, world.settings);
          const pinned = Boolean(w.assignment && w.assignment !== 'auto');
          return (
            <div key={w.id} className="rounded border border-neutral-800 bg-neutral-950/50 p-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[11px] font-medium text-neutral-200">{w.name}</span>
                <span className="shrink-0 text-[10px] text-neutral-600">{pinned ? 'your call' : 'office'}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {ASSIGNMENTS.map((option) => {
                  const on = doing === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      data-testid={`week-${w.id}-${option.id}`}
                      title={option.blurb}
                      onClick={() => setAssignment(w.id, pinned && on ? 'auto' : option.id)}
                      className={`rounded px-1.5 py-0.5 text-[10px] ${
                        on
                          ? pinned
                            ? 'bg-sky-700 text-white'
                            : 'bg-sky-950 text-sky-300'
                          : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                      }`}
                    >
                      {option.name}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Nothing to decide about these, and §0 says the page still has to
            say why they are here rather than leaving a gap. */}
        {out.map((w) => (
          <div key={w.id} className="flex items-baseline justify-between gap-2 px-1.5 py-1 text-[10px]">
            <span className="truncate text-neutral-500">{w.name}</span>
            <span className="shrink-0 text-rose-400/80">{sidelined(w)}</span>
          </div>
        ))}
      </div>
    </details>
  );
}

/**
 * Which belts are running out of time, on the screen where you would do
 * something about it.
 *
 * This is information, not advice. It says the deadline and whose belt it is;
 * it does not say to book the match, and there is nothing stopping the player
 * ignoring it and losing the title. A deadline you cannot see is a hidden
 * rule rather than a difficulty — see engine/world/titleDefence.ts.
 */

/**
 * The Faction Destroyer countdown — the explicit ask was "a counter... on
 * each card that tells them how many left." Shows while a story is active
 * and not yet scheduled; once the match is forced onto the main event slot,
 * the card itself already says so (see SlotCard's locked state above), so
 * this switches to a plain confirmation instead of a countdown that's stuck
 * at zero.
 */
function FactionDestroyerPanel() {
  const world = useGameStore((s) => s.world);
  if (!world?.factionDestroyer) return null;
  const story = world.factionDestroyer;

  return (
    <div className="rounded-lg border border-rose-900/60 bg-rose-950/20 p-2.5" data-testid="faction-destroyer-panel">
      <div className="text-[10px] uppercase tracking-wider text-rose-400">
        {story.matchScheduledForWeek !== null ? 'Faction Destroyer' : 'Faction Destroyer building'}
      </div>
      <div className="mt-1 text-[11px] leading-snug text-neutral-300">
        {story.stableAName} vs. {story.stableBName}
        {story.matchScheduledForWeek !== null ? (
          <> headlines this show. No rules, no time limit — it's over when one side has nobody left.</>
        ) : (
          <>
            {' — '}
            <span className="font-semibold text-rose-300">
              {story.weeksRemaining} {story.weeksRemaining === 1 ? 'week' : 'weeks'} left
            </span>
            . A member of either side needs to work every week, or the clock simply doesn't move.
          </>
        )}
      </div>
    </div>
  );
}

function BeltsOnTheClock() {
  const world = useGameStore((s) => s.world);
  if (!world) return null;
  const watch = defenceWatch(world.titles, world.promotion.id, world.week, world.settings);
  if (watch.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-2.5" data-testid="belts-on-the-clock">
      <div className="text-[10px] uppercase tracking-wider text-amber-500">On the clock</div>
      <ul className="mt-1 flex flex-col gap-0.5">
        {watch.map((item) => {
          const holders = item.holderIds
            .map((id) => world.wrestlers[id]?.name)
            .filter(Boolean)
            .join(' & ');
          return (
            <li key={item.titleId} className="text-[11px] leading-snug">
              <span className={item.status === 'finalWarning' ? 'font-semibold text-amber-200' : 'text-neutral-300'}>
                {item.titleName}
              </span>
              <span className="text-neutral-500">
                {' — '}
                {holders || 'vacant'}
                {', '}
                {item.weeksLeft <= 1
                  ? 'defend it this week or the company takes it back'
                  : `${item.weeksLeft} weeks to defend it`}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * What the audience is asking for, on the screen where you would give it to
 * them.
 *
 * Information, not advice — the same line the defence clock walks. It says
 * what they want; it does not say to book it, and the game will happily let
 * you ignore the lot. The entry that names somebody on a rival's roster is
 * the one worth reading twice: that is where a secret signing starts.
 */
function WhatTheyWant() {
  const world = useGameStore((s) => s.world);
  if (!world) return null;

  const demands = fanDemands({
    wrestlers: Object.values(world.wrestlers).filter((w): w is Wrestler => Boolean(w)),
    playerRosterIds: world.promotion.rosterIds,
    titles: world.titles,
    rivalries: world.rivalries,
    memory: recallBookings(world.showHistory, world.week, world.settings),
    currentWeek: world.week,
    playerPromotionId: world.promotion.id,
    settings: world.settings,
  });
  if (demands.length === 0) return null;

  return (
    <details className="rounded-lg border border-sky-900/50 bg-sky-950/20" data-testid="fan-demands">
      <summary className="cursor-pointer px-2.5 py-2 text-[11px] text-sky-300">
        What they want to see ({demands.length})
      </summary>
      <ul className="flex flex-col gap-1 px-2.5 pb-2.5">
        {demands.map((demand) => (
          <li key={demand.id} className="text-[11px] leading-snug text-neutral-300">
            <span className={demand.kind === 'enoughOfHim' ? 'text-rose-300' : 'text-neutral-300'}>{demand.text}</span>
            {demand.signableFrom && <span className="ml-1 text-amber-400">That deal is nearly up — see The quiet business.</span>}
          </li>
        ))}
      </ul>
    </details>
  );
}
