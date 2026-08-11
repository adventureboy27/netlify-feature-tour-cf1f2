// Two people, a microphone, and the chance it gets away from everybody.
//
// The exchange itself is a roll-off: both of them go on charisma first,
// popularity second, the same order promos use, and whoever comes out ahead
// gets the night. Losing it costs something — a confrontation you came second
// in is worse than one you were never in, which is what makes putting a bad
// talker opposite a good one a real decision rather than a free segment.
//
// Then the twist. This is the half that did not exist anywhere in the game:
// `rollIncident` runs on matches and on rival shows and never on a segment
// where somebody is holding a live microphone, so the most likely place for
// something unplanned was the one place nothing unplanned could happen.
//
// Where it happens changes both. In the ring is public: the crowd is in it,
// the swings are bigger, and a turn lands in front of the whole building.
// Backstage is private, quieter, and much likelier to stop being a
// performance — there is nobody watching to keep it one.

import type { Rng } from '../rng';
import { clamp, pick } from '../rng';
import {
  CONFRONTATION_TWISTS,
  confrontationById,
  type ConfrontationDefinition,
  type ConfrontationTwist,
  type ConfrontationVenue,
} from '../../data/confrontations';
import type { Id, Wrestler, WorldSettings } from '../types';

export interface ConfrontationContext {
  definitionId: Id;
  venue: ConfrontationVenue;
  /** Who called it. */
  speaker: Wrestler;
  /** Who it is aimed at. Both of them talk. */
  opposite: Wrestler;
  /** The partner who takes the shot, or the person being fought over. */
  third?: Wrestler | null;
  /** Heat already on the feud, if there is one. */
  existingHeat: number;
  settings: WorldSettings;
}

export interface ConfrontationOutcome {
  /** 0-100, the same scale a match and a promo rate on. */
  quality: number;
  /** Who came out of the exchange looking better. Null when it was level. */
  wonBy: Id | null;
  /** The write-up: the opener, then whatever happened. */
  text: string;
  twistId: string;
  twistLabel: string;
  /** Crowd heat added to the feud between the two of them. */
  heat: number;
  /** Real animosity added. Usually zero. */
  shootHeat: number;
  /** Alignment push on the speaker, for the segments meant to change somebody. */
  alignmentShift: number;
  /** Somebody got hurt. */
  casualty: { wrestlerId: Id; name: string; weeks: number } | null;
}

/** How well somebody talks, before anybody has said anything. */
function micScore(w: Wrestler, settings: WorldSettings): number {
  return w.charisma * settings.confrontationCharismaWeight + w.popularity * settings.confrontationPopularityWeight;
}

/** Which twists could plausibly happen tonight. */
export function possibleTwists(
  definition: ConfrontationDefinition,
  venue: ConfrontationVenue,
  hasThird: boolean,
): ConfrontationTwist[] {
  return CONFRONTATION_TWISTS.filter((twist) => {
    if (!twist.venues.includes(venue)) return false;
    if (twist.intents.length > 0 && !twist.intents.includes(definition.intent)) return false;
    if (twist.needsThird && !hasThird) return false;
    return true;
  });
}

function drawTwist(rng: Rng, candidates: ConfrontationTwist[], venue: ConfrontationVenue, settings: WorldSettings) {
  // Backstage there is nobody watching to keep it a performance, so the
  // twists that turn it real are likelier and the polite ones are not.
  const weightOf = (twist: ConfrontationTwist) =>
    venue === 'backstage' && twist.shootHeat > 0
      ? twist.weight * settings.confrontationBackstageShootBias
      : twist.weight;

  const total = candidates.reduce((sum, t) => sum + weightOf(t), 0);
  let roll = rng.next() * total;
  for (const twist of candidates) {
    roll -= weightOf(twist);
    if (roll <= 0) return twist;
  }
  return candidates[candidates.length - 1]!;
}

export function resolveConfrontation(rng: Rng, ctx: ConfrontationContext): ConfrontationOutcome | null {
  const definition = confrontationById(ctx.definitionId);
  if (!definition) return null;
  const s = ctx.settings;

  // The exchange. Both of them roll their own mic work with a little luck on
  // top, so a great talker still loses one occasionally.
  const swing = () => (rng.next() - 0.5) * 2 * s.confrontationLuck;
  const forSpeaker = micScore(ctx.speaker, s) + swing();
  const forOpposite = micScore(ctx.opposite, s) + swing();
  const margin = forSpeaker - forOpposite;
  const wonBy =
    Math.abs(margin) < s.confrontationDeadHeat ? null : margin > 0 ? ctx.speaker.id : ctx.opposite.id;

  const twist = drawTwist(
    rng,
    possibleTwists(definition, ctx.venue, Boolean(ctx.third)),
    ctx.venue,
    s,
  );

  const cast = (line: string) =>
    line
      .replace(/\{a\}/g, ctx.speaker.name)
      .replace(/\{b\}/g, ctx.opposite.name)
      .replace(/\{c\}/g, ctx.third?.name ?? 'somebody');

  // The segment rates off the better of the two — a confrontation is carried
  // by whoever is carrying it — with the rest of the room dragging a little.
  const best = Math.max(micScore(ctx.speaker, s), micScore(ctx.opposite, s));
  const worst = Math.min(micScore(ctx.speaker, s), micScore(ctx.opposite, s));
  const quality = clamp(
    best * s.confrontationBestShare +
      worst * (1 - s.confrontationBestShare) +
      (ctx.existingHeat / 100) * s.confrontationHeatBonus +
      (ctx.venue === 'ring' ? s.confrontationRingBonus : 0),
    0,
    100,
  );

  // The crowd is in the ring segments and not in the backstage ones, so a
  // public confrontation moves the feud further in either direction.
  //
  // Crowd heat only. Real animosity is not scaled by how many people were
  // watching — two men who genuinely fall out in a corridor have fallen out
  // just as hard as two who do it in front of nine thousand. Scaling both was
  // a modelling error that made a backstage shoot *quieter* than a public
  // one, which is backwards and was caught by a test asserting the corridor
  // is where things get real.
  const venueScale = ctx.venue === 'ring' ? 1 : s.confrontationBackstageHeatScale;

  const hurtWho =
    twist.hurts === 'third' ? ctx.third : twist.hurts === 'speaker' ? ctx.speaker : ctx.opposite;
  const casualty =
    twist.injuryWeeks && hurtWho
      ? {
          wrestlerId: hurtWho.id,
          name: hurtWho.name,
          weeks: Math.max(
            1,
            Math.round(
              twist.injuryWeeks[0] + rng.next() * (twist.injuryWeeks[1] - twist.injuryWeeks[0]),
            ),
          ),
        }
      : null;

  return {
    quality,
    wonBy,
    text: `${cast(pick(rng, definition.openers))} ${cast(pick(rng, twist.lines))}`,
    twistId: twist.id,
    twistLabel: twist.label,
    heat: Math.round((definition.heat + twist.heat) * venueScale),
    shootHeat: twist.shootHeat,
    // A turn is the one segment booked to change somebody, so the intent
    // carries the shift and the twist can push it the other way — which is
    // how a turn lands backwards in front of a live crowd.
    alignmentShift:
      definition.intent === 'turn'
        ? s.confrontationTurnShift * (twist.alignmentShift < 0 ? -1 : 1)
        : 0,
    casualty,
  };
}

/**
 * Whether this pair can be given this segment at all.
 *
 * Kept out of the resolver so the booking screen can grey out what does not
 * apply rather than offering a contract signing between two people with no
 * match to sign for.
 */
export function confrontationAvailable(
  definition: ConfrontationDefinition,
  ctx: {
    speaker: Wrestler;
    opposite: Wrestler;
    /** True when the two of them are in the same team or stable. */
    allies: boolean;
    /** True when either of them holds a belt. */
    championship: boolean;
    /** True when either of them is married to or seeing somebody. */
    romance: boolean;
  },
): boolean {
  if (ctx.speaker.id === ctx.opposite.id) return false;
  if (definition.requires === 'allies') return ctx.allies;
  if (definition.requires === 'championship') return ctx.championship;
  if (definition.requires === 'romance') return ctx.romance;
  return true;
}
