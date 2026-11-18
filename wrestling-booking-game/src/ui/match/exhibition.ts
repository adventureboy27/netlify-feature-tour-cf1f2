// The shape the match viewer plays from. Every match, whatever night it was
// on, is played back from the same record: its segment as booked, and its
// result as the sim played it (beats, the call, the injuries).

import type { Id, MatchRules, Segment, SegmentResult, SegmentRole } from '../../engine/types';

/** As much of a booked segment as the viewer reads. */
export type WatchSegment = Pick<Segment, 'participants' | 'stipulation' | 'rules' | 'titleIds' | 'managerIds'> & {
  participants: (SegmentRole | { wrestlerId: Id; side: number; role: 'competitor' })[];
  rules: MatchRules;
};
/** A match's result, as stored: the same shape whatever night it was on. */
export type WatchResult = Pick<SegmentResult, 'beats' | 'finish' | 'winnerSide' | 'winnerWrestlerIds' | 'titleChanged' | 'injuries' | 'commentary'> & Partial<Pick<SegmentResult, 'battleRoyalOrder'>>;

/** The company in a corner, on a night with more than one company in the building. */
export interface Corner {
  name: string;
  accent: string;
}
