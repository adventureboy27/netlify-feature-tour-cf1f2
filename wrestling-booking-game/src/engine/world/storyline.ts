// The thing the booker is actually doing.
//
// The game had every ingredient of storytelling and no spine connecting them.
// Rivalries carried heat. Confrontations happened. Factions formed. The fan
// board asked for rematches. The announcers even recapped feuds. But none of
// it knew about any of the rest: sim/confrontation.ts does not contain the
// word "rivalry", and Rivalry.lastAdvancedWeek was written and read only
// inside rivalry.ts — so nothing the player booked could actually *advance* a
// feud. A rivalry was a number that went up when two people wrestled.
//
// A storyline is the booker-facing object that a rivalry was standing in for.
// It has a name. It has a shape — you introduce it, you build it, it comes to
// the boil, and then you blow it off. It is advanced by the things you were
// already booking, so it costs the player no extra clicks: put those two in a
// match, give one of them a microphone, sign a contract in the middle of the
// ring, and the story moves. Ignore it and the crowd stops caring, which is
// the failure state this whole system exists to make possible.
//
// It sits *on top of* the rivalry rather than replacing it. The rivalry stays
// what it always was — crowd heat and real animosity between two people, the
// numbers the match engine reads. The storyline is the arc the booker is
// running through it. That way nothing already built has to change.
//
// Two rules from CLAUDE.md govern the edges:
//
//   The sim always picks the winner. A storyline never scripts a finish, and
//   nothing here touches who wins. It reads results and reacts.
//
//   The game never warns before a bad decision. `whatItNeeds` is not a
//   warning — it is the crowd's state said out loud, the same way the fan
//   demand board is. It never says "do not". The player is free to blow off a
//   story in week one and get almost nothing for it.

import { clamp } from '../rng';
import type { Id, Rivalry, WorldSettings } from '../types';
import { BEAT_WEIGHTS, type StorylineBeatKind } from '../../data/storylineBeats';

export type StorylineStage =
  /** Just started. The crowd is still working out what this is. */
  | 'opening'
  /** It has legs. Every week it is not advanced is a week it loses. */
  | 'building'
  /** Ready. It can be blown off now, and sitting on it starts costing. */
  | 'boiling'
  /** Settled in the ring, and paid. */
  | 'blownOff'
  /** Left alone until nobody cared. The one failure the booker owns entirely. */
  | 'fizzled';

export interface StorylineBeat {
  week: number;
  kind: StorylineBeatKind;
  /** What happened, in a sentence, so the arc can be read back. */
  text: string;
}

export interface Storyline {
  id: Id;
  /** What it is called. Generated, and the booker can rename it. */
  name: string;
  participantIds: Id[];
  /** The rivalry underneath it — the heat the match engine actually reads. */
  rivalryId: Id;
  stage: StorylineStage;
  startWeek: number;
  lastAdvancedWeek: number;
  /** Everything that has happened in it, in order. This is the story. */
  beats: StorylineBeat[];
  /**
   * Consecutive weeks with nothing booked. Drives the fizzle, and is reset by
   * any beat at all — a promo is enough to keep a story breathing.
   */
  neglectedWeeks: number;
  resolvedWeek: number | null;
  /** How it ended, in the sheet's words. Null until it does. */
  payoff: string | null;
  /**
   * The number `blowOffQuality()` actually computed, kept rather than only
   * the words it produced. Optional and absent on anything that predates it
   * — old saves' already-settled arcs just don't count toward a pairing's
   * shared history; nothing crashes reading them. See sim/pairChemistry.ts,
   * the only reader.
   */
  blowOffQuality?: number;
}

/** Total weight of everything that has happened, which is what moves stages. */
export function investment(storyline: Storyline): number {
  return storyline.beats.reduce((sum, beat) => sum + (BEAT_WEIGHTS[beat.kind] ?? 0), 0);
}

/** Is this arc still running? */
export function isLive(storyline: Storyline): boolean {
  return storyline.stage !== 'blownOff' && storyline.stage !== 'fizzled';
}

/** Can it be settled tonight? */
export function readyToBlowOff(storyline: Storyline): boolean {
  return storyline.stage === 'boiling';
}

/**
 * Which stage a given amount of investment has earned.
 *
 * Stored on the storyline rather than derived on every read, because the
 * stage is also moved by things other than weight — a fizzle is a stage
 * change nothing in the beat list explains.
 */
export function stageForInvestment(total: number, settings: WorldSettings): StorylineStage {
  if (total >= settings.storylineBoilingInvestment) return 'boiling';
  if (total >= settings.storylineBuildingInvestment) return 'building';
  return 'opening';
}

/**
 * Fold a beat into the arc.
 *
 * Pure — returns a new storyline and never touches the rivalry. The caller
 * owns committing both, because the rivalry's own heat rules already exist
 * and this has no business duplicating them.
 */
export function advance(
  storyline: Storyline,
  beat: StorylineBeat,
  settings: WorldSettings,
): Storyline {
  if (!isLive(storyline)) return storyline;
  const beats = [...storyline.beats, beat];
  const total = beats.reduce((sum, b) => sum + (BEAT_WEIGHTS[b.kind] ?? 0), 0);
  return {
    ...storyline,
    beats,
    // A blow-off can only be reached deliberately, via blowOff() — an
    // ordinary match never ends a story by accident.
    stage: stageForInvestment(total, settings),
    lastAdvancedWeek: beat.week,
    neglectedWeeks: 0,
  };
}

/**
 * A week in which nothing happened.
 *
 * The crowd forgets. Past the limit the story is dead and the booker did it
 * by not booking it — which is the point. Nothing is warned about in advance;
 * the neglect is visible on the Stories board the whole time it is happening.
 */
export function neglect(storyline: Storyline, week: number, settings: WorldSettings): Storyline {
  if (!isLive(storyline)) return storyline;
  const neglectedWeeks = storyline.neglectedWeeks + 1;
  if (neglectedWeeks >= settings.storylineFizzleWeeks) {
    return {
      ...storyline,
      neglectedWeeks,
      stage: 'fizzled',
      resolvedWeek: week,
      payoff: 'Nothing ever came of it. The crowd stopped asking and then stopped remembering.',
    };
  }
  return { ...storyline, neglectedWeeks };
}

/**
 * What a blow-off is worth, as a multiplier on the rivalry's own payout.
 *
 * Three things decide it, and all three are the booker's doing: how much
 * story was actually told, whether it was settled at the right time, and how
 * good the match was on the night. Blowing off a week-old feud pays almost
 * nothing — the heat was never built. Sitting on a boiling one for two months
 * pays less than it would have, because the crowd has been waiting.
 */
export function blowOffQuality(
  storyline: Storyline,
  matchRating: number,
  week: number,
  settings: WorldSettings,
): number {
  const told = Math.min(1, investment(storyline) / settings.storylineBoilingInvestment);
  const onTheNight = clamp(matchRating / 100, 0, 1);
  const heldTooLong =
    storyline.stage === 'boiling'
      ? Math.max(0, week - storyline.lastAdvancedWeek - settings.storylineStaleAfterWeeks)
      : 0;
  const staleness = Math.min(1, heldTooLong * settings.storylineStalePerWeek);

  return clamp(
    told * settings.storylineToldWeight +
      onTheNight * settings.storylineNightWeight +
      settings.storylineBlowoffFloor -
      staleness,
    0,
    2,
  );
}

/** Settle it. The caller has already decided the match happened and who won. */
export function blowOff(
  storyline: Storyline,
  week: number,
  winnerName: string,
  quality: number,
  settings: WorldSettings,
): Storyline {
  const verdict =
    quality >= settings.storylineGreatBlowoff
      ? `${winnerName} finished it, and the building knew it was the end of something.`
      : quality >= settings.storylineFairBlowoff
        ? `${winnerName} settled it. It did what it needed to do.`
        : `${winnerName} won it, but nobody had been given a reason to care yet.`;
  return {
    ...storyline,
    stage: 'blownOff',
    resolvedWeek: week,
    lastAdvancedWeek: week,
    payoff: verdict,
    blowOffQuality: quality,
  };
}

/**
 * What the crowd is waiting for, in plain words.
 *
 * The one genuinely new affordance in the whole system: a booker can look at
 * a story and know what it is short of. Never an instruction and never a
 * warning — it describes what has happened, and the gap is the player's to
 * read.
 */
export function whatItNeeds(storyline: Storyline, week: number, settings: WorldSettings): string {
  if (storyline.stage === 'fizzled') return 'Dead. Nobody is asking about this any more.';
  if (storyline.stage === 'blownOff') return storyline.payoff ?? 'Settled.';

  const kinds = new Set(storyline.beats.map((b) => b.kind));
  const idle = week - storyline.lastAdvancedWeek;

  if (idle >= settings.storylineColdWeeks) {
    return `${idle} weeks since anything happened in this. They are starting to forget it.`;
  }
  if (storyline.stage === 'boiling') {
    const waiting = Math.max(0, idle - settings.storylineStaleAfterWeeks);
    return waiting > 0
      ? 'It has been ready for a while now. Every week it waits, it is worth a little less.'
      : 'This is ready. Put them in a match that settles it.';
  }
  if (!kinds.has('promo') && !kinds.has('confrontation')) {
    return 'They have never said a word about each other. Somebody needs to talk.';
  }
  if (!kinds.has('match')) {
    return 'Plenty of talking and no fighting. The crowd wants to see them in a ring.';
  }
  if (storyline.stage === 'opening') {
    return 'It has started. It needs to happen again before anybody takes it seriously.';
  }
  return 'It is building. Keep putting it in front of them.';
}

/** Where the arc is, for the board. Never a number. */
export function standing(storyline: Storyline): string {
  switch (storyline.stage) {
    case 'opening':
      return 'Just started';
    case 'building':
      return 'Building';
    case 'boiling':
      return 'Ready to blow off';
    case 'blownOff':
      return 'Settled';
    case 'fizzled':
      return 'Fizzled out';
  }
}

/** The arc read back as a list of sentences — the recap. */
export function recap(storyline: Storyline): string[] {
  return storyline.beats.map((beat) => beat.text);
}

/** Every live storyline these people are in. */
export function storylinesFor(
  storylines: readonly Storyline[],
  wrestlerIds: readonly Id[],
): Storyline[] {
  return storylines.filter(
    (s) => isLive(s) && s.participantIds.some((id) => wrestlerIds.includes(id)),
  );
}

/**
 * Every storyline this one person has ever been part of, live or finished —
 * the feud page's whole reading list. Current first, most recently touched
 * first within each group, so the thing actually worth reading is at the top
 * whether it is still running or already told.
 */
export function allStorylinesFor(storylines: readonly Storyline[], wrestlerId: Id): Storyline[] {
  return storylines
    .filter((s) => s.participantIds.includes(wrestlerId))
    .sort((a, b) => {
      if (isLive(a) !== isLive(b)) return isLive(a) ? -1 : 1;
      return b.lastAdvancedWeek - a.lastAdvancedWeek;
    });
}

/** Everybody in the business who has ever been part of a storyline — the office's feud index. */
export function everyoneWithAStoryline(storylines: readonly Storyline[]): Id[] {
  const ids = new Set<Id>();
  for (const s of storylines) for (const id of s.participantIds) ids.add(id);
  return [...ids];
}

/** The storyline covering exactly these two, if there is one. */
export function storylineBetween(
  storylines: readonly Storyline[],
  participantIds: readonly Id[],
): Storyline | undefined {
  return storylines.find(
    (s) =>
      isLive(s) &&
      s.participantIds.length === participantIds.length &&
      s.participantIds.every((id) => participantIds.includes(id)),
  );
}

/**
 * Is this rivalry worth naming?
 *
 * The player is never made to start a storyline — most feuds are just two
 * people who keep being booked against each other. This is the suggestion:
 * a rivalry with real heat and no arc on top of it is one the office would
 * notice and give a name to.
 */
export function worthNaming(
  rivalry: Rivalry,
  storylines: readonly Storyline[],
  settings: WorldSettings,
): boolean {
  if (rivalry.resolvedWeek !== null) return false;
  if (rivalry.heat < settings.storylineSuggestHeat) return false;
  return !storylines.some((s) => isLive(s) && s.rivalryId === rivalry.id);
}
