// What a man leaves behind.
//
// The memorial wall listed a name, a cause and an age. That is a death
// certificate, not a life — and it sat directly beneath a Hall of Fame that
// gives every inductee a citation and a portrait, which made the contrast
// worse. Somebody who worked twenty years, held three belts and drew money in
// four territories got one grey line reading "a heart attack, aged 61".
//
// So: the same facts the records page already holds, read back as the short
// list a paper would print. Nothing new is stored — it is all derived from
// the reigns, the record and the marks, which is why it works for people who
// died forty years ago in a save.

import { yearsPro, weeksAsChampion } from './status';
import { pronounsFor } from './pronouns';
import type { Title, Wrestler } from '../types';

/**
 * The line under the name: who he was, in one clause.
 *
 * Reads off whichever part of the case is strongest, the same way
 * `citationFor` does for the hall — but this one has to work for everybody,
 * including the man who never won anything, and it must never read as a
 * judgement on him for it.
 */
export function whoTheyWere(w: Wrestler, currentYear: number): string {
  const years = yearsPro(w, currentYear);
  if (w.careerStatus === 'hallOfFamer') return 'Hall of Fame';
  if (w.titleReigns.length >= 3) return `${w.titleReigns.length}-time champion`;
  if (w.titleReigns.length > 0) return w.titleReigns.length === 1 ? 'A champion, once' : 'A two-time champion';
  if (years >= 15) return `${years} years in the business`;
  if ((w.career.matches ?? 0) > 0) return 'A working wrestler';
  return `Never got ${pronounsFor(w).their} run`;
}

/**
 * Everything worth saying about the career, longest-standing first.
 *
 * Deliberately capped and deliberately plain. A wall of statistics is not a
 * memorial, and the point of the page is that somebody reading it recognises
 * a person rather than a row.
 */
export function whatTheyLeave(
  w: Wrestler,
  ctx: { currentWeek: number; currentYear: number; titles: readonly Title[] },
  limit = 4,
): string[] {
  const out: string[] = [];
  const years = yearsPro(w, ctx.currentYear);

  // The belts, named. A man is remembered for what he held, not how many.
  const heldNames = [...new Set(w.titleReigns.map((r) => ctx.titles.find((t) => t.id === r.titleId)?.name).filter(Boolean))] as string[];
  if (heldNames.length > 0) {
    const reigns = w.titleReigns.length;
    out.push(
      `${reigns === 1 ? 'Held' : `${reigns} reigns with`} ${heldNames.slice(0, 2).join(' and ')}` +
        (heldNames.length > 2 ? ` and ${heldNames.length - 2} more` : ''),
    );
  }

  const asChampion = weeksAsChampion(w, ctx.currentWeek);
  if (asChampion >= 26) {
    out.push(`${asChampion} weeks carrying a championship`);
  }

  if (years > 0) {
    const debut = w.career.youngestMatchAge;
    const span = `${years} ${years === 1 ? 'year' : 'years'} in the ring`;
    out.push(debut != null ? `${span}, from ${debut}` : span);
  }

  const { wins, losses, draws } = w.record;
  if (wins + losses + draws > 0) out.push(`${wins}-${losses}-${draws}`);

  if (w.career.bestMatchRating != null && w.career.bestMatchRating >= 80) {
    out.push('Was in one of the best matches anybody had seen');
  }

  if ((w.injuryHistory?.length ?? 0) >= 4) {
    out.push(`Worked hurt more often than anybody should — ${w.injuryHistory!.length} of them on the record`);
  }

  return out.slice(0, limit);
}

/**
 * The one that has to be said whatever else is on the list.
 *
 * Somebody the company sent out on an injury and did not get back is not
 * remembered as "an accident" — §0's rule that a death says how it happened
 * does not stop applying once he is on the wall.
 */
export function howTheyWent(w: Wrestler, causeText: string): string {
  if ((w.injuryHistory ?? []).some((r) => r.workedThroughIt) && w.deceased?.cause === 'accident') {
    return `Went out there hurt, and did not come back.`;
  }
  // `DEATH_CAUSE_TEXT` is written to follow "has died" — "in an accident",
  // "peacefully, at home". Standing on its own under a name it needs to read
  // as a sentence, so it gets the word and the stop the wire supplied.
  return `Died ${causeText}.`;
}
