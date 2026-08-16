// How the locker room feels about the booker.
//
// Morale has been on Wrestler since the first commit and a dozen systems read
// it — release requests, poaching temptation, contract demands, faction
// defection, whether somebody will take a quiet meeting with a competitor,
// whether the scouting read calls them miserable. What none of that had was a
// way for the *booker's own decisions* to move it. Morale only ever changed
// when something happened to somebody: a creative event fired, an award was
// handed out, a contract was signed, a referee blew a call. You could main
// event a man for a year or leave him off forty consecutive cards and his
// morale would be identical either way.
//
// That is the gap this closes. Every week, everybody on the roster gets a
// read on how they were used, and the read is the thing the player can act
// on. Nothing here is hidden: each term produces a sentence, and the sentence
// is what the roster card shows. A man is not just unhappy — he is unhappy
// because it is his fourth week without a match and he is the third most
// popular person in the company.
//
// Two rules this obeys, both from CLAUDE.md:
//
//   Nothing happens to a person off-screen. Every point of morale movement
//   comes with a reason in plain words, and the reasons are derived from
//   world state on read, so the card can always answer "why".
//
//   Stats are bars and words, never numbers. The deltas below are internal.
//   What the player sees is a face, a colour, and a sentence.

import { clamp } from '../rng';
import { nameBurden } from './lineage';
import { loudestPerk, perkMorale, resentmentToward } from '../economy/perks';
import { shunned } from './onOurWatch';
import type { Id, Wrestler, WorldSettings } from '../types';

/** Where somebody's head is at, in bands the UI can draw. */
export type MoodBand = 'delighted' | 'happy' | 'content' | 'restless' | 'unhappy' | 'miserable';

export interface MoraleReason {
  /** Said plainly, from their point of view. */
  text: string;
  /** Internal. Sign is what matters to the UI; magnitude is for the tick. */
  delta: number;
}

export interface MoraleReport {
  /** What to add to their morale this week, already bounded. */
  delta: number;
  /** Why, loudest first. Empty when nothing moved. */
  reasons: MoraleReason[];
}

/**
 * Everything the week did to one person, as plain data.
 *
 * Assembled identically by the weekly tick and by the roster card, so the
 * sentence the player reads is the same sentence that moved the number.
 */
export interface MoraleContext {
  /** Did they work the show that just ran? */
  worked: boolean;
  /**
   * Where on the card, 0 = opener. Null when they did not work. The top of
   * the card is the only position anybody actually wants.
   */
  slot: number | null;
  /** How many segments the show had, so slot position scales with card size. */
  slotCount: number;
  /** Did they go over, get beaten, or neither. */
  outcome: 'won' | 'lost' | 'neither';
  /**
   * The most popular person they were beaten by, 0-100. Losing is the job;
   * losing to somebody nobody has heard of is an insult, and the gap is what
   * makes it one.
   */
  beatenByPopularity: number | null;
  /** Weeks since they were last on a show. Zero when they worked this one. */
  weeksIdle: number;
  /** How many belts they are currently holding. */
  beltsHeld: number;
  /** Everybody they get changed alongside, for the perks they can all see. */
  roster: readonly Wrestler[];
  /** Which week it is, for anything in the room that is fading. */
  currentWeek: number;
  /** What the night got, 0-100. A great show lifts the room. */
  showRating: number;
  /**
   * Was the crowd asking for something this person was part of, and did the
   * booker give it to them? This is the payoff for reading the board rather
   * than ignoring it — see world/fanDemand.ts.
   */
  gaveThemWhatTheyWanted: boolean;
  /** Allies they worked alongside this week, and enemies they were put with. */
  workedWithAllies: number;
  workedWithEnemies: number;
  /** Is the company itself worth being at? Feeds the slow drift. */
  companyRating: number;
}

/** The bits of a resolved show this needs. Structural, so no import cycle. */
export interface MoraleShow {
  showRating: number;
  segments: readonly {
    slot: number;
    participants: readonly { wrestlerId: Id; side: number; role: string }[];
    result: { winnerSide: number | null } | null;
  }[];
}

/**
 * Assemble one person's week from world state.
 *
 * Kept here rather than in the store so that the number the tick applies and
 * the sentence the roster card prints are computed from one place. A morale
 * system whose explanation is written separately from its arithmetic is a
 * morale system that lies to the player eventually.
 */
export function moraleContext(
  wrestler: Wrestler,
  show: MoraleShow | null,
  world: {
    /** Popularity of everybody who might have beaten them. */
    popularityOf: (id: Id) => number;
    /** Ids they get on with, and ids they do not. */
    alliesOf: (id: Id) => ReadonlySet<Id>;
    enemiesOf: (id: Id) => ReadonlySet<Id>;
    beltsHeldBy: (id: Id) => number;
    weeksIdle: number;
    companyRating: number;
    /** Everybody who was part of something the crowd had asked for. */
    deliveredTo: ReadonlySet<Id>;
    /** The locker room, for reading what the office gave everybody else. */
    roster: readonly Wrestler[];
    currentWeek: number;
  },
): MoraleContext {
  const segment = show?.segments.find((seg) =>
    seg.participants.some((p) => p.wrestlerId === wrestler.id && p.role === 'competitor'),
  );
  const mine = segment?.participants.find((p) => p.wrestlerId === wrestler.id);

  let outcome: MoraleContext['outcome'] = 'neither';
  let beatenByPopularity: number | null = null;
  if (segment?.result && mine) {
    const winnerSide = segment.result.winnerSide;
    if (winnerSide === null) outcome = 'neither';
    else if (winnerSide === mine.side) outcome = 'won';
    else {
      outcome = 'lost';
      // The biggest name on the winning side is who the crowd thinks beat
      // them, so that is who the loss is measured against.
      beatenByPopularity = Math.max(
        0,
        ...segment.participants
          .filter((p) => p.side === winnerSide && p.role === 'competitor')
          .map((p) => world.popularityOf(p.wrestlerId)),
      );
    }
  }

  const allies = world.alliesOf(wrestler.id);
  const enemies = world.enemiesOf(wrestler.id);
  const others = (segment?.participants ?? []).filter((p) => p.wrestlerId !== wrestler.id);

  return {
    worked: Boolean(segment),
    slot: segment?.slot ?? null,
    slotCount: show?.segments.length ?? 0,
    outcome,
    beatenByPopularity,
    weeksIdle: segment ? 0 : world.weeksIdle,
    beltsHeld: world.beltsHeldBy(wrestler.id),
    showRating: show?.showRating ?? 0,
    gaveThemWhatTheyWanted: world.deliveredTo.has(wrestler.id),
    workedWithAllies: others.filter((p) => allies.has(p.wrestlerId)).length,
    workedWithEnemies: others.filter((p) => enemies.has(p.wrestlerId)).length,
    companyRating: world.companyRating,
    roster: world.roster,
    currentWeek: world.currentWeek,
  };
}

/** The band, for the face and the colour. */
export function moodBand(morale: number, settings: WorldSettings): MoodBand {
  if (morale >= settings.moodDelightedAbove) return 'delighted';
  if (morale >= settings.moodHappyAbove) return 'happy';
  if (morale >= settings.moodContentAbove) return 'content';
  if (morale >= settings.moodRestlessAbove) return 'restless';
  if (morale >= settings.moodUnhappyAbove) return 'unhappy';
  return 'miserable';
}

/** What that band is called, from the locker room's point of view. */
export function moodLabel(band: MoodBand): string {
  switch (band) {
    case 'delighted':
      return 'Loving it here';
    case 'happy':
      return 'Happy';
    case 'content':
      return 'No complaints';
    case 'restless':
      return 'Restless';
    case 'unhappy':
      return 'Unhappy';
    case 'miserable':
      return 'Miserable';
  }
}

/**
 * How much somebody expects, 0-1.
 *
 * A draw with a big opinion of himself has a floor under what he will accept;
 * an undercard hand who nobody knows is grateful for the work. Almost every
 * term below is scaled by this, which is what stops the system from producing
 * twenty-five identically grumpy people.
 */
export function expectation(wrestler: Wrestler, settings: WorldSettings): number {
  const standing = wrestler.popularity / 100;
  const opinion = wrestler.ego / 100;
  return clamp(
    standing * settings.moraleExpectationStanding +
      opinion * settings.moraleExpectationEgo +
      // Somebody who grew up watching their father main-event does not think
      // an opener is a fair week. See career/lineage.ts — this does not lift
      // when the crowd's patience runs out, because it is what they believe
      // they are owed rather than what the fans think.
      nameBurden(wrestler, settings),
    0,
    1,
  );
}

/**
 * This week's read, with the reasons.
 *
 * Terms are deliberately small. Nothing here should swing somebody from happy
 * to walking out in a single week — that is what the event system and the
 * contract system are for. This is the slow pressure underneath them, and the
 * whole point is that it accumulates in a direction the player chose.
 */
export function weeklyMorale(
  wrestler: Wrestler,
  ctx: MoraleContext,
  settings: WorldSettings,
): MoraleReport {
  const s = settings;
  const expects = expectation(wrestler, s);
  const reasons: MoraleReason[] = [];
  const add = (text: string, delta: number) => {
    if (Math.abs(delta) < 0.05) return;
    reasons.push({ text, delta });
  };

  if (ctx.worked && ctx.slot !== null) {
    // Where on the card. The main event is the only spot anybody is actually
    // pleased about; the opener is fine if you are nobody and an insult if
    // you are not.
    const height = ctx.slotCount > 1 ? ctx.slot / (ctx.slotCount - 1) : 1;
    const position = (height - expects) * s.moralePositionWeight;
    if (height >= 0.99) {
      add('Main evented the show.', Math.max(position, s.moraleMainEventFloor));
    } else if (position >= 0) {
      add('Booked high on the card.', position);
    } else {
      add('Stuck in the undercard.', position);
    }

    switch (ctx.outcome) {
      case 'won':
        add('Went over.', s.moraleWinGain);
        break;
      case 'lost': {
        // Losing is the job. Losing to somebody the crowd has never heard of
        // is a different conversation, and the gap is the whole term.
        const gap = clamp((wrestler.popularity - (ctx.beatenByPopularity ?? 0)) / 100, 0, 1);
        if (gap >= s.moraleBadLossGap) {
          add('Beaten by somebody nobody has heard of.', -gap * s.moraleBadLossWeight);
        } else {
          add('Took the loss.', -s.moraleRoutineLoss);
        }
        break;
      }
      case 'neither':
        break;
    }

    if (ctx.workedWithAllies > 0) {
      add('Worked with a friend.', ctx.workedWithAllies * s.moraleAllyGain);
    }
    if (ctx.workedWithEnemies > 0) {
      add('Put in with somebody they cannot stand.', -ctx.workedWithEnemies * s.moraleEnemyCost);
    }
  } else if (ctx.weeksIdle > s.moraleIdleGraceWeeks) {
    // Not booked, and it has been long enough to be a pattern rather than a
    // week off. The grace period is not politeness — a roster is always
    // bigger than a card, so if missing one show cost morale then every
    // promotion would decay simply for being deep enough to run.
    //
    // Past that it compounds, and it is far worse for somebody who thinks
    // they matter.
    const weeks = ctx.weeksIdle;
    const over = weeks - s.moraleIdleGraceWeeks;
    const cost = Math.min(s.moraleIdleCap, over * s.moraleIdlePerWeek) * (s.moraleIdleFloor + expects);
    add(`${weeks} weeks now without a match.`, -cost);
  }

  if (ctx.beltsHeld > 0) {
    add(
      ctx.beltsHeld === 1 ? 'Carrying a title.' : `Carrying ${ctx.beltsHeld} titles.`,
      ctx.beltsHeld * s.moraleChampionGain,
    );
  }

  if (ctx.gaveThemWhatTheyWanted) {
    // The payoff for booking to the board rather than past it. Being the
    // thing an audience was asking for is the best week a wrestler has.
    add('The crowd had been asking for this, and got it.', s.moraleDemandDelivered);
  }

  // The night itself. Everybody in the building can tell a good show from a
  // bad one, and being part of a good one is its own thing.
  const showSwing = ((ctx.showRating - s.moraleShowNeutral) / 100) * s.moraleShowWeight;
  if (ctx.worked && showSwing > 0) add('It was a good show.', showSwing);
  if (ctx.worked && showSwing < 0) add('The show was a mess.', showSwing);

  // And a slow pull toward a set point: how good a place this is to work,
  // which is what stops morale ratcheting to an absorbing 0 or 100 and makes
  // a well-run promotion a nicer company than a badly-run one.
  //
  // Deliberately not the company rating itself. Pulling everybody toward the
  // rating meant a mid-table promotion dragged its whole locker room to
  // "restless" no matter how well it booked, which reads as the game
  // punishing you for not already being the biggest company in the world.
  // What the contract bought them, and what the office bought everybody else.
  //
  // The second half is the whole reason perks are a decision. A private
  // locker room costs a hundred and twenty dollars a week and makes one man
  // happy; the bill for it is paid weekly by everybody who watched him walk
  // through that door. See economy/perks.ts.
  if (s.perksEnabled) {
    const mine = perkMorale(wrestler);
    if (mine > 0) add('The company looks after them.', mine);

    const resented = resentmentToward(wrestler, ctx.roster, s);
    if (resented > 0) {
      const loudest = loudestPerk(ctx.roster.filter((w) => w.id !== wrestler.id));
      add(
        loudest
          ? `${loudest.holder} has a ${loudest.name.toLowerCase()}. Everybody has noticed.`
          : 'Some people around here are treated better than others.',
        -resented,
      );
    }
  }

  // The man they blame is still on the books.
  //
  // Nobody has to look at him on a card — the office will not put him on one
  // — but he is still in the room, getting changed, getting paid. That is the
  // whole reason releasing him is a decision rather than an obvious yes: he
  // costs a severance to move and a sour locker room to keep, and the booker
  // picks which. It fades on the same clock as the shunning, so a booker who
  // can afford neither can simply wait it out.
  const stillHere = ctx.roster.find(
    (other) => other.id !== wrestler.id && shunned(other.blamedFor, ctx.currentWeek, s),
  );
  if (stillHere) {
    add(
      `${stillHere.name} is still on the books after ${stillHere.blamedFor!.name}.`,
      -s.moraleBlamedInTheRoom,
    );
  }

  // A struggling outfit is a fine place to work if the booker uses you; it is
  // the booking above that decides, and this only sets the floor and ceiling.
  const setPoint = s.moraleSetPointBase + (ctx.companyRating / 100) * s.moraleSetPointRange;
  const settle = (setPoint - wrestler.morale) * s.moraleSettleRate;
  if (settle >= s.moraleSettleReportable) add('This is a good company to be at.', settle);
  else if (settle <= -s.moraleSettleReportable) add('The company is going backwards.', settle);
  else if (Math.abs(settle) >= 0.05) reasons.push({ text: '', delta: settle });

  const delta = clamp(
    reasons.reduce((sum, r) => sum + r.delta, 0),
    -s.moraleWeeklyCap,
    s.moraleWeeklyCap,
  );
  return {
    delta,
    reasons: reasons.filter((r) => r.text).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
  };
}

/**
 * The one line the roster card shows.
 *
 * The loudest thing acting on them right now, so the player can act on it
 * without opening anything. Falls back to the mood itself when the week was
 * genuinely uneventful — "No complaints" is a real answer.
 */
export function moraleSummary(wrestler: Wrestler, settings: WorldSettings): string {
  return wrestler.moraleNote ?? moodLabel(moodBand(wrestler.morale, settings));
}

/** Everybody who is unhappy enough to be a problem, worst first. */
export function troubleInTheRoom(
  roster: readonly Wrestler[],
  settings: WorldSettings,
): Wrestler[] {
  return roster
    .filter((w) => moodBand(w.morale, settings) === 'unhappy' || moodBand(w.morale, settings) === 'miserable')
    .sort((a, b) => a.morale - b.morale);
}

/**
 * Who a demand was about, as ids, so the tick can hand out the bonus without
 * fanDemand needing to know anything about morale.
 */
export function deliveredTo(delivered: readonly { wrestlerIds: Id[]; kind: string }[]): Set<Id> {
  const ids = new Set<Id>();
  for (const demand of delivered) {
    // "Enough of him" is answered by leaving somebody off. Nobody is pleased
    // about being rested, so it pays the show and not the person.
    if (demand.kind === 'enoughOfHim') continue;
    for (const id of demand.wrestlerIds) ids.add(id);
  }
  return ids;
}
