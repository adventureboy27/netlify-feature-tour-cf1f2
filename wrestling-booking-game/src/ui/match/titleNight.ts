// Who held a title going into a given night, and who held it coming out.
//
// The viewer can replay a show from weeks ago. Reading a title's current
// holder then puts today's belts on the people in an old match; the title's
// own history has the answer for the week it was actually fought.
//
// A change on the night closes one reign and opens the next in the same
// week, so two reigns can both touch that week: the earlier is who walked in
// with it, the later is who walked out.

import type { Id, Title } from '../../engine/types';

type Reigns = Pick<Title, 'history'>;

const touching = (title: Reigns, week: number) => title.history.filter((r) => r.startWeek <= week && (r.endWeek === null || r.endWeek >= week));

/** `wonTonight`: this title was on the line in the match being shown, and changed hands in it. */
export function heldGoingIn(title: Reigns, week: number, wonTonight: boolean): readonly Id[] {
  const live = touching(title, week);
  if (live.length === 0) return [];
  // One reign, begun this week, by winning tonight's match: it was vacant before the bell.
  if (live.length === 1 && wonTonight && live[0]!.startWeek === week) return [];
  return live[0]!.holderIds;
}

export function heldComingOut(title: Reigns, week: number): readonly Id[] {
  const last = touching(title, week).pop();
  // Ended this week with nothing after it: vacated on the night.
  return last && (last.endWeek === null || last.endWeek > week) ? last.holderIds : [];
}
