// Roster — §21: "Grid of name plates. Color-coded... Health as a red bar
// consuming the plate from the right. Sortable by any stat."
//
// The bar this screen has to clear: you should be able to look at one card
// and know what that wrestler is *about* without opening anything. Who they
// are, whose side they're on, what they're carrying, who they can't stand,
// what they cost you, and whether they can work this week.
//
// Stats stay bars and words (§0). The two exceptions are age and the contract,
// because "31" and "$450/wk for 60 weeks" are facts a booker needs exactly,
// not impressions.

import { useMemo, useState } from 'react';
import { crownBadge, crownsFor, CUP_NAME } from '../../engine/world/cup';
import { useGameStore } from '../../state/store';
import { activeRivalriesFor } from '../../engine/sim/rivalry';
import { effectiveAppearance } from '../../engine/generate/gimmickLook';
import { CAREER_STATUS_LABELS, CAREER_STATUS_BLURBS, yearsPro } from '../../engine/career/status';
import { egoLabel } from '../../engine/career/ego';
import { stanceOn, bodyLine } from '../../engine/career/theBody';
import { leaveStatusLine, shunLine, shunned } from '../../engine/career/onOurWatch';
import { retirementPressure } from '../../engine/career/retirement';
import { canFormTeam, teamOf, TEAM_PROBLEM_TEXT } from '../../engine/world/tagTeams';
import { ATTIRE_PALETTE } from '../paperdoll/palette';
import { contractUrgency } from '../../engine/economy/contracts';
import { canChangeRole, lockLabel, TRANSITION_ROLE_LABELS } from '../../engine/career/transition';
import { severanceOwed, severanceWeight } from '../../engine/economy/termination';
import { titlesHeldBy, shortTitleName, reignLength } from '../../data/titles';
import {
  relationshipsFor,
  otherParty,
  isAlly,
  isEnemy,
  RELATIONSHIP_LABELS,
} from '../../engine/career/relationships';
import { MoodLine } from '../components/Mood';
import { MiniStats, ReachLine } from '../components/MiniStats';
import { strongholds } from '../../engine/career/reach';
import { patienceLeft } from '../../engine/career/lineage';
import { blockedBecause, perkUpkeep } from '../../engine/economy/perks';
import { hypeLabel } from '../../engine/career/hype';
import { fitLabel } from '../../engine/career/fit';
import { bookLine, clientCutLine, representativeOf, wearLabel } from '../../engine/career/representation';
import { recordLabel } from '../../engine/career/discipline';
import { PERKS } from '../../data/perks';
import { PaperDoll } from '../paperdoll/PaperDoll';
import { HeatBadge, Money } from '../components/display';
import { scout } from '../../engine/career/scouting';
import type { Wrestler } from '../../engine/types';

/**
 * Short enough for a roster card. The long names live in the engine's
 * TRANSITION_ROLE_LABELS, which is what the status line under them uses.
 */
const ROLE_BUTTON_LABELS = { wrestler: 'Wrestles', referee: 'Referees', manager: 'Manages' } as const;

const SORTS = {
  popularity: { label: 'Popularity', of: (w: Wrestler) => w.popularity },
  condition: { label: 'Condition', of: (w: Wrestler) => w.health },
  momentum: { label: 'Momentum', of: (w: Wrestler) => w.momentum },
  morale: { label: 'Morale', of: (w: Wrestler) => w.morale },
  cost: { label: 'Cost', of: (w: Wrestler) => w.contract?.weeklyRate ?? 0 },
  ego: { label: 'Ego', of: (w: Wrestler) => w.ego },
  age: { label: 'Age', of: (w: Wrestler) => -w.age },
  contract: { label: 'Deal ending', of: (w: Wrestler) => -(w.contract?.weeksRemaining ?? 0) },
  name: { label: 'Name', of: () => 0 },
} as const;

type SortKey = keyof typeof SORTS;

/** Face / heel / tweener, spelled out. The dot alone was too subtle here. */
function alignmentOf(w: Wrestler): { label: string; className: string } {
  if (w.alignment >= 15) return { label: 'FACE', className: 'bg-emerald-900/70 text-emerald-300' };
  if (w.alignment <= -15) return { label: 'HEEL', className: 'bg-purple-900/70 text-purple-300' };
  return { label: 'TWEENER', className: 'bg-neutral-700 text-neutral-300' };
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
                  <div className="text-[10px] text-amber-400/80">The rest of the room will notice.</div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function RosterScreen({ onRepackage }: { onRepackage?: (wrestlerId: string) => void } = {}) {
  const world = useGameStore((s) => s.world);
  const retireWrestler = useGameStore((s) => s.retireWrestler);
  const changeRole = useGameStore((s) => s.changeRole);
  const releaseWrestler = useGameStore((s) => s.releaseWrestler);
  const [releaseResult, setReleaseResult] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('popularity');

  const roster = useMemo(() => {
    if (!world) return [];
    const list = world.promotion.rosterIds.map((id) => world.wrestlers[id]!).filter(Boolean);
    if (sort === 'name') return [...list].sort((a, b) => a.name.localeCompare(b.name));
    return [...list].sort((a, b) => SORTS[sort].of(b) - SORTS[sort].of(a));
  }, [world, sort]);

  if (!world) return null;

  const currentYear = world.settings.startingYear + Math.floor(world.week / 52);
  const stableOf = (w: Wrestler) =>
    world.stables.find((s) => s.disbandedWeek === null && s.memberIds.includes(w.id));

  return (
    <div className="p-3 pb-24 text-neutral-100">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="text-base font-semibold">Roster — {roster.length}</h1>
        <span className="text-xs text-neutral-500">
          wages <Money amount={roster.reduce((sum, w) => sum + (w.contract?.weeklyRate ?? 0), 0)} />
          /wk
        </span>
      </div>

      <div className="mb-3 flex flex-wrap gap-1">
        {(Object.keys(SORTS) as SortKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSort(key)}
            className={`rounded px-2 py-1 text-[11px] ${sort === key ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}
          >
            {SORTS[key].label}
          </button>
        ))}
      </div>

      <TagTeamPanel />

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {roster.map((w) => {
          const rivalries = activeRivalriesFor(world.rivalries, [w.id]);
          const belts = titlesHeldBy(world.titles, w.id);
          const alignment = alignmentOf(w);
          const group = stableOf(w);

          const pressure = retirementPressure(w, { currentYear, settings: world.settings });
          // What ending this deal early would cost. Zero for most of the
          // card; a year of a draw's wages for the ones you built up.
          const owed = severanceOwed(w.contract);

          const bonds = relationshipsFor(world.relationships, w.id)
            .filter((r) => world.promotion.rosterIds.includes(otherParty(r, w.id)))
            .slice(0, 3);

          return (
            <article
              key={w.id}
              data-testid={`roster-${w.id}`}
              className="relative flex gap-2 overflow-hidden rounded border border-neutral-800 bg-neutral-900 p-2"
            >
              {/* Health consumes the plate from the right, §21. */}
              <div
                className="pointer-events-none absolute inset-y-0 right-0 bg-rose-950/40"
                style={{ width: `${100 - w.health}%` }}
                aria-hidden
              />

              <div className="relative shrink-0">
                <PaperDoll
                  appearance={effectiveAppearance(w, world.stables)}
                  gender={w.gender}
                  alignment={w.alignment}
                  size="bust"
                />
                {w.injury && (
                  <span
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[11px] font-bold text-white shadow"
                    title={`${w.injury.description} — ${w.injury.weeksRemaining} weeks out`}
                  >
                    ✚
                  </span>
                )}
                {/* The whole person, under their face. Directly below the
                    portrait because that is where the eye already is when you
                    are scanning a roster for somebody to book. */}
                <div className="mt-1 w-[86px]">
                  <MiniStats
                    wrestler={w}
                    settings={world.settings}
                    titles={world.titles}
                    territoryId={world.showSetup.territoryId}
                    territoryName={
                      world.territories.find((t) => t.id === world.showSetup.territoryId)?.name
                    }
                  />
                </div>
              </div>

              <div className="relative min-w-0 flex-1">
                {/* name, alignment, age */}
                {/* The Crucible, above the name and impossible to miss. Winning
                    it is the biggest single thing an individual can do in this
                    game, and a repeat winner says so on the plate. */}
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
                {w.nickname && (
                  <div className="truncate text-[10px] italic text-amber-400/90">“{w.nickname}”</div>
                )}
                <div className="flex items-baseline gap-1.5">
                  <span className="truncate text-sm font-medium">{w.name}</span>
                  <span className={`shrink-0 rounded px-1 py-px text-[9px] font-bold ${alignment.className}`}>
                    {alignment.label}
                  </span>
                  <span className="shrink-0 text-[10px] text-neutral-500">{w.age}</span>
                </div>

                {/* A repackage does not erase who they were. */}
                {w.formerNames && w.formerNames.length > 0 && (
                  <div className="truncate text-[9px] text-neutral-600">
                    formerly {w.formerNames[w.formerNames.length - 1]!.name}
                  </div>
                )}

                {/* championships */}
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

                {/* He has told you he is going. Loudest thing on the card,
                    because a fortnight of warning is the whole value of it. */}
                {w.noticeGivenWeek != null && (
                  <div className="mt-0.5 text-[10px] font-semibold text-rose-300">
                    Not re-signing. Working out the deal and then gone.
                  </div>
                )}

                {/* The room has decided this one was his fault. Information
                    about the man, like the injury stances — the booker can
                    still put him on the card and find out. */}
                {shunned(w.blamedFor, world.week, world.settings) && (
                  <div className="mt-0.5 text-[10px] font-semibold leading-snug text-rose-300">
                    {shunLine(w.blamedFor!, world.week, world.settings)}
                  </div>
                )}

                {/* Away, and there is nothing wrong with him. Deliberately
                    not styled as an injury and it says why he is gone — a man
                    sent home for a month must not read as a torn something.
                    See engine/career/onOurWatch.ts. */}
                {w.leave && (
                  <div className="mt-0.5 text-[10px] leading-snug text-sky-300">
                    {leaveStatusLine(w.leave)} <span className="text-neutral-500">{w.leave.reason}</span>
                  </div>
                )}

                {/* injury */}
                {w.injury && (
                  <div className="mt-0.5 text-[10px] font-medium text-rose-400">
                    ✚ Out {w.injury.weeksRemaining} {w.injury.weeksRemaining === 1 ? 'week' : 'weeks'} · {w.injury.severity}
                  </div>
                )}

                {/* The two views on it. Information the booker weighs when he
                    decides whether to put this man on the card, not a question
                    the game asks him. See engine/career/theBody.ts. */}
                {stanceOn(w, world.settings) && (
                  <>
                    <div className="mt-0.5 text-[10px] leading-snug text-neutral-400">{stanceOn(w, world.settings)!.doctor.verdict}</div>
                    <div className="text-[10px] leading-snug text-amber-400/90">{stanceOn(w, world.settings)!.man.says}</div>
                  </>
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
                  {/* What the business believes, which is not the same thing
                      as what is true — see engine/career/hype.ts. This is the
                      only window onto the hidden ceiling anybody gets, the
                      player and the five companies bidding against them
                      alike, and it is a rumour rather than a reading. */}
                  {hypeLabel(w, world.settings) && (
                    <span className="ml-1 text-sky-400">· {hypeLabel(w, world.settings)}</span>
                  )}
                </div>

                {/* Whether this room is the right room for them. Its own line
                    rather than another chip on the one above, which already
                    truncates — this is the read that changes who you sign, and
                    a read that gets cut off is not a read.

                    Only ever speaks at the ends (engine/career/fit.ts): most
                    people are a reasonable fit most places, and saying so every
                    week would bury the one that matters. Half of what it
                    reports is chemistry nobody can explain, which is why it is
                    a read and not a reason. */}
                {/* What is leaving his purse every week, and to whom. A cut
                    the player cannot see is a cut they cannot make a decision
                    about — see engine/career/representation.ts. */}
                {(() => {
                  const rep = representativeOf(world.representations ?? [], w.id);
                  const line = clientCutLine(rep, rep ? world.wrestlers[rep.managerId]?.name : undefined);
                  return line ? (
                    <div className="mt-0.5 truncate text-[10px] text-amber-400/80" title="His manager's percentage. It comes out of what he earns, not out of your budget — but he remembers it at renewal.">
                      {line}
                    </div>
                  ) : null;
                })()}

                {/* His own book, if he is the one taking a percentage. */}
                {w.role === 'manager' && wearLabel(w, world.settings) && (
                  <div className="mt-0.5 truncate text-[10px] text-orange-400">
                    {wearLabel(w, world.settings)} — too many people to be everywhere for
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

                {/* A file at the office, and a suspension in particular —
                    §0 says a man off every card is never a silent change. */}
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
                    title="How over this person can get in this company in particular. Somewhere else they would be worth something different — and half of why is nothing anybody can put their finger on."
                  >
                    {fitLabel(w, world.promotion, world.settings)}
                  </div>
                )}

                {/* Whose kid this is, and whether the name is still doing the
                    work. The clock matters to the booker: an unproven second
                    generation is a draw with an expiry date on it. */}
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
                      <span className="ml-1 text-emerald-400">· made his own name</span>
                    ) : (
                      <span className="ml-1 text-amber-500/80">
                        · {patienceLeft(w, world.week, world.settings)}w of goodwill left
                      </span>
                    )}
                  </div>
                )}

                {/* the read — why you would use him, and why you might not.
                    First, above the bars, because it is the thing a booker
                    actually decides on and the bars are the detail behind it. */}
                <div className="mt-1 flex flex-col gap-px">
                  <span className="text-[11px] leading-snug text-neutral-300">{scout(w, world.settings).pitch}</span>
                  {scout(w, world.settings).catch ? (
                    <span className="text-[11px] leading-snug text-rose-300/80">{scout(w, world.settings).catch}</span>
                  ) : (
                    <span className="text-[11px] leading-snug text-emerald-300/70">
                      {scout(w, world.settings).cleanBill}
                    </span>
                  )}
                </div>

                {/* how they feel about you, and why. Above the bars because
                    it is a thing the booker can act on this week. */}
                <MoodLine wrestler={w} settings={world.settings} size="sm" />

                {/* How far the name carries, and the towns that are actually
                    theirs. The meters themselves now live under the portrait
                    — repeating them here as a wide word-labelled grid was the
                    same eight numbers twice. */}
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
                        <span
                          key={`${bond.aId}-${bond.bId}`}
                          className={`rounded px-1 py-px text-[9px] ${tone}`}
                          title={`${RELATIONSHIP_LABELS[bond.type]} — ${other.name}`}
                        >
                          {isEnemy(bond) ? '✕' : '✓'} {other.name.split(' ').slice(-1)[0]}
                        </span>
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

                {/* the deal */}
                <div className="mt-1 flex items-center justify-between border-t border-neutral-800 pt-1 text-[10px]">
                  {w.contract ? (
                    <>
                      <span className="text-neutral-400">
                        <Money amount={w.contract.weeklyRate} />
                        <span className="text-neutral-600">/wk</span>
                        <span className="ml-1 text-neutral-600">· {w.contract.weeksRemaining}w left</span>
                      </span>
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
                    </>
                  ) : (
                    <span className="text-rose-400">No contract</span>
                  )}
                </div>

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

                {/* What they do here, and whether they can be moved.
                    A wrestler can take the shirt or the suit and come back
                    from it — but they owe a year in the job first, so this is
                    a plan, not a way to cover an injured official. */}
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
                      {TRANSITION_ROLE_LABELS[w.role as 'referee' | 'manager']} ·{' '}
                      {lockLabel(w, world.week, world.settings)}
                    </div>
                  )}
                </div>

                {/* Cutting somebody, and what it costs. The number is on the
                    button because the money is the decision — CLAUDE.md says
                    never warn before a bad choice, and this is not a warning,
                    it is the price on the ticket. */}
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
                    Release{owed > 0 && <> · <Money amount={owed} /></>}
                  </button>
                </div>
                {releaseResult && <div className="text-[10px] text-rose-400">{releaseResult}</div>}

                {/* What is in the deal that is not money. Only on people you
                    already have — everything here is renewal-only, which is
                    the fiction and not a balance dial: you do not hand a jet
                    to somebody you have never worked with. */}
                <PerkRow wrestler={w} />

                {/* A character that is not working can be changed. Any of
                    them, any time — that is what a booker does. */}
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

                {w.contract && w.contract.clauses.length > 0 && (
                  <div className="mt-0.5 truncate text-[9px] text-amber-400/80" title={w.contract.clauses.join(', ')}>
                    {w.contract.clauses.join(' · ')}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Forming and splitting tag teams.
 *
 * The AI does this on its own for every promotion, so leaving the player
 * unable to do it was the odd gap: you could watch Northern Combat League
 * build a tag division and not build your own. Collapsed by default because
 * most weeks you are not thinking about it.
 *
 * Splitting a team that holds the belts vacates them, which is the honest
 * consequence — and the game does not warn you before you do it.
 */
function TagTeamPanel() {
  const world = useGameStore((s) => s.world);
  const formTeam = useGameStore((s) => s.formTagTeam);
  const disband = useGameStore((s) => s.disbandTagTeam);

  const [open, setOpen] = useState(false);
  const [partnerA, setPartnerA] = useState('');
  const [partnerB, setPartnerB] = useState('');
  const [name, setName] = useState('');

  if (!world) return null;

  const rosterIds = new Set(world.promotion.rosterIds);
  const teams = world.stables.filter(
    (t) => t.kind === 'tagTeam' && t.disbandedWeek === null && t.memberIds.every((id) => rosterIds.has(id)),
  );
  const unattached = world.promotion.rosterIds
    .map((id) => world.wrestlers[id])
    .filter((w): w is Wrestler => Boolean(w) && !teamOf(world.stables, w!.id));

  const a = world.wrestlers[partnerA];
  const b = world.wrestlers[partnerB];
  const check = canFormTeam(a, b, world.stables, rosterIds, name);
  // Only complain once they have actually picked two people.
  const problem = partnerA && partnerB && !check.ok ? check.problem : null;

  function submit() {
    if (!check.ok) return;
    formTeam(partnerA, partnerB, name);
    setPartnerA('');
    setPartnerB('');
    setName('');
  }

  return (
    <section className="mb-3 rounded border border-neutral-800 bg-neutral-900">
      <button
        type="button"
        data-testid="tag-teams-toggle"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="text-sm font-medium">
          Tag teams
          <span className="ml-2 text-xs text-neutral-500">{teams.length}</span>
        </span>
        <span className="text-neutral-600">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="border-t border-neutral-800 p-3">
          {teams.length > 0 && (
            <ul className="mb-3 flex flex-col gap-1">
              {teams.map((team) => {
                const members = team.memberIds.map((id) => world.wrestlers[id]).filter(Boolean);
                const belts = titlesHeldBy(world.titles, team.memberIds[0] ?? '').filter((t) => t.tier === 'tag');
                return (
                  <li
                    key={team.id}
                    data-testid={`team-${team.id}`}
                    className="flex items-center gap-2 rounded bg-neutral-950 p-2"
                  >
                    {team.colors && (
                      <span
                        className="h-6 w-1.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: ATTIRE_PALETTE[team.colors.primary] }}
                        aria-hidden
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{team.name}</span>
                      <span className="block truncate text-[10px] text-neutral-500">
                        {members.map((m) => m!.name).join(' & ')}
                        <span className="ml-1 text-neutral-600">
                          {team.record.wins}-{team.record.losses}
                          {team.record.draws > 0 && `-${team.record.draws}`}
                        </span>
                      </span>
                      {belts.length > 0 && (
                        <span className="block truncate text-[10px] text-amber-500/90">
                          {belts.map((belt) => belt.name).join(', ')}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      data-testid={`disband-${team.id}`}
                      onClick={() => disband(team.id)}
                      className="shrink-0 rounded bg-neutral-800 px-2 py-1 text-[10px] text-neutral-300 hover:bg-rose-900/70"
                    >
                      Split them up
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="text-[11px] uppercase tracking-wide text-neutral-500">Put a team together</div>
          <div className="mt-1 grid gap-1 sm:grid-cols-2">
            {[
              { value: partnerA, set: setPartnerA, label: 'First' },
              { value: partnerB, set: setPartnerB, label: 'Second' },
            ].map((slot) => (
              <select
                key={slot.label}
                data-testid={`partner-${slot.label.toLowerCase()}`}
                value={slot.value}
                onChange={(e) => slot.set(e.target.value)}
                className="rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs text-neutral-100"
              >
                <option value="">{slot.label} — nobody</option>
                {unattached.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            ))}
          </div>

          <input
            type="text"
            data-testid="team-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Team name — leave blank and the announcers will pick one"
            className="mt-1 w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs placeholder:text-neutral-600"
          />

          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              data-testid="form-team"
              disabled={!check.ok}
              onClick={submit}
              className={`rounded px-3 py-1 text-xs ${
                check.ok
                  ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                  : 'bg-neutral-800 text-neutral-600'
              }`}
            >
              Form the team
            </button>
            {problem && <span className="text-[11px] text-amber-400">{TEAM_PROBLEM_TEXT[problem]}</span>}
          </div>

          {unattached.length < 2 && (
            <p className="mt-2 text-[11px] text-neutral-600">
              Everybody on the roster is already in a team.
            </p>
          )}
        </div>
      )}
    </section>
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
