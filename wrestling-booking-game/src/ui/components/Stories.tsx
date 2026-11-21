// The stories you are running.
//
// This is the board a booker actually works from. Each arc says where it is,
// what has happened in it, and what the crowd is waiting for — and none of
// that is a warning. It describes the state of the thing; the gap is the
// player's to read, exactly like the fan-demand board above it.
//
// The arcs advance from the card itself, so nothing on this screen is a
// second place to do the booking. It exists so that "I forgot about that
// feud for a month" is something you can see happening rather than something
// you discover when it dies.

import { useState } from 'react';
import { useGameStore } from '../../state/store';
import {
  isLive,
  readyToBlowOff,
  recap,
  standing,
  whatItNeeds,
  worthNaming,
  type Storyline,
} from '../../engine/world/storyline';
import { Panel, SectionHead } from './chrome';
import { HeatBadge } from './display';

/** How the stage should read at a glance. Colour, never a number. */
const STAGE_INK: Record<string, string> = {
  opening: 'text-neutral-400',
  building: 'text-sky-400',
  boiling: 'text-amber-400',
  blownOff: 'text-emerald-400',
  fizzled: 'text-rose-400',
};

function Arc({ story }: { story: Storyline }) {
  const world = useGameStore((s) => s.world)!;
  const rename = useGameStore((s) => s.renameStoryline);
  const abandon = useGameStore((s) => s.abandonStoryline);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(story.name);

  const names = story.participantIds
    .map((id) => world.wrestlers[id]?.name)
    .filter(Boolean)
    .join(' and ');
  const needs = whatItNeeds(story, world.week, world.settings);
  const ready = readyToBlowOff(story);
  const idle = world.week - story.lastAdvancedWeek;

  return (
    <Panel className={`p-2.5 ${ready ? 'border-amber-800' : ''}`} data-testid={`story-${story.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                rename(story.id, draft);
                setEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  rename(story.id, draft);
                  setEditing(false);
                }
              }}
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-1.5 py-1 text-sm font-semibold text-neutral-100"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraft(story.name);
                setEditing(true);
              }}
              className="truncate text-left text-sm font-semibold text-neutral-100"
              title="Rename"
            >
              {story.name}
            </button>
          )}
          <div className="truncate text-[11px] text-neutral-500">{names}</div>
        </div>
        <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wide ${STAGE_INK[story.stage]}`}>
          {standing(story)}
        </span>
      </div>

      <p className={`mt-1 text-[11px] leading-snug ${ready ? 'text-amber-300' : 'text-neutral-300'}`}>
        {needs}
      </p>

      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-neutral-600">
        <button type="button" onClick={() => setOpen((v) => !v)} className="underline">
          {open ? 'hide the story' : `the story so far (${story.beats.length})`}
        </button>
        <span>·</span>
        <span>{idle === 0 ? 'advanced this week' : `${idle}w since anything`}</span>
        <button
          type="button"
          onClick={() => abandon(story.id)}
          className="ml-auto text-neutral-600 hover:text-rose-400"
        >
          drop it
        </button>
      </div>

      {open && (
        <ol className="mt-1.5 flex flex-col gap-0.5 border-l-2 border-neutral-800 pl-2.5">
          {recap(story).map((line, i) => (
            <li key={i} className="text-[11px] leading-snug text-neutral-400">
              {line}
            </li>
          ))}
          {story.beats.length === 0 && (
            <li className="text-[11px] italic text-neutral-600">Not one thing has happened in this one yet.</li>
          )}
        </ol>
      )}
    </Panel>
  );
}

export function Stories() {
  const world = useGameStore((s) => s.world);
  const start = useGameStore((s) => s.startStoryline);
  const leanIn = useGameStore((s) => s.leanIntoShoot);
  const [note, setNote] = useState<string | null>(null);
  if (!world) return null;

  const live = world.storylines.filter(isLive);
  // Feuds hot enough that the office would have named them by now. This is a
  // suggestion, never a nag — most rivalries are just two people who keep
  // being booked against each other.
  const suggestions = world.rivalries
    .filter((r) => worthNaming(r, world.storylines, world.settings))
    .filter((r) => r.participantIds.every((id) => world.promotion.rosterIds.includes(id)))
    .sort((a, b) => b.heat - a.heat)
    .slice(0, 3);

  // Feuds that are not worked at all. The crowd cannot see this and the
  // booker can — the decision is whether to put it on television, which
  // makes the best match on the card out of the worst thing in the building.
  const realOnes = world.rivalries
    .filter((r) => r.resolvedWeek === null && r.shootHeat > world.settings.shootHeatWorthRunning)
    .filter((r) => r.participantIds.every((id) => world.promotion.rosterIds.includes(id)))
    .sort((a, b) => b.shootHeat - a.shootHeat)
    .slice(0, 2);

  if (live.length === 0 && suggestions.length === 0 && realOnes.length === 0) return null;

  return (
    <section className="mb-3">
      <SectionHead hint={live.length > 0 ? `${live.length} running` : undefined}>
        The stories
      </SectionHead>

      {note && <p className="mb-2 text-[11px] text-amber-300">{note}</p>}

      <div className="flex flex-col gap-2">
        {live.map((story) => (
          <Arc key={story.id} story={story} />
        ))}

        {realOnes.map((rivalry) => {
          const names = rivalry.participantIds
            .map((id) => world.wrestlers[id]?.name)
            .filter(Boolean)
            .join(' and ');
          return (
            <button
              key={`shoot-${rivalry.id}`}
              type="button"
              data-testid={`lean-in-${rivalry.id}`}
              onClick={() => {
                const result = leanIn(rivalry.id);
                setNote(
                  result.ok
                    ? `${names} is live on television now, exactly as it really is.`
                    : result.reason,
                );
              }}
              className="rounded-lg border border-dashed border-rose-900 p-2.5 text-left transition hover:border-rose-600"
            >
              <div className="text-sm font-semibold text-neutral-200">{names}</div>
              <div className="mt-1">
                <HeatBadge heat={rivalry.heat} shootHeat={rivalry.shootHeat} />
              </div>
              <p className="mt-1 text-[11px] leading-snug text-neutral-500">
                This one is not worked — it is genuinely real. Put a camera on it and the crowd gets the actual
                thing, which draws serious money and settles absolutely nothing down.
              </p>
              <span className="mt-1 inline-block text-[10px] font-semibold uppercase tracking-wide text-rose-400">
                Run it as an angle
              </span>
            </button>
          );
        })}

        {suggestions.map((rivalry) => {
          const names = rivalry.participantIds
            .map((id) => world.wrestlers[id]?.name)
            .filter(Boolean)
            .join(' and ');
          return (
            <button
              key={rivalry.id}
              type="button"
              data-testid={`name-it-${rivalry.id}`}
              onClick={() => {
                const result = start(rivalry.participantIds);
                setNote(result.ok ? `${names} is officially a story now. Go tell it.` : result.reason);
              }}
              className="rounded-lg border border-dashed border-neutral-700 p-2.5 text-left transition hover:border-sky-700"
            >
              <div className="text-sm font-semibold text-neutral-200">{names}</div>
              <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">
                The crowd has already decided these two genuinely do not like each other. Nobody in the office has
                given it a name yet.
              </p>
              <span className="mt-1 inline-block text-[10px] font-semibold uppercase tracking-wide text-sky-400">
                Make it a story
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
