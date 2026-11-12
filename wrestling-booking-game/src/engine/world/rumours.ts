// What the internet has heard.
//
// The wire is what happened. This is what people think is *about* to happen,
// and it is the only channel in the game that is allowed to be wrong.
//
// The rule, and the whole reason it is worth having:
//
//   One person saying a thing is noise. Three people saying versions of the
//   same thing is a signal.
//
// So a rumour is not a fact with a confidence attached — it is a number of
// voices. A true thing that is close and obvious gets several fans repeating
// it in different words. A true thing nobody has really noticed yet gets one.
// And a false one — somebody's guess, somebody's wishful thinking, somebody
// deliberately stirring — also gets one, and occasionally gets two, which is
// what stops counting from being a lie detector.
//
// That last part is deliberate and it should not be balanced away. If echoes
// mapped perfectly onto truth the feed would be an oracle and the reading of
// it would stop being a skill. The booker who acts on every double-echo will
// be wrong sometimes, and being wrong sometimes is the price of the feed
// being worth reading at all.
//
// It works in both directions. Three people saying somebody looks like the
// best thing in the company is as much a signal as three people saying he is
// about to walk — §0 asks for information, not warnings, and good news is
// information.

import type { Rng } from '../rng';
import { chance, pick } from '../rng';
import type { Pronouns } from '../career/pronouns';
import type { WorldSettings } from '../types';

/** What kind of thing is being whispered about. */
export type RumourKind =
  /** Somebody is on their way out of a group. */
  | 'defection'
  /** A group is circling somebody. */
  | 'recruitment'
  /** Two people cannot stand each other, and it is not worked. */
  | 'badBlood'
  /** Somebody is working hurt. */
  | 'workingHurt'
  /** Somebody is not going to re-sign. */
  | 'walkingOut'
  /** Somebody is the best thing in the company right now. */
  | 'onFire';

export interface Rumour {
  kind: RumourKind;
  /** Who it is about. */
  subject: string;
  /** The other party, when there is one. */
  other?: string;
  /**
   * How the feed refers to the subject. Required rather than optional: every
   * one of these lines used to say "he" about a roster that is a good deal
   * more than men, which is the second time that has happened here.
   */
  who: Pronouns;
  /**
   * Whether it is actually true. Never shown — it decides how many voices
   * pick it up, and nothing else.
   */
  true: boolean;
  /**
   * 0-1, how far along the real thing is. A true rumour about something
   * imminent gets more voices than a true rumour about something that has
   * only just started to be a possibility.
   */
  heat: number;
}

/**
 * How many fans are saying it.
 *
 * The signal the player is actually reading. True and imminent gets a chorus;
 * true and early gets one voice, same as a made-up one — which is what makes
 * an early read a genuine edge rather than a free answer.
 *
 * A false rumour can reach two. It cannot reach three: at some point the
 * feed has to be worth trusting, or reading it is just superstition.
 */
export function voicesFor(rumour: Rumour, rng: Rng, settings: WorldSettings): number {
  if (!rumour.true) {
    return chance(rng, settings.rumourFalseSecondVoice) ? 2 : 1;
  }
  const earned = 1 + Math.floor(rumour.heat * settings.rumourMaxVoices);
  // Even a true, obvious thing occasionally only gets one person saying it,
  // because somebody has to be first.
  return chance(rng, settings.rumourTrueGoesQuiet) ? 1 : Math.min(settings.rumourMaxVoices, earned);
}

/**
 * The different ways the same whisper gets said.
 *
 * Several phrasings per kind on purpose: three fans posting identical text is
 * a bug report, three fans posting the same idea in their own words is a
 * rumour. The player is meant to notice the *idea* repeating.
 */
const WHISPERS: Record<RumourKind, string[]> = {
  defection: [
    'hearing {subject} is done with the group. watch that space',
    'something is off with {subject} and the rest of them. body language all wrong',
    'somebody backstage says {subject} has been asking about going out alone',
    '{subject} stood way off from the rest of them tonight. nobody else clock that?',
  ],
  recruitment: [
    'they have been circling {subject} for weeks. it is happening',
    '{subject} keeps turning up in the background of their segments. that is not an accident',
    'calling it now: {subject} joins them inside a month',
    'why is {subject} suddenly hanging around with that lot',
  ],
  badBlood: [
    '{subject} and {other} is not a work. that is a real problem',
    'something genuinely wrong between {subject} and {other}. that was not a spot',
    'no way {subject} and {other} were pretending there. somebody is getting hurt',
    'the stiff shots between {subject} and {other} are getting hard to watch',
  ],
  workingHurt: [
    '{subject} is hurt. you can see it every time {they} plant that leg',
    'somebody get {subject} off the road, {they} are moving like somebody twice {their} age',
    'that is not selling, {subject} is actually injured',
    '{subject} has been protecting something for weeks now',
  ],
  walkingOut: [
    'hearing {subject} has not signed anything and is not going to',
    '{subject} to a rival promotion is the worst kept secret in the business',
    'that felt like a goodbye from {subject} and i do not like it',
    'nobody books somebody like that unless they are already gone. {subject} is out',
  ],
  onFire: [
    '{subject} is the best thing in this company and it is not close',
    'every week {subject} goes out there and steals it. every week',
    'put the belt on {subject}. what are we even doing',
    'i did not care about {subject} six months ago and now i plan my week around {them}',
  ],
};

/**
 * Turn a rumour into the lines the feed prints.
 *
 * Returns between one and a few, and never repeats a phrasing — that is what
 * makes a chorus read as several people rather than one person shouting.
 */
export function rumourTweets(rumour: Rumour, rng: Rng, settings: WorldSettings): string[] {
  const phrasings = [...WHISPERS[rumour.kind]];
  const voices = Math.min(voicesFor(rumour, rng, settings), phrasings.length);
  const out: string[] = [];
  for (let i = 0; i < voices; i++) {
    const index = Math.floor(rng.next() * phrasings.length);
    const [phrasing] = phrasings.splice(index, 1);
    if (!phrasing) break;
    out.push(
      phrasing
        .replace(/\{subject\}/g, rumour.subject)
        .replace(/\{other\}/g, rumour.other ?? 'somebody')
        .replace(/\{they\}/g, rumour.who.they)
        .replace(/\{them\}/g, rumour.who.them)
        .replace(/\{their\}/g, rumour.who.their),
    );
  }
  return out;
}

/**
 * The ones that are not about anything.
 *
 * A feed of nothing but real signals is a feed where every line is worth
 * acting on, and then the player is not reading it, he is obeying it. Planted
 * rumours are the reason attention is a resource.
 */
export function inventRumour(
  rng: Rng,
  candidates: readonly { name: string; other?: string; who: Pronouns }[],
  kinds: readonly RumourKind[],
): Rumour | null {
  if (candidates.length === 0 || kinds.length === 0) return null;
  const pickedOne = pick(rng, [...candidates]);
  return {
    kind: pick(rng, [...kinds]),
    subject: pickedOne.name,
    other: pickedOne.other,
    who: pickedOne.who,
    true: false,
    heat: 0,
  };
}
