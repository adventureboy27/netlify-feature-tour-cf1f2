// The broadcast teams.
//
// A promotion draws one at world creation and keeps it, because a company
// whose announcers changed every week would not sound like a company. The
// pairing is always the same shape and it is the shape that works: a
// professional describing what is happening, and a former wrestler beside him
// with an opinion about it.
//
// The colour man's leaning is the engine of the whole thing. A colour
// commentator who agrees with everything is furniture. One who thinks the
// villain has a point — or one who is personally offended by cheating — gives
// the play-by-play man something to push back against, and turns two people
// reading facts into two people having a conversation.

import type { CommentaryTeam } from '../engine/sim/commentary';

export const COMMENTARY_TEAMS: readonly CommentaryTeam[] = [
  { playByPlayName: 'Hal Brinker', colourName: 'Duke Mancini', leaning: 'heel' },
  { playByPlayName: 'Ray Trumbull', colourName: 'Sonny Vance', leaning: 'heel' },
  { playByPlayName: 'Marcus Dell', colourName: 'Boone Waverly', leaning: 'face' },
  { playByPlayName: 'Verna Cole', colourName: 'Ox Gundersen', leaning: 'heel' },
  { playByPlayName: 'Chip Halloran', colourName: 'Dr. Emmett Shaw', leaning: 'analyst' },
  { playByPlayName: 'Gordy Pratt', colourName: 'Lorraine Beck', leaning: 'face' },
  { playByPlayName: 'Stu Kettering', colourName: 'Cyrus Blackwood', leaning: 'heel' },
  { playByPlayName: 'Nate Ferris', colourName: 'Big Bill Cavanaugh', leaning: 'analyst' },
];
