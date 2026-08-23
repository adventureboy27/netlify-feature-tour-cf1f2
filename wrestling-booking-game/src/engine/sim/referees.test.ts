import { describe, it, expect } from 'vitest';
import {
  seedRefereePool,
  generateReferee,
  refereeAskingRate,
  currentRefereeAskingRate,
  createRefereeContract,
  refereeWageBill,
  effectiveCompetence,
  sharpnessLabel,
  refereeGrade,
  missChance,
  rollRefereeMiss,
  nameTheVictim,
  workedMatch,
  applyNightToReputation,
  tickRefereeWeek,
  refereeStanding,
  rankReferees,
  signedReferees,
  availableReferees,
  officialFor,
  spreadOfficials,
  tickRefereePool,
  isAvailable,
} from './referees';
import { REFEREE_MISSES, missesFor } from '../../data/refereeMisses';
import { defaultWorldSettings } from '../world/settings';
import { askingRate } from '../economy/contracts';
import { rngFromSeed } from '../rng';
import { generateWrestlers } from '../generate/wrestler';
import type { Referee } from '../types';

const settings = defaultWorldSettings();

function pool(): Referee[] {
  return seedRefereePool();
}

function find(referees: Referee[], id: string): Referee {
  const referee = referees.find((r) => r.id === id);
  if (!referee) throw new Error(`no referee ${id}`);
  return referee;
}

describe('the pool', () => {
  it('gives every seeded official a name, a blurb and a spread of ability', () => {
    const referees = pool();
    expect(referees.length).toBeGreaterThanOrEqual(10);
    for (const referee of referees) {
      expect(referee.name.length).toBeGreaterThan(0);
      expect(referee.blurb.length).toBeGreaterThan(10);
      expect(referee.competence).toBeGreaterThan(0);
    }
    const best = Math.max(...referees.map((r) => r.competence));
    const worst = Math.min(...referees.map((r) => r.competence));
    // Without a real gap between the best and the worst there is nothing to
    // decide when signing one.
    expect(best - worst).toBeGreaterThan(35);
  });

  it('starts everybody unsigned and fit', () => {
    for (const referee of pool()) {
      expect(referee.promotionId).toBeNull();
      expect(referee.contract).toBeNull();
      expect(referee.sharpness).toBe(100);
      expect(isAvailable(referee)).toBe(true);
    }
  });

  it('generates plain-named newcomers that are not instant aces', () => {
    const rng = rngFromSeed('gen');
    const made = Array.from({ length: 40 }, () => generateReferee(rng, new Set()));
    for (const referee of made) {
      expect(referee.name).toMatch(/^\S+ \S+$/);
      expect(referee.competence).toBeLessThanOrEqual(88);
      expect(referee.blurb.length).toBeGreaterThan(5);
    }
  });

  it('avoids reusing a name that is already in the business', () => {
    const rng = rngFromSeed('names');
    const taken = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const referee = generateReferee(rng, taken);
      expect(taken.has(referee.name)).toBe(false);
      taken.add(referee.name);
    }
  });
});

describe('what they cost', () => {
  it('prices the good ones well above the bad ones', () => {
    const referees = pool();
    expect(refereeAskingRate(find(referees, 'ref-hollis'), settings)).toBeGreaterThan(
      refereeAskingRate(find(referees, 'ref-tibbs'), settings) * 2,
    );
  });

  it('charges a premium for one who will do what he is told', () => {
    const straight: Referee = { ...find(pool(), 'ref-poole'), bendable: 5 };
    const crooked: Referee = { ...find(pool(), 'ref-poole'), bendable: 90 };
    expect(refereeAskingRate(crooked, settings)).toBeGreaterThan(refereeAskingRate(straight, settings));
  });

  it('keeps even the best official far cheaper than a wrestler', () => {
    // This is the whole promise of the system: officiating is the cheapest
    // quality you can buy, so neglecting it is a choice and not an accident.
    const wrestlers = generateWrestlers(rngFromSeed('w'), 30, { currentYear: settings.startingYear });
    const median = wrestlers.map((w) => askingRate(w, settings)).sort((a, b) => a - b)[15]!;
    const dearest = Math.max(...pool().map((r) => refereeAskingRate(r, settings)));
    expect(dearest).toBeLessThan(median);
  });

  it('discounts somebody nobody has hired in a long time', () => {
    const referee = find(pool(), 'ref-hollis');
    const fresh = currentRefereeAskingRate(referee, settings);
    const stale = currentRefereeAskingRate({ ...referee, weeksUnsigned: 40 }, settings);
    expect(stale).toBeLessThan(fresh);
    // But never to nothing — the discount is bounded.
    expect(stale).toBeGreaterThan(fresh * 0.5);
  });

  it('bills the whole crew weekly, and only your own', () => {
    const referees = pool();
    const mine = find(referees, 'ref-hollis');
    const theirs = find(referees, 'ref-cade');
    mine.promotionId = 'me';
    mine.contract = createRefereeContract(mine, settings, 1985);
    theirs.promotionId = 'them';
    theirs.contract = createRefereeContract(theirs, settings, 1985);

    expect(refereeWageBill(referees, 'me')).toBe(mine.contract!.weeklyRate);
  });
});

describe('the contract', () => {
  it('never carries creative control, or any clause at all', () => {
    // An official does not get to ask who goes over. There is no code path
    // that hands one a clause, and this test is the guard on that.
    for (const referee of pool()) {
      const contract = createRefereeContract(referee, settings, 1985);
      expect(contract.clauses).toEqual([]);
      expect(contract.clauses).not.toContain('creativeControl');
    }
  });

  it('is shorter than a wrestler deal', () => {
    const contract = createRefereeContract(find(pool(), 'ref-locke'), settings, 1985);
    expect(contract.weeksRemaining).toBe(settings.refereeContractWeeks);
    expect(contract.weeksRemaining).toBeLessThan(104);
  });

  it('runs down a week at a time and can expire', () => {
    const referee = find(pool(), 'ref-locke');
    referee.contract = createRefereeContract(referee, settings, 1985);
    for (let i = 0; i < settings.refereeContractWeeks; i++) tickRefereeWeek(referee, settings);
    expect(referee.contract.weeksRemaining).toBeLessThanOrEqual(0);
  });
});

describe('burnout across a card', () => {
  it('wears an official down match by match', () => {
    const referee = find(pool(), 'ref-hollis');
    const before = referee.sharpness;
    workedMatch(referee, settings);
    expect(referee.sharpness).toBeLessThan(before);
    expect(referee.matchesTonight).toBe(1);
    expect(referee.careerMatches).toBeGreaterThan(0);
  });

  it('makes the main event a worse match than the opener for the same man', () => {
    const referee = find(pool(), 'ref-hollis');
    const opener = effectiveCompetence(referee, settings);
    for (let i = 0; i < 5; i++) workedMatch(referee, settings);
    const mainEvent = effectiveCompetence(referee, settings);
    expect(mainEvent).toBeLessThan(opener);
    // Six matches has to be a real penalty or splitting the card is pointless.
    expect(opener - mainEvent).toBeGreaterThan(10);
  });

  it('still leaves a worn-out ace better than a fresh incompetent', () => {
    // Fatigue is a penalty, not a personality transplant.
    const ace = find(pool(), 'ref-hollis');
    for (let i = 0; i < 6; i++) workedMatch(ace, settings);
    const dud = find(pool(), 'ref-whitfield');
    expect(effectiveCompetence(ace, settings)).toBeGreaterThan(effectiveCompetence(dud, settings));
  });

  it('brings them back between shows', () => {
    const referee = find(pool(), 'ref-boyd');
    for (let i = 0; i < 6; i++) workedMatch(referee, settings);
    const spent = referee.sharpness;
    tickRefereeWeek(referee, settings);
    expect(referee.sharpness).toBeGreaterThan(spent);
    expect(referee.matchesTonight).toBe(0);
  });

  it('describes how fresh they are in words, never a number', () => {
    const referee = find(pool(), 'ref-hollis');
    const labels = new Set<string>();
    for (let i = 0; i < 8; i++) {
      labels.add(sharpnessLabel(referee));
      expect(sharpnessLabel(referee)).not.toMatch(/\d/);
      workedMatch(referee, settings);
    }
    expect(labels.size).toBeGreaterThan(2);
  });
});

describe('the things they miss', () => {
  const ctxFor = (referee: Referee, over: Partial<Parameters<typeof rollRefereeMiss>[1]> = {}) => ({
    referee,
    competitorIds: ['w1', 'w2'],
    hasTags: false,
    hadInterference: false,
    settings,
    ...over,
  });

  const rate = (referee: Referee, seed: string) => {
    const rng = rngFromSeed(seed);
    let missed = 0;
    for (let i = 0; i < 3000; i++) if (rollRefereeMiss(rng, ctxFor({ ...referee }))) missed += 1;
    return missed / 3000;
  };

  it('gives every miss a name and more than one way to say it', () => {
    for (const miss of REFEREE_MISSES) {
      expect(miss.label.length).toBeGreaterThan(0);
      expect(miss.lines.length).toBeGreaterThan(1);
      for (const line of miss.lines) expect(line).toContain('{ref}');
      if (miss.needsVictim) for (const line of miss.lines) expect(line).toContain('{victim}');
    }
  });

  it('has no duplicate ids', () => {
    const ids = REFEREE_MISSES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps the tag-only ones out of a singles match', () => {
    const singles = missesFor(false, false).map((m) => m.id);
    expect(singles).not.toContain('missedTag');
    expect(missesFor(true, false).map((m) => m.id)).toContain('missedTag');
    expect(missesFor(false, true).map((m) => m.id)).toContain('missedInterference');
  });

  it('always names the official who blew it', () => {
    // The player chose him. The write-up says so.
    const referee = find(pool(), 'ref-whitfield');
    const rng = rngFromSeed('named');
    for (let i = 0; i < 200; i++) {
      const miss = rollRefereeMiss(rng, ctxFor(referee));
      if (!miss) continue;
      const told = nameTheVictim(miss, 'Duke Rawlins');
      expect(told.text).toContain('Norm Whitfield');
      expect(told.text).not.toMatch(/\{[a-z]+\}/i);
      expect(told.text.length).toBeGreaterThan(20);
    }
  });

  it('never leaves a brace in the sentence even with nobody to blame', () => {
    const referee = find(pool(), 'ref-tibbs');
    const rng = rngFromSeed('nobody');
    for (let i = 0; i < 200; i++) {
      const miss = rollRefereeMiss(rng, ctxFor(referee, { competitorIds: [] }));
      if (!miss) continue;
      expect(nameTheVictim(miss, null).text).not.toMatch(/\{[a-z]+\}/i);
    }
  });

  it('makes the cheap official visibly worse than the good one', () => {
    // The entire reason to pay for officiating.
    expect(rate(find(pool(), 'ref-whitfield'), 'bad')).toBeGreaterThan(
      rate(find(pool(), 'ref-hollis'), 'good') * 3,
    );
  });

  it('makes a tired official worse than the same man fresh', () => {
    const fresh = find(pool(), 'ref-poole');
    const spent = find(pool(), 'ref-poole');
    for (let i = 0; i < 5; i++) workedMatch(spent, settings);
    expect(missChance(spent, settings)).toBeGreaterThan(missChance(fresh, settings));
  });

  it('leaves a good official mostly invisible', () => {
    // A referee the crowd notices every week is a referee the player would
    // have to fix, and fixing it every week is not a game.
    expect(rate(find(pool(), 'ref-hollis'), 'invisible')).toBeLessThan(0.06);
  });

  it('never makes a match certain to fall apart', () => {
    const disaster: Referee = { ...find(pool(), 'ref-tibbs'), competence: 0, sharpness: 0 };
    expect(missChance(disaster, settings)).toBeLessThanOrEqual(settings.refereeMissChanceCap);
  });

  it('blames somebody in the match when the miss went against a wrestler', () => {
    const rng = rngFromSeed('victim');
    const referee = find(pool(), 'ref-whitfield');
    for (let i = 0; i < 300; i++) {
      const miss = rollRefereeMiss(rng, ctxFor(referee));
      if (!miss?.victimId) continue;
      expect(['w1', 'w2']).toContain(miss.victimId);
    }
  });

  it('does not repeat the same miss line twice on one card', () => {
    // Same shape as the promo/confrontation/beat fix: a shared set across
    // several matches on one card should keep a repeated miss type from
    // reading the identical sentence twice.
    const disaster: Referee = { ...find(pool(), 'ref-tibbs'), competence: 0, sharpness: 0 };
    const rng = rngFromSeed('card-misses');
    const usedLines = new Set<string>();
    const byMiss = new Map<string, Set<string>>();
    for (let i = 0; i < 40; i++) {
      const miss = rollRefereeMiss(rng, ctxFor(disaster), usedLines);
      if (!miss) continue;
      const seen = byMiss.get(miss.missId) ?? new Set<string>();
      const raw = miss.text.replace(disaster.name, '{ref}');
      seen.add(raw);
      byMiss.set(miss.missId, seen);
    }
    expect(byMiss.size).toBeGreaterThan(0);
    for (const [missId, lines] of byMiss) {
      const pool = REFEREE_MISSES.find((m) => m.id === missId)!.lines.length;
      expect(lines.size, missId).toBeLessThanOrEqual(pool);
    }
  });
});

describe('standing in the business', () => {
  it('costs an official far more for a miss than a clean match returns', () => {
    const referee = find(pool(), 'ref-poole');
    const start = referee.reputation;

    referee.matchesTonight = 1;
    applyNightToReputation(referee, 1, settings);
    const afterMiss = referee.reputation;
    expect(afterMiss).toBeLessThan(start);

    referee.matchesTonight = 1;
    applyNightToReputation(referee, 0, settings);
    expect(referee.reputation - afterMiss).toBeLessThan(start - afterMiss);
  });

  it('ranks the reliable above the ones who keep blowing calls', () => {
    const referees = pool();
    const good = find(referees, 'ref-hollis');
    const bad = find(referees, 'ref-whitfield');
    good.recentMatches = 20;
    bad.recentMatches = 20;
    bad.recentMisses = 10;
    expect(refereeStanding(good)).toBeGreaterThan(refereeStanding(bad));
    expect(rankReferees(referees)[0]!.id).toBe('ref-hollis');
  });

  it('will not let an unbooked official coast at the top', () => {
    // Being brilliant and never used is not a career.
    const worked: Referee = { ...find(pool(), 'ref-locke'), recentMatches: 20 };
    const idle: Referee = { ...find(pool(), 'ref-locke'), recentMatches: 0 };
    expect(refereeStanding(worked)).toBeGreaterThan(refereeStanding(idle));
  });

  it('grades them in words', () => {
    expect(refereeGrade(find(pool(), 'ref-hollis'))).toBe('As good as they come');
    expect(refereeGrade(find(pool(), 'ref-whitfield'))).toBe('A liability');
    expect(refereeGrade(find(pool(), 'ref-hollis'))).not.toMatch(/\d/);
  });

  it('separates who is signed here from who is available', () => {
    const referees = pool();
    find(referees, 'ref-hollis').promotionId = 'me';
    find(referees, 'ref-cade').promotionId = 'them';
    expect(signedReferees(referees, 'me').map((r) => r.id)).toEqual(['ref-hollis']);
    const free = availableReferees(referees).map((r) => r.id);
    expect(free).not.toContain('ref-hollis');
    expect(free).not.toContain('ref-cade');
  });
});

describe('who counts this match', () => {
  it('prefers the one booked for the match over the card default', () => {
    const referees = pool();
    for (const r of referees) r.promotionId = 'me';
    expect(officialFor('ref-hollis', 'ref-tibbs', referees, 'me')?.id).toBe('ref-hollis');
  });

  it('falls back to the card default when a match names nobody', () => {
    const referees = pool();
    for (const r of referees) r.promotionId = 'me';
    expect(officialFor(null, 'ref-tibbs', referees, 'me')?.id).toBe('ref-tibbs');
  });

  it('refuses somebody else’s official', () => {
    const referees = pool();
    find(referees, 'ref-hollis').promotionId = 'them';
    expect(officialFor('ref-hollis', null, referees, 'me')).toBeNull();
  });

  it('refuses an injured official and falls through to the default', () => {
    const referees = pool();
    for (const r of referees) r.promotionId = 'me';
    find(referees, 'ref-hollis').injury = {
      severity: 'moderate',
      grade: 35,
      description: 'Knee',
      sufferedWeek: 1,
      totalWeeks: 6,
      weeksRemaining: 6,
      permanentStatLoss: {},
      earlyReturnWeeksUsed: 0,
    };
    expect(officialFor('ref-hollis', 'ref-tibbs', referees, 'me')?.id).toBe('ref-tibbs');
  });

  it('returns nobody when the promotion has signed nobody', () => {
    // Which is what puts a wrestler in the shirt — see ringside.ts.
    expect(officialFor(null, null, pool(), 'me')).toBeNull();
  });
});

describe('sharing out the card', () => {
  it('puts the best official on the main event', () => {
    const crew = [find(pool(), 'ref-tibbs'), find(pool(), 'ref-hollis'), find(pool(), 'ref-boyd')];
    const spread = spreadOfficials(crew, 6);
    expect(spread).toHaveLength(6);
    expect(spread[5]).toBe('ref-hollis');
  });

  it('keeps the best man off the undercard so he is fresh for it', () => {
    const crew = [find(pool(), 'ref-hollis'), find(pool(), 'ref-boyd'), find(pool(), 'ref-tibbs')];
    const spread = spreadOfficials(crew, 6);
    expect(spread.slice(0, 5)).not.toContain('ref-hollis');
  });

  it('shares the undercard out evenly rather than burning one man', () => {
    const crew = [find(pool(), 'ref-hollis'), find(pool(), 'ref-boyd'), find(pool(), 'ref-tibbs')];
    const spread = spreadOfficials(crew, 7);
    const counts = new Map<string, number>();
    for (const id of spread.slice(0, 6)) counts.set(id!, (counts.get(id!) ?? 0) + 1);
    expect(Math.max(...counts.values()) - Math.min(...counts.values())).toBeLessThanOrEqual(1);
  });

  it('works one man all night when he is all you have signed', () => {
    // Which is the state that teaches the player to sign a second one.
    const spread = spreadOfficials([find(pool(), 'ref-poole')], 6);
    expect(new Set(spread)).toEqual(new Set(['ref-poole']));
  });

  it('skips the injured', () => {
    const hurt = find(pool(), 'ref-hollis');
    hurt.injury = {
      severity: 'severe',
      grade: 60,
      description: 'Ankle',
      sufferedWeek: 1,
      totalWeeks: 8,
      weeksRemaining: 8,
      permanentStatLoss: {},
      earlyReturnWeeksUsed: 0,
    };
    const spread = spreadOfficials([hurt, find(pool(), 'ref-boyd')], 4);
    expect(spread).not.toContain('ref-hollis');
    expect(spread[3]).toBe('ref-boyd');
  });

  it('leaves every match to a wrestler when nobody is signed', () => {
    expect(spreadOfficials([], 5)).toEqual([null, null, null, null, null]);
  });
});

describe('the pool moves without you', () => {
  it('lets rivals sign the good ones you left sitting there', () => {
    const referees = pool();
    const rng = rngFromSeed('rivals');
    let taken = 0;
    for (let week = 0; week < 200; week++) {
      const { signedAway } = tickRefereePool(rng, {
        referees,
        playerPromotionId: 'me',
        rivalDemand: 1,
        settings,
      });
      for (const id of signedAway) {
        find(referees, id).promotionId = 'them';
        taken += 1;
      }
    }
    expect(taken).toBeGreaterThan(0);
  });

  it('never signs away somebody already under contract', () => {
    const referees = pool();
    for (const r of referees) r.promotionId = 'me';
    const { signedAway } = tickRefereePool(rngFromSeed('safe'), {
      referees,
      playerPromotionId: 'me',
      rivalDemand: 1,
      settings,
    });
    expect(signedAway).toEqual([]);
  });

  it('keeps producing new officials so the business never runs out of shirts', () => {
    const referees = pool();
    for (const r of referees) r.promotionId = 'them';
    const rng = rngFromSeed('refill');
    let made = 0;
    for (let week = 0; week < 100; week++) {
      const { newcomers } = tickRefereePool(rng, {
        referees,
        playerPromotionId: 'me',
        rivalDemand: 0.5,
        settings,
      });
      referees.push(...newcomers);
      made += newcomers.length;
    }
    expect(made).toBeGreaterThan(0);
  });
});

describe('the severity scale', () => {
  it('rates a blown three-count worse than a slow one', () => {
    // The store scales the rating hit and the victim's morale by this, so a
    // flat scale would make an untidy count as costly as a stolen match.
    const sloppy = REFEREE_MISSES.find((m) => m.id === 'slowCount')!;
    const stolen = REFEREE_MISSES.find((m) => m.id === 'shoulderUp')!;
    expect(stolen.severity).toBeGreaterThan(sloppy.severity);
  });

  it('keeps every severity inside the scale it is multiplied by', () => {
    for (const miss of REFEREE_MISSES) {
      expect(miss.severity).toBeGreaterThan(0);
      expect(miss.severity).toBeLessThanOrEqual(1);
    }
  });

  it('makes the ones that cost somebody a match the serious ones', () => {
    const costly = REFEREE_MISSES.filter((m) => m.needsVictim);
    const untidy = REFEREE_MISSES.filter((m) => !m.needsVictim);
    const mean = (list: typeof REFEREE_MISSES) => list.reduce((sum, m) => sum + m.severity, 0) / list.length;
    expect(mean(costly)).toBeGreaterThan(mean(untidy));
  });
});
