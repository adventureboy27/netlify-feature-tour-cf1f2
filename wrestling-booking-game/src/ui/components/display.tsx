// Shared display primitives.
//
// Three of the game's locked rules live here, so they're enforced in one
// place rather than remembered at every call site:
//
//   Stats are bars and trends, never numbers      (§0)
//   Odds are words, never percentages             (§13)
//   Rivalry heat is a crowd-interest label        (§12.5)
//
// The single exception is <BreakdownPanel>, which is numeric on purpose:
// §11.5 makes it non-negotiable that the player can see exactly why a match
// got the stars it got.

import type { RatingBreakdownEntry, Wrestler, WorldSettings } from '../../engine/types';
import { oddsLabel } from '../../engine/sim/oddsLabel';
import { heatLabel, shootLabel } from '../../engine/sim/rivalry';
import { freshnessLabel, heatIcon, isStale } from '../../engine/sim/freshness';
import { economicClimateLabel } from '../../engine/world/economicCycle';

export function StatBar({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'neutral' | 'health' }) {
  const pct = Math.max(0, Math.min(100, value));
  const color = tone === 'health' ? healthColor(pct) : 'bg-sky-500';
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-[11px] text-neutral-400">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-800">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function healthColor(pct: number): string {
  if (pct >= 70) return 'bg-emerald-500';
  if (pct >= 40) return 'bg-amber-500';
  return 'bg-rose-500';
}

/** Quarter-star glyphs. ★★★¾ reads instantly; "3.75" does not. */
const FRACTION_GLYPH: Record<number, string> = { 0: '', 0.25: '¼', 0.5: '½', 0.75: '¾' };

export function Stars({ stars }: { stars: number }) {
  const full = Math.floor(stars);
  const fraction = Math.round((stars - full) * 4) / 4;
  const glyph = FRACTION_GLYPH[fraction] ?? '';
  return (
    <span className="whitespace-nowrap font-mono text-amber-400" title={`${stars.toFixed(2)} stars`}>
      {'★'.repeat(full)}
      {glyph}
      {full === 0 && glyph === '' ? '—' : ''}
    </span>
  );
}

/** §13: the only permitted rendering of a win probability. */
export function Odds({ probability }: { probability: number }) {
  return <span className="text-xs text-neutral-300">{oddsLabel(probability)}</span>;
}

/** §12.5: crowd interest as words. The second badge is booker-only. */
export function HeatBadge({ heat, shootHeat }: { heat: number; shootHeat: number }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-300">{heatLabel(heat)}</span>
      {shootHeat > 10 && (
        <span
          className="rounded bg-rose-950 px-1.5 py-0.5 text-[10px] text-rose-300"
          title="Backstage. The crowd cannot see this."
        >
          {shootLabel(shootHeat)}
        </span>
      )}
    </span>
  );
}


/**
 * §11.5: "each segment produces a rating breakdown panel listing every
 * contributing term with its numeric value. This is non-negotiable: the
 * player must always be able to see exactly why a match got the stars it
 * got." The one place in the game that shows raw numbers.
 */
export function BreakdownPanel({ breakdown, rating }: { breakdown: RatingBreakdownEntry[]; rating: number }) {
  const meaningful = breakdown.filter((entry) => Math.abs(entry.value) >= 0.05);
  return (
    <div className="rounded border border-neutral-800 bg-neutral-950 p-2">
      <table className="w-full text-[11px]">
        <tbody>
          {meaningful.map((entry) => (
            <tr key={entry.label}>
              <td className="py-0.5 pr-2 text-neutral-400">{entry.label}</td>
              <td className={`py-0.5 text-right font-mono ${entry.value >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {entry.value >= 0 ? '+' : ''}
                {entry.value.toFixed(1)}
              </td>
            </tr>
          ))}
          <tr className="border-t border-neutral-800">
            <td className="pt-1 pr-2 font-medium text-neutral-200">Rating</td>
            <td className="pt-1 text-right font-mono font-medium text-neutral-200">{rating.toFixed(1)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/**
 * The gimmick's hot/cold meter — "a long line, 🔥 on one end and ❄️ on the
 * other," as asked for. A marker on a fixed ice-to-fire gradient rather than
 * a fill bar: this is a position on a spectrum (where the crowd's opinion
 * currently sits), not a depleting resource, so `StatBar`'s "how much is
 * left" semantics would misread it.
 */
export function GimmickHeatMeter({ wrestler, settings }: { wrestler: Wrestler; settings: WorldSettings }) {
  const pct = Math.max(0, Math.min(100, wrestler.gimmickFreshness));
  return (
    <div className="flex items-center gap-1.5" title={freshnessLabel(wrestler, settings)}>
      <span className="text-[11px] leading-none">❄️</span>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-gradient-to-r from-sky-500 via-neutral-700 to-orange-500">
        <div
          className="absolute top-1/2 h-2.5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow"
          style={{ left: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] leading-none">🔥</span>
      <span className={`w-24 shrink-0 truncate text-[10px] ${isStale(wrestler, settings) ? 'text-amber-400' : 'text-neutral-500'}`}>
        {heatIcon(wrestler, settings)} {freshnessLabel(wrestler, settings)}
      </span>
    </div>
  );
}

/**
 * The wrestling economy's own boom-and-bust cycle — "a state of the economy
 * scale and a marker on current position," as asked for. Same shape as
 * GimmickHeatMeter above: a marker on a fixed spectrum, Recession on one end
 * and Boom on the other, because this is a position on a cycle, not a
 * depleting resource. Recession/Boom, not raw -1..+1 — the number is never
 * shown, same rule as everything else on this page.
 */
export function EconomicClimateMeter({ climate }: { climate: number }) {
  const pct = Math.max(0, Math.min(100, ((Math.max(-1, Math.min(1, climate)) + 1) / 2) * 100));
  const label = economicClimateLabel(climate);
  return (
    <div className="flex items-center gap-1.5" title={`The wrestling economy: ${label}`}>
      <span className="text-[10px] leading-none text-rose-400">Recession</span>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-gradient-to-r from-rose-500 via-neutral-700 to-emerald-500">
        <div
          className="absolute top-1/2 h-2.5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow"
          style={{ left: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] leading-none text-emerald-400">Boom</span>
    </div>
  );
}

export function Money({ amount }: { amount: number }) {
  const sign = amount < 0 ? '-' : '';
  return (
    <span className={amount < 0 ? 'text-rose-400' : 'text-neutral-200'}>
      {sign}${Math.abs(Math.round(amount)).toLocaleString()}
    </span>
  );
}
