// The two walls — §19.
//
// A management game that runs for decades needs somewhere the decades show
// up. The hall is the good version of that: names you signed, pushed, and put
// over, with the case for each one written out. The memorial is the other
// one, and it is deliberately quiet — a name, an age, a line, nothing else.

import { useGameStore } from '../../state/store';
import { PaperDoll } from '../paperdoll/PaperDoll';
import { effectiveAppearance } from '../../engine/generate/gimmickLook';
import { billedAs } from '../../engine/generate/nickname';
import { DEATH_CAUSE_TEXT } from '../../engine/career/mortality';
import { yearsPro } from '../../engine/career/status';

export function LegacyScreen() {
  const world = useGameStore((s) => s.world);
  if (!world) return null;

  const yearOf = (week: number) => world.settings.startingYear + Math.floor(week / 52);
  const retired = Object.values(world.wrestlers).filter(
    (w) => !w.deceased && w.careerStatus === 'retired' && w.hallOfFameWeek === undefined,
  );

  return (
    <div className="p-3 pb-24 text-neutral-100">
      <h1 className="mb-3 text-base font-semibold">Legacy</h1>

      <section className="mb-5">
        <h2 className="mb-2 text-sm font-medium text-amber-400">Hall of Fame — {world.hallOfFame.length}</h2>
        {world.hallOfFame.length === 0 ? (
          <p className="text-xs text-neutral-500">
            Nobody yet. The hall takes finished careers, and only the ones that were worth finishing.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {[...world.hallOfFame].reverse().map((entry) => {
              const w = world.wrestlers[entry.wrestlerId];
              if (!w) return null;
              return (
                <article
                  key={entry.wrestlerId}
                  data-testid={`hof-${entry.wrestlerId}`}
                  className="flex gap-2 rounded border border-amber-900/60 bg-amber-950/20 p-2"
                >
                  <PaperDoll
                    appearance={effectiveAppearance(w, world.stables)}
                    gender={w.gender}
                    alignment={w.alignment}
                    size="bust"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{billedAs(w)}</div>
                    <div className="text-[10px] text-amber-500/80">Class of {yearOf(entry.week)}</div>
                    <p className="mt-1 text-[11px] text-neutral-400">{entry.citation}.</p>
                    {w.deceased && <div className="mt-0.5 text-[10px] text-neutral-600">Inducted posthumously</div>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="mb-5">
        <h2 className="mb-2 text-sm font-medium text-neutral-300">In memoriam — {world.memoriam.length}</h2>
        {world.memoriam.length === 0 ? (
          <p className="text-xs text-neutral-500">Nobody, so far.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {[...world.memoriam].reverse().map((passing) => {
              const w = world.wrestlers[passing.wrestlerId];
              if (!w) return null;
              return (
                <li
                  key={passing.wrestlerId}
                  data-testid={`memoriam-${passing.wrestlerId}`}
                  className="flex items-baseline justify-between gap-2 rounded border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-xs"
                >
                  <span className="min-w-0">
                    <span className="font-medium">{billedAs(w)}</span>
                    <span className="block text-[10px] text-neutral-500">
                      {DEATH_CAUSE_TEXT[passing.cause]}, aged {passing.age}
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] text-neutral-600">{yearOf(passing.week)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-neutral-300">Retired — {retired.length}</h2>
        {retired.length === 0 ? (
          <p className="text-xs text-neutral-500">Everybody is still working.</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {retired.map((w) => (
              <span
                key={w.id}
                className="rounded bg-neutral-800 px-2 py-1 text-[11px] text-neutral-300"
                title={`${yearsPro(w, world.settings.startingYear + Math.floor(world.week / 52))} years in the business`}
              >
                {w.name}
                <span className="ml-1 text-neutral-500">{w.age}</span>
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
