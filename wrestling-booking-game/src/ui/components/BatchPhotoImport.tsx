// Attaching real photos to a whole handful of wrestlers at once — the
// single-file path already lives in WrestlerEditor (one photo, one
// wrestler, right there in the editor); this is the other one, for
// somebody who has a folder of real photos and a roster to match them to.
//
// Gender is never guessed, from a filename or from anything else. The file
// has to declare it: M-<name> or F-<name>, e.g. "M-Doomsday.png" or
// "F-Wren Stillwater.jpg" — any number of words in the name, spaces or
// underscores both fine. A file with no valid prefix gets no match and
// cannot be applied, full stop, until it's renamed. Once the gender is
// declared, matching against the roster is exact-name-within-that-gender —
// never a fuzzy substring guess between two similarly named people — and
// the picker for that row is filtered to the declared gender too, so even
// a manual override cannot cross genders.

import { useState } from 'react';
import { useGameStore } from '../../state/store';
import { resizeToDataUrl } from '../paperdoll/photoUpload';
import { PaperDoll } from '../paperdoll/PaperDoll';
import { Select } from './Select';
import type { Id, Wrestler } from '../../engine/types';

interface Row {
  key: string;
  fileName: string;
  previewUrl: string | null;
  loadError: string | null;
  declaredGender: Wrestler['gender'] | null;
  wrestlerId: Id | '';
  suggested: boolean;
}

const GENDER_LABEL: Record<Wrestler['gender'], string> = { m: 'M', f: 'F' };
const NAMING_HELP = 'Name the file starting with M- or F- (e.g. "M-Doomsday.png") — gender is never guessed.';

/** Strip the extension, fold separators to spaces, drop anything that isn't a letter or digit. */
function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
}

/** Pulls the declared gender and the name off the front of a filename. Null gender means it wasn't declared — never inferred. */
function parseFileName(fileName: string): { gender: Wrestler['gender'] | null; name: string } {
  const stem = fileName.replace(/\.[a-z0-9]+$/i, '');
  const match = stem.match(/^([mf])-(.+)$/i);
  if (!match) return { gender: null, name: stem };
  return { gender: match[1]!.toLowerCase() as Wrestler['gender'], name: match[2]! };
}

/** Exactly one exact-name match within the declared gender, or none — never a fuzzy guess, never across genders. */
function matchForFile(fileName: string, roster: readonly Wrestler[]): { gender: Wrestler['gender'] | null; wrestlerId: Id | '' } {
  const { gender, name } = parseFileName(fileName);
  if (!gender) return { gender: null, wrestlerId: '' };
  const norm = normalizeName(name);
  if (!norm) return { gender, wrestlerId: '' };
  const candidates = roster.filter((w) => w.gender === gender && normalizeName(w.name) === norm);
  return { gender, wrestlerId: candidates.length === 1 ? candidates[0]!.id : '' };
}

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
    const newRows: Row[] = picked.map((file, i) => {
      const { gender, wrestlerId } = matchForFile(file.name, roster);
      return {
        key: `${Date.now()}-${i}-${file.name}`,
        fileName: file.name,
        previewUrl: null,
        loadError: null,
        declaredGender: gender,
        wrestlerId,
        suggested: wrestlerId !== '',
      };
    });
    setRows((prev) => [...prev, ...newRows]);

    await Promise.all(
      picked.map(async (file, i) => {
        const key = newRows[i]!.key;
        try {
          const dataUrl = await resizeToDataUrl(file);
          setRows((prev) => prev.map((r) => (r.key === key ? { ...r, previewUrl: dataUrl } : r)));
        } catch (err) {
          const message = err instanceof Error ? err.message : 'That file could not be used.';
          setRows((prev) => prev.map((r) => (r.key === key ? { ...r, loadError: message } : r)));
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

  const ready = rows.filter((r) => r.previewUrl && r.wrestlerId && r.declaredGender);

  function apply() {
    let applied = 0;
    for (const r of rows) {
      if (r.previewUrl && r.wrestlerId && r.declaredGender) {
        setWrestlerPhoto(r.wrestlerId, r.previewUrl);
        applied++;
      }
    }
    const skipped = rows.length - applied;
    setResult(
      `${applied} photo${applied === 1 ? '' : 's'} applied.` +
        (skipped > 0 ? ` ${skipped} left unmatched — nothing happened to those.` : ''),
    );
    setRows([]);
  }

  return (
    <div>
      <p className="mb-2 text-[11px] text-neutral-500">
        Pick as many photos at once as you like. Name each file starting with <span className="text-neutral-300">M-</span> or{' '}
        <span className="text-neutral-300">F-</span> and then the wrestler's name — e.g.{' '}
        <span className="text-neutral-300">M-Doomsday.png</span> or{' '}
        <span className="text-neutral-300">F-Wren Stillwater.jpg</span>. Gender is never guessed: a file with no
        prefix gets no match. Nothing is saved until you hit Apply, and every row shows exactly who it is about to
        land on before it does.
      </p>
      <p className="mb-2 text-[11px] text-neutral-500">
        Any common image format works — JPEG, PNG, WebP, GIF, and so on — at whatever size and shape the photo
        already is. No cropping or resizing needed first: each one is centred, cropped to a square, and scaled
        down to a small 96×96 thumbnail automatically. There's no file size limit on this end.
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
                ) : row.loadError ? (
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
                  {row.loadError ? (
                    <p className="text-[11px] text-rose-400">{row.loadError}</p>
                  ) : !row.declaredGender ? (
                    <p className="text-[11px] text-amber-400">{NAMING_HELP}</p>
                  ) : (
                    <Select
                      testId={`batch-photo-select-${row.key}`}
                      value={row.wrestlerId}
                      onChange={(v) => setRowWrestler(row.key, v)}
                      placeholder="Nobody — skip this one"
                      className="mt-0.5 w-full"
                      options={roster
                        .filter((w) => w.gender === row.declaredGender)
                        .map((w) => ({ value: w.id, label: `${w.name} — ${GENDER_LABEL[w.gender]}` }))}
                    />
                  )}
                  {chosen && (
                    <p className="mt-0.5 text-[10px] text-neutral-500">
                      {row.suggested ? 'Matched from the filename — ' : ''}
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
