import { describe, expect, it } from 'vitest';
import { confrontationAvailable, possibleTwists, resolveConfrontation } from './confrontation';
import { CONFRONTATIONS, CONFRONTATION_TWISTS, confrontationById } from '../../data/confrontations';
import { defaultWorldSettings } from '../world/settings';
import { generateWrestlers } from '../generate/wrestler';
import { rngFromSeed } from '../rng';
import type { Wrestler } from '../types';

const settings = defaultWorldSettings();

function person(over: Partial<Wrestler> = {}, seed = 'confront'): Wrestler {
  const [w] = generateWrestlers(rngFromSeed(seed), 1);
  return { ...w!, charisma: 50, popularity: 50, alignment: 0, ...over };
}

const talker = person({ charisma: 95, popularity: 85 }, 'talker');
const mute = person({ charisma: 12, popularity: 30 }, 'mute');
const bystander = person({}, 'third');

function run(over: Partial<Parameters<typeof resolveConfrontation>[1]> = {}, seed = 'run') {
  return resolveConfrontation(rngFromSeed(seed), {
    definitionId: 'callOut',
    venue: 'ring',
    speaker: talker,
    opposite: mute,
    existingHeat: 0,
    settings,
    ...over,
  });
}

describe('the library', () => {
  it('gives every segment somewhere to happen and something to say', () => {
    for (const c of CONFRONTATIONS) {
      expect(c.venues.length, c.id).toBeGreaterThan(0);
      expect(c.openers.length, c.id).toBeGreaterThan(1);
      for (const line of c.openers) {
        expect(line, c.id).toContain('{a}');
        expect(line.length, c.id).toBeGreaterThan(30);
      }
    }
  });

  it('covers both a ring and a corridor', () => {
    expect(CONFRONTATIONS.some((c) => c.venues.includes('ring'))).toBe(true);
    expect(CONFRONTATIONS.some((c) => c.venues.includes('backstage'))).toBe(true);
  });

  it('has a segment for each thing a booker might be trying to do', () => {
    const intents = new Set(CONFRONTATIONS.map((c) => c.intent));
    for (const intent of ['callOut', 'contractSigning', 'turn', 'jealousy', 'stableTension']) {
      expect(intents, intent).toContain(intent);
    }
  });

  it('weights the dull outcomes heaviest, like the rest of the chaos layer', () => {
    const dull = CONFRONTATION_TWISTS.find((t) => t.id === 'tookIt')!;
    const real = CONFRONTATION_TWISTS.find((t) => t.id === 'wentIntoBusiness')!;
    expect(dull.weight).toBeGreaterThan(real.weight * 3);
  });

  it('only lets somebody get hurt when there is somebody to hurt', () => {
    for (const twist of CONFRONTATION_TWISTS) {
      if (twist.injuryWeeks) expect(twist.hurts, twist.id).toBeDefined();
      if (twist.needsThird) expect(twist.lines.join(' '), twist.id).toContain('{c}');
    }
  });
});

describe('which twists can happen', () => {
  it('keeps a contract-signing twist out of a segment with no contract', () => {
    const callOut = confrontationById('callOut')!;
    const ids = possibleTwists(callOut, 'ring', false).map((t) => t.id);
    expect(ids).not.toContain('throughTheTable');
    expect(ids).not.toContain('refusedToSign');
  });

  it('keeps a ring twist out of a corridor', () => {
    const words = confrontationById('backstageWords')!;
    const ids = possibleTwists(words, 'backstage', false).map((t) => t.id);
    expect(ids).not.toContain('thirdParty');
    expect(ids).not.toContain('crowdTurned');
  });

  it('will not hit a partner who was never in the segment', () => {
    const callOut = confrontationById('callOut')!;
    expect(possibleTwists(callOut, 'ring', false).map((t) => t.id)).not.toContain('allyMisfire');
    expect(possibleTwists(callOut, 'ring', true).map((t) => t.id)).toContain('allyMisfire');
  });

  it('always leaves something that can happen', () => {
    for (const definition of CONFRONTATIONS) {
      for (const venue of definition.venues) {
        expect(possibleTwists(definition, venue, false).length, `${definition.id}/${venue}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('the exchange', () => {
  it('is usually won by the better talker', () => {
    let talkerWins = 0;
    for (let i = 0; i < 200; i++) {
      const out = run({}, `who-${i}`)!;
      if (out.wonBy === talker.id) talkerWins++;
    }
    expect(talkerWins).toBeGreaterThan(150);
  });

  it('is not always won by the better talker, or it is not a segment', () => {
    const better = person({ charisma: 70 }, 'a');
    const worse = person({ charisma: 58 }, 'b');
    let upsets = 0;
    for (let i = 0; i < 400; i++) {
      if (run({ speaker: better, opposite: worse }, `up-${i}`)!.wonBy === worse.id) upsets++;
    }
    expect(upsets).toBeGreaterThan(0);
  });

  it('rates higher with a good talker in it than with two bad ones', () => {
    const good = run({ speaker: talker, opposite: person({ charisma: 70 }, 'ok') }, 'good')!;
    const bad = run({ speaker: mute, opposite: person({ charisma: 20 }, 'worse') }, 'bad')!;
    expect(good.quality).toBeGreaterThan(bad.quality);
  });

  it('rates a hot feud higher than a cold one', () => {
    expect(run({ existingHeat: 90 }, 'hot')!.quality).toBeGreaterThan(run({ existingHeat: 0 }, 'cold')!.quality);
  });

  it('names everybody who was in it', () => {
    const out = run({ definitionId: 'stableCracks', third: bystander }, 'names')!;
    expect(out.text).toContain(talker.name);
    expect(out.text).not.toMatch(/\{[abc]\}/);
  });

  it('does not repeat the identical write-up across two confrontations on the same card', () => {
    // Same bug shape as sim/promo.ts's writeUp: an opener and a twist line
    // drawn independently per confrontation, from pools of only 3 lines
    // each — a real risk when a card books more than one on the same
    // definition and venue.
    const usedLines = new Set<string>();
    const texts: string[] = [];
    for (let i = 0; i < 5; i++) {
      const out = resolveConfrontation(
        rngFromSeed(`card-${i}`),
        { definitionId: 'callOut', venue: 'ring', speaker: talker, opposite: mute, existingHeat: 0, settings },
        usedLines,
      );
      if (out) texts.push(out.text);
    }
    expect(new Set(texts).size).toBe(texts.length);
  });
});

describe('where it happens', () => {
  it('moves a feud further in front of a crowd than in a corridor', () => {
    const ring = run({ venue: 'ring', definitionId: 'jealousyOverTheSpot' }, 'r');
    const back = run({ venue: 'backstage', definitionId: 'jealousyOverTheSpot' }, 'r');
    expect(ring!.heat).toBeGreaterThan(back!.heat);
  });

  it('turns real more often backstage, where nobody is watching', () => {
    const shootRate = (venue: 'ring' | 'backstage') => {
      let real = 0;
      for (let i = 0; i < 500; i++) {
        const out = run({ venue, definitionId: 'jealousyOverTheSpot' }, `shoot-${venue}-${i}`)!;
        if (out.shootHeat > 0) real++;
      }
      return real / 500;
    };
    expect(shootRate('backstage')).toBeGreaterThan(shootRate('ring'));
  });
});

describe('the things nobody booked', () => {
  it('mostly does not happen', () => {
    let quiet = 0;
    for (let i = 0; i < 400; i++) {
      const out = run({}, `quiet-${i}`)!;
      if (out.twistId === 'tookIt' || out.twistId === 'answeredBack') quiet++;
    }
    // A clear majority of nights are two men talking and one of them winning
    // it. Measured at roughly 59% for an ordinary call-out.
    expect(quiet).toBeGreaterThan(220);
  });

  it('produces real animosity from a microphone, which nothing else in the game does', () => {
    // shootHeat only ever came out of matches. Somebody saying the thing they
    // should not have is the classic way it actually starts.
    let seen = false;
    for (let i = 0; i < 400 && !seen; i++) {
      if ((run({ venue: 'backstage', definitionId: 'backstageWords' }, `real-${i}`)!).shootHeat > 20) seen = true;
    }
    expect(seen).toBe(true);
  });

  it('can put the wrong man down, and it is the partner who was in it', () => {
    let misfire: ReturnType<typeof resolveConfrontation> = null;
    for (let i = 0; i < 600 && !misfire; i++) {
      const out = run({ definitionId: 'stableCracks', third: bystander }, `miss-${i}`)!;
      if (out.twistId === 'allyMisfire') misfire = out;
    }
    expect(misfire, 'never once hit the wrong man').not.toBeNull();
    expect(misfire!.casualty?.wrestlerId).toBe(bystander.id);
    expect(misfire!.text).toContain(bystander.name);
  });

  it('sends somebody through a table only at a contract signing', () => {
    let tabled = false;
    for (let i = 0; i < 300; i++) {
      if (run({ definitionId: 'contractSigning' }, `tbl-${i}`)!.twistId === 'throughTheTable') tabled = true;
      expect(run({ definitionId: 'callOut' }, `no-tbl-${i}`)!.twistId).not.toBe('throughTheTable');
    }
    expect(tabled).toBe(true);
  });
});

describe('a booked turn', () => {
  it('shifts the alignment it was booked to shift', () => {
    const out = run({ definitionId: 'theTurn' }, 'turn')!;
    expect(Math.abs(out.alignmentShift)).toBe(settings.confrontationTurnShift);
  });

  it('can land the wrong way round in front of a live crowd', () => {
    // The crowd decides what somebody is. That is the risk of booking a turn
    // rather than letting one happen.
    let backwards = false;
    for (let i = 0; i < 400 && !backwards; i++) {
      const out = run({ definitionId: 'theTurn', venue: 'ring' }, `back-${i}`)!;
      if (out.twistId === 'crowdTurned' && out.alignmentShift < 0) backwards = true;
    }
    expect(backwards).toBe(true);
  });

  it("leaves everybody else's alignment alone", () => {
    expect(run({ definitionId: 'callOut' }, 'noturn')!.alignmentShift).toBe(0);
  });
});

describe('what a pair can be given', () => {
  const base = { speaker: talker, opposite: mute, allies: false, championship: false, romance: false };

  it('will not book somebody against himself', () => {
    expect(
      confrontationAvailable(confrontationById('callOut')!, { ...base, opposite: talker }),
    ).toBe(false);
  });

  it('only offers a stable segment to people in one', () => {
    const cracks = confrontationById('stableCracks')!;
    expect(confrontationAvailable(cracks, base)).toBe(false);
    expect(confrontationAvailable(cracks, { ...base, allies: true })).toBe(true);
  });

  it('only offers a title challenge when somebody holds one', () => {
    const challenge = confrontationById('championshipChallenge')!;
    expect(confrontationAvailable(challenge, base)).toBe(false);
    expect(confrontationAvailable(challenge, { ...base, championship: true })).toBe(true);
  });

  it('only offers the jealousy angle when there is somebody to be jealous over', () => {
    const jealous = confrontationById('jealousyOverAPartner')!;
    expect(confrontationAvailable(jealous, base)).toBe(false);
    expect(confrontationAvailable(jealous, { ...base, romance: true })).toBe(true);
  });

  it('offers an ordinary call-out to anybody', () => {
    expect(confrontationAvailable(confrontationById('callOut')!, base)).toBe(true);
  });
});
