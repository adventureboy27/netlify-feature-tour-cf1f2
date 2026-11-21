import { describe, it, expect } from 'vitest';
import { deriveCareerStatus, yearsPro, weeksAsChampion, isPoachingTarget, CAREER_STATUS_LABELS, CAREER_STATUS_BLURBS } from './status';
import { defaultWorldSettings } from '../world/settings';
import { generateWrestler } from '../generate/wrestler';
import { rngFromSeed } from '../rng';
import type { Wrestler, CareerStatus } from '../types';

const settings = defaultWorldSettings();
const YEAR = 2000;

function wrestler(over: Partial<Wrestler> = {}): Wrestler {
  const base = generateWrestler(rngFromSeed('career'), new Set(), { currentYear: YEAR });
  return {
    ...base,
    age: 28,
    debutYear: YEAR - 5,
    popularity: 50,
    careerHighPopularity: 50,
    careerStatus: 'midcarder',
    record: { wins: 20, losses: 20, draws: 0 },
    titleReigns: [],
    ...over,
  };
}

const ctx = (rosterPeak = 85) => ({ currentYear: YEAR, rosterPeakPopularity: rosterPeak, settings });

const statusOf = (over: Partial<Wrestler>, rosterPeak = 85) => deriveCareerStatus(wrestler(over), ctx(rosterPeak));

describe('yearsPro', () => {
  it('counts from the debut year and never goes negative', () => {
    expect(yearsPro(wrestler({ debutYear: 1990 }), YEAR)).toBe(10);
    expect(yearsPro(wrestler({ debutYear: 2010 }), YEAR)).toBe(0);
  });
});

describe('weeksAsChampion', () => {
  it('adds up completed and ongoing reigns', () => {
    const w = wrestler({
      titleReigns: [
        { titleId: 't', holderIds: ['a'], wonFromIds: null, wonByMethod: 'match', startWeek: 10, endWeek: 40, endMethod: 'pinned' },
        { titleId: 't', holderIds: ['a'], wonFromIds: null, wonByMethod: 'match', startWeek: 60, endWeek: null, endMethod: null },
      ] as Wrestler['titleReigns'],
    });
    expect(weeksAsChampion(w, 80)).toBe(30 + 20);
  });

  it('is zero for someone who never held anything', () => {
    expect(weeksAsChampion(wrestler(), 100)).toBe(0);
  });
});

describe('conferred statuses stick', () => {
  it.each<CareerStatus>(['hallOfFamer', 'retired', 'trainee'])('never re-derives %s away', (status) => {
    expect(statusOf({ careerStatus: status, popularity: 95, careerHighPopularity: 95 })).toBe(status);
  });
});

describe('early career', () => {
  it('calls a green wrestler with no upside a rookie', () => {
    expect(statusOf({ debutYear: YEAR - 1, talent: 40, hype: 40, popularity: 35 })).toBe('rookie');
  });

  it('calls a green wrestler the office likes a prospect', () => {
    expect(statusOf({ debutYear: YEAR - 1, talent: 90, hype: 90, popularity: 35 })).toBe('prospect');
  });

  it('stops calling them a rookie once the years pile up', () => {
    expect(statusOf({ debutYear: YEAR - 6, talent: 90, hype: 90, popularity: 35 })).not.toBe('prospect');
  });
});

describe('the top of the card is relative to the roster', () => {
  it('names the biggest act on the roster the draw', () => {
    expect(statusOf({ popularity: 90, careerHighPopularity: 90, debutYear: YEAR - 6 }, 90)).toBe('draw');
  });

  it('names the tier below them main eventers', () => {
    expect(statusOf({ popularity: 78, careerHighPopularity: 78, debutYear: YEAR - 6 }, 90)).toBe('mainEventer');
  });

  it('does not promote a 60-pop wrestler just because the roster is weak', () => {
    // A territory promotion's best is still not a draw in absolute terms.
    expect(statusOf({ popularity: 60, careerHighPopularity: 60, debutYear: YEAR - 6 }, 60)).not.toBe('draw');
  });
});

describe('the long middle', () => {
  it('calls a long-serving wrestler who never got over a journeyman', () => {
    expect(statusOf({ debutYear: YEAR - 9, popularity: 45, careerHighPopularity: 48, age: 31 })).toBe('journeyman');
  });

  it('calls someone booked to lose enhancement talent', () => {
    expect(statusOf({ popularity: 22, careerHighPopularity: 25, record: { wins: 3, losses: 40, draws: 0 }, debutYear: YEAR - 5 })).toBe(
      'enhancement',
    );
  });

  it('does not call a low-popularity wrestler with a decent record enhancement', () => {
    expect(statusOf({ popularity: 25, careerHighPopularity: 25, record: { wins: 25, losses: 20, draws: 0 }, debutYear: YEAR - 5 })).not.toBe(
      'enhancement',
    );
  });

  it('calls a solid mid-tier wrestler an upper carder', () => {
    expect(statusOf({ popularity: 66, careerHighPopularity: 66, debutYear: YEAR - 5, age: 30 })).toBe('upperCard');
  });
});

describe('late career', () => {
  it('calls an old hand who still draws a gatekeeper', () => {
    expect(statusOf({ age: 41, debutYear: YEAR - 16, popularity: 52, careerHighPopularity: 60 })).toBe('gatekeeper');
  });

  it('calls an old hand who does not a veteran', () => {
    expect(statusOf({ age: 41, debutYear: YEAR - 16, popularity: 38, careerHighPopularity: 44 })).toBe('veteran');
  });

  it('calls a long career at the very top a legend', () => {
    expect(statusOf({ age: 40, debutYear: YEAR - 15, popularity: 80, careerHighPopularity: 95 })).toBe('legend');
  });

  it('keeps calling them a legend after the popularity goes', () => {
    // The status is a career achievement — it is why an ageing star still
    // draws a curiosity house.
    expect(statusOf({ age: 46, debutYear: YEAR - 22, popularity: 40, careerHighPopularity: 95 })).toBe('legend');
  });

  it('calls a collapse from the top a fallen star', () => {
    expect(statusOf({ age: 33, debutYear: YEAR - 9, popularity: 40, careerHighPopularity: 82 })).toBe('fallenStar');
  });

  it('does not call a small dip a fall', () => {
    expect(statusOf({ age: 33, debutYear: YEAR - 9, popularity: 72, careerHighPopularity: 82 })).not.toBe('fallenStar');
  });
});

describe('the status set', () => {
  it('labels and explains every status', () => {
    for (const status of Object.keys(CAREER_STATUS_LABELS) as CareerStatus[]) {
      expect(CAREER_STATUS_LABELS[status]).toBeTruthy();
      expect(CAREER_STATUS_BLURBS[status]).toBeTruthy();
    }
  });

  it('always returns a real status for a whole generated roster across a career span', () => {
    const rng = rngFromSeed('roster-statuses');
    const valid = new Set(Object.keys(CAREER_STATUS_LABELS));
    for (let i = 0; i < 300; i++) {
      const w = generateWrestler(rng, new Set(), { currentYear: YEAR });
      for (const year of [YEAR, YEAR + 5, YEAR + 15, YEAR + 25]) {
        const status = deriveCareerStatus(
          { ...w, age: w.age + (year - YEAR) },
          { currentYear: year, rosterPeakPopularity: 88, settings },
        );
        expect(valid.has(status)).toBe(true);
      }
    }
  });

  it('marks the people worth poaching', () => {
    expect(isPoachingTarget('draw')).toBe(true);
    expect(isPoachingTarget('prospect')).toBe(true);
    expect(isPoachingTarget('enhancement')).toBe(false);
    expect(isPoachingTarget('retired')).toBe(false);
  });
});
