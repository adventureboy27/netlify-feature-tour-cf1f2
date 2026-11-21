// A network fee that arrived with no strings is just a number going up —
// broadcast.ts's own header comment. What that file's demands never covered
// is *who*: every existing BroadcastDemand is a numeric threshold checked
// against a BusinessSnapshot, nothing about the roster. This is the mid-deal
// twist version of that idea: you already signed, you already cashed a few
// checks, and now the network wants a say in who's on the card.
//
// Two flavors, picked off the real roster rather than named in advance:
// "feature our favorite" (whoever is actually your most popular act right
// now) or "keep this one off our air" (somebody with a real discipline
// record — an in-fiction reason the game already tracks, not an invented
// dislike). Either way the choice resolves in one dialogue, immediately —
// comply or refuse, never a forced roster change and never a persistent
// "banned from TV" flag that would need its own booking-gate plumbing.
//
// Pure: rolls whether it happens, who it targets, and resolves whatever the
// promoter picked into consequences the store applies. Nothing here mutates.

import type { Rng } from '../rng';
import { chance, pick } from '../rng';
import type { Broadcaster } from '../../data/broadcasters';
import type { Id, Wrestler, WorldSettings } from '../types';

export type NetworkDemandKind = 'mustFeature' | 'keepOffAir';

export interface NetworkDemandCall {
  week: number;
  dealId: string;
  dealName: string;
  kind: NetworkDemandKind;
  targetId: Id;
  targetName: string;
}

export function eligibleForNetworkDemand(
  week: number,
  dealId: string | null,
  rosterSize: number,
  settings: WorldSettings,
): boolean {
  return dealId !== null && week >= settings.networkDemandEarliestWeek && rosterSize >= settings.networkDemandMinRoster;
}

/** Somebody with a real, in-fiction reason for the network to dislike them — not an invented one. */
function hasPriors(w: Wrestler): boolean {
  return (w.discipline?.violations.length ?? 0) > 0;
}

/** Who found the holes, and who they took. Doesn't touch the world — the caller applies the outcome. */
export function rollNetworkDemand(
  rng: Rng,
  week: number,
  deal: Broadcaster,
  roster: readonly Wrestler[],
  settings: WorldSettings,
): NetworkDemandCall | null {
  if (!eligibleForNetworkDemand(week, deal.id, roster.length, settings)) return null;
  if (!chance(rng, settings.networkDemandChancePerWeek)) return null;

  const flagged = roster.filter(hasPriors);
  // A clean roster only ever gets the "feature our favorite" flavor — there
  // is no reason to invent one for "keep this one off our air" when nobody
  // on the books actually has a file.
  const kind: NetworkDemandKind = flagged.length > 0 && chance(rng, settings.networkDemandKeepOffAirShare) ? 'keepOffAir' : 'mustFeature';

  if (kind === 'keepOffAir') {
    const target = pick(rng, flagged);
    return { week, dealId: deal.id, dealName: deal.name, kind, targetId: target.id, targetName: target.name };
  }

  const target = roster.reduce((best, w) => (w.popularity > best.popularity ? w : best), roster[0]!);
  return { week, dealId: deal.id, dealName: deal.name, kind, targetId: target.id, targetName: target.name };
}

export type NetworkDemandChoice = 'comply' | 'refuse';

export function networkDemandOptions(call: NetworkDemandCall): { id: NetworkDemandChoice; label: string; gains: string; costs: string }[] {
  if (call.kind === 'mustFeature') {
    return [
      {
        id: 'comply',
        label: `Give them what they want`,
        gains: `${call.dealName} is happy, and there is a real bonus in it this week`,
        costs: `Everybody else in the room notices exactly who the network's favorite is`,
      },
      {
        id: 'refuse',
        label: `Tell them how this office books its own card`,
        gains: `Nobody outside this room decides who gets featured here`,
        costs: `${call.dealName} does not forget being told no, and it costs real money right now`,
      },
    ];
  }
  return [
    {
      id: 'comply',
      label: `Keep ${call.targetName} off the air`,
      gains: `${call.dealName} is happy, and there is a real bonus in it this week`,
      costs: `${call.targetName} knows exactly why they got benched, and it costs them`,
    },
    {
      id: 'refuse',
      label: `Put ${call.targetName} on television anyway`,
      gains: `${call.targetName} knows the office had their back`,
      costs: `${call.dealName} does not forget being told no, and it costs real money right now`,
    },
  ];
}

export interface NetworkDemandOutcome {
  moneyDelta: number;
  /** Applied to the named target. */
  targetMoraleDelta: number;
  /** Applied broadly, to everybody on the roster. */
  roomMoraleDelta: number;
  /** True on a refusal — counts toward the network walking, same grace as a numeric breach. */
  breach: boolean;
  line: string;
}

export function resolveNetworkDemand(call: NetworkDemandCall, choice: NetworkDemandChoice, settings: WorldSettings): NetworkDemandOutcome {
  if (choice === 'comply') {
    if (call.kind === 'mustFeature') {
      return {
        moneyDelta: settings.networkDemandComplyBonus,
        targetMoraleDelta: 0,
        roomMoraleDelta: -settings.networkDemandFeatureResentment,
        breach: false,
        line: `${call.dealName} got their way — ${call.targetName} is the network's guy now, and the rest of the room noticed.`,
      };
    }
    return {
      moneyDelta: settings.networkDemandComplyBonus,
      targetMoraleDelta: -settings.networkDemandBenchedMorale,
      roomMoraleDelta: 0,
      breach: false,
      line: `${call.dealName} got their way — ${call.targetName} is off the air until further notice.`,
    };
  }

  return {
    moneyDelta: -settings.networkDemandRefuseCost,
    targetMoraleDelta: call.kind === 'keepOffAir' ? settings.networkDemandStoodUpMorale : 0,
    roomMoraleDelta: settings.networkDemandRefuseRoomMorale,
    breach: true,
    line: `The office told ${call.dealName} no. ${call.dealName} is not going to like hearing that twice.`,
  };
}
