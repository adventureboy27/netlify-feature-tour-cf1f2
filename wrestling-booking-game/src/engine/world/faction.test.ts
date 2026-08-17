import { describe, expect, it } from 'vitest';
import { defectionRisk, factionEgoDrift, factionHeat, factionStanding, overshadowsCompany, recruitmentTargets, rollRecruit } from './faction';
import { defaultWorldSettings } from './settings';
import { generateWrestlers } from '../generate/wrestler';
import { rngFromSeed } from '../rng';
import type { Id, Stable, Wrestler } from '../types';

const settings = defaultWorldSettings();

function roster(n: number, over: Partial<Wrestler> = {}, seed = 'faction'): Wrestler[] {
  return generateWrestlers(rngFromSeed(seed), n).map((w) => ({
    ...w,
    popularity: 60,
    momentum: 55,
    morale: 60,
    ego: 50,
    talent: 60,
    ...over,
  }));
}

function group(members: Wrestler[]): Stable {
  return {
    id: 'nwo',
    name: 'The Group',
    kind: 'stable',
    memberIds: members.map((m) => m.id),
    leaderId: members[0]?.id ?? null,
    colors: null,
    unifiedLook: true,
    formedWeek: 1,
    disbandedWeek: null,
    record: { wins: 0, losses: 0, draws: 0 },
  };
}

function byId(people: Wrestler[]): Record<Id, Wrestler> {
  return Object.fromEntries(people.map((w) => [w.id, w]));
}

describe('how hot the group is', () => {
  it('is nothing when nobody is in it', () => {
    expect(factionHeat(group([]), {}, settings)).toBe(0);
  });

  it('is more than the sum of the people in it, and grows with size', () => {
    const people = roster(6);
    const three = factionHeat(group(people.slice(0, 3)), byId(people), settings);
    const six = factionHeat(group(people), byId(people), settings);
    expect(six).toBeGreaterThan(three);
  });

  it('stops rewarding size eventually, or a faction is just the roster', () => {
    const many = roster(20);
    const six = factionHeat(group(many.slice(0, 6)), byId(many), settings);
    const twenty = factionHeat(group(many), byId(many), settings);
    expect(twenty - six).toBeLessThan(settings.factionSizeBonusCap);
  });

  it('falls when the people in it are losing', () => {
    const hot = roster(4, { momentum: 95 }, 'hot');
    const cold = roster(4, { momentum: 5 }, 'cold');
    expect(factionHeat(group(hot), byId(hot), settings)).toBeGreaterThan(
      factionHeat(group(cold), byId(cold), settings),
    );
  });
});

describe('when the group is bigger than the company', () => {
  it('knows it is running the place', () => {
    expect(overshadowsCompany(90, 40, settings)).toBe(true);
    expect(overshadowsCompany(40, 90, settings)).toBe(false);
  });

  it('is measured against the company, so a small outfit is overrun sooner', () => {
    // The same four men are a takeover in a territory and a midcard act in a
    // national. That is the honest version of the story.
    expect(overshadowsCompany(60, 30, settings)).toBe(true);
    expect(overshadowsCompany(60, 80, settings)).toBe(false);
  });

  it('walks up through forming, established, running and out of control', () => {
    expect(factionStanding(30, 2, 60, settings)).toBe('forming');
    expect(factionStanding(30, 4, 60, settings)).toBe('established');
    expect(factionStanding(90, 4, 40, settings)).toBe('running the place');
    expect(factionStanding(90, 7, 40, settings)).toBe('out of control');
  });
});

describe('taking people', () => {
  const people = roster(10);
  const faction = group(people.slice(0, 3));

  it('never offers somebody already in it', () => {
    const targets = recruitmentTargets(faction, people, settings);
    for (const id of faction.memberIds) {
      expect(targets.some((t) => t.wrestlerId === id), id).toBe(false);
    }
  });

  it('puts the unhappy at the top of the list', () => {
    const mixed = [
      ...roster(3, { morale: 10 }, 'unhappy'),
      ...roster(3, { morale: 95 }, 'happy'),
    ];
    const targets = recruitmentTargets(group([]), mixed, settings);
    expect(targets[0]!.appeal).toBeGreaterThan(targets[targets.length - 1]!.appeal);
  });

  it('wants somebody better than the spot they are in', () => {
    const wasted = roster(1, { talent: 95, popularity: 20 }, 'wasted')[0]!;
    const fine = roster(1, { talent: 60, popularity: 60 }, 'fine')[0]!;
    const targets = recruitmentTargets(group([]), [wasted, fine], settings);
    const appealOf = (id: Id) => targets.find((t) => t.wrestlerId === id)!.appeal;
    expect(appealOf(wasted.id)).toBeGreaterThan(appealOf(fine.id));
  });

  it('says why, because the reason is the interesting part', () => {
    for (const target of recruitmentTargets(faction, people, settings)) {
      expect(target.reason.length, target.name).toBeGreaterThan(20);
    }
  });

  it('leaves out the dead, the retired and the office', () => {
    const odd = [
      ...roster(2, { careerStatus: 'retired' }, 'ret'),
      ...roster(2, { role: 'referee' }, 'ref'),
      ...roster(2, {}, 'ok'),
    ];
    expect(recruitmentTargets(group([]), odd, settings)).toHaveLength(2);
  });

  it('pulls harder the better the group is doing', () => {
    const target = { wrestlerId: 'x', name: 'X', appeal: 0.5, reason: '' };
    const rate = (standing: Parameters<typeof rollRecruit>[2]) => {
      const rng = rngFromSeed(`pull-${standing}`);
      let yes = 0;
      for (let i = 0; i < 800; i++) if (rollRecruit(rng, target, standing, settings)) yes++;
      return yes / 800;
    };
    expect(rate('out of control')).toBeGreaterThan(rate('forming'));
    expect(rate('running the place')).toBeGreaterThan(rate('established'));
  });
});

describe('losing people', () => {
  it('is impossible while the group is on top — nobody walks out of that', () => {
    const member = roster(1, { ego: 95, morale: 5 }, 'star')[0]!;
    expect(defectionRisk(member, 'running the place', settings)).toBe(0);
    expect(defectionRisk(member, 'out of control', settings)).toBe(0);
  });

  it('is worst for a big ego in a group nobody is talking about', () => {
    const big = roster(1, { ego: 95, morale: 20 }, 'big')[0]!;
    const quiet = roster(1, { ego: 20, morale: 90 }, 'quiet')[0]!;
    expect(defectionRisk(big, 'forming', settings)).toBeGreaterThan(defectionRisk(quiet, 'forming', settings));
  });

  it('is worse in a group that never got going than one that did', () => {
    const member = roster(1, { ego: 80, morale: 30 }, 'm')[0]!;
    expect(defectionRisk(member, 'forming', settings)).toBeGreaterThan(
      defectionRisk(member, 'established', settings),
    );
  });

  it('never becomes a certainty', () => {
    const member = roster(1, { ego: 100, morale: 0 }, 'max')[0]!;
    expect(defectionRisk(member, 'forming', settings)).toBeLessThanOrEqual(settings.factionDefectionCap);
  });
});

describe('what it does to the people in it', () => {
  it('inflates an ego only once the group is actually on top', () => {
    expect(factionEgoDrift('forming', settings)).toBe(0);
    expect(factionEgoDrift('established', settings)).toBe(0);
    expect(factionEgoDrift('running the place', settings)).toBeGreaterThan(0);
  });

  it('is worst when it is out of control, which is the cost of the angle', () => {
    expect(factionEgoDrift('out of control', settings)).toBeGreaterThan(
      factionEgoDrift('running the place', settings),
    );
  });
});

describe('one man, one group', () => {
  const guy = (id: string, over: Partial<Wrestler> = {}) =>
    ({ id, name: id, morale: 40, ego: 60, hype: 60, popularity: 40, role: 'wrestler', careerStatus: 'midcarder', ...over }) as Wrestler;

  it('will not recruit somebody who is already in another faction', () => {
    // Measured before this existed: one wrestler joined three factions in the
    // same week, because every group read the same pool independently.
    const group = { id: 'f1', name: 'The Anvils', memberIds: ['a'], disbandedWeek: null } as never;
    const candidates = [guy('a'), guy('b'), guy('c')];

    const open = recruitmentTargets(group, candidates, settings);
    expect(open.map((t) => t.wrestlerId)).toContain('b');

    const taken = recruitmentTargets(group, candidates, settings, new Set(['b']));
    expect(taken.map((t) => t.wrestlerId)).not.toContain('b');
    expect(taken.map((t) => t.wrestlerId)).toContain('c');
  });

  it('never offers a group its own members', () => {
    const group = { id: 'f1', name: 'The Anvils', memberIds: ['a', 'b'], disbandedWeek: null } as never;
    const targets = recruitmentTargets(group, [guy('a'), guy('b'), guy('c')], settings);
    expect(targets.map((t) => t.wrestlerId)).toEqual(['c']);
  });
});
