// The weekly sheet — every list, every company, both divisions.
//
// Deliberately dense and deliberately typeset like a newsletter rather than a
// game screen: numbered rows, company names in small caps, belts beside the
// people carrying them. This is the page a player checks to find out where
// they sit in the business, so it shows the whole business.

import { useMemo, useState } from 'react';
import { useGameStore } from '../../state/store';
import { publish, movement, type DivisionLists } from '../../engine/world/publication';
import { billedAs } from '../../engine/generate/nickname';
import { shortTitleName } from '../../data/titles';
import type { Publication } from '../../engine/world/publication';
import { rankReferees, refereeGrade } from '../../engine/sim/referees';

type Division = 'mens' | 'womens';

const MOVEMENT_GLYPH: Record<string, string> = { up: '▲', down: '▼', new: '★', same: '·' };
const MOVEMENT_TONE: Record<string, string> = {
  up: 'text-emerald-400',
  down: 'text-rose-400',
  new: 'text-amber-400',
  same: 'text-neutral-700',
};

export function SheetScreen() {
  const world = useGameStore((s) => s.world);
  const [division, setDivision] = useState<Division>('mens');

  const sheets = useMemo(() => {
    if (!world) return null;
    const ctx = {
      currentWeek: world.week,
      titles: world.titles,
      wrestlers: Object.values(world.wrestlers),
      stables: world.stables,
      settings: world.settings,
    };
    return { current: publish(ctx), previous: world.lastPublication };
  }, [world]);

  // Everybody in a striped shirt, ranked. Being brilliant and unbooked does
  // not top this list — see refereeStanding. Your own crew is always on it,
  // even when they are nowhere near the top, because a page that hides your
  // own officials is not telling you the thing you came to find out.
  const officials = useMemo(() => {
    if (!world) return [];
    const ranked = rankReferees(world.referees);
    const shown = ranked.slice(0, 10);
    const missingOwn = ranked.filter(
      (r) => r.promotionId === world.promotion.id && !shown.includes(r),
    );
    return rankReferees([...shown, ...missingOwn]);
  }, [world]);

  if (!world || !sheets) return null;

  const lists: DivisionLists = sheets.current[division];
  const nameOf = (id: string) => {
    const w = world.wrestlers[id];
    return w ? billedAs(w) : 'Unknown';
  };
  const companyName = (id: string | null) =>
    id === world.promotion.id
      ? world.promotion.name
      : (world.rivals.find((r) => r.id === id)?.name ?? 'Unsigned');
  const isMine = (id: string | null) => id === world.promotion.id;

  return (
    <div className="p-3 pb-24 text-neutral-100">
      <div className="mb-1 flex items-baseline justify-between">
        <h1 className="text-base font-semibold">The Sheet</h1>
        <span className="text-[10px] uppercase tracking-widest text-neutral-600">Week {sheets.current.week}</span>
      </div>
      <p className="mb-3 text-[11px] text-neutral-500">
        Every promotion, every belt, every single week. Movement is measured against last week&apos;s issue.
      </p>

      <div className="mb-3 flex gap-1">
        {(['mens', 'womens'] as Division[]).map((option) => (
          <button
            key={option}
            type="button"
            data-testid={`sheet-${option}`}
            onClick={() => setDivision(option)}
            className={`rounded px-3 py-1 text-xs ${
              division === option ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
            }`}
          >
            {option === 'mens' ? "Men's division" : "Women's division"}
          </button>
        ))}
      </div>

      {/* ---- top wrestlers ---------------------------------------------- */}
      <Section title={`Top ${lists.wrestlers.length} wrestlers in the world`}>
        {lists.wrestlers.length === 0 ? (
          <Empty>Nobody in this division is signed anywhere.</Empty>
        ) : (
          lists.wrestlers.map((entry) => {
            const w = world.wrestlers[entry.wrestlerId];
            const moved = movement(sheets.current, sheets.previous, entry.wrestlerId, division === 'mens' ? 'm' : 'f');
            const belt = entry.titleId ? world.titles.find((t) => t.id === entry.titleId) : null;

            return (
              <Row key={entry.wrestlerId} rank={entry.rank} mine={isMine(entry.promotionId)} testId={`sheet-wrestler-${entry.rank}`}>
                {moved && <span className={`w-3 shrink-0 text-[9px] ${MOVEMENT_TONE[moved]}`}>{MOVEMENT_GLYPH[moved]}</span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">{nameOf(entry.wrestlerId)}</span>
                  <span className="block truncate text-[10px] text-neutral-500">
                    {companyName(entry.promotionId)}
                    {w && (
                      <span className="ml-1 text-neutral-600">
                        {w.record.wins}-{w.record.losses}
                      </span>
                    )}
                  </span>
                </span>
                {belt && <Belt name={shortTitleName(belt)} strap={belt.colorway.strap} plate={belt.colorway.plate} />}
              </Row>
            );
          })
        )}
      </Section>

      {/* ---- top tag teams ---------------------------------------------- */}
      <Section title={`Top ${lists.teams.length || ''} tag teams`.trim()}>
        {lists.teams.length === 0 ? (
          <Empty>No teams in this division yet.</Empty>
        ) : (
          lists.teams.map((entry) => {
            const team = world.stables.find((s) => s.id === entry.teamId);
            const belt = entry.titleId ? world.titles.find((t) => t.id === entry.titleId) : null;
            return (
              <Row key={entry.teamId} rank={entry.rank} mine={isMine(entry.promotionId)} testId={`sheet-team-${entry.rank}`}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">{team?.name ?? 'Unknown team'}</span>
                  <span className="block truncate text-[10px] text-neutral-500">
                    {entry.memberIds.map((id) => world.wrestlers[id]?.name ?? '?').join(' & ')}
                  </span>
                  <span className="block truncate text-[10px] text-neutral-600">
                    {companyName(entry.promotionId)}
                    {team && (
                      <span className="ml-1">
                        {team.record.wins}-{team.record.losses}
                      </span>
                    )}
                  </span>
                </span>
                {belt && <Belt name={shortTitleName(belt)} strap={belt.colorway.strap} plate={belt.colorway.plate} />}
              </Row>
            );
          })
        )}
      </Section>

      {/* ---- champions --------------------------------------------------- */}
      <Section title="Champions">
        {lists.champions.length === 0 ? (
          <Empty>Every belt in this division is vacant.</Empty>
        ) : (
          lists.champions.map((entry) => {
            const title = world.titles.find((t) => t.id === entry.titleId);
            if (!title) return null;
            return (
              <div
                key={entry.titleId}
                data-testid={`sheet-champion-${entry.titleId}`}
                className={`flex items-center gap-2 rounded border px-2 py-1.5 ${
                  isMine(entry.promotionId) ? 'border-emerald-800 bg-emerald-950/30' : 'border-neutral-800 bg-neutral-900'
                }`}
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: title.colorway.plate }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">
                    {entry.holderIds.map((id) => nameOf(id)).join(' & ')}
                  </span>
                  <span className="block truncate text-[10px] text-neutral-500">{title.name}</span>
                </span>
                <span className="shrink-0 text-right text-[10px] text-neutral-600">
                  {entry.reignWeeks}w
                  <span className="block">{companyName(entry.promotionId).split(/\s+/)[0]}</span>
                </span>
              </div>
            );
          })
        )}
      </Section>

      {/* Officials get their own ladder. They are signed characters with
          contracts and reputations, and the sheet has always had an opinion
          about who can be trusted to count a fall. */}
      <Section title="The officials">
        {officials.length === 0 ? (
          <Empty>Nobody is working.</Empty>
        ) : (
          officials.map((referee, i) => (
            <Row
              key={referee.id}
              rank={i + 1}
              mine={referee.promotionId === world.promotion.id}
              testId={`sheet-official-${referee.id}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">{referee.name}</span>
                <span className="block truncate text-[10px] text-neutral-500">
                  {refereeGrade(referee)}
                  {referee.recentMisses > 0 && ` · ${referee.recentMisses} blown lately`}
                </span>
              </span>
              <span className="shrink-0 text-right text-[10px] text-neutral-600">
                {referee.promotionId
                  ? companyName(referee.promotionId).split(/\s+/)[0]
                  : 'available'}
              </span>
            </Row>
          ))
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h2 className="mb-1 border-b border-neutral-800 pb-1 text-[11px] uppercase tracking-widest text-neutral-400">
        {title}
      </h2>
      <div className="flex flex-col gap-1 pt-1">{children}</div>
    </section>
  );
}

function Row({
  rank,
  mine,
  testId,
  children,
}: {
  rank: number;
  mine: boolean;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <article
      data-testid={testId}
      className={`flex items-center gap-2 rounded border px-2 py-1.5 ${
        mine ? 'border-emerald-800 bg-emerald-950/30' : 'border-neutral-800 bg-neutral-900'
      }`}
    >
      <span className="w-5 shrink-0 text-right font-mono text-xs text-neutral-500">{rank}</span>
      {children}
    </article>
  );
}

function Belt({ name, strap, plate }: { name: string; strap: string; plate: string }) {
  return (
    <span
      className="shrink-0 rounded px-1 py-px text-[9px] font-medium"
      style={{ backgroundColor: strap, color: plate }}
    >
      {name}
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-neutral-600">{children}</p>;
}

export type { Publication };
