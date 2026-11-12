// setWrestlerPhoto — a photo attached on its own, with none of
// repackageWrestler's other effects. See slices/tagTeamsAndIdentity.ts.

import { describe, expect, it, beforeEach } from 'vitest';
import { useGameStore } from './store';
import { defaultWorldSettings } from '../engine/world/settings';

function newGame() {
  useGameStore.getState().newGame({
    ...defaultWorldSettings(),
    seed: 'photo-import-test',
    startingRosterSize: 6,
    ownerMandatesEnabled: false,
  });
}

beforeEach(newGame);

describe('attaching a photo on its own', () => {
  it('sets the photo and touches nothing else about the wrestler', () => {
    const id = useGameStore.getState().world!.promotion.rosterIds[0]!;
    const before = useGameStore.getState().world!.wrestlers[id]!;
    const freshnessBefore = before.gimmickFreshness;
    const nameBefore = before.name;

    useGameStore.getState().setWrestlerPhoto(id, 'data:image/webp;base64,fake');

    const after = useGameStore.getState().world!.wrestlers[id]!;
    expect(after.photoDataUrl).toBe('data:image/webp;base64,fake');
    // The whole reason this is its own action and not a call through
    // repackageWrestler: that path always resets gimmickFreshness to 100,
    // which a plain photo attach must never do.
    expect(after.gimmickFreshness).toBe(freshnessBefore);
    expect(after.name).toBe(nameBefore);
  });

  it('clears the photo when passed null', () => {
    const id = useGameStore.getState().world!.promotion.rosterIds[0]!;
    useGameStore.getState().setWrestlerPhoto(id, 'data:image/webp;base64,fake');
    expect(useGameStore.getState().world!.wrestlers[id]!.photoDataUrl).toBe('data:image/webp;base64,fake');

    useGameStore.getState().setWrestlerPhoto(id, null);
    expect(useGameStore.getState().world!.wrestlers[id]!.photoDataUrl).toBeUndefined();
  });

  it('does nothing for a wrestler id that does not exist', () => {
    const before = useGameStore.getState().world!;
    useGameStore.getState().setWrestlerPhoto('no-such-id', 'data:image/webp;base64,fake');
    // Nothing to assert on the missing id beyond "it did not throw" — this
    // just locks that a bad id is a silent no-op, not a crash.
    expect(useGameStore.getState().world).toBeTruthy();
    expect(useGameStore.getState().world!.week).toBe(before.week);
  });
});
