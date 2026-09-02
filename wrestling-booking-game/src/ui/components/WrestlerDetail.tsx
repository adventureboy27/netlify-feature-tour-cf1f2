// One wrestler's full read-out — portrait, stats, tag partners and a
// manager as real tappable links, and everything a booker could know about
// this person. Shared by every screen that shows one wrestler in full:
// `WrestlerDetailScreen` (a real pushed screen, for a name tapped from
// somewhere with no list of its own to embed this in — a booking slot's
// cast, say) and the right-hand pane of the three master-detail screens
// (Roster, Free Agents, The competition), which show this same content
// beside their own list instead of navigating to it.
//
// The four consequential actions — retire, change role, release, repackage —
// only make sense for somebody on your own roster, so they render only when
// `editable` is true. A rival's wrestler or a free agent gets every read-out
// here and none of the levers.

import { useState } from 'react';
import { crownBadge, crownsFor, CUP_NAME } from '../../engine/world/cup';
import { useGameStore } from '../../state/store';
import { activeRivalriesFor } from '../../engine/sim/rivalry';
import { allStorylinesFor } from '../../engine/world/storyline';
import { CAREER_STATUS_LABELS, CAREER_STATUS_BLURBS, yearsPro } from '../../engine/career/status';
import { egoLabel } from '../../engine/career/ego';
import { stanceOn, bodyLine } from '../../engine/career/theBody';
import { leaveStatusLine, shunLine, shunned } from '../../engine/career/onOurWatch';
import { circleOf, circleSummary } from '../../engine/career/circle';
import { traitsOf } from '../../engine/career/personality';
import { motivationSymbolsOf } from '../../engine/career/motivation';
import { likeabilityLabel, ringcraftLabel } from '../../engine/sim/ringcraft';
import { injuryWord } from '../../engine/sim/casualties';
import { assignmentById, assignmentOf } from '../../engine/career/assignment';
import { freshnessLabel, isStale } from '../../engine/sim/freshness';
import { pronounsFor } from '../../engine/career/pronouns';
import { retirementPressure } from '../../engine/career/retirement';
import { groupOf } from '../../engine/world/tagTeams';
import { billedAs } from '../../engine/generate/nickname';
import { KickFromGroupControl } from './KickFromGroupControl';
import { contractUrgency } from '../../engine/economy/contracts';
import { canChangeRole, lockLabel, TRANSITION_ROLE_LABELS } from '../../engine/career/transition';
import { severanceOwed, severanceWeight } from '../../engine/economy/termination';
import { titlesHeldBy, shortTitleName, reignLength } from '../../data/titles';
import { relationshipsFor, otherParty, isAlly, isEnemy, RELATIONSHIP_LABELS } from '../../engine/career/relationships';
import { MoodLine } from './Mood';
import { MiniStats, ReachLine } from './MiniStats';
import { strongholds } from '../../engine/career/reach';
import { patienceLeft } from '../../engine/career/lineage';
import { blockedBecause, perkUpkeep } from '../../engine/economy/perks';
import { hypeLabel } from '../../engine/career/hype';
import { fitLabel } from '../../engine/career/fit';
import { bookLine, clientCutLine, representativeOf, wearLabel } from '../../engine/career/representation';
import { recordLabel } from '../../engine/career/discipline';
import { PERKS } from '../../data/perks';
import { PaperDoll } from '../paperdoll/PaperDoll';
import { GimmickHeatMeter, HeatBadge, Money } from './display';
import { CareerLedger } from './CareerLedger';
import { WrestlerRow } from './WrestlerRow';
import { scout } from '../../engine/career/scouting';
import type { Id, Wrestler, WorldSettings } from '../../engine/types';

/**
 * Short enough for a button. The long names live in the engine's
 * TRANSITION_ROLE_LABELS, which is what the status line under them uses.
 */
const ROLE_BUTTON_LABELS = { wrestler: 'Wrestles', referee: 'Referees', manager: 'Manages' } as const;

/** Face / heel / tweener, spelled out. The dot alone was too subtle here. */
function alignmentOf(w: Wrestler): { label: string; className: string } {
  if (w.alignment >= 15) return { label: 'FACE', className: 'bg-emerald-900/70 text-emerald-300' };
  if (w.alignment <= -15) return { label: 'HEEL', className: 'bg-purple-900/70 text-purple-300' };
  return { label: 'TWEENER', className: 'bg-neutral-700 text-neutral-300' };
}

export function WrestlerDetailBody({
  wrestler: w,
  editable,
  onNavigateWrestler,
  onRepackage,
  onOpenFeuds,
}: {
  wrestler: Wrestler;
  /** Whether the consequential actions (retire, role, release, repackage) render at all. */
  editable: boolean;
  onNavigateWrestler: (id: Id) => void;
  onRepackage?: (id: Id) => void;
  /** This wrestler's own feud history — current feuds first, then everything settled. Renders only when they have any. */
  onOpenFeuds?: (id: Id) => void;
}) {
  const world = useGameStore((s) => s.world)!;
  const retireWrestler = useGameStore((s) => s.retireWrestler);
  const changeRole = useGameStore((s) => s.changeRole);
  const releaseWrestler = useGameStore((s) => s.releaseWrestler);
  const [releaseResult, setReleaseResult] = useState<string | null>(null);

  const currentYear = world.settings.startingYear + Math.floor(world.week / 52);
  const rivalries = activeRivalriesFor(world.rivalries, [w.id]);
  const belts = titlesHeldBy(world.titles, w.id);
  const alignment = alignmentOf(w);
  const group = groupOf(world.stables, w.id);
  // A locked Faction Destroyer member's contract clock is paused (see
  // store.ts's expireContracts call site) for as long as the countdown or
  // the forced match is live — the deal itself never runs out mid-story.
  const factionDestroyerLocked =
    world.factionDestroyer !== null &&
    group !== undefined &&
    (world.factionDestroyer.stableAId === group.id || world.factionDestroyer.stableBId === group.id);
  const pressure = retirementPressure(w, { currentYear, settings: world.settings });
  // What ending this deal early would cost. Zero for most of the card; a
  // year of a draw's wages for the ones you built up.
  const owed = severanceOwed(w.contract);
  const bonds = relationshipsFor(world.relationships, w.id)
    .filter((r) => world.promotion.rosterIds.includes(otherParty(r, w.id)))
    .slice(0, 3);

  const partners = (group?.memberIds ?? [])
    .filter((id) => id !== w.id)
    .map((id) => world.wrestlers[id])
    .filter((p): p is Wrestler => Boolean(p));
  const rep = representativeOf(world.representations ?? [], w.id);
  const manager = rep ? world.wrestlers[rep.managerId] : undefined;

  return (
    <div>
      {/* portrait + quick stats — the biggest bust crop the atlas has, since
          this is the one screen a wrestler is the entire point of. */}
      <div className="mb-3 flex gap-3">
        <div className="relative shrink-0">
          <PaperDoll photoDataUrl={w.photoDataUrl} name={w.name} size="large" />
          {w.injury && (
            <span
              className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-rose-600 text-sm font-bold text-white shadow"
              title={`${w.injury.description} — ${w.injury.weeksRemaining} weeks out`}
            >
              ✚
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          {crownBadge(crownsFor(world.cupHistory, w.id).length) && (
            <div
              className="truncate text-[11px] font-black tracking-wide text-amber-300"
              title={crownsFor(world.cupHistory, w.id)
                .map((r) => `${CUP_NAME} ${r.year}, for ${r.promotionName}`)
                .join(' · ')}
            >
              🏆 {crownBadge(crownsFor(world.cupHistory, w.id).length)}
            </div>
          )}
          {w.nickname && <div className="truncate text-[11px] italic text-amber-400/90">“{w.nickname}”</div>}
          <div className="flex flex-wrap items-baseline gap-1.5">
            <span className={`shrink-0 rounded px-1 py-px text-[9px] font-bold ${alignment.className}`}>
              {alignment.label}
            </span>
            <span className="shrink-0 text-[10px] text-neutral-500">age {w.age}</span>
          </div>
          {w.formerNames && w.formerNames.length > 0 && (
            <div className="truncate text-[9px] text-neutral-600">
              formerly {w.formerNames[w.formerNames.length - 1]!.name}
            </div>
          )}
          {belts.length > 0 && (
            <div className="mt-0.5 flex flex-wrap gap-1">
              {belts.map((belt) => (
                <span
                  key={belt.id}
                  className="flex items-center gap-1 rounded px-1 py-px text-[10px] font-medium"
                  style={{ backgroundColor: belt.colorway.strap, color: belt.colorway.plate }}
                  title={`${belt.name} — champion ${reignLength(belt, world.week)} weeks`}
                >
                  <BeltIcon color={belt.colorway.plate} />
                  {shortTitleName(belt)}
                </span>
              ))}
            </div>
          )}
          <div className="mt-1">
            <MiniStats
              wrestler={w}
              settings={world.settings}
              titles={world.titles}
              territoryId={world.showSetup.territoryId}
              territoryName={world.territories.find((t) => t.id === world.showSetup.territoryId)?.name}
            />
          </div>
        </div>
      </div>

      {/* Tag partner(s)/stablemates and manager — real, tappable
          relationships, not inert text. */}
      {partners.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            <span>
              {group?.kind === 'stable' ? 'Faction' : partners.length > 1 ? 'Tag partners' : 'Tag partner'}
              {group && <span className="ml-1 text-sky-400">· {group.name}</span>}
            </span>
            {editable && group && (
              <KickFromGroupControl
                stableId={group.id}
                memberId={w.id}
                memberName={w.name}
                alreadyStaged={world.scheduledGroupTurns.some((t) => t.departingId === w.id)}
              />
            )}
          </div>
          {/* Small on purpose — the group's own header line above already
              says who they are and what belt they hold; this strip is only
              here so the association reads at a glance, not a second list
              to scan. */}
          <div className="flex flex-wrap gap-1.5">
            {partners.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onNavigateWrestler(p.id)}
                className="flex items-center gap-1.5 rounded-full border border-neutral-800 bg-neutral-900 py-1 pl-1 pr-2.5 hover:border-neutral-600"
              >
                <PaperDoll photoDataUrl={p.photoDataUrl} name={p.name} size="tiny" />
                <span className="max-w-[9rem] truncate text-[11px] text-neutral-300">{billedAs(p)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {manager && (
        <div className="mb-3">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Manager</div>
          <WrestlerRow wrestler={manager} settings={world.settings} compact onClick={() => onNavigateWrestler(manager.id)} />
        </div>
      )}

      <div className="flex flex-col gap-0.5">
        {/* They have told you they are going. Loudest thing on the card,
            because a fortnight of warning is the whole value of it. */}
        {w.noticeGivenWeek != null && (
          <div className="mt-0.5 text-[10px] font-semibold text-rose-300">
            Not re-signing. Working out the string on this deal, and then they are gone for good.
          </div>
        )}

        {/* How worn the act is. The penalty for a stale gimmick has always
            been live in the rating; the diagnosis was not anywhere the
            player could see. Words, never the number. */}
        {isStale(w, world.settings) && (
          <div className="mt-0.5 text-[10px] font-medium text-amber-400">
            {freshnessLabel(w, world.settings)} — this act is costing them every single match it is in.
          </div>
        )}

        {/* The room has decided this one was their fault. */}
        {shunned(w.blamedFor, world.week, world.settings) && (
          <div className="mt-0.5 text-[10px] font-semibold leading-snug text-rose-300">
            {shunLine(w.blamedFor!, world.week, world.settings, pronounsFor(w))}
          </div>
        )}

        {/* Away, and there is nothing wrong with them. */}
        {w.leave && (
          <div className="mt-0.5 text-[10px] leading-snug text-sky-300">
            {leaveStatusLine(w.leave)} <span className="text-neutral-500">{w.leave.reason}</span>
          </div>
        )}

        {/* injury — how bad it is, then how long that means. */}
        {w.injury && (
          <div className="mt-0.5 text-[10px] font-medium text-rose-400">
            ✚ {injuryWord(w.injury.grade, world.settings)} · out about {w.injury.weeksRemaining}{' '}
            {w.injury.weeksRemaining === 1 ? 'week' : 'weeks'}
          </div>
        )}

        {/* The two views on it — the doctor, and the man himself. */}
        {stanceOn(w, world.settings) && (
          <>
            <div className="mt-0.5 text-[10px] leading-snug text-neutral-400">{stanceOn(w, world.settings)!.doctor.verdict}</div>
            <div className="text-[10px] leading-snug text-amber-400/90">{stanceOn(w, world.settings)!.man.says}</div>
          </>
        )}

        {/* Who they travel with, and who they will not be in a room with. */}
        {circleSummary(circleOf(world.relationships, w.id, world.settings), (id) => world.wrestlers[id]?.name) && (
          <div className="mt-0.5 text-[10px] leading-snug text-neutral-500">
            {circleSummary(circleOf(world.relationships, w.id, world.settings), (id) => world.wrestlers[id]?.name)}
          </div>
        )}

        {/* And what has already happened to this body. */}
        {bodyLine(w.injuryHistory ?? [], world.settings) && (
          <div className="mt-0.5 text-[10px] leading-snug text-neutral-600">
            {bodyLine(w.injuryHistory ?? [], world.settings)}
          </div>
        )}

        {/* who they are */}
        <div className="truncate text-[10px] text-amber-500/80" title={CAREER_STATUS_BLURBS[w.careerStatus]}>
          {CAREER_STATUS_LABELS[w.careerStatus]} · {yearsPro(w, currentYear)}y pro · {egoLabel(w.ego)}
          {group && <span className="ml-1 text-sky-400">· {group.name}</span>}
        </div>
        <div className="truncate text-[10px] text-neutral-500">
          {w.archetype} · {w.style} · {w.gimmick.name}
          {hypeLabel(w, world.settings) && <span className="ml-1 text-sky-400">· {hypeLabel(w, world.settings)}</span>}
        </div>

        <div className="mt-1">
          <GimmickHeatMeter wrestler={w} settings={world.settings} />
        </div>

        {/* What is leaving their purse every week, and to whom. */}
        {(() => {
          const line = clientCutLine(rep, rep ? world.wrestlers[rep.managerId]?.name : undefined);
          return line ? (
            <div
              className="mt-0.5 truncate text-[10px] text-amber-400/80"
              title="The manager's cut. It comes straight out of what they earn, not out of your budget — but they will absolutely remember it come renewal."
            >
              {line}
            </div>
          ) : null;
        })()}

        {/* Their own book, if they are the one taking a percentage. */}
        {w.role === 'manager' && wearLabel(w, world.settings) && (
          <div className="mt-0.5 truncate text-[10px] text-orange-400">
            {wearLabel(w, world.settings)} — flat-out too many people to be everywhere for
          </div>
        )}
        {w.role === 'manager' && (
          <div className="mt-0.5 truncate text-[10px] text-sky-400/80">
            {bookLine(
              world.representations ?? [],
              w.id,
              (clientId) => world.wrestlers[clientId]?.contract?.weeklyRate ?? 0,
              world.settings,
            )}
          </div>
        )}

        {/* A file at the office, and a suspension in particular. */}
        {recordLabel(w.discipline, world.week, world.settings) && (
          <div className="mt-0.5 truncate text-[10px] text-rose-400">
            {recordLabel(w.discipline, world.week, world.settings)}
          </div>
        )}

        {fitLabel(w, world.promotion, world.settings) && (
          <div
            className={`mt-0.5 truncate text-[10px] ${
              fitLabel(w, world.promotion, world.settings) === 'never quite fitted here'
                ? 'text-rose-400/80'
                : 'text-emerald-400/80'
            }`}
            title="How over this person can genuinely get in this company specifically."
          >
            {fitLabel(w, world.promotion, world.settings)}
          </div>
        )}

        {/* Whose kid this is, and whether the name is still doing the work. */}
        {w.lineage && (
          <div
            className="mt-0.5 truncate text-[10px] text-violet-400"
            title={
              w.lineage.provenBy !== null
                ? `${w.name} is over on their own now — the name did its job`
                : `The crowd gives them their father's ovation for ${patienceLeft(w, world.week, world.settings)} more weeks`
            }
          >
            ⚭ {w.lineage.parentName}'s kid
            {w.lineage.provenBy !== null ? (
              <span className="ml-1 text-emerald-400">· made their own name</span>
            ) : (
              <span className="ml-1 text-amber-500/80">· {patienceLeft(w, world.week, world.settings)}w of goodwill left</span>
            )}
          </div>
        )}

        {/* the read — why you would use them, and why you might not. */}
        <div className="mt-1 flex flex-col gap-px">
          <span className="text-[11px] leading-snug text-neutral-300">{scout(w, world.settings).pitch}</span>
          {scout(w, world.settings).catch ? (
            <span className="text-[11px] leading-snug text-rose-300/80">{scout(w, world.settings).catch}</span>
          ) : (
            <span className="text-[11px] leading-snug text-emerald-300/70">{scout(w, world.settings).cleanBill}</span>
          )}
        </div>

        {/* how they feel about you, and why. */}
        <MoodLine wrestler={w} settings={world.settings} size="sm" />

        {/* How far the name carries, and the towns that are actually theirs. */}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <ReachLine wrestler={w} settings={world.settings} />
          {strongholds(w, world.settings, 2).map((hold) => {
            const town = world.territories.find((t) => t.id === hold.territoryId);
            if (!town) return null;
            return (
              <span
                key={hold.territoryId}
                className="rounded bg-amber-950/60 px-1 py-px text-[9px] text-amber-300"
                title={`${w.name} is over in ${town.name}`}
              >
                {town.name}
              </span>
            );
          })}
          {(() => {
            const home = world.territories.find((t) => t.id === w.homeTerritoryId);
            return home ? (
              <span className="text-[9px] text-neutral-600" title="Where they are from">
                from {home.name}
              </span>
            ) : null;
          })()}
        </div>

        {/* allies and enemies */}
        {bonds.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {bonds.map((bond) => {
              const other = world.wrestlers[otherParty(bond, w.id)];
              if (!other) return null;
              const tone = isEnemy(bond)
                ? 'bg-rose-950/70 text-rose-300'
                : isAlly(bond)
                  ? 'bg-emerald-950/70 text-emerald-300'
                  : 'bg-neutral-800 text-neutral-400';
              return (
                <button
                  key={`${bond.aId}-${bond.bId}`}
                  type="button"
                  onClick={() => onNavigateWrestler(other.id)}
                  className={`rounded px-1 py-px text-[9px] transition hover:brightness-125 ${tone}`}
                  title={`${RELATIONSHIP_LABELS[bond.type]} — ${other.name}`}
                >
                  {isEnemy(bond) ? '✕' : '✓'} {other.name}
                </button>
              );
            })}
          </div>
        )}

        {/* feuds */}
        {rivalries.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {rivalries.map((r) => (
              <HeatBadge key={r.id} heat={r.heat} shootHeat={r.shootHeat} />
            ))}
          </div>
        )}
        {onOpenFeuds && allStorylinesFor(world.storylines, w.id).length > 0 && (
          <button
            type="button"
            data-testid={`open-feuds-${w.id}`}
            onClick={() => onOpenFeuds(w.id)}
            className="mt-1 self-start text-[10px] text-sky-400 underline-offset-2 hover:underline"
          >
            View feud history →
          </button>
        )}

        {/* What they do with a week you did not book them for. */}
        <AssignmentRow wrestler={w} settings={world.settings} />

        {/* What they are like out there, and what the room makes of them. */}
        <div className="mt-0.5 flex flex-wrap gap-x-2 text-[10px] leading-snug">
          <span className="text-sky-400/90">{ringcraftLabel(w, world.settings)}</span>
          <span className="text-neutral-500">{likeabilityLabel(w, world.settings)}</span>
        </div>

        {/* What would actually satisfy this person. */}
        {motivationSymbolsOf(w).length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1 text-sm" title="What the icons mean, above the roster">
            {motivationSymbolsOf(w).map((s) => (
              <span key={s.name} title={`${s.name} — ${s.blurb}`}>
                {s.icon}
              </span>
            ))}
          </div>
        )}

        {traitsOf(w).length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {traitsOf(w).map((trait) => (
              <span key={trait.id} title={trait.blurb} className="rounded bg-violet-950/60 px-1.5 py-0.5 text-[10px] text-violet-300">
                {trait.name}
              </span>
            ))}
          </div>
        )}

        {/* Where they have been, and what they did there. */}
        <CareerLedger wrestler={w} settings={world.settings} />

        {/* the deal */}
        <div className="mt-1 flex items-center justify-between border-t border-neutral-800 pt-1 text-[10px]">
          {w.contract ? (
            <>
              <span className="text-neutral-400">
                <Money amount={w.contract.weeklyRate} />
                <span className="text-neutral-600">/wk</span>
                <span className="ml-1 text-neutral-600">· {w.contract.weeksRemaining}w left</span>
              </span>
              {factionDestroyerLocked ? (
                <span className="text-amber-400" title="Nobody's clock runs out while the story is live">
                  Contract Frozen
                </span>
              ) : (
                <span
                  className={
                    contractUrgency(w.contract) === 'Expiring'
                      ? 'text-rose-400'
                      : contractUrgency(w.contract) === 'Running down'
                        ? 'text-amber-400'
                        : 'text-neutral-600'
                  }
                >
                  {contractUrgency(w.contract)}
                </span>
              )}
            </>
          ) : (
            <span className="text-rose-400">No contract</span>
          )}
        </div>

        {editable && (
          <>
            {/* The end of the road, and whether they are near it. */}
            {pressure >= world.settings.retirementUiThreshold && (
              <div className="mt-1 flex items-center justify-between gap-2 text-[10px]">
                <span className="text-amber-500/90">
                  {pressure >= 0.75 ? 'Talking about hanging them up' : 'Thinking about the end'}
                </span>
                <button
                  type="button"
                  data-testid={`retire-${w.id}`}
                  onClick={() => retireWrestler(w.id)}
                  className="rounded bg-neutral-800 px-1.5 py-0.5 text-neutral-300 hover:bg-amber-900/70"
                >
                  Retire them
                </button>
              </div>
            )}

            {/* What they do here, and whether they can be moved. */}
            <div className="mt-1 border-t border-neutral-800 pt-1">
              <div className="flex flex-wrap items-center gap-1">
                {(['wrestler', 'referee', 'manager'] as const).map((role) => {
                  const check = canChangeRole(w, role, world.week, world.settings);
                  const current = w.role === role;
                  return (
                    <button
                      key={role}
                      type="button"
                      data-testid={`role-${role}-${w.id}`}
                      disabled={current || !check.ok}
                      title={current ? 'What they do now' : (check.reason ?? 'Move them into this job')}
                      onClick={() => changeRole(w.id, role)}
                      className={`rounded px-1.5 py-0.5 text-[10px] ${
                        current
                          ? 'bg-emerald-700 text-white'
                          : check.ok
                            ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                            : 'cursor-not-allowed bg-neutral-900 text-neutral-700'
                      }`}
                    >
                      {ROLE_BUTTON_LABELS[role]}
                    </button>
                  );
                })}
              </div>
              {w.role !== 'wrestler' && (
                <div className="mt-0.5 text-[10px] text-sky-400">
                  {TRANSITION_ROLE_LABELS[w.role as 'referee' | 'manager']} · {lockLabel(w, world.week, world.settings)}
                </div>
              )}
            </div>

            {/* Cutting somebody, and what it costs. */}
            <div className="mt-1 flex items-center justify-between gap-2 text-[10px]">
              <span className={owed > 0 ? 'text-amber-400' : 'text-neutral-600'}>
                {severanceWeight(w.contract, world.promotion.bankBalance)}
              </span>
              <button
                type="button"
                data-testid={`release-${w.id}`}
                onClick={() => setReleaseResult(releaseWrestler(w.id).reason)}
                className="rounded bg-neutral-800 px-1.5 py-0.5 text-rose-300 hover:bg-rose-900/60"
              >
                Release{owed > 0 && (
                  <>
                    {' '}
                    · <Money amount={owed} />
                  </>
                )}
              </button>
            </div>
            {releaseResult && <div className="text-[10px] text-rose-400">{releaseResult}</div>}

            {/* What is in the deal that is not money. */}
            <PerkRow wrestler={w} />

            {/* A character that is not working can be changed. */}
            {onRepackage && (
              <button
                type="button"
                data-testid={`repackage-${w.id}`}
                onClick={() => onRepackage(w.id)}
                className="mt-1 w-full rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-300 hover:bg-neutral-700"
              >
                Repackage
              </button>
            )}
          </>
        )}

        {w.contract && w.contract.clauses.length > 0 && (
          <div className="mt-0.5 truncate text-[9px] text-amber-400/80" title={w.contract.clauses.join(', ')}>
            {w.contract.clauses.join(' · ')}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The perks on somebody's contract, and the ones they have not earned.
 *
 * Blocked perks are shown greyed with the reason rather than hidden, because
 * "not before 30" is the sort of thing a booker plans around — and because a
 * list that silently grows as somebody ages reads as a bug.
 */
function PerkRow({ wrestler }: { wrestler: Wrestler }) {
  const world = useGameStore((s) => s.world)!;
  const setPerk = useGameStore((s) => s.setPerk);
  const [open, setOpen] = useState(false);
  if (!world.settings.perksEnabled || !wrestler.contract) return null;

  const year = world.settings.startingYear + Math.floor(world.week / 52);
  const ctx = { currentYear: year, isRenewal: true };
  const held = new Set(wrestler.contract.perks ?? []);
  const bill = perkUpkeep(wrestler);

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded bg-neutral-950/60 px-2 py-1 text-[10px] text-neutral-400 hover:bg-neutral-900"
      >
        <span>
          {open ? '▾' : '▸'} What is in the deal
          {held.size > 0 && <span className="ml-1 text-violet-300">· {held.size}</span>}
        </span>
        {bill > 0 && (
          <span className="text-rose-300/80">
            <Money amount={bill} />
            /wk
          </span>
        )}
      </button>
      {open && (
        <div className="mt-1 flex flex-col gap-1">
          {PERKS.map((perk) => {
            const on = held.has(perk.id);
            const blocked = blockedBecause(perk, wrestler, ctx);
            return (
              <button
                key={perk.id}
                type="button"
                data-testid={`perk-${wrestler.id}-${perk.id}`}
                disabled={Boolean(blocked) && !on}
                onClick={() => setPerk(wrestler.id, perk.id, !on)}
                className={`rounded border p-1.5 text-left ${
                  on
                    ? 'border-violet-500 bg-violet-950/40'
                    : blocked
                      ? 'cursor-not-allowed border-neutral-900 bg-neutral-950/40 opacity-50'
                      : 'border-neutral-800 bg-neutral-900 hover:border-neutral-600'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] font-medium text-neutral-200">{perk.name}</span>
                  <span className="shrink-0 text-[10px] text-neutral-500">
                    {blocked && !on ? blocked : <Money amount={perk.weeklyCost} />}
                  </span>
                </div>
                <div className="text-[10px] text-neutral-500">{perk.blurb}</div>
                {perk.lockerRoomCost >= 0.2 && (
                  <div className="text-[10px] text-amber-400/80">The rest of that locker room is going to notice, guaranteed.</div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * What they are doing with the weeks they are not booked for.
 *
 * Read-only here on purpose. The control lives on the booking screen, next
 * to the card, because that is the same decision made at the same moment.
 */
function AssignmentRow({ wrestler, settings }: { wrestler: Wrestler; settings: WorldSettings }) {
  const doing = assignmentOf(wrestler, settings);
  const kind = assignmentById(doing)!;
  const pinned = Boolean(wrestler.assignment && wrestler.assignment !== 'auto');

  return (
    <div className="mt-0.5 flex items-baseline justify-between gap-2 text-[10px]">
      <span className="truncate text-neutral-500">
        Weeks off · <span className="text-sky-400/90">{kind.name}</span>
        {!pinned && <span className="text-neutral-600"> · office</span>}
      </span>
      {wrestler.doingThisWeek && <span className="shrink-0 text-neutral-600">{wrestler.doingThisWeek}</span>}
    </div>
  );
}

/** A tiny championship plate. Reads as a belt at 10px, which an emoji does not. */
function BeltIcon({ color }: { color: string }) {
  return (
    <svg width="10" height="8" viewBox="0 0 10 8" aria-hidden className="shrink-0">
      <rect x="0" y="3" width="10" height="2" fill={color} opacity="0.55" />
      <ellipse cx="5" cy="4" rx="2.6" ry="3.4" fill={color} />
    </svg>
  );
}
