// Shared presentation vocabulary for the conversation screen — reused by
// every reactive, personnel-and-managerial decision (creative events,
// release requests, rival approaches, the champion call, weather calls),
// even though each of those still keeps its own World state and store
// action. This file is what makes it one engine rather than four lookalike
// ones: one idea of who's speaking, one idea of what a choice looks like.

import type { Id } from '../types';

/** Who is "talking." Drives portrait vs. placeholder vs. nothing on screen. */
export type DialogueSpeaker =
  | { kind: 'wrestler'; wrestlerId: Id }
  | { kind: 'booker' }
  | { kind: 'narrator' };

/** The rendered shape of one choice button. Every surface produces exactly this. */
export interface DialogueChoiceView {
  id: string;
  label: string;
  gains: string;
  costs: string;
  disabled?: boolean;
}
