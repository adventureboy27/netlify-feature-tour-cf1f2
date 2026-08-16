// A wrestler's body, what has already happened to it, and what he intends to
// do about the next thing.
//
// Three connected ideas, and one trait underneath all of them.
//
// **The trait.** `selfPreservation` is how a person regards his own future.
// High is the man who takes the insurance, takes the weeks off, and intends to
// walk his daughter down the aisle without a stick. Low is the man who thinks
// he is made of something other people are not, wants the money in cash now,
// and will tape it up and go out there. Neither is a flaw. The reckless one is
// frequently the better draw, which is exactly why the choice is hard.
//
// **The history.** Injuries used to be a field that healed and vanished. A man
// could tear a knee three times in five years and the game would not remember
// the first two. They are now written down, dated, and carried for the rest of
// his life — which is what makes a body a story rather than a status icon, and
// what a booker is really reading when he decides whether to re-sign somebody
// at thirty-eight.
//
// **The two opinions.** When somebody gets hurt there are two views on it: the
// doctor's, and his. The doctor says a number of weeks. The wrestler says what
// he intends to do. They frequently disagree, and the disagreement is the
// interesting part — a man can come back early and get away with it, come back
// early and turn eight weeks into a career, or not come back at all.
//
// The game does not warn about any of this (§0). It reports both opinions and
// lets the booker decide who to listen to.

import type { Rng } from '../rng';
import { chance, clamp, rngFromSeed } from '../rng';
import type { Injury, InjurySeverity, Wrestler, WorldSettings } from '../types';

/**
 * How much this person cares about his own future, 0-1.
 *
 * Defaulted rather than assumed present: the trait is newer than the saves and
 * the fixtures, and somebody the game has no opinion about should be treated
 * as ordinary rather than as reckless. Reading it raw produced NaN, which
 * silently poisoned every contract length it touched.
 */
export function careOf(wrestler: Wrestler, settings: WorldSettings): number {
  return clamp(wrestler.selfPreservation ?? settings.selfPreservationDefault, 0, 100) / 100;
}

// ---------------------------------------------------------------- the history

export interface InjuryRecord {
  /** What it was, in the words the write-up used. */
  what: string;
  severity: InjurySeverity;
  /** The year it happened, because that is how anybody talks about it. */
  year: number;
  week: number;
  /** How long it actually kept him out, once everything had played out. */
  weeksOut: number;
  /** Whether he ignored the doctor over it. Remembered — see `recklessHistory`. */
  workedThroughIt: boolean;
}

/** Write it down. Called when the injury happens, not when it heals. */
export function recordInjury(
  history: readonly InjuryRecord[],
  injury: Injury,
  year: number,
  workedThroughIt = false,
): InjuryRecord[] {
  return [
    ...history,
    {
      what: injury.description,
      severity: injury.severity,
      year,
      week: injury.sufferedWeek,
      weeksOut: injury.totalWeeks,
      workedThroughIt,
    },
  ];
}

/** "Torn ACL, 2023." How a body gets talked about. */
export function injuryLine(record: InjuryRecord): string {
  return `${record.what}, ${record.year}`;
}

/**
 * The body as one sentence, for a profile.
 *
 * Counts rather than lists, past a point: a twenty-year career with eleven
 * entries is a paragraph nobody reads, and "a long history of injuries" is the
 * thing a booker actually needs to know.
 */
export function bodyLine(history: readonly InjuryRecord[], settings: WorldSettings): string | null {
  if (history.length === 0) return null;

  const bad = history.filter((r) => r.severity === 'severe' || r.severity === 'careerThreatening');
  const recent = [...history].sort((a, b) => b.year - a.year)[0]!;

  if (history.length >= settings.bodyLongHistoryCount) {
    return `A long history of injuries. Most recently ${injuryLine(recent).toLowerCase()}.`;
  }
  if (bad.length > 0) {
    const worst = bad[bad.length - 1]!;
    return `${injuryLine(worst)}. Never quite the same after it.`;
  }
  return `${injuryLine(recent)}.`;
}

/** How many times he has ignored a doctor. The business notices. */
export function recklessHistory(history: readonly InjuryRecord[]): number {
  return history.filter((r) => r.workedThroughIt).length;
}

// ---------------------------------------------------------------- the doctor

export interface DoctorsOpinion {
  /** Weeks out, as the doctor sees it. */
  weeks: number;
  /** What the doctor says, in words. */
  verdict: string;
  /** True when the doctor is saying the career is the question, not the date. */
  grave: boolean;
}

/**
 * What the doctor says.
 *
 * Straight, and slightly conservative — a doctor's job is the man's next
 * twenty years and not the booker's next twenty weeks, and this one does that
 * job honestly. The number here is the *baseline*; what actually happens
 * depends on which opinion the booker follows.
 */
export function doctorsOpinion(injury: Injury, wrestler: Wrestler, settings: WorldSettings): DoctorsOpinion {
  // Age and a used-up body both add to it. The same tear costs a man of forty
  // longer than a man of twenty-four, which is not a moral judgement, it is
  // how tissue works.
  const wear = 1 + Math.max(0, wrestler.age - settings.veteranAge) * settings.doctorAgePerYear;
  const condition = 1 + ((100 - clamp(wrestler.health, 0, 100)) / 100) * settings.doctorConditionWeight;
  const weeks = Math.max(1, Math.round(injury.totalWeeks * wear * condition));

  const grave = injury.severity === 'careerThreatening';
  const verdict = grave
    ? `The doctor will not put a date on it. He wants to talk about whether there is a career here at all.`
    : `The doctor says ${weeks} ${weeks === 1 ? 'week' : 'weeks'}, and means it.`;

  return { weeks, verdict, grave };
}

// ---------------------------------------------------------------- and the man

export type InjuryIntent = 'restProperly' | 'comeBackEarly' | 'workThroughIt';

export interface WrestlersOpinion {
  intent: InjuryIntent;
  /** What he says about it. */
  says: string;
}

/**
 * What the wrestler intends to do, which is a different question entirely.
 *
 * Driven by how he regards his own future, pushed by how badly he wants to be
 * out there, and pulled back — a little — by every time this has already
 * happened to him. A man on his fourth knee operation is less sure he is
 * indestructible than he was on his first.
 */
export function wrestlersOpinion(
  wrestler: Wrestler,
  history: readonly InjuryRecord[],
  rng: Rng,
  settings: WorldSettings,
): WrestlersOpinion {
  const care =
    careOf(wrestler, settings) +
    history.length * settings.bodyHistoryTeachesCaution -
    (wrestler.ego / 100) * settings.bodyEgoRecklessness;

  const reckless = clamp(1 - care, 0, 1);

  if (chance(rng, reckless * settings.bodyWorkThroughChance)) {
    return {
      intent: 'workThroughIt',
      says: `${wrestler.name} says he is fine and wants to be on the next show. He is not fine.`,
    };
  }
  if (chance(rng, reckless)) {
    return {
      intent: 'comeBackEarly',
      says: `${wrestler.name} will take some of the time off. Some of it.`,
    };
  }
  return {
    intent: 'restProperly',
    says: `${wrestler.name} intends to do exactly what he has been told, for once.`,
  };
}

// ---------------------------------------------------------------- what happens

export type InjuryOutcome = 'healedClean' | 'gotAwayWithIt' | 'madeItWorse' | 'careerEnding' | 'died';

export interface InjuryResolution {
  outcome: InjuryOutcome;
  /** How long he is actually out, after everything. */
  weeksOut: number;
  /** Permanent cost to the body, 0-100 of health. */
  healthCost: number;
  /** The sentence the wire prints. Nothing about a body happens off-screen. */
  line: string;
}

/**
 * Following the doctor, or not, and what it cost.
 *
 * The shape of the gamble, and why every row of it has to exist:
 *
 *   - Resting properly is never punished. It is slow and it is safe and that
 *     is the whole of it.
 *   - Coming back early is usually fine and occasionally ruinous. If it were
 *     usually ruinous nobody would ever do it and the option would be a
 *     decoration.
 *   - Working through it is a real gamble with a real floor. Most of the time
 *     he gets away with it and is back weeks early, which is exactly why a
 *     booker keeps letting him.
 *   - And on the worst injuries, with the worst luck, a man does not get up.
 *     Rare enough that it is a story rather than a mechanic, and possible
 *     enough that "he says he is fine" is never simply free.
 */
export function resolveInjuryCall(
  intent: InjuryIntent,
  doctor: DoctorsOpinion,
  wrestler: Wrestler,
  rng: Rng,
  settings: WorldSettings,
): InjuryResolution {
  if (intent === 'restProperly') {
    return {
      outcome: 'healedClean',
      weeksOut: doctor.weeks,
      healthCost: 0,
      line: `${wrestler.name} took the full ${doctor.weeks} weeks and came back right.`,
    };
  }

  const pushing = intent === 'workThroughIt';
  const badLuck = pushing ? settings.bodyWorkThroughBackfire : settings.bodyEarlyReturnBackfire;

  if (!chance(rng, badLuck)) {
    const weeks = Math.max(1, Math.round(doctor.weeks * (pushing ? settings.bodyWorkThroughWeeks : settings.bodyEarlyWeeks)));
    return {
      outcome: 'gotAwayWithIt',
      weeksOut: weeks,
      healthCost: pushing ? settings.bodyWorkThroughToll : 0,
      line: pushing
        ? `${wrestler.name} worked through it and got away with it. He was back in ${weeks}.`
        : `${wrestler.name} came back inside the doctor's date and it held.`,
    };
  }

  // It went wrong. How wrong depends on what he was carrying and how hard he
  // was pushing it.
  if (doctor.grave && pushing && chance(rng, settings.bodyDeathChance)) {
    return {
      outcome: 'died',
      weeksOut: 0,
      healthCost: 100,
      // The only outcome whose line is a cause rather than a whole sentence:
      // a death is always printed through `deathLine`, which has already said
      // who he was and how old. Written as the clause that follows it, so the
      // obituary does not say his name twice.
      line: `He went out there against medical advice and did not come back.`,
    };
  }

  const ending = doctor.grave || chance(rng, settings.bodyCareerEndingChance);
  const weeks = Math.round(doctor.weeks * settings.bodyBackfireWeeks);

  return {
    outcome: ending ? 'careerEnding' : 'madeItWorse',
    weeksOut: weeks,
    healthCost: ending ? settings.bodyCareerEndingToll : settings.bodyWorseToll,
    line: ending
      ? `${wrestler.name} should have listened. That is the end of it — he will not wrestle again.`
      : `${wrestler.name} should have listened. Eight weeks has become ${weeks}.`,
  };
}

/**
 * Both views on a hurt man, derived rather than stored.
 *
 * Deliberately *not* a decision the game stops to ask about. There is no
 * prompt and no button: these are two pieces of information that sit on the
 * man's profile for as long as he is hurt, and the booker takes them into
 * account when he makes the decisions he was already making — do I put him on
 * this card, do I sign him at all. §0 all over: the game states the position
 * and never asks the player to ratify it.
 *
 * Seeded from the injury rather than the week, so the stance is the same on
 * Tuesday as it was on Monday. A man does not change his mind about his own
 * knee because the calendar moved.
 */
export function stanceOn(
  wrestler: Wrestler,
  settings: WorldSettings,
): { doctor: DoctorsOpinion; man: WrestlersOpinion } | null {
  const injury = wrestler.injury;
  if (!injury) return null;

  return {
    doctor: doctorsOpinion(injury, wrestler, settings),
    man: wrestlersOpinion(
      wrestler,
      wrestler.injuryHistory ?? [],
      rngFromSeed(`stance:${wrestler.id}:${injury.sufferedWeek}`),
      settings,
    ),
  };
}

/** Both opinions, side by side, for the profile. */
export function theTwoOpinions(doctor: DoctorsOpinion, man: WrestlersOpinion): string {
  return `${doctor.verdict} ${man.says}`;
}

// ---------------------------------------------------------------- what he wants

export type DealAppetite = 'insurance' | 'cash' | 'comfort';

/**
 * What this person actually wants out of a deal beyond the number.
 *
 * The reason perks and clauses were flat: the game offered the same ladder to
 * everybody in the same order, so every negotiation was the same negotiation.
 * People are not the same. Three appetites, and which one somebody has follows
 * from who he is and what has already happened to him:
 *
 *   - **Insurance.** The careful, and anybody the body has already frightened.
 *     Wants the medical cover, the guaranteed dates, the travel paid. A man
 *     who has torn a knee twice does not need persuading about the third time.
 *   - **Cash.** The indestructible. Does not want a premium taken out of his
 *     money for something that is never going to happen to him. Wants the
 *     bonus, the merchandise cut, the pay-per-view points.
 *   - **Comfort.** Neither frightened nor greedy — wants the life to be
 *     bearable. The apartment, the crew, the room with a door that shuts.
 *
 * Injury history moves people toward insurance and it moves them a long way,
 * which is the point: sign a man at twenty-five and he wants cash; the same
 * man at thirty-two with a rebuilt shoulder wants the cover and the longer
 * deal, and a booker who is paying attention notices the change.
 */
export function dealAppetite(
  wrestler: Wrestler,
  history: readonly InjuryRecord[],
  settings: WorldSettings,
): DealAppetite {
  const frightened =
    careOf(wrestler, settings) +
    history.length * settings.appetiteHistoryWeight +
    history.filter((r) => r.severity === 'severe' || r.severity === 'careerThreatening').length *
      settings.appetiteBadInjuryWeight;

  if (frightened >= settings.appetiteInsuranceAt) return 'insurance';
  // A big ego with no fear of the future wants it in money.
  if (wrestler.ego / 100 >= settings.appetiteCashEgoAt && frightened < settings.appetiteCashAt) return 'cash';
  return frightened < settings.appetiteCashAt ? 'cash' : 'comfort';
}

/** What he is after, said plainly on the negotiating page. */
export function appetiteLine(appetite: DealAppetite, name: string): string {
  switch (appetite) {
    case 'insurance':
      return `${name} wants looking after — the cover, the dates, the travel.`;
    case 'cash':
      return `${name} does not want a premium coming out of his money. He wants the money.`;
    case 'comfort':
      return `${name} wants the life made bearable more than he wants either.`;
  }
}

/**
 * How much longer a deal somebody wants because of what has happened to him.
 *
 * A body that has already let him down once makes security worth more than
 * the chance to renegotiate. Returned as a share to add to the contract-length
 * want in economy/contracts.ts.
 */
export function securityWanted(
  wrestler: Wrestler,
  history: readonly InjuryRecord[],
  settings: WorldSettings,
): number {
  const bad = history.filter((r) => r.severity === 'severe' || r.severity === 'careerThreatening').length;
  const scared = careOf(wrestler, settings) * settings.securityFromCaution;
  return clamp(history.length * settings.securityPerInjury + bad * settings.securityPerBadInjury + scared, 0, settings.securityMax);
}


// ---------------------------------------------------------------- handing it in

/**
 * Whether somebody has decided he is not re-signing, and says so in advance.
 *
 * A contract used to run out and *then* become a negotiation, so the first the
 * booker heard of a problem was a demand he could not meet or a man already
 * gone. People do not work like that. Somebody who has had enough tells you a
 * week or two before the paper runs out, and the fortnight in between is the
 * whole value of it: a booker who has been warned can move a belt, change a
 * finish, or start replacing him.
 *
 * It is not a negotiating position and there is nothing to answer. He is
 * telling you, not asking you.
 */
export function handsInNotice(
  wrestler: Wrestler,
  weeksLeft: number,
  settings: WorldSettings,
): boolean {
  if (weeksLeft > settings.noticeWeeks || weeksLeft <= 0) return false;

  // Unhappiness is the whole of it. Money is a separate argument that happens
  // at the table; this is the man who has stopped wanting to be here.
  const unhappy = wrestler.morale <= settings.noticeMoraleUnder;
  if (!unhappy) return false;

  // Somebody being paid properly will swallow a lot, and somebody who has been
  // here for years does not walk over one bad month.
  const loyalty = (wrestler.attitude / 100) * settings.noticeLoyaltyWeight;
  return wrestler.morale / 100 + loyalty < settings.noticeThreshold;
}

/** What he says on his way past the office. */
export function noticeLine(name: string, weeksLeft: number): string {
  const when = weeksLeft <= 1 ? 'when this one runs out' : `in ${weeksLeft} weeks`;
  return `${name} has told you he is not re-signing. He is done ${when}, and he was not asking.`;
}
