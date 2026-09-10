// One wrestler's whole feud history — current feuds first and foremost,
// past ones below, each with the shape of how it actually went: built,
// boiled, and paid off, or quietly died of neglect.
//
// Nothing here is a second place to book anything. It reads back what the
// booking screen's own Stories board already produced, plus the two things
// that board has no room for: a pairing's own fixed chemistry (some just
// click, some never do — see engine/sim/pairChemistry.ts) and what a real
// shared history is actually worth, in words, not a score.

import { useState } from 'react';
import { useGameStore } from '../../state/store';
import { ScreenHeader } from '../components/ScreenHeader';
import { Panel, SectionHead, Badge } from '../components/chrome';
import { Select } from '../components/Select';
import { Money } from '../components/display';
import {
  allStorylinesFor,
  isLive,
  standing,
  storylineBetween,
  whatItNeeds,
  type Storyline,
} from '../../engine/world/storyline';
import { BEAT_WEIGHTS } from '../../data/storylineBeats';
import {
  chemistryLabel,
  innateChemistry,
  legendStatus,
  pastBlowoffs,
} from '../../engine/sim/pairChemistry';
import { billedAs } from '../../engine/generate/nickname';
import type { Id, Show, WorldSettings } from '../../engine/types';

const STAGE_INK: Record<Storyline['stage'], string> = {
  opening: 'text-neutral-400',
  building: 'text-sky-400',
  boiling: 'text-amber-400',
  blownOff: 'text-emerald-400',
  fizzled: 'text-rose-400',
};

/** How many people the crowd could be forgiven for not remembering — the beat-kind legend. */
const BEAT_DOT: Record<string, { glyph: string; className: string }> = {
  match: { glyph: '●', className: 'text-neutral-300' },
  promo: { glyph: '○', className: 'text-neutral-500' },
  confrontation: { glyph: '◆', className: 'text-sky-400' },
  interference: { glyph: '▲', className: 'text-amber-400' },
  injury: { glyph: '✚', className: 'text-rose-400' },
  titleMatch: { glyph: '★', className: 'text-amber-300' },
};

/**
 * The shape of an arc, left to right: a track showing how far it got against
 * the thresholds that actually move a story, with a dot for every beat along
 * the way. Never a number — the shape is the point.
 */
function FeudTimeline({ story, settings }: { story: Storyline; settings: WorldSettings }) {
  const buildAt = settings.storylineBuildingInvestment;
  const boilAt = settings.storylineBoilingInvestment;
  const span = boilAt * 1.3; // room past "boiling" for a story that sat there a while

  let running = 0;
  const marks = story.beats.map((beat) => {
    running += BEAT_WEIGHTS[beat.kind] ?? 0;
    return { pct: Math.min(100, (running / span) * 100), beat };
  });
  const filledPct = Math.min(100, (running / span) * 100);
  const buildPct = Math.min(100, (buildAt / span) * 100);
  const boilPct = Math.min(100, (boilAt / span) * 100);

  const fillColor =
    story.stage === 'blownOff'
      ? 'bg-emerald-500'
      : story.stage === 'fizzled'
        ? 'bg-rose-900'
        : story.stage === 'boiling'
          ? 'bg-amber-500'
          : story.stage === 'building'
            ? 'bg-sky-500'
            : 'bg-neutral-600';

  return (
    <div className="mt-2">
      <div className="relative h-2 rounded-full bg-neutral-800">
        {/* Zone dividers — where "building" and "boiling" actually kick in. */}
        <div className="absolute inset-y-0 w-px bg-neutral-700" style={{ left: `${buildPct}%` }} />
        <div className="absolute inset-y-0 w-px bg-neutral-700" style={{ left: `${boilPct}%` }} />
        <div className={`absolute inset-y-0 left-0 rounded-full ${fillColor}`} style={{ width: `${filledPct}%` }} />
        {marks.map((m, i) => {
          const dot = BEAT_DOT[m.beat.kind] ?? BEAT_DOT.match!;
          return (
            <span
              key={i}
              title={m.beat.text}
              className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-[9px] leading-none ${dot.className}`}
              style={{ left: `${m.pct}%` }}
            >
              {dot.glyph}
            </span>
          );
        })}
      </div>
      <div className="mt-0.5 flex justify-between text-[9px] uppercase tracking-wide text-neutral-700">
        <span>Opening</span>
        <span style={{ marginLeft: `${buildPct - 8}%` }}>Building</span>
        <span>Boiling</span>
      </div>
    </div>
  );
}

/** Real, attributable numbers about the nights these two actually shared a card — never a fabricated one. */
function sharedNightsSummary(shows: readonly Show[], participantIds: readonly Id[], fromWeek: number, toWeek: number) {
  let matches = 0;
  let starsTotal = 0;
  let bestStars = 0;
  let gateTotal = 0;
  for (const show of shows) {
    if (show.week < fromWeek || show.week > toWeek) continue;
    let onThisShow = false;
    for (const segment of show.segments) {
      if (segment.kind !== 'match' || !segment.result) continue;
      const sides = new Set(
        segment.participants.filter((p) => p.role === 'competitor').map((p) => `${p.wrestlerId}:${p.side}`),
      );
      const present = participantIds.filter((id) =>
        segment.participants.some((p) => p.role === 'competitor' && p.wrestlerId === id),
      );
      const onOpposingSides =
        present.length >= 2 &&
        new Set(
          segment.participants
            .filter((p) => p.role === 'competitor' && participantIds.includes(p.wrestlerId))
            .map((p) => p.side),
        ).size >= 2;
      if (!onOpposingSides) continue;
      void sides;
      matches += 1;
      starsTotal += segment.result.stars;
      bestStars = Math.max(bestStars, segment.result.stars);
      onThisShow = true;
    }
    if (onThisShow) gateTotal += show.gate;
  }
  return { matches, avgStars: matches > 0 ? starsTotal / matches : 0, bestStars, gateTotal };
}

function LegendBadge({ status }: { status: 'none' | 'notable' | 'allTime' }) {
  if (status === 'allTime') return <Badge tone="warning">All-time rivalry</Badge>;
  if (status === 'notable') return <Badge tone="info">Hall of Fame classic</Badge>;
  return null;
}

function FeudCard({
  story,
  wrestlerId,
  onNavigateWrestler,
}: {
  story: Storyline;
  wrestlerId: Id;
  onNavigateWrestler: (id: Id) => void;
}) {
  const world = useGameStore((s) => s.world)!;
  const live = isLive(story);
  const opponents = story.participantIds.filter((id) => id !== wrestlerId);
  const opponentNames = opponents
    .map((id) => world.wrestlers[id])
    .filter((w): w is NonNullable<typeof w> => Boolean(w));

  const chem = innateChemistry(story.participantIds, world.settings);
  const history = pastBlowoffs(world.storylines, story.participantIds);
  const legend = legendStatus(history, world.settings);

  const summary = !live
    ? sharedNightsSummary(world.showHistory, story.participantIds, story.startWeek, story.resolvedWeek ?? world.week)
    : null;

  return (
    <Panel className="p-3" data-testid={`feud-${story.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-neutral-100">{story.name}</div>
          <div className="text-[11px] text-neutral-500">
            vs.{' '}
            {opponentNames.map((w, i) => (
              <span key={w.id}>
                {i > 0 && ', '}
                <button type="button" onClick={() => onNavigateWrestler(w.id)} className="underline hover:text-neutral-300">
                  {billedAs(w)}
                </button>
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {!live && <LegendBadge status={legend} />}
          <span className={`text-[10px] font-bold uppercase tracking-wide ${STAGE_INK[story.stage]}`}>
            {standing(story)}
          </span>
        </div>
      </div>

      <FeudTimeline story={story} settings={world.settings} />

      {live ? (
        <p className="mt-2 text-[11px] leading-snug text-neutral-300">{whatItNeeds(story, world.week, world.settings)}</p>
      ) : (
        <p className="mt-2 text-[11px] leading-snug text-neutral-300">{story.payoff}</p>
      )}

      <p className="mt-1 text-[11px] italic text-neutral-500">{chemistryLabel(chem, world.settings)}</p>

      {summary && summary.matches > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-neutral-800 pt-2 text-[10px] text-neutral-500">
          <span>
            <span className="text-neutral-300">{summary.matches}</span> {summary.matches === 1 ? 'match' : 'matches'}{' '}
            together
          </span>
          <span>
            best <span className="text-amber-400">{summary.bestStars.toFixed(2)}★</span>
          </span>
          <span>
            avg <span className="text-neutral-300">{summary.avgStars.toFixed(2)}★</span>
          </span>
          <span>
            gate on those nights <Money amount={summary.gateTotal} />
          </span>
        </div>
      )}
    </Panel>
  );
}

/**
 * The manual case — a booker who wants to name a story before the crowd has
 * decided one for them. Only offered for your own roster, against your own
 * roster, since starting one is a booking decision, not a scouting note.
 * `startStoryline` itself already refuses a pair already telling a story.
 */
function StartStoryPanel({ wrestlerId }: { wrestlerId: Id }) {
  const world = useGameStore((s) => s.world)!;
  const startStoryline = useGameStore((s) => s.startStoryline);
  const [opponentId, setOpponentId] = useState<Id | ''>('');
  const [note, setNote] = useState<string | null>(null);

  const candidates = world.promotion.rosterIds
    .map((id) => world.wrestlers[id])
    .filter((w): w is NonNullable<typeof w> => w !== undefined && w.id !== wrestlerId)
    .filter((w) => !storylineBetween(world.storylines, [wrestlerId, w.id]))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (candidates.length === 0) return null;

  return (
    <div className="mt-3 rounded border border-dashed border-neutral-700 p-2.5">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
        Start a story
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Select
          value={opponentId}
          onChange={(v) => setOpponentId(v as Id | '')}
          placeholder="Pick an opponent…"
          className="w-48"
          options={candidates.map((w) => ({ value: w.id, label: billedAs(w) }))}
        />
        <button
          type="button"
          data-testid={`start-story-${wrestlerId}`}
          disabled={!opponentId}
          onClick={() => {
            if (!opponentId) return;
            const result = startStoryline([wrestlerId, opponentId]);
            setNote(result.ok ? 'Story started. Go tell it.' : result.reason);
            if (result.ok) setOpponentId('');
          }}
          className="rounded bg-neutral-800 px-2 py-1 text-[11px] text-neutral-300 enabled:hover:bg-neutral-700 disabled:opacity-40"
        >
          Start it
        </button>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-neutral-500">
        A story needs several matches and promos to mean anything — this just gives it a name to build toward.
      </p>
      {note && <p className="mt-1 text-[11px] text-amber-300">{note}</p>}
    </div>
  );
}

export function WrestlerFeudsScreen({
  wrestlerId,
  onBack,
  onNavigateWrestler,
}: {
  wrestlerId: Id;
  onBack: () => void;
  onNavigateWrestler: (id: Id) => void;
}) {
  const world = useGameStore((s) => s.world);
  if (!world) return null;
  const w = world.wrestlers[wrestlerId];
  if (!w) {
    return (
      <div className="p-6 text-neutral-100">
        <ScreenHeader title="Not found" onBack={onBack} />
        <p className="text-sm text-neutral-500">This wrestler is no longer on file.</p>
      </div>
    );
  }

  const stories = allStorylinesFor(world.storylines, wrestlerId);
  const current = stories.filter(isLive);
  const past = stories.filter((s) => !isLive(s));

  return (
    <div className="p-6 text-neutral-100">
      <ScreenHeader title={`${billedAs(w)} — feuds`} onBack={onBack} />

      {stories.length === 0 ? (
        <p className="max-w-xl text-sm text-neutral-500">
          Nobody in the office has ever named a story for {billedAs(w)}. A feud starts once a rivalry has real heat
          behind it — a match alone never does it.
        </p>
      ) : (
        <div className="max-w-2xl">
          <SectionHead hint={current.length > 0 ? `${current.length} running` : undefined}>
            Current feuds
          </SectionHead>
          {current.length === 0 ? (
            <p className="text-[11px] text-neutral-600">Nothing running right now.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {current.map((story) => (
                <FeudCard key={story.id} story={story} wrestlerId={wrestlerId} onNavigateWrestler={onNavigateWrestler} />
              ))}
            </div>
          )}

          {world.promotion.rosterIds.includes(wrestlerId) && <StartStoryPanel wrestlerId={wrestlerId} />}

          <SectionHead hint={past.length > 0 ? `${past.length} settled` : undefined}>Past feuds</SectionHead>
          {past.length === 0 ? (
            <p className="text-[11px] text-neutral-600">Nothing settled yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {past.map((story) => (
                <FeudCard key={story.id} story={story} wrestlerId={wrestlerId} onNavigateWrestler={onNavigateWrestler} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
