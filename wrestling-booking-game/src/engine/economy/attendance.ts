// Attendance and gate, booking-game-design.md §14.
//
// DESIGN: baseDraw's `territoryFollowing` and the gate's
// `territoryRevenueMult` come from the Territory system (M6) and
// `championPopularity` from having a title on the card (M3). None of that
// exists yet, so callers pass neutral defaults (following 50, mult 1.0,
// championPopularity 0) until those milestones land — the formula itself
// is complete today.

export interface AttendanceContext {
  territoryFollowing: number; // 0-100
  capacity: number;
  companyRating: number; // 0-100
  championPopularity: number; // 0 if no champion is on the card
  segments: { stars: number; avgPopularity: number }[]; // filled segments only
}

/**
 * Only a third of the house is guaranteed by reputation; the rest is
 * earned live by the card itself.
 */
export function computeAttendance(ctx: AttendanceContext): number {
  const baseDraw = ctx.territoryFollowing * (ctx.capacity / 100) * 0.33 * ((ctx.companyRating + ctx.championPopularity) / 200);
  const segmentDraw = ctx.segments.reduce(
    (sum, seg) => sum + ctx.capacity * (seg.stars / 5) * (seg.avgPopularity / 100) * 0.075,
    0,
  );
  return Math.min(baseDraw + segmentDraw, ctx.capacity);
}

/** ticketPrice = base + perSegment * segmentsBooked — $10 for a full TV, $14 for a full PPV at defaults. */
export function computeTicketPrice(segmentsBooked: number, base: number, perSegment: number): number {
  return base + perSegment * segmentsBooked;
}

export function computeGate(attendance: number, ticketPrice: number, territoryRevenueMult: number): number {
  return attendance * ticketPrice * territoryRevenueMult;
}
