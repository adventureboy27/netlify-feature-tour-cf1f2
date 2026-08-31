import { describe, it, expect } from 'vitest';
import {
  wire,
  sortWire,
  teamFormedLine,
  teamSplitLine,
  rivalSigningLine,
  deathLine,
  retirementLine,
  comebackLine,
  inductionLine,
  debutLine,
  WIRE_KIND_LABELS,
  type WireItem,
  type WireKind,
} from './wire';

/** One built line per kind, so the shape of every kind is covered. */
const SAMPLES: Record<WireKind, WireItem> = {
  story: wire('story', 'Bad Blood is over. Duke Rawlins finished it in a cage.', 12, 'lead'),
  team: teamSplitLine('The Brass Knuckles', ['Duke Rawlins', 'Cyclone'], 12),
  signing: rivalSigningLine('Duke Rawlins', 'Northern Combat League', 12),
  death: deathLine('Earl Mercer', 61, 'A heart attack, at home.', 12),
  retirement: retirementLine('Earl Mercer', 'His back finally went.', 12),
  comeback: comebackLine('Earl Mercer', 12),
  honour: inductionLine('Earl Mercer', 12),
  debut: debutLine(['Kip Mabry'], 12),
  departure: wire('departure', 'Duke Rawlins has left the promotion.', 12),
  official: wire('official', 'Earl Hollis has signed.', 12, 'minor'),
  title: wire('title', 'The belt changed hands.', 12),
  weather: wire('weather', 'Snow came down on Ironbelt City all afternoon.', 12, 'minor'),
  misfortune: wire('misfortune', 'Duke Rawlins blew a tire on the interstate.', 12, 'minor'),
  injury: wire('injury', 'Duke Rawlins worked through it and got away with it. He was back in 3.', 12, 'lead'),
  houseShow: wire('houseShow', 'Two house shows on the road this week.', 12, 'minor'),
  broadcast: wire('broadcast', 'The feed dropped during the main event and nobody at home saw it.', 12, 'normal'),
  business: wire('business', 'A billionaire just bought two rival promotions and merged them.', 12, 'lead'),
};

describe('every kind of news can be said', () => {
  it('covers every WireKind — a kind with no sentence is a silent change', () => {
    // This is the guard on the whole rule. If somebody adds a kind and no way
    // to phrase it, that is a system that can change a person without saying
    // so, which is exactly what this module exists to stop.
    const kinds = Object.keys(WIRE_KIND_LABELS) as WireKind[];
    for (const kind of kinds) {
      expect(SAMPLES[kind]).toBeDefined();
      expect(SAMPLES[kind].kind).toBe(kind);
    }
  });

  it('never produces an empty or unfinished sentence', () => {
    for (const item of Object.values(SAMPLES)) {
      expect(item.text.length).toBeGreaterThan(12);
      expect(item.text).not.toMatch(/\{[a-z]+\}/i);
      expect(item.text.trim()).toBe(item.text);
      expect(item.text).toMatch(/[.!]$/);
    }
  });

  it('names the person it is about', () => {
    expect(SAMPLES.death.text).toContain('Earl Mercer');
    expect(SAMPLES.retirement.text).toContain('Earl Mercer');
    expect(SAMPLES.comeback.text).toContain('Earl Mercer');
    expect(SAMPLES.signing.text).toContain('Duke Rawlins');
    expect(SAMPLES.team.text).toContain('Duke Rawlins');
  });

  it('says how, not just what — a death gives the cause and a retirement the reason', () => {
    // The rule is not "report it", it is "report it and say how it happened".
    expect(SAMPLES.death.text).toContain('heart attack');
    expect(SAMPLES.retirement.text).toContain('back finally went');
  });

  it('gives every kind a label for the page', () => {
    for (const label of Object.values(WIRE_KIND_LABELS)) expect(label.length).toBeGreaterThan(0);
  });
});

describe('what leads', () => {
  it('puts a death above a signing above an official', () => {
    const sorted = sortWire([SAMPLES.official, SAMPLES.signing, SAMPLES.death]);
    expect(sorted.map((i) => i.kind)).toEqual(['death', 'signing', 'official']);
  });

  it('leads with the things that end careers', () => {
    for (const kind of ['death', 'retirement', 'comeback'] as const) {
      expect(SAMPLES[kind].weight).toBe('lead');
    }
  });

  it('keeps the routine paperwork quiet', () => {
    expect(SAMPLES.official.weight).toBe('minor');
    expect(SAMPLES.debut.weight).toBe('minor');
  });

  it('does not lose anything while sorting', () => {
    const all = Object.values(SAMPLES);
    expect(sortWire(all)).toHaveLength(all.length);
  });
});

describe('the phrasing', () => {
  it('names both halves of a team that split, and the team', () => {
    const line = teamSplitLine('The Brass Knuckles', ['Duke', 'Cyclone'], 3);
    expect(line.text).toContain('The Brass Knuckles');
    expect(line.text).toContain('Duke');
    expect(line.text).toContain('Cyclone');
  });

  it('announces a team forming as well as a team ending', () => {
    expect(teamFormedLine('The Brass Knuckles', ['Duke', 'Cyclone'], 3).text).toContain('teaming');
  });

  it('says which company signed somebody, since that is the sting', () => {
    expect(rivalSigningLine('Duke', 'NCL', 3).text).toContain('NCL');
  });

  it('sums up a big graduating class rather than listing everybody', () => {
    const many = debutLine(['A', 'B', 'C', 'D'], 3);
    expect(many.text).toContain('4 graduates');
    expect(debutLine(['Solo Guy'], 3).text).toContain('Solo Guy');
  });

  it('stamps the week on everything', () => {
    for (const item of Object.values(SAMPLES)) expect(item.week).toBe(12);
  });
});
