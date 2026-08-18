// The booker's own story-building tools: turning a shoot into an angle, and
// starting, naming or dropping a storyline.
//
// Split out of store.ts purely for navigability; every action here is
// unchanged from what it always did.

import type { StateCreator } from 'zustand';
import type { GameStore } from '../store';
import { pick, rngFromSeed } from '../../engine/rng';
import { wire } from '../../engine/world/wire';
import { findRivalry, createRivalry, leanIntoShoot as leanIntoShootRivalry } from '../../engine/sim/rivalry';
import { isLive, storylineBetween } from '../../engine/world/storyline';
import { STORYLINE_NAME_PATTERNS } from '../../data/storylineBeats';
import type { Wrestler } from '../../engine/types';

type StorylinesSlice = Pick<GameStore, 'leanIntoShoot' | 'startStoryline' | 'renameStoryline' | 'abandonStoryline'>;

export const createStorylinesSlice: StateCreator<GameStore, [['zustand/immer', never]], [], StorylinesSlice> = (
  set,
) => ({
  leanIntoShoot: (rivalryId) => {
    let outcome: { ok: boolean; reason: string | null } = { ok: false, reason: 'No world.' };
    set((state) => {
      const world = state.world;
      if (!world) return;
      const index = world.rivalries.findIndex((r) => r.id === rivalryId);
      const rivalry = world.rivalries[index];
      if (!rivalry || rivalry.resolvedWeek !== null) {
        outcome = { ok: false, reason: 'That feud is over.' };
        return;
      }
      if (rivalry.shootHeat <= 0) {
        outcome = { ok: false, reason: 'There is nothing real there to point a camera at.' };
        return;
      }
      // Both of them have to be yours. You cannot decide to run somebody
      // else's locker-room problem on your television.
      if (!rivalry.participantIds.every((id) => world.promotion.rosterIds.includes(id))) {
        outcome = { ok: false, reason: 'They are not both yours.' };
        return;
      }

      const before = rivalry.shootHeat;
      world.rivalries[index] = leanIntoShootRivalry(rivalry, world.settings);
      const names = rivalry.participantIds
        .map((id) => world.wrestlers[id]?.name)
        .filter(Boolean)
        .join(' and ');

      // §0: the booker did this on purpose, and the write-up says what it
      // was — including that it did not calm anybody down.
      world.weeklyNews.push(
        wire(
          'story',
          `${world.promotion.name} are running the ${names} problem as an angle. The crowd is going to get the real thing, and neither man is any happier for it being on television.`,
          world.week,
          'lead',
        ),
      );
      outcome = {
        ok: true,
        reason:
          world.rivalries[index]!.shootHeat > before
            ? 'The crowd is in. So is the problem.'
            : null,
      };
    });
    return outcome;
  },

  startStoryline: (participantIds, name) => {
    let outcome: { ok: boolean; reason: string | null } = { ok: false, reason: 'No world.' };
    set((state) => {
      const world = state.world;
      if (!world) return;
      const people = participantIds
        .map((id) => world.wrestlers[id])
        .filter((w): w is Wrestler => Boolean(w));
      if (people.length < 2) {
        outcome = { ok: false, reason: 'A story needs two people in it.' };
        return;
      }
      if (storylineBetween(world.storylines, participantIds)) {
        outcome = { ok: false, reason: 'These two are already in a story.' };
        return;
      }

      // Booking a story is allowed to be what starts the feud — that is
      // how most of them start in the real thing.
      let rivalry = findRivalry(world.rivalries, participantIds);
      if (!rivalry) {
        rivalry = createRivalry(
          `rivalry-story-${world.week}-${world.rivalries.length}`,
          [...participantIds],
          'worked',
          world.week,
          0,
        );
        world.rivalries.push(rivalry);
      }

      const surnames = people.map((w) => w.name.split(' ').slice(-1)[0] ?? w.name);
      const town = world.territories.find((t) => t.id === world.promotion.homeTerritoryId);
      const pattern = pick(
        rngFromSeed(`${world.settings.seed}-story-${world.week}-${participantIds.join('-')}`),
        STORYLINE_NAME_PATTERNS,
      );
      const generated = pattern
        .replace('{a}', surnames[0] ?? 'Them')
        .replace('{b}', surnames[1] ?? 'Them')
        .replace('{town}', town?.name ?? 'Town');

      world.storylines.push({
        id: `story-${world.week}-${world.storylines.length}`,
        name: (name ?? '').trim() || generated,
        participantIds: [...participantIds],
        rivalryId: rivalry.id,
        stage: 'opening',
        startWeek: world.week,
        lastAdvancedWeek: world.week,
        beats: [],
        neglectedWeeks: 0,
        resolvedWeek: null,
        payoff: null,
      });
      outcome = { ok: true, reason: null };
    });
    return outcome;
  },

  renameStoryline: (storylineId, name) => {
    set((state) => {
      const story = state.world?.storylines.find((s2) => s2.id === storylineId);
      if (!story) return;
      const trimmed = name.trim();
      if (trimmed) story.name = trimmed;
    });
  },

  abandonStoryline: (storylineId) => {
    set((state) => {
      const world = state.world;
      const story = world?.storylines.find((s2) => s2.id === storylineId);
      if (!world || !story || !isLive(story)) return;
      story.stage = 'fizzled';
      story.resolvedWeek = world.week;
      story.payoff = 'Dropped. Whatever it was going to be, it is not going to be it.';
      world.weeklyNews.push(
        wire('story', `${story.name} has been quietly dropped.`, world.week, 'minor'),
      );
    });
  },
});
