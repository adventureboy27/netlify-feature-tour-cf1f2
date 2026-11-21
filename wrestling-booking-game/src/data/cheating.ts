// Behind the referee's back, in words. See engine/sim/cheating.ts.
// {actor} did it, {victim} had it done to them, {weapon} what with.

/** Got away with it. */
export const CHEAP_SHOT_LINES = {
  wrestler: [
    'With the referee looking the other way, {actor} got hold of {weapon} and laid {victim} out with it.',
    "{actor} waited until the referee's back was turned, then caught {victim} with {weapon}. Nobody in stripes saw a thing.",
  ],
  manager: [
    '{actor} got up on the apron behind the referee\'s back and caught {victim} with {weapon}.',
    'The referee never saw {actor} swing {weapon} at {victim} from the floor — and {victim} never saw it coming.',
  ],
} as const;

/** Seen: the match is over, and the one it was used on wins it. */
export const SAW_IT_LINES = {
  wrestler: [
    '{actor} went for {weapon} — and the referee saw every bit of it. That is a disqualification, and {victim} wins.',
    '{actor} swung {weapon} at {victim} right in front of the referee, and that was the end of the match.',
  ],
  manager: [
    '{actor} swung {weapon} at {victim} from the floor right in front of the referee. That ends it: {victim} wins by disqualification.',
    'The referee caught {actor} with {weapon} in hand going after {victim}, and called for the bell on the spot.',
  ],
} as const;

export const CHEAT_WEAPON_NAMES = {
  chair: 'a steel chair',
  can: 'a trash can',
  kendo: 'a kendo stick',
  steps: 'the steel steps',
} as const;
