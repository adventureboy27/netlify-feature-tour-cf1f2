// When a confrontation actually goes physical, the booker gets a say.
//
// A confrontation's twist roll already decides whether it goes past words —
// resolveConfrontation, in sim/confrontation.ts — and until now, whatever it
// rolled just happened: an injury applied itself with nobody at the desk
// ever asked. The segment's own rating and write-up are already locked in by
// the time this fires (same principle as the champion call: the night
// already happened), but the physical half specifically — did the office
// let it go or pull them apart — is the one part of a confrontation genuinely
// worth a decision, so that's the part held back for one.

import type { Id } from '../types';

export interface ConfrontationCall {
  week: number;
  wrestlerId: Id;
  wrestlerName: string;
  otherName: string;
  twistLabel: string;
  weeks: number;
}

export type ConfrontationCallChoiceId = 'letItHappen' | 'breakItUp';

export interface ConfrontationCallOption {
  id: ConfrontationCallChoiceId;
  label: string;
  gains: string;
  costs: string;
}

export const CONFRONTATION_CALL_OPTIONS: ConfrontationCallOption[] = [
  {
    id: 'letItHappen',
    label: 'Let it happen',
    gains: 'Real heat, and the crowd knows the difference',
    costs: 'The injury sticks exactly as it landed',
  },
  {
    id: 'breakItUp',
    label: 'Pull them apart',
    gains: 'Nobody gets hurt tonight',
    costs: 'The room sees the office step in, and that has its own cost',
  },
];
