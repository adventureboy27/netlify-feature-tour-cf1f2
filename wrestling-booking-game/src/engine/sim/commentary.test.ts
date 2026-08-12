import { describe, expect, it } from 'vitest';
import { callTheMatch, factsOf, permittedNames, type CommentaryContext } from './commentary';
import {
  BANTER,
  CLOSERS,
  COLOUR,
  COMEBACKS,
  OPENERS,
  PLAY_BY_PLAY,
  STAKES,
  type ColourTemplate,
} from '../../data/commentaryLines';
import { COMMENTARY_TEAMS } from '../../data/commentators';
import { defaultWorldSettings } from '../world/settings';
import { createStartingTitles } from '../../data/titles';
import { generateWrestlers } from '../generate/wrestler';
import { rngFromSeed } from '../rng';
import type { MatchBeat, Wrestler } from '../types';

const settings = defaultWorldSettings();

function person(seed: string, over: Partial<Wrestler> = {}): Wrestler {
  const [w] = generateWrestlers(rngFromSeed(seed), 1);
  return { ...w!, age: 30, weightLbs: 220, ...over };
}

const BEATS: MatchBeat[] = [
  { kind: 'openingExchange', text: 'They locked up.', significant: true },
  { kind: 'control', text: 'One took over.', significant: true },
  { kind: 'hopeSpot', text: 'The other fought back.', significant: true },
  { kind: 'nearFall', text: 'A near thing.', significant: true },
  { kind: 'signature', text: 'A big move.', significant: true },
  { kind: 'finish', text: 'And it ended.', significant: true },
];

/** A match with nothing going on: two people, an official, nothing else. */
function bare(over: Partial<CommentaryContext> = {}): CommentaryContext {
  return {
    team: COMMENTARY_TEAMS[0]!,
    sideA: [person('a', { name: 'Aaron Quist' })],
    sideB: [person('b', { name: 'Bo Halvorsen' })],
    winningSide: 'a',
    managers: [],
    refereeName: null,
    guestRefereeName: null,
    refereeMiss: null,
    titles: [],
    championName: null,
    championWeeks: 0,
    titleChanged: false,
    stipulationName: null,
    shootHeat: 0,
    isMainEvent: false,
    finish: 'cleanPin',
    rating: 55,
    beats: BEATS,
    injuries: [],
    hurtComingIn: null,
    incidentText: null,
    crowd: 'warm',
    upset: false,
    formerChampionName: null,
    formerChampionTitle: null,
    otherBeltHolderName: null,
    otherBeltName: null,
    onATearName: null,
    onATearRun: 0,
    slumpingName: null,
    slumpingRun: 0,
    debutantName: null,
    secondGenName: null,
    secondGenParentName: null,
    oldHandName: null,
    oldHandYears: 0,
    timesMet: 1,
    feudWeeks: 0,
    feudMatches: 0,
    isBlowoff: false,
    townName: 'Bramble Hollow',
    weatherLine: null,
    isPPV: false,
    settings,
    ...over,
  };
}

/**
 * Everything the call put on screen, as one blob.
 *
 * Joined on a full stop rather than a space so that the first word of every
 * line still reads as sentence-initial — otherwise "Live from Bramble Hollow"
 * looks like somebody called Live to the name check below.
 */
function said(ctx: CommentaryContext, seed = 'call'): string {
  return callTheMatch(rngFromSeed(seed), ctx)
    .map((l) => l.text)
    .join('. ');
}

// ---------------------------------------------------------------------------
// The rule the whole module exists for, enforced at authoring time.
//
// Every placeholder a template uses has to be backed by a fact that template
// declares. Get this wrong and the call eventually mentions a manager in a
// match with no manager in it, which is the exact failure that makes the
// feature not worth having.
// ---------------------------------------------------------------------------

/** Placeholder -> the facts, any one of which makes it safe to use. */
const BACKED_BY: Record<string, string[]> = {
  manager: ['manager', 'deviousManager'],
  managerClient: ['manager', 'deviousManager'],
  ref: ['referee', 'refereeMiss'],
  refMiss: ['refereeMiss'],
  guestRef: ['guestReferee'],
  title: ['title', 'titleChange', 'titleRetained', 'longReign'],
  champion: ['titleRetained', 'longReign', 'titleChange'],
  reign: ['longReign'],
  hurt: ['injuredInMatch'],
  hurtHow: ['injuredInMatch'],
  hurtComingIn: ['carryingInjury'],
  incident: ['incident'],
  stip: ['stipulation'],
  vet: ['veteran'],
  rookie: ['rookie'],
  big: ['sizeGap'],
  small: ['sizeGap'],
  onTopPartner: ['tagMatch'],
  inTroublePartner: ['tagMatch'],
  formerChamp: ['formerChampion'],
  formerTitle: ['formerChampion'],
  otherChamp: ['reigningElsewhere'],
  otherBelt: ['reigningElsewhere'],
  streaking: ['onATear'],
  slumping: ['slumping'],
  debutant: ['debut'],
  secondGen: ['secondGeneration'],
  secondGenParent: ['secondGeneration'],
  timesMet: ['metOften'],
  feudWeeks: ['longFeud'],
  feudMatches: ['longFeud'],
  weather: ['weatherHurtGate'],
  tearRun: ['onATear'],
  slumpRun: ['slumping'],
  oldHand: ['longCareer'],
  oldHandYears: ['longCareer'],
};

/** Placeholders that are always safe — they resolve from the match itself. */
const ALWAYS_SAFE = new Set([
  'play',
  'colour',
  'onTop',
  'inTrouble',
  'finisher',
  'sideA',
  'sideB',
  // The town is always known — the show is being staged somewhere.
  'town',
]);

/** Placeholders nobody on commentary could know before the bell. */
const SPOILERS = new Set(['winner', 'loser', 'winnerFinisher']);

function placeholdersIn(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!);
}

function checkPool(name: string, pool: readonly ColourTemplate[], spoilersAllowed: boolean) {
  describe(name, () => {
    it('never uses a placeholder it has not earned', () => {
      for (const template of pool) {
        for (const key of placeholdersIn(template.text)) {
          if (ALWAYS_SAFE.has(key)) continue;
          if (SPOILERS.has(key)) continue;
          const backing = BACKED_BY[key];
          expect(backing, `${name}: unknown placeholder {${key}} in "${template.text}"`).toBeDefined();
          expect(
            backing!.some((fact) => template.needs.includes(fact as never)),
            `${name}: "${template.text}" uses {${key}} without declaring ${backing!.join(' or ')}`,
          ).toBe(true);
        }
      }
    });

    if (!spoilersAllowed) {
      it('never gives away the finish — nobody on commentary knows yet', () => {
        for (const template of pool) {
          for (const key of placeholdersIn(template.text)) {
            expect(SPOILERS.has(key), `${name}: "${template.text}" names the ${key} mid-match`).toBe(false);
          }
        }
      });
    }

    it('reads like a sentence somebody would say', () => {
      for (const template of pool) {
        // A template that is nothing but one placeholder is a pass-through —
        // the colour man relaying a headline the world already wrote — and
        // its real length is whatever it is filled with.
        if (/^\{\w+\}$/.test(template.text)) continue;
        expect(template.text.length, template.text).toBeGreaterThan(12);
        expect(template.text.trim(), template.text).toBe(template.text);
      }
    });
  });
}

checkPool('the openers', OPENERS, false);
checkPool('the stakes', STAKES, false);
checkPool('the colour lines', COLOUR, false);
checkPool('the comebacks', COMEBACKS, false);
checkPool('the closers', CLOSERS, true);
checkPool('the last word', BANTER, true);

describe('the match type reads as English', () => {
  // Stipulation names are bare noun phrases with no article, and several
  // already contain the word "Match" — "Steel Cage", "Tables Match", "Hair vs
  // Hair". Two templates assumed otherwise and shipped "this is Tables Match"
  // and "in a Tables Match match".
  const withStip = [...OPENERS, ...STAKES, ...COLOUR, ...CLOSERS, ...BANTER].filter((t) =>
    t.text.includes('{stip}'),
  );

  it('has lines about the match type at all', () => {
    expect(withStip.length).toBeGreaterThan(3);
  });

  it('never puts an article in front of it', () => {
    for (const t of withStip) {
      expect(t.text, t.text).not.toMatch(/\b(a|an|the)\s+\{stip\}/i);
    }
  });

  it('never follows it with the word it may already contain', () => {
    for (const t of withStip) {
      expect(t.text, t.text).not.toMatch(/\{stip\}\s+match/i);
    }
  });
});

describe('the play-by-play', () => {
  it('only names the winner in the finish call', () => {
    for (const [kind, lines] of Object.entries(PLAY_BY_PLAY)) {
      for (const text of lines ?? []) {
        for (const key of placeholdersIn(text)) {
          if (!SPOILERS.has(key)) continue;
          expect(kind, `"${text}" names the ${key} during a ${kind} beat`).toBe('finish');
        }
      }
    }
  });

  it('only uses placeholders that need no fact at all — beats are not gated', () => {
    for (const lines of Object.values(PLAY_BY_PLAY)) {
      for (const text of lines ?? []) {
        for (const key of placeholdersIn(text)) {
          expect(ALWAYS_SAFE.has(key) || SPOILERS.has(key), `"${text}" uses {${key}}`).toBe(true);
        }
      }
    }
  });

  it('has something to say about every kind of beat the sim produces', () => {
    for (const kind of ['openingExchange', 'control', 'hopeSpot', 'nearFall', 'signature', 'finish']) {
      expect((PLAY_BY_PLAY as Record<string, readonly string[]>)[kind]?.length ?? 0, kind).toBeGreaterThan(2);
    }
  });
});

// ---------------------------------------------------------------------------
// And the same rule, checked against calls that actually ran.
// ---------------------------------------------------------------------------

describe('a match with nothing going on', () => {
  it('never invents a manager, an official, or a championship', () => {
    // Twenty seeds, because one quiet call proves nothing.
    for (let i = 0; i < 20; i++) {
      const text = said(bare(), `quiet-${i}`);
      expect(text, `seed ${i}`).not.toMatch(/manager/i);
      expect(text, `seed ${i}`).not.toMatch(/championship|the belt|title/i);
      expect(text, `seed ${i}`).not.toMatch(/\{|\}/);
    }
  });

  it('still tells the whole story — who, what happened, and how it ended', () => {
    const lines = callTheMatch(rngFromSeed('story'), bare());
    expect(lines.length).toBeGreaterThan(3);
    // Opens by naming them.
    expect(lines[0]!.text).toMatch(/Aaron Quist|Bo Halvorsen/);
    // And closes on the result.
    expect(lines.map((l) => l.text).join(' ')).toMatch(/Aaron Quist/);
  });
});

describe('every word is spoken by somebody with a name', () => {
  it('uses only the two on the headset', () => {
    const ctx = bare();
    const lines = callTheMatch(rngFromSeed('voices'), ctx);
    for (const line of lines) {
      expect([ctx.team.playByPlayName, ctx.team.colourName]).toContain(line.name);
      expect(line.name).toBe(line.speaker === 'play' ? ctx.team.playByPlayName : ctx.team.colourName);
    }
  });

  it('names nobody who was not part of the match', () => {
    const titles = createStartingTitles('me', 'Southside', 'territory').slice(0, 1);
    const ctx = bare({
      managers: [{ name: 'Cyrus Fell', clientName: 'Bo Halvorsen', devious: true }],
      refereeName: 'Nils Overgaard',
      titles,
      championName: 'Aaron Quist',
      championWeeks: 40,
      injuries: [{ name: 'Bo Halvorsen', text: 'landed on his shoulder' }],
    });
    // Every word of every permitted name, plus the handful of capitalised
    // words that are ordinary English rather than somebody's name.
    const allowedWords = new Set<string>();
    for (const name of permittedNames(ctx)) for (const word of name.split(/\s+/)) allowedWords.add(word);
    const ORDINARY = new Set(['I', 'A', 'And', 'The', 'He', 'They', 'That', 'This', 'What', 'Wait', 'Look', 'New', 'Listen', 'Somebody', 'Under', 'Great', 'Right', 'Off', 'Get', 'Every', 'Green', 'Nobody', 'Twenty', 'Main', 'Collar', 'One', 'Elbow', 'Cover', 'Backbreaker', 'Reversal', 'Chain', 'No', 'It', 'You', 'There', 'Those', 'Now', 'Good', 'Here', 'Next', 'Will', 'Say', 'All', 'Hang', 'Watch', 'These', 'Our', 'Never', 'Reversal', 'Two', 'Three', 'His', 'Her', 'Their', 'Not', 'Neither', 'Feeling', 'Straight', 'Stomps', 'Wearing', 'Picking', 'Slows', 'Cannot', 'Because', 'Yes', 'We', 'Twenty']);

    for (let seed = 0; seed < 25; seed++) {
      const text = said(ctx, `names-${seed}`);
      // Sentence by sentence, dropping the opening word of each — a
      // capitalised word at the start of a sentence is grammar, not a name.
      for (const sentence of text.split(/[.!?—]+\s*/)) {
        const words = sentence.trim().split(/\s+/).slice(1);
        for (const raw of words) {
          const word = raw.replace(/[^A-Za-z]/g, '');
          if (!/^[A-Z][a-z]+$/.test(word)) continue;
          if (ORDINARY.has(word)) continue;
          expect(
            allowedWords.has(word),
            `seed ${seed}: the call said "${word}", who was not part of this match`,
          ).toBe(true);
        }
      }
    }
  });
});

describe('it flows', () => {
  it('hands the advantage over at the hope spot, not at random', () => {
    // The loser controls early and the winner comes back — otherwise the hope
    // spot and the near-fall read backwards.
    const ctx = bare();
    const lines = callTheMatch(rngFromSeed('flow'), ctx);
    const joined = lines.map((l) => l.text);
    const controlLine = joined.findIndex((t) => t.includes('Bo Halvorsen'));
    expect(controlLine).toBeGreaterThanOrEqual(0);
  });

  it('always ends on the finish being called', () => {
    for (let i = 0; i < 20; i++) {
      const lines = callTheMatch(rngFromSeed(`finish-${i}`), bare());
      // The finish is the last thing the play-by-play man says.
      const lastPlay = [...lines].reverse().find((l) => l.speaker === 'play');
      expect(lastPlay, `seed ${i}`).toBeDefined();
      const afterFinish = lines.slice(lines.indexOf(lastPlay!) + 1);
      expect(afterFinish.every((l) => l.speaker === 'colour'), `seed ${i}`).toBe(true);
    }
  });

  it('never runs longer than the cap, however much is going on', () => {
    const busy = bare({
      managers: [{ name: 'Cyrus Fell', clientName: 'Bo Halvorsen', devious: true }],
      refereeName: 'Nils Overgaard',
      refereeMiss: 'never saw the foot on the rope',
      titles: createStartingTitles('me', 'Southside', 'territory').slice(0, 1),
      championName: 'Aaron Quist',
      championWeeks: 60,
      stipulationName: 'Steel Cage',
      shootHeat: 90,
      isMainEvent: true,
      rating: 92,
      crowd: 'hot',
      injuries: [{ name: 'Bo Halvorsen', text: 'came down on his neck' }],
      incidentText: 'Somebody came through the crowd.',
      beats: [...BEATS, ...BEATS, ...BEATS],
    });
    for (let i = 0; i < 10; i++) {
      expect(callTheMatch(rngFromSeed(`busy-${i}`), busy).length).toBeLessThanOrEqual(
        settings.commentaryMaxLines,
      );
    }
  });

  it('never says the same line twice in one match', () => {
    for (let i = 0; i < 20; i++) {
      const texts = callTheMatch(rngFromSeed(`dupe-${i}`), bare()).map((l) => l.text);
      expect(new Set(texts).size, `seed ${i}`).toBe(texts.length);
    }
  });
});

describe('what it is allowed to talk about', () => {
  it('reads the facts off the match rather than being told them', () => {
    const facts = factsOf(
      bare({
        managers: [{ name: 'Cyrus Fell', clientName: 'Bo Halvorsen', devious: true }],
        refereeName: 'Nils Overgaard',
        shootHeat: 90,
        rating: 90,
        crowd: 'hot',
        isMainEvent: true,
      }),
    );
    expect([...facts].sort()).toEqual(
      ['deviousManager', 'greatMatch', 'hotCrowd', 'grudge', 'mainEvent', 'manager', 'referee'].sort(),
    );
  });

  it('knows nothing about a match where nothing is true', () => {
    expect([...factsOf(bare())]).toEqual([]);
  });

  it('spots a size difference worth mentioning, and ignores one that is not', () => {
    const big = bare({
      sideA: [person('a', { name: 'Aaron Quist', weightLbs: 330 })],
      sideB: [person('b', { name: 'Bo Halvorsen', weightLbs: 180 })],
    });
    expect(factsOf(big).has('sizeGap')).toBe(true);
    expect(factsOf(bare()).has('sizeGap')).toBe(false);
  });

  it('knows a former champion from somebody who has never held anything', () => {
    const was = bare({ formerChampionName: 'Bo Halvorsen', formerChampionTitle: 'The Southside Title' });
    expect(factsOf(was).has('formerChampion')).toBe(true);
    // Half the fact is not the fact — a name with no belt behind it says
    // nothing, and the line would read "used to carry a championship".
    expect(factsOf(bare({ formerChampionName: 'Bo Halvorsen' })).has('formerChampion')).toBe(false);
    expect(factsOf(bare()).has('formerChampion')).toBe(false);
    expect(said(was, 'former')).toMatch(/Bo Halvorsen|Southside/);
  });

  it('separates a belt somebody is carrying from the one being contested', () => {
    const other = bare({ otherBeltHolderName: 'Aaron Quist', otherBeltName: 'The Tag Titles' });
    expect(factsOf(other).has('reigningElsewhere')).toBe(true);
    expect(factsOf(bare()).has('reigningElsewhere')).toBe(false);
  });

  it('notices a run of form in either direction, and says so about the right man', () => {
    expect(factsOf(bare({ onATearName: 'Aaron Quist' })).has('onATear')).toBe(true);
    expect(factsOf(bare({ slumpingName: 'Bo Halvorsen' })).has('slumping')).toBe(true);
    expect(said(bare({ slumpingName: 'Bo Halvorsen' }), 'slump')).toMatch(/Bo Halvorsen/);
  });

  it('knows a debut from an ordinary night', () => {
    expect(factsOf(bare({ debutantName: 'Aaron Quist' })).has('debut')).toBe(true);
    expect(factsOf(bare()).has('debut')).toBe(false);
  });

  it('only calls a match a first meeting when it is worth remarking on', () => {
    // Two people nobody has heard of meeting for the first time is not a
    // story, so a poor match does not get the line.
    expect(factsOf(bare({ timesMet: 0, rating: 70 })).has('firstMeeting')).toBe(true);
    expect(factsOf(bare({ timesMet: 0, rating: 20 })).has('firstMeeting')).toBe(false);
    expect(factsOf(bare({ timesMet: 5, rating: 70 })).has('firstMeeting')).toBe(false);
  });

  it('counts a history between two people, at a cadence a booker would run', () => {
    expect(factsOf(bare({ timesMet: settings.commentaryMetOftenTimes })).has('metOften')).toBe(true);
    expect(factsOf(bare({ timesMet: 1 })).has('metOften')).toBe(false);
  });

  it('recaps a feud only once it has actually run', () => {
    expect(factsOf(bare({ feudWeeks: 20 })).has('longFeud')).toBe(true);
    expect(factsOf(bare({ feudWeeks: 1 })).has('longFeud')).toBe(false);
  });

  it('mentions the weather only when the weather actually cost the house', () => {
    const wet = bare({ weatherLine: 'a foot of snow' });
    expect(factsOf(wet).has('weatherHurtGate')).toBe(true);
    expect(said(wet, 'wet')).toMatch(/a foot of snow|Bramble Hollow/);
    // A dry night never mentions the sky.
    for (let i = 0; i < 20; i++) {
      expect(said(bare(), `dry-${i}`), `seed ${i}`).not.toMatch(/snow|rain|stayed home|empty seats/i);
    }
  });

  it('always knows what town it is in', () => {
    // The one placeholder that needs no fact, because a show is always
    // somewhere. It should turn up often enough to ground the broadcast.
    let mentioned = 0;
    for (let i = 0; i < 40; i++) {
      if (said(bare(), `town-${i}`).includes('Bramble Hollow')) mentioned++;
    }
    expect(mentioned).toBeGreaterThan(4);
  });

  it('only calls a reign long when it has actually been long', () => {
    const titles = createStartingTitles('me', 'Southside', 'territory').slice(0, 1);
    expect(factsOf(bare({ titles, championName: 'Aaron Quist', championWeeks: 60 })).has('longReign')).toBe(
      true,
    );
    expect(factsOf(bare({ titles, championName: 'Aaron Quist', championWeeks: 2 })).has('longReign')).toBe(
      false,
    );
    // And never off the back of a reign that does not exist.
    expect(factsOf(bare({ championWeeks: 200 })).has('longReign')).toBe(false);
  });

  it('talks about a manager exactly when there is one at ringside', () => {
    const withManager = said(
      bare({ managers: [{ name: 'Cyrus Fell', clientName: 'Bo Halvorsen', devious: true }] }),
      'mgr',
    );
    expect(withManager).toMatch(/Cyrus Fell/);
    expect(said(bare(), 'mgr')).not.toMatch(/Cyrus Fell/);
  });
});

describe('every fact has something to say about it', () => {
  // This exists because a patch once landed the colour lines for a new set of
  // facts and silently dropped the stakes lines for the same ones. Nothing
  // failed: the facts were computed, the tests passed, and the announcers
  // simply never mentioned any of it. A fact nothing can say is dead weight.
  const ALL_FACTS: string[] = [
    'manager',
    'deviousManager',
    'referee',
    'refereeMiss',
    'guestReferee',
    'title',
    'titleChange',
    'titleRetained',
    'longReign',
    'grudge',
    'injuredInMatch',
    'carryingInjury',
    'incident',
    'stipulation',
    'mainEvent',
    'interference',
    'hotCrowd',
    'flatCrowd',
    'greatMatch',
    'poorMatch',
    'veteran',
    'rookie',
    'sizeGap',
    'upset',
    'tagMatch',
    'rookieInTrouble',
    'vetInTrouble',
    'smallInTrouble',
    'formerChampion',
    'reigningElsewhere',
    'onATear',
    'slumping',
    'debut',
    'firstMeeting',
    'metOften',
    'longFeud',
    'blowoff',
    'weatherHurtGate',
    'bigShow',
    'longCareer',
    'secondGeneration',
  ];

  const everyTemplate = [...OPENERS, ...STAKES, ...COLOUR, ...CLOSERS, ...BANTER, ...COMEBACKS];

  it('has at least one line for every fact the engine can set', () => {
    for (const fact of ALL_FACTS) {
      const users = everyTemplate.filter((t) => t.needs.includes(fact as never));
      expect(users.length, `nothing in the script ever mentions "${fact}"`).toBeGreaterThan(0);
    }
  });

  it('declares no fact the engine cannot set', () => {
    for (const template of everyTemplate) {
      for (const fact of template.needs) {
        expect(ALL_FACTS, `"${template.text}" needs an unknown fact "${fact}"`).toContain(fact);
      }
    }
  });
});

describe('the broadcast teams', () => {
  it('are all a play-by-play voice and a colour voice with different names', () => {
    for (const team of COMMENTARY_TEAMS) {
      expect(team.playByPlayName).not.toBe(team.colourName);
      expect(team.playByPlayName.length).toBeGreaterThan(3);
      expect(team.colourName.length).toBeGreaterThan(3);
    }
  });

  it('cover every leaning, so the colour man is not always the same man', () => {
    expect(new Set(COMMENTARY_TEAMS.map((t) => t.leaning))).toEqual(
      new Set(['heel', 'face', 'analyst']),
    );
  });

  it('gives every leaning something to say', () => {
    for (const leaning of ['heel', 'face', 'analyst'] as const) {
      const forThem = COLOUR.filter((t) => !t.leaning || t.leaning === leaning);
      expect(forThem.length, leaning).toBeGreaterThan(10);
    }
  });
});
