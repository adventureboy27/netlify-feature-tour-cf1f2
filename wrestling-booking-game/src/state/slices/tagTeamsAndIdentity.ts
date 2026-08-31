// Tag teams, and the two things you cannot change once the doors are open:
// a wrestler's own name and look, and the promotion's house identity.
//
// Split out of store.ts purely for navigability; every action here is
// unchanged from what it always did.

import type { StateCreator } from 'zustand';
import { rng, type GameStore } from '../store';
import { leaveTheBusiness } from '../storeHelpers';
import { saveGame } from '../persist';
import { canFormTeam, createTeam } from '../../engine/world/tagTeams';
import {
  checkRename,
  namesInUse,
  repackage,
  RENAME_REJECTION_TEXT,
} from '../../engine/generate/repackage';
import { retire } from '../../engine/career/retirement';
import { styleProfileFor } from '../../data/promotionIdentity';
import { createStartingTitles } from '../../data/titles';

type TagTeamsAndIdentitySlice = Pick<
  GameStore,
  | 'formTagTeam'
  | 'disbandTagTeam'
  | 'repackageWrestler'
  | 'setWrestlerPhoto'
  | 'retireWrestler'
  | 'setPromotionIdentity'
>;

export const createTagTeamsAndIdentitySlice: StateCreator<
  GameStore,
  [['zustand/immer', never]],
  [],
  TagTeamsAndIdentitySlice
> = (set, get) => ({
  // DESIGN: what kind of company you are is the first real decision, and it
  // renames your belts — so it is open until the first show goes out and
  // shut for good afterwards. A promotion that changes what it stands for
  // every week does not stand for anything.
  formTagTeam: (aId, bId, name) => {
    set((state) => {
      const world = state.world;
      // Two ways a save ends: the bank, and the owner.
      if (!world || world.folded || world.fired) return;

      const a = world.wrestlers[aId];
      const b = world.wrestlers[bId];
      const rosterIds = new Set(world.promotion.rosterIds);
      if (!canFormTeam(a, b, world.stables, rosterIds, name).ok || !a || !b) return;

      const taken = new Set(world.stables.filter((t) => t.disbandedWeek === null).map((t) => t.name));
      world.stables.push(
        createTeam(rng, a, b, world.week, `${world.promotion.id}-team-${world.nextId++}`, taken, name),
      );
    });
  },

  disbandTagTeam: (teamId) => {
    set((state) => {
      const world = state.world;
      const team = world?.stables.find((t) => t.id === teamId && t.disbandedWeek === null);
      if (!world || !team) return;

      // A team that has split cannot defend the tag titles. The belts go
      // vacant with the split on the record, which is how it goes.
      for (const title of world.titles) {
        if (title.vacant || title.tier !== 'tag') continue;
        if (!team.memberIds.every((id) => title.currentHolderIds.includes(id))) continue;

        const last = title.history[title.history.length - 1];
        if (last && last.endWeek === null) {
          last.endWeek = world.week;
          last.endMethod = 'vacatedByBooker';
        }
        for (const id of title.currentHolderIds) {
          const open = world.wrestlers[id]?.titleReigns.find((r) => r.titleId === title.id && r.endWeek === null);
          if (open) {
            open.endWeek = world.week;
            open.endMethod = 'vacatedByBooker';
          }
        }
        title.vacant = true;
        title.currentHolderIds = [];
      }

      team.disbandedWeek = world.week;
    });
  },

  repackageWrestler: (wrestlerId, change) => {
    const world = get().world;
    const w = world?.wrestlers[wrestlerId];
    if (!world || !w) return { ok: false, reason: 'Nobody by that name.' };

    // Checked before the write, so a rejected repackage changes nothing.
    const everybody = Object.values(world.wrestlers);
    if (change.name !== undefined) {
      const check = checkRename(change.name, w.name, namesInUse(everybody), world.settings);
      if (!check.ok) return { ok: false, reason: RENAME_REJECTION_TEXT[check.reason!] };
    }
    set((state) => {
      const draft = state.world;
      const target = draft?.wrestlers[wrestlerId];
      if (!draft || !target) return;
      repackage(target, change, draft.week);
    });
    const after = get().world;
    if (after) saveGame(after, rng.state?.() ?? 0);
    return { ok: true, reason: null };
  },

  // A photo on its own, never routed through repackage() — that function
  // always resets gimmickFreshness to 100 on the theory that a new look is
  // a new character. Attaching a real photo to an existing act is not a
  // repackage and must not give a stale gimmick a free reset. See
  // ui/components/BatchPhotoImport.tsx, the one caller that needs this.
  setWrestlerPhoto: (wrestlerId, photoDataUrl) => {
    set((state) => {
      const w = state.world?.wrestlers[wrestlerId];
      if (!w) return;
      w.photoDataUrl = photoDataUrl ?? undefined;
    });
  },

  retireWrestler: (wrestlerId) => {
    set((state) => {
      const world = state.world;
      const w = world?.wrestlers[wrestlerId];
      if (!world || !w || w.careerStatus === 'retired') return;

      // Belts do not retire with their holder. This used to be its own copy
      // of the vacating logic, which is how it drifted: leaveTheBusiness
      // learned to resolve a split belt's interim claim and this path did
      // not, so retiring an interim champion by hand left a claim on a title
      // for somebody who was gone — and a belt owing a unification nobody
      // can turn up for can never be defended again.
      retire(w);
      leaveTheBusiness(world, wrestlerId, 'retired');
    });
  },

  setPromotionIdentity: (name, archetype) => {
    set((state) => {
      const world = state.world;
      if (!world || world.showHistory.length > 0) return;

      world.promotion.name = name.trim() || world.promotion.name;
      world.promotion.identity = archetype;
      world.promotion.styleProfile = styleProfileFor(archetype);

      // Rename in place rather than rebuilding: the opening champions were
      // crowned at week one and a rename must not vacate their belts.
      const renamed = createStartingTitles(world.promotion.id, world.promotion.name, archetype);
      const own = world.titles.filter((t) => t.promotionId === world.promotion.id);
      own.forEach((title, i) => {
        const fresh = renamed[i];
        if (!fresh) return;
        title.name = fresh.name;
        title.blurb = fresh.blurb;
        title.tier = fresh.tier;
        title.prestige = fresh.prestige;
        title.colorway = fresh.colorway;
        title.signatureStipulationId = fresh.signatureStipulationId;
      });
    });
  },
});
