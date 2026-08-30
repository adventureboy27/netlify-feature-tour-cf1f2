// One booked match, on its own screen — competitors, stakes, and rules, all
// visible at once as three columns rather than a tab strip. A phone column
// would have needed to pick one group at a time; a desktop window doesn't,
// and this is closer to how a real match-booking form works anyway — one
// dense page, not a wizard.

import { useGameStore } from '../../state/store';
import { STIPULATIONS } from '../../data/stipulations';
import { tierById as propTierById } from '../../data/matchProps';
import { unitConditionLabel } from '../../engine/economy/matchProps';
import { managerFit, type Manager } from '../../engine/sim/ringside';
import { signedReferees, sharpnessLabel, refereeGrade, isAvailable } from '../../engine/sim/referees';
import { Odds, HeatBadge } from '../components/display';
import { WrestlerRow } from '../components/WrestlerRow';
import { shortTitleName } from '../../data/titles';
import { PACES, paceById } from '../../data/pacing';
import { paceFit } from '../../engine/sim/pacing';
import { slotLabel } from '../cardLabels';
import { ScreenHeader } from '../components/ScreenHeader';
import { summarizeSegment, refereeSharpnessTone } from './segmentSummary';
import type { Id } from '../../engine/types';

const TIME_LIMITS = [0, 5, 10, 15, 20, 30, 60] as const;

export function MatchSetupScreen({
  slotIndex,
  onBack,
  onNavigateWrestler,
  onAddMore,
}: {
  slotIndex: number;
  onBack: () => void;
  onNavigateWrestler?: (id: Id) => void;
  /** Send the player to fill this same slot further — more participants, a tag partner. */
  onAddMore: () => void;
}) {
  const world = useGameStore((s) => s.world);
  const removeParticipant = useGameStore((s) => s.removeSegmentParticipant);
  const setStipulation = useGameStore((s) => s.setSegmentStipulation);
  const setGearUnits = useGameStore((s) => s.setSegmentGearUnits);
  const setRules = useGameStore((s) => s.setSegmentRules);
  const setManager = useGameStore((s) => s.setSegmentManager);
  const setReferee = useGameStore((s) => s.setSegmentReferee);
  const setGuestReferee = useGameStore((s) => s.setSegmentGuestReferee);
  const toggleTitle = useGameStore((s) => s.toggleSegmentTitle);

  if (!world) return null;
  const segment = world.currentCard[slotIndex];
  if (!segment) return <ScreenHeader title="That match is gone" onBack={onBack} />;

  const roster = world.promotion.rosterIds.map((id) => world.wrestlers[id]!).filter(Boolean);
  const crew = signedReferees(world.referees, world.promotion.id);
  const staffManagers: Manager[] = world.staffManagers;
  const defaultReferee = world.defaultRefereeId ? (crew.find((r) => r.id === world.defaultRefereeId) ?? null) : null;
  const summary = summarizeSegment(segment, roster, world);
  const isMainEvent = slotIndex === world.currentCard.length - 1;
  const isOpener = slotIndex === 0;
  const paceSaturation = world.paceSaturation[segment.rules.pace] ?? 0;
  const paceParticipants = summary.participants.map((p) => p.wrestler);

  const title =
    summary.participants.length === 0
      ? slotLabel(slotIndex, world.currentCard.length)
      : summary.sides
          .map((side) => summary.participants.filter((p) => p.side === side).map((p) => p.wrestler.name).join(' & '))
          .join('  vs  ');

  const selectedGearUnits = segment.gearUnitIds ?? [];

  return (
    <div className="p-6 text-neutral-100">
      <ScreenHeader title={title} subtitle={slotLabel(slotIndex, world.currentCard.length)} onBack={onBack} />

      {/* The same summary line the card overview shows, so nothing here
          contradicts what the player already saw before tapping in. */}
      <div className="mt-2 mb-4 flex flex-wrap items-center gap-2 text-[11px]">
        {summary.stipulation && (
          <span
            className={`rounded px-1.5 py-0.5 ${summary.requirementsMet ? 'bg-sky-950 text-sky-300' : 'bg-amber-950 text-amber-300'}`}
            title={summary.requirementsMet ? summary.stipulation.blurb : "Requirements aren't met — this will cost you"}
          >
            {summary.stipulation.name}
            {!summary.requirementsMet && ' ⚠'}
          </span>
        )}
        {summary.stakes && (
          <span
            className={`rounded px-1.5 py-0.5 ${summary.stakes === 'Non-title' ? 'bg-neutral-800 text-neutral-400' : 'bg-amber-950 text-amber-300'}`}
          >
            {summary.stakes}
          </span>
        )}
        {summary.rivalry && <HeatBadge heat={summary.rivalry.heat} shootHeat={summary.rivalry.shootHeat} />}
        {summary.odds !== null && <Odds probability={summary.odds} />}
        {summary.storyline && <span className="text-sky-400">Advances: {summary.storyline.name}</span>}
        <span className="text-neutral-500">{summary.officialLabel}</span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* ---- Cast --------------------------------------------------- */}
        <div className="flex flex-col gap-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Cast</div>

          <div className="flex flex-col gap-2">
            {[0, 1].map((s) => (
              <div key={s} className="rounded border border-neutral-800 p-2">
                <span className="text-[11px] uppercase tracking-wide text-neutral-500">Side {s + 1}</span>
                <div className="mt-1 flex flex-col gap-1">
                  {segment.participants
                    .filter((p) => p.side === s)
                    .map((p) => {
                      const wrestler = roster.find((w) => w.id === p.wrestlerId);
                      if (!wrestler) return null;
                      return (
                        // A plain div, not WrestlerRow's own onClick — the row
                        // also needs a real, separate ✕ button, and WrestlerRow
                        // puts everything including `trailing` inside one
                        // <button> once onClick is set, which would nest a
                        // button inside a button. stopPropagation on the ✕ is
                        // what keeps "remove" from also triggering "view".
                        <div
                          key={p.wrestlerId}
                          role={onNavigateWrestler ? 'button' : undefined}
                          tabIndex={onNavigateWrestler ? 0 : undefined}
                          onClick={onNavigateWrestler ? () => onNavigateWrestler(p.wrestlerId) : undefined}
                          className={onNavigateWrestler ? 'cursor-pointer' : undefined}
                        >
                          <WrestlerRow
                            wrestler={wrestler}
                            settings={world.settings}
                            compact
                            trailing={
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeParticipant(slotIndex, p.wrestlerId);
                                }}
                                className="rounded px-2 py-1 text-xs text-neutral-500 hover:text-rose-400"
                                aria-label={`Remove ${wrestler.name}`}
                              >
                                ✕
                              </button>
                            }
                          />
                        </div>
                      );
                    })}
                  {segment.participants.filter((p) => p.side === s).length === 0 && (
                    <p className="text-[11px] text-neutral-600">Nobody yet</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            data-testid="add-more"
            onClick={onAddMore}
            className="rounded bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-700"
          >
            Add someone
          </button>

          {/* ---- ringside ----------------------------------------------- */}
          <div className="flex flex-col gap-3 rounded border border-neutral-800 p-2">
            <div className="text-[11px] uppercase tracking-wide text-neutral-500">Ringside</div>

            {[0, 1].flatMap((side) =>
              [0, 1].map((seat) => {
                const client = segment.participants.find((p) => p.side === side);
                const clientWrestler = client ? roster.find((w) => w.id === client.wrestlerId) : undefined;
                const inCorner = (segment.managerIds ?? []).filter((m) => m.forSide === side);
                const current = inCorner[seat];
                const partner = inCorner[1 - seat];
                return (
                  <div key={`${side}-${seat}`} className="flex flex-col gap-1">
                    <span className="text-[11px] text-neutral-400">
                      {seat === 0 ? 'Mouthpiece' : 'Muscle'} for side {side + 1}
                      {clientWrestler && <span className="ml-1 text-neutral-600">({clientWrestler.name})</span>}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => setManager(slotIndex, null, side, seat)}
                        className={`rounded px-2 py-1 text-[11px] ${!current ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300'}`}
                      >
                        None
                      </button>
                      {staffManagers.map((manager) => (
                        <button
                          key={manager.id}
                          type="button"
                          data-testid={`manager-${side}-${seat}-${manager.id}`}
                          onClick={() => setManager(slotIndex, manager.id, side, seat)}
                          title={`${manager.blurb}${manager.feePerShow > 0 ? ` — $${manager.feePerShow}/show` : ' — already on the payroll'}${
                            clientWrestler ? ` · ${managerFit(manager, clientWrestler, world.settings)}` : ''
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
                    {current && clientWrestler && staffManagers.some((m) => m.id === current.managerId) && (
                      <span className="text-[10px] text-sky-400">
                        {managerFit(staffManagers.find((m) => m.id === current.managerId)!, clientWrestler, world.settings)}
                      </span>
                    )}
                    {current && partner && seat === 1 && (
                      <span className="text-[10px] text-fuchsia-400">Two men in this corner, behind the same wrestler.</span>
                    )}
                  </div>
                );
              }),
            )}

            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-neutral-400">
                Referee <span className="text-neutral-600">— leave it on the card&apos;s official, or name one for this match</span>
              </span>
              {!defaultReferee && !segment.refereeId && !segment.guestRefereeId && (
                <span className="text-[11px] text-amber-400">
                  One of the boys will have to count it, and they will have their own ideas about who should win.
                </span>
              )}
              {segment.guestRefereeId && (
                <span className="text-[11px] text-amber-400">A wrestler in the shirt. Bigger match, and they will take a side.</span>
              )}
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setReferee(slotIndex, null)}
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
                      onClick={() => setReferee(slotIndex, referee.id)}
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
                      <span className={`ml-1 ${hurt ? 'text-neutral-700' : refereeSharpnessTone(referee)}`}>
                        {hurt ? 'injured' : sharpnessLabel(referee)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-neutral-400">
                Guest referee <span className="text-neutral-600">— star power, at the cost of a clean finish</span>
              </span>
              <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => setGuestReferee(slotIndex, null)}
                  className={`rounded px-2 py-1 text-[11px] ${!segment.guestRefereeId ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300'}`}
                >
                  None
                </button>
                {roster
                  .filter((w) => !segment.participants.some((p) => p.wrestlerId === w.id))
                  .slice(0, 24)
                  .map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      data-testid={`guest-ref-${w.id}`}
                      onClick={() => setGuestReferee(slotIndex, w.id)}
                      className={`rounded px-2 py-1 text-[11px] ${
                        segment.guestRefereeId === w.id ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                      }`}
                    >
                      {w.name}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* ---- Rules ---------------------------------------------------- */}
        <div className="flex flex-col gap-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Rules</div>

          <div>
            <div className="mb-1 text-[11px] uppercase tracking-wide text-neutral-500">Stipulation</div>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setStipulation(slotIndex, null)}
                className={`rounded px-2 py-1 text-[11px] ${!segment.stipulation ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300'}`}
              >
                Straight match
              </button>
              {STIPULATIONS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  title={s.blurb}
                  onClick={() => setStipulation(slotIndex, s.id)}
                  className={`rounded px-2 py-1 text-[11px] ${segment.stipulation === s.id ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          {summary.gearFamily && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wide text-neutral-500">{summary.gearFamily.name}s</span>
                <span className="text-[10px] text-neutral-600">
                  {selectedGearUnits.length}/{summary.gearFamily.maxUnitsInMatch} tonight
                </span>
              </div>
              {summary.usableGearUnits.length === 0 ? (
                <p className="text-[11px] text-amber-400">
                  You don't own a {summary.gearFamily.name.toLowerCase()} — buy one from the Promotion screen before this
                  can happen for real.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1">
                    {summary.usableGearUnits.map((unit) => {
                      const tier = propTierById(unit.tierId);
                      const picked = selectedGearUnits.includes(unit.id);
                      const disabled = !picked && selectedGearUnits.length >= summary.gearFamily!.maxUnitsInMatch;
                      return (
                        <button
                          key={unit.id}
                          type="button"
                          disabled={disabled}
                          onClick={() =>
                            setGearUnits(
                              slotIndex,
                              picked ? selectedGearUnits.filter((id) => id !== unit.id) : [...selectedGearUnits, unit.id],
                            )
                          }
                          className={`rounded px-2 py-1 text-[11px] ${
                            picked
                              ? 'bg-emerald-600 text-white'
                              : disabled
                                ? 'bg-neutral-900 text-neutral-700'
                                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                          }`}
                        >
                          {tier?.name ?? summary.gearFamily!.name} — {unitConditionLabel(unit, world.settings)}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-[10px] text-neutral-600">
                    More {summary.gearFamily.name.toLowerCase()}s is a bigger spectacle. It's also more that can go wrong
                    tonight.
                  </p>
                </>
              )}
            </div>
          )}

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
                  onClick={() => setRules(slotIndex, { pace: pace.id })}
                  title={pace.blurb}
                  className={`rounded px-2 py-1 text-[11px] ${
                    segment.rules.pace === pace.id ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                  }`}
                >
                  {pace.name}
                </button>
              ))}
            </div>
            {paceParticipants.length > 0 && (
              <div className="mt-1 flex flex-col gap-0.5">
                <span className="text-[10px] text-sky-400">
                  {paceFit({
                    pace: segment.rules.pace,
                    participants: paceParticipants,
                    isMainEvent,
                    isOpener,
                    saturation: paceSaturation,
                    settings: world.settings,
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
                  onClick={() => setRules(slotIndex, { timeLimit: minutes })}
                  className={`rounded px-2 py-1 text-[11px] ${segment.rules.timeLimit === minutes ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300'}`}
                >
                  {minutes === 0 ? 'No limit' : `${minutes}m`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ---- Stakes ----------------------------------------------------- */}
        <div className="flex flex-col gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Stakes</div>
          {summary.bookable.length === 0 ? (
            <p className="text-[11px] text-neutral-600">
              No championship fits this match — a belt can only ever be defended by its own champion, in its own
              division.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1">
                {summary.bookable.map((title) => {
                  const booked = segment.titleIds.includes(title.id);
                  return (
                    <button
                      key={title.id}
                      type="button"
                      data-testid={`title-${title.id}`}
                      onClick={() => toggleTitle(slotIndex, title.id)}
                      title={title.blurb}
                      className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] ${
                        booked ? 'bg-amber-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: title.colorway.plate }} aria-hidden />
                      {shortTitleName(title)}
                      {title.vacant && <span className="text-neutral-400">(vacant)</span>}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-[10px] text-neutral-600">
                {segment.titleIds.length === 0
                  ? 'Nothing on the line here. A champion can absolutely wrestle without defending.'
                  : segment.titleIds.length > 1
                    ? 'Title for title — the winner walks out with every single one of them.'
                    : 'That belt does not change hands on a disqualification or a count-out. Never has.'}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
