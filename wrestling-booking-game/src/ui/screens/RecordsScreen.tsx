// The record books.
//
// Everything here is read back out of history rather than stored, so it is
// always true and never needs maintaining. Each belt also gets its full
// lineage on tap — every reign, how long it ran in days, and which company it
// ran in, which matters once companies start buying each other out.

import { useMemo, useState } from 'react';
import { useGameStore } from '../../state/store';
import {
  championshipRecords,
  titleRecords,
  ringRecords,
  oddityRecords,
  careerRecords,
  reignDays,
  type RecordEntry,
  type RecordSection,
} from '../../engine/world/records';
import { billedAs } from '../../engine/generate/nickname';
import type { Id } from '../../engine/types';

type Book = 'titles' | 'ring' | 'oddities' | 'lineage';

const BOOKS: { id: Book; label: string }[] = [
  { id: 'titles', label: 'Championships' },
  { id: 'ring', label: 'In the ring' },
  { id: 'oddities', label: 'Oddities' },
  { id: 'lineage', label: 'Lineages' },
];

const UNIT_LABEL: Record<RecordEntry['unit'], (n: number) => string> = {
  days: (n) => `${n.toLocaleString()} days`,
  weeks: (n) => `${n} ${n === 1 ? 'week' : 'weeks'}`,
  matches: (n) => `${n} ${n === 1 ? 'match' : 'matches'}`,
  reigns: (n) => `${n} ${n === 1 ? 'reign' : 'reigns'}`,
  times: (n) => `${n}`,
  years: (n) => `${n}`,
  stars: (n) => `${n}★`,
  people: (n) => n.toLocaleString(),
};

export function RecordsScreen() {
  const world = useGameStore((s) => s.world);
  const [book, setBook] = useState<Book>('titles');

  const ctx = useMemo(() => {
    if (!world) return null;
    return {
      wrestlers: Object.values(world.wrestlers),
      titles: world.titles,
      currentWeek: world.week,
      limit: 5,
    };
  }, [world]);

  if (!world || !ctx) return null;

  const currentYear = world.settings.startingYear + Math.floor(world.week / 52);
  const promotionName = (id: Id) =>
    id === world.promotion.id ? world.promotion.name : (world.rivals.find((r) => r.id === id)?.name ?? 'a dead company');
  const titleName = (id: Id) => world.titles.find((t) => t.id === id)?.name;
  const nameOf = (id: Id) => {
    const w = world.wrestlers[id];
    return w ? billedAs(w) : 'Unknown';
  };

  const sections: RecordSection[] =
    book === 'titles'
      ? championshipRecords(ctx, promotionName)
      : book === 'ring'
        ? ringRecords(ctx)
        : book === 'oddities'
          ? [...oddityRecords(ctx, titleName), ...careerRecords(ctx, currentYear)]
          : [];

  return (
    <div className="p-3 pb-24 text-neutral-100">
      <div className="mb-1 flex items-baseline justify-between">
        <h1 className="text-base font-semibold">The record books</h1>
        <span className="text-[10px] uppercase tracking-widest text-neutral-600">Week {world.week}</span>
      </div>
      <p className="mb-3 text-[11px] text-neutral-500">
        Every promotion, living and dead, since week one.
      </p>

      <div className="mb-3 flex flex-wrap gap-1">
        {BOOKS.map((option) => (
          <button
            key={option.id}
            type="button"
            data-testid={`records-${option.id}`}
            onClick={() => setBook(option.id)}
            className={`rounded px-3 py-1 text-xs ${
              book === option.id ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {book === 'lineage' ? (
        <Lineages nameOf={nameOf} promotionName={promotionName} />
      ) : (
        sections.map((section) => (
          <section key={section.id} className="mb-4" data-testid={`record-${section.id}`}>
            <h2 className="border-b border-neutral-800 pb-1 text-[11px] uppercase tracking-widest text-neutral-400">
              {section.title}
            </h2>
            <p className="mb-1 mt-1 text-[10px] text-neutral-600">{section.blurb}</p>
            {section.entries.length === 0 ? (
              <p className="text-[11px] text-neutral-600">Nothing yet.</p>
            ) : (
              <ol className="flex flex-col gap-0.5">
                {section.entries.map((entry, i) => (
                  <li
                    key={`${entry.wrestlerIds.join('-')}-${i}`}
                    className="flex items-center gap-2 rounded bg-neutral-900 px-2 py-1.5"
                  >
                    <span className="w-4 shrink-0 text-right font-mono text-[10px] text-neutral-600">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs">{entry.wrestlerIds.map(nameOf).join(' & ')}</span>
                      {entry.detail && (
                        <span className="block truncate text-[10px] text-neutral-600">{entry.detail}</span>
                      )}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-amber-400">
                      {UNIT_LABEL[entry.unit](entry.value)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))
      )}
    </div>
  );
}

/**
 * Every belt, with its whole lineage behind it. This is the answer to "who
 * has held this and for how long" — collapsed by default because a thirty-year
 * save has a lot of reigns in it.
 */
function Lineages({
  nameOf,
  promotionName,
}: {
  nameOf: (id: Id) => string;
  promotionName: (id: Id) => string;
}) {
  const world = useGameStore((s) => s.world);
  const [openId, setOpenId] = useState<Id | null>(null);
  if (!world) return null;

  const records = titleRecords({
    wrestlers: Object.values(world.wrestlers),
    titles: world.titles,
    currentWeek: world.week,
    limit: 5,
  });

  return (
    <div className="flex flex-col gap-1">
      {records.map((record) => {
        const title = world.titles.find((t) => t.id === record.titleId);
        if (!title) return null;
        const open = openId === record.titleId;

        return (
          <section
            key={record.titleId}
            data-testid={`lineage-${record.titleId}`}
            className="rounded border border-neutral-800 bg-neutral-900"
          >
            <button
              type="button"
              onClick={() => setOpenId(open ? null : record.titleId)}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left"
            >
              <span
                className="h-3 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: title.colorway.plate }}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">{title.name}</span>
                <span className="block truncate text-[10px] text-neutral-500">
                  {promotionName(record.promotionId)} · {record.reigns} {record.reigns === 1 ? 'reign' : 'reigns'}
                  {record.currentHolderIds.length > 0 && (
                    <> · held by {record.currentHolderIds.map(nameOf).join(' & ')}</>
                  )}
                  {record.currentHolderIds.length === 0 && <> · vacant</>}
                </span>
              </span>
              <span className="shrink-0 text-neutral-600">{open ? '▾' : '▸'}</span>
            </button>

            {open && (
              <div className="border-t border-neutral-800 p-2">
                <dl className="mb-2 grid grid-cols-2 gap-1 text-[10px]">
                  {record.longest && (
                    <div>
                      <dt className="text-neutral-600">Longest reign</dt>
                      <dd className="truncate">
                        {record.longest.holderIds.map(nameOf).join(' & ')}
                        <span className="ml-1 text-amber-400">{record.longest.days.toLocaleString()}d</span>
                      </dd>
                    </div>
                  )}
                  {record.shortest && (
                    <div>
                      <dt className="text-neutral-600">Shortest reign</dt>
                      <dd className="truncate">
                        {record.shortest.holderIds.map(nameOf).join(' & ')}
                        <span className="ml-1 text-amber-400">{record.shortest.days.toLocaleString()}d</span>
                      </dd>
                    </div>
                  )}
                  {record.mostReigns && record.mostReigns.count > 1 && (
                    <div>
                      <dt className="text-neutral-600">Most reigns</dt>
                      <dd className="truncate">
                        {record.mostReigns.holderIds.map(nameOf).join(' & ')}
                        <span className="ml-1 text-amber-400">×{record.mostReigns.count}</span>
                      </dd>
                    </div>
                  )}
                </dl>

                {title.history.length === 0 ? (
                  <p className="text-[11px] text-neutral-600">Nobody has ever held it.</p>
                ) : (
                  <ol className="flex flex-col gap-0.5">
                    {[...title.history].reverse().map((entry, i) => (
                      <li
                        key={`${entry.startWeek}-${i}`}
                        className="flex items-baseline gap-2 rounded bg-neutral-950 px-2 py-1 text-[10px]"
                      >
                        <span className="w-5 shrink-0 text-right font-mono text-neutral-700">
                          {title.history.length - i}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {entry.holderIds.map(nameOf).join(' & ')}
                          {/* The company it happened in, not whoever owns the belt today. */}
                          <span className="ml-1 text-neutral-600">{promotionName(entry.promotionId)}</span>
                        </span>
                        <span className="shrink-0 text-neutral-500">
                          {reignDays(entry, world.week).toLocaleString()}d
                          {entry.endWeek === null && <span className="ml-1 text-emerald-500">current</span>}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
