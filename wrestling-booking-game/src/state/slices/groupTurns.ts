// Forming a team or faction from the existing roster, and breaking one up —
// either quietly (kickFromGroup 'immediate') or staged as an on-screen
// betrayal (kickFromGroup 'staged', resolved by answerGroupTurnCall once the
// beatdown actually fires — see the resolution-loop hook in store.ts and
// engine/world/teamBreakup.ts for the shape of the decision itself).

import type { StateCreator } from 'zustand';
import { rng, type GameStore } from '../store';
import { vacateTeamHeldTitles } from '../storeHelpers';
import {
  canFormGroup,
  createPlayerGroup,
  kindForSize,
  TEAM_PROBLEM_TEXT,
} from '../../engine/world/tagTeams';
import {
  canKickFromGroup,
  nextLeaderAfterKick,
  type GroupTurnCallChoiceId,
} from '../../engine/world/teamBreakup';
import { createRivalry } from '../../engine/sim/rivalry';
import { gradeFromLength, severityOf } from '../../engine/sim/casualties';
import { recordInjury } from '../../engine/career/theBody';
import { endRepresentation } from '../../engine/career/representation';
import { teamFormedLine, teamSplitLine, wire } from '../../engine/world/wire';
import { groupTurnLetItHappenLine, groupTurnBreakItUpLine } from '../../data/groupTurns';
import { clamp } from '../../engine/rng';

type GroupTurnsSlice = Pick<GameStore, 'formGroup' | 'kickFromGroup' | 'answerGroupTurnCall'>;

export const createGroupTurnsSlice: StateCreator<
  GameStore,
  [['zustand/immer', never]],
  [],
  GroupTurnsSlice
> = (set, get) => ({
  formGroup: (memberIds, name) => {
    const world = get().world;
    if (!world || world.folded || world.fired) return { ok: false, reason: 'No promotion to build one for.' };

    const rosterIds = new Set(world.promotion.rosterIds);
    const members = memberIds.map((id) => world.wrestlers[id]);
    const check = canFormGroup(members, world.stables, rosterIds, name ?? '');
    if (!check.ok) return { ok: false, reason: TEAM_PROBLEM_TEXT[check.problem!] };

    // A faction has no sensible auto-generated name the way a pair does —
    // teamName()'s pool is written for two people, not four.
    if (memberIds.length > 2 && !name?.trim()) {
      return { ok: false, reason: 'A faction needs a name — there is nobody to leave it to the announcers.' };
    }

    set((state) => {
      const w = state.world;
      if (!w) return;
      const real = memberIds.map((id) => w.wrestlers[id]!);
      const taken = new Set(w.stables.filter((t) => t.disbandedWeek === null).map((t) => t.name));
      // A distinct id segment from `-team-` on purpose: AI-seeded teams are
      // numbered by their own independent per-promotion counter
      // (tagTeams.ts's teamIdFactory, starting at 0), not world.nextId — the
      // two can produce the exact same id early in a fresh save (nextId
      // starts at 1) and silently collide, so anything id-keyed off the
      // stable would then operate on whichever one `.find()` happens to
      // reach first.
      const group = createPlayerGroup(rng, real, w.week, `${w.promotion.id}-playergroup-${w.nextId++}`, taken, name);
      w.stables.push(group);
      w.weeklyNews.push(teamFormedLine(group.name, real.map((m) => m.name), w.week));
    });
    return { ok: true, reason: null };
  },

  kickFromGroup: (stableId, memberId, mode) => {
    set((state) => {
      const world = state.world;
      if (!world) return;
      const stable = world.stables.find((s) => s.id === stableId);
      if (!stable) return;
      const check = canKickFromGroup(stable, memberId);
      if (!check.ok) return;

      if (mode === 'staged') {
        // Nothing about the split takes effect yet — the group stays intact
        // until the show that dramatizes it actually plays out.
        if (world.scheduledGroupTurns.some((t) => t.departingId === memberId && t.stableId === stableId)) return;
        const departing = world.wrestlers[memberId];
        if (!departing) return;
        world.scheduledGroupTurns.push({
          id: `groupturn-${world.nextId++}`,
          stableId,
          stableName: stable.name,
          departingId: memberId,
          departingName: departing.name,
          scheduledWeek: world.week,
        });
        return;
      }

      const remainingIds = stable.memberIds.filter((id) => id !== memberId);
      const remainingMembers = remainingIds.map((id) => world.wrestlers[id]).filter((w): w is NonNullable<typeof w> => Boolean(w));
      const departing = world.wrestlers[memberId];

      if (remainingIds.length < 2) {
        vacateTeamHeldTitles(world, stable.memberIds);
        stable.disbandedWeek = world.week;
      } else {
        stable.memberIds = remainingIds;
        stable.kind = kindForSize(remainingIds.length);
        stable.leaderId = nextLeaderAfterKick(stable, remainingMembers, memberId);
      }
      if (departing) {
        world.weeklyNews.push(teamSplitLine(stable.name, [departing.name], world.week));
      }
    });
  },

  answerGroupTurnCall: (choice: GroupTurnCallChoiceId) => {
    set((state) => {
      const world = state.world;
      const call = world?.pendingGroupTurnCall;
      if (!world || !call) return;

      world.scheduledGroupTurns = world.scheduledGroupTurns.filter(
        (t) => !(t.stableId === call.stableId && t.departingId === call.departingId),
      );

      const stable = world.stables.find((s) => s.id === call.stableId);
      if (stable && stable.disbandedWeek === null) {
        const remainingIds = stable.memberIds.filter((id) => id !== call.departingId);
        const remainingMembers = remainingIds
          .map((id) => world.wrestlers[id])
          .filter((w): w is NonNullable<typeof w> => Boolean(w));
        if (remainingIds.length < 2) {
          vacateTeamHeldTitles(world, stable.memberIds);
          stable.disbandedWeek = world.week;
        } else {
          stable.memberIds = remainingIds;
          stable.kind = kindForSize(remainingIds.length);
          stable.leaderId = nextLeaderAfterKick(stable, remainingMembers, call.departingId);
        }
      }

      if (call.managerId) {
        world.representations = endRepresentation(world.representations, call.departingId);
      }

      const departing = world.wrestlers[call.departingId];
      const settings = world.settings;
      const rivalryParticipants = [call.departingId, ...call.attackerIds, ...(call.managerId ? [call.managerId] : [])];

      if (choice === 'letItHappen') {
        if (departing && !departing.injury) {
          const grade = gradeFromLength(call.injuryWeeks, settings);
          departing.injury = {
            severity: severityOf(grade, settings),
            grade,
            description: `Jumped by ${call.stableName}`,
            sufferedWeek: world.week,
            totalWeeks: call.injuryWeeks,
            weeksRemaining: call.injuryWeeks,
            permanentStatLoss: {},
            earlyReturnWeeksUsed: 0,
          };
          departing.injuryHistory = recordInjury(
            departing.injuryHistory ?? [],
            departing.injury,
            settings.startingYear + Math.floor(world.week / 52),
          );
          departing.health = clamp(departing.health - settings.casualtyHealthCost, 0, 100);
        }
        // createRivalry only seeds the axis its own origin implies (shootHeat
        // for a shoot, heat for a worked angle) — the other stays 0, so the
        // second axis is set directly on the fresh object before it's pushed.
        const rivalry = createRivalry(
          `rivalry-${world.nextId++}`,
          rivalryParticipants,
          'shoot',
          world.week,
          settings.groupTurnLetItHappenShootHeat,
        );
        rivalry.heat = clamp(settings.groupTurnLetItHappenHeat, 0, 100);
        world.rivalries.push(rivalry);
        world.weeklyNews.push(
          wire(
            'team',
            groupTurnLetItHappenLine(call.stableName, call.departingName, call.attackerNames, call.managerName),
            world.week,
            'lead',
          ),
        );
      } else {
        world.promotion.bookingCredibility = clamp(
          world.promotion.bookingCredibility - settings.groupTurnBreakItUpCredibilityCost,
          0,
          100,
        );
        world.promotion.reputation = clamp(world.promotion.reputation + settings.groupTurnBreakItUpReputationGain, 0, 100);
        const rivalry = createRivalry(
          `rivalry-${world.nextId++}`,
          rivalryParticipants,
          'worked',
          world.week,
          settings.groupTurnBreakItUpHeat,
        );
        rivalry.shootHeat = clamp(settings.groupTurnBreakItUpShootHeat, 0, 100);
        world.rivalries.push(rivalry);
        world.weeklyNews.push(wire('team', groupTurnBreakItUpLine(call.stableName, call.departingName), world.week, 'normal'));
      }

      world.pendingGroupTurnCall = null;
    });
  },
});
