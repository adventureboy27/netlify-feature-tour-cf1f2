// A breaking-news story's own page — reached by tapping a card under
// "Breaking — Sunday Night News" on the results screen. See
// engine/world/wire.ts for what a WireItem carries (kind/text/week/weight,
// plus the id this screen is keyed on) and ShowResults.tsx's BreakingNews()
// for where the tap originates.
//
// The wire's own copy is already a complete, specific sentence — CLAUDE.md's
// house style is "nothing happens off-screen, and says how" — so this page's
// job is presentation and space, not re-deriving facts nothing else tracks.
// The one thing worth adding is the cross-link: if this story shares its
// exact text with a beat on a live Storyline (the same string is handed to
// both the wire push and advance() at the point of origin — see
// state/store.ts's fan-rivalry and group-turn wiring), this page can point
// at the ongoing feud behind it.

import { useGameStore } from '../../state/store';
import { ScreenHeader } from '../components/ScreenHeader';
import { Panel, SectionHead } from '../components/chrome';
import { WIRE_KIND_LABELS } from '../../engine/world/wire';
import { weekLine } from '../../engine/world/calendar';
import { billedAs } from '../../engine/generate/nickname';
import type { Id } from '../../engine/types';

const STAGE_LABEL: Record<string, string> = {
  opening: 'Just starting',
  building: 'Building',
  boiling: 'Red hot',
  blownOff: 'Settled',
  fizzled: 'Fizzled out',
};

export function NewsStoryScreen({
  storyId,
  onBack,
  onOpenWrestler,
}: {
  storyId: string;
  onBack: () => void;
  /** Jump to one of the story's participants — see WrestlerFeudsScreen. */
  onOpenWrestler?: (wrestlerId: Id) => void;
}) {
  const world = useGameStore((s) => s.world);
  if (!world) return null;

  const item = world.weeklyNews.find((n) => n.id === storyId);
  if (!item) {
    return (
      <div className="p-3 pb-6 text-neutral-100">
        <ScreenHeader title="Story" onBack={onBack} />
        <Panel className="p-4 text-sm text-neutral-400">
          This one isn't on file anymore — the paper only keeps so much on the desk.
        </Panel>
      </div>
    );
  }

  // Best-effort cross-link, not required for the page to make sense on its
  // own: a live storyline that shares this exact headline as one of its
  // beats is the ongoing feud this news came out of.
  const relatedStory = world.storylines.find((s) => s.beats.some((b) => b.text === item.text));

  return (
    <div className="p-3 pb-6 text-neutral-100">
      <ScreenHeader title={WIRE_KIND_LABELS[item.kind]} subtitle={weekLine(item.week, world.settings)} onBack={onBack} />

      <Panel elevation="hero" className="overflow-hidden border-rose-800/70 bg-gradient-to-b from-rose-950/40 to-neutral-900">
        <div className="p-4">
          <div className="mb-2 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-rose-500" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-400">
              Breaking — Sunday Night News
            </span>
          </div>
          <p className="text-lg leading-snug text-rose-50">{item.text}</p>
        </div>
      </Panel>

      {relatedStory && (
        <section className="mt-3">
          <SectionHead>Part of an ongoing story</SectionHead>
          <Panel className="p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-neutral-100">{relatedStory.name}</span>
              <span className="text-[11px] uppercase tracking-wide text-neutral-500">
                {STAGE_LABEL[relatedStory.stage] ?? relatedStory.stage}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {relatedStory.participantIds.map((id) => {
                const w = world.wrestlers[id];
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={!onOpenWrestler || !w}
                    onClick={() => w && onOpenWrestler?.(id)}
                    className="rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1 text-xs text-neutral-300 transition enabled:hover:border-neutral-700 enabled:hover:text-neutral-100 disabled:opacity-60"
                  >
                    {w ? billedAs(w) : 'Someone no longer on file'}
                  </button>
                );
              })}
            </div>
          </Panel>
        </section>
      )}
    </div>
  );
}
