// Where a match happened, and what was in the building — read off the show's
// own record (Show.staging, Show.venueId, attendance), so the room in the
// viewer is the room the night was rated in: the backyard with a ring off a
// trailer, the school gym with the scoreboard on, the arena with the rig.

import type { Show, StagingGear } from '../../engine/types';
import { venueById } from '../../data/venues';

/** The kinds of room, as drawn. */
export type VenueFamily = 'backyard' | 'gym' | 'hall' | 'club' | 'theatre' | 'arena' | 'stadium' | 'openAir';

export interface Setting {
  family: VenueFamily;
  /** The venue itself, for touches only one room has. */
  venueId?: string;
  /** Plywood and rope off a trailer; a real mat and ropes; a professional ring; one with an LED apron; one with a TV screen for an apron. */
  ring: 'plywood' | 'basic' | 'pro' | 'premium' | 'broadcast';
  /** The lighting rig is in, or it is the house lights. */
  lights: boolean;
  screen: boolean;
  stage: boolean;
  sound: boolean;
  cameras: boolean;
  barricades: boolean;
  /** Extras bought for the night. */
  security: boolean;
  medical: boolean;
  /** How full it was, 0-1. */
  fill: number;
}

/** What every match looked like before the night's staging was recorded, and on nights that are not ours. */
export const FULL_PRODUCTION: Setting = {
  family: 'arena',
  ring: 'pro',
  lights: true,
  screen: true,
  stage: false,
  sound: true,
  cameras: true,
  barricades: true,
  security: false,
  medical: false,
  fill: 0.9,
};

/** Rooms that are gyms: a court, a scoreboard, bleachers. */
const GYMS = new Set(['schoolGym', 'recCenter', 'universityFieldhouse']);

export function settingOf(show: Pick<Show, 'staging' | 'venueId' | 'attendance' | 'venueCapacity'> | undefined): Setting {
  const staging = show?.staging;
  if (!show || !staging) return FULL_PRODUCTION;
  const has = (g: StagingGear) => staging.gear.includes(g);
  const venueId = show.venueId;
  const kind = staging.venueKind;
  const family: VenueFamily =
    venueId === 'backyardRing'
      ? 'backyard'
      : kind === 'openAir'
        ? 'openAir'
        : kind === 'hall'
          ? GYMS.has(venueId) || /gym|recreation|fieldhouse/i.test(venueById(venueId)?.name ?? '')
            ? 'gym'
            : 'hall'
          : kind === 'club'
            ? 'club'
            : kind === 'theatre'
              ? 'theatre'
              : kind === 'stadium'
                ? 'stadium'
                : 'arena';
  return {
    family,
    venueId,
    ring: has('broadcastRing') ? 'broadcast' : has('premiumRing') ? 'premium' : has('ring') ? 'pro' : has('matRopes') ? 'basic' : 'plywood',
    lights: has('lights'),
    screen: has('screen'),
    stage: has('stage'),
    sound: has('sound'),
    cameras: has('cameras'),
    barricades: has('barricades'),
    security: staging.extras.includes('security'),
    medical: staging.extras.includes('medicalStaff'),
    fill: show.venueCapacity > 0 ? Math.max(0, Math.min(1, show.attendance / show.venueCapacity)) : 0.9,
  };
}

/** The top two rings share the dressing — the printed canvas, the black-and-gold pads, the LED posts — and differ in the apron. */
export const isFancyRing = (ring: Setting['ring']) => ring === 'premium' || ring === 'broadcast';
