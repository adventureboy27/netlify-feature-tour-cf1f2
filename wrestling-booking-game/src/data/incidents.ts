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
          `${nameOf(turncoat)} turned on ${nameOf(betrayed)} right there in front of everybody, and just like that, ${group.name} is finished.`,
          `It came apart right there in the ring. ${nameOf(turncoat)} left ${nameOf(betrayed)} laid out and walked away alone — there is no more ${group.name}, not after that.`,
          `${nameOf(betrayed)} never saw it coming from ${nameOf(turncoat)}, and half this building was up out of its seats before it even understood what it had just watched.`,
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
          `${nameOf(formerChampion)} attacked ${nameOf(newChampion)} with the very belt they had just lost, and had to be dragged off by half the roster.`,
          `${nameOf(formerChampion)} would not hand that belt over. When it finally came, it came across ${nameOf(newChampion)}'s head.`,
          `Losing that title broke something in ${nameOf(formerChampion)} tonight. ${nameOf(newChampion)} was still celebrating when it all started.`,
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
          `${manager.name} climbed right up on that apron and cost ${nameOf(client)} ${what} outright. The two of them were still going at it in the aisle on the way out.`,
          `${manager.name} got involved, got it completely wrong, and ${nameOf(client)} paid for it with ${what}.`,
          `Whatever ${manager.name} was trying to pull off at ringside, it ended with ${nameOf(client)} beaten and the two of them screaming at each other all the way to the back.`,
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
          `The referee got absolutely flattened and spent the whole finish laid out flat on that mat. Nobody in this building could agree on what they had just watched.`,
          `There was not a conscious official anywhere in sight for that finish, and these two will be arguing about it for months to come.`,
          `The referee took the single worst bump of the night and missed every bit of it that mattered. Nobody walked out of this building satisfied.`,
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
          `${nameOf(aggressor)} kept right on going long after that bell rang. ${nameOf(victim)} left on a stretcher to a building full of boos raining down.`,
          `That bell meant absolutely nothing to ${nameOf(aggressor)} tonight. It took three separate referees just to pull them off ${nameOf(victim)}.`,
          `${nameOf(aggressor)} made a point of it afterward — slowly, deliberately — while ${nameOf(victim)} had absolutely nothing left to stop it with.`,
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
          `${nameOf(returning)} came straight through this crowd and stood right over ${nameOf(target)}. This place came apart at the seams.`,
          `Nobody in this building knew ${nameOf(returning)} was even here until they were standing in that ring, and ${nameOf(target)} never saw it coming with their back turned.`,
          `${nameOf(returning)} had unfinished business, and picked tonight of all nights to say so. ${nameOf(target)} never got one second to enjoy that win.`,
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

  // ----------------------------------------------------------- invasions
  {
    id: 'rivalInvasion',
    kind: 'Invasion',
    // Rarer than a run-in on purpose — see WorldSettings.invasionEarliestWeek.
    // By the time a save is old enough for this to even be possible, it
    // should still read as a genuine surprise, not a regular Tuesday.
    weight: 4,
    when: (ctx) =>
      ctx.potentialInvaders.length > 0 && (ctx.isMainEvent || ctx.titleOnTheLine) && ctx.winnerIds.length > 0,
    build: (ctx, rng) => {
      const invader = pick(rng, ctx.potentialInvaders);
      const target = pick(rng, winners(ctx));
      return {
        id: 'rivalInvasion',
        headline: pick(rng, [
          `${nameOf(invader.wrestler)} came walking out from the back wearing ${invader.fromPromotionName} colors, and put ${nameOf(target)} straight through the mat before a soul back there could stop it.`,
          `Nobody announced it and nobody advertised it. Every phone in the building was up the second ${nameOf(invader.wrestler)} hit that ramp, and ${nameOf(target)} never got one second to enjoy the win.`,
          `${invader.fromPromotionName} just sent a message, and ${nameOf(invader.wrestler)} delivered it in person. ${nameOf(target)} is still trying to figure out what happened.`,
        ]),
        involvedIds: [invader.wrestler.id, target.id],
        effects: [
          { kind: 'crowdHeat', wrestlerIds: [invader.wrestler.id, target.id], delta: ctx.settings.invasionHeat },
          { kind: 'momentum', wrestlerId: invader.wrestler.id, delta: ctx.settings.invasionMomentum },
          { kind: 'popularity', wrestlerId: invader.wrestler.id, delta: ctx.settings.invasionPopularity },
          // They came, they made their point, and it lets some of the steam off — see engine/world/grudges.ts.
          { kind: 'grudgeRelief', promotionId: invader.fromPromotionId, delta: ctx.settings.invasionCatharsis },
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
          `That stopped being a wrestling match somewhere in the middle of it. ${nameOf(hurt)} did not walk out of there under their own power, and ${nameOf(other)} did not look one bit sorry about it.`,
          `Whatever bad blood was between ${nameOf(other)} and ${nameOf(hurt)} came pouring out in that ring tonight, and it was ugly to watch from start to finish.`,
          `${nameOf(other)} stopped pulling a single thing out there. ${nameOf(hurt)} is going to be off television for a while, and this entire locker room knows exactly why.`,
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
          `${nameOf(a)} and ${nameOf(b)} have never gotten along, and tonight every single person watching could tell. That stiffness out there was not a work.`,
          `Somebody in this office put ${nameOf(a)} in a ring with ${nameOf(b)} tonight. Whoever made that call is going to hear about it.`,
          `Every single exchange between ${nameOf(a)} and ${nameOf(b)} tonight landed a whole lot harder than it ever needed to.`,
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
          `Nobody in this building came to see ${nameOf(winner)}, and every last one of them left talking about nobody else. Beating ${nameOf(beaten)} like that changes everything about who they are.`,
          `${nameOf(winner)} was not supposed to be able to do a single thing to ${nameOf(beaten)} tonight, and this building knew it before the referee's hand even hit three.`,
          `Whatever ${nameOf(winner)} was walking in here tonight, they are not that anymore — not after this.`,
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
          `${nameOf(beaten)} lost clean, then raised ${nameOf(winner)}'s hand up high themselves. Everybody in this building understood exactly what they had just witnessed.`,
          `${nameOf(beaten)} did business right there in the middle of the ring for ${nameOf(winner)} and took their sweet time leaving. That was no accident.`,
          `There was no shortcut here and no excuse needed. ${nameOf(beaten)} gave ${nameOf(winner)} the entire thing, clean.`,
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
        `Neither one of them could even leave the ring. This building would not let them go, staying up on its feet until the house lights finally came up.`,
        `This crowd would not sit down and would not stop, not for anything. They were still up on their feet when the ring crew came out to reset.`,
        `Nobody in this building moved a muscle for the next match. That right there is the only review that one ever needed.`,
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
        `This crowd gave up on that one early and spent the whole second half entertaining itself instead. You could hear that beach ball bouncing around from ringside.`,
        `By the halfway mark, the loudest thing anywhere in this building was a chant about something that had nothing to do with the match.`,
        `You could pick out individual conversations happening in the back rows tonight. That is never, ever a good sign.`,
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
          `${nameOf(champion)} walked out still holding ${belt} without ever really beating ${nameOf(challenger)}, and got booed straight out of this building for it.`,
          `${belt} did not change hands tonight, but not one soul watching believes ${nameOf(champion)} actually beat ${nameOf(challenger)}.`,
          `${nameOf(champion)} left still holding ${belt} tonight, and could not get out of this building fast enough.`,
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
