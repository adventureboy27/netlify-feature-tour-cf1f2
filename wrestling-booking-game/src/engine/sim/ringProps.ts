// What is in the ring, beat by beat, and where it came from.
//
// A chair is not in anybody's hand until somebody has gone and got it; once
// it has been used it lies where it was dropped until somebody picks it up
// again. A table somebody went through is matchwood. A ladder that gave
// out is scrap. Anything needed that is not there is fetched — from under
// the ring, where there is always another one, or (the steps) off the
// corner — and the beat that needed it says so: the write-up, the call and
// the viewer all show it being fetched first.
//
// Pure and draw-free: line choice is by position, so the shared stream is
// never touched (CLAUDE.md).
import type { Id, MatchBeat, RingItem } from '../types';
import {
  ANOTHER_ONE_LINES,
  RING_ITEM_NAMES,
  STEPS_OFF_THE_CORNER_LINES,
  UNDER_THE_RING_LINES,
} from '../../data/ringProps';

/** What a beat has to have in the ring, if anything. */
export function itemNeeded(beat: MatchBeat, gearFamilyId: string | undefined): RingItem | null {
  switch (beat.spot) {
    case 'weaponShot':
      return beat.weapon ?? 'chair';
    case 'stepsShot':
      return 'steps';
    case 'ladderShot':
    case 'ladderDive':
    case 'ladderPull':
      return 'ladder';
    case 'tableThrough':
    case 'tableFightOff':
      return 'table';
  }
  // The match's own gear: a ladder match is fought around a ladder, a
  // tables match around a table — every near thing and the finish.
  const matchBeat = beat.kind === 'nearFall' || beat.kind === 'finish' || beat.kind === 'gearFailure';
  if (matchBeat && gearFamilyId === 'ladder') return 'ladder';
  if (matchBeat && gearFamilyId === 'tables') return 'table';
  if (beat.kind === 'finish' && beat.weapon) return beat.weapon;
  return null;
}

/** Whether the item survives the beat. */
function survives(beat: MatchBeat, item: RingItem, gearFamilyId: string | undefined): boolean {
  if (beat.kind === 'gearFailure') return false;
  if (item !== 'table') return true;
  // A table somebody went through is in pieces; one somebody fought off is still standing.
  if (beat.spot === 'tableThrough') return false;
  if (beat.kind === 'finish' && gearFamilyId === 'tables') return false;
  return true;
}

export function withRingProps(
  beats: readonly MatchBeat[],
  ctx: { gearFamilyId: string | undefined; nameOf: (id: Id) => string | null },
): MatchBeat[] {
  const inRing = new Set<RingItem>();
  const wrecked = new Set<RingItem>();
  let said = 0;
  const out: MatchBeat[] = [];
  for (const beat of beats) {
    const item = itemNeeded(beat, ctx.gearFamilyId);
    // Going to get it is a moment of its own, just before the one that uses
    // it: its own line in the write-up, its own call, its own beat in the
    // ring. (Breaking is something happening to what is already there.)
    // (A manager who brought it with him needs nothing fetched.)
    if (item && !inRing.has(item) && beat.kind !== 'gearFailure' && !beat.fetched) {
      const from = item === 'steps' ? 'corner' : 'underRing';
      const actor = (beat.actorId && ctx.nameOf(beat.actorId)) || 'Somebody';
      const pool =
        from === 'corner'
          ? STEPS_OFF_THE_CORNER_LINES
          : wrecked.has(item)
            ? ANOTHER_ONE_LINES
            : UNDER_THE_RING_LINES[item === 'ladder' ? 'ladder' : item === 'table' ? 'table' : 'weapon'];
      const named = wrecked.has(item) ? `another ${RING_ITEM_NAMES[item].replace(/^an? /, '')}` : RING_ITEM_NAMES[item];
      out.push({
        kind: 'control',
        significant: true,
        text: pool[said++ % pool.length]!.replace(/\{actor\}/g, actor).replace(/\{item\}/g, named),
        actorId: beat.actorId ?? null,
        targetId: beat.targetId ?? null,
        fetched: { item, from },
      });
    }
    out.push(beat);
    if (!item) continue;
    if (survives(beat, item, ctx.gearFamilyId)) inRing.add(item);
    else {
      inRing.delete(item);
      wrecked.add(item);
    }
  }
  return out;
}
