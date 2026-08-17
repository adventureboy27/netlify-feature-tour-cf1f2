// The two walls — §19.
//
// A management game that runs for decades needs somewhere the decades show
// up. The hall is the good version of that: names you signed, pushed, and put
// over, with the case for each one written out.
//
// The memorial is the other one. It was a name, an age and a cause — which is
// a death certificate rather than a life, sitting directly under a hall that
// gives everybody a portrait and a citation. A man who worked twenty years and
// held three belts got one grey line reading "a heart attack, aged 61". So it
// carries what he left now, off the reigns and the record that were already
// there. Quieter than the hall, but not empty. See career/epitaph.ts.

import { useGameStore } from '../../state/store';
import { PaperDoll } from '../paperdoll/PaperDoll';
import { effectiveAppearance } from '../../engine/generate/gimmickLook';
import { billedAs } from '../../engine/generate/nickname';
import { DEATH_CAUSE_TEXT } from '../../engine/career/mortality';
import { yearsPro } from '../../engine/career/status';
import { howTheyWent, whatTheyLeave, whoTheyWere } from '../../engine/career/epitaph';
import { awardById } from '../../engine/career/awards';

export function LegacyScreen() {
  const world = useGameStore((s) => s.world);
  if (!world) return null;

  const yearOf = (week: number) => world.settings.startingYear + Math.floor(week / 52);
  const retired = Object.values(world.wrestlers).filter(
    (w) => !w.deceased && w.careerStatus === 'retired' && w.hallOfFameWeek === undefined,
  );
  // Newest year first — the argument people are still having is this year's.
  const awardYears = [...new Set(world.awardHistory.map((entry) => entry.year))].sort((a, b) => b - a);

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
              const left = whatTheyLeave(w, {
                currentWeek: passing.week,
                currentYear: yearOf(passing.week),
                titles: world.titles,
              });
              return (
                <li
                  key={passing.wrestlerId}
                  data-testid={`memoriam-${passing.wrestlerId}`}
                  className="flex gap-2 rounded border border-neutral-800 bg-neutral-900 p-2 text-xs"
                >
                  <PaperDoll
                    appearance={effectiveAppearance(w, world.stables)}
                    gender={w.gender}
                    alignment={w.alignment}
                    size="bust"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-medium">{billedAs(w)}</span>
                      <span className="shrink-0 text-[10px] text-neutral-600">{yearOf(passing.week)}</span>
                    </div>
                    <div className="text-[10px] text-neutral-400">
                      {whoTheyWere(w, yearOf(passing.week))} · aged {passing.age}
                    </div>
                    {/* §0 does not stop applying once he is on the wall: this
                        says how it happened, including when it was us. */}
                    <div className="text-[10px] text-neutral-500">
                      {howTheyWent(w, DEATH_CAUSE_TEXT[passing.cause])}
                    </div>
                    {left.length > 0 && (
                      <ul className="mt-1 flex flex-col gap-0.5">
                        {left.map((line) => (
                          <li key={line} className="text-[10px] leading-snug text-neutral-500">
                            {line}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mb-5">
        <h2 className="mb-2 text-sm font-medium text-neutral-300">Awards</h2>
        {world.awardHistory.length === 0 ? (
          <p className="text-xs text-neutral-500">
            The first awards go out at the end of the year. Some of them are ones nobody wants.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {awardYears.map((year) => (
              <div key={year}>
                <div className="mb-1 text-[11px] uppercase tracking-wide text-neutral-500">{year}</div>
                <ul className="flex flex-col gap-1">
                  {world.awardHistory
                    .filter((entry) => entry.year === year)
                    .map((entry) => {
                      const definition = awardById(entry.awardId);
                      const good = definition?.good ?? true;
                      return (
                        <li
                          key={`${year}-${entry.awardId}`}
                          data-testid={`award-${year}-${entry.awardId}`}
                          className={`rounded border px-2 py-1.5 text-xs ${
                            good ? 'border-amber-900/60 bg-amber-950/20' : 'border-rose-900/60 bg-rose-950/20'
                          }`}
                        >
                          <span className={`text-[10px] uppercase tracking-wide ${good ? 'text-amber-500' : 'text-rose-400'}`}>
                            {definition?.name ?? entry.awardId}
                          </span>
                          <span className="block font-medium">
                            {entry.wrestlerIds
                              .map((id) => world.wrestlers[id])
                              .filter(Boolean)
                              .map((w) => billedAs(w!))
                              .join(' & ')}
                          </span>
                          <span className="block text-[11px] text-neutral-400">{entry.citation}</span>
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
          </div>
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
