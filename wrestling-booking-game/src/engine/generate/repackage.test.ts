import { describe, it, expect } from 'vitest';
import { checkRename, repackage, namesInUse } from './repackage';
import { defaultWorldSettings } from '../world/settings';
import type { Wrestler } from '../types';

const settings = defaultWorldSettings();

let nextId = 0;
function person(name: string): Wrestler {
  nextId += 1;
  return {
    id: `w${nextId}`,
    name,
    nickname: undefined,
    gimmickFreshness: 20,
    deceased: null,
  } as unknown as Wrestler;
}

const roster = ['Doomsday', 'Wren Stillwater', 'Colonel Quinn', 'Boomtown'];

describe('what a ring name is allowed to be', () => {
  it('accepts a distinct name', () => {
    expect(checkRename('Grimstone', 'Old Name', roster, settings)).toEqual({ ok: true, reason: null });
  });

  it('rejects an empty one', () => {
    expect(checkRename('   ', 'Old Name', roster, settings).reason).toBe('empty');
  });

  it('rejects one nobody could read on a poster', () => {
    expect(checkRename('X', 'Old Name', roster, settings).reason).toBe('tooShort');
    expect(checkRename('A'.repeat(settings.ringNameMaxLength + 1), 'Old Name', roster, settings).reason).toBe(
      'tooLong',
    );
  });

  it('rejects a name somebody is already working under', () => {
    expect(checkRename('Doomsday', 'Old Name', roster, settings).reason).toBe('taken');
    // Case and spacing are not a way around it.
    expect(checkRename('  doomsday ', 'Old Name', roster, settings).reason).toBe('taken');
  });

  it('applies the same distinctness rule generation obeys', () => {
    // A shared surname reads as the same family, which is the rule.
    expect(checkRename('Ike Stillwater', 'Old Name', roster, settings).reason).toBe('tooSimilar');
    // And a near-miss spelling reads as a typo of somebody real.
    expect(checkRename('Doomsdey', 'Old Name', roster, settings).reason).toBe('tooSimilar');
  });

  it('lets somebody keep the name they already have', () => {
    // Submitting the form without touching the name must not fail as a clash
    // with themselves.
    expect(checkRename('Doomsday', 'Doomsday', roster, settings)).toEqual({ ok: true, reason: null });
    expect(checkRename('  Doomsday  ', 'Doomsday', roster, settings).ok).toBe(true);
  });
});

describe('doing the repackage', () => {
  it('changes the name and keeps the old one', () => {
    const w = person('Kid Dynamite');
    repackage(w, { name: 'The Reverend' }, 140);
    expect(w.name).toBe('The Reverend');
    expect(w.formerNames).toEqual([{ name: 'Kid Dynamite', untilWeek: 140 }]);
  });

  it('stacks former names in order over a career', () => {
    const w = person('First');
    repackage(w, { name: 'Second' }, 50);
    repackage(w, { name: 'Third' }, 300);
    expect(w.formerNames?.map((f) => f.name)).toEqual(['First', 'Second']);
    expect(w.name).toBe('Third');
  });

  it('does not record a former name when nothing changed', () => {
    const w = person('Same');
    repackage(w, { name: '  Same  ' }, 20);
    expect(w.formerNames).toBeUndefined();
    expect(w.name).toBe('Same');
  });

  it('makes the character fresh again', () => {
    const w = person('Stale');
    expect(w.gimmickFreshness).toBeLessThan(100);
    repackage(w, { name: 'Stale' }, 10);
    expect(w.gimmickFreshness).toBe(100);
  });

  it('takes a photo and a nickname too', () => {
    const w = person('Somebody');
    repackage(w, { nickname: 'The Hammer', photoDataUrl: 'data:image/webp;base64,AAAA' }, 10);
    expect(w.nickname).toBe('The Hammer');
    expect(w.photoDataUrl).toBe('data:image/webp;base64,AAAA');
  });

  it('can remove a photo', () => {
    const w = person('Somebody');
    w.photoDataUrl = 'data:image/webp;base64,AAAA';
    repackage(w, { photoDataUrl: null }, 10);
    expect(w.photoDataUrl).toBeUndefined();
  });

  it('can drop a nickname', () => {
    const w = person('Somebody');
    w.nickname = 'The Hammer';
    repackage(w, { nickname: null }, 10);
    expect(w.nickname).toBeUndefined();
  });

  it('leaves everything they earned alone', () => {
    // A repackage is not a punishment. See the note on repackage().
    const w = person('Nobody');
    Object.assign(w, { popularity: 71, momentum: 30, morale: 55 });
    repackage(w, { name: 'Somebody' }, 10);
    expect(w.popularity).toBe(71);
    expect(w.momentum).toBe(30);
    expect(w.morale).toBe(55);
  });
});

describe('the pool of names to check against', () => {
  it('is everybody in the business', () => {
    expect(namesInUse([person('A Name'), person('Another Name')])).toEqual(['A Name', 'Another Name']);
  });
});
