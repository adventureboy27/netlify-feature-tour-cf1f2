// The card builder — §21's "Match Setup" plus the card view. This is M2's
// main interaction, and per §9 it has no time pressure and no warnings: the
// game will let you book Loser Leaves between two strangers and find out.

import { useMemo, useState } from 'react';
import { useGameStore } from '../../state/store';
import { STIPULATIONS, stipulationById, stipulationRequirementsMet, effectiveRules } from '../../data/stipulations';
import { MANAGERS } from '../../data/ringsidePool';
import { managerFit, type Manager } from '../../engine/sim/ringside';
import { signedReferees, officialFor, sharpnessLabel, refereeGrade, isAvailable } from '../../engine/sim/referees';
import { findRivalry } from '../../engine/sim/rivalry';
import { ruleAdjustedWeights, kayfabeScore } from '../../engine/sim/kayfabe';
import { pairWinProbability } from '../../engine/sim/winProbability';
import { Odds, HeatBadge } from '../components/display';
import { WrestlerRow, RowKey } from '../components/WrestlerRow';
import { eligibleTitles, titleStakesLabel } from '../../engine/sim/titleMatch';
import { shortTitleName } from '../../data/titles';
import { isPPVWeek, ppvNameForWeek, weeksUntilPPV } from '../../engine/world/calendar';
import { holidayForWeek, seasonForWeek, weeksUntilHoliday, SEASON_LABELS } from '../../engine/world/seasons';
import { PromoSlots } from '../components/PromoSlots';
import type { Id, Wrestler, Segment, Title, WorldSettings, Referee, PaceId } from '../../engine/types';
import { PACES, paceById } from '../../data/pacing';
import { paceFit } from '../../engine/sim/pacing';
import { slotLabel } from '../cardLabels';
import { defenceWatch } from '../../engine/world/titleDefence';
import { fanDemands } from '../../engine/world/fanDemand';
import { recallBookings } from '../../engine/sim/freshness';
import { promotionTheme } from '../components/chrome';
import { Stories } from '../components/Stories';

/**
 * How worn an official is, as a colour. The player is managing a crew across
 * a card, and the whole decision is legible at a glance or it is not a
 * decision at all.
 */
function sharpnessTone(referee: Referee): string {
  const label = sharpnessLabel(referee);
  if (label === 'Fresh' || label === 'Sharp') return 'text-emerald-400';
  if (label === 'Working hard') return 'text-neutral-400';
  if (label === 'Fading') return 'text-amber-400';
  return 'text-rose-400';
}

/** Preview odds using the same path the sim will take, so the words don't lie. */
function previewOdds(segment: Segment, wrestlers: Wrestler[]): number | null {
  const sides = [...new Set(segment.participants.map((p) => p.side))];
  if (sides.length !== 2 || wrestlers.length < 2) return null;

  const stipulation = segment.stipulation ? (stipulationById(segment.stipulation) ?? null) : null;
  const rules = effectiveRules(segment.rules, stipulation);
  const weights = ruleAdjustedWeights(rules, stipulation?.id === 'ladder', false);

  const scoreFor = (side: number) => {
    const members = segment.participants
      .filter((p) => p.side === side)
      .map((p) => wrestlers.find((w) => w.id === p.wrestlerId))
      .filter((w): w is Wrestler => Boolean(w));
    if (members.length === 0) return null;
    return members.reduce((sum, w) => sum + kayfabeScore(w, weights), 0) / members.length;
  };

  const a = scoreFor(sides[0]!);
  const b = scoreFor(sides[1]!);
  if (a === null || b === null) return null;
  return pairWinProbability(a, b, 0, 0.08, 0.92);
}

export function BookingScreen({ onRunShow }: { onRunShow: () => void }) {
  const world = useGameStore((s) => s.world);
  const setParticipant = useGameStore((s) => s.setSegmentParticipant);
  const removeParticipant = useGameStore((s) => s.removeSegmentParticipant);
  const setStipulation = useGameStore((s) => s.setSegmentStipulation);
  const setRules = useGameStore((s) => s.setSegmentRules);
  const setManager = useGameStore((s) => s.setSegmentManager);
  const setReferee = useGameStore((s) => s.setSegmentReferee);
  const setGuestReferee = useGameStore((s) => s.setSegmentGuestReferee);
  const setDefaultReferee = useGameStore((s) => s.setDefaultReferee);
  const spreadCrew = useGameStore((s) => s.spreadOfficialsAcrossCard);
  const toggleTitle = useGameStore((s) => s.toggleSegmentTitle);
  const autoFill = useGameStore((s) => s.autoFillCard);
  const answerWeatherCall = useGameStore((s) => s.answerWeatherCall);
  const [openSlot, setOpenSlot] = useState(0);

  const roster = useMemo(
    () => (world ? world.promotion.rosterIds.map((id) => world.wrestlers[id]!).filter(Boolean) : []),
    [world],
  );

  // The officials under contract, best first. Fatigue is per night, so this
  // list is also the crew rota — who has worked what, and who is left.
  const crew = useMemo(
    () => (world ? signedReferees(world.referees, world.promotion.id) : []),
    [world],
  );

  if (!world) return null;

  const bookedIds = new Set(world.currentCard.flatMap((s) => s.participants.map((p) => p.wrestlerId)));
  const filledSegments = world.currentCard.filter((s) => new Set(s.participants.map((p) => p.side)).size >= 2).length;

  // What tonight is, and what is coming — a weekly grind needs something to
  // build towards or it is just a grind.
  const tonightIsPPV = isPPVWeek(world.week, world.settings);
  const tonightsName = ppvNameForWeek(world.week, world.promotion.ppvCalendar, world.settings);
  const weeksToPPV = weeksUntilPPV(world.week, world.settings);
  const nextName = ppvNameForWeek(
    world.week + weeksToPPV,
    world.promotion.ppvCalendar,
    world.settings,
  );
  // The year has a shape whether or not the booker uses it: a holiday is a
  // night the town turns out for the date rather than the card, and knowing
  // one is three weeks out is the whole reason to build toward it.
  const call = world.pendingWeatherCall;
  const tonightsHoliday = holidayForWeek(world.week);
  const nextHoliday = weeksUntilHoliday(world.week);
  const season = SEASON_LABELS[seasonForWeek(world.week)];
  // "Run the show" is the one primary action in the game; it wears the
  // company's own colour rather than a generic green.
  const theme = promotionTheme(world.promotion.identity);

  return (
    <div className="p-3 pb-24 text-neutral-100">
      <Stories />
      <WhatTheyWant />
      <BeltsOnTheClock />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {tonightIsPPV ? (
            <>
              <div className="text-[10px] uppercase tracking-wide text-amber-500">Pay-per-view</div>
              <h1 className="text-base font-semibold text-amber-400">{tonightsName ?? 'The big one'}</h1>
            </>
          ) : (
            <h1 className="text-base font-semibold">This week&apos;s card</h1>
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
        <section
          data-testid="weather-call"
          className="mb-3 rounded border border-amber-700 bg-amber-950/30 p-3"
        >
          <div className="text-[10px] uppercase tracking-wide text-amber-500">
            {call.eventName} — {call.territoryName}
          </div>
          <p className="mt-1 text-sm text-amber-100">{call.warning}</p>
          <p className="mt-1 text-xs italic text-amber-300/90">{call.forecast}</p>
          <div className="mt-3 flex flex-col gap-1.5">
            {call.options.map((option) => (
              <button
                key={option.id}
                type="button"
                data-testid={`weather-${option.id}`}
                onClick={() => answerWeatherCall(option.id)}
                className="rounded border border-neutral-700 bg-neutral-900 p-2 text-left hover:border-amber-500"
              >
                <div className="text-sm font-medium">{option.label}</div>
                <div className="text-[11px] text-neutral-400">{option.gains}</div>
                <div className="text-[11px] text-rose-300/80">{option.costs}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* The card's official. Boxing does it this way: one referee named for
          the night, and the good one saved for the fights that matter. */}
      <div className="mb-3 rounded border border-neutral-800 bg-neutral-900 p-3">
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
            Nobody is under contract. One of the boys will have to count every match, and they all have
            their own ideas about who should win. Sign an official in the office.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {crew.map((referee) => {
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
                  <span className={`ml-1 ${hurt ? 'text-neutral-700' : sharpnessTone(referee)}`}>
                    {hurt ? 'injured' : sharpnessLabel(referee)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {world.currentCard.map((segment, index) => {
          const participants = segment.participants
            .map((p) => ({ role: p, wrestler: world.wrestlers[p.wrestlerId] }))
            .filter((p): p is { role: typeof p.role; wrestler: Wrestler } => Boolean(p.wrestler));
          const sides = [...new Set(segment.participants.map((p) => p.side))].sort();
          const rivalry = findRivalry(world.rivalries, participants.map((p) => p.wrestler.id));
          const stipulation = segment.stipulation ? (stipulationById(segment.stipulation) ?? null) : null;
          const odds = previewOdds(segment, roster);

          // Which belts this match could be for, and what it is billed as.
          const bookable = eligibleTitles(world.titles, {
            stipulationId: segment.stipulation,
            participants: participants.map((p) => ({ wrestler: p.wrestler, side: p.role.side })),
            promotionId: world.promotion.id,
          });
          const onTheLine = segment.titleIds
            .map((id) => world.titles.find((t) => t.id === id))
            .filter((t): t is NonNullable<typeof t> => Boolean(t));
          const championInMatch = bookable.some((t) => !t.vacant);
          const stakes = titleStakesLabel(onTheLine, championInMatch);
          const isOpen = openSlot === index;

          // Who ends up counting this one, resolved exactly the way the sim
          // will resolve it at bell time.
          const assigned = officialFor(segment.refereeId, world.defaultRefereeId, world.referees, world.promotion.id);
          const guest = segment.guestRefereeId ? world.wrestlers[segment.guestRefereeId] : null;
          const officialLabel = guest
            ? `Ref: ${guest.name} (guest)`
            : assigned
              ? `Ref: ${assigned.name}${segment.refereeId ? '' : ' (card)'}`
              : 'Ref: one of the boys';

          const requirementsMet =
            stipulation && participants.length >= 2
              ? stipulationRequirementsMet(stipulation, {
                  participants: participants.map((p) => p.wrestler),
                  rivalryHeat: rivalry?.heat ?? 0,
                  matchTimeLimitMinutes: segment.rules.timeLimit,
                })
              : true;

          return (
            <section
              key={segment.slot}
              data-testid={`segment-${index}`}
              data-open={isOpen ? 'true' : 'false'}
              className="rounded border border-neutral-800 bg-neutral-900"
            >
              <button
                type="button"
                data-testid={`segment-${index}-toggle`}
                onClick={() => setOpenSlot(isOpen ? -1 : index)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
              >
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                    {slotLabel(index, world.currentCard.length)}
                  </div>
                  <div className="truncate text-sm">
                    {participants.length === 0 ? (
                      <span className="text-neutral-600">Empty</span>
                    ) : (
                      sides
                        .map((side) =>
                          participants
                            .filter((p) => p.role.side === side)
                            .map((p) => p.wrestler.name)
                            .join(' & '),
                        )
                        .join('  vs  ')
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    {stipulation && (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] ${requirementsMet ? 'bg-sky-950 text-sky-300' : 'bg-amber-950 text-amber-300'}`}
                        title={requirementsMet ? stipulation.blurb : "Requirements aren't met — this will cost you"}
                      >
                        {stipulation.name}
                        {!requirementsMet && ' ⚠'}
                      </span>
                    )}
                    {stakes && (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] ${
                          stakes === 'Non-title'
                            ? 'bg-neutral-800 text-neutral-400'
                            : 'bg-amber-950 text-amber-300'
                        }`}
                      >
                        {stakes}
                      </span>
                    )}
                    {rivalry && <HeatBadge heat={rivalry.heat} shootHeat={rivalry.shootHeat} />}
                    {odds !== null && <Odds probability={odds} />}
                    {/* Who is counting, printed beside the match. */}
                    {participants.length > 0 && <span className="text-[10px] text-neutral-500">{officialLabel}</span>}
                  </div>
                </div>
                <span className="shrink-0 text-neutral-600">{isOpen ? '▾' : '▸'}</span>
              </button>

              {isOpen && (
                <div className="border-t border-neutral-800 p-3">
                  <SegmentEditor
                    segment={segment}
                    roster={roster}
                    // Anyone already on the card — including in this very
                    // segment — is off the picker. They're visible in their
                    // side panel, and offering them again only ever means a
                    // misclick that silently moves them between sides.
                    unavailable={bookedIds}
                    onAdd={(id, side) => setParticipant(index, id, side)}
                    onRemove={(id) => removeParticipant(index, id)}
                    onStipulation={(id) => setStipulation(index, id)}
                    bookableTitles={bookable}
                    onToggleTitle={(id) => toggleTitle(index, id)}
                    onTimeLimit={(minutes) => setRules(index, { timeLimit: minutes })}
                    onPace={(pace) => setRules(index, { pace })}
                    isMainEvent={index === world.currentCard.length - 1}
                    isOpener={index === 0}
                    paceSaturation={world.paceSaturation[segment.rules.pace] ?? 0}
                    onManager={(managerId, forSide) => setManager(index, managerId, forSide)}
                    onReferee={(refereeId) => setReferee(index, refereeId)}
                    onGuestReferee={(id) => setGuestReferee(index, id)}
                    crew={crew}
                    staffManagers={world.staffManagers}
                    defaultReferee={
                      world.defaultRefereeId
                        ? (crew.find((r) => r.id === world.defaultRefereeId) ?? null)
                        : null
                    }
                    settings={world.settings}
                  />
                </div>
              )}
            </section>
          );
        })}
      </div>

      <PromoSlots />
    </div>
  );
}

const TIME_LIMITS = [0, 5, 10, 15, 20, 30, 60] as const;

function SegmentEditor({
  segment,
  roster,
  unavailable,
  onAdd,
  onRemove,
  onStipulation,
  bookableTitles,
  onToggleTitle,
  onTimeLimit,
  onPace,
  isMainEvent,
  isOpener,
  paceSaturation,
  onManager,
  onReferee,
  onGuestReferee,
  crew,
  staffManagers,
  defaultReferee,
  settings,
}: {
  segment: Segment;
  roster: Wrestler[];
  unavailable: Set<Id>;
  onAdd: (id: Id, side: number) => void;
  onRemove: (id: Id) => void;
  onStipulation: (id: Id | null) => void;
  bookableTitles: Title[];
  onToggleTitle: (id: Id) => void;
  onTimeLimit: (minutes: (typeof TIME_LIMITS)[number]) => void;
  onPace: (pace: PaceId) => void;
  isMainEvent: boolean;
  isOpener: boolean;
  paceSaturation: number;
  onManager: (managerId: Id | null, forSide: number) => void;
  onReferee: (refereeId: Id | null) => void;
  onGuestReferee: (wrestlerId: Id | null) => void;
  /** The officials under contract, best first. */
  crew: Referee[];
  /** Your own wrestlers working as managers. They cost nothing per night. */
  staffManagers: Manager[];
  /** Who takes this match if it names nobody. */
  defaultReferee: Referee | null;
  settings: WorldSettings;
}) {
  const [side, setSide] = useState(0);
  const [search, setSearch] = useState('');

  // Who is actually in this match, for reading the pace against.
  const paceParticipants = segment.participants
    .map((p) => roster.find((w) => w.id === p.wrestlerId))
    .filter((w): w is Wrestler => Boolean(w));

  const available = roster
    .filter((w) => !unavailable.has(w.id))
    .filter((w) => w.name.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 40);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1].map((s) => (
          <div key={s} className="rounded border border-neutral-800 p-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wide text-neutral-500">Side {s + 1}</span>
              <button
                type="button"
                data-testid={`side-${s}`}
                onClick={() => setSide(s)}
                className={`rounded px-2 py-0.5 text-[11px] ${side === s ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}
              >
                {side === s ? 'Adding here' : 'Add here'}
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {segment.participants
                .filter((p) => p.side === s)
                .map((p) => {
                  const wrestler = roster.find((w) => w.id === p.wrestlerId);
                  if (!wrestler) return null;
                  return (
                    <WrestlerRow
                      key={p.wrestlerId}
                      wrestler={wrestler}
                      settings={settings}
                      trailing={
                        <button
                          type="button"
                          onClick={() => onRemove(p.wrestlerId)}
                          className="rounded px-2 py-1 text-xs text-neutral-500 hover:text-rose-400"
                          aria-label={`Remove ${wrestler.name}`}
                        >
                          ✕
                        </button>
                      }
                    />
                  );
                })}
              {segment.participants.filter((p) => p.side === s).length === 0 && (
                <p className="text-[11px] text-neutral-600">Nobody yet</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search the roster…"
          className="mb-2 w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600"
        />
        <RowKey />
        <div data-testid="roster-picker" className="flex max-h-96 flex-col gap-1 overflow-y-auto">
          {available.map((w) => (
            <div key={w.id} data-testid="roster-pick">
              <WrestlerRow wrestler={w} settings={settings} onClick={() => onAdd(w.id, side)} />
            </div>
          ))}
          {available.length === 0 && (
            <p className="py-3 text-center text-[11px] text-neutral-600">
              Nobody left who is not already on this match.
            </p>
          )}
        </div>
      </div>

      {/* ---- what is at stake ------------------------------------------ */}
      <div>
        <div className="mb-1 text-[11px] uppercase tracking-wide text-neutral-500">On the line</div>
        {bookableTitles.length === 0 ? (
          <p className="text-[11px] text-neutral-600">
            No championship fits this match — a belt can only be defended by its champion, in its own division.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1">
              {bookableTitles.map((title) => {
                const booked = segment.titleIds.includes(title.id);
                return (
                  <button
                    key={title.id}
                    type="button"
                    data-testid={`title-${title.id}`}
                    onClick={() => onToggleTitle(title.id)}
                    title={title.blurb}
                    className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] ${
                      booked ? 'bg-amber-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: title.colorway.plate }}
                      aria-hidden
                    />
                    {shortTitleName(title)}
                    {title.vacant && <span className="text-neutral-400">(vacant)</span>}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[10px] text-neutral-600">
              {segment.titleIds.length === 0
                ? 'Nothing on the line. A champion can wrestle without defending.'
                : segment.titleIds.length > 1
                  ? 'Title for title — the winner leaves with all of them.'
                  : 'The belt does not change hands on a disqualification or a count-out.'}
            </p>
          </>
        )}
      </div>

      <div>
        <div className="mb-1 text-[11px] uppercase tracking-wide text-neutral-500">Stipulation</div>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => onStipulation(null)}
            className={`rounded px-2 py-1 text-[11px] ${!segment.stipulation ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300'}`}
          >
            Straight match
          </button>
          {STIPULATIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              title={s.blurb}
              onClick={() => onStipulation(s.id)}
              className={`rounded px-2 py-1 text-[11px] ${segment.stipulation === s.id ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* ---- ringside ------------------------------------------------- */}
      <div className="flex flex-col gap-3 rounded border border-neutral-800 p-2">
        <div className="text-[11px] uppercase tracking-wide text-neutral-500">Ringside</div>

        {[0, 1].map((side) => {
          const client = segment.participants.find((p) => p.side === side);
          const clientWrestler = client ? roster.find((w) => w.id === client.wrestlerId) : undefined;
          const current = (segment.managerIds ?? []).find((m) => m.forSide === side);
          return (
            <div key={side} className="flex flex-col gap-1">
              <span className="text-[11px] text-neutral-400">
                Manager for side {side + 1}
                {clientWrestler && <span className="ml-1 text-neutral-600">({clientWrestler.name})</span>}
              </span>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => onManager(null, side)}
                  className={`rounded px-2 py-1 text-[11px] ${!current ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300'}`}
                >
                  None
                </button>
                {/* Your own people first: a wrestler you moved into a suit
                    costs nothing per night, because he is already paid. */}
                {[...staffManagers, ...MANAGERS].map((manager) => (
                  <button
                    key={manager.id}
                    type="button"
                    data-testid={`manager-${side}-${manager.id}`}
                    onClick={() => onManager(manager.id, side)}
                    title={`${manager.blurb}${manager.feePerShow > 0 ? ` — $${manager.feePerShow}/show` : ' — already on the payroll'}${
                      clientWrestler ? ` · ${managerFit(manager, clientWrestler, settings)}` : ''
                    }`}
                    className={`rounded px-2 py-1 text-[11px] ${
                      current?.managerId === manager.id
                        ? 'bg-emerald-600 text-white'
                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    {manager.name}
                    <span className={`ml-1 ${manager.feePerShow > 0 ? 'text-neutral-500' : 'text-sky-500'}`}>
                      {manager.feePerShow > 0 ? `$${manager.feePerShow}` : 'yours'}
                    </span>
                  </button>
                ))}
              </div>
              {current && clientWrestler && (
                <span className="text-[10px] text-sky-400">
                  {managerFit(
                    [...staffManagers, ...MANAGERS].find((m) => m.id === current.managerId)!,
                    clientWrestler,
                    settings,
                  )}
                </span>
              )}
            </div>
          );
        })}

        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-neutral-400">
            Referee <span className="text-neutral-600">— leave it on the card&apos;s official, or name one for this match</span>
          </span>
          {/* Stating what the option *is* — not whether it is wise. Somebody
              always ends up counting; the question is whether they are neutral. */}
          {!defaultReferee && !segment.refereeId && !segment.guestRefereeId && (
            <span className="text-[11px] text-amber-400">
              One of the boys will have to count it, and they will have their own ideas about who should win.
            </span>
          )}
          {segment.guestRefereeId && (
            <span className="text-[11px] text-amber-400">
              A wrestler in the shirt. Bigger match, and they will take a side.
            </span>
          )}
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => onReferee(null)}
              className={`rounded px-2 py-1 text-[11px] ${
                !segment.refereeId && !segment.guestRefereeId ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300'
              }`}
            >
              {defaultReferee ? `Card official — ${defaultReferee.name}` : 'Nobody — draft one of the boys'}
            </button>
            {crew.map((referee) => {
              const hurt = !isAvailable(referee);
              return (
                <button
                  key={referee.id}
                  type="button"
                  data-testid={`referee-${referee.id}`}
                  disabled={hurt}
                  onClick={() => onReferee(referee.id)}
                  title={`${referee.blurb} — ${refereeGrade(referee)}`}
                  className={`rounded px-2 py-1 text-[11px] ${
                    hurt
                      ? 'cursor-not-allowed bg-neutral-900 text-neutral-700'
                      : segment.refereeId === referee.id
                        ? 'bg-emerald-600 text-white'
                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                  }`}
                >
                  {referee.name}
                  <span className={`ml-1 ${hurt ? 'text-neutral-700' : sharpnessTone(referee)}`}>
                    {hurt ? 'injured' : sharpnessLabel(referee)}
                  </span>
                </button>
              );
            })}
          </div>
          {segment.refereeId && (
            <span className="text-[10px] text-neutral-500">
              {crew.find((r) => r.id === segment.refereeId)?.blurb}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-neutral-400">
            Guest referee <span className="text-neutral-600">— star power, at the cost of a clean finish</span>
          </span>
          <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
            <button
              type="button"
              onClick={() => onGuestReferee(null)}
              className={`rounded px-2 py-1 text-[11px] ${!segment.guestRefereeId ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300'}`}
            >
              None
            </button>
            {roster
              // Somebody wrestling in the match cannot also count it.
              .filter((w) => !segment.participants.some((p) => p.wrestlerId === w.id))
              .slice(0, 24)
              .map((w) => (
                <button
                  key={w.id}
                  type="button"
                  data-testid={`guest-ref-${w.id}`}
                  onClick={() => onGuestReferee(w.id)}
                  className={`rounded px-2 py-1 text-[11px] ${
                    segment.guestRefereeId === w.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                  }`}
                >
                  {w.name}
                </button>
              ))}
          </div>
        </div>
      </div>

      <div>
        <div className="mb-1 text-[11px] uppercase tracking-wide text-neutral-500">
          Pace <span className="normal-case text-neutral-600">— what you send them out to do</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {PACES.map((pace) => (
            <button
              key={pace.id}
              type="button"
              data-testid={`pace-${pace.id}`}
              onClick={() => onPace(pace.id)}
              title={pace.blurb}
              className={`rounded px-2 py-1 text-[11px] ${
                segment.rules.pace === pace.id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              {pace.name}
            </button>
          ))}
        </div>
        {/* Says what the call is worth to the people picked, the same way
            manager fit does. Never a warning — the card will happily let you
            put a sprint on top. */}
        {paceParticipants.length > 0 && (
          <div className="mt-1 flex flex-col gap-0.5">
            <span className="text-[10px] text-sky-400">
              {paceFit({
                pace: segment.rules.pace,
                participants: paceParticipants,
                isMainEvent,
                isOpener,
                saturation: paceSaturation,
                settings,
              })}
            </span>
            <span className="text-[10px] text-neutral-600">{paceById(segment.rules.pace).blurb}</span>
          </div>
        )}
      </div>

      <div>
        <div className="mb-1 text-[11px] uppercase tracking-wide text-neutral-500">Time limit</div>
        <div className="flex flex-wrap gap-1">
          {TIME_LIMITS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              onClick={() => onTimeLimit(minutes)}
              className={`rounded px-2 py-1 text-[11px] ${segment.rules.timeLimit === minutes ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300'}`}
            >
              {minutes === 0 ? 'No limit' : `${minutes}m`}
            </button>
          ))}
        </div>
      </div>
    </div>
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
function BeltsOnTheClock() {
  const world = useGameStore((s) => s.world);
  if (!world) return null;
  const watch = defenceWatch(world.titles, world.promotion.id, world.week, world.settings);
  if (watch.length === 0) return null;

  return (
    <div className="mb-3 rounded-lg border border-amber-900/60 bg-amber-950/20 p-2.5" data-testid="belts-on-the-clock">
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
    <details className="mb-3 rounded-lg border border-sky-900/50 bg-sky-950/20" data-testid="fan-demands">
      <summary className="cursor-pointer px-2.5 py-2 text-[11px] text-sky-300">
        What they want to see ({demands.length})
      </summary>
      <ul className="flex flex-col gap-1 px-2.5 pb-2.5">
        {demands.map((demand) => (
          <li key={demand.id} className="text-[11px] leading-snug text-neutral-300">
            <span className={demand.kind === 'enoughOfHim' ? 'text-rose-300' : 'text-neutral-300'}>
              {demand.text}
            </span>
            {demand.signableFrom && (
              <span className="ml-1 text-amber-400">
                His deal there is nearly up — see The quiet business.
              </span>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
