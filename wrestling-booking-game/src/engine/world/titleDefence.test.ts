import { describe, expect, it } from 'vitest';
import {
  canBeDefended,
  championInjuryOptions,
  defenceStatus,
  defenceWatch,
  defenceWindowWeeks,
  isTeamHeld,
  isUnificationMatch,
  needsUnification,
  weeksUntilStripped,
  workingHurtRisk,
} from './titleDefence';
import { createStartingTitles } from '../../data/titles';
import { defaultWorldSettings } from './settings';
import { generateWrestlers } from '../generate/wrestler';
import { rngFromSeed } from '../rng';
import type { Title, Wrestler } from '../types';

const settings = defaultWorldSettings();

function heldTitle(over: Partial<Title> = {}): Title {
  const [belt] = createStartingTitles('p', 'Southside Championship Wrestling', 'territory');
  return {
    ...belt!,
    vacant: false,
    currentHolderIds: ['champ'],
    lastDefendedWeek: 10,
    ...over,
  };
}

describe('the clock on a belt', () => {
  it('gives a television title less rope than a world title', () => {
    // The tier is supposed to mean something. A TV title that can go a season
    // undefended reads exactly like a world title, which is the whole problem.
    expect(defenceWindowWeeks('television', settings)).toBeLessThan(defenceWindowWeeks('world', settings));
  });

  it('counts down from the last time it was actually on the line', () => {
    const belt = heldTitle({ lastDefendedWeek: 10 });
    const window = defenceWindowWeeks(belt.tier, settings);
    expect(weeksUntilStripped(belt, 10, settings)).toBe(window);
    expect(weeksUntilStripped(belt, 10 + window, settings)).toBe(0);
    expect(weeksUntilStripped(belt, 10 + window + 3, settings)).toBe(-3);
  });

  it('walks through fresh, due, final warning and overdue', () => {
    const belt = heldTitle({ lastDefendedWeek: 0 });
    const window = defenceWindowWeeks(belt.tier, settings);
    expect(defenceStatus(belt, 1, settings)).toBe('fresh');
    expect(defenceStatus(belt, window - settings.titleDefenceNoticeWeeks, settings)).toBe('due');
    expect(defenceStatus(belt, window - settings.titleDefenceWarningWeeks, settings)).toBe('finalWarning');
    expect(defenceStatus(belt, window, settings)).toBe('overdue');
    expect(defenceStatus(belt, window + 40, settings)).toBe('overdue');
  });

  it('has nothing to say about a vacant belt', () => {
    expect(defenceStatus(heldTitle({ vacant: true, currentHolderIds: [] }), 999, settings)).toBe('vacant');
  });

  it('warns before it strips, never after', () => {
    // The player must be able to act on it. A deadline whose first mention is
    // the obituary is a hidden rule, not a difficulty.
    const belt = heldTitle({ lastDefendedWeek: 0 });
    const window = defenceWindowWeeks(belt.tier, settings);
    const warned = [...Array(window + 1).keys()].filter(
      (week) => defenceStatus(belt, week, settings) === 'finalWarning',
    );
    expect(warned.length).toBeGreaterThan(0);
    expect(Math.max(...warned)).toBeLessThan(window);
  });
});

describe('the watch list', () => {
  const titles = [
    heldTitle({ id: 'a', name: 'A', lastDefendedWeek: 0 }),
    heldTitle({ id: 'b', name: 'B', lastDefendedWeek: 8 }),
    heldTitle({ id: 'c', name: 'C', lastDefendedWeek: 12 }),
    heldTitle({ id: 'd', name: 'D', vacant: true, currentHolderIds: [] }),
  ];

  it('lists only what needs looking at, soonest first', () => {
    const watch = defenceWatch(titles, 'p', 12, settings);
    expect(watch.every((w) => w.status !== 'fresh' && w.status !== 'vacant')).toBe(true);
    const order = watch.map((w) => w.weeksLeft);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
  });

  it("leaves another company's belts alone", () => {
    const theirs = heldTitle({ id: 'x', promotionId: 'rival-1', lastDefendedWeek: 0 });
    expect(defenceWatch([...titles, theirs], 'p', 12, settings).some((w) => w.titleId === 'x')).toBe(false);
  });
});

describe('a champion gets hurt', () => {
  it('offers the booker three ways out of a singles belt', () => {
    const options = championInjuryOptions(heldTitle()).map((o) => o.id);
    expect(options).toContain('defendAnyway');
    expect(options).toContain('vacate');
    expect(options).toContain('interim');
  });

  it('states what each one costs, because that is the decision', () => {
    for (const option of championInjuryOptions(heldTitle())) {
      expect(option.gains.length, option.id).toBeGreaterThan(15);
      expect(option.costs.length, option.id).toBeGreaterThan(15);
    }
  });

  it('gives a tag team exactly one option, and it is to vacate', () => {
    // Half a tag team is not a tag champion, and an interim partner would
    // make the belts meaningless the moment the real one came back.
    const tag = heldTitle({ tier: 'tag', currentHolderIds: ['a', 'b'] });
    expect(isTeamHeld(tag)).toBe(true);
    expect(championInjuryOptions(tag).map((o) => o.id)).toEqual(['vacate']);
  });

  it('treats any multi-person belt as team-held, whatever its tier', () => {
    expect(isTeamHeld(heldTitle({ tier: 'trios', currentHolderIds: ['a', 'b', 'c'] }))).toBe(true);
    expect(isTeamHeld(heldTitle({ tier: 'world', currentHolderIds: ['a', 'b'] }))).toBe(true);
    expect(isTeamHeld(heldTitle({ tier: 'world', currentHolderIds: ['a'] }))).toBe(false);
  });
});

describe('two champions and one belt', () => {
  const split = heldTitle({ currentHolderIds: ['champ'], interimHolderIds: ['interim'], interimSinceWeek: 5 });

  it('knows it owes the company a match', () => {
    expect(needsUnification(split)).toBe(true);
    expect(needsUnification(heldTitle())).toBe(false);
  });

  it('only counts as a unification when both claimants are in it', () => {
    expect(isUnificationMatch(split, ['champ', 'interim'])).toBe(true);
    expect(isUnificationMatch(split, ['champ', 'somebody'])).toBe(false);
    expect(isUnificationMatch(split, ['interim', 'somebody'])).toBe(false);
  });

  it('will not go on the line in any other match, which is what makes it mandatory', () => {
    expect(canBeDefended(split, ['interim', 'contender'])).toBe(false);
    expect(canBeDefended(split, ['champ', 'interim'])).toBe(true);
    // An ordinary belt is not restricted.
    expect(canBeDefended(heldTitle(), ['champ', 'contender'])).toBe(true);
  });

  it('does not restrict a vacant belt', () => {
    expect(canBeDefended(heldTitle({ vacant: true, currentHolderIds: [] }), ['a', 'b'])).toBe(true);
  });
});

describe('working hurt', () => {
  const someone = (over: Partial<Wrestler> = {}): Wrestler => {
    const [w] = generateWrestlers(rngFromSeed('hurt'), 1);
    return { ...w!, injury: null, clearedToWorkHurt: false, ...over };
  };
  const injury = {
    severity: 'moderate' as const,
    description: 'Torn shoulder',
    sufferedWeek: 1,
    totalWeeks: 6,
    weeksRemaining: 6,
    permanentStatLoss: {},
    earlyReturnWeeksUsed: 0,
  };

  it('costs nothing for somebody healthy', () => {
    expect(workingHurtRisk(someone(), settings)).toBe(1);
  });

  it('costs nothing for somebody hurt who is not being sent out', () => {
    expect(workingHurtRisk(someone({ injury }), settings)).toBe(1);
  });

  it('is a real multiplier for the champion the booker cleared', () => {
    const risk = workingHurtRisk(someone({ injury, clearedToWorkHurt: true }), settings);
    expect(risk).toBe(settings.workingHurtInjuryMultiplier);
    expect(risk).toBeGreaterThan(1.5);
  });
});
