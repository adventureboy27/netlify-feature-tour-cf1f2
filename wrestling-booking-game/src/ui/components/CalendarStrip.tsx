// The year as a strip of months, the way a wall planner in an office would do
// it: a row of tiles per month, one tile per week, and you can see the big
// nights coming from a long way off.
//
// No dates anywhere. A tile is a month, a week within it, and the night the
// show runs on — which is as specific as this game has ever got and as
// specific as a booker needs.

import { useGameStore } from '../../state/store';
import { calendarMonths, MARK_LABELS, type WeekMark } from '../../engine/world/calendarView';

const TILE: Record<WeekMark, { box: string; text: string }> = {
  none: { box: 'border-neutral-800 bg-neutral-900/60', text: 'text-neutral-600' },
  houseShow: { box: 'border-neutral-700 bg-neutral-900', text: 'text-neutral-400' },
  television: { box: 'border-sky-800 bg-sky-950/40', text: 'text-sky-300' },
  ppv: { box: 'border-amber-700 bg-amber-950/40', text: 'text-amber-300' },
  supershow: { box: 'border-fuchsia-700 bg-fuchsia-950/40', text: 'text-fuchsia-300' },
  cup: { box: 'border-emerald-600 bg-emerald-950/40', text: 'text-emerald-300' },
};

export function CalendarStrip({ months = 3 }: { months?: number }) {
  const world = useGameStore((s) => s.world);
  // A save from before the schedule existed has no shape to draw.
  if (!world?.promotion.schedule) return null;

  const view = calendarMonths(world.week, months, {
    now: world.week,
    schedule: world.promotion.schedule,
    settings: world.settings,
    // The Crucible's month goes here once the tournament exists. Deliberately
    // not passed yet: a tile promising an event the game cannot run is the
    // exact dead-end wire the last audit was about.
    cupMonth: null,
  });

  return (
    <div className="flex flex-col gap-2">
      {view.map((month) => (
        <div key={`${month.month}-${month.year}`}>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-xs font-semibold text-neutral-200">{month.month}</span>
            <span className="text-[10px] uppercase tracking-wide text-neutral-500">
              {month.year}
            </span>
          </div>
          <div className="flex gap-1">
            {month.weeks.map((w) => {
              const skin = TILE[w.mark];
              return (
                <div
                  key={w.week}
                  title={`${month.month}, week ${w.weekOfMonth} — ${w.label}${w.day ? ` (${w.day})` : ''}`}
                  className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded border px-1 py-1.5 ${
                    skin.box
                  } ${w.isNow ? 'ring-2 ring-white/70' : ''} ${w.isPast && !w.isNow ? 'opacity-40' : ''}`}
                >
                  <span className="text-[9px] uppercase tracking-wide text-neutral-500">
                    wk {w.weekOfMonth}
                  </span>
                  <span className={`truncate text-[10px] font-semibold ${skin.text}`}>
                    {MARK_LABELS[w.mark]}
                  </span>
                  {w.day && (
                    <span className="text-[9px] text-neutral-500">{w.day.slice(0, 3)}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
