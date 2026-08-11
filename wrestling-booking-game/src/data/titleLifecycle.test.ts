// Adding, retiring and bringing back a championship — without losing a
// single reign of its history, which is the entire point.

import { describe, expect, it, beforeEach } from 'vitest';
import { useGameStore } from '../state/store';
import { isActiveTitle, retiredTitlesOf, titlesOf } from './titles';
import { eligibleTitles } from '../engine/sim/titleMatch';
import type { TitleBlueprint } from '../engine/types';

const blueprint = (over: Partial<TitleBlueprint> = {}): TitleBlueprint => ({
  suffix: 'Television Championship',
  blurb: 'Defended every week, whether it suits anybody or not.',
  tier: 'television',
  division: 'open',
  weightClass: 'open',
  signatureStipulationId: null,
  ...over,
});

beforeEach(() => {
  useGameStore.getState().newGame();
});

const world = () => useGameStore.getState().world!;

describe('introducing a championship mid-run', () => {
  it('adds it, vacant, and puts it on the company', () => {
    const before = titlesOf(world().titles, world().promotion.id).length;
    useGameStore.getState().createTitle(blueprint());
    const after = titlesOf(world().titles, world().promotion.id);
    expect(after).toHaveLength(before + 1);

    const fresh = after.find((t) => t.name.includes('Television Championship'))!;
    expect(fresh.vacant).toBe(true);
    expect(fresh.currentHolderIds).toEqual([]);
    expect(fresh.history).toEqual([]);
    expect(world().promotion.titleIds).toContain(fresh.id);
  });

  it('gives it an id nothing else has ever used', () => {
    useGameStore.getState().createTitle(blueprint());
    useGameStore.getState().createTitle(blueprint({ suffix: 'Hardcore Championship' }));
    const ids = world().titles.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('says so, because a belt appearing out of nowhere is a silent change', () => {
    useGameStore.getState().createTitle(blueprint());
    expect(world().weeklyNews.some((n) => n.text.includes('Television Championship'))).toBe(true);
  });
});

describe('retiring one', () => {
  it('keeps every reign it ever had', () => {
    const belt = titlesOf(world().titles, world().promotion.id).find((t) => !t.vacant)!;
    const historyBefore = belt.history.length;
    expect(historyBefore).toBeGreaterThan(0);

    useGameStore.getState().retireTitle(belt.id);
    const after = world().titles.find((t) => t.id === belt.id)!;
    expect(after.history).toHaveLength(historyBefore);
    expect(isActiveTitle(after)).toBe(false);
  });

  it('records that it was retired rather than lost', () => {
    // The last champion did not get beaten. Saying they did would be a lie in
    // the lineage, and the lineage is the thing worth protecting.
    const belt = titlesOf(world().titles, world().promotion.id).find((t) => !t.vacant)!;
    useGameStore.getState().retireTitle(belt.id);
    const after = world().titles.find((t) => t.id === belt.id)!;
    expect(after.history[after.history.length - 1]!.endMethod).toBe('titleRetired');
  });

  it('takes it out of the company\'s active belts but not out of the world', () => {
    const belt = titlesOf(world().titles, world().promotion.id)[0]!;
    useGameStore.getState().retireTitle(belt.id);
    expect(titlesOf(world().titles, world().promotion.id).some((t) => t.id === belt.id)).toBe(false);
    expect(retiredTitlesOf(world().titles, world().promotion.id).some((t) => t.id === belt.id)).toBe(true);
    expect(world().titles.some((t) => t.id === belt.id)).toBe(true);
    expect(world().promotion.titleIds).not.toContain(belt.id);
  });

  it('cannot be put on a card', () => {
    const belt = titlesOf(world().titles, world().promotion.id)[0]!;
    useGameStore.getState().retireTitle(belt.id);
    const retired = world().titles.find((t) => t.id === belt.id)!;
    const roster = world().promotion.rosterIds.map((id) => world().wrestlers[id]!);
    const eligible = eligibleTitles([retired], {
      promotionId: world().promotion.id,
      participants: [
        { wrestler: roster[0]!, side: 0 },
        { wrestler: roster[1]!, side: 1 },
      ],
    });
    expect(eligible).toEqual([]);
  });

  it('is announced, and names who was carrying it', () => {
    const belt = titlesOf(world().titles, world().promotion.id).find((t) => !t.vacant)!;
    const holder = world().wrestlers[belt.currentHolderIds[0]!]!.name;
    useGameStore.getState().retireTitle(belt.id);
    const line = world().weeklyNews.find((n) => n.text.includes('retired'));
    expect(line?.text).toContain(holder);
  });

  it('does nothing when asked twice', () => {
    const belt = titlesOf(world().titles, world().promotion.id)[0]!;
    useGameStore.getState().retireTitle(belt.id);
    const week = world().titles.find((t) => t.id === belt.id)!.retiredWeek;
    useGameStore.getState().retireTitle(belt.id);
    expect(world().titles.find((t) => t.id === belt.id)!.retiredWeek).toBe(week);
  });
});

describe('a split belt when somebody leaves the business', () => {
  /** Hurt the champion and crown an interim, returning both ids. */
  function splitBelt(): { titleId: string; championId: string; interimId: string } {
    const belt = titlesOf(world().titles, world().promotion.id).find(
      (t) => !t.vacant && t.currentHolderIds.length === 1,
    )!;
    const championId = belt.currentHolderIds[0]!;
    useGameStore.setState((s) => {
      s.world!.wrestlers[championId]!.injury = {
        severity: 'moderate',
        description: 'Blown knee',
        sufferedWeek: 1,
        totalWeeks: 8,
        weeksRemaining: 8,
        permanentStatLoss: {},
        earlyReturnWeeksUsed: 0,
      };
      return s;
    });
    useGameStore.getState().autoFillCard();
    useGameStore.getState().resolveWeek();
    if (world().pendingWeatherCall) useGameStore.getState().answerWeatherCall('runIt');
    const interim = world()
      .promotion.rosterIds.map((id) => world().wrestlers[id]!)
      .find((w) => w && !w.injury && w.role === 'wrestler' && w.id !== championId)!;
    useGameStore.getState().answerChampionCall('interim', interim.id);
    return { titleId: belt.id, championId, interimId: interim.id };
  }

  it('does not leave a claim on the belt for somebody who is gone', () => {
    // The soft-lock this exists to prevent: an interim champion retires, the
    // belt still owes a unification against them, no match can ever satisfy
    // it, and the defence clock quietly strips the title.
    const { titleId, interimId } = splitBelt();
    expect(world().titles.find((t) => t.id === titleId)!.interimHolderIds).toContain(interimId);

    useGameStore.getState().retireWrestler(interimId);
    const after = world().titles.find((t) => t.id === titleId)!;
    expect(after.interimHolderIds, 'a claim outlived the person holding it').toEqual([]);
  });

  it('leaves the champion undisputed when the stand-in goes', () => {
    const { titleId, championId, interimId } = splitBelt();
    useGameStore.getState().retireWrestler(interimId);
    const after = world().titles.find((t) => t.id === titleId)!;
    expect(after.vacant).toBe(false);
    expect(after.currentHolderIds).toEqual([championId]);
    expect(world().weeklyNews.some((n) => n.text.includes('undisputed'))).toBe(true);
  });

  it('hands the belt to the interim when the champion goes, rather than vacating it', () => {
    // An interim champion is exactly the person who should inherit it — that
    // is what the belt was crowned for. Vacating a title somebody is already
    // carrying would be the wrong answer.
    const { titleId, championId, interimId } = splitBelt();
    useGameStore.getState().retireWrestler(championId);
    const after = world().titles.find((t) => t.id === titleId)!;
    expect(after.vacant).toBe(false);
    expect(after.currentHolderIds).toEqual([interimId]);
    expect(after.interimHolderIds).toEqual([]);
  });
});

describe('bringing one back', () => {
  it('returns it, vacant, with its history intact', () => {
    const belt = titlesOf(world().titles, world().promotion.id).find((t) => !t.vacant)!;
    const historyBefore = belt.history.length;
    useGameStore.getState().retireTitle(belt.id);
    useGameStore.getState().unretireTitle(belt.id);

    const back = world().titles.find((t) => t.id === belt.id)!;
    expect(isActiveTitle(back)).toBe(true);
    expect(back.vacant).toBe(true);
    expect(back.currentHolderIds).toEqual([]);
    expect(back.history).toHaveLength(historyBefore);
    expect(world().promotion.titleIds).toContain(back.id);
  });

  it('restarts the defence clock from today rather than from twenty years ago', () => {
    // Otherwise a belt that comes back after a long retirement is stripped as
    // undefended the moment it returns.
    const belt = titlesOf(world().titles, world().promotion.id)[0]!;
    useGameStore.getState().retireTitle(belt.id);
    for (let i = 0; i < 30; i++) {
      useGameStore.getState().autoFillCard();
      useGameStore.getState().resolveWeek();
      if (world().pendingWeatherCall) useGameStore.getState().answerWeatherCall('runIt');
    }
    useGameStore.getState().unretireTitle(belt.id);
    expect(world().titles.find((t) => t.id === belt.id)!.lastDefendedWeek).toBe(world().week);
  });

  it('can go on a card again', () => {
    const belt = titlesOf(world().titles, world().promotion.id)[0]!;
    useGameStore.getState().retireTitle(belt.id);
    useGameStore.getState().unretireTitle(belt.id);
    const back = world().titles.find((t) => t.id === belt.id)!;
    const roster = world().promotion.rosterIds.map((id) => world().wrestlers[id]!);
    const singles = eligibleTitles([back], {
      promotionId: world().promotion.id,
      participants: [
        { wrestler: roster[0]!, side: 0 },
        { wrestler: roster[1]!, side: 1 },
      ],
    });
    // A tag belt needs teams, so only assert for the singles case.
    if (back.tier !== 'tag' && back.tier !== 'trios') expect(singles).toHaveLength(1);
  });

  it('does nothing to a belt that was never retired', () => {
    const belt = titlesOf(world().titles, world().promotion.id).find((t) => !t.vacant)!;
    const holders = [...belt.currentHolderIds];
    useGameStore.getState().unretireTitle(belt.id);
    expect(world().titles.find((t) => t.id === belt.id)!.currentHolderIds).toEqual(holders);
  });
});

describe('editing a belt that already has a lineage', () => {
  it('renames it without touching a single reign', () => {
    const belt = titlesOf(world().titles, world().promotion.id).find((t) => !t.vacant)!;
    const historyBefore = belt.history.length;
    const holders = [...belt.currentHolderIds];

    useGameStore.getState().editTitle(belt.id, { name: 'The Ironbelt Crown' });
    const after = world().titles.find((t) => t.id === belt.id)!;
    expect(after.name).toBe('The Ironbelt Crown');
    expect(after.history).toHaveLength(historyBefore);
    expect(after.currentHolderIds).toEqual(holders);
  });

  it('says so, because a belt changing name unannounced is a silent change', () => {
    const belt = titlesOf(world().titles, world().promotion.id)[0]!;
    const oldName = belt.name;
    useGameStore.getState().editTitle(belt.id, { name: 'The Ironbelt Crown' });
    expect(
      world().weeklyNews.some((n) => n.text.includes(oldName) && n.text.includes('Ironbelt Crown')),
    ).toBe(true);
  });

  it('changes what it is traditionally defended under', () => {
    const belt = titlesOf(world().titles, world().promotion.id)[0]!;
    useGameStore.getState().editTitle(belt.id, { signatureStipulationId: 'steelCage' });
    expect(world().titles.find((t) => t.id === belt.id)!.signatureStipulationId).toBe('steelCage');
    useGameStore.getState().editTitle(belt.id, { signatureStipulationId: null });
    expect(world().titles.find((t) => t.id === belt.id)!.signatureStipulationId).toBeNull();
  });

  it('ignores an empty name rather than creating a nameless belt', () => {
    const belt = titlesOf(world().titles, world().promotion.id)[0]!;
    useGameStore.getState().editTitle(belt.id, { name: '   ' });
    expect(world().titles.find((t) => t.id === belt.id)!.name).toBe(belt.name);
  });

  it('leaves division and tier alone — those would rewrite the reigns on it', () => {
    const belt = titlesOf(world().titles, world().promotion.id)[0]!;
    useGameStore.getState().editTitle(belt.id, { name: 'Something Else' });
    const after = world().titles.find((t) => t.id === belt.id)!;
    expect(after.division).toBe(belt.division);
    expect(after.tier).toBe(belt.tier);
  });
});
