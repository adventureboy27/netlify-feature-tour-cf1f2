// A broader, more saturated palette than skin or hair — for gear that makes
// sense in many colors (a bandana, a cap) rather than one fixed color.
// Applied the same way: mask + mix-blend-mode tint over the drawn shape, see
// ComposedPortrait.tsx. Only used for a prop whose filename opts in with the
// `--tint` marker (see paperdollAssets.ts); anything else keeps whatever
// color it was actually painted.
export interface AccentColor {
  id: string;
  label: string;
  color: string;
}

export const ACCENT_COLORS: readonly AccentColor[] = [
  { id: 'black', label: 'Black', color: '#1a1a1a' },
  { id: 'white', label: 'White', color: '#e8e5dc' },
  { id: 'red', label: 'Red', color: '#a3251f' },
  { id: 'blue', label: 'Blue', color: '#20507a' },
  { id: 'green', label: 'Green', color: '#3a5c2e' },
  { id: 'gold', label: 'Gold', color: '#b5871f' },
  { id: 'purple', label: 'Purple', color: '#5a3170' },
  { id: 'orange', label: 'Orange', color: '#b0521e' },
];

// Colors for anything worn against the chest. No gold or orange: on most
// skin tones they sit close enough to skin that a top stops reading as
// clothing at all. A few extra fabric colors make up the variety.
export const CLOTH_COLORS: readonly AccentColor[] = [
  ...ACCENT_COLORS.filter((c) => c.id !== 'gold' && c.id !== 'orange'),
  { id: 'teal', label: 'Teal', color: '#1f8a8a' },
  { id: 'pink', label: 'Pink', color: '#d0457b' },
  { id: 'sky', label: 'Sky blue', color: '#4a90c2' },
  { id: 'silver', label: 'Silver', color: '#aeb4bd' },
  { id: 'crimson', label: 'Crimson', color: '#c8102e' },
  { id: 'royal', label: 'Royal blue', color: '#2545b8' },
];
