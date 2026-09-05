// Where a match sits on the card, in the words a card uses.
//
// Shared because the booking screen and the results screen have to agree:
// the slot you booked as the semi-main has to come back to you as the
// semi-main, or the results are a different show from the one you made.

const SLOT_LABELS = ['Opener', 'Second', 'Third', 'Fourth', 'Semi-main', 'Main event'];

export function slotLabel(index: number, total: number): string {
  if (index === total - 1) return 'Main event';
  return SLOT_LABELS[index] ?? `Match ${index + 1}`;
}
