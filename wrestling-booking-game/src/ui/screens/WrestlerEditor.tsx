// Repackage a wrestler: ring name, nickname, alignment, gender, and the one
// photo that represents them. See ui/paperdoll/README.md — there is no more
// generated look to edit here, just the real fields and a real portrait.
import { useState } from 'react';
import type { Id } from '../../engine/types';
import { useGameStore } from '../../state/store';
import { resizeToDataUrl } from '../paperdoll/photoUpload';
import { PaperDoll } from '../paperdoll/PaperDoll';
import { ScreenHeader } from '../components/ScreenHeader';

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`rounded px-2 py-1 text-xs ${selected ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}
    >
      {label}
    </button>
  );
}

/**
 * The editor, in two modes.
 *
 * With no `wrestlerId` it is a blank sandbox: nothing is saved. With one, it
 * is a repackage — the wrestler's real name and photo are loaded, everything
 * becomes editable, and Save writes it back through the store, which
 * enforces the same name-distinctness rule generation obeys and refuses the
 * change if the new name would read as somebody already in the business.
 */
export function WrestlerEditor({ wrestlerId, onDone }: { wrestlerId?: Id; onDone?: () => void } = {}) {
  const world = useGameStore((s) => s.world);
  const repackageWrestler = useGameStore((s) => s.repackageWrestler);
  const subject = wrestlerId ? world?.wrestlers[wrestlerId] : undefined;

  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>(subject?.photoDataUrl);
  const [ringName, setRingName] = useState(subject?.name ?? '');
  const [nickname, setNickname] = useState(subject?.nickname ?? '');
  const [rejected, setRejected] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  async function handlePhotoFile(file: File | null) {
    if (!file) return;
    try {
      setPhotoDataUrl(await resizeToDataUrl(file));
      setPhotoError(null);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'That file could not be used.');
    }
  }

  function save() {
    if (!subject) return;
    const result = repackageWrestler(subject.id, {
      name: ringName,
      nickname: nickname.trim() ? nickname.trim() : null,
      photoDataUrl: photoDataUrl ?? null,
    });
    if (!result.ok) {
      setRejected(result.reason);
      return;
    }
    setRejected(null);
    onDone?.();
  }

  return (
    <div className="min-h-screen bg-neutral-950 p-4 text-neutral-100">
      <ScreenHeader
        title={subject ? `Repackage ${subject.name}` : 'Wrestler Editor'}
        onBack={onDone ?? (() => {})}
        right={
          subject && (
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                data-testid="save-repackage"
                onClick={save}
                className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
              >
                Save
              </button>
            </div>
          )
        }
      />

      {subject && (
        <div className="mb-4 flex flex-col gap-2 rounded border border-neutral-800 p-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-300">Ring name</span>
            <input
              type="text"
              value={ringName}
              data-testid="ring-name"
              onChange={(e) => {
                setRingName(e.target.value);
                setRejected(null);
              }}
              className="rounded bg-neutral-900 px-2 py-1.5 text-sm outline-none ring-1 ring-neutral-800 focus:ring-emerald-600"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-300">Billed as</span>
            <input
              type="text"
              value={nickname}
              placeholder="No nickname"
              onChange={(e) => setNickname(e.target.value)}
              className="rounded bg-neutral-900 px-2 py-1.5 text-sm outline-none ring-1 ring-neutral-800 focus:ring-emerald-600"
            />
          </label>
          {rejected && (
            <p data-testid="repackage-rejected" className="text-xs text-rose-400">
              {rejected}
            </p>
          )}
          {subject.formerNames && subject.formerNames.length > 0 && (
            <p className="text-[11px] text-neutral-500">
              Previously {subject.formerNames.map((f) => f.name).join(', ')}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-6 md:flex-row">
        <div className="flex flex-col items-center gap-3 md:sticky md:top-4 md:h-fit">
          <PaperDoll photoDataUrl={photoDataUrl} name={ringName || subject?.name || 'New wrestler'} size="large" />
          <div className="flex gap-2">
            <label className="cursor-pointer rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-700">
              {photoDataUrl ? 'Replace photo' : 'Upload photo'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void handlePhotoFile(e.target.files?.[0] ?? null);
                  e.target.value = '';
                }}
              />
            </label>
            {photoDataUrl && (
              <Chip label="Remove photo" selected={false} onClick={() => setPhotoDataUrl(undefined)} />
            )}
          </div>
          {photoError && <p className="text-xs text-rose-400">{photoError}</p>}
          {!photoDataUrl && (
            <p className="max-w-48 text-center text-[11px] text-neutral-500">
              No photo yet — shown as a plain initials placeholder until one is uploaded.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
