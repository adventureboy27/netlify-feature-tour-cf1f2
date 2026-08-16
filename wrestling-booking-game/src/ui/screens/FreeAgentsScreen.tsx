// The free agent pool — everyone in the business who is not signed anywhere.
//
// Not a shop window: these are people with careers, and the reason they're
// available matters as much as the price. Somebody released last month and
// somebody nobody has ever signed are different propositions at the same
// weekly rate.
//
// Leave the good ones sitting here and a rival will take them.

import { useMemo } from 'react';
import { useGameStore } from '../../state/store';
import { rankPool, currentAskingRate, canSign, AVAILABILITY_LABELS } from '../../engine/world/freeAgents';
import { contractLengthLine } from '../../engine/economy/contracts';
import { leverageReason } from '../../engine/career/leverage';
import { noCompeteLabel } from '../../engine/economy/termination';
import { CAREER_STATUS_LABELS } from '../../engine/career/status';
import { Money } from '../components/display';
import { WrestlerRow } from '../components/WrestlerRow';

export function FreeAgentsScreen() {
  const world = useGameStore((s) => s.world);
  const sign = useGameStore((s) => s.signFreeAgent);

  const ranked = useMemo(() => {
    if (!world) return [];
    return rankPool(world.freeAgents, (id) => world.wrestlers[id]);
  }, [world]);

  if (!world) return null;

  const banned = world.signingBanWeeks > 0;

  return (
    <div className="p-3 pb-24 text-neutral-100">
      <div className="mb-3">
        <h1 className="text-base font-semibold">Free agents — {ranked.length}</h1>
        <p className="text-xs text-neutral-500">
          Bank <Money amount={world.promotion.bankBalance} /> · roster {world.promotion.rosterIds.length}
        </p>
        {banned && (
          <p className="mt-2 rounded bg-rose-950/50 p-2 text-xs text-rose-300">
            You are barred from signing anyone for another {world.signingBanWeeks} weeks.
          </p>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ranked.map((agent) => {
          const wrestler = world.wrestlers[agent.wrestlerId];
          if (!wrestler) return null;
          const rate = currentAskingRate(agent, world.settings);
          const affordable = canSign(wrestler, world.promotion.bankBalance, world.signingBanWeeks, world.settings);
          // He negotiated his way out of somewhere and gave up the money to
          // do it. Nobody can touch him yet, including the company he left.
          const sittingOut = noCompeteLabel(wrestler);

          return (
            <article
              key={agent.wrestlerId}
              className="flex gap-2 rounded border border-neutral-800 bg-neutral-900 p-2"
            >
              <div className="min-w-0 flex-1">
                <WrestlerRow wrestler={wrestler} settings={world.settings} />
                <div className="mt-1 truncate text-[10px] text-amber-500/80">
                  {CAREER_STATUS_LABELS[wrestler.careerStatus]} · age {wrestler.age} ·{' '}
                  {AVAILABILITY_LABELS[agent.reason]}
                  {agent.weeksUnsigned > 20 && <span className="text-neutral-600"> · {agent.weeksUnsigned}w unsigned</span>}
                </div>
                {sittingOut && <div className="text-[10px] text-amber-400">{sittingOut}</div>}
                {/* What he wants, and why the number is what it is. Both stated
                    before the signing rather than discovered after it. */}
                <div className="text-[10px] text-neutral-500">
                  Wants {contractLengthLine(agent.wantsWeeks)}
                </div>
                {leverageReason(wrestler, world.settings) && (
                  <div className="text-[10px] text-neutral-600">{leverageReason(wrestler, world.settings)}</div>
                )}

                <button
                  type="button"
                  data-testid={`sign-${agent.wrestlerId}`}
                  disabled={!affordable || Boolean(sittingOut)}
                  onClick={() => sign(agent.wrestlerId)}
                  className={`mt-1.5 w-full rounded px-2 py-1 text-[11px] ${
                    affordable && !sittingOut
                      ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                      : 'bg-neutral-800 text-neutral-600'
                  }`}
                >
                  {sittingOut ? (
                    'Cannot sign yet'
                  ) : (
                    <>
                      Sign · <Money amount={rate} />
                      /wk
                    </>
                  )}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {ranked.length === 0 && (
        <p className="rounded border border-neutral-800 bg-neutral-900 p-6 text-center text-sm text-neutral-500">
          Nobody is available. Everyone in the business is signed somewhere.
        </p>
      )}
    </div>
  );
}
