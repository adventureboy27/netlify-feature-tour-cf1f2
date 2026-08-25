// The year as a wall planner: months, weeks, and every night of every week.
//
// All seven days are drawn whether anything runs on them or not, because the
// empty ones are the useful ones — a dark Tuesday is a Tuesday you could put a
// show on, and a calendar that only draws what is already booked tells the
// booker nothing he does not know. Tap a night to run a show on that weekday,
// tap it again to stop.
//
// No dates. Ever. A night is a month, a week within it, and a day name — the
// game has never had a 14th of November and is not going to start. The year is
// on the month header because saves and records need to know which year they
// are talking about.

import { useGameStore } from '../../state/store';
import { calendarMonths, type WeekMark } from '../../engine/world/calendarView';
import { DAYS } from '../../engine/world/calendar';
import { CUP_MONTH } from '../../engine/world/cup';

const NIGHT: Record<WeekMark, string> = {
  none: 'border-neutral-800 bg-neutral-950 text-neutral-700',
  houseShow: 'border-neutral-600 bg-neutral-800 text-neutral-300',
  television: 'border-sky-700 bg-sky-950 text-sky-300',
  ppv: 'border-amber-600 bg-amber-950 text-amber-300',
  supershow: 'border-fuchsia-600 bg-fuchsia-950 text-fuchsia-300',
  cup: 'border-emerald-500 bg-emerald-950 text-emerald-300',
};

const SHORT: Record<WeekMark, string> = {
  none: '·',
  houseShow: 'Road',
  television: 'TV',
  ppv: 'PPV',
  supershow: 'Joint',
  cup: 'Cup',
};

/**
 * This week only, read-only — the honest version of "tap a date, see the
 * card" for a booking screen that has no per-future-week storage to point a
 * tap at. `world.currentCard` is a single flat array, not one per week, so
 * there is nothing else on the calendar this screen could actually take you
 * to; this says what tonight and the rest of the week look like and stops
 * there, on purpose.
 */
export function ThisWeekStrip() {
  const world = useGameStore((s) => s.world);
  if (!world?.promotion.schedule) return null;

  const view = calendarMonths(world.week, 1, {
    now: world.week,
    schedule: world.promotion.schedule,
    settings: world.settings,
    cupMonth: CUP_MONTH,
  });
  const thisWeek = view.flatMap((m) => m.weeks).find((w) => w.isNow);
  if (!thisWeek) return null;

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-2.5" data-testid="this-week-strip">
      <div className="mb-1.5 text-[10px] uppercase tracking-wider text-neutral-500">This week</div>
      <div className="grid grid-cols-7 gap-0.5">
        {thisWeek.nights.map((night) => (
          <div
            key={night.day}
            title={`${night.day}${night.label ? ` — ${night.label}` : ' — dark'}`}
            className={`flex flex-col items-center gap-0.5 truncate rounded border px-0.5 py-1 ${NIGHT[night.mark]}`}
          >
            <span className="text-[8px] uppercase tracking-wide text-neutral-500">{night.day.slice(0, 2)}</span>
            <span className="text-[9px] font-semibold">{SHORT[night.mark]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CalendarStrip({ months = 2 }: { months?: number }) {
  const world = useGameStore((s) => s.world);
  const toggle = useGameStore((s) => s.toggleShowOnDay);
  // A save from before the schedule existed has no shape to draw.
  if (!world?.promotion.schedule) return null;

  const view = calendarMonths(world.week, months, {
    now: world.week,
    schedule: world.promotion.schedule,
    settings: world.settings,
    // The tournament exists now, so the tile is honest. It was deliberately
    // withheld while it was not built — a square promising an event the game
    // cannot run is the dead-end wire the audit was about.
    cupMonth: CUP_MONTH,
  });

  return (
    <div className="flex flex-col gap-3">
      {view.map((month) => (
        <div key={`${month.month}-${month.year}`}>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-xs font-semibold text-neutral-200">{month.month}</span>
            <span className="text-[10px] uppercase tracking-wide text-neutral-500">
              {month.year}
            </span>
          </div>

          {/* Day names once per month, not once per week — seven columns on a
              phone is already tight without repeating the header five times. */}
          <div className="mb-0.5 grid grid-cols-[1.6rem_repeat(7,minmax(0,1fr))] gap-0.5">
            <span />
            {DAYS.map((d) => (
              <span
                key={d}
                className="text-center text-[9px] uppercase tracking-wide text-neutral-600"
              >
                {d.slice(0, 2)}
              </span>
            ))}
          </div>

          <div className="flex flex-col gap-0.5">
            {month.weeks.map((w) => (
              <div
                key={w.week}
                className={`grid grid-cols-[1.6rem_repeat(7,minmax(0,1fr))] items-stretch gap-0.5 rounded ${
                  w.isNow ? 'ring-1 ring-white/60' : ''
                } ${w.isPast && !w.isNow ? 'opacity-40' : ''}`}
              >
                <span className="flex items-center justify-center text-[9px] uppercase tracking-wide text-neutral-600">
                  w{w.weekOfMonth}
                </span>
                {w.nights.map((night) => (
                  <button
                    key={night.day}
                    type="button"
                    onClick={() => toggle(night.day)}
                    title={`${month.month}, week ${w.weekOfMonth}, ${night.day}${
                      night.label ? ` — ${night.label}` : ' — dark'
                    }`}
                    className={`min-w-0 truncate rounded border px-0.5 py-1 text-[9px] font-semibold ${
                      NIGHT[night.mark]
                    }`}
                  >
                    {SHORT[night.mark]}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}

      <p className="text-[10px] text-neutral-600">
        Tap a night to run a show that weekday, or to drop one entirely. The televised night cannot be dropped —
        move it instead, right below.
      </p>
    </div>
  );
}
