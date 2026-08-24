// The books, and the ladder.
//
// Two things a booker needs and had nowhere to look for: where the money went
// last week, and what the next thing worth buying is. They live on one screen
// because they are the same question asked twice — the statement says what you
// can afford, and the ladder says what to want.

import { useState } from 'react';
import { useGameStore } from '../../state/store';
import {
  HAULAGE,
  haulageById,
  nextHaulage,
  ladderStatus,
  nextRung,
  haulUsed,
  productionLabel,
} from '../../engine/economy/production';
import { statementLine, runningNet, weeksOfRunway } from '../../engine/economy/statement';

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
/** A figure that is a movement rather than a balance: the sign is the point. */
const signed = (n: number) => `${n < 0 ? '−' : '+'}$${Math.abs(Math.round(n)).toLocaleString()}`;

export function FinanceScreen() {
  const world = useGameStore((s) => s.world);
  const buyRung = useGameStore((s) => s.buyRung);
  const buyHaulage = useGameStore((s) => s.buyHaulage);
  const [tab, setTab] = useState<'books' | 'ladder'>('books');
  if (!world) return null;

  return (
    <div className="space-y-3 p-3 pb-24 text-neutral-100">
      <h1 className="text-base font-semibold">Finance</h1>
      <div className="flex gap-1">
        {(['books', 'ladder'] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 rounded px-3 py-1.5 text-xs font-medium ${
              tab === id ? 'bg-emerald-700 text-white' : 'bg-neutral-800 text-neutral-300'
            }`}
          >
            {id === 'books' ? 'The books' : 'Production'}
          </button>
        ))}
      </div>
      {tab === 'books' ? <Books /> : <Ladder buyRung={buyRung} buyHaulage={buyHaulage} />}
    </div>
  );
}

function Books() {
  const world = useGameStore((s) => s.world)!;
  const history = world.statements ?? [];
  const latest = history[history.length - 1];

  if (!latest) {
    return (
      <p className="rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-xs text-neutral-500">
        Not one dollar has been through the books yet. Get out there and run a show.
      </p>
    );
  }

  const runway = weeksOfRunway(history, world.promotion.bankBalance, world.settings.runwaySampleWeeks);
  const quarter = runningNet(history, 13);

  return (
    <div className="space-y-3">
      <section
        className={`rounded-lg border p-3 ${
          latest.net >= 0 ? 'border-emerald-800 bg-emerald-950/20' : 'border-red-900 bg-red-950/20'
        }`}
      >
        <div className="text-[10px] uppercase tracking-wide text-neutral-400">Last week</div>
        <p
          className={`mt-0.5 text-sm font-semibold ${
            latest.net >= 0 ? 'text-emerald-300' : 'text-red-300'
          }`}
        >
          {statementLine(latest)}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
          <Stat label="Opened at" value={money(latest.openingBalance)} />
          <Stat label="Closed at" value={money(latest.closingBalance)} />
          <Stat label="Last 13 weeks" value={signed(quarter)} />
          {/* Reported, never warned about. It sits here for anybody who looks. */}
          <Stat label="Runway" value={runway === null ? 'Profitable' : `${runway} weeks`} />
        </div>
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
        <h2 className="mb-2 text-sm font-medium text-emerald-400">In — {money(latest.totalRevenue)}</h2>
        {latest.revenue.map((line) => (
          <Row key={line.kind} label={line.label} amount={line.amount} tone="in" />
        ))}
        {latest.revenue.length === 0 && <p className="text-xs text-neutral-600">Nothing came in.</p>}
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
        <h2 className="mb-2 text-sm font-medium text-red-400">Out — {money(latest.totalExpenses)}</h2>
        {latest.expenses.map((line) => (
          <Row key={line.kind} label={line.label} amount={line.amount} tone="out" />
        ))}
        {latest.expenses.length === 0 && <p className="text-xs text-neutral-600">Nothing went out.</p>}
      </section>

      {history.length > 1 && (
        <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
          <h2 className="mb-2 text-sm font-medium text-neutral-200">Recent weeks</h2>
          {[...history]
            .slice(-12)
            .reverse()
            .map((s) => (
              <div
                key={s.week}
                className="flex items-baseline justify-between gap-2 border-b border-neutral-800 py-1 text-[11px] last:border-b-0"
              >
                <span className="text-neutral-500">Week {s.week}</span>
                <span className={s.net >= 0 ? 'text-emerald-400' : 'text-red-400'}>{signed(s.net)}</span>
              </div>
            ))}
        </section>
      )}
    </div>
  );
}

function Ladder({
  buyRung,
  buyHaulage,
}: {
  buyRung: (id: string) => void;
  buyHaulage: (id: string) => void;
}) {
  const world = useGameStore((s) => s.world)!;
  const owned = world.productionRungs ?? [];
  const truck = haulageById(world.haulageId ?? 'pickup') ?? HAULAGE[0]!;
  const status = ladderStatus(owned, truck, world.promotion.bankBalance);
  const upgrade = nextHaulage(truck.id);
  const want = nextRung(owned);

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
        <div className="text-[10px] uppercase tracking-wide text-neutral-500">How the show looks</div>
        <p className="text-sm font-semibold text-neutral-100">{productionLabel(owned, world.settings)}</p>
        {want && (
          <p className="mt-1 text-[11px] text-neutral-400">
            Next up the ladder: {want.name}, {money(want.cost)}.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-sky-900 bg-sky-950/20 p-3">
        <div className="text-[10px] uppercase tracking-wide text-sky-300/80">Haulage</div>
        <p className="text-sm font-semibold text-sky-200">{truck.name}</p>
        <p className="mt-0.5 text-[11px] text-neutral-400">{truck.blurb}</p>
        <p className="mt-1 text-[11px] text-neutral-500">
          Carrying {haulUsed(owned)} of {truck.capacity} · {money(truck.upkeepPerWeek)}/week
        </p>
        {upgrade && (
          <button
            type="button"
            disabled={world.promotion.bankBalance < upgrade.cost}
            onClick={() => buyHaulage(upgrade.id)}
            className={`mt-2 w-full rounded px-3 py-2 text-xs font-semibold ${
              world.promotion.bankBalance >= upgrade.cost
                ? 'bg-sky-600 text-white'
                : 'bg-neutral-800 text-neutral-600'
            }`}
          >
            {upgrade.name} — {money(upgrade.cost)}
          </button>
        )}
        {upgrade && (
          <p className="mt-1 text-[10px] text-neutral-500">
            Carries {upgrade.capacity}. {upgrade.blurb}
          </p>
        )}
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
        <h2 className="mb-2 text-sm font-medium text-neutral-200">The ladder</h2>
        <div className="flex flex-col gap-1.5">
          {status.map(({ rung, owned: have, blocked, note }) => (
            <div
              key={rung.id}
              className={`rounded border p-2 ${
                have
                  ? 'border-emerald-800 bg-emerald-950/20'
                  : blocked === null
                    ? 'border-amber-700 bg-amber-950/20'
                    : 'border-neutral-800 bg-neutral-950'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={`truncate text-xs font-medium ${
                    have ? 'text-emerald-300' : blocked === null ? 'text-amber-200' : 'text-neutral-400'
                  }`}
                >
                  {rung.name}
                </span>
                <span className="shrink-0 text-[10px] text-neutral-500">
                  {have ? `${money(rung.upkeepPerShow)}/show` : money(rung.cost)}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-neutral-500">{rung.blurb}</p>
              {!have && (
                <>
                  <p className="mt-0.5 text-[10px] text-neutral-500">
                    {note} Takes {rung.haulSpace} on the truck.
                  </p>
                  {blocked === null && (
                    <button
                      type="button"
                      onClick={() => buyRung(rung.id)}
                      className="mt-1.5 w-full rounded bg-amber-600 px-3 py-1.5 text-xs font-semibold text-black"
                    >
                      Buy it
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Row({ label, amount, tone }: { label: string; amount: number; tone: 'in' | 'out' }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-neutral-800 py-1 text-[11px] last:border-b-0">
      <span className="text-neutral-300">{label}</span>
      <span className={tone === 'in' ? 'text-emerald-400' : 'text-red-400'}>{money(amount)}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</span>
      <span className="text-neutral-200">{value}</span>
    </div>
  );
}
