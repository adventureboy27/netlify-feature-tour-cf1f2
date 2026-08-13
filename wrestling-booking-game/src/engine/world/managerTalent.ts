// Managers as people.
//
// A wrestler's manager — a Heenan — was the one character in this game who
// was not a character. `MANAGERS` was a static list of twelve, shared by every
// save, rented a night at a time for a flat fee. No contract, no negotiation,
// no wage, no age, no career, no records, nothing to sign and nothing to lose.
// You could not poach one, they could not ask for more money, and a rival
// could not take one off you, because there was nothing to take.
//
// Meanwhile the game already had the right model and used it for exactly one
// case: a wrestler who moves into a suit (`career/transition.ts`) stays in
// `world.wrestlers` with role `'manager'`, and therefore carries a contract, a
// wage, a ledger, an age, mortality and a locker-room standing like anybody
// else. Two models for one job, and the good one was the accident.
//
// So this seeds the pool as *people*: the same twelve names and numbers,
// generated as free agents with role `'manager'`, signable on an ordinary
// contract. Everything a wrestler has, they have — because they are the same
// kind of record.
//
// The stat mapping is the only interesting part. A manager's numbers are a
// different vocabulary for the same person:
//
//   micWork     -> charisma      talking is talking
//   presence    -> popularity    a man the crowd knows is worth more stood there
//   deviousness -> alignment     inverted; a crook is a heel
//
// Ring stats are deliberately poor. These are not wrestlers who chose not to
// wrestle; they are people whose whole value is at ringside, and a manager who
// could main-event would just be a wrestler.

import type { Rng } from '../rng';
import { chance, clamp, randInt } from '../rng';
import type { Wrestler, WorldSettings } from '../types';
import type { Manager } from '../sim/ringside';
import type { FreeAgent } from './freeAgents';

export interface ManagerIntake {
  wrestlers: Wrestler[];
  freeAgents: FreeAgent[];
}

/**
 * Turn a generated person into a manager character, using one of the written
 * archetypes for the name and the numbers.
 *
 * The archetype supplies who they are; the generated record supplies
 * everything a person needs and a rented mouthpiece never had.
 */
export function asManagerTalent(
  rng: Rng,
  person: Wrestler,
  archetype: Manager,
  currentYear: number,
  settings: WorldSettings,
): Wrestler {
  const s = settings;
  const age = archetype.age ?? randInt(rng, s.managerTalentAgeMin, s.managerTalentAgeMax);

  return {
    ...person,
    name: archetype.name,
    age,
    // They have been in the business a long time — that is how you get this
    // job — so their debut is decades back, not this year.
    debutYear: currentYear - Math.max(1, age - s.managerTalentDebutAge),
    charisma: archetype.micWork,
    popularity: clamp(Math.round(archetype.presence * s.managerTalentPresenceShare), 0, 100),
    // A crook is a heel. Inverted, because deviousness runs the other way.
    alignment: clamp(Math.round(50 - archetype.deviousness / 2) * 2 - 50, -100, 100),
    // Whatever they were as a wrestler, it is not why anybody hires them.
    skill: clamp(Math.round(person.skill * s.managerTalentRingScale), 5, 99),
    agility: clamp(Math.round(person.agility * s.managerTalentRingScale), 5, 99),
    stamina: clamp(Math.round(person.stamina * s.managerTalentRingScale), 5, 99),
    strength: clamp(Math.round(person.strength * s.managerTalentRingScale), 5, 99),
    role: 'manager',
    careerStatus: 'journeyman',
    cardStatus: 'midcard',
    promotionId: null,
    contract: null,
    injury: null,
    momentum: 50,
  };
}

/**
 * Somebody new turns up with a suit and a mouth.
 *
 * Twelve names is fine for a decade and thin by year twenty-five, especially
 * now that managers can die. So the supply has to renew — and it renews from
 * where it actually would.
 *
 * Two doors, both of which already existed and neither of which was wired to
 * this job:
 *
 *   - A wrestler whose body is finished but whose mouth is not. That is
 *     `career/transition.ts`, and it is the commonest way somebody becomes a
 *     manager in real life.
 *   - Somebody who walked in off the street, cannot go, and can talk. That is
 *     the `naturalTalker` walk-on, which the game has been generating and then
 *     leaving as a wrestler who is bad at wrestling.
 *
 * This is the third: a stranger who was never either, arriving already old and
 * already good at it. Rare, because most of the pool should come through the
 * two doors above rather than out of nowhere.
 */
export function rollNewManager(
  rng: Rng,
  person: Wrestler,
  currentYear: number,
  settings: WorldSettings,
): { wrestler: Wrestler; freeAgent: FreeAgent } | null {
  if (!chance(rng, settings.managerTalentArrivalChance)) return null;

  const archetype: Manager = {
    id: person.id,
    name: person.name,
    // Whatever else they are, they can talk — that is the only reason
    // anybody would give them the job.
    micWork: clamp(randInt(rng, settings.managerTalentMinMic, 99), 5, 99),
    presence: randInt(rng, 30, 85),
    deviousness: randInt(rng, 5, 95),
    feePerShow: 0,
    blurb: '',
    age: randInt(rng, settings.managerTalentAgeMin, settings.managerTalentAgeMax),
  };

  const manager = asManagerTalent(rng, person, archetype, currentYear, settings);
  return {
    wrestler: manager,
    freeAgent: {
      wrestlerId: manager.id,
      reason: 'released',
      askingRate: settings.contractBaseWeeklyRate,
      weeksUnsigned: 0,
    },
  };
}

/**
 * The manager pool a world starts with.
 *
 * Free agents, every one of them — a company that wants a mouthpiece signs
 * one, the same as it signs anybody, and a rival can sign them first.
 */
export function seedManagerTalent(
  rng: Rng,
  archetypes: readonly Manager[],
  people: readonly Wrestler[],
  currentYear: number,
  settings: WorldSettings,
): ManagerIntake {
  const wrestlers: Wrestler[] = [];
  const freeAgents: FreeAgent[] = [];

  archetypes.forEach((archetype, i) => {
    const person = people[i];
    if (!person) return;
    const manager = asManagerTalent(rng, person, archetype, currentYear, settings);
    wrestlers.push(manager);
    freeAgents.push({
      wrestlerId: manager.id,
      reason: 'released',
      // What they used to cost per night, turned into a weekly wage. A
      // manager who was expensive to rent is expensive to keep.
      askingRate: Math.round(
        settings.contractBaseWeeklyRate + archetype.feePerShow * settings.managerTalentFeeToWage,
      ),
      weeksUnsigned: 0,
    });
  });

  return { wrestlers, freeAgents };
}
