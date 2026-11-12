// A rival makes a move the roster is going to hear about regardless.
//
// Rival signings were already narrated (wire.ts's whole reason for
// existing — "you released him, you get to watch somebody else sign him").
// What was missing was any reaction: the booker found out and that was the
// end of it. This is the reactive half, gated on it actually being a name
// worth reacting to — narrator-voiced, since it's the office reporting a
// rival's move, not anybody speaking for themselves.

import type { Id } from '../types';

export interface RivalMove {
  week: number;
  rivalId: Id;
  rivalName: string;
  wrestlerId: Id;
  wrestlerName: string;
}

export type RivalMoveChoiceId = 'statement' | 'counterMove' | 'sayNothing';

export interface RivalMoveOption {
  id: RivalMoveChoiceId;
  label: string;
  gains: string;
  costs: string;
}

export const RIVAL_MOVE_OPTIONS: RivalMoveOption[] = [
  {
    id: 'statement',
    label: 'Answer it on air',
    gains: 'The roster sees you are not rattled by it',
    costs: 'Sounds thin coming from a company that has nothing else to say',
  },
  {
    id: 'counterMove',
    label: 'Go out and make a move of your own',
    gains: 'A real answer, not just a line on television',
    costs: 'A real spend, with no guarantee it lands anybody worth the money',
  },
  {
    id: 'sayNothing',
    label: 'Say nothing',
    gains: 'Costs nothing and draws no more attention to it',
    costs: 'The room notices when the office has nothing to say',
  },
];
