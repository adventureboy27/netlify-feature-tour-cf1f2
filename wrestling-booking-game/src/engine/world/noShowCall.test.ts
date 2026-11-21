import { describe, expect, it } from 'vitest';
import { noShowCallFrom, resolveNoShowCall, NO_SHOW_CALL_OPTIONS, type NoShowChoiceId } from './noShowCall';
import { defaultWorldSettings } from './settings';
import { generateWrestlers } from '../generate/wrestler';
import { rngFromSeed } from '../rng';
import type { Wrestler } from '../types';

const settings = defaultWorldSettings();

function roster(n: number, seed = 'noshow'): Wrestler[] {
  return generateWrestlers(rngFromSeed(seed), n).map((w) => ({ ...w, injury: null }));
}

describe('the decision', () => {
  it('offers exactly the three choices, each stating both halves', () => {
    expect(NO_SHOW_CALL_OPTIONS).toHaveLength(3);
    for (const option of NO_SHOW_CALL_OPTIONS) {
      expect(option.gains.length).toBeGreaterThan(5);
      expect(option.costs.length).toBeGreaterThan(5);
    }
  });

  it('names who is missing, whoever candidates suggests', () => {
    const people = roster(20);
    const call = noShowCallFrom(rngFromSeed('call'), 5, 'promo-1', people[0]!, people.slice(1), settings);
    expect(call.absentId).toBe(people[0]!.id);
    expect(call.warning).toContain(people[0]!.name);
    expect(call.warning).not.toMatch(/\{[a-z]+\}/i);
  });
});

describe('writing up the choice', () => {
  const people = roster(20, 'write-up');
  const callFor = (choice: NoShowChoiceId) =>
    noShowCallFrom(rngFromSeed(`call-${choice}`), 5, 'promo-1', people[0]!, people.slice(1), settings);

  it('never leaves a placeholder behind, whichever choice is made', () => {
    for (const choice of ['pullSegment', 'handicapMatch', 'mysteryOpponent'] as NoShowChoiceId[]) {
      const outcome = resolveNoShowCall(callFor(choice), choice, settings);
      expect(outcome.line).not.toMatch(/\{[a-z]+\}/i);
      expect(outcome.line).toContain(people[0]!.name);
    }
  });

  it('has more than one way to say each choice, so a long save does not read the same sentence every time', () => {
    // Distinct absent wrestlers each week, same choice — the exact shape a
    // long save produces many times over.
    for (const choice of ['pullSegment', 'handicapMatch', 'mysteryOpponent'] as NoShowChoiceId[]) {
      const texts = new Set<string>();
      for (let week = 0; week < 30; week++) {
        const absent = people[week % people.length]!;
        const call = noShowCallFrom(rngFromSeed(`variety-${choice}-${week}`), week, 'promo-1', absent, people, settings);
        const outcome = resolveNoShowCall(call, choice, settings);
        // Normalise the name back out so we're comparing the underlying
        // template, not incidental variety from whose name is in it.
        texts.add(outcome.line.replace(absent.name, '{name}').replace(call.suggestedReplacementName ?? '', '{replacement}'));
      }
      expect(texts.size).toBeGreaterThan(1);
    }
  });

  it('names the replacement on a mystery-opponent call', () => {
    const call = callFor('mysteryOpponent');
    const outcome = resolveNoShowCall(call, 'mysteryOpponent', settings);
    if (call.suggestedReplacementName) expect(outcome.line).toContain(call.suggestedReplacementName);
  });

  it('replays identically for the same call and choice', () => {
    const call = callFor('pullSegment');
    const first = resolveNoShowCall(call, 'pullSegment', settings);
    const second = resolveNoShowCall(call, 'pullSegment', settings);
    expect(first.line).toBe(second.line);
  });

  it('drops the match entirely only when the segment is pulled', () => {
    const call = callFor('pullSegment');
    expect(resolveNoShowCall(call, 'pullSegment', settings).pullSegment).toBe(true);
    expect(resolveNoShowCall(call, 'handicapMatch', settings).pullSegment).toBe(false);
    expect(resolveNoShowCall(call, 'mysteryOpponent', settings).pullSegment).toBe(false);
  });
});
