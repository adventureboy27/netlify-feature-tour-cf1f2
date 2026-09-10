// The rule this file holds: some shows are not on the calendar, they are a
// response to something — and a memorial is not a decision.

import { describe, expect, it } from 'vitest';
import { rngFromSeed } from '../rng';
import { defaultWorldSettings } from './settings';
import { DAYS, type Day } from './calendar';
import {
  afterLine,
  familyLine,
  memorialName,
  scaleForGenerosity,
  settleMemorial,
  memorialShow,
  returnsFor,
  rollCharityNight,
  spareNight,
  worthAMemorial,
} from './impromptu';

const settings = defaultWorldSettings();

describe('who a company closes the doors for', () => {
  it('buries anybody on its own roster, whatever their record', () => {
    expect(
      worthAMemorial({ onOurRoster: true, weeksWithUs: 1, wasAChampionHere: false, hallOfFamer: false }, settings),
    ).toBe(true);
  });

  it('buries somebody who gave it years, long after he left', () => {
    // The whole difference between a memorial and a press release: a man who
    // gave a company eight years gets a show whether or not he was still
    // under contract the day he died.
    expect(
      worthAMemorial(
        { onOurRoster: false, weeksWithUs: settings.memorialTenureWeeks, wasAChampionHere: false, hallOfFamer: false },
        settings,
      ),
    ).toBe(true);
  });

  it('buries anybody who ever carried its belt', () => {
    expect(
      worthAMemorial({ onOurRoster: false, weeksWithUs: 4, wasAChampionHere: true, hallOfFamer: false }, settings),
    ).toBe(true);
  });

  it('does not close the doors for a stranger', () => {
    expect(
      worthAMemorial({ onOurRoster: false, weeksWithUs: 0, wasAChampionHere: false, hallOfFamer: true }, settings),
    ).toBe(false);
    expect(
      worthAMemorial({ onOurRoster: false, weeksWithUs: 3, wasAChampionHere: false, hallOfFamer: false }, settings),
    ).toBe(false);
  });
});

describe('the memorial itself', () => {
  it('is named after him, in the words a poster would use', () => {
    expect(memorialName('Earl Mercer')).toBe('In Memoriam of Earl Mercer');
  });

  it('is a night that would not otherwise have existed', () => {
    const show = memorialShow(rngFromSeed('m'), 'w1', 'Earl Mercer', 40, ['Monday', 'Friday'], 'Southside');
    expect(show.kind).toBe('memorial');
    expect(show.week).toBe(40);
    expect(show.forWrestlerId).toBe('w1');
    expect(show.name).toContain('Earl Mercer');
    // Not on a night the pattern already uses.
    expect(['Monday', 'Friday']).not.toContain(show.day);
  });

  it('says who it is for, the week it is announced', () => {
    const show = memorialShow(rngFromSeed('m'), 'w1', 'Earl Mercer', 40, [], 'Southside');
    expect(show.announcement).toContain('Earl Mercer');
    expect(show.announcement).toContain('Southside');
    expect(afterLine(show)).toContain('Earl Mercer');
  });

  it('does not wait for a gap in the schedule', () => {
    // A company running every night still buries him.
    const show = memorialShow(rngFromSeed('m'), 'w1', 'Earl Mercer', 40, [...DAYS], 'Southside');
    expect(DAYS).toContain(show.day);
  });
});

describe('a benefit night', () => {
  const base = {
    week: 30,
    takenNights: ['Monday'] as Day[],
    promotionName: 'Southside',
    townName: 'Ironbelt City',
    alreadyBusy: false,
  };

  it('turns up occasionally rather than on a schedule', () => {
    let count = 0;
    for (let i = 0; i < 2000; i++) {
      if (rollCharityNight(rngFromSeed(`c-${i}`), { ...base, week: i }, settings)) count += 1;
    }
    const perYear = (count / 2000) * 52;
    // About one every year and a half. Often enough to be a thing that
    // happens, rare enough never to read as part of the pattern.
    expect(perYear).toBeGreaterThan(0.3);
    expect(perYear).toBeLessThan(1.4);
  });

  it('never lands in a week that already has something on it', () => {
    // A company does not run a benefit the same week it buries somebody.
    for (let i = 0; i < 400; i++) {
      expect(rollCharityNight(rngFromSeed(`b-${i}`), { ...base, alreadyBusy: true }, settings)).toBeNull();
    }
  });

  it('names the town and says nobody is being paid', () => {
    let show = null;
    for (let i = 0; i < 4000 && !show; i++) {
      show = rollCharityNight(rngFromSeed(`n-${i}`), base, settings);
    }
    expect(show).not.toBeNull();
    expect(show!.name).toContain('Ironbelt City');
    expect(show!.announcement).toMatch(/nobody is getting paid/i);
    expect(show!.forWrestlerId).toBeNull();
  });

  it('stays off entirely when the setting is off', () => {
    const off = { ...settings, charityShowsEnabled: false };
    for (let i = 0; i < 400; i++) {
      expect(rollCharityNight(rngFromSeed(`o-${i}`), base, off)).toBeNull();
    }
  });
});

describe('what the night is worth', () => {
  it('costs a building, and pays in everything except money', () => {
    const memorial = memorialShow(rngFromSeed('m'), 'w1', 'Earl', 40, [], 'S');
    const returns = returnsFor(memorial, settings);
    expect(returns.cost).toBeGreaterThan(0);
    expect(returns.reputation).toBeGreaterThan(0);
    expect(returns.morale).toBeGreaterThan(0);
    expect(returns.following).toBeGreaterThan(0);
  });

  it('is worth more to bury one of your own than to run a benefit', () => {
    const memorial = returnsFor(memorialShow(rngFromSeed('m'), 'w1', 'Earl', 40, [], 'S'), settings);
    let charity = null;
    for (let i = 0; i < 4000 && !charity; i++) {
      charity = rollCharityNight(
        rngFromSeed(`x-${i}`),
        { week: 5, takenNights: [], promotionName: 'S', townName: 'T', alreadyBusy: false },
        settings,
      );
    }
    const theirs = returnsFor(charity!, settings);
    expect(memorial.morale).toBeGreaterThan(theirs.morale);
    expect(memorial.reputation).toBeGreaterThan(theirs.reputation);
  });
});

describe('picking a night', () => {
  it('takes one the pattern is not already using', () => {
    for (let i = 0; i < 200; i++) {
      const taken: Day[] = ['Monday', 'Friday', 'Wednesday'];
      expect(taken).not.toContain(spareNight(taken, rngFromSeed(`s-${i}`)));
    }
  });

  it('still returns a night when every one is spoken for', () => {
    expect(DAYS).toContain(spareNight([...DAYS], rngFromSeed('full')));
  });
});

describe('whose gate it is', () => {
  // The announcement always promised the family the gate. The night used to
  // have no gate at all — a flat cost — which made burying somebody properly
  // a fixed fine rather than a gesture. These assert the promise.

  it('gives the family everything above what the night cost', () => {
    const drawing = settings.impromptuShowCost * 10;
    const settled = settleMemorial(drawing, settings);
    expect(settled.toTheFamily).toBe(settled.gate - settings.impromptuShowCost);
    // And the company is out nothing. It kept nothing either.
    expect(settled.costToUs).toBe(0);
  });

  it('leaves the company carrying the building when nobody comes', () => {
    // The harder half, and the true one: doing right by somebody costs most
    // for exactly the promotion that can least afford it.
    const settled = settleMemorial(0, settings);
    expect(settled.gate).toBe(0);
    expect(settled.toTheFamily).toBe(0);
    expect(settled.costToUs).toBe(settings.impromptuShowCost);
  });

  it('never leaves the promotion with a profit, however well it draws', () => {
    for (const draw of [0, 5_000, 50_000, 500_000]) {
      const settled = settleMemorial(draw, settings);
      expect(settled.gate - settings.impromptuShowCost - settled.toTheFamily + settled.costToUs).toBe(0);
      expect(settled.gate - settled.toTheFamily).toBeLessThanOrEqual(settings.impromptuShowCost);
    }
  });

  it('buys more goodwill the bigger the cheque, and some for turning up at all', () => {
    const empty = settleMemorial(0, settings);
    const packed = settleMemorial(settings.impromptuShowCost * 20, settings);
    expect(scaleForGenerosity(10, empty.generosity, settings)).toBeGreaterThan(0);
    expect(scaleForGenerosity(10, packed.generosity, settings)).toBeGreaterThan(
      scaleForGenerosity(10, empty.generosity, settings),
    );
    expect(scaleForGenerosity(10, packed.generosity, settings)).toBeLessThanOrEqual(10);
  });

  it('says what the family got, including when it was nothing', () => {
    expect(familyLine('Earl Mercer', settleMemorial(settings.impromptuShowCost * 10, settings))).toContain(
      "Earl Mercer's family",
    );
    expect(familyLine('Earl Mercer', settleMemorial(0, settings))).toContain('nothing left to send on');
  });
});
