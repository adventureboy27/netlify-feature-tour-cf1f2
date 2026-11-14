// The rules every match is played under, wherever it is on the card.

import { describe, expect, it } from 'vitest';
import { generateWrestlers } from '../generate/wrestler';
import { rngFromSeed } from '../rng';
import { rollMatchCasualties, stoppageVictimOf } from './interpromotional';
import { defaultWorldSettings } from '../world/settings';

describe('a stoppage', () => {
  it('goes to the one who could not go on losing, and never to the injured', () => {
    expect(stoppageVictimOf('injuryStoppage', ['b'], ['a', 'b'])).toBe('a');
    expect(stoppageVictimOf('injuryStoppage', ['a'], ['a', 'b'])).toBe('b');
    // In a tag match it is the injured one's side that loses; the victim is always on the losing side.
    expect(stoppageVictimOf('injuryStoppage', ['a', 'c'], ['a', 'b', 'c', 'd'])).toBe('b');
  });

  it('is not a stoppage at all for a disqualification, or for anything that is not one', () => {
    expect(stoppageVictimOf('disqualification', ['b'], ['a', 'b'])).toBeNull();
    expect(stoppageVictimOf('cleanPin', ['b'], ['a', 'b'])).toBeNull();
  });

  it('hurts the one who could not go on; the winner is never the stoppage victim', () => {
    const settings = defaultWorldSettings();
    const people = generateWrestlers(rngFromSeed('stoppage-test'), 2);
    const [winner, loser] = people as [(typeof people)[number], (typeof people)[number]];
    for (let seed = 0; seed < 40; seed++) {
      const { casualties, stoppedIds } = rollMatchCasualties(rngFromSeed(`s${seed}`), {
        finish: 'injuryStoppage',
        winnerIds: [winner.id],
        beats: [],
        people: [winner, loser],
        injuryMultiplier: 1,
        week: 10,
        settings,
      });
      expect(stoppedIds).toEqual([loser.id]);
      expect(casualties.find((c) => c.casualty.personId === loser.id)).toBeDefined();
      expect(stoppedIds).not.toContain(winner.id);
    }
  });

  it('a person already hurt and not cleared to work is not rolled again', () => {
    const settings = defaultWorldSettings();
    const [a, b] = generateWrestlers(rngFromSeed('hurt-test'), 2) as [ReturnType<typeof generateWrestlers>[number], ReturnType<typeof generateWrestlers>[number]];
    const hurt = { ...a, injury: { severity: 'minor', grade: 10, description: 'x', sufferedWeek: 1, totalWeeks: 2, weeksRemaining: 2, permanentStatLoss: {}, earlyReturnWeeksUsed: 0 }, clearedToWorkHurt: false } as typeof a;
    for (let seed = 0; seed < 60; seed++) {
      const { casualties } = rollMatchCasualties(rngFromSeed(`h${seed}`), {
        finish: 'cleanPin',
        winnerIds: [b.id],
        beats: [],
        people: [hurt, b],
        injuryMultiplier: 50,
        week: 10,
        settings,
      });
      expect(casualties.some((c) => c.casualty.personId === hurt.id)).toBe(false);
    }
  });
});
