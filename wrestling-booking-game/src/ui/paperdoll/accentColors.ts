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
