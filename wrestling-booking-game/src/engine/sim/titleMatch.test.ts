import { describe, it, expect } from 'vitest';
import {
  eligibleTitles,
  resolveTitleOutcomes,
  titleCanChangeHands,
  matchTitlePrestige,
  titleStakesLabel,
  prestigeAfterMatch,
} from './titleMatch';
import { createStartingTitles, awardTitle } from '../../data/titles';
import { stipulationById } from '../../data/stipulations';
import { defaultWorldSettings } from '../world/settings';
import { rngFromSeed } from '../rng';
import { generateWrestlers } from '../generate/wrestler';
import type { Title, Wrestler } from '../types';

const settings = defaultWorldSettings();

function belts(): Title[] {
  return createStartingTitles('you', 'Southside Championship Wrestling', 'territory');
}

function cast(count: number): Wrestler[] {
  const rng = rngFromSeed('title-cast');
  return generateWrestlers(rng, count, { currentYear: 1985 }).map((w) => ({ ...w, gender: 'm' as const }));
}

describe('which belts can be booked', () => {
  it('offers a vacant belt to anyone in a singles match', () => {
    const [a, b] = cast(2);
    const found = eligibleTitles(belts(), {
      participants: [
        { wrestler: a!, side: 0 },
        { wrestler: b!, side: 1 },
      ],
      promotionId: 'you',
    });
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((t) => t.tier !== 'tag')).toBe(true);
  });

  it('will not defend a belt whose champion is not in the match', () => {
    const [champ, a, b] = cast(3);
    const all = belts();
    all[0] = awardTitle(all[0]!, [champ!.id], 1);

    const found = eligibleTitles(all, {
      participants: [
        { wrestler: a!, side: 0 },
        { wrestler: b!, side: 1 },
      ],
      promotionId: 'you',
    });
    expect(found.map((t) => t.id)).not.toContain(all[0]!.id);
  });

  it('keeps the tag belts for tag matches and singles belts out of them', () => {
    const [a, b, c, d] = cast(4);
    const found = eligibleTitles(belts(), {
      participants: [
        { wrestler: a!, side: 0 },
        { wrestler: b!, side: 0 },
        { wrestler: c!, side: 1 },
        { wrestler: d!, side: 1 },
      ],
      promotionId: 'you',
    });
    expect(found.every((t) => t.tier === 'tag')).toBe(true);
    expect(found.length).toBe(1);
  });

  it('honours the locked division', () => {
    const [a, b] = cast(2);
    const women = belts().filter((t) => t.division === 'womens');
    expect(
      eligibleTitles(women, {
        participants: [
          { wrestler: a!, side: 0 },
          { wrestler: b!, side: 1 },
        ],
        promotionId: 'you',
      }),
    ).toHaveLength(0);
  });

  it('never offers another promotion’s belt', () => {
    const [a, b] = cast(2);
    const theirs = createStartingTitles('rival-0', 'Atlas Pro', 'athletic');
    expect(
      eligibleTitles(theirs, {
        participants: [
          { wrestler: a!, side: 0 },
          { wrestler: b!, side: 1 },
        ],
        promotionId: 'you',
      }),
    ).toHaveLength(0);
  });
});

describe('when a belt moves', () => {
  it('does not change hands on a disqualification or a count-out', () => {
    expect(titleCanChangeHands('disqualification', null)).toBe(false);
    expect(titleCanChangeHands('countOut', null)).toBe(false);
    expect(titleCanChangeHands('cleanPin', null)).toBe(true);
  });

  it('does change hands on a DQ when the match had no rules to break', () => {
    expect(titleCanChangeHands('disqualification', stipulationById('noDQ') ?? null)).toBe(true);
  });

  it('leaves the champion holding it after a draw', () => {
    expect(titleCanChangeHands('timeLimitDraw', null)).toBe(false);
    expect(titleCanChangeHands('doubleKO', null)).toBe(false);
  });

  it('goes to the challenger on a clean win', () => {
    const [champ, challenger] = cast(2);
    const title = awardTitle(belts()[0]!, [champ!.id], 1);

    const [outcome] = resolveTitleOutcomes({
      titles: [title],
      winnerIds: [challenger!.id],
      finish: 'cleanPin',
      stipulation: null,
      matchRating: 70,
      settings,
    });
    expect(outcome!.changed).toBe(true);
    expect(outcome!.newHolderIds).toEqual([challenger!.id]);
  });

  it('stays put when the champion wins', () => {
    const [champ] = cast(2);
    const title = awardTitle(belts()[0]!, [champ!.id], 1);

    const [outcome] = resolveTitleOutcomes({
      titles: [title],
      winnerIds: [champ!.id],
      finish: 'cleanPin',
      stipulation: null,
      matchRating: 70,
      settings,
    });
    expect(outcome!.changed).toBe(false);
    expect(outcome!.newHolderIds).toBeNull();
  });

  it('hands the winner everything in a title-for-title match', () => {
    const [a, b] = cast(2);
    const all = belts();
    const first = awardTitle(all[0]!, [a!.id], 1);
    const second = awardTitle(all[1]!, [b!.id], 1);

    const outcomes = resolveTitleOutcomes({
      titles: [first, second],
      winnerIds: [a!.id],
      finish: 'submission',
      stipulation: null,
      matchRating: 80,
      settings,
    });
    // A keeps their own (no change) and takes B's.
    expect(outcomes.find((o) => o.titleId === first.id)!.changed).toBe(false);
    expect(outcomes.find((o) => o.titleId === second.id)!.newHolderIds).toEqual([a!.id]);
  });

  it('does nothing at all when the belt was never on the line', () => {
    expect(
      resolveTitleOutcomes({
        titles: [],
        winnerIds: ['a'],
        finish: 'cleanPin',
        stipulation: null,
        matchRating: 90,
        settings,
      }),
    ).toHaveLength(0);
  });
});

describe('what a belt is worth', () => {
  it('drifts toward the rating of its defences', () => {
    const title = belts()[0]!;
    const afterClassic = prestigeAfterMatch(title, 95, settings);
    const afterStinker = prestigeAfterMatch(title, 20, settings);
    expect(afterClassic).toBeGreaterThan(title.prestige);
    expect(afterStinker).toBeLessThan(title.prestige);
    // One night never remakes a championship.
    expect(afterClassic - title.prestige).toBeLessThan(10);
  });

  it('treats title-for-title as a bigger night than a defence', () => {
    const all = belts();
    const one = matchTitlePrestige([all[0]!], settings)!;
    const two = matchTitlePrestige([all[0]!, all[1]!], settings)!;
    expect(two).toBeGreaterThan(one);
    expect(matchTitlePrestige([], settings)).toBeNull();
  });

  it('bills the match honestly', () => {
    const all = belts();
    expect(titleStakesLabel([], true)).toBe('Non-title');
    expect(titleStakesLabel([], false)).toBeNull();
    expect(titleStakesLabel([all[0]!], true)).toBe('For the vacant title');
    expect(titleStakesLabel([awardTitle(all[0]!, ['x'], 1)], true)).toBe('Title match');
    expect(titleStakesLabel([all[0]!, all[1]!], true)).toBe('Title for title');
  });
});
