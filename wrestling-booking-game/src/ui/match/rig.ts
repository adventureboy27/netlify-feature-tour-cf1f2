// The skeleton under a match figure: where the joints are, and the named
// limb positions ("stances") a choreography can ask for.
//
// A figure has nine joints — waist, and a shoulder, elbow, hip and knee on
// each side. The art faces the camera while the action runs left-to-right,
// so limbs are named by which side of the OPPONENT they are on, not left or
// right: the LEAD arm and leg are the ones nearer the opponent, the REAR
// ones are behind. Every angle is in degrees and positive means "swinging
// toward the opponent" (a knee is the exception: positive is the shin
// folding back under the thigh, the only way a knee goes).

/** [shoulder, elbow] or [hip, knee]. */
type Limb = readonly [number, number];
export interface Stance {
  /** Waist: positive bends the upper body toward the opponent. */
  w: number;
  la: Limb;
  ra: Limb;
  ll: Limb;
  rl: Limb;
}

const s = (w: number, la: Limb, ra: Limb, ll: Limb, rl: Limb): Stance => ({ w, la, ra, ll, rl });

export const STANCES = {
  stand: s(0, [0, 0], [0, 0], [0, 0], [0, 0]),
  guard: s(6, [38, 100], [22, 105], [10, 14], [-10, 10]),
  wind: s(-10, [-35, 70], [35, 90], [-6, 8], [14, 18]),
  punch: s(12, [88, 4], [-18, 80], [20, 22], [-18, 6]),
  reach: s(14, [78, 22], [62, 34], [18, 24], [-14, 10]),
  choke: s(18, [72, 105], [52, 115], [14, 20], [-12, 10]),
  lift: s(-8, [165, 8], [152, 12], [8, 18], [-6, 14]),
  carry: s(-6, [105, 65], [92, 70], [10, 22], [-8, 16]),
  bend: s(38, [22, 10], [18, 12], [6, 16], [-6, 16]),
  stagger: s(-16, [-45, 34], [-62, 22], [12, 24], [-12, 6]),
  fall: s(-12, [142, 22], [154, 18], [32, 34], [16, 48]),
  hang: s(4, [172, 8], [164, 12], [10, 20], [-6, 30]),
  flat: s(0, [38, 16], [-34, 18], [9, 14], [-7, 5]),
  run: s(16, [55, 85], [-42, 85], [48, 62], [-28, 34]),
  crouch: s(24, [34, 85], [30, 88], [52, 98], [38, 98]),
  seated: s(6, [60, 40], [50, 46], [86, 84], [80, 88]),
  kick: s(-32, [-32, 44], [42, 64], [98, 4], [-10, 12]),
  dropkick: s(12, [-30, 22], [-36, 26], [84, 4], [78, 6]),
  fly: s(0, [152, 10], [164, 8], [-10, 10], [6, 22]),
  tuck: s(42, [62, 95], [58, 98], [74, 104], [70, 108]),
  spear: s(4, [102, 10], [98, 14], [-20, 10], [-42, 32]),
  clothes: s(12, [92, 0], [-30, 64], [44, 58], [-26, 30]),
  elbowUp: s(-10, [152, 124], [30, 60], [16, 30], [-10, 26]),
  cover: s(10, [62, 44], [84, 52], [10, 22], [-22, 44]),
  kickout: s(8, [124, 22], [96, 30], [72, 12], [58, 24]),
  tap: s(0, [104, 92], [-30, 20], [6, 30], [-6, 52]),
  celebrate: s(-4, [168, 8], [-168, 8], [4, 4], [-4, 4]),
} as const satisfies Record<string, Stance>;

export type StanceId = keyof typeof STANCES;

/** Pose as choreography.ts writes it; only the fields a stance guess needs. */
type PoseLike = readonly [at: number, x: number, y: number, rot: number, sy?: number, stance?: StanceId];

/**
 * A sensible stance for a frame that did not name one, from what the body
 * as a whole is doing: lying, airborne, driving forward, reeling back.
 */
export function autoStance(frames: readonly PoseLike[], i: number): StanceId {
  const [at, x, y, rot, sy = 1] = frames[i]!;
  const lean = ((rot % 360) + 540) % 360 - 180;
  const flatAngle = Math.abs(Math.abs(lean) - 90) <= 30;
  if (flatAngle && y <= 4.5) return 'flat';
  if (Math.abs(lean) > 120) return 'hang';
  if (y > 5) return lean < 0 ? 'fall' : 'fly';
  if (sy < 0.95) return 'crouch';
  if (lean >= 25) return 'bend';
  if (lean >= 10) return 'punch';
  if (lean <= -10) return 'stagger';
  const prev = frames[i - 1];
  if (prev && Math.abs(x - prev[1]) > 3.5) return 'run';
  return at === 0 || at === 1 ? 'stand' : 'guard';
}

// Leg segment lengths, in the leg drawing's own units (it is 100 wide).
const THIGH = 32;
const SHIN = 37;
/**
 * How far the hips come down when the knees bend, in leg units — a crouch
 * rotates the legs about the hip, and without this the feet would lift off
 * the mat instead of the body sinking.
 */
export function hipDrop(stance: Stance): number {
  const reach = ([hip, knee]: Limb) => THIGH * Math.cos((hip * Math.PI) / 180) + SHIN * Math.cos(((hip - knee) * Math.PI) / 180);
  return Math.max(0, THIGH + SHIN - Math.max(reach(stance.ll), reach(stance.rl)));
}

// ---- geometry ---------------------------------------------------------------
// Joint positions on the two real base bodies, in the 512 canvas the
// paperdoll art is drawn on. Measured from the same alpha data as
// tools/gen-paperdoll-assets.mjs's GAP table, which `gap` repeats: the
// centre of the slit between the (screen-)left arm and the torso, as [y, x].
// The right side is the mirror about `cx`.

export interface BodyRig {
  cx: number;
  shoulder: readonly [number, number];
  elbow: readonly [number, number];
  /** Top of the cut that separates arm from torso. */
  shoulderTop: number;
  gap: readonly (readonly [number, number])[];
}

export const BODY_RIG: Record<'m' | 'f', BodyRig> = {
  m: {
    cx: 253.5,
    shoulder: [130, 214],
    elbow: [107, 352],
    shoulderTop: 166,
    gap: [[304, 151], [320, 155], [336, 158.5], [360, 156.5], [392, 157.5], [424, 155], [440, 149], [456, 141.5], [472, 136], [496, 130], [520, 126]],
  },
  f: {
    cx: 255.5,
    shoulder: [142, 222],
    elbow: [121, 368],
    shoulderTop: 186,
    gap: [[280, 162.5], [296, 156.5], [312, 155.5], [328, 158.5], [344, 166], [368, 163.5], [392, 167], [416, 163], [440, 154], [456, 147.5], [472, 141.5], [496, 136.5], [520, 133]],
  },
};

// The legs drawing's joints, in its 100-wide units (screen-left leg; the right mirrors).
export const LEG_RIG = { hip: [40, 15], knee: [40, 47] } as const;
