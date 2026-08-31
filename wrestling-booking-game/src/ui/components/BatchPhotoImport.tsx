// Attaching real photos to a whole handful of wrestlers at once — the
// single-file path already lives in WrestlerEditor (one photo, one
// wrestler, right there in the editor); this is the other one, for
// somebody who has a folder of real photos and a roster to match them to.
//
// Every match is a suggestion, never a decision. A filename that reads as
// one wrestler's name pre-selects that row, but nothing is written until
// the booker hits Apply, and every row shows exactly who it is about to
// land on — name and gender both — so a batch never quietly puts the wrong
// photo on the wrong person.

import { useState } from 'react';
import { useGameStore } from '../../state/store';
import { resizeToDataUrl } from '../paperdoll/photoUpload';
import { PaperDoll } from '../paperdoll/PaperDoll';
import type { Id, Wrestler } from '../../engine/types';

interface Row {
  key: string;
  fileName: string;
  previewUrl: string | null;
  error: string | null;
  wrestlerId: Id | '';
  suggested: boolean;
}

/** Strip the extension, fold separators to spaces, drop anything that isn't a letter or digit. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
}

/** Exactly one confident match, or none at all — this never guesses between two candidates. */
function suggestMatch(fileName: string, roster: readonly Wrestler[]): Id | null {
  const norm = normalize(fileName);
  if (!norm) return null;
  const candidates = roster.filter((w) => {
    const wn = normalize(w.name);
    return wn.length > 0 && (wn === norm || norm.includes(wn) || wn.includes(norm));
  });
  return candidates.length === 1 ? candidates[0]!.id : null;
}

const GENDER_LABEL: Record<Wrestler['gender'], string> = { m: 'M', f: 'F' };

export function BatchPhotoImport() {
  const world = useGameStore((s) => s.world);
  const setWrestlerPhoto = useGameStore((s) => s.setWrestlerPhoto);
  const [rows, setRows] = useState<Row[]>([]);
  const [result, setResult] = useState<string | null>(null);

  if (!world) return null;

  const roster = world.promotion.rosterIds
    .map((id) => world.wrestlers[id])
    .filter((w): w is Wrestler => Boolean(w))
    .sort((a, b) => a.name.localeCompare(b.name));

  async function handleFiles(files: FileList) {
    setResult(null);
    const picked = Array.from(files);
    const newRows: Row[] = picked.map((file, i) => ({
      key: `${Date.now()}-${i}-${file.name}`,
      fileName: file.name,
      previewUrl: null,
      error: null,
      wrestlerId: suggestMatch(file.name, roster) ?? '',
      suggested: suggestMatch(file.name, roster) !== null,
    }));
    setRows((prev) => [...prev, ...newRows]);

    await Promise.all(
      picked.map(async (file, i) => {
        const key = newRows[i]!.key;
        try {
          const dataUrl = await resizeToDataUrl(file);
          setRows((prev) => prev.map((r) => (r.key === key ? { ...r, previewUrl: dataUrl } : r)));
        } catch (err) {
          const message = err instanceof Error ? err.message : 'That file could not be used.';
          setRows((prev) => prev.map((r) => (r.key === key ? { ...r, error: message } : r)));
        }
      }),
    );
  }

  function setRowWrestler(key: string, wrestlerId: Id | '') {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, wrestlerId, suggested: false } : r)));
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function clearAll() {
    setRows([]);
    setResult(null);
  }

  // Picking the same wrestler twice in one batch is never blocked — maybe
  // the first was a bad photo — but it is always shown, so the one that
  // silently loses is a choice the booker made on purpose.
  const countByWrestler = new Map<Id, number>();
  for (const r of rows) {
    if (r.wrestlerId) countByWrestler.set(r.wrestlerId, (countByWrestler.get(r.wrestlerId) ?? 0) + 1);
  }

  const ready = rows.filter((r) => r.previewUrl && r.wrestlerId);

  function apply() {
    let applied = 0;
    for (const r of rows) {
      if (r.previewUrl && r.wrestlerId) {
        setWrestlerPhoto(r.wrestlerId, r.previewUrl);
        applied++;
      }
    }
    const skipped = rows.length - applied;
    setResult(
      `${applied} photo${applied === 1 ? '' : 's'} applied.` +
        (skipped > 0 ? ` ${skipped} left with no wrestler picked — nothing happened to those.` : ''),
    );
    setRows([]);
  }

  return (
    <div>
      <p className="mb-2 text-[11px] text-neutral-500">
        Pick as many photos at once as you like. Each one gets a best-guess match from its filename — nothing is
        saved until you hit Apply, and every row shows exactly who it is about to land on before it does.
      </p>

      <label className="mb-2 inline-block cursor-pointer rounded bg-neutral-800 px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-700">
        Add photos
        <input
          type="file"
          accept="image/*"
          multiple
          data-testid="batch-photo-input"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </label>

      {rows.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5" data-testid="batch-photo-rows">
          {rows.map((row) => {
            const chosen = row.wrestlerId ? world.wrestlers[row.wrestlerId] : undefined;
            const duplicated = row.wrestlerId ? (countByWrestler.get(row.wrestlerId) ?? 0) > 1 : false;
            return (
              <div
                key={row.key}
                data-testid={`batch-photo-row-${row.key}`}
                className="flex items-center gap-2 rounded border border-neutral-800 bg-neutral-900 p-2"
              >
                {row.previewUrl ? (
                  <PaperDoll photoDataUrl={row.previewUrl} name={row.fileName} size="thumb" />
                ) : row.error ? (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-rose-950 text-[9px] text-rose-400">
                    failed
                  </div>
                ) : (
                  <div className="flex h-12 w-12 shrink-0 animate-pulse items-center justify-center rounded bg-neutral-800 text-[9px] text-neutral-600">
                    …
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] text-neutral-500">{row.fileName}</div>
                  {row.error ? (
                    <p className="text-[11px] text-rose-400">{row.error}</p>
                  ) : (
                    <select
                      data-testid={`batch-photo-select-${row.key}`}
                      value={row.wrestlerId}
                      onChange={(e) => setRowWrestler(row.key, e.target.value)}
                      className="mt-0.5 w-full rounded border border-neutral-800 bg-neutral-950 px-1.5 py-1 text-xs text-neutral-200"
                    >
                      <option value="">Nobody — skip this one</option>
                      {roster.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} — {GENDER_LABEL[w.gender]}
                        </option>
                      ))}
                    </select>
                  )}
                  {chosen && (
                    <p className="mt-0.5 text-[10px] text-neutral-500">
                      {row.suggested ? 'Guessed from the filename — ' : ''}
                      going on <span className="text-neutral-300">{chosen.name}</span>, listed{' '}
                      {GENDER_LABEL[chosen.gender]}.
                      {duplicated && (
                        <span className="ml-1 text-amber-400">Another row in this batch also picked them.</span>
                      )}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => removeRow(row.key)}
                  className="shrink-0 rounded px-2 py-1 text-[11px] text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
                >
                  Remove
                </button>
              </div>
            );
          })}

          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              data-testid="batch-photo-apply"
              disabled={ready.length === 0}
              onClick={apply}
              className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Apply {ready.length} photo{ready.length === 1 ? '' : 's'}
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="rounded bg-neutral-800 px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-700"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {result && (
        <p className="mt-2 text-[11px] text-emerald-400" data-testid="batch-photo-result">
          {result}
        </p>
      )}
    </div>
  );
}
