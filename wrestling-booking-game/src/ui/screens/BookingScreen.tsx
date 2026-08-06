// The card builder — §21's "Match Setup" plus the card view. This is M2's
// main interaction, and per §9 it has no time pressure and no warnings: the
// game will let you book Loser Leaves between two strangers and find out.

import { useMemo, useState } from 'react';
import { useGameStore } from '../../state/store';
import { STIPULATIONS, stipulationById, stipulationRequirementsMet, effectiveRules } from '../../data/stipulations';
import { MANAGERS, REFEREES, managerById, refereeById } from '../../data/ringsidePool';
import { managerFit } from '../../engine/sim/ringside';
import { findRivalry } from '../../engine/sim/rivalry';
import { ruleAdjustedWeights, kayfabeScore } from '../../engine/sim/kayfabe';
import { pairWinProbability } from '../../engine/sim/winProbability';
import { PaperDoll } from '../paperdoll/PaperDoll';
import { Odds, HeatBadge, AlignmentDot, StatBar } from '../components/display';
import { eligibleTitles, titleStakesLabel } from '../../engine/sim/titleMatch';
import { shortTitleName } from '../../data/titles';
import { isPPVWeek, ppvNameForWeek, weeksUntilPPV } from '../../engine/world/calendar';
import type { Id, Wrestler, Segment, Title, WorldSettings } from '../../engine/types';

const SLOT_LABELS = ['Opener', 'Second', 'Third', 'Fourth', 'Semi-main', 'Main event'];

function slotLabel(index: number, total: number): string {
  if (index === total - 1) return 'Main event';
  return SLOT_LABELS[index] ?? `Match ${index + 1}`;
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
  const toggleTitle = useGameStore((s) => s.toggleSegmentTitle);
  const autoFill = useGameStore((s) => s.autoFillCard);
  const [openSlot, setOpenSlot] = useState(0);

  const roster = useMemo(
    () => (world ? world.promotion.rosterIds.map((id) => world.wrestlers[id]!).filter(Boolean) : []),
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

  return (
    <div className="p-3 pb-24 text-neutral-100">
      <div className="mb-3 flex items-center justify-between">
        <div>
          {tonightIsPPV ? (
            <>
              <div className="text-[10px] uppercase tracking-wide text-amber-500">Pay-per-view</div>
              <h1 className="text-base font-semibold text-amber-400">{tonightsName ?? 'The big one'}</h1>
            </>
          ) : (
            <h1 className="text-base font-semibold">This week&apos;s card</h1>
          )}
          <p className="text-xs text-neutral-500">
            {filledSegments} of {world.currentCard.length} segments booked
            {!tonightIsPPV && weeksToPPV > 0 && (
              <span className="text-neutral-600">
                {' '}
                · {nextName ?? 'the next pay-per-view'} in {weeksToPPV} {weeksToPPV === 1 ? 'week' : 'weeks'}
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
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
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Run the show
          </button>
        </div>
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
            participants: participants.map((p) => ({ wrestler: p.wrestler, side: p.role.side })),
            promotionId: world.promotion.id,
          });
          const onTheLine = segment.titleIds
            .map((id) => world.titles.find((t) => t.id === id))
            .filter((t): t is NonNullable<typeof t> => Boolean(t));
          const championInMatch = bookable.some((t) => !t.vacant);
          const stakes = titleStakesLabel(onTheLine, championInMatch);
          const isOpen = openSlot === index;

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
                    onManager={(managerId, forSide) => setManager(index, managerId, forSide)}
                    onReferee={(refereeId) => setReferee(index, refereeId)}
                    onGuestReferee={(id) => setGuestReferee(index, id)}
                    settings={world.settings}
                  />
                </div>
              )}
            </section>
          );
        })}
      </div>
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
  onManager,
  onReferee,
  onGuestReferee,
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
  onManager: (managerId: Id | null, forSide: number) => void;
  onReferee: (refereeId: Id | null) => void;
  onGuestReferee: (wrestlerId: Id | null) => void;
  settings: WorldSettings;
}) {
  const [side, setSide] = useState(0);
  const [search, setSearch] = useState('');

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
                    <div key={p.wrestlerId} className="flex items-center gap-2 rounded bg-neutral-950 p-1.5">
                      <PaperDoll
                        appearance={wrestler.appearance}
                        gender={wrestler.gender}
                        alignment={wrestler.alignment}
                        size="thumb"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 truncate text-xs">
                          <AlignmentDot alignment={wrestler.alignment} />
                          {wrestler.name}
                        </div>
                        <StatBar label="Popularity" value={wrestler.popularity} />
                        <StatBar label="Condition" value={wrestler.health} tone="health" />
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemove(p.wrestlerId)}
                        className="shrink-0 rounded px-1.5 text-xs text-neutral-500 hover:text-rose-400"
                        aria-label={`Remove ${wrestler.name}`}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              {segment.participants.filter((p) => p.side === s).length === 0 && (
                <p className="py-2 text-center text-[11px] text-neutral-600">Nobody yet</p>
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
        <div data-testid="roster-picker" className="flex max-h-48 flex-wrap gap-1 overflow-y-auto">
          {available.map((w) => (
            <button
              key={w.id}
              type="button"
              data-testid="roster-pick"
              onClick={() => onAdd(w.id, side)}
              className="flex items-center gap-1.5 rounded bg-neutral-800 px-2 py-1 text-[11px] hover:bg-neutral-700"
            >
              <AlignmentDot alignment={w.alignment} />
              {w.name}
            </button>
          ))}
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
                {MANAGERS.map((manager) => (
                  <button
                    key={manager.id}
                    type="button"
                    data-testid={`manager-${side}-${manager.id}`}
                    onClick={() => onManager(manager.id, side)}
                    title={`${manager.blurb} — $${manager.feePerShow}/show${
                      clientWrestler ? ` · ${managerFit(manager, clientWrestler, settings)}` : ''
                    }`}
                    className={`rounded px-2 py-1 text-[11px] ${
                      current?.managerId === manager.id
                        ? 'bg-emerald-600 text-white'
                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    {manager.name}
                    <span className="ml-1 text-neutral-500">${manager.feePerShow}</span>
                  </button>
                ))}
              </div>
              {current && clientWrestler && (
                <span className="text-[10px] text-sky-400">
                  {managerFit(managerById(current.managerId)!, clientWrestler, settings)}
                </span>
              )}
            </div>
          );
        })}

        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-neutral-400">Referee</span>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => onReferee(null)}
              className={`rounded px-2 py-1 text-[11px] ${
                !segment.refereeId && !segment.guestRefereeId ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300'
              }`}
            >
              Whoever is available
            </button>
            {REFEREES.map((referee) => (
              <button
                key={referee.id}
                type="button"
                data-testid={`referee-${referee.id}`}
                onClick={() => onReferee(referee.id)}
                title={`${referee.blurb} — $${referee.feePerShow}/show`}
                className={`rounded px-2 py-1 text-[11px] ${
                  segment.refereeId === referee.id
                    ? 'bg-emerald-600 text-white'
                    : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                }`}
              >
                {referee.name}
                <span className="ml-1 text-neutral-500">${referee.feePerShow}</span>
              </button>
            ))}
          </div>
          {segment.refereeId && (
            <span className="text-[10px] text-neutral-500">{refereeById(segment.refereeId)?.blurb}</span>
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
