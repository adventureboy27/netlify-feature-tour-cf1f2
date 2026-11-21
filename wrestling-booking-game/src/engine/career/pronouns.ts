// He or she.
//
// The roster is generated to a division split — a meaningful slice of it is
// women — and it is very easy to write a whole system's prose in "he" without
// noticing, because the first name you test with is usually a man's. This has
// now been caught twice: once when somebody read the free-agent list under
// Deacon Yolanda's name, and again when an entire session's worth of new
// systems went in saying "he" about everybody.
//
// So it lives in one place, and anything that writes a sentence about a
// person takes it. A line that cannot be written without knowing who it is
// about should be handed the wrestler, not a name.

import type { Wrestler } from '../types';

export interface Pronouns {
  /** she / he */
  they: string;
  /** her / him */
  them: string;
  /** her / his */
  their: string;
  /** herself / himself */
  themself: string;
}

export const SHE: Pronouns = { they: 'she', them: 'her', their: 'her', themself: 'herself' };
export const HE: Pronouns = { they: 'he', them: 'him', their: 'his', themself: 'himself' };

export function pronounsFor(wrestler: Pick<Wrestler, 'gender'>): Pronouns {
  return wrestler.gender === 'f' ? SHE : HE;
}

/** Capitalised, for the start of a sentence. */
export function Cap(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
