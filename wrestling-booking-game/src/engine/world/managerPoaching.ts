// A manager's own version of poaching.ts's rival approach.
//
// Deliberately not a parallel system: this feeds the exact same open,
// sitting, respondable offer a wrestler gets — world.approachOffers,
// answerApproach, the same OfficeScreen panel — because "a signed manager
// gets courted by a rival promotion" is the same shape of story a wrestler's
// lapsed contract already tells. Only the appeal and temptation math are
// manager-flavored: a manager isn't chased for his in-ring upside, he's
// chased for how good a talker he's proven to be and how big a book he's
// built, and what keeps him put isn't a main-event push, it's the clients he
// would be walking out on.
//
// promiseABiggerBook (poaching.ts's PoachingResponse) is this module's
// answer to promiseAPush — you can't push a man who doesn't wrestle, but you
// can promise to steer more names his way.

import type { Rng } from '../rng';
import { chance, clamp } from '../rng';
import type { Id, Wrestler, Promotion, WorldSettings } from '../types';
import { leverWeight, temptationWeight } from '../career/personality';
import { bookOf, endRepresentation, type Representation } from '../career/representation';
import type { Approach } from './poaching';

/**
 * How appealing a manager is to a rival. Not popularity/hype-driven the way
 * a wrestler's upside is — a manager is judged on the book he's proven he
 * can run, and, same as a wrestler, on how unhappy he looks doing it.
 */
export function managerPoachingAppeal(manager: Wrestler, bookSize: number): number {
  const proven = clamp(manager.popularity / 100, 0, 1);
  const track = clamp(bookSize / 4, 0, 1);
  const unhappiness = 1 - manager.morale / 100;
  return clamp(proven * 0.45 + track * 0.35 + unhappiness * 0.2, 0, 1);
}

/**
 * How temptable a manager is. The same money/morale/momentum/lock-in shape
 * as a wrestler's temptation() (poaching.ts) — those terms don't care what
 * role signed the contract — with one manager-specific term in place of the
 * three wrestling personality pulls: a real book is a reason to stay,
 * because leaving means abandoning clients, not just a job.
 */
export function managerTemptation(
  manager: Wrestler,
  offerPremium: number,
  weeksLeftOnDeal: number,
  bookSize: number,
  settings: WorldSettings,
): number {
  const currentRate = manager.contract?.weeklyRate ?? 0;
  const money =
    (currentRate > 0 ? clamp(offerPremium / currentRate, 0, 2) / 2 : 1) * leverWeight(manager, 'money', settings);
  const unhappy = 1 - manager.morale / 100;
  const stalled = 1 - manager.momentum / 100;
  const lockedIn = clamp(weeksLeftOnDeal / settings.contractLengthDefault, 0, 1);
  const bookAnchor = clamp(bookSize / 4, 0, 1) * settings.poachManagerBookResistance;

  const raw =
    money * settings.approachMoneyWeight +
    unhappy * settings.approachMoraleWeight +
    stalled * settings.approachMomentumWeight -
    lockedIn * settings.approachContractLengthResistance -
    bookAnchor;

  const professionalism = (manager.attitude / 100) * settings.approachAttitudeResistance;
  return clamp((raw - professionalism) * temptationWeight(manager), 0, 1);
}

export interface ManagerApproachContext {
  roster: readonly Wrestler[];
  rivals: readonly Promotion[];
  reps: readonly Representation[];
  settings: WorldSettings;
}

/** Roll this week's manager approaches — only ever for a lapsed contract, same rule as a wrestler. */
export function rollManagerApproaches(rng: Rng, ctx: ManagerApproachContext): Approach[] {
  const attempts: Approach[] = [];
  const { settings } = ctx;

  for (const rival of ctx.rivals) {
    const aggression = (rival.rating / 100) * settings.poachingAggression;

    for (const manager of ctx.roster) {
      if (manager.role !== 'manager' || manager.deceased) continue;
      const weeksLeft = manager.contract?.weeksRemaining ?? 0;
      if (weeksLeft > 0) continue;

      const bookSize = bookOf(ctx.reps, manager.id).length;
      const appeal = managerPoachingAppeal(manager, bookSize);
      if (appeal <= 0) continue;

      const probability = clamp(appeal * aggression * settings.approachBaseChance, 0, 0.6);
      if (!chance(rng, probability)) continue;

      const currentRate = manager.contract?.weeklyRate ?? settings.ticketPriceBase * 100;
      const premium = Math.round(
        currentRate * (settings.approachOfferPremiumMin + appeal * settings.approachOfferPremiumRange),
      );

      attempts.push({
        wrestlerId: manager.id,
        rivalPromotionId: rival.id,
        offerPremium: premium,
        temptation: managerTemptation(manager, premium, weeksLeft, bookSize, settings),
      });
    }
  }

  const seen = new Set<string>();
  return attempts.filter((a) => (seen.has(a.wrestlerId) ? false : (seen.add(a.wrestlerId), true)));
}

/**
 * A poached manager doesn't leave alone — every client on his book loses
 * their man the same week, and per §0 each of them gets told, individually,
 * rather than the roster just quietly updating. Pure: returns the reps to
 * end and the line for each, leaves the actual mutation to the caller.
 */
export function managerDepartureClientLines(
  reps: readonly Representation[],
  managerId: Id,
  managerName: string,
  wrestlerById: (id: Id) => Wrestler | undefined,
): { remainingReps: Representation[]; lines: string[] } {
  const book = bookOf(reps, managerId);
  let remainingReps = reps;
  const lines: string[] = [];
  for (const rep of book) {
    remainingReps = endRepresentation(remainingReps, rep.clientId);
    const client = wrestlerById(rep.clientId);
    if (!client) continue;
    lines.push(`${managerName} is gone — poached by a rival, and ${client.name} is looking for new representation.`);
  }
  return { remainingReps: [...remainingReps], lines };
}
