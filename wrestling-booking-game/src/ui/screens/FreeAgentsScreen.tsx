// The free agent pool — everyone in the business who is not signed anywhere.
//
// Not a shop window: these are people with careers, and the reason they're
// available matters as much as the price. Somebody released last month and
// somebody nobody has ever signed are different propositions at the same
// weekly rate.
//
// Leave the good ones sitting here and a rival will take them.
//
// Master-detail: a compact, sign-ready list on the left, and everything
// about whoever's selected on the right — the same universal read-out every
// wrestler gets (`WrestlerDetailBody`) plus the free-agent-specific case for
// or against signing them, which lives only here.

import { useMemo, useState } from 'react';
import { useGameStore } from '../../state/store';
import {
  rankPool,
  currentAskingRate,
  canSign,
  AVAILABILITY_LABELS,
  type AvailabilityReason,
} from '../../engine/world/freeAgents';
import { contractLengthLine } from '../../engine/economy/contracts';
import { leverageReason } from '../../engine/career/leverage';
import { stanceOn, bodyLine } from '../../engine/career/theBody';
import { pronounsFor } from '../../engine/career/pronouns';
import { traitsOf } from '../../engine/career/personality';
import {
  mostRecentDeath,
  ourPrice,
  refusalLine,
  stillHeldAgainstUs,
  wontWorkForUs,
} from '../../engine/career/onOurWatch';
import { noCompeteLabel } from '../../engine/economy/termination';
import { releaseStigmaActive } from '../../engine/economy/releaseStigma';
import { CAREER_STATUS_LABELS } from '../../engine/career/status';
import { Money } from '../components/display';
import { WrestlerRow } from '../components/WrestlerRow';
import { WrestlerDetailBody } from '../components/WrestlerDetail';
import type { Id } from '../../engine/types';

export function FreeAgentsScreen({ onNavigate }: { onNavigate?: (wrestlerId: Id) => void } = {}) {
  const world = useGameStore((s) => s.world);
  const sign = useGameStore((s) => s.signFreeAgent);
  const [selectedId, setSelectedId] = useState<Id | null>(null);
  const [reasonFilter, setReasonFilter] = useState<AvailabilityReason | 'all'>('all');

  const ranked = useMemo(() => {
    if (!world) return [];
    return rankPool(world.freeAgents, (id) => world.wrestlers[id]);
  }, [world]);

  if (!world) return null;

  // What this company did to the last man it sent out hurt, and how much of
  // it the business is still holding against it.
  const deaths = world.promotion.deathsOnOurWatch ?? [];
  const heldAgainstUs = stillHeldAgainstUs(deaths, world.week, world.settings);
  const buried = mostRecentDeath(deaths);

  const visible = reasonFilter === 'all' ? ranked : ranked.filter((a) => a.reason === reasonFilter);
  const agentIds = new Set(visible.map((a) => a.wrestlerId));
  const activeAgentId = selectedId && agentIds.has(selectedId) ? selectedId : (visible[0]?.wrestlerId ?? null);
  const activeAgent = visible.find((a) => a.wrestlerId === activeAgentId);
  const activeWrestler = activeAgentId ? world.wrestlers[activeAgentId] : undefined;

  return (
    <div className="p-6 text-neutral-100">
      <div className="mb-3">
        <h1 className="text-base font-semibold">Free agents — {ranked.length}</h1>
        <p className="text-xs text-neutral-500">
          Bank <Money amount={world.promotion.bankBalance} /> · roster {world.promotion.rosterIds.length}
        </p>
      </div>

      {/* Who's available and why is the whole decision on this screen —
          filtering by it beats scrolling past forty names to find the two
          who just graduated the school. */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          data-testid="fa-filter-all"
          onClick={() => setReasonFilter('all')}
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
            reasonFilter === 'all'
              ? 'bg-emerald-600 text-white'
              : 'bg-neutral-900 text-neutral-400 ring-1 ring-inset ring-neutral-800 hover:text-neutral-200'
          }`}
        >
          All — {ranked.length}
        </button>
        {(Object.keys(AVAILABILITY_LABELS) as AvailabilityReason[]).map((reason) => {
          const count = ranked.filter((a) => a.reason === reason).length;
          if (count === 0) return null;
          return (
            <button
              key={reason}
              type="button"
              data-testid={`fa-filter-${reason}`}
              onClick={() => setReasonFilter(reason)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                reasonFilter === reason
                  ? 'bg-emerald-600 text-white'
                  : 'bg-neutral-900 text-neutral-400 ring-1 ring-inset ring-neutral-800 hover:text-neutral-200'
              }`}
            >
              {AVAILABILITY_LABELS[reason]} — {count}
            </button>
          );
        })}
      </div>

      {/* What this company did, and what the market thinks of it. Stated at
          the top of the page rather than discovered one greyed-out button at
          a time. */}
      {heldAgainstUs > 0 && buried && (
        <p className="mb-2 rounded bg-rose-950/50 p-2 text-xs text-rose-300">
          {buried.name} died in this company's ring. The people who look after themselves are not taking the
          call, and the ones who will want paying for it.
        </p>
      )}
      {releaseStigmaActive(world.solventWeeksSinceLastRelease, world.settings) && (
        <p className="mb-2 rounded bg-amber-950/50 p-2 text-xs text-amber-300">
          This company has been visibly cutting people loose lately, and word travels. Free agents want more up
          front to sign here now — a bigger guarantee, or real money before the ink is even dry.
        </p>
      )}

      {ranked.length === 0 ? (
        <p className="rounded border border-neutral-800 bg-neutral-900 p-6 text-center text-sm text-neutral-500">
          Nobody is available right now. Every single person in this business is already signed somewhere.
        </p>
      ) : visible.length === 0 ? (
        <p className="rounded border border-neutral-800 bg-neutral-900 p-6 text-center text-sm text-neutral-500">
          Nobody matches that filter right now.
        </p>
      ) : (
        <div className="grid grid-cols-[380px_1fr] gap-4">
          <div className="flex max-h-[75vh] flex-col gap-1.5 overflow-y-auto pr-1">
            {visible.map((agent) => {
              const wrestler = world.wrestlers[agent.wrestlerId];
              if (!wrestler) return null;
              const rate = ourPrice(currentAskingRate(agent, world.settings), heldAgainstUs, world.settings);
              // He is not sitting out a no-compete; he simply will not work here.
              const refuses = buried && wontWorkForUs(wrestler, heldAgainstUs, world.settings)
                ? refusalLine(wrestler.name, buried.name, pronounsFor(wrestler))
                : null;
              const affordable = canSign(wrestler, world.promotion.bankBalance, world.settings);
              // He negotiated his way out of somewhere and gave up the money to
              // do it. Nobody can touch him yet, including the company he left.
              const sittingOut = noCompeteLabel(wrestler);

              return (
                <div
                  key={agent.wrestlerId}
                  data-testid={`fa-${agent.wrestlerId}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(agent.wrestlerId)}
                  className={`cursor-pointer rounded border p-2 transition ${
                    agent.wrestlerId === activeAgentId
                      ? 'border-emerald-500 bg-emerald-950/40'
                      : 'border-neutral-800 bg-neutral-900 hover:border-neutral-600'
                  }`}
                >
                  <WrestlerRow wrestler={wrestler} settings={world.settings} compact />
                  <div className="mt-1 truncate text-[10px] text-amber-500/80">
                    {CAREER_STATUS_LABELS[wrestler.careerStatus]} · age {wrestler.age} · {AVAILABILITY_LABELS[agent.reason]}
                    {agent.weeksUnsigned > 20 && <span className="text-neutral-600"> · {agent.weeksUnsigned}w unsigned</span>}
                  </div>
                  {sittingOut && <div className="text-[10px] text-amber-400">{sittingOut}</div>}
                  {refuses && <div className="text-[10px] leading-snug text-rose-400">{refuses}</div>}
                  <button
                    type="button"
                    data-testid={`sign-${agent.wrestlerId}`}
                    disabled={!affordable || Boolean(sittingOut) || Boolean(refuses)}
                    onClick={(e) => {
                      e.stopPropagation();
                      sign(agent.wrestlerId);
                    }}
                    className={`mt-1.5 w-full rounded px-2 py-1 text-[11px] ${
                      affordable && !sittingOut && !refuses
                        ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                        : 'bg-neutral-800 text-neutral-600'
                    }`}
                  >
                    {refuses ? (
                      'Will not sign here'
                    ) : sittingOut ? (
                      'Cannot sign yet'
                    ) : (
                      <>
                        Sign · <Money amount={rate} />
                        /wk
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            {activeWrestler && activeAgent ? (
              <div className="max-w-2xl">
                <WrestlerDetailBody
                  wrestler={activeWrestler}
                  editable={false}
                  onNavigateWrestler={(id) => onNavigate?.(id)}
                />

                {/* The free-agent-specific case for or against signing —
                    nothing here lives on `WrestlerDetailBody`, since it only
                    applies to somebody not yet on your roster. */}
                <div className="mt-3 flex flex-col gap-1 border-t border-neutral-800 pt-2">
                  <div className="text-[10px] text-neutral-500">Wants {contractLengthLine(activeAgent.wantsWeeks)}</div>
                  {leverageReason(activeWrestler, world.settings) && (
                    <div className="text-[10px] text-neutral-600">{leverageReason(activeWrestler, world.settings)}</div>
                  )}
                  {traitsOf(activeWrestler).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {traitsOf(activeWrestler).map((trait) => (
                        <span
                          key={trait.id}
                          title={trait.blurb}
                          className="rounded bg-violet-950/60 px-1.5 py-0.5 text-[10px] text-violet-300"
                        >
                          {trait.name}
                        </span>
                      ))}
                    </div>
                  )}
                  {bodyLine(activeWrestler.injuryHistory ?? [], world.settings) && (
                    <div className="text-[10px] leading-snug text-neutral-500">
                      {bodyLine(activeWrestler.injuryHistory ?? [], world.settings)}
                    </div>
                  )}
                  {stanceOn(activeWrestler, world.settings) && (
                    <>
                      <div className="text-[10px] leading-snug text-neutral-400">
                        {stanceOn(activeWrestler, world.settings)!.doctor.verdict}
                      </div>
                      <div className="text-[10px] leading-snug text-amber-400/90">
                        {stanceOn(activeWrestler, world.settings)!.man.says}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">Nobody selected.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
