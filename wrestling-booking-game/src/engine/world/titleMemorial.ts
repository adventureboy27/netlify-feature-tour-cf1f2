// What happens to a belt when the person carrying it dies.
//
// Death itself stays exactly as it always was — rolled in the background,
// applied rather than offered (see seasons.ts's own note on the tribute
// show). Overriding *whether* somebody dies would undo that deliberate
// choice. What was missing is a decision about the one thing death actually
// leaves unresolved on the booker's own desk: a belt with a dead champion
// still listed as holding it. Narrator-voiced, like the weather call —
// nobody is speaking for the deceased here, the office is just telling you
// what's on the table.

import type { Id } from '../types';

export interface TitleMemorial {
  week: number;
  titleId: Id;
  titleName: string;
  championId: Id;
  championName: string;
}

export type TitleMemorialChoiceId = 'vacateAndOpen' | 'passToSuccessor' | 'retire';

export interface TitleMemorialOption {
  id: TitleMemorialChoiceId;
  label: string;
  gains: string;
  costs: string;
}

export const TITLE_MEMORIAL_OPTIONS: TitleMemorialOption[] = [
  {
    id: 'vacateAndOpen',
    label: 'Vacate it and open the picture back up',
    gains: 'A clean slate — the belt goes to whoever earns it next',
    costs: 'Whatever the reign meant is over without a real ending',
  },
  {
    id: 'passToSuccessor',
    label: 'Let the office name a successor',
    gains: 'The lineage carries straight through instead of sitting empty',
    costs: 'Somebody inherits a spot they did not actually win',
  },
  {
    id: 'retire',
    label: 'Retire the belt in their name',
    gains: 'Nobody ever has to follow that reign — it just ends, on top',
    costs: 'A championship permanently off the roster, whatever it was worth to the card',
  },
];
