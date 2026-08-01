// Contact-sheet page rendering 100 generated wrestlers — the M1 definition
// of done (§23: "A contact-sheet page rendering 100 generated wrestlers").
import { useMemo, useState } from 'react';
import { rngFromSeed } from '../../engine/rng';
import { generateWrestlers } from '../../engine/generate/wrestler';
import { PaperDoll } from '../paperdoll/PaperDoll';

const ROSTER_SIZE = 100;

function randomSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function ContactSheet() {
  const [seed, setSeed] = useState('contact-sheet');

  const wrestlers = useMemo(() => {
    const rng = rngFromSeed(seed);
    return generateWrestlers(rng, ROSTER_SIZE);
  }, [seed]);

  return (
    <div className="min-h-screen bg-neutral-950 p-4 text-neutral-100">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Contact Sheet — {wrestlers.length} wrestlers</h1>
          <p className="text-xs text-neutral-400">seed: {seed}</p>
        </div>
        <button
          type="button"
          onClick={() => setSeed(randomSeed())}
          className="rounded bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
        >
          Regenerate
        </button>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
        {wrestlers.map((w) => (
          <div key={w.id} className="flex flex-col items-center gap-1 rounded bg-neutral-900 p-2 text-center">
            <PaperDoll appearance={w.appearance} alignment={w.alignment} size="bust" />
            <span className="w-full truncate text-[11px] leading-tight">{w.name}</span>
            <span className="text-[10px] text-neutral-500">
              {w.archetype} · {w.style}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
