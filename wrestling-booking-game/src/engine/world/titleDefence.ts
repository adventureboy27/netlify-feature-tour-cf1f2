// A belt has to be defended, and a hurt champion is a decision.
//
// Two problems this fixes, both of which made championships inert.
//
// A title could sit on somebody for six years without ever being on the line.
// Nothing asked for it back, so the belt stopped being a thing the card was
// built toward and became a decoration on a roster card. Now every belt runs
// a clock: defend it inside the window or the company strips it.
//
// And a champion getting hurt used to be a non-event — the belt simply went
// with them into the treatment room and came back whenever they did. It is
// one of the genuinely hard calls in the job, so it is now a call: send them
// out hurt and risk the rest of their career, vacate the thing, or crown an
// interim champion and owe the world a unification match when the real one
// comes back.
//
// On the warning, and CLAUDE.md's "the game never warns the player before a
// bad decision": that rule is about not second-guessing the booker's
// judgement — it will happily let you book Loser Leaves between two
// strangers. A defence deadline is not a judgement, it is a rule of the world
// with a date attached, and a deadline you cannot see is a hidden rule rather
// than a difficulty. So the clock is always visible and the last week before
// it expires says so. It reports; it never advises.

import { riskFromGrade } from '../sim/casualties';
import type { Id, Title, TitleTier, Wrestler, WorldSettings } from '../types';

/** How long this kind of belt can go unfought before the company acts. */
export function defenceWindowWeeks(tier: TitleTier, settings: WorldSettings): number {
  // A television title exists to be defended on television. Giving it the
  // same rope as a world championship would make the two read identically,
  // and the whole point of the tier is that it does not.
  if (tier === 'television') return settings.titleDefenceWindowTelevisionWeeks;
  return settings.titleDefenceWindowWeeks;
}

/** Weeks left before the company strips it. Negative once it is overdue. */
export function weeksUntilStripped(title: Title, currentWeek: number, settings: WorldSettings): number {
  const due = title.lastDefendedWeek + defenceWindowWeeks(title.tier, settings);
  return due - currentWeek;
}

export type DefenceStatus =
  | 'vacant' // nobody holds it, so nothing to defend
  | 'fresh' // plenty of time
  | 'due' // inside the window, worth booking
  | 'finalWarning' // defend it this week or lose it
  | 'overdue'; // the company takes it back

export function defenceStatus(title: Title, currentWeek: number, settings: WorldSettings): DefenceStatus {
  if (title.vacant) return 'vacant';
  const left = weeksUntilStripped(title, currentWeek, settings);
  if (left <= 0) return 'overdue';
  if (left <= settings.titleDefenceWarningWeeks) return 'finalWarning';
  if (left <= settings.titleDefenceNoticeWeeks) return 'due';
  return 'fresh';
}

export interface DefenceWatchItem {
  titleId: Id;
  titleName: string;
  status: DefenceStatus;
  weeksLeft: number;
  holderIds: Id[];
}

/**
 * Every belt of one promotion that wants looking at, soonest first.
 *
 * Drives both the wire item the week before and the line on the card screen,
 * so the deadline is never something the player finds out about afterwards.
 */
export function defenceWatch(
  titles: readonly Title[],
  promotionId: Id,
  currentWeek: number,
  settings: WorldSettings,
): DefenceWatchItem[] {
  return titles
    .filter((t) => t.promotionId === promotionId && !t.vacant)
    .map((title) => ({
      titleId: title.id,
      titleName: title.name,
      status: defenceStatus(title, currentWeek, settings),
      weeksLeft: weeksUntilStripped(title, currentWeek, settings),
      holderIds: [...title.currentHolderIds],
    }))
    .filter((item) => item.status !== 'fresh' && item.status !== 'vacant')
    .sort((a, b) => a.weeksLeft - b.weeksLeft);
}

// ---------------------------------------------------------------------------
// A champion gets hurt
// ---------------------------------------------------------------------------

export type ChampionInjuryChoice = 'defendAnyway' | 'vacate' | 'interim';

export interface ChampionInjuryOption {
  id: ChampionInjuryChoice;
  label: string;
  /** What it buys you. */
  gains: string;
  /** What it costs. Stated plainly — this is a cost, not a warning. */
  costs: string;
}

/**
 * What the booker can do about a hurt champion.
 *
 * A team cannot be held together by an interim: half a tag team is not a tag
 * champion, and an interim partner would make the belts meaningless the
 * moment the real one came back. Tag and trios champions vacate, and that is
 * the only option — which is exactly how the real thing has always worked.
 */
export function championInjuryOptions(title: Title): ChampionInjuryOption[] {
  const vacate: ChampionInjuryOption = {
    id: 'vacate',
    label: 'Vacate the championship',
    gains: 'A clean slate. The belt goes on somebody who can actually defend it.',
    costs: 'The reign ends here, and it ends without a loss.',
  };

  if (isTeamHeld(title)) return [vacate];

  return [
    {
      id: 'defendAnyway',
      label: 'They defend it hurt',
      gains: 'The reign continues and nobody has to hand anything over.',
      costs: 'Working hurt is how a career ends. Whatever is wrong will get worse.',
    },
    vacate,
    {
      id: 'interim',
      label: 'Crown an interim champion',
      gains: 'The belt stays on the card and the real champion keeps their reign.',
      costs: 'Two champions. When they come back, one match settles it and one of them loses.',
    },
  ];
}

/** Belts carried by more than one person, which cannot have an interim. */
export function isTeamHeld(title: Title): boolean {
  return title.tier === 'tag' || title.tier === 'trios' || title.currentHolderIds.length > 1;
}

/** A belt with two claimants owes the company a match to settle it. */
export function needsUnification(title: Title): boolean {
  return !title.vacant && title.interimHolderIds.length > 0;
}

/**
 * Whether this match settles it.
 *
 * Both claimants have to actually be in it. Booking the interim champion
 * against somebody else while a unification is owed is not a unification, and
 * the belt stays split.
 */
export function isUnificationMatch(title: Title, participantIds: readonly Id[]): boolean {
  if (!needsUnification(title)) return false;
  const inMatch = new Set(participantIds);
  return (
    title.currentHolderIds.every((id) => inMatch.has(id)) &&
    title.interimHolderIds.every((id) => inMatch.has(id))
  );
}

/**
 * Can this belt go on the line tonight?
 *
 * While two people claim it, the only match it can be in is the one that
 * settles it. That is what makes the unification mandatory rather than
 * merely available — the clock keeps running the whole time, so ducking it
 * eventually strips the belt off both of them.
 */
export function canBeDefended(title: Title, participantIds: readonly Id[]): boolean {
  if (title.vacant) return true;
  if (!needsUnification(title)) return true;
  return isUnificationMatch(title, participantIds);
}

/**
 * Is the champion fit to be sent out?
 *
 * Injured people cannot normally be booked at all (rivalBooking.canWork), so
 * a champion defending hurt is only possible because the booker signed off on
 * it, and that permission lives on the wrestler as `clearedToWorkHurt`.
 */
function isClearedToDefendHurt(wrestler: Wrestler): boolean {
  return Boolean(wrestler.injury) && wrestler.clearedToWorkHurt;
}

/**
 * How much more dangerous a night is for somebody working hurt.
 *
 * The player was told plainly what this costs when they chose it. This is
 * where it is charged.
 */
export function workingHurtRisk(wrestler: Wrestler, settings: WorldSettings): number {
  if (!isClearedToDefendHurt(wrestler)) return 1;
  // Scaled by how hurt they actually are, which this could not do until an
  // injury had a grade on it. It was a flat multiplier, so a booker sending
  // somebody out on a knock ran exactly the risk of sending them out on a torn
  // knee. See sim/casualties.ts.
  return riskFromGrade(wrestler.injury?.grade ?? 0, settings);
}
