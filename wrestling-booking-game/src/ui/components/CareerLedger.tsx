// Where somebody has been, and what they did there.
//
// Shared between the player's own roster card and any read-only view of
// somebody else's roster (a rival's, a free agent's) — the history is a fact
// about the person, not a management tool, so it belongs wherever the person
// is shown.
//
// Every number here is a fact about the past, not a rating: §0's ban on
// showing stats as numbers is about *ability*, and a win-loss record is the
// opposite of a hidden attribute — it is the thing the crowd already knows.

import type { Wrestler, WorldSettings } from '../../engine/types';
import { homeCompany, openStint, recordLine, stintLine, yearsManaging, yearsWrestling } from '../../engine/career/ledger';
import { Money } from './display';

/**
 * Newest spell first, capped, because a twenty-year veteran with eight stints
 * would otherwise bury the rest of the card. The one that matters most is the
 * one they are in.
 */
export function CareerLedger({ wrestler, settings }: { wrestler: Wrestler; settings: WorldSettings }) {
  const ledger = wrestler.ledger;
  if (!ledger || ledger.stints.length === 0) return null;

  const years = yearsWrestling(ledger, settings);
  const suit = yearsManaging(ledger, settings);
  const home = homeCompany(ledger);
  // Newest last in the ledger, because a return is a second stint.
  const spells = [...ledger.stints].reverse().slice(0, 3);

  return (
    <details className="mt-1 border-t border-neutral-800 pt-1">
      <summary className="cursor-pointer list-none text-[10px] text-neutral-500">
        Career · {recordLine(ledger.lifetime)}
        {years >= 1 && <span className="text-neutral-600"> · {Math.round(years)}y in the ring</span>}
      </summary>

      <div className="mt-1 flex flex-col gap-px">
        {spells.map((stint, i) => (
          <div key={`${stint.promotionId}-${stint.joinedWeek}-${i}`} className="text-[10px] text-neutral-500">
            {stintLine(stint, settings)}
          </div>
        ))}
        {ledger.stints.length > spells.length && (
          <div className="text-[10px] text-neutral-600">
            and {ledger.stints.length - spells.length} earlier{' '}
            {ledger.stints.length - spells.length === 1 ? 'spell' : 'spells'}
          </div>
        )}
        {/* Where they made their name, which is not always where they are. */}
        {home && home.promotionId !== openStint(ledger)?.promotionId && (
          <div className="text-[10px] text-amber-500/70">
            Made their name at {home.promotionName}.
          </div>
        )}
        {/* Time in a suit is kept apart from time in the ring on purpose —
            somebody who wrestled fifteen years and managed ten has fifteen. */}
        {suit >= 1 && (
          <div className="text-[10px] text-neutral-600">
            {Math.round(suit)}y at ringside · {recordLine(ledger.managing)} in the corner
          </div>
        )}
        {ledger.earnings > 0 && (
          <div className="text-[10px] text-neutral-600">
            Paid <Money amount={ledger.earnings} /> across the career.
          </div>
        )}
      </div>
    </details>
  );
}
