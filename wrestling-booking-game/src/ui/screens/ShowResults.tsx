// Show results — §21. Locked rule: "Results appear at the end of the show,
// all at once. Not match by match." So this screen renders the completed
// show in one pass, and the player reads it.
//
// Each segment gets its highlight write-up (§11.5, 3-5 lines, never a
// play-by-play) and its rating breakdown panel, which is the one numeric
// surface in the game.

import { useGameStore } from '../../state/store';
import { stipulationById } from '../../data/stipulations';
import { Stars, BreakdownPanel, Money, HeatBadge } from '../components/display';
import { PaperDoll } from '../paperdoll/PaperDoll';
import type { FinishType, Show, Wrestler } from '../../engine/types';

const FINISH_TEXT: Record<FinishType, string> = {
  cleanPin: 'by pinfall',
  submission: 'by submission',
  knockout: 'by knockout',
  rollup: 'with a roll-up',
  interference: 'after interference',
  disqualification: 'by disqualification',
  countOut: 'by count-out',
  timeLimitDraw: 'time-limit draw',
  doubleKO: 'double knockout',
  refereeStoppage: 'referee stoppage',
  injuryStoppage: 'stopped through injury',
};

export function ShowResults({ show, onContinue }: { show: Show; onContinue: () => void }) {
  const world = useGameStore((s) => s.world);
  if (!world) return null;

  const wrestlerName = (id: string) => world.wrestlers[id]?.name ?? 'Someone';
  const booked = show.segments.filter((s) => s.result !== null);

  return (
    <div className="p-3 pb-24 text-neutral-100">
      <header className="mb-4 rounded border border-neutral-800 bg-neutral-900 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold">Week {show.week} — results</h1>
            <div className="mt-1 flex items-center gap-2">
              <Stars stars={show.showStars} />
              <span className="text-xs text-neutral-500">show rating</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onContinue}
            className="shrink-0 rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Next week
          </button>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
          <Stat label="Attendance" value={show.attendance.toLocaleString()} />
          <Stat label="Gate" value={<Money amount={show.gate} />} />
          <Stat label="Payroll" value={<Money amount={-show.payroll} />} />
          <Stat label="Bank" value={<Money amount={world.promotion.bankBalance} />} />
        </dl>
      </header>

      <div className="flex flex-col gap-3">
        {booked.map((segment) => {
          const result = segment.result!;
          const stipulation = segment.stipulation ? stipulationById(segment.stipulation) : null;
          const winners = result.winnerWrestlerIds.map(wrestlerName);
          const losers = segment.participants
            .filter((p) => !result.winnerWrestlerIds.includes(p.wrestlerId))
            .map((p) => world.wrestlers[p.wrestlerId])
            .filter((w): w is Wrestler => Boolean(w));

          return (
            <article key={segment.slot} className="rounded border border-neutral-800 bg-neutral-900 p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm">
                    {segment.participants
                      .map((p) => wrestlerName(p.wrestlerId))
                      .join(result.winnerSide === null ? ' vs ' : ' vs ')}
                  </div>
                  {stipulation && <div className="text-[11px] text-sky-400">{stipulation.name}</div>}
                </div>
                <Stars stars={result.stars} />
              </div>

              <p className="mb-2 text-sm text-neutral-300">
                {result.winnerSide === null ? (
                  <>Went to a {FINISH_TEXT[result.finish]}.</>
                ) : (
                  <>
                    <span className="font-medium text-emerald-400">{winners.join(' & ')}</span> beat{' '}
                    {losers.map((w) => w.name).join(' & ')} {FINISH_TEXT[result.finish]}.
                  </>
                )}
              </p>

              {result.beats.filter((b) => b.significant).length > 0 && (
                <ul className="mb-2 flex flex-col gap-0.5 border-l-2 border-neutral-800 pl-3 text-xs text-neutral-400">
                  {result.beats
                    .filter((b) => b.significant)
                    .map((beat, i) => (
                      <li key={i}>{beat.text}</li>
                    ))}
                </ul>
              )}

              <details>
                <summary className="cursor-pointer text-[11px] text-neutral-500 hover:text-neutral-300">
                  Why it rated what it did
                </summary>
                <div className="mt-2">
                  <BreakdownPanel breakdown={result.ratingBreakdown} rating={result.rating} />
                </div>
              </details>
            </article>
          );
        })}

        {booked.length === 0 && (
          <p className="rounded border border-neutral-800 bg-neutral-900 p-6 text-center text-sm text-neutral-500">
            You ran a show with nothing on it. The rating reflects that.
          </p>
        )}
      </div>

      <RivalryDigest />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-neutral-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

/** What the night did to the feuds — the part that carries into next week. */
function RivalryDigest() {
  const world = useGameStore((s) => s.world);
  if (!world) return null;

  const live = world.rivalries.filter((r) => r.resolvedWeek === null && (r.heat > 0 || r.shootHeat > 0));
  if (live.length === 0) return null;

  return (
    <section className="mt-4">
      <h2 className="mb-2 text-sm font-medium text-neutral-300">Running feuds</h2>
      <div className="flex flex-col gap-1.5">
        {live.map((rivalry) => {
          const people = rivalry.participantIds.map((id) => world.wrestlers[id]).filter((w): w is Wrestler => Boolean(w));
          return (
            <div key={rivalry.id} className="flex items-center gap-2 rounded border border-neutral-800 bg-neutral-900 p-2">
              <div className="flex -space-x-2">
                {people.map((w) => (
                  <PaperDoll key={w.id} appearance={w.appearance} gender={w.gender} alignment={w.alignment} size="thumb" />
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs">{people.map((w) => w.name).join(' vs ')}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1">
                  <HeatBadge heat={rivalry.heat} shootHeat={rivalry.shootHeat} />
                  {rivalry.origin === 'shoot' && (
                    <span className="text-[10px] text-neutral-600">not your idea</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

