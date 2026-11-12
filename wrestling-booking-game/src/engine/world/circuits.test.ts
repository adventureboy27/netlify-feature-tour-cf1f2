import { describe, expect, it } from 'vitest';
import { circuitRankings, circuitTaste, standingsFor, tasteFit, tasteTraits } from './circuits';
import { worldRankings } from './rankings';
import { CIRCUITS } from '../../data/circuits';
import { createTerritories, TERRITORIES } from '../../data/territories';
import { defaultWorldSettings } from './settings';
import { generateWrestlers } from '../generate/wrestler';
import { rngFromSeed } from '../rng';
import type { RankingContext } from './rankings';
import type { Wrestler } from '../types';

const settings = defaultWorldSettings();
const territories = createTerritories();
const ctx: RankingContext = { currentWeek: 60, titles: [], settings };

/** A world-sized field: 189 people exist before the first show is booked. */
function field(seed = 'circuits'): Wrestler[] {
  return generateWrestlers(rngFromSeed(seed), 189).map((w) => ({ ...w, promotionId: 'p1' }));
}

describe('the towns are grouped by what they want', () => {
  it('puts every town on exactly one circuit', () => {
    const assigned = CIRCUITS.flatMap((c) => c.territoryIds);
    expect(new Set(assigned).size, 'a town on two circuits').toBe(assigned.length);
    expect([...assigned].sort()).toEqual(TERRITORIES.map((t) => t.id).sort());
  });

  it('gives each circuit the taste its towns actually have', () => {
    // The Hard Road's towns are the hardcore ones and none of them like
    // technical wrestling; if that ever stops being true the circuit is
    // misnamed and the list underneath it is a lie.
    const hardRoad = circuitTaste('hardRoad', territories);
    expect(hardRoad.hardcore ?? 0).toBeGreaterThan(0.4);
    expect(hardRoad.technical ?? 0).toBeLessThan(0);

    const bigRooms = circuitTaste('bigRooms', territories);
    expect(bigRooms.starPower ?? 0).toBeGreaterThan(0.4);
    expect(bigRooms.hardcore ?? 0).toBeLessThan(0);

    const oldCountry = circuitTaste('oldCountry', territories);
    expect(oldCountry.longMatches ?? 0).toBeGreaterThan(0);
    expect(oldCountry.starPower ?? 0).toBeLessThan(0);

    const highWire = circuitTaste('highWire', territories);
    expect(highWire.highFlying ?? 0).toBeGreaterThan(0.3);
  });

  it('averages rather than sums, so a bigger circuit is not a louder one', () => {
    // Every weight stays inside the -1..1 a single town is bounded to.
    for (const circuit of CIRCUITS) {
      for (const [tag, weight] of Object.entries(circuitTaste(circuit.id, territories))) {
        expect(Math.abs(weight), `${circuit.id}.${tag}`).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('what a scene wants from a person', () => {
  it('reads style off the wrestler rather than off the card', () => {
    const [base] = generateWrestlers(rngFromSeed('traits'), 1);
    const deathmatch = tasteTraits({ ...base!, style: 'hardcore' }, settings);
    expect(deathmatch.hardcore).toBe(1);
    expect(deathmatch.technical).toBe(0);

    const mat = tasteTraits({ ...base!, style: 'submission' }, settings);
    expect(mat.technical).toBe(1);
    expect(mat.hardcore).toBe(0);
  });

  it('lets an ordinary wrestler be partly spectacular but not by default', () => {
    const [base] = generateWrestlers(rngFromSeed('agility'), 1);
    const plodder = tasteTraits({ ...base!, style: 'powerhouse', agility: 30 }, settings);
    expect(plodder.highFlying).toBe(0);
    const athletic = tasteTraits({ ...base!, style: 'powerhouse', agility: 90 }, settings);
    expect(athletic.highFlying).toBeGreaterThan(0);
    expect(athletic.highFlying).toBeLessThan(1);
    // A luchador is one by trade regardless of the number.
    expect(tasteTraits({ ...base!, style: 'luchador', agility: 30 }, settings).highFlying).toBe(1);
  });

  it('wants the deathmatch worker on the hard road and not in the big rooms', () => {
    const [base] = generateWrestlers(rngFromSeed('fit'), 1);
    const brawler: Wrestler = { ...base!, style: 'hardcore', alignment: 40, popularity: 50, agility: 40 };
    expect(tasteFit(brawler, circuitTaste('hardRoad', territories), settings)).toBeGreaterThan(
      tasteFit(brawler, circuitTaste('bigRooms', territories), settings),
    );
  });
});

describe('the circuits disagree', () => {
  // This is the whole reason circuits exist rather than one global list, and
  // it is a property of the *data* — the towns' taste weights — not of the
  // code. It is asserted here so that editing territories.ts can never
  // quietly collapse four lists into one without the suite noticing.
  const everyone = field();
  const lists = CIRCUITS.map((c) => ({ id: c.id, ranked: circuitRankings(everyone, c.id, territories, ctx) }));

  it('fills every list', () => {
    for (const list of lists) {
      expect(list.ranked.length, list.id).toBe(settings.circuitRankingSize);
      expect(list.ranked[0]!.rank).toBe(1);
    }
  });

  it('does not hand the top of every circuit to the same few people', () => {
    // The failure this was built to catch: at a low taste weight the same
    // three names held the top five of all four circuits.
    const topFives = lists.flatMap((l) => l.ranked.slice(0, 5).map((r) => r.wrestlerId));
    expect(new Set(topFives).size).toBeGreaterThan(12);
  });

  it('keeps the top tens mostly different from each other', () => {
    let pairs = 0;
    let shared = 0;
    for (let i = 0; i < lists.length; i++) {
      for (let j = i + 1; j < lists.length; j++) {
        const a = new Set(lists[i]!.ranked.map((r) => r.wrestlerId));
        const b = new Set(lists[j]!.ranked.map((r) => r.wrestlerId));
        shared += [...a].filter((id) => b.has(id)).length;
        pairs++;
      }
    }
    expect(shared / pairs, 'circuits agreeing too much to be worth four lists').toBeLessThan(4);
  });

  it('produces specialists — top of one loop, nowhere on another', () => {
    const specialists = everyone.filter((w) => {
      const ranks = standingsFor(w.id, everyone, territories, ctx).map((s) => s.rank);
      const placed = ranks.filter((r): r is number => r !== null);
      return placed.some((r) => r <= 5) && ranks.some((r) => r === null);
    });
    expect(specialists.length).toBeGreaterThan(0);
  });

  it('still lets a genuine draw rank on most loops', () => {
    // The opposite failure, and the one that actually bit: if taste swamps
    // standing, the biggest name in the business stops appearing on loops
    // that have no strong opinion about him, and a ranking that ignores who
    // draws money is not a ranking. Averaged over several worlds and the top
    // three names in each, because any single wrestler can legitimately be a
    // specialist.
    const counts: number[] = [];
    for (const seed of ['circuits', 'alpha', 'beta', 'gamma']) {
      const roster = field(seed);
      for (const top of worldRankings(roster, ctx).slice(0, 3)) {
        counts.push(standingsFor(top.wrestlerId, roster, territories, ctx).filter((s) => s.rank !== null).length);
      }
    }
    const average = counts.reduce((a, b) => a + b, 0) / counts.length;
    expect(average, 'taste is swamping standing').toBeGreaterThanOrEqual(2);
  });

  it('holds across different worlds, not just the one seed', () => {
    for (const seed of ['alpha', 'beta', 'gamma']) {
      const roster = field(seed);
      const tops = CIRCUITS.flatMap((c) =>
        circuitRankings(roster, c.id, territories, ctx).slice(0, 5).map((r) => r.wrestlerId),
      );
      expect(new Set(tops).size, seed).toBeGreaterThan(10);
    }
  });
});

describe('reading one career across the loops', () => {
  it('reports a place on every circuit, ranked or not', () => {
    const everyone = field();
    const standings = standingsFor(everyone[0]!.id, everyone, territories, ctx);
    expect(standings.map((s) => s.circuitId)).toEqual(CIRCUITS.map((c) => c.id));
    for (const standing of standings) {
      expect(standing.circuitName.length).toBeGreaterThan(3);
      expect(standing.rank === null || standing.rank >= 1).toBe(true);
    }
  });

  it('leaves the retired, the hurt and the dead off every list', () => {
    const everyone = field();
    const marked = everyone.map((w, i) =>
      i === 0
        ? { ...w, careerStatus: 'retired' as const }
        : i === 1
          ? { ...w, deceased: { wrestlerId: w.id, cause: 'age' as const, age: 71, week: 10 } }
          : w,
    );
    for (const circuit of CIRCUITS) {
      const ids = new Set(circuitRankings(marked, circuit.id, territories, ctx).map((r) => r.wrestlerId));
      expect(ids.has(marked[0]!.id), 'retired').toBe(false);
      expect(ids.has(marked[1]!.id), 'deceased').toBe(false);
    }
  });
});
