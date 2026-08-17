import { describe, expect, it } from 'vitest';
import { rngFromSeed } from '../rng';
import { defaultWorldSettings } from '../world/settings';
import { generateWrestler } from '../generate/wrestler';
import { PERKS, perkById } from '../../data/perks';
import type { PerkId } from '../../data/perks';
import type { Wrestler } from '../types';
import {
  availablePerks,
  blockedBecause,
  canHave,
  loudestPerk,
  moodInsulation,
  perkExposure,
  perkFatigueRelief,
  perkMorale,
  perkRecovery,
  perkUpkeep,
  perksOf,
  resentmentToward,
  standingOf,
} from './perks';

const settings = defaultWorldSettings();
const YEAR = 2030;

function person(seed: string, over: Partial<Wrestler> = {}, perks: PerkId[] = []): Wrestler {
  const base = generateWrestler(rngFromSeed(seed), new Set(), { currentYear: YEAR });
  const w: Wrestler = {
    ...base,
    age: 32,
    debutYear: YEAR - 10,
    careerStatus: 'mainEventer',
    ...over,
  };
  if (w.contract) w.contract = { ...w.contract, perks };
  else
    w.contract = {
      guaranteedPct: 0.3,
      type: 'fullTime',
      weeklyRate: 2000,
      perAppearance: 500,
      weeksRemaining: 100,
      totalWeeks: 104,
      clauses: [],
      perks,
      signedYear: YEAR,
    };
  return w;
}

const RENEWAL = { currentYear: YEAR, isRenewal: true };
const SIGNING = { currentYear: YEAR, isRenewal: false };

describe('what is on the table', () => {
  it('gives a seasoned main-eventer the run of the list', () => {
    const list = availablePerks(person('big'), RENEWAL);
    expect(list.map((p) => p.id)).toContain('privateJet');
    expect(list.length).toBeGreaterThan(4);
  });

  it('offers a rookie nothing at all', () => {
    const kid = person('kid', { age: 21, debutYear: YEAR - 1, careerStatus: 'rookie' });
    expect(availablePerks(kid, RENEWAL)).toEqual([]);
  });

  it('never puts any of it in a first contract', () => {
    // Not a balance dial — you do not hand a jet to somebody you have never
    // worked with. It makes perks a lever for keeping people, not landing them.
    expect(availablePerks(person('big'), SIGNING)).toEqual([]);
  });

  it('says why, in words, when somebody cannot have something', () => {
    const jet = perkById('privateJet')!;
    const young = person('young', { age: 26, debutYear: YEAR - 9, careerStatus: 'draw' });
    expect(blockedBecause(jet, young, RENEWAL)).toContain('30');

    const green = person('green', { age: 34, debutYear: YEAR - 2, careerStatus: 'draw' });
    expect(blockedBecause(jet, green, RENEWAL)).toContain('years in the business');

    const midcard = person('mid', { age: 34, debutYear: YEAR - 12, careerStatus: 'midcarder' });
    expect(blockedBecause(jet, midcard, RENEWAL)).toBe('not at their level');

    expect(blockedBecause(jet, person('big'), SIGNING)).toContain('first contract');
  });

  it('keeps the jet at the very top of the business', () => {
    // Everybody below a main-eventer is refused it, whatever their age.
    for (const status of ['midcarder', 'gatekeeper', 'upperCard', 'journeyman'] as const) {
      const w = person(`s-${status}`, { age: 40, debutYear: YEAR - 20, careerStatus: status });
      expect(canHave(perkById('privateJet')!, w, RENEWAL)).toBe(false);
    }
    expect(canHave(perkById('privateJet')!, person('draw', { careerStatus: 'draw' }), RENEWAL)).toBe(true);
  });

  it('ranks a draw above a midcarder above a rookie', () => {
    expect(standingOf('draw')).toBeGreaterThan(standingOf('midcarder'));
    expect(standingOf('midcarder')).toBeGreaterThan(standingOf('rookie'));
  });
});

describe('what they cost and what they do', () => {
  it('bills for everything in the deal, every week', () => {
    const spoiled = person('spoiled', {}, ['privateJet', 'privateLockerRoom']);
    expect(perkUpkeep(spoiled)).toBe(
      perkById('privateJet')!.weeklyCost + perkById('privateLockerRoom')!.weeklyCost,
    );
    expect(perkUpkeep(person('plain'))).toBe(0);
  });

  it('reads nothing off a contract written before perks existed', () => {
    const old = person('old');
    delete old.contract!.perks;
    expect(perksOf(old)).toEqual([]);
    expect(perkUpkeep(old)).toBe(0);
    expect(perkMorale(old)).toBe(0);
  });

  it('keeps a body working — that is what the money buys', () => {
    const lookedAfter = person('after', {}, ['privateJet', 'personalTrainer']);
    expect(perkFatigueRelief(lookedAfter)).toBeGreaterThan(2);
    expect(perkRecovery(lookedAfter)).toBeGreaterThan(1);
  });

  it('costs somebody condition when a camera follows them everywhere', () => {
    const filmed = person('filmed', {}, ['documentaryCrew']);
    expect(perkFatigueRelief(filmed)).toBeLessThan(0);
    expect(perkExposure(filmed)).toBeGreaterThan(0);
  });
});

describe('what everybody else makes of it', () => {
  it('resents a door that shuts', () => {
    const star = person('star', {}, ['privateLockerRoom']);
    const rest = ['a', 'b', 'c'].map((seed) => person(seed));
    const room = [star, ...rest];
    expect(resentmentToward(rest[0]!, room, settings)).toBeGreaterThan(0);
  });

  it('does not resent an apartment', () => {
    // Nobody minds somebody having somewhere to live. The status perks are
    // the ones that cost.
    const housed = person('housed', {}, ['companyApartment']);
    const rest = ['a', 'b'].map((seed) => person(seed));
    expect(resentmentToward(rest[0]!, [housed, ...rest], settings)).toBe(0);
  });

  it('never has somebody resent their own jet', () => {
    const star = person('star', {}, ['privateJet']);
    const rest = ['a', 'b'].map((seed) => person(seed));
    expect(resentmentToward(star, [star, ...rest], settings)).toBe(0);
  });

  it('leaves somebody with perks of their own in no position to complain', () => {
    const star = person('star', {}, ['privateJet']);
    const alsoLookedAfter = person('also', {}, ['privateLockerRoom']);
    const plain = person('plain');
    const room = [star, alsoLookedAfter, plain];
    expect(resentmentToward(alsoLookedAfter, room, settings)).toBeLessThan(
      resentmentToward(plain, room, settings),
    );
  });

  it('is a scandal in a small company and a rumour in a big one', () => {
    const star = person('star', {}, ['privateJet']);
    const small = [star, person('a'), person('b'), person('c')];
    const big = [star, ...Array.from({ length: 40 }, (_, i) => person(`big-${i}`))];
    expect(resentmentToward(small[1]!, small, settings)).toBeGreaterThan(
      resentmentToward(big[1]!, big, settings),
    );
  });

  it('names the loudest thing in the room, so the note can say it', () => {
    // §0: nothing happens to a person off-screen. If the locker room is
    // unhappy about a jet, the locker room says "a jet".
    const jetted = person('jet', { name: 'Vance Mercer' }, ['privateJet', 'companyApartment']);
    const roomed = person('room', { name: 'Cass Dunmore' }, ['privateLockerRoom']);
    const loudest = loudestPerk([jetted, roomed]);
    expect(loudest).toEqual({ name: 'Private locker room', holder: 'Cass Dunmore' });
  });

  it('has nothing to say about a room where nobody was given anything', () => {
    const room = ['a', 'b'].map((seed) => person(seed));
    expect(resentmentToward(room[0]!, room, settings)).toBe(0);
    expect(loudestPerk(room)).toBeNull();
  });

  it('does not count the retired or the dead as an audience', () => {
    const star = person('star', {}, ['privateJet']);
    const gone = person('gone', { careerStatus: 'retired' });
    // Only the star and a retired man: nobody left to mind.
    expect(resentmentToward(gone, [star, gone], settings)).toBe(0);
  });
});

describe('the content itself', () => {
  it('gives every perk a real effect rather than flavour', () => {
    for (const perk of PERKS) {
      const does =
        perk.moraleGain !== 0 ||
        perk.fatigueRelief !== 0 ||
        perk.recovery !== 0 ||
        perk.exposure !== 0;
      expect(does, `${perk.id} does nothing`).toBe(true);
      expect(perk.weeklyCost, `${perk.id} is free`).toBeGreaterThan(0);
    }
  });

  it('charges the room for anything that carries status', () => {
    // A perk with no downside is a slider the player always maxes. The ones
    // that are purely practical are allowed to be free of it; the ones that
    // are about pecking order are not.
    const status = PERKS.filter((p) => p.id === 'privateJet' || p.id === 'privateLockerRoom' || p.id === 'documentaryCrew');
    for (const perk of status) expect(perk.lockerRoomCost, `${perk.id}`).toBeGreaterThan(0.2);
  });

  it('keeps them all out of a first contract', () => {
    for (const perk of PERKS) expect(perk.renewalOnly, `${perk.id}`).toBe(true);
  });
});

describe('a door that shuts', () => {
  // The counter-play to the one person whose mood spreads and is always bad.
  // A genuine trade rather than an upgrade: the same door is the loudest thing
  // on this list, so the room resents it every week it is there.
  it('is the only perk that shuts anybody off from the room', () => {
    const withDoor = { contract: { perks: ['privateLockerRoom'] } } as never as Wrestler;
    expect(moodInsulation(withDoor)).toBeGreaterThan(0);

    for (const perk of PERKS) {
      if (perk.id === 'privateLockerRoom') continue;
      const other = { contract: { perks: [perk.id] } } as never as Wrestler;
      expect(moodInsulation(other), perk.id).toBe(0);
    }
  });

  it('leaves somebody with no perks completely exposed to it', () => {
    expect(moodInsulation({ contract: { perks: [] } } as never as Wrestler)).toBe(0);
    expect(moodInsulation({ contract: null } as never as Wrestler)).toBe(0);
  });

  it('costs the room more than any other perk on the list', () => {
    // Quarantining somebody is not free, and this is the price.
    const door = PERKS.find((p) => p.id === 'privateLockerRoom')!;
    const loudest = Math.max(...PERKS.map((p) => p.lockerRoomCost));
    expect(door.lockerRoomCost).toBe(loudest);
  });
});
