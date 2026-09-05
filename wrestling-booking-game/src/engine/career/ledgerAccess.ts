// Getting at somebody's ledger without every caller checking whether they
// have one.
//
// `Wrestler.ledger` is optional on the type so a record written before ledgers
// existed still loads. Rather than sprinkling `?? emptyLedger()` across the
// simulation — which would silently discard every write — this fills one in on
// first touch and hands back the real object.
//
// Separate from ledger.ts because that module is pure data about records and
// knows nothing about wrestlers; this is the one line of glue between them.

import { emptyLedger, type Ledger } from './ledger';

/**
 * Anybody who keeps a set of books. Wrestlers and managers both do, and they
 * are different types — a manager is not a Wrestler with a flag — so this is
 * structural rather than nominal.
 */
export interface HasLedger {
  ledger?: Ledger;
}

export function ledgerOf(person: HasLedger): Ledger {
  if (!person.ledger) person.ledger = emptyLedger();
  return person.ledger;
}
