// Watch a decided match back — the sketch was two commentators trading live
// lines in a chat feed along the bottom third, and a ring up top where
// portraits hold poses (never animating their own shape) that get moved,
// rotated, and collided to mimic what happened, with comic-style callouts.
//
// Nothing here decides anything. `world.showHistory` already has the result;
// this only stages it. See `engine/sim/matchPlayback.ts` for the beat-to-pose
// derivation and the honest limits on how closely it can track `commentary.ts`'s
// own line-by-line pacing (thematic sync, not line-for-line — read that
// file's top comment before changing the pacing here).

import { useEffect, useState } from 'react';
import { useGameStore } from '../../state/store';
import { buildPlaybackTimeline, finishCallout, type PlaybackBeat } from '../../engine/sim/matchPlayback';
import { PaperDoll } from '../paperdoll/PaperDoll';
import { ScreenHeader } from '../components/ScreenHeader';
import { Panel, promotionTheme } from '../components/chrome';
import { stipulationById } from '../../data/stipulations';
import type { Id, SegmentResult, SegmentRole, Wrestler } from '../../engine/types';

/** How long one beat's pose holds before the next one plays. */
const BEAT_PACE_MS = 1400;
/** Never show more than this many portraits on the rail — beyond it, a "+N more" chip stands in. */
const MAX_VISIBLE = 12;

/** The same reduction `commentary.ts` uses for a multi-man match: the eventual winners are one corner, everyone else is the other. A draw falls back to the two sides as booked. */
function deriveSides(
  competitors: SegmentRole[],
  result: SegmentResult,
  wrestlers: Record<Id, Wrestler | undefined>,
): { sideA: Wrestler[]; sideB: Wrestler[]; winningSide: 'a' | 'b' | null } {
  const resolve = (ids: Id[]) => ids.map((id) => wrestlers[id]).filter((w): w is Wrestler => Boolean(w));

  if (result.winnerSide !== null && result.winnerWrestlerIds.length > 0) {
    const winnerIds = new Set(result.winnerWrestlerIds);
    const sideA = resolve(competitors.filter((p) => winnerIds.has(p.wrestlerId)).map((p) => p.wrestlerId));
    const sideB = resolve(competitors.filter((p) => !winnerIds.has(p.wrestlerId)).map((p) => p.wrestlerId));
    return { sideA, sideB, winningSide: 'a' };
  }

  // A draw or no-contest — no winner group to build a corner from.
  const sideNumbers = [...new Set(competitors.map((p) => p.side))].filter((s) => s >= 0).sort((a, b) => a - b);
  const sideA = resolve(competitors.filter((p) => p.side === sideNumbers[0]).map((p) => p.wrestlerId));
  const sideB = resolve(
    competitors.filter((p) => p.side === (sideNumbers[1] ?? sideNumbers[0])).map((p) => p.wrestlerId),
  );
  return { sideA, sideB, winningSide: null };
}

const ANIM: Record<PlaybackBeat['pose'], { actor: string; target: string }> = {
  exchange: { actor: 'animate-ring-jostle', target: 'animate-ring-jostle' },
  whip: { actor: 'animate-ring-strike', target: 'animate-ring-whip' },
  control: { actor: 'animate-ring-strike', target: 'animate-ring-strike' },
  comeback: { actor: 'animate-ring-surge', target: 'animate-ring-strike' },
  nearFall: { actor: 'animate-ring-surge', target: 'animate-ring-slam' },
  signature: { actor: 'animate-ring-surge', target: 'animate-ring-slam' },
  interference: { actor: 'animate-ring-strike', target: 'animate-ring-strike' },
  botch: { actor: 'animate-ring-jostle', target: '' },
  environmental: { actor: '', target: '' },
  elimination: { actor: 'animate-ring-surge', target: 'animate-ring-eliminated' },
  finish: { actor: 'animate-ring-surge', target: 'animate-ring-slam' },
};

export function MatchViewerScreen({
  matchWeek,
  matchSlot,
  onBack,
}: {
  matchWeek: number;
  matchSlot: number;
  onBack: () => void;
}) {
  const world = useGameStore((s) => s.world);
  const [beatIndex, setBeatIndex] = useState(0);
  const [linesShown, setLinesShown] = useState(0);

  const show = world?.showHistory.find((s) => s.week === matchWeek);
  const segment = show?.segments.find((s) => s.slot === matchSlot);
  const result = segment?.result;

  const competitors = segment?.participants.filter((p) => p.role === 'competitor') ?? [];
  const { sideA, sideB, winningSide } = result
    ? deriveSides(competitors, result, world!.wrestlers)
    : { sideA: [], sideB: [], winningSide: null as 'a' | 'b' | null };
  const timeline = result ? buildPlaybackTimeline(result.beats, sideA, sideB, winningSide) : [];
  const commentary = result?.commentary ?? [];

  // Two independent tickers, paced so they roughly finish together — see the
  // "thematic, not line-for-line" note at the top of this file for why they
  // aren't locked to each other beat-for-beat.
  useEffect(() => {
    if (timeline.length === 0 || beatIndex >= timeline.length - 1) return;
    const handle = setTimeout(() => setBeatIndex((n) => n + 1), BEAT_PACE_MS);
    return () => clearTimeout(handle);
  }, [beatIndex, timeline.length]);

  useEffect(() => {
    if (commentary.length === 0 || linesShown >= commentary.length) return;
    const linePace = Math.max(400, (timeline.length * BEAT_PACE_MS) / commentary.length);
    const handle = setTimeout(() => setLinesShown((n) => n + 1), linePace);
    return () => clearTimeout(handle);
  }, [linesShown, commentary.length, timeline.length]);

  if (!world) return null;
  if (!show || !segment || !result) {
    return (
      <div className="p-6 text-neutral-100">
        <ScreenHeader title="That match is gone" onBack={onBack} />
        <p className="text-sm text-neutral-500">This show is no longer on file.</p>
      </div>
    );
  }

  const theme = promotionTheme(world.promotion.identity);
  const stipulation = segment.stipulation ? stipulationById(segment.stipulation) : null;
  const titleNames = segment.titleIds.map((id) => world.titles.find((t) => t.id === id)?.name).filter(Boolean);
  const current = timeline[beatIndex];
  const done = beatIndex >= timeline.length - 1 && linesShown >= commentary.length;

  const skip = () => {
    setBeatIndex(Math.max(0, timeline.length - 1));
    setLinesShown(commentary.length);
  };

  // Everyone in the ring, sideA first so a tag team's members sit near each
  // other around the circle, capped so a big battle royal doesn't spill off
  // screen.
  const ring = [...sideA, ...sideB];
  const visible = ring.slice(0, MAX_VISIBLE);
  const overflow = ring.length - visible.length;

  // Every elimination beat played so far, tallied fresh each render rather
  // than tracked as its own state — `timeline`/`beatIndex` already say
  // everything about "what's happened up to now," so a separate synced Set
  // would just be one more thing to keep in step with them.
  const eliminated = new Set(
    timeline.slice(0, beatIndex + 1).flatMap((b) => (b.pose === 'elimination' && b.targetId ? [b.targetId] : [])),
  );

  const calloutText =
    current?.pose === 'finish'
      ? finishCallout(result.finish)
      : current?.pose === 'elimination'
        ? 'ELIMINATED!'
        : current?.pose === 'nearFall'
          ? '1... 2...'
          : current?.moveName
            ? current.moveName.toUpperCase()
            : current?.pose === 'signature'
              ? 'BIG MOVE!'
              : null;

  return (
    <div className="flex h-full flex-col p-6 text-neutral-100">
      <ScreenHeader
        title={stipulation?.name ?? 'The match'}
        subtitle={titleNames.length > 0 ? titleNames.join(' & ') : undefined}
        onBack={onBack}
        right={
          !done ? (
            <button
              type="button"
              data-testid="viewer-skip"
              onClick={skip}
              className="rounded bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-300 hover:bg-neutral-700"
            >
              Skip to the finish
            </button>
          ) : (
            <button
              type="button"
              onClick={onBack}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white ${theme.action}`}
            >
              Back to results
            </button>
          )
        }
      />

      {/* ---- the ring, top two-thirds ------------------------------------ */}
      <Panel
        elevation="hero"
        className="relative mt-3 flex-[2] overflow-hidden"
        style={{ background: 'radial-gradient(ellipse at 50% 42%, rgba(255,255,255,0.05), transparent 60%)' }}
        data-testid="match-ring"
      >
        <div className="relative h-full min-h-[420px] w-full">
          {/* The ring itself — otherwise every wrestler is just floating on
              the panel's plain background with nothing under them. A mat and
              three rope lines sized to frame the spotlighted pair (radius 70)
              at the centre; everyone else, further out at radius 150, reads
              as circling just outside it, which is exactly where a battle
              royal's field actually stands while two of them go at it in the
              middle. Tinted to the promotion's own colour so it doesn't feel
              like a placeholder. */}
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ width: 300, height: 300 }}
          >
            <div className="absolute inset-5 rounded-xl bg-gradient-to-b from-neutral-800/50 to-neutral-950/70" />
            <div className={`absolute inset-0 rounded-2xl border-2 ${theme.edge} opacity-60`} />
            <div className={`absolute inset-[10px] rounded-2xl border-2 ${theme.edge} opacity-40`} />
            <div className={`absolute inset-5 rounded-2xl border-2 ${theme.edge} opacity-25`} />
            {[
              'left-0 top-0 -translate-x-1/2 -translate-y-1/2',
              'right-0 top-0 translate-x-1/2 -translate-y-1/2',
              'left-0 bottom-0 -translate-x-1/2 translate-y-1/2',
              'right-0 bottom-0 translate-x-1/2 translate-y-1/2',
            ].map((pos) => (
              <div key={pos} className={`absolute h-3 w-3 rounded-sm ${theme.action} ${pos}`} />
            ))}
          </div>

          {visible.map((wrestler, i) => {
            const angle = (360 / visible.length) * i;
            const isActor = current?.actorId === wrestler.id;
            const isTarget = current?.targetId === wrestler.id;
            const spotlighted = isActor || isTarget;
            // Eliminated, and this isn't the beat that just eliminated them —
            // stay out on the rail, visibly out of it, rather than standing
            // there indistinguishable from someone still in the match.
            const isOut = eliminated.has(wrestler.id) && !spotlighted;
            const radius = spotlighted ? 70 : 150;
            const animClass = isActor
              ? ANIM[current!.pose].actor
              : isTarget
                ? ANIM[current!.pose].target
                : '';

            return (
              <div
                key={wrestler.id}
                className="absolute left-1/2 top-1/2 transition-[transform] duration-500"
                style={{
                  transform: `translate(-50%, -50%) rotate(${angle}deg) translateX(${radius}px) rotate(${-angle}deg)`,
                }}
              >
                {/* Remounted every beat (`key`) so a one-shot pose animation
                    replays from its start each time, instead of the browser
                    treating a repeated class as already-applied. `animClass`
                    lives on its own inner wrapper around just the portrait —
                    several poses (ring-slam, ring-eliminated) rotate all the
                    way to upside down, and the name tag below needs to stay
                    put and readable rather than flipping with it. */}
                <div
                  key={beatIndex}
                  className={`flex flex-col items-center gap-1 ${
                    spotlighted ? 'z-10 scale-125' : isOut ? 'scale-75 opacity-35 grayscale' : 'opacity-80'
                  }`}
                >
                  <div className={animClass}>
                    <PaperDoll
                      appearance={wrestler.appearance}
                      gender={wrestler.gender}
                      alignment={wrestler.alignment}
                      size="large"
                      flip={sideA.includes(wrestler) ? false : true}
                    />
                  </div>
                  {/* `line-clamp-2` rather than a single-line `truncate` — a
                      long ring name used to hard-cut to "Diamond Sun…" at
                      80px; wrapping onto a second line keeps the whole name
                      readable instead of guessing at it. */}
                  <span className="flex max-w-[110px] flex-col items-center gap-0.5 rounded bg-neutral-950/80 px-1 py-0.5 text-center text-[9px] leading-tight text-neutral-300">
                    <span className="line-clamp-2 break-words">{wrestler.name}</span>
                    {isOut && <span className="text-rose-400">OUT</span>}
                  </span>
                </div>
              </div>
            );
          })}

          {overflow > 0 && (
            <span className="absolute right-3 top-3 rounded-full bg-neutral-900/90 px-2 py-1 text-[10px] text-neutral-400">
              +{overflow} more in the ring
            </span>
          )}

          {/* The comic-book callout — a move name, a count, or the finish
              word. Pinned to a strip along the top rather than the panel's
              dead centre: the wrestlers themselves sit centred (and the
              spotlighted pair pulls in tight, radius 70), so a centred
              callout landed squarely on top of whoever the beat was about,
              covering the exact portrait it was meant to punctuate. */}
          {calloutText && (
            <div
              key={`callout-${beatIndex}`}
              className="pointer-events-none absolute inset-x-0 top-4 flex justify-center px-4"
            >
              <span
                className="animate-callout-pop select-none rounded bg-neutral-950/40 px-2 text-3xl font-black uppercase tracking-wide text-amber-300"
                style={{ textShadow: '3px 3px 0 rgba(0,0,0,0.6), -1px -1px 0 rgba(255,255,255,0.15)' }}
              >
                {calloutText}
              </span>
            </div>
          )}
          {current && (current.pose === 'signature' || current.pose === 'finish') && (
            <div
              key={`bam-${beatIndex}`}
              className="pointer-events-none absolute left-1/4 top-1/4 animate-callout-pop select-none text-xl font-black text-rose-400"
              style={{ textShadow: '2px 2px 0 rgba(0,0,0,0.6)' }}
            >
              BAM!
            </div>
          )}
        </div>
      </Panel>

      {/* ---- commentary, bottom third ------------------------------------ */}
      {commentary.length > 0 && world.promotion.commentaryTeam ? (
        <CommentaryFeed
          lines={commentary}
          shown={linesShown}
          playName={world.promotion.commentaryTeam.playByPlayName}
          colourName={world.promotion.commentaryTeam.colourName}
        />
      ) : null}
    </div>
  );
}

/** First letter of up to two words — the closest thing a commentator has to a portrait. */
function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase());
  return letters.join('') || '?';
}

function Avatar({ name, tone }: { name: string; tone: 'play' | 'colour' }) {
  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
        tone === 'play' ? 'bg-sky-700 text-sky-100' : 'bg-amber-700 text-amber-100'
      }`}
    >
      {initials(name)}
    </span>
  );
}

function CommentaryFeed({
  lines,
  shown,
  playName,
  colourName,
}: {
  lines: readonly { speaker: 'play' | 'colour'; name: string; text: string }[];
  shown: number;
  playName: string;
  colourName: string;
}) {
  return (
    <div className="mt-3 flex-1 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900" data-testid="commentary-feed">
      <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950/60 px-3 py-1.5">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-sky-400">
          <Avatar name={playName} tone="play" />
          {playName}
        </span>
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400">
          {colourName}
          <Avatar name={colourName} tone="colour" />
        </span>
      </div>
      <div className="flex h-full max-h-[220px] flex-col gap-1.5 overflow-y-auto px-3 py-2">
        {lines.slice(0, shown).map((line, i) => (
          <div key={i} className={`flex items-end gap-1.5 ${line.speaker === 'play' ? 'justify-start' : 'justify-end'}`}>
            {line.speaker === 'play' && <Avatar name={line.name} tone="play" />}
            <div
              className={`max-w-[70%] rounded-lg px-2.5 py-1.5 text-xs leading-snug ${
                line.speaker === 'play'
                  ? 'rounded-tl-none bg-sky-950/60 text-sky-100'
                  : 'rounded-tr-none bg-amber-950/60 text-amber-100'
              }`}
            >
              {line.text}
            </div>
            {line.speaker === 'colour' && <Avatar name={line.name} tone="colour" />}
          </div>
        ))}
      </div>
    </div>
  );
}
