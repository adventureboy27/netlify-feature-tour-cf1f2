// Two men on a headset, calling a match that has already happened.
//
// The player never watches a match — that is the first line of the brief and
// it is not moving. What was missing is that a highlight write-up is a
// *report*, and a report is not a broadcast. You read four sentences about a
// match and you know the result; you never find out what it was like to sit
// through it.
//
// So: a call. A play-by-play voice describing the action, and a colour voice
// beside them talking about everything else — the manager who has not got off
// the apron, the official who is about to lose control of this, the belt on
// the line, the fact that one of these two is very obviously hurt. They talk
// to each other. One of them likes the villain rather more than he should.
//
// Three rules, in the words they were asked for.
//
//   IT MUST PERTAIN TO THE MATCH. Not to wrestling in general, not to a
//   generic near-fall, but to *these* wrestlers, *these* managers, *this*
//   official, *this* championship. So a colour line is never chosen because
//   it is time for one — it is chosen because a fact is true, and every
//   template declares the facts it requires. If nothing is true, nobody says
//   anything. A quiet call is a better call than one that invents a manager.
//
//   IT MUST FLOW. A match has a shape and so does the call: somebody takes
//   over, somebody fights back, there is a near thing, and then it ends. The
//   caller tracks who is on top and hands the advantage over at the moment
//   the simulation says it turned, so consecutive lines describe one
//   continuous fight rather than a pile of unrelated observations.
//
//   IT MUST MAKE SENSE. Which mostly means: nobody on commentary knows how
//   it ends. Every line before the finish talks about who is in control and
//   who is in trouble — never about the winner, because at that point in the
//   night there isn't one yet.
//
// The result is decided long before this runs. This narrates it and cannot
// change it, which is exactly why it can be as dramatic as it likes.

import type { Rng } from '../rng';
import { pick, chance } from '../rng';
import type { FinishType, Id, MatchBeat, MatchBeatKind, Title, Wrestler, WorldSettings } from '../types';
import {
  PLAY_BY_PLAY,
  COLOUR,
  BANTER,
  COMEBACKS,
  OPENERS,
  STAKES,
  CLOSERS,
  type ColourTemplate,
  type Leaning,
} from '../../data/commentaryLines';

/**
 * Everything a colour line is allowed to be about.
 *
 * This list is the contract. A template may only use a placeholder backed by
 * a fact it has declared, and a fact is only set when the engine has verified
 * it — so a line about a manager cannot appear in a match with no manager in
 * it, and a line about a belt cannot appear when nothing is on the line.
 */
export type CommentaryFact =
  | 'manager'
  | 'deviousManager'
  | 'referee'
  | 'refereeMiss'
  | 'guestReferee'
  | 'title'
  | 'titleChange'
  | 'titleRetained'
  | 'longReign'
  | 'grudge'
  | 'injuredInMatch'
  | 'carryingInjury'
  | 'incident'
  | 'stipulation'
  | 'mainEvent'
  | 'interference'
  | 'hotCrowd'
  | 'flatCrowd'
  | 'greatMatch'
  | 'poorMatch'
  | 'veteran'
  | 'rookie'
  | 'sizeGap'
  | 'upset'
  | 'tagMatch'
  // These three depend on where the match is *right now*, not on what was
  // true before the bell. Without them the colour man says "the kid is
  // learning something and it is costing him" about the man who is currently
  // beating somebody up, which is the exact kind of nonsense that makes a
  // call worse than no call. Recomputed at every beat.
  | 'rookieInTrouble'
  | 'vetInTrouble'
  | 'smallInTrouble';

export type Speaker = 'play' | 'colour';

export interface CommentaryLine {
  speaker: Speaker;
  /** Whose mouth it came out of, so the window can put a name on it. */
  name: string;
  text: string;
}

/** Who is on the headset. Stored on the promotion so it never changes mid-run. */
export interface CommentaryTeam {
  playByPlayName: string;
  colourName: string;
  /** Which way the colour man leans. This is where the arguing comes from. */
  leaning: Leaning;
}

export interface CommentaryContext {
  team: CommentaryTeam;
  /**
   * The two corners, in the order they were booked rather than by result.
   * The call works from these, because at the time it is being called nobody
   * knows which is which.
   */
  sideA: readonly Wrestler[];
  sideB: readonly Wrestler[];
  /** Which of the two went over. Used only for the finish and the wrap-up. */
  winningSide: 'a' | 'b' | null;
  /** Managers at ringside and whose corner they are in. Empty is common. */
  managers: readonly { name: string; clientName: string; devious: boolean }[];
  refereeName: string | null;
  /** A wrestler in the shirt rather than an official. */
  guestRefereeName: string | null;
  /** What the official missed, said plainly. Null when he called it straight. */
  refereeMiss: string | null;
  titles: readonly Title[];
  /** Who walked in holding it, and for how long. */
  championName: string | null;
  championWeeks: number;
  titleChanged: boolean;
  stipulationName: string | null;
  /** Real animosity, 0-100. */
  shootHeat: number;
  isMainEvent: boolean;
  finish: FinishType;
  rating: number;
  /** The beats the match actually produced. This is the spine of the call. */
  beats: readonly MatchBeat[];
  /** Who got hurt in this match, and the sentence about it. */
  injuries: readonly { name: string; text: string }[];
  /** Somebody who walked in already carrying something. */
  hurtComingIn: string | null;
  /** Something nobody booked. */
  incidentText: string | null;
  /** How the building was, from attendance against capacity. */
  crowd: 'hot' | 'warm' | 'flat';
  /** The winner was a heavy underdog on paper. */
  upset: boolean;
  /**
   * Colour lines already used elsewhere on tonight's card, so the same
   * observation is not made about four different matches in one evening.
   * The caller adds to it. Measured: without this, "the official is losing
   * this one" turned up in four of six matches on the same show.
   */
  saidTonight?: Set<string>;
  settings: WorldSettings;
}

/** Which of the fact keys are true of this match. */
export function factsOf(ctx: CommentaryContext): Set<CommentaryFact> {
  const s = ctx.settings;
  const facts = new Set<CommentaryFact>();
  const everyone = [...ctx.sideA, ...ctx.sideB];

  if (ctx.managers.length > 0) facts.add('manager');
  if (ctx.managers.some((m) => m.devious)) facts.add('deviousManager');
  if (ctx.refereeName) facts.add('referee');
  if (ctx.refereeMiss) facts.add('refereeMiss');
  if (ctx.guestRefereeName) facts.add('guestReferee');
  if (ctx.titles.length > 0) facts.add('title');
  if (ctx.titles.length > 0 && ctx.titleChanged) facts.add('titleChange');
  if (ctx.titles.length > 0 && !ctx.titleChanged && ctx.championName) facts.add('titleRetained');
  if (ctx.titles.length > 0 && ctx.championName && ctx.championWeeks >= s.commentaryLongReignWeeks) {
    facts.add('longReign');
  }
  if (ctx.shootHeat >= s.commentaryGrudgeHeat) facts.add('grudge');
  if (ctx.injuries.length > 0) facts.add('injuredInMatch');
  if (ctx.hurtComingIn) facts.add('carryingInjury');
  if (ctx.incidentText) facts.add('incident');
  if (ctx.stipulationName) facts.add('stipulation');
  if (ctx.isMainEvent) facts.add('mainEvent');
  if (ctx.finish === 'interference' || ctx.finish === 'disqualification') facts.add('interference');
  if (ctx.crowd === 'hot') facts.add('hotCrowd');
  if (ctx.crowd === 'flat') facts.add('flatCrowd');
  if (ctx.rating >= s.commentaryGreatMatch) facts.add('greatMatch');
  if (ctx.rating <= s.commentaryPoorMatch) facts.add('poorMatch');
  if (everyone.some((w) => w.age >= s.scoutOldAge)) facts.add('veteran');
  if (everyone.some((w) => w.age <= s.commentaryRookieAge)) facts.add('rookie');
  if (ctx.sideA.length > 1 || ctx.sideB.length > 1) facts.add('tagMatch');
  if (ctx.upset) facts.add('upset');

  // Weight, not billing: two men of the same size do not make a size story.
  const weights = everyone.map((w) => w.weightLbs).filter((n): n is number => typeof n === 'number');
  if (weights.length >= 2 && Math.max(...weights) - Math.min(...weights) >= s.commentarySizeGapLbs) {
    facts.add('sizeGap');
  }

  return facts;
}

/** Who is on top at this moment in the match, and who is in trouble. */
interface Momentum {
  onTop: readonly Wrestler[];
  inTrouble: readonly Wrestler[];
}

/**
 * The facts that are only true at this instant.
 *
 * Everything in factsOf is settled before the bell — there is a manager, a
 * belt is on the line, one of them is 45 years old. These three are about
 * who is currently getting beaten up, which changes at the hope spot, so a
 * line that comments on somebody struggling has to be re-checked every beat.
 */
function momentumFacts(ctx: CommentaryContext, momentum: Momentum): Set<CommentaryFact> {
  const s = ctx.settings;
  const facts = new Set<CommentaryFact>();
  const everyone = [...ctx.sideA, ...ctx.sideB];
  const lightest = [...everyone].sort((a, b) => (a.weightLbs ?? 0) - (b.weightLbs ?? 0))[0];

  if (momentum.inTrouble.some((w) => w.age <= s.commentaryRookieAge)) facts.add('rookieInTrouble');
  if (momentum.inTrouble.some((w) => w.age >= s.scoutOldAge)) facts.add('vetInTrouble');
  if (lightest && momentum.inTrouble.some((w) => w.id === lightest.id)) facts.add('smallInTrouble');
  return facts;
}

/**
 * Fill in the names.
 *
 * `{onTop}` and `{inTrouble}` are the two the caller can legitimately talk
 * about mid-match. `{winner}` and `{loser}` exist only for the finish call
 * and the wrap-up, because before the bell nobody on the headset knows.
 *
 * Every other placeholder resolves to something the engine has verified: a
 * template that uses {manager} declared the 'manager' fact, so the lookup
 * cannot come back empty for a line that was actually chosen. The fallbacks
 * exist so a bug produces a slightly flat sentence rather than the word
 * "undefined" on the player's screen.
 */
function filler(ctx: CommentaryContext, rng: Rng) {
  const winners = ctx.winningSide === 'b' ? ctx.sideB : ctx.sideA;
  const losers = ctx.winningSide === 'b' ? ctx.sideA : ctx.sideB;
  const everyone = [...ctx.sideA, ...ctx.sideB];
  const manager = ctx.managers.length > 0 ? pick(rng, [...ctx.managers]) : null;
  const byWeight = [...everyone].sort((a, b) => (b.weightLbs ?? 0) - (a.weightLbs ?? 0));
  const hurt = ctx.injuries[0];

  return (text: string, momentum: Momentum): string => {
    // Where two people qualify, the one the line is about is the one it is
    // happening to. "There is a lot of mileage on him" is about the veteran
    // being worn down, not the veteran doing the wearing.
    const veteran =
      momentum.inTrouble.find((w) => w.age >= ctx.settings.scoutOldAge) ??
      everyone.find((w) => w.age >= ctx.settings.scoutOldAge);
    const rookie =
      momentum.inTrouble.find((w) => w.age <= ctx.settings.commentaryRookieAge) ??
      everyone.find((w) => w.age <= ctx.settings.commentaryRookieAge);
    return text
      .replace(/\{play\}/g, ctx.team.playByPlayName)
      .replace(/\{colour\}/g, ctx.team.colourName)
      .replace(/\{onTop\}/g, momentum.onTop[0]?.name ?? 'the man in control')
      .replace(/\{onTopPartner\}/g, momentum.onTop[1]?.name ?? momentum.onTop[0]?.name ?? 'his partner')
      .replace(/\{inTrouble\}/g, momentum.inTrouble[0]?.name ?? 'the other one')
      .replace(
        /\{inTroublePartner\}/g,
        momentum.inTrouble[1]?.name ?? momentum.inTrouble[0]?.name ?? 'his partner',
      )
      .replace(/\{winner\}/g, winners[0]?.name ?? 'the winner')
      .replace(/\{loser\}/g, losers[0]?.name ?? 'their opponent')
      .replace(/\{sideA\}/g, ctx.sideA[0]?.name ?? 'one corner')
      .replace(/\{sideB\}/g, ctx.sideB[0]?.name ?? 'the other')
      .replace(/\{finisher\}/g, momentum.onTop[0]?.moveSet?.finisher?.name ?? 'the finish')
      .replace(/\{winnerFinisher\}/g, winners[0]?.moveSet?.finisher?.name ?? 'the finish')
      .replace(/\{manager\}/g, manager?.name ?? 'the manager')
      .replace(/\{managerClient\}/g, manager?.clientName ?? ctx.sideA[0]?.name ?? 'his man')
      .replace(/\{ref\}/g, ctx.refereeName ?? ctx.guestRefereeName ?? 'the official')
      .replace(/\{guestRef\}/g, ctx.guestRefereeName ?? 'the guest official')
      .replace(/\{refMiss\}/g, ctx.refereeMiss ?? 'missed it')
      .replace(/\{title\}/g, ctx.titles[0]?.name ?? 'the championship')
      .replace(/\{champion\}/g, ctx.championName ?? ctx.sideA[0]?.name ?? 'the champion')
      .replace(/\{reign\}/g, String(Math.max(1, ctx.championWeeks)))
      .replace(/\{stip\}/g, ctx.stipulationName ?? 'this')
      .replace(/\{hurt\}/g, hurt?.name ?? losers[0]?.name ?? 'somebody')
      .replace(/\{hurtHow\}/g, hurt?.text ?? 'landed badly')
      .replace(/\{hurtComingIn\}/g, ctx.hurtComingIn ?? losers[0]?.name ?? 'somebody')
      .replace(/\{incident\}/g, ctx.incidentText ?? 'that')
      .replace(/\{vet\}/g, veteran?.name ?? everyone[0]?.name ?? 'the veteran')
      .replace(/\{rookie\}/g, rookie?.name ?? everyone[0]?.name ?? 'the kid')
      .replace(/\{big\}/g, byWeight[0]?.name ?? everyone[0]?.name ?? 'the bigger man')
      .replace(/\{small\}/g, byWeight[byWeight.length - 1]?.name ?? everyone[0]?.name ?? 'the smaller man');
  };
}

/** Templates whose every declared fact is true, and which fit this leaning. */
function eligible(
  templates: readonly ColourTemplate[],
  facts: ReadonlySet<CommentaryFact>,
  leaning: Leaning,
  used: ReadonlySet<string>,
  after: MatchBeatKind | null,
): ColourTemplate[] {
  return templates.filter((t) => {
    if (used.has(t.text)) return false;
    if (t.leaning && t.leaning !== leaning) return false;
    // A template that only makes sense at a particular point in the match
    // says so; one with no `after` fits anywhere.
    if (t.after && (after === null || !t.after.includes(after))) return false;
    return t.needs.every((fact) => facts.has(fact));
  });
}

/**
 * Call the match.
 *
 * Walks the beats the simulation produced, tracking who is on top. Each beat
 * gets a play-by-play line in the caller's voice; some get a colour line
 * after, chosen from whatever is actually true; a few of those get answered
 * back. The order is the match's own order, which is what makes it flow.
 */
export function callTheMatch(rng: Rng, ctx: CommentaryContext): CommentaryLine[] {
  const s = ctx.settings;
  const fill = filler(ctx, rng);
  const facts = factsOf(ctx);
  const lines: CommentaryLine[] = [];
  // Seeded with whatever the colour man has already said elsewhere tonight.
  // An observation is only worth making once an evening.
  const usedColour = new Set<string>(ctx.saidTonight ?? []);
  /** Only what this match has used — the floor the night-wide set falls back to. */
  const usedThisMatch = new Set<string>();
  const usedPlay = new Set<string>();
  const remember = (text: string) => {
    usedColour.add(text);
    usedThisMatch.add(text);
    ctx.saidTonight?.add(text);
  };

  const winners = ctx.winningSide === 'b' ? ctx.sideB : ctx.sideA;
  const losers = ctx.winningSide === 'b' ? ctx.sideA : ctx.sideB;

  // The classic shape, and the one the beat list is already written for: the
  // side that ends up losing takes over first, the other one fights out of
  // it, and the comeback runs into the finish. Starting with the eventual
  // winner on top would make the hope spot and the near-fall read backwards.
  let momentum: Momentum = { onTop: losers, inTrouble: winners };
  const turnOver = () => {
    momentum = { onTop: momentum.inTrouble, inTrouble: momentum.onTop };
  };

  const play = (text: string) =>
    lines.push({ speaker: 'play', name: ctx.team.playByPlayName, text: fill(text, momentum) });
  const colour = (text: string) =>
    lines.push({ speaker: 'colour', name: ctx.team.colourName, text: fill(text, momentum) });

  // ---- who, and what for -------------------------------------------------
  // The call always opens by saying what this is. Without it the first line
  // of action lands on somebody who does not know who is in the ring.
  const openers = OPENERS.filter((t) => t.needs.every((f) => facts.has(f)));
  play(pick(rng, openers.length > 0 ? openers : OPENERS.filter((t) => t.needs.length === 0)).text);

  const freshStakes = eligible(STAKES, facts, ctx.team.leaning, usedColour, null);
  const stakes =
    freshStakes.length > 0 ? freshStakes : eligible(STAKES, facts, ctx.team.leaning, usedThisMatch, null);
  if (stakes.length > 0) {
    const chosen = pick(rng, stakes);
    remember(chosen.text);
    colour(chosen.text);
  }

  // ---- the match ---------------------------------------------------------
  const budget = s.commentaryMaxLines;
  const finishBeat = ctx.beats.find((b) => b.kind === 'finish') ?? null;

  for (const beat of ctx.beats) {
    if (beat.kind === 'finish') continue;
    // Two lines held back: the finish call, and something after it.
    if (lines.length >= budget - 2) break;

    // A hope spot *is* the turn. Handing the advantage over here is the whole
    // reason consecutive lines read as one fight.
    if (beat.kind === 'hopeSpot') turnOver();

    const options = (PLAY_BY_PLAY[beat.kind] ?? []).filter((t) => !usedPlay.has(t));
    if (options.length > 0) {
      const line = pick(rng, options);
      usedPlay.add(line);
      play(line);
    } else {
      // Nothing left in the caller's vocabulary for this kind of beat. The
      // written highlight is still true and still about this match, which
      // makes it a better fallback than saying the same thing twice.
      play(beat.text);
    }

    // And then the man beside him — but only if there is something real to
    // say. This is the whole discipline: no fact, no line.
    if (!chance(rng, s.commentaryColourChance)) continue;
    const nowFacts = new Set([...facts, ...momentumFacts(ctx, momentum)]);
    // Prefer something he has not said tonight; fall back to the match's own
    // used-set if the night has exhausted the pool. A hard night-wide block
    // was systematically silencing him on the last two matches of every card
    // — which is precisely where the main event is.
    const fresh = eligible(COLOUR, nowFacts, ctx.team.leaning, usedColour, beat.kind);
    const available =
      fresh.length > 0 ? fresh : eligible(COLOUR, nowFacts, ctx.team.leaning, usedThisMatch, beat.kind);
    if (available.length === 0) continue;
    const chosen = pick(rng, available);
    remember(chosen.text);
    colour(chosen.text);

    // Some of what he says is worth arguing with.
    if (chosen.provocative && lines.length < budget - 2 && chance(rng, s.commentaryComebackChance)) {
      const comebacks = COMEBACKS.filter(
        (t) => !usedPlay.has(t.text) && (!t.leaning || t.leaning === ctx.team.leaning),
      );
      if (comebacks.length > 0) {
        const answer = pick(rng, comebacks);
        usedPlay.add(answer.text);
        play(answer.text);
      }
    }
  }

  // ---- the finish --------------------------------------------------------
  // Always called, always by the play-by-play man, always the last of the
  // action. A call that runs out of room before the finish has failed.
  momentum = { onTop: winners, inTrouble: losers };
  const finishCalls = (PLAY_BY_PLAY.finish ?? []).filter((t) => !usedPlay.has(t));
  play(finishCalls.length > 0 ? pick(rng, finishCalls) : (finishBeat?.text ?? '{winner} takes it.'));

  // ---- and out -----------------------------------------------------------
  const freshClosers = eligible(CLOSERS, facts, ctx.team.leaning, usedColour, null);
  const closers =
    freshClosers.length > 0 ? freshClosers : eligible(CLOSERS, facts, ctx.team.leaning, usedThisMatch, null);
  if (closers.length > 0) {
    const chosen = pick(rng, closers);
    remember(chosen.text);
    if (chosen.speaker === 'play') play(chosen.text);
    else colour(chosen.text);
  }

  // A last word, when the night has earned it and there is room. Gated on
  // facts like everything else — two men agreeing that was a hell of a match
  // is only worth printing when it was one.
  if (lines.length < budget && chance(rng, s.commentaryBanterChance)) {
    const banter = eligible(BANTER, facts, ctx.team.leaning, usedColour, null);
    if (banter.length > 0) {
      const chosen = pick(rng, banter);
      remember(chosen.text);
      if (chosen.speaker === 'play') play(chosen.text);
      else colour(chosen.text);
    }
  }

  return lines.slice(0, budget);
}

/** Give a promotion its broadcast team. Deterministic from the world's rng. */
export function assignCommentaryTeam(
  rng: Rng,
  pool: readonly CommentaryTeam[],
  taken: ReadonlySet<string>,
): CommentaryTeam {
  const free = pool.filter((t) => !taken.has(t.playByPlayName));
  return pick(rng, free.length > 0 ? free : [...pool]);
}

/**
 * Every proper noun a call is allowed to contain.
 *
 * This is the rule the module exists for, made checkable: if a name appears
 * in the call that was not in the match, the call is wrong. See the test.
 */
export function permittedNames(ctx: CommentaryContext): Set<string> {
  const names = new Set<Id>();
  for (const w of [...ctx.sideA, ...ctx.sideB]) {
    names.add(w.name);
    // A finisher is a proper noun the call is allowed to say, because it
    // belongs to somebody who is in the match.
    if (w.moveSet?.finisher?.name) names.add(w.moveSet.finisher.name);
  }
  for (const m of ctx.managers) {
    names.add(m.name);
    names.add(m.clientName);
  }
  if (ctx.refereeName) names.add(ctx.refereeName);
  if (ctx.guestRefereeName) names.add(ctx.guestRefereeName);
  if (ctx.championName) names.add(ctx.championName);
  if (ctx.hurtComingIn) names.add(ctx.hurtComingIn);
  for (const t of ctx.titles) names.add(t.name);
  for (const i of ctx.injuries) names.add(i.name);
  names.add(ctx.team.playByPlayName);
  names.add(ctx.team.colourName);
  return names;
}
