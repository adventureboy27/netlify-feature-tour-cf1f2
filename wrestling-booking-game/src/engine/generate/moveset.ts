// Move-set generation, §3.3. Move type is biased by wrestling style so a
// generated finisher matches how the wrestler actually works.

import type { Rng } from '../rng';
import { pick, chance, randInt } from '../rng';
import type { Move, MoveSet, MoveStyle, MoveType, WrestlingStyle } from '../types';
import { MOVE_ADJECTIVES, MOVE_CONCEPTS, MOVE_NOUNS_BY_TYPE } from '../../data/moves';

const STYLE_TO_MOVE_STYLE: Record<WrestlingStyle, MoveStyle> = {
  bruiser: 'strike',
  technical: 'technical',
  highFlyer: 'aerial',
  powerhouse: 'power',
  striker: 'strike',
  luchador: 'aerial',
  submission: 'technical',
  hardcore: 'brawl',
  showman: 'strike',
  giant: 'power',
  allRounder: 'technical',
  oldSchool: 'technical',
};

const MOVE_STYLE_TYPES: Record<MoveStyle, MoveType[]> = {
  power: ['slam', 'powerbomb', 'clothesline'],
  technical: ['suplex', 'submission'],
  aerial: ['aerial', 'strike'],
  strike: ['strike', 'stunner'],
  brawl: ['clothesline', 'driver', 'strike'],
};

function generateMoveName(rng: Rng): string {
  const concept = pick(rng, MOVE_CONCEPTS);
  return chance(rng, 0.6) ? `${pick(rng, MOVE_ADJECTIVES)} ${concept}` : concept;
}

function generateMove(rng: Rng, type: MoveType, damageFloor: number, riskFloor: number): Move {
  const nouns = MOVE_NOUNS_BY_TYPE[type];
  const noun = pick(rng, nouns);
  const name = chance(rng, 0.7) ? `${generateMoveName(rng)} ${noun}` : noun;
  return {
    name,
    type,
    damage: Math.min(100, damageFloor + randInt(rng, 0, 15)),
    risk: Math.min(100, riskFloor + randInt(rng, 0, 15)),
    crowdPop: randInt(rng, 20, 60),
  };
}

export function generateMoveSet(rng: Rng, style: WrestlingStyle): MoveSet {
  const moveStyle = STYLE_TO_MOVE_STYLE[style];
  const types = MOVE_STYLE_TYPES[moveStyle];

  const finisher = generateMove(rng, pick(rng, types), 55, 40);
  const secondaryFinisher = chance(rng, 0.35) ? generateMove(rng, pick(rng, types), 45, 30) : undefined;
  const signatureCount = randInt(rng, 2, 4);
  const signatures: Move[] = Array.from({ length: signatureCount }, () =>
    generateMove(rng, pick(rng, types), 25, 15),
  );

  return { finisher, secondaryFinisher, signatures, style: moveStyle };
}
