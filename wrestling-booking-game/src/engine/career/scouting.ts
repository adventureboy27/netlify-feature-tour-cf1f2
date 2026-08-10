// The read on a wrestler, in one line.
//
// The booking screen used to list the roster as a wall of name chips with an
// unlabelled coloured dot beside each one. Deciding who to put in a match
// meant leaving the screen, opening the roster, reading eight bars, and
// coming back — for each of thirty-four people. The decision the game is
// actually about was buried two screens down from where you make it.
//
// So every wrestler gets a pitch and a catch: the one reason you would use
// them tonight, and the one reason you might not. Both are prose, because
// §0 forbids showing stats as numbers and because "Over, but he is hurt"
// is a sentence a booker would actually say. Either half can be absent —
// somebody with nothing wrong with them has no catch, and that is itself
// worth seeing at a glance.
//
// Everything here is derived. Nothing new is stored, so a read is never
// stale and never needs updating when the underlying number moves.

import type { Wrestler, WorldSettings } from '../types';

/**
 * He or she. The roster is generated to a division split — roughly a third of
 * it is women — and every line here said "him" until somebody looked at the
 * free-agent list and saw it under Deacon Yolanda's name.
 */
interface Pronouns {
  they: string;
  them: string;
  their: string;
}

function pronouns(wrestler: Wrestler): Pronouns {
  return wrestler.gender === 'f'
    ? { they: 'she', them: 'her', their: 'her' }
    : { they: 'he', them: 'him', their: 'his' };
}

/** Ranked worst-first: the flag that most affects tonight wins. */
export type AvailabilityFlag =
  | 'injured'
  | 'exhausted'
  | 'unhappy'
  | 'wornDown'
  | 'onARoll'
  | 'fresh';

export interface Availability {
  flag: AvailabilityFlag;
  /** Two or three words, for a chip beside the name. */
  label: string;
  /** Whether booking them tonight is a bad idea, a risk, or fine. */
  tone: 'bad' | 'warn' | 'good' | 'neutral';
}

/**
 * Can they work tonight, and what will it cost them?
 *
 * Deliberately one flag rather than a list. A row that shows four badges is
 * a row nobody reads; the whole point is that the eye lands on one thing.
 */
export function availability(wrestler: Wrestler, settings: WorldSettings): Availability {
  if (wrestler.injury) {
    const weeks = wrestler.injury.weeksRemaining;
    return {
      flag: 'injured',
      label: weeks > 0 ? `Out ${weeks}w` : 'Injured',
      tone: 'bad',
    };
  }
  if (wrestler.fatigueDebt >= settings.scoutExhaustedFatigue) {
    return { flag: 'exhausted', label: 'Exhausted', tone: 'bad' };
  }
  if (wrestler.health <= settings.scoutWornDownHealth) {
    return { flag: 'wornDown', label: 'Banged up', tone: 'warn' };
  }
  if (wrestler.morale <= settings.scoutUnhappyMorale) {
    return { flag: 'unhappy', label: 'Unhappy', tone: 'warn' };
  }
  if (wrestler.momentum >= settings.scoutHotMomentum) {
    return { flag: 'onARoll', label: 'On a roll', tone: 'good' };
  }
  return { flag: 'fresh', label: 'Fresh', tone: 'neutral' };
}

/**
 * What they are for. The single strongest thing about them, said plainly.
 *
 * Ordered by what actually sells a ticket: people come to see a draw, and
 * everything else is a reason a match is good once they are already in the
 * building.
 */
export function thePitch(wrestler: Wrestler, settings: WorldSettings): string {
  const { popularity, charisma, skill, agility, strength, stamina } = wrestler;
  const p = pronouns(wrestler);
  const craft = Math.max(skill, agility);

  // A draw and a hand are different assets, and somebody who is both is
  // different again. Leading on popularity alone made the top of any sorted
  // list read "A draw" over and over — which is precisely the part of the
  // list the player is looking at.
  // Within the top tier, say *which* kind of draw. A ranked list puts all of
  // these people together at the top of the screen, so one line covering the
  // lot of them is the same as no line at all — which is exactly how the
  // first cut of this read.
  if (popularity >= settings.scoutDrawPopularity) {
    if (charisma >= settings.scoutEliteCraft) return `A draw, and ${p.they} can talk. Give ${p.them} a microphone.`;
    if (skill >= settings.scoutEliteCraft) return `A draw who can genuinely wrestle. Main event ${p.them}.`;
    if (agility >= settings.scoutEliteCraft) return `A draw, and ${p.they} flies. Send ${p.them} out last.`;
    if (strength >= settings.scoutEliteCraft) return `A draw built like a house. Nobody doubts ${p.them}.`;
    if (craft >= settings.scoutStrongCraft) return `A draw who can also go. Build the show on ${p.them}.`;
    return `A draw. People buy tickets for ${p.them}, whatever the match is.`;
  }
  if (popularity >= settings.scoutKnownPopularity) {
    if (craft >= settings.scoutStrongCraft) return `Known, and good enough to carry the match.`;
    if (charisma >= settings.scoutStrongCraft) return `Over, and better on the microphone than in the ring.`;
    return `Over with the crowd without being much of a wrestler.`;
  }
  if (skill >= settings.scoutEliteCraft) return `Can have a good match with anybody in the building.`;
  if (charisma >= settings.scoutEliteCraft) return `Talks people into the building.`;
  if (agility >= settings.scoutEliteCraft) return `Spectacular. The crowd gasps.`;
  if (strength >= settings.scoutEliteCraft) return `Overpowering. Nobody looks safe with ${p.them}.`;
  if (stamina >= settings.scoutEliteCraft) return `Can go all night without slowing down.`;
  if (craft >= settings.scoutStrongCraft) return `A solid hand. Will not let a match die.`;
  if (wrestler.age <= settings.scoutProspectAge && wrestler.talent >= settings.prospectTalent) {
    return `Young, and there is something there.`;
  }
  return `Fills a spot on the card.`;
}

/**
 * Why you might leave them off. Null when there is genuinely nothing wrong —
 * which is information too, and the row shows it as such.
 *
 * Condition beats character: somebody who cannot go tonight is a harder no
 * than somebody who is merely difficult.
 */
export function theCatch(wrestler: Wrestler, settings: WorldSettings): string | null {
  const p = pronouns(wrestler);
  if (wrestler.injury) {
    const weeks = wrestler.injury.weeksRemaining;
    return `${wrestler.injury.description}. Out for ${weeks} ${weeks === 1 ? 'week' : 'weeks'}.`;
  }
  if (wrestler.fatigueDebt >= settings.scoutExhaustedFatigue) {
    return `Worked into the ground. Book ${p.them} and ${p.they} breaks.`;
  }
  if (wrestler.health <= settings.scoutWornDownHealth) return 'Carrying something. One bad landing away.';
  if (wrestler.morale <= settings.scoutUnhappyMorale) return 'Miserable, and it shows in the ring.';
  if (wrestler.ego >= settings.scoutBigEgo) return `Knows what ${p.they} is worth and will tell you.`;
  if (wrestler.attitude <= settings.scoutBadAttitude) return 'A problem in the locker room.';
  if (wrestler.momentum <= settings.scoutColdMomentum) return `Ice cold. Nobody reacts to ${p.them}.`;
  if (wrestler.popularity <= settings.enhancementPopularity) return `Nobody knows who ${p.they} is.`;
  if (wrestler.age >= settings.scoutOldAge) return `Near the end. Every night costs ${p.them}.`;
  return null;
}

export interface Scouting {
  pitch: string;
  catch: string | null;
  /** Said when there is no catch — prose, so it gets a pronoun like the rest. */
  cleanBill: string;
  availability: Availability;
}

/** Everything the surface needs about somebody, in one call. */
export function scout(wrestler: Wrestler, settings: WorldSettings): Scouting {
  const p = pronouns(wrestler);
  return {
    pitch: thePitch(wrestler, settings),
    catch: theCatch(wrestler, settings),
    cleanBill: `Nothing wrong with ${p.them}.`,
    availability: availability(wrestler, settings),
  };
}

/**
 * Face / heel / tweener, as a word.
 *
 * It has always been a coloured dot and nothing else, which is unreadable
 * for anybody who has not been told the code — and colour alone fails for
 * the colourblind regardless of how long they have played.
 */
export function alignmentLabel(alignment: number): 'Face' | 'Heel' | 'Tweener' {
  if (alignment >= 15) return 'Face';
  if (alignment <= -15) return 'Heel';
  return 'Tweener';
}
