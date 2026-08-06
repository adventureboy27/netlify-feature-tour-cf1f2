// The incident library — the things nobody booked.
//
// Every entry is conditional on what the match already produced. Read the
// header of engine/sim/incidents.ts first: an incident never changes who won,
// and nothing here fires out of nowhere.
//
// Each definition is a `when` that decides whether tonight could have
// produced it at all, a `weight` for how often it should come up against
// everything else that was also possible, and a `build` that writes the
// headline and says what it did to the world.
//
// The effects are the whole point. A turn that does not change an alignment
// is a caption.

import type { Rng } from '../engine/rng';
import { chance, pick } from '../engine/rng';
import type { EventEffect } from '../engine/events/types';
import type { Id, Wrestler } from '../engine/types';
import {
  groupsInPlay,
  losers,
  turnToward,
  winners,
  type Incident,
  type IncidentContext,
} from '../engine/sim/incidents';

export interface IncidentDefinition {
  id: string;
  /** A short label for the newsfeed, above the headline. */
  kind: string;
  /** Could tonight have produced this at all? */
  when(ctx: IncidentContext): boolean;
  /** Relative likelihood against everything else that was also possible. */
  weight: number;
  build(ctx: IncidentContext, rng: Rng): Incident | null;
}

/** Finishes where somebody plainly interfered. */
const MESSY_FINISHES = new Set(['interference', 'disqualification', 'countOut']);

const nameOf = (w: Wrestler) => w.name;

/** Everybody in the match, so an incident can put the room on notice. */
function everyone(ctx: IncidentContext): Id[] {
  return ctx.competitors.map((c) => c.wrestler.id);
}

export const INCIDENTS: IncidentDefinition[] = [
  // ---------------------------------------------------------------- turns
  {
    id: 'partnerTurn',
    kind: 'Turn',
    weight: 20,
    when: (ctx) =>
      // A partnership with both halves in the match, and a result for one of
      // them to blame the other for.
      ctx.loserIds.length > 0 &&
      groupsInPlay(ctx).some((g) => {
        const onTheLosingSide = g.memberIds.filter((id) => ctx.loserIds.includes(id));
        return onTheLosingSide.length >= 2;
      }),
    build: (ctx, rng) => {
      const group = pick(
        rng,
        groupsInPlay(ctx).filter((g) => g.memberIds.filter((id) => ctx.loserIds.includes(id)).length >= 2),
      );
      const pair = group.memberIds.filter((id) => ctx.loserIds.includes(id));
      // Drawn once, outside the search. Rolling inside a predicate compares
      // every candidate against a different draw and finds nobody.
      const turncoatId = pick(rng, pair);
      const turncoat = ctx.competitors.find((c) => c.wrestler.id === turncoatId)?.wrestler;
      const betrayed = ctx.competitors.find(
        (c) => pair.includes(c.wrestler.id) && c.wrestler.id !== turncoatId,
      )?.wrestler;
      if (!turncoat || !betrayed) return null;

      return {
        id: 'partnerTurn',
        headline: pick(rng, [
          `${nameOf(turncoat)} turned on ${nameOf(betrayed)} in front of everybody. ${group.name} is finished.`,
          `It fell apart in the ring. ${nameOf(turncoat)} left ${nameOf(betrayed)} lying and walked out alone — there is no ${group.name} any more.`,
          `${nameOf(betrayed)} never saw it coming from ${nameOf(turncoat)}, and half the building was on their feet before they understood what they were watching.`,
        ]),
        involvedIds: [turncoat.id, betrayed.id],
        effects: [
          { kind: 'alignmentTurn', wrestlerId: turncoat.id, toward: turnToward(turncoat) },
          { kind: 'disbandStable', stableId: group.id },
          { kind: 'crowdHeat', wrestlerIds: [turncoat.id, betrayed.id], delta: ctx.settings.incidentTurnHeat },
          { kind: 'momentum', wrestlerId: turncoat.id, delta: ctx.settings.incidentTurnMomentum },
          { kind: 'morale', wrestlerId: betrayed.id, delta: -ctx.settings.incidentBetrayalMorale },
        ],
      };
    },
  },

  {
    id: 'championSnaps',
    kind: 'Turn',
    weight: 12,
    when: (ctx) => ctx.titleChanged && ctx.loserIds.length > 0,
    build: (ctx, rng) => {
      const formerChampion = pick(rng, losers(ctx));
      const newChampion = winners(ctx)[0];
      if (!newChampion) return null;
      return {
        id: 'championSnaps',
        headline: pick(rng, [
          `${nameOf(formerChampion)} attacked ${nameOf(newChampion)} with the belt they had just lost, and had to be pulled off.`,
          `${nameOf(formerChampion)} would not hand the belt over. When they finally did, it was across ${nameOf(newChampion)}'s head.`,
          `Losing it broke something in ${nameOf(formerChampion)}. ${nameOf(newChampion)} was still celebrating when it started.`,
        ]),
        involvedIds: [formerChampion.id, newChampion.id],
        effects: [
          { kind: 'alignmentTurn', wrestlerId: formerChampion.id, toward: turnToward(formerChampion) },
          {
            kind: 'crowdHeat',
            wrestlerIds: [formerChampion.id, newChampion.id],
            delta: ctx.settings.incidentTurnHeat,
          },
          { kind: 'momentum', wrestlerId: formerChampion.id, delta: ctx.settings.incidentTurnMomentum },
        ],
      };
    },
  },

  // ------------------------------------------------------------ ringside
  {
    id: 'managerCostThem',
    kind: 'Ringside',
    weight: 18,
    when: (ctx) =>
      MESSY_FINISHES.has(ctx.finish) &&
      ctx.managers.some((m) => ctx.competitors.some((c) => c.side === m.forSide && ctx.loserIds.includes(c.wrestler.id))),
    build: (ctx, rng) => {
      const manager = pick(
        rng,
        ctx.managers.filter((m) =>
          ctx.competitors.some((c) => c.side === m.forSide && ctx.loserIds.includes(c.wrestler.id)),
        ),
      );
      // The manager's own side, so the client is one of the people they were
      // supposed to be helping.
      const client = pick(
        rng,
        ctx.competitors.filter((c) => c.side === manager.forSide && ctx.loserIds.includes(c.wrestler.id)),
      ).wrestler;
      const what = ctx.titleOnTheLine && ctx.titleName ? `the ${ctx.titleName}` : 'the match';

      return {
        id: 'managerCostThem',
        headline: pick(rng, [
          `${manager.name} climbed on the apron and cost ${nameOf(client)} ${what}. They were still arguing about it in the aisle.`,
          `${manager.name} got involved, got it wrong, and ${nameOf(client)} lost ${what} because of it.`,
          `Whatever ${manager.name} was trying at ringside, it ended with ${nameOf(client)} beaten and the two of them shouting at each other on the way back.`,
        ]),
        involvedIds: [client.id],
        effects: [
          // The heat lands on the client alone: a manager is not on the roster
          // and cannot carry a feud of their own.
          { kind: 'morale', wrestlerId: client.id, delta: -ctx.settings.incidentBetrayalMorale * 2 },
          { kind: 'momentum', wrestlerId: client.id, delta: -ctx.settings.incidentTurnMomentum },
          { kind: 'popularity', wrestlerId: client.id, delta: ctx.settings.incidentSympathyPopularity },
        ],
      };
    },
  },

  {
    id: 'refBump',
    kind: 'Controversy',
    weight: 10,
    when: (ctx) => ctx.hasReferee && MESSY_FINISHES.has(ctx.finish) && ctx.competitors.length >= 2,
    build: (ctx, rng) => {
      const [a, b] = ctx.competitors;
      if (!a || !b) return null;
      return {
        id: 'refBump',
        headline: pick(rng, [
          `The referee got flattened and spent the finish on his back. Nobody in the building agreed on what they had just seen.`,
          `There was no official conscious for the finish, and the two of them will be arguing about it for months.`,
          `The referee took the worst bump of the night and missed everything that mattered. Nobody left satisfied.`,
        ]),
        involvedIds: [a.wrestler.id, b.wrestler.id],
        effects: [
          // A finish nobody can explain is a rematch nobody has to be sold on.
          { kind: 'crowdHeat', wrestlerIds: [a.wrestler.id, b.wrestler.id], delta: ctx.settings.incidentControversyHeat },
          { kind: 'bookingCredibility', delta: -ctx.settings.incidentCredibilityCost },
        ],
      };
    },
  },

  {
    id: 'postMatchBeatdown',
    kind: 'Ringside',
    weight: 8,
    when: (ctx) =>
      ctx.loserIds.length > 0 &&
      winnersAreHeels(ctx) &&
      // Only where it means something. A heel beating up a jobber in the
      // opener is Tuesday.
      (ctx.isMainEvent || ctx.titleOnTheLine) &&
      losers(ctx).some((w) => w.alignment > 0),
    build: (ctx, rng) => {
      const aggressor = pick(rng, winners(ctx));
      const victim = pick(rng, losers(ctx));
      return {
        id: 'postMatchBeatdown',
        headline: pick(rng, [
          `${nameOf(aggressor)} kept going long after the bell. ${nameOf(victim)} left on a stretcher to a building full of boos.`,
          `The bell meant nothing to ${nameOf(aggressor)}. It took three referees to get them off ${nameOf(victim)}.`,
          `${nameOf(aggressor)} made a point of it afterwards, slowly, while ${nameOf(victim)} had nothing left to stop them with.`,
        ]),
        involvedIds: [aggressor.id, victim.id],
        effects: [
          { kind: 'health', wrestlerId: victim.id, delta: -ctx.settings.incidentBeatdownHealth },
          { kind: 'crowdHeat', wrestlerIds: [aggressor.id, victim.id], delta: ctx.settings.incidentTurnHeat },
          { kind: 'popularity', wrestlerId: victim.id, delta: ctx.settings.incidentSympathyPopularity },
        ],
      };
    },
  },

  // ------------------------------------------------------------- returns
  {
    id: 'runIn',
    kind: 'Return',
    // Deliberately low. A run-in is eligible in almost every main event that
    // has a feud running through it, so an even weight makes it the only
    // thing that ever happens.
    weight: 5,
    when: (ctx) => ctx.availableReturns.length > 0 && (ctx.isMainEvent || ctx.titleOnTheLine) && ctx.winnerIds.length > 0,
    build: (ctx, rng) => {
      const returning = pick(rng, ctx.availableReturns);
      const target = pick(rng, winners(ctx));
      return {
        id: 'runIn',
        headline: pick(rng, [
          `${nameOf(returning)} came through the crowd and stood over ${nameOf(target)}. The place came apart.`,
          `Nobody knew ${nameOf(returning)} was in the building until they were in the ring, and ${nameOf(target)} had their back turned.`,
          `${nameOf(returning)} had unfinished business and picked tonight to say so. ${nameOf(target)} never got to enjoy the win.`,
        ]),
        involvedIds: [returning.id, target.id],
        effects: [
          { kind: 'crowdHeat', wrestlerIds: [returning.id, target.id], delta: ctx.settings.incidentReturnHeat },
          { kind: 'momentum', wrestlerId: returning.id, delta: ctx.settings.incidentReturnMomentum },
          { kind: 'popularity', wrestlerId: returning.id, delta: ctx.settings.incidentReturnPopularity },
        ],
      };
    },
  },

  // ------------------------------------------------------- real trouble
  {
    id: 'itWentReal',
    kind: 'Shoot',
    weight: 10,
    when: (ctx) => ctx.shootHeat >= ctx.settings.incidentShootThreshold && ctx.competitors.length >= 2,
    build: (ctx, rng) => {
      const hurt = pick(rng, ctx.competitors).wrestler;
      const other = ctx.competitors.find((c) => c.wrestler.id !== hurt.id)!.wrestler;
      return {
        id: 'itWentReal',
        headline: pick(rng, [
          `That stopped being a wrestling match somewhere in the middle. ${nameOf(hurt)} did not walk out under their own power, and ${nameOf(other)} did not look sorry.`,
          `Whatever was between ${nameOf(other)} and ${nameOf(hurt)} came out in the ring tonight, and it was not pretty to watch.`,
          `${nameOf(other)} stopped pulling anything. ${nameOf(hurt)} is going to be off for a while, and the locker room knows exactly why.`,
        ]),
        involvedIds: [hurt.id, other.id],
        effects: [
          { kind: 'injury', wrestlerId: hurt.id, weeks: ctx.settings.incidentShootInjuryWeeks },
          { kind: 'shootHeat', wrestlerIds: [hurt.id, other.id], delta: ctx.settings.incidentShootHeat },
          { kind: 'morale', wrestlerId: hurt.id, delta: -ctx.settings.incidentBetrayalMorale },
          { kind: 'rosterMorale', delta: -ctx.settings.incidentRosterUnease },
        ],
      };
    },
  },

  {
    id: 'enemiesInTheRing',
    kind: 'Shoot',
    weight: 12,
    when: (ctx) => ctx.enemies.length > 0,
    build: (ctx, rng) => {
      const [aId, bId] = pick(rng, ctx.enemies);
      const a = ctx.competitors.find((c) => c.wrestler.id === aId)?.wrestler;
      const b = ctx.competitors.find((c) => c.wrestler.id === bId)?.wrestler;
      if (!a || !b) return null;
      return {
        id: 'enemiesInTheRing',
        headline: pick(rng, [
          `${nameOf(a)} and ${nameOf(b)} have never got on, and tonight everybody watching could tell. The stiffness was not a work.`,
          `Somebody put ${nameOf(a)} in the ring with ${nameOf(b)}. Whoever it was will hear about it.`,
          `Every exchange between ${nameOf(a)} and ${nameOf(b)} landed a little harder than it needed to.`,
        ]),
        involvedIds: [a.id, b.id],
        effects: [
          { kind: 'shootHeat', wrestlerIds: [a.id, b.id], delta: ctx.settings.incidentShootHeat },
          { kind: 'health', wrestlerId: chance(rng, 0.5) ? a.id : b.id, delta: -ctx.settings.incidentBeatdownHealth },
          { kind: 'morale', wrestlerId: a.id, delta: -ctx.settings.incidentRosterUnease },
          { kind: 'morale', wrestlerId: b.id, delta: -ctx.settings.incidentRosterUnease },
        ],
      };
    },
  },

  // ---------------------------------------------------------- the crowd
  {
    id: 'starIsBorn',
    kind: 'Breakout',
    weight: 16,
    when: (ctx) => {
      if (ctx.rating < ctx.settings.incidentBreakoutRating || ctx.winnerIds.length === 0) return false;
      const winner = winners(ctx)[0];
      const beaten = losers(ctx)[0];
      return Boolean(
        winner && beaten && beaten.popularity - winner.popularity >= ctx.settings.incidentBreakoutGap,
      );
    },
    build: (ctx, rng) => {
      const winner = winners(ctx)[0];
      const beaten = losers(ctx)[0];
      if (!winner || !beaten) return null;
      return {
        id: 'starIsBorn',
        headline: pick(rng, [
          `Nobody came to see ${nameOf(winner)} and everybody left talking about them. Beating ${nameOf(beaten)} like that changes what they are.`,
          `${nameOf(winner)} was not supposed to be able to do that to ${nameOf(beaten)}, and the building knew it before the count of three.`,
          `Whatever ${nameOf(winner)} was before tonight, they are not it any more.`,
        ]),
        involvedIds: [winner.id, beaten.id],
        effects: [
          { kind: 'popularity', wrestlerId: winner.id, delta: ctx.settings.incidentBreakoutPopularity },
          { kind: 'momentum', wrestlerId: winner.id, delta: ctx.settings.incidentReturnMomentum },
          { kind: 'companyRating', delta: ctx.settings.incidentCompanyLift },
        ],
      };
    },
  },

  {
    id: 'torchPassed',
    kind: 'Breakout',
    weight: 12,
    when: (ctx) => {
      if (ctx.rating < ctx.settings.incidentBreakoutRating) return false;
      const winner = winners(ctx)[0];
      const beaten = losers(ctx)[0];
      return Boolean(
        winner &&
          beaten &&
          beaten.age - winner.age >= ctx.settings.incidentTorchAgeGap &&
          !MESSY_FINISHES.has(ctx.finish),
      );
    },
    build: (ctx, rng) => {
      const winner = winners(ctx)[0];
      const beaten = losers(ctx)[0];
      if (!winner || !beaten) return null;
      return {
        id: 'torchPassed',
        headline: pick(rng, [
          `${nameOf(beaten)} lost clean and then raised ${nameOf(winner)}'s hand. Everybody in the building understood what they had just watched.`,
          `${nameOf(beaten)} did the job in the middle of the ring for ${nameOf(winner)} and took their time leaving. That was on purpose.`,
          `There was no shortcut and no excuse. ${nameOf(beaten)} gave ${nameOf(winner)} the whole thing.`,
        ]),
        involvedIds: [winner.id, beaten.id],
        effects: [
          { kind: 'popularity', wrestlerId: winner.id, delta: ctx.settings.incidentBreakoutPopularity },
          { kind: 'morale', wrestlerId: beaten.id, delta: ctx.settings.incidentGraciousMorale },
          { kind: 'companyRating', delta: ctx.settings.incidentCompanyLift },
        ],
      };
    },
  },

  {
    id: 'standingOvation',
    kind: 'The crowd',
    weight: 10,
    when: (ctx) => ctx.rating >= ctx.settings.incidentOvationRating && ctx.competitors.length >= 2,
    build: (ctx, rng) => ({
      id: 'standingOvation',
      headline: pick(rng, [
        `Neither of them could leave. The building would not let them, and stayed on their feet until the lights came up.`,
        `The crowd would not sit down and would not stop. They were still on their feet when the ring crew came out.`,
        `Nobody moved for the next match. That is the only review that one needed.`,
      ]),
      involvedIds: everyone(ctx),
      effects: [
        ...ctx.competitors.map(
          (c): EventEffect => ({
            kind: 'popularity',
            wrestlerId: c.wrestler.id,
            delta: ctx.settings.incidentOvationPopularity,
          }),
        ),
        { kind: 'rosterMorale', delta: ctx.settings.incidentGraciousMorale },
      ],
    }),
  },

  {
    id: 'crowdHijack',
    kind: 'The crowd',
    weight: 14,
    when: (ctx) => ctx.rating <= ctx.settings.incidentHijackRating && !ctx.isMainEvent && ctx.competitors.length >= 2,
    build: (ctx, rng) => ({
      id: 'crowdHijack',
      headline: pick(rng, [
        `The crowd gave up on this one early and spent the second half entertaining themselves. You could hear the beach ball.`,
        `By the halfway point the loudest thing in the building was a chant about something else entirely.`,
        `You could hear individual conversations in the back rows. That is never a good sign.`,
      ]),
      involvedIds: everyone(ctx),
      effects: [
        ...ctx.competitors.map(
          (c): EventEffect => ({
            kind: 'popularity',
            wrestlerId: c.wrestler.id,
            delta: -ctx.settings.incidentHijackPopularity,
          }),
        ),
        { kind: 'bookingCredibility', delta: -ctx.settings.incidentCredibilityCost },
      ],
    }),
  },

  {
    id: 'cheapRetain',
    kind: 'Controversy',
    weight: 12,
    when: (ctx) => ctx.titleOnTheLine && !ctx.titleChanged && MESSY_FINISHES.has(ctx.finish) && ctx.winnerIds.length > 0,
    build: (ctx, rng) => {
      const champion = winners(ctx)[0];
      const challenger = losers(ctx)[0];
      if (!champion || !challenger) return null;
      const belt = ctx.titleName ?? 'the belt';
      return {
        id: 'cheapRetain',
        headline: pick(rng, [
          `${nameOf(champion)} kept ${belt} without ever really beating ${nameOf(challenger)}, and got booed out of the building for it.`,
          `${belt} did not change hands, but nobody watching thinks ${nameOf(champion)} beat ${nameOf(challenger)} tonight.`,
          `${nameOf(champion)} walked out still holding ${belt} and could not get out of the building fast enough.`,
        ]),
        involvedIds: [champion.id, challenger.id],
        effects: [
          { kind: 'popularity', wrestlerId: champion.id, delta: -ctx.settings.incidentHijackPopularity },
          { kind: 'crowdHeat', wrestlerIds: [champion.id, challenger.id], delta: ctx.settings.incidentControversyHeat },
          { kind: 'popularity', wrestlerId: challenger.id, delta: ctx.settings.incidentSympathyPopularity },
        ],
      };
    },
  },
];

/** Did the winning side go over as heels? Used by the post-match beatdown. */
function winnersAreHeels(ctx: IncidentContext): boolean {
  const winning = ctx.competitors.filter((c) => ctx.winnerIds.includes(c.wrestler.id));
  return winning.length > 0 && winning.every((c) => c.wrestler.alignment < 0);
}

export function incidentById(id: string): IncidentDefinition | undefined {
  return INCIDENTS.find((i) => i.id === id);
}

export type { Incident, IncidentContext };
