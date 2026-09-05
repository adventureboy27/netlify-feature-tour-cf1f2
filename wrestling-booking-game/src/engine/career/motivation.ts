// What actually motivates somebody — separate from morale, and visible.
//
// Morale asks "how do they feel about this company." Motivation answers a
// different question: what were they actually chasing when they signed here,
// and did they get it. A big-money contract satisfies the man who wanted the
// money; it does nothing for the one who wanted the belt, and the booker who
// only ever reaches for the chequebook eventually runs out of ways to move
// somebody who has already been paid.
//
// Drawn once at generation, like a trait, and for the same reason: it is a
// stated fact about a person rather than a verdict on how they have been
// booked. Somebody can hold from one to a handful at once — a few of these
// are genuinely new (chasing gold specifically, chasing the push specifically,
// chasing fame, chasing a real story, chasing a real opponent, wanting the
// safety net first) and get their own icon and their own weekly read below.
// The rest of the roster's existing motivations — money, rest, the room,
// gratitude, home — already exist as traits in career/personality.ts and are
// not duplicated here; they get an icon too (see MOTIVATION_SYMBOLS) so the
// player reads one unified row rather than two overlapping systems.
//
// Wired in two different ways, honestly, because they are two different
// kinds of thing:
//
//   - Championship- and push-motivated re-weight morale terms that already
//     exist for everybody (gold, spotlight, idle) — exactly how a trait
//     does it. See morale.ts's `add`.
//   - Fame, creative, and competition are new signals nobody was reading
//     before — how close somebody is to their own career-best crowd
//     reaction, how fresh their gimmick still feels, whether the last person
//     they were in the ring with was a real test. Bespoke, in
//     `motivatorReasons`, the same way `traitReasons` already handles
//     money-satisfaction for In It For The Money.
//   - Security-motivated is not morale at all — it changes what somebody
//     asks for at the negotiating table. See career/theBody.ts's
//     `dealAppetite`.

import type { Wrestler, WorldSettings } from '../types';
import { traitById, type MoraleLever, type TraitReason } from './personality';

export type MotivatorId = 'championship' | 'push' | 'fame' | 'creative' | 'competition' | 'security';

export interface Motivator {
  id: MotivatorId;
  name: string;
  /** Shown on the roster card and in the legend. One or two characters. */
  icon: string;
  /** What the legend says it means. */
  blurb: string;
  /** Relative draw weight. */
  weight: number;
  /** Never drawn alongside these. */
  excludes?: MotivatorId[];
  /** How hard an existing morale term lands, same shape as a trait's. */
  weighs?: Partial<Record<MoraleLever, number>>;
}

export const MOTIVATORS: readonly Motivator[] = [
  {
    id: 'championship',
    name: 'Championship-motivated',
    icon: '🏆',
    blurb: 'The belt is the job. Chasing one or defending one means more than where they sit on the card.',
    weight: 9,
    weighs: { gold: 2.2 },
  },
  {
    id: 'push',
    name: 'Push-motivated',
    icon: '🎤',
    blurb: 'Wants to be seen moving up, gold or no gold. Trending is a good week; standing still is not.',
    weight: 9,
    weighs: { spotlight: 2.0, idle: 1.4 },
  },
  {
    id: 'fame',
    name: 'Fame-motivated',
    icon: '⭐',
    blurb: 'Being over is the whole point, not the belt and not the cheque. Notices exactly how close they are to the best crowd reaction of their career.',
    weight: 8,
  },
  {
    id: 'creative',
    name: 'Creative-motivated',
    icon: '🎭',
    blurb: 'Lives for a gimmick and a story that still feel new. A stale act wears on them faster than it wears on anybody else.',
    weight: 7,
  },
  {
    id: 'competition',
    name: 'Competition-motivated',
    icon: '🥊',
    blurb: 'Wants a real opponent. A squash does nothing for them, and they notice being fed easy nights.',
    weight: 7,
    excludes: ['security'],
  },
  {
    id: 'security',
    name: 'Security-motivated',
    icon: '🛡️',
    blurb: 'Wants the guarantee and the cover before anything else on the table. A dangerous match is a risk, not a chance to prove something.',
    weight: 7,
    excludes: ['competition'],
  },
];

const BY_ID = new Map(MOTIVATORS.map((m) => [m.id, m]));

export function motivatorById(id: MotivatorId): Motivator | undefined {
  return BY_ID.get(id);
}

/** The motivators somebody actually has, in definition order so the card is stable. */
export function motivatorsOf(wrestler: Pick<Wrestler, 'motivators'>): Motivator[] {
  const held = new Set(wrestler.motivators ?? []);
  return MOTIVATORS.filter((m) => held.has(m.id));
}

export function hasMotivator(wrestler: Pick<Wrestler, 'motivators'>, id: MotivatorId): boolean {
  return (wrestler.motivators ?? []).includes(id);
}

/**
 * How hard a motivator makes an existing morale term land, same maths as
 * `leverWeight` in personality.ts and deliberately kept separate from it —
 * morale.ts combines the two and caps the product once, so a person who is
 * both a trait and a motivator for the same lever cannot multiply past the
 * ceiling twice.
 */
export function motivatorLeverWeight(wrestler: Pick<Wrestler, 'motivators'>, lever: MoraleLever): number {
  let weight = 1;
  for (const motivator of motivatorsOf(wrestler)) {
    weight *= motivator.weighs?.[lever] ?? 1;
  }
  return weight;
}

/**
 * One to a handful, drawn off their own stream — see generate/wrestler.ts,
 * which seeds it `motivate:${id}` so adding this system did not reroll a
 * single wrestler already in the game.
 */
export function drawMotivators(next: () => number, settings: WorldSettings): MotivatorId[] {
  let wanted = 1;
  if (next() < settings.motivatorSecondChance) wanted = 2;
  if (wanted === 2 && next() < settings.motivatorThirdChance) wanted = 3;

  const drawn: MotivatorId[] = [];
  for (let i = 0; i < wanted; i++) {
    const banned = new Set<MotivatorId>(drawn);
    for (const id of drawn) {
      for (const other of motivatorById(id)?.excludes ?? []) banned.add(other);
    }
    const pool = MOTIVATORS.filter((m) => !banned.has(m.id));
    const total = pool.reduce((sum, m) => sum + m.weight, 0);
    if (total <= 0) break;

    let roll = next() * total;
    for (const motivator of pool) {
      roll -= motivator.weight;
      if (roll <= 0) {
        drawn.push(motivator.id);
        break;
      }
    }
  }

  return drawn;
}

/**
 * What each motivator has to say about this particular week, for the three
 * that do not already ride an existing morale term. Bespoke, the same way
 * `traitReasons` is bespoke for In It For The Money — these are things that
 * happened, not things that landed harder, so they are added rather than
 * weighted.
 */
export function motivatorReasons(
  wrestler: Wrestler,
  week: { worked: boolean; opponentPopularity: number | null },
  settings: WorldSettings,
): TraitReason[] {
  const out: TraitReason[] = [];
  const s = settings;

  if (hasMotivator(wrestler, 'fame')) {
    const peak = Math.max(wrestler.careerHighPopularity, wrestler.popularity);
    const gap = (peak - wrestler.popularity) / 100;
    if (gap <= s.fameMotivatorNotices) {
      out.push({ text: 'Riding the best crowd reaction of their career.', delta: s.fameMotivatorWeight * (1 - gap) });
    } else {
      out.push({ text: 'A long way off the best they have ever drawn.', delta: -gap * s.fameMotivatorWeight });
    }
  }

  if (hasMotivator(wrestler, 'creative')) {
    const signal = (wrestler.gimmickFreshness - 50) / 50;
    if (signal >= s.creativeMotivatorNotices) {
      out.push({ text: 'The act still feels new, and it shows.', delta: signal * s.creativeMotivatorWeight });
    } else if (signal <= -s.creativeMotivatorNotices) {
      out.push({ text: 'The gimmick feels stale, and everybody can tell.', delta: signal * s.creativeMotivatorWeight });
    }
  }

  if (hasMotivator(wrestler, 'competition') && week.worked && week.opponentPopularity !== null) {
    const gap = (week.opponentPopularity - wrestler.popularity) / 100;
    if (gap >= s.competitionMotivatorNotices) {
      out.push({ text: 'Got a real test this week.', delta: gap * s.competitionMotivatorWeight });
    } else if (-gap >= s.competitionMotivatorNotices) {
      out.push({ text: 'Fed an easy night, and noticed.', delta: gap * s.competitionMotivatorWeight });
    }
  }

  return out;
}

/** One entry in the unified icon row and legend — a trait or a motivator, the player never needs to know which. */
export interface MotivationSymbol {
  icon: string;
  name: string;
  blurb: string;
}

/**
 * Money, rest, the room, gratitude, and home already exist as traits — see
 * the module doc comment. Icon-only here, referenced by id rather than
 * redefined, so there is exactly one source of truth for what each of those
 * five actually does.
 */
export const ICONIFIED_TRAIT_IDS = [
  'inItForTheMoney',
  'wantsMoreTimeOff',
  'lockerRoomLeader',
  'gratefulForTheWork',
  'somebodyAtHome',
] as const;

/** Every symbol the legend can show, traits and motivators together, in one stable order. */
export function motivationLegend(): MotivationSymbol[] {
  const traitSymbols: MotivationSymbol[] = ICONIFIED_TRAIT_IDS.map((id) => {
    const trait = traitById(id)!;
    return { icon: trait.icon!, name: trait.name, blurb: trait.blurb };
  });
  const motivatorSymbols: MotivationSymbol[] = MOTIVATORS.map((m) => ({ icon: m.icon, name: m.name, blurb: m.blurb }));
  return [...motivatorSymbols, ...traitSymbols];
}

/** What one wrestler's icon row actually shows — only the symbols they hold. */
export function motivationSymbolsOf(wrestler: Pick<Wrestler, 'traits' | 'motivators'>): MotivationSymbol[] {
  const traitSymbols: MotivationSymbol[] = ICONIFIED_TRAIT_IDS.filter((id) => (wrestler.traits ?? []).includes(id)).map(
    (id) => {
      const trait = traitById(id)!;
      return { icon: trait.icon!, name: trait.name, blurb: trait.blurb };
    },
  );
  const motivatorSymbols: MotivationSymbol[] = motivatorsOf(wrestler).map((m) => ({
    icon: m.icon,
    name: m.name,
    blurb: m.blurb,
  }));
  return [...motivatorSymbols, ...traitSymbols];
}
