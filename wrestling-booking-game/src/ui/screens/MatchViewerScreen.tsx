// Watch a decided match back — two commentators trading live lines in a chat
// feed along the bottom third, and up top an arena with a ring in it, where
// the two wrestlers a beat is about act it out as full-body figures (see
// ui/match/: Arena for the building, MatchFigure for the bodies,
// choreography.ts for what a suplex actually looks like). Everyone else in
// the match waits on a rail at their own side of the ring.
//
// Nothing here decides anything. `world.showHistory` already has the result;
// this only stages it. See `engine/sim/matchPlayback.ts` for the beat-to-pose
// derivation and the honest limits on how closely it can track `commentary.ts`'s
// own line-by-line pacing (thematic sync, not line-for-line — read that
// file's top comment before changing the pacing here).

import { useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '../../state/store';
import { buildPlaybackTimeline } from '../../engine/sim/matchPlayback';
import { PaperDoll, lookSubjectOf } from '../paperdoll/PaperDoll';
import { MatchStage, type Aftermath, type Bystander, type StageFighter } from '../match/MatchStage';
import { stageMatch } from '../match/choreography';
import { conductOf, STANDARD } from '../match/conduct';
import { ScreenHeader } from '../components/ScreenHeader';
import { Panel, promotionTheme } from '../components/chrome';
import { stipulationById } from '../../data/stipulations';
import type { Id, PromotionArchetype, SegmentResult, SegmentRole, Wrestler } from '../../engine/types';

/**
 * How long one beat holds for a match whose commentary cannot be tied to
 * its beats (a save from before lines carried a beat index). A match that
 * can be is paced by what is said over each beat — see stageMatch.
 */
const BEAT_PACE_MS = 2000;
/** The gap between one line and the next when several are said in a row. */
const LINE_PACE_MS = 1300;

// The ring's apron, turnbuckle pads and big screen, in the house colour —
// the same hues chrome.tsx's promotionTheme uses for buttons, as plain hex
// because an SVG fill cannot take a Tailwind class.
const ARENA_ACCENT: Record<PromotionArchetype, string> = {
  territory: '#d97706',
  hardcore: '#b91c1c',
  technical: '#0369a1',
  sportsEntertainment: '#a21caf',
  lucha: '#ea580c',
  oldSchool: '#78716c',
  athletic: '#059669',
};

/**
 * The same reduction `commentary.ts` uses for a multi-man match: the eventual
 * winners are one corner, everyone else is the other. A draw falls back to
 * the two sides as booked.
 *
 * Also reports which raw booking `side` numbers (0/1, what `Segment.participants`
 * and `Segment.managerIds` are actually keyed by) ended up as sideA — a
 * manager assigned to booking-side 0 needs to render on whichever rail that
 * side actually landed on here, which is not always sideA (sideA is always
 * the *winners*, not always side 0).
 */
function deriveSides(
  competitors: SegmentRole[],
  result: SegmentResult,
  wrestlers: Record<Id, Wrestler | undefined>,
): { sideA: Wrestler[]; sideB: Wrestler[]; winningSide: 'a' | 'b' | null; sideARawSides: ReadonlySet<number> } {
  const resolve = (ids: Id[]) => ids.map((id) => wrestlers[id]).filter((w): w is Wrestler => Boolean(w));

  if (result.winnerSide !== null && result.winnerWrestlerIds.length > 0) {
    const winnerIds = new Set(result.winnerWrestlerIds);
    const winners = competitors.filter((p) => winnerIds.has(p.wrestlerId));
    const sideA = resolve(winners.map((p) => p.wrestlerId));
    const sideB = resolve(competitors.filter((p) => !winnerIds.has(p.wrestlerId)).map((p) => p.wrestlerId));
    return { sideA, sideB, winningSide: 'a', sideARawSides: new Set(winners.map((p) => p.side)) };
  }

  // A draw or no-contest — no winner group to build a corner from.
  const sideNumbers = [...new Set(competitors.map((p) => p.side))].filter((s) => s >= 0).sort((a, b) => a - b);
  const sideA = resolve(competitors.filter((p) => p.side === sideNumbers[0]).map((p) => p.wrestlerId));
  const sideB = resolve(
    competitors.filter((p) => p.side === (sideNumbers[1] ?? sideNumbers[0])).map((p) => p.wrestlerId),
  );
  return { sideA, sideB, winningSide: null, sideARawSides: new Set(sideNumbers[0] !== undefined ? [sideNumbers[0]] : []) };
}

interface RingsideManager {
  id: Id;
  name: string;
  photoDataUrl?: string;
  side: 'a' | 'b';
}

/**
 * The same two-step lookup `state/storeHelpers.ts`'s `findManager` already
 * does (a signed manager on staff, or one of the player's own wrestlers
 * moved into a suit) — mirrored locally rather than imported, since no UI
 * file reaches into `state/storeHelpers.ts` today and this is small enough
 * not to be the first. The id has to match exactly what `findManager` would
 * have produced too, not just who the person is: `store.ts` resolves
 * `segment.managerIds` through `findManager` before it ever reaches
 * `ringsideTotals`, and for a wrestler moved into a suit that synthesizes a
 * `mgr-of-${wrestler.id}` id (`career/transition.ts`'s `managerFromWrestler`)
 * — the interference beat's `actorId` is stamped with *that* id, not the
 * wrestler's own, so this has to derive the same one or the two would never
 * match. A purely hired manager has no photo source at all; `PaperDoll`
 * already falls back to initials.
 */
function resolveRingsideManagers(
  managerIds: readonly { managerId: Id; forSide: number }[] | undefined,
  staffManagers: readonly { id: Id; name: string }[],
  wrestlers: Record<Id, Wrestler | undefined>,
  sideARawSides: ReadonlySet<number>,
): RingsideManager[] {
  if (!managerIds) return [];
  const out: RingsideManager[] = [];
  for (const { managerId, forSide } of managerIds) {
    const side: 'a' | 'b' = sideARawSides.has(forSide) ? 'a' : 'b';
    const staff = staffManagers.find((m) => m.id === managerId);
    if (staff) {
      out.push({ id: staff.id, name: staff.name, side });
      continue;
    }
    const person = wrestlers[managerId];
    if (!person || person.role !== 'manager') continue;
    out.push({ id: `mgr-of-${person.id}`, name: person.name, photoDataUrl: person.photoDataUrl, side });
  }
  return out;
}

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
  // Where the playback has got to: -1 is before the bell (the two stand at
  // their marks while the match is introduced), then one step per beat.
  const [beatIndex, setBeatIndex] = useState(-1);
  // How many lines of the whole call have been said so far.
  const [said, setSaid] = useState(0);
  const [linesShown, setLinesShown] = useState(0);

  const show = world?.showHistory.find((s) => s.week === matchWeek);
  const segment = show?.segments.find((s) => s.slot === matchSlot);
  const result = segment?.result;

  // The whole match staged up front — which move, between whom, under which
  // line — so a beat can depend on the one before it (who is still down,
  // what was just done). Keyed on the result: it is decided, it never changes.
  const staging = useMemo(() => {
    if (!result || !segment || !world) return null;
    const competitors = segment.participants.filter((p) => p.role === 'competitor');
    const sides = deriveSides(competitors, result, world.wrestlers);
    const timeline = buildPlaybackTimeline(result.beats, sides.sideA, sides.sideB, sides.winningSide);
    const byId = new Map([...sides.sideA, ...sides.sideB].map((w) => [w.id, w] as const));
    // The rulebook for this match — stipulation, rules, and how it ended —
    // which everything about how it is staged then obeys.
    const conduct = conductOf(segment, result.finish, [sides.sideA.length, sides.sideB.length]);
    const teams = conduct.tags ? [sides.sideA.map((w) => w.id), sides.sideB.map((w) => w.id)] : [];
    return { ...sides, timeline, conduct, ...stageMatch(timeline, result.commentary ?? [], byId, result.finish, { conduct, teams }) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const sideA = staging?.sideA ?? [];
  const sideB = staging?.sideB ?? [];
  const sideARawSides = staging?.sideARawSides ?? new Set<number>();
  const timeline = staging?.timeline ?? [];
  const moments = staging?.moments ?? [];
  const synced = staging?.synced ?? false;
  const commentary = result?.commentary ?? [];
  const lastBeat = moments.length - 1;

  // The call as one script, and where each step's lines sit in it. Step -1
  // is everything before the bell; one past the last beat is the sign-off.
  const script = useMemo(
    () => (staging ? [...staging.before, ...staging.moments.flatMap((m) => m.lines), ...staging.after] : []),
    [staging],
  );
  const linesOf = (step: number) => (!staging ? 0 : step < 0 ? staging.before.length : step > lastBeat ? staging.after.length : (moments[step]?.lines.length ?? 0));
  const startOf = (step: number) => {
    if (!staging || step < 0) return 0;
    let at = staging.before.length;
    for (let i = 0; i < Math.min(step, moments.length); i++) at += moments[i]!.lines.length;
    return at;
  };
  const sayable = startOf(beatIndex) + linesOf(beatIndex);

  // The ring never waits for the words. A beat lasts as long as its move
  // and then the next one starts; the call keeps up on its own.
  useEffect(() => {
    if (!staging || !synced) return;
    if (beatIndex > lastBeat) return;
    // Before the bell there is nothing to wait for but the introductions.
    if (beatIndex < 0 && said < sayable) return;
    const handle = setTimeout(() => setBeatIndex((n) => n + 1), beatIndex < 0 ? 700 : (moments[beatIndex]?.holdMs ?? 1700));
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staging, synced, beatIndex, beatIndex < 0 && said < sayable]);

  // The moment a beat starts, the line that calls it is on screen — and
  // anything left unsaid from before is said, because the moment it was
  // about has passed. Whatever else is said over this beat follows at
  // reading pace while the ring carries on.
  useEffect(() => {
    if (!staging || !synced) return;
    setSaid((n) => Math.max(n, startOf(beatIndex) + (linesOf(beatIndex) > 0 && beatIndex >= 0 ? 1 : 0)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staging, synced, beatIndex]);
  useEffect(() => {
    if (!staging || !synced || said >= sayable) return;
    const handle = setTimeout(() => setSaid((n) => n + 1), said === 0 ? 150 : LINE_PACE_MS);
    return () => clearTimeout(handle);
  }, [staging, synced, said, sayable]);

  // An older match, with nothing tying a line to a beat: two tickers paced
  // to finish together, which is the best that can be done for it.
  useEffect(() => {
    if (!staging || synced || beatIndex > lastBeat) return;
    const handle = setTimeout(() => setBeatIndex((n) => n + 1), beatIndex < 0 ? 300 : BEAT_PACE_MS);
    return () => clearTimeout(handle);
  }, [staging, synced, beatIndex, lastBeat]);
  useEffect(() => {
    if (!staging || synced || linesShown >= commentary.length) return;
    const linePace = Math.max(400, (timeline.length * BEAT_PACE_MS) / commentary.length);
    const handle = setTimeout(() => setLinesShown((n) => n + 1), linePace);
    return () => clearTimeout(handle);
  }, [staging, synced, linesShown, commentary.length, timeline.length]);

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
  const moment = beatIndex >= 0 ? moments[Math.min(beatIndex, lastBeat)] : undefined;
  const current = moment?.beat;
  const done = beatIndex > lastBeat && (synced ? said >= script.length : linesShown >= commentary.length);
  // The last beat has played: what is on screen now is how it came out.
  const over = beatIndex > lastBeat;
  const conduct = staging?.conduct ?? STANDARD;

  // Everything said so far.
  const heard = synced ? script.slice(0, said) : commentary.slice(0, linesShown);

  const skip = () => {
    setBeatIndex(Math.max(0, lastBeat));
    setSaid(startOf(lastBeat) + linesOf(lastBeat));
    setLinesShown(commentary.length);
  };

  // Everyone in the match, sideA first. However many that is, they are all
  // on screen: see FieldBrawl for how thirty people fit in a ring.
  const combined = [...sideA, ...sideB];

  // Whoever's at ringside for this match — present the whole way through,
  // not just when something happens to them.
  const ringsideManagers = resolveRingsideManagers(
    segment.managerIds,
    world.staffManagers,
    world.wrestlers,
    sideARawSides,
  );
  const interferingManager =
    current?.pose === 'interference' ? ringsideManagers.find((m) => m.id === current.actorId) : undefined;

  // Every elimination beat played so far, tallied fresh each render rather
  // than tracked as its own state — `timeline`/`beatIndex` already say
  // everything about "what's happened up to now," so a separate synced Set
  // would just be one more thing to keep in step with them.
  const eliminated = new Set(
    moments.slice(0, beatIndex + 1).flatMap((m) => (m.beat.pose === 'elimination' && m.targetId ? [m.targetId] : [])),
  );

  // Before the bell the two who open the match are the ones standing in it.
  const onNow = moment ?? moments[0];
  const activeIds = new Set([onNow?.actorId, onNow?.targetId].filter((id): id is Id => Boolean(id)));

  // The one or two people the beat is about, placed in the ring. sideA
  // works from the left, sideB from the right; if both happen to be on the
  // same side (a partner turning on a partner), the target takes the other mark.
  const actorWrestler = combined.find((w) => w.id === onNow?.actorId);
  const targetWrestler = combined.find((w) => w.id === onNow?.targetId && w.id !== onNow?.actorId);
  const slotOf = (w: Wrestler): 'left' | 'right' => (sideA.includes(w) ? 'left' : 'right');
  const fighters: StageFighter[] = [];
  if (actorWrestler) fighters.push({ wrestler: actorWrestler, role: 'actor', slot: slotOf(actorWrestler) });
  if (targetWrestler) {
    const natural = slotOf(targetWrestler);
    const taken = actorWrestler ? slotOf(actorWrestler) : null;
    fighters.push({ wrestler: targetWrestler, role: 'target', slot: natural === taken ? (natural === 'left' ? 'right' : 'left') : natural });
  }
  // The rules say who is in the ring. A tag match keeps partners on the
  // apron and tags them in; a battle royal, a three-way, a tornado tag put
  // everybody in at once, behind the two the beat is about.
  const isTagMatch = conduct.tags;
  const isFieldMatch = conduct.allIn;
  // DESIGN: the sim has no "tag" beat — it just names a different member of
  // the team as the actor. So a tag is staged whenever somebody steps in
  // for a partner who was in the ring one beat ago.
  const previous = beatIndex > 0 ? moments[Math.min(beatIndex, lastBeat) - 1] : undefined;
  const previousIds = new Set([previous?.actorId, previous?.targetId].filter((id): id is Id => Boolean(id)));
  const partnerWasIn = (w: Wrestler) => (sideA.includes(w) ? sideA : sideB).some((mate) => mate.id !== w.id && previousIds.has(mate.id));
  for (const fighter of fighters) {
    if (isTagMatch && moment && beatIndex <= lastBeat && current?.pose !== 'interference' && !previousIds.has(fighter.wrestler.id) && partnerWasIn(fighter.wrestler)) {
      fighter.taggedIn = true;
    }
  }
  const tagged = fighters.some((f) => f.taggedIn);

  // A battle royal's last elimination is its finish, and whoever went out
  // then has left the match like everybody before them.
  const lastOut = over && conduct.finish === 'overTop' ? moments[lastBeat]?.targetId : null;
  const departed = lastOut ? new Set([...eliminated, lastOut]) : eliminated;

  const waiting = combined.filter((w) => !activeIds.has(w.id) && !departed.has(w.id));
  const bystanders: Bystander[] = isTagMatch
    ? waiting.map((w) => ({ wrestler: w, slot: slotOf(w), place: 'apron' as const }))
    : isFieldMatch
      ? waiting.map((w) => ({ wrestler: w, slot: slotOf(w), place: 'ring' as const }))
      : [];

  // How it came out. The winners leave with a belt if the match was for one
  // and they are the ones holding it now — won tonight, or kept.
  const winnerIds = new Set(result.winnerSide === null ? [] : result.winnerWrestlerIds);
  const holdsIt = world.titles.some((title) => segment.titleIds.includes(title.id) && title.currentHolderIds.some((id) => winnerIds.has(id)));
  const belt = segment.titleIds.length > 0 && winnerIds.size > 0 && (result.titleChanged || holdsIt);
  const aftermath: Aftermath | undefined = over ? { winners: winnerIds, belt } : undefined;
  // First blood: whoever lost is the one wearing it.
  const bloody = conduct.finish === 'blood' && beatIndex >= lastBeat ? new Set(combined.filter((w) => !winnerIds.has(w.id)).map((w) => w.id)) : undefined;

  // Nothing is staged before the bell, or once the last beat has played out.
  const staged = moment && beatIndex <= lastBeat ? moment.staged : null;

  /** One ringside manager — smaller than a competitor, present the whole way through. */
  function renderRingsideManager(manager: RingsideManager, side: 'left' | 'right') {
    const isInterfering = interferingManager?.id === manager.id;
    const animClass = isInterfering ? (side === 'left' ? 'animate-ring-interfere-left' : 'animate-ring-interfere-right') : '';

    return (
      <div key={manager.id} className={`flex items-center gap-1 ${isInterfering ? 'z-10' : 'opacity-75'}`}>
        <div key={beatIndex} className={animClass}>
          <PaperDoll photoDataUrl={manager.photoDataUrl} name={manager.name} lookSubject={lookSubjectOf(manager)} size="thumb" flip={side === 'right'} />
        </div>
        <span className="max-w-[70px] truncate rounded bg-neutral-950/80 px-1 py-0.5 text-[9px] leading-tight text-neutral-400">
          {manager.name}
        </span>
      </div>
    );
  }

  const calloutText = over
    ? winnerIds.size === 0
      ? 'NO WINNER'
      : belt
        ? result.titleChanged
          ? winnerIds.size > 1
            ? 'NEW CHAMPIONS!'
            : 'NEW CHAMPION!'
          : winnerIds.size > 1
            ? 'STILL CHAMPIONS!'
            : 'STILL CHAMPION!'
        : winnerIds.size > 1
          ? 'YOUR WINNERS!'
          : 'YOUR WINNER!'
    : current?.pose === 'finish' || current?.pose === 'elimination' || current?.pose === 'nearFall'
      ? (current.moveName?.toUpperCase() ?? null)
      : interferingManager
            ? 'INTERFERENCE!'
            : current?.moveName
              ? current.moveName.toUpperCase()
              : current?.pose === 'signature'
                ? 'BIG MOVE!'
                : tagged
                  ? 'TAG!'
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
      <Panel elevation="hero" className="relative mt-3 flex min-h-[420px] flex-[2] overflow-hidden bg-black" data-testid="match-ring">
        <MatchStage
          beatKey={Math.min(beatIndex, lastBeat)}
          fighters={fighters}
          staged={staged}
          accent={ARENA_ACCENT[world.promotion.identity] ?? ARENA_ACCENT.territory}
          promotionName={world.promotion.name}
          callout={calloutText}
          pyro={!over && current?.pose === 'environmental'}
          bystanders={bystanders}
          conduct={conduct}
          departed={departed}
          aftermath={aftermath}
          bloody={bloody}
        />

        {/* Who is in the ring right now — the figures themselves are busy
            being thrown around, so the names stay put down here. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-2 z-10 flex items-center justify-center gap-2 text-[11px] font-semibold">
          {over
            ? combined
                .filter((w) => winnerIds.has(w.id))
                .slice(0, 4)
                .map((w) => (
                  <span key={w.id} className="max-w-[220px] truncate rounded bg-amber-400 px-2 py-0.5 text-neutral-950">
                    {w.name}
                  </span>
                ))
            : null}
          {(['left', 'right'] as const).map((slot) => {
            const fighter = over ? undefined : fighters.find((f) => f.slot === slot);
            return fighter ? (
              <span
                key={slot}
                className={`max-w-[220px] truncate rounded px-2 py-0.5 ${fighter.role === 'actor' ? 'bg-amber-400 text-neutral-950' : 'bg-neutral-950/85 text-neutral-200'}`}
              >
                {fighter.wrestler.name}
              </span>
            ) : null;
          })}
        </div>

        {/* Ringside — anyone attending, present for the whole match, not
            just when something happens to them. Pinned to the bottom
            corners of the arena floor rather than sharing the wrestler
            rail: this is who's *at* the show, not *in* the match. */}
        <div className="absolute bottom-2 left-2 z-10 flex flex-col items-start gap-1.5">
          {ringsideManagers
            .filter((m) => m.side === 'a')
            .map((manager) => renderRingsideManager(manager, 'left'))}
        </div>
        <div className="absolute bottom-2 right-2 z-10 flex flex-col items-end gap-1.5">
          {ringsideManagers
            .filter((m) => m.side === 'b')
            .map((manager) => renderRingsideManager(manager, 'right'))}
        </div>

      </Panel>

      {/* ---- commentary, bottom third ------------------------------------ */}
      {commentary.length > 0 && world.promotion.commentaryTeam ? (
        <CommentaryFeed
          lines={heard}
          shown={heard.length}
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
  // Keep the newest line in view: it is the one about what is happening in
  // the ring right now, and it is no use below the fold.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [shown]);
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
      <div ref={scroller} className="flex h-full max-h-[220px] flex-col gap-1.5 overflow-y-auto px-3 py-2">
        {lines.slice(0, shown).map((line, i) => (
          <div
            key={i}
            data-testid="commentary-line"
            className={`flex items-end gap-1.5 transition-opacity ${line.speaker === 'play' ? 'justify-start' : 'justify-end'} ${i === shown - 1 ? '' : 'opacity-60'}`}
          >
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
